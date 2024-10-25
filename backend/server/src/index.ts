import cors from "cors"
import dotenv from "dotenv"
import express, { Express } from "express"
import fs from "fs"
import { createServer } from "http"
import { Server } from "socket.io"
import { AIWorker } from "./AIWorker"

import { DokkuClient } from "./DokkuClient"
import { OwnerConnectionManager } from "./OwnerConnectionManager"
import { SandboxManager } from "./SandboxManager"
import { SecureGitClient } from "./SecureGitClient"
import { socketAuth } from "./socketAuth"; // Import the new socketAuth middleware

// Log errors and send a notification to the client
export const handleErrors = (message: string, error: any, socket: any) => {
  console.error(message, error);
  socket.emit("error", `${message} ${error.message ?? error}`);
};

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
const connectionManager = new OwnerConnectionManager()
const sandboxManagers: Record<string, SandboxManager> = {}

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

// Add this near the top of the file, after other initializations
const aiWorker = new AIWorker(
  process.env.AI_WORKER_URL!,
  process.env.CF_AI_KEY!,
  process.env.DATABASE_WORKER_URL!,
  process.env.WORKERS_KEY!
)

// Handle a client connecting to the server
io.on("connection", async (socket) => {
  try {
    // This data comes is added by our authentication middleware
    const data = socket.data as {
      userId: string
      sandboxId: string
      isOwner: boolean
    }

    // Disable access unless the sandbox owner is connected
    if (data.isOwner) {
      connectionManager.ownerConnected(data.sandboxId)
    } else {
      if (!connectionManager.ownerIsConnected(data.sandboxId)) {
        socket.emit("disableAccess", "The sandbox owner is not connected.")
        return
      }
    }

    try {
      // Create or retrieve the sandbox manager for the given sandbox ID
      const sandboxManager = sandboxManagers[data.sandboxId] ?? new SandboxManager(
        data.sandboxId,
        data.userId,
        { aiWorker, dokkuClient, gitClient, socket }
      )

      // Initialize the sandbox container
      sandboxManager.initializeContainer()

      // Register event handlers for the sandbox
      Object.entries(sandboxManager.handlers()).forEach(([event, handler]) => {
        socket.on(event, async (options: any, callback?: (response: any) => void) => {
          try {
            callback?.(await handler(options));
          } catch (e: any) {
            handleErrors(`Error processing event "${event}":`, e, socket);
          }
        });
      });

      // Handle disconnection event
      socket.on("disconnect", async () => {
        try {
          if (data.isOwner) {
            connectionManager.ownerDisconnected(data.sandboxId)
          }

          await sandboxManager.disconnect()

          if (data.isOwner && !connectionManager.ownerIsConnected(data.sandboxId)) {
            socket.broadcast.emit(
              "disableAccess",
              "The sandbox owner has disconnected."
            )
          }
        } catch (e: any) {
          handleErrors("Error disconnecting:", e, socket);
        }
      })

    } catch (e: any) {
      handleErrors(`Error initializing sandbox ${data.sandboxId}:`, e, socket);
    }

  } catch (e: any) {
    handleErrors("Error connecting:", e, socket);
  }
})

// Start the server
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`)
})