import cors from "cors"
import dotenv from "dotenv"
import express, { Express } from "express"
import fs from "fs"
import { createServer } from "http"
import { Server, Socket } from "socket.io"

import { ConnectionManager } from "./ConnectionManager"
import { DokkuClient } from "./DokkuClient"
import { Sandbox } from "./Sandbox"
import { SecureGitClient } from "./SecureGitClient"
import { socketAuth } from "./socketAuth" // Import the new socketAuth middleware
import { TFile, TFolder } from "./types"

// Log errors and send a notification to the client
export const handleErrors = (message: string, error: any, socket: Socket) => {
  console.error(message, error)
  socket.emit("error", `${message} ${error.message ?? error}`)
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  // Do not exit the process
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
  // Do not exit the process
})

// Initialize containers and managers
const connections = new ConnectionManager()
const sandboxes: Record<string, Sandbox> = {}

// Load environment variables
dotenv.config()

// Initialize Express app and create HTTP server
const app: Express = express()
const port = process.env.PORT || 4000
app.use(cors())
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow connections from any origin
  },
})

// Middleware for socket authentication
io.use(socketAuth) // Use the new socketAuth middleware

// Check for required environment variables
if (!process.env.DOKKU_HOST)
  console.warn("Environment variable DOKKU_HOST is not defined")
if (!process.env.DOKKU_USERNAME)
  console.warn("Environment variable DOKKU_USERNAME is not defined")
if (!process.env.DOKKU_KEY)
  console.warn("Environment variable DOKKU_KEY is not defined")

// Initialize Dokku client
const dokkuClient =
  process.env.DOKKU_HOST && process.env.DOKKU_KEY && process.env.DOKKU_USERNAME
    ? new DokkuClient({
        host: process.env.DOKKU_HOST,
        username: process.env.DOKKU_USERNAME,
        privateKey: fs.readFileSync(process.env.DOKKU_KEY),
      })
    : null
dokkuClient?.connect()

// Initialize Git client used to deploy Dokku apps
const gitClient =
  process.env.DOKKU_HOST && process.env.DOKKU_KEY
    ? new SecureGitClient(
        `dokku@${process.env.DOKKU_HOST}`,
        process.env.DOKKU_KEY
      )
    : null

// Handle a client connecting to the server
io.on("connection", async (socket) => {
  try {
    // This data comes is added by our authentication middleware
    const data = socket.data as {
      userId: string
      sandboxId: string
      isOwner: boolean
      type: string
    }

    // Register the connection
    connections.addConnectionForSandbox(socket, data.sandboxId, data.isOwner)

    // Disable access unless the sandbox owner is connected
    if (!data.isOwner && !connections.ownerIsConnected(data.sandboxId)) {
      socket.emit("disableAccess", "The sandbox owner is not connected.")
      return
    }

    try {
      // Create or retrieve the sandbox manager for the given sandbox ID
      const sandbox =
        sandboxes[data.sandboxId] ??
        new Sandbox(data.sandboxId, data.type, {
          dokkuClient,
          gitClient,
        })
      sandboxes[data.sandboxId] = sandbox

      // This callback recieves an update when the file list changes, and notifies all relevant connections.
      const sendFileNotifications = (files: (TFolder | TFile)[]) => {
        connections
          .connectionsForSandbox(data.sandboxId)
          .forEach((socket: Socket) => {
            socket.emit("loaded", files)
          })
      }

      // Initialize the sandbox container
      // The file manager and terminal managers will be set up if they have been closed
      await sandbox.initialize(sendFileNotifications)
      socket.emit("loaded", await sandbox.fileManager?.getFileTree())

      // Register event handlers for the sandbox
      // For each event handler, listen on the socket for that event
      // Pass connection-specific information to the handlers
      Object.entries(
        sandbox.handlers({
          userId: data.userId,
          isOwner: data.isOwner,
          socket,
        })
      ).forEach(([event, handler]) => {
        socket.on(
          event,
          async (options: any, callback?: (response: any) => void) => {
            try {
              const result = await handler(options)
              callback?.(result)
            } catch (e: any) {
              handleErrors(`Error processing event "${event}":`, e, socket)
            }
          }
        )
      })

      socket.emit("ready")

      // Handle disconnection event
      socket.on("disconnect", async () => {
        try {
          // Deregister the connection
          connections.removeConnectionForSandbox(
            socket,
            data.sandboxId,
            data.isOwner
          )

          // If the owner has disconnected from all sockets, close open terminals and file watchers.o
          // The sandbox itself will timeout after the heartbeat stops.
          if (data.isOwner && !connections.ownerIsConnected(data.sandboxId)) {
            await sandbox.disconnect()
            socket.broadcast.emit(
              "disableAccess",
              "The sandbox owner has disconnected."
            )
          }
        } catch (e: any) {
          handleErrors("Error disconnecting:", e, socket)
        }
      })
    } catch (e: any) {
      handleErrors(`Error initializing sandbox ${data.sandboxId}:`, e, socket)
    }
  } catch (e: any) {
    handleErrors("Error connecting:", e, socket)
  }
})

// Start the server
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
