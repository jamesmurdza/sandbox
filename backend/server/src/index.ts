import cors from "cors"
import dotenv from "dotenv"
import express, { Express } from "express"
import fs from "fs"
import { createServer } from "http"
import { Server, Socket } from "socket.io"
import { GitHubApiRoutes } from "./routes/GitHubApiRoutes"
import sandboxRoutes from "./routes/sandbox"
import userRoutes from "./routes/user"

import { attachAuthToken } from "./middleware/attachAuthToken"
import { requireAuth } from "./middleware/clerkAuth"
import { socketAuth } from "./middleware/socketAuth"
import { ConnectionManager } from "./services/ConnectionManager"
import { DokkuClient } from "./services/DokkuClient"
import { Project } from "./services/Project"
import { createProjectHandlers } from "./services/ProjectHandlers"
import { SecureGitClient } from "./services/SecureGitClient"
import { TFile, TFolder } from "./utils/types"

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

// Load environment variables
dotenv.config()

// Initialize Express app and create HTTP server
const app: Express = express()
const port = process.env.PORT || 4000
app.use(cors())

// Apply Clerk authentication middleware and attach auth token middleware to all API routes
app.use("/api", requireAuth, attachAuthToken)

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
      projectId: string
      isOwner: boolean
      containerId: string
      type: string
    }

    // Register the connection
    connections.addConnectionForProject(socket, data.projectId)

    try {
      // This callback recieves an update when the file list changes, and notifies all relevant connections.
      const sendFileNotifications = (files: (TFolder | TFile)[]) => {
        connections
          .connectionsForProject(data.projectId)
          .forEach((socket: Socket) => {
            socket.emit("loaded", files)
          })
      }

      // Create or retrieve the project container for the given project ID
      const project = new Project(data.projectId)
      await project.initialize()
      await project.fileManager?.startWatching(sendFileNotifications)
      socket.emit("loaded", await project.fileManager?.getFileTree())

      // Register event handlers for the project
      const handlers = createProjectHandlers(
        project,
        {
          userId: data.userId,
          isOwner: data.isOwner,
          socket,
        },
        {
          dokkuClient,
          gitClient,
        }
      )

      // For each event handler, listen on the socket for that event
      Object.entries(handlers).forEach(([event, handler]) => {
        const typedHandler = handler as (options: any) => Promise<any>
        socket.on(
          event,
          async (options: any, callback?: (response: any) => void) => {
            try {
              const result = await typedHandler(options)
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
          connections.removeConnectionForProject(socket, data.projectId)
        } catch (e: any) {
          handleErrors("Error disconnecting:", e, socket)
        }
      })
    } catch (e: any) {
      handleErrors(`Error initializing project ${data.projectId}:`, e, socket)
    }
  } catch (e: any) {
    handleErrors("Error connecting:", e, socket)
  }
})

// REST API routes:
app.use(express.json())
const githubApi = new GitHubApiRoutes()
app.use("/api/github", githubApi.router)
app.use("/api/sandbox", sandboxRoutes)
app.use("/api/user", userRoutes)

// Start the server
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
