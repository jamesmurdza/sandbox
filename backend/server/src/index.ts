import cors from "cors"
import dotenv from "dotenv"
import { Sandbox } from "e2b"
import express, { Express } from "express"
import fs from "fs"
import { createServer } from "http"
import { Server } from "socket.io"
import { AIWorker } from "./AIWorker"
import { CONTAINER_TIMEOUT } from "./constants"
import { DokkuClient } from "./DokkuClient"
import { FileManager, SandboxFiles } from "./FileManager"
import { SandboxManager } from "./SandboxManager"
import { SecureGitClient } from "./SecureGitClient"
import { socketAuth } from "./socketAuth"; // Import the new socketAuth middleware
import { TerminalManager } from "./TerminalManager"
import { LockManager } from "./utils"

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  // Do not exit the process
  // You can add additional logging or recovery logic here
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
  // Do not exit the process
  // You can also handle the rejected promise here if needed
})

// Check if the sandbox owner is connected
function isOwnerConnected(sandboxId: string): boolean {
  return (connections[sandboxId] ?? 0) > 0
}

// Initialize containers and managers
const containers: Record<string, Sandbox> = {}
const connections: Record<string, number> = {}
const fileManagers: Record<string, FileManager> = {}
const terminalManagers: Record<string, TerminalManager> = {}

// Load environment variables
dotenv.config()

// Initialize Express app and create HTTP server
const app: Express = express()
const port = process.env.PORT || 4000
app.use(cors())
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
})

// Middleware for socket authentication
io.use(socketAuth) // Use the new socketAuth middleware

// Initialize lock manager
const lockManager = new LockManager()

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
    const data = socket.data as {
      userId: string
      sandboxId: string
      isOwner: boolean
    }

    // Handle connection based on user type (owner or not)
    if (data.isOwner) {
      connections[data.sandboxId] = (connections[data.sandboxId] ?? 0) + 1
    } else {
      if (!isOwnerConnected(data.sandboxId)) {
        socket.emit("disableAccess", "The sandbox owner is not connected.")
        return
      }
    }

    // Create or retrieve container
    const createdContainer = await lockManager.acquireLock(
      data.sandboxId,
      async () => {
        try {
          // Start a new container if the container doesn't exist or it timed out.
          if (
            !containers[data.sandboxId] ||
            !(await containers[data.sandboxId].isRunning())
          ) {
            containers[data.sandboxId] = await Sandbox.create({
              timeoutMs: CONTAINER_TIMEOUT,
            })
            console.log("Created container ", data.sandboxId)
            return true
          }
        } catch (e: any) {
          console.error(`Error creating container ${data.sandboxId}:`, e)
          socket.emit("error", `Error: container creation. ${e.message ?? e}`)
        }
      }
    )

    // Function to send loaded event
    const sendLoadedEvent = (files: SandboxFiles) => {
      socket.emit("loaded", files.files)
    }

    // Initialize file and terminal managers if container was created
    if (createdContainer) {
      fileManagers[data.sandboxId] = new FileManager(
        data.sandboxId,
        containers[data.sandboxId],
        sendLoadedEvent
      )
      terminalManagers[data.sandboxId] = new TerminalManager(
        containers[data.sandboxId]
      )
      console.log(`terminal manager set up for ${data.sandboxId}`)
      await fileManagers[data.sandboxId].initialize()
    }

    const fileManager = fileManagers[data.sandboxId]
    const terminalManager = terminalManagers[data.sandboxId]

    // Load file list from the file manager into the editor
    sendLoadedEvent(fileManager.sandboxFiles)

    const sandboxManager = new SandboxManager(
      fileManager,
      terminalManager,
      aiWorker,
      dokkuClient,
      gitClient,
      lockManager,
      containers[data.sandboxId],
      socket
    )

    Object.entries(sandboxManager.handlers()).forEach(([event, handler]) => {
      socket.on(event, async (options: any, callback?: (response: any) => void) => {
        try {
          // Consume rate limiter if provided
          const response = await handler({ ...options, ...data })
          callback?.(response);
        } catch (e: any) {
          console.error(`Error processing event "${event}":`, e);
          socket.emit("error", `Error: ${event}. ${e.message ?? e}`);
        }
      });
    });

    socket.on("disconnect", async () => {
      try {
        if (data.isOwner) {
          connections[data.sandboxId]--
        }

        await terminalManager.closeAllTerminals()
        await fileManager.closeWatchers()

        if (data.isOwner && connections[data.sandboxId] <= 0) {
          socket.broadcast.emit(
            "disableAccess",
            "The sandbox owner has disconnected."
          )
        }
      } catch (e: any) {
        console.log("Error disconnecting:", e)
        socket.emit("error", `Error: disconnecting. ${e.message ?? e}`)
      }
    })
  } catch (e: any) {
    console.error("Error connecting:", e)
    socket.emit("error", `Error: connection. ${e.message ?? e}`)
  }
})

// Start the server
httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
