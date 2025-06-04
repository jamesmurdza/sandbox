import { Sandbox as Container } from "e2b"
import { CONTAINER_TIMEOUT } from "../utils/constants"
import { LockManager } from "../utils/lock"
import { FileManager } from "./FileManager"
import { TerminalManager } from "./TerminalManager"

// Database imports
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "../db/schema"

// Load the database credentials
import "dotenv/config"

const lockManager = new LockManager()

// Initialize database
const db = drizzle(process.env.DATABASE_URL as string, { schema })

export class Project {
  // Project properties:
  projectId: string
  type: string
  fileManager: FileManager | null = null
  terminalManager: TerminalManager | null = null
  container: Container | null = null
  containerId: string | null = null

  constructor(projectId: string, type: string, containerId: string) {
    // Project properties:
    this.projectId = projectId
    this.type = type
    this.containerId = containerId
  }

  async initialize() {
    // Acquire a lock to ensure exclusive access to the container
    await lockManager.acquireLock(this.projectId, async () => {
      // If we have already initialized the container, connect to it.
      if (this.containerId) {
        console.log(`Connecting to container ${this.containerId}`)
        this.container = await Container.connect(this.containerId, {
          timeoutMs: CONTAINER_TIMEOUT,
          autoPause: true,
        })
      }

      // If we don't have a container, create a new container from the template.
      if (!this.container || !(await this.container.isRunning())) {
        console.log("Creating container for ", this.projectId)
        const templateTypes = [
          "vanillajs",
          "reactjs",
          "nextjs",
          "streamlit",
          "php",
        ]
        const template = templateTypes.includes(this.type)
          ? `gitwit-${this.type}`
          : `base`
        this.container = await Container.create(template, {
          timeoutMs: CONTAINER_TIMEOUT,
          autoPause: true,
        })
        this.containerId = this.container.sandboxId
        console.log("Created container ", this.containerId)

        // Save the container ID for this project so it can be accessed later
        await db
          .update(schema.sandbox)
          .set({ containerId: this.containerId })
          .where(eq(schema.sandbox.id, this.projectId))
      }
    })
    // Ensure a container was successfully created
    if (!this.container) throw new Error("Failed to create container")

    // Initialize the terminal manager if it hasn't been set up yet
    if (!this.terminalManager) {
      this.terminalManager = new TerminalManager(this.container)
      console.log(`Terminal manager set up for ${this.projectId}`)
    }

    // Initialize the file manager if it hasn't been set up yet
    if (!this.fileManager) {
      this.fileManager = new FileManager(this.container)
    }
  }

  // Called when the client disconnects from the project
  async disconnect() {
    // Close all terminals managed by the terminal manager
    await this.terminalManager?.closeAllTerminals()
    // This way the terminal manager will be set up again if we reconnect
    this.terminalManager = null
    // Close all file watchers managed by the file manager
    await this.fileManager?.stopWatching()
    // This way the file manager will be set up again if we reconnect
    this.fileManager = null
  }
}
