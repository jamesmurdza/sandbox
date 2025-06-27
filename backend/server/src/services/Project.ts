import { Sandbox as Container } from "e2b"
import { CONTAINER_TIMEOUT } from "../utils/constants"
import { FileManager } from "./FileManager"
import { TerminalManager } from "./TerminalManager"
// Database imports

// Load the database credentials
import { db, schema } from "@gitwit/db"
import "dotenv/config"
import { eq } from "drizzle-orm"

// Initialize database

export class Project {
  // Project properties:
  projectId: string
  type: string | null = null
  fileManager: FileManager | null = null
  terminalManager: TerminalManager | null = null
  container: Container | null = null
  containerId: string | null = null

  constructor(projectId: string) {
    this.projectId = projectId
  }

  async createContainer(): Promise<Container> {
    console.log("Creating container for ", this.projectId)
    const templateTypes = ["vanillajs", "reactjs", "nextjs", "streamlit", "php"]
    const template = templateTypes.includes(this.type ?? "")
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

    return this.container
  }

  async connectToContainer(containerId: string): Promise<Container> {
    console.log(`Connecting to container ${containerId}`)
    this.container = await Container.connect(containerId, {
      timeoutMs: CONTAINER_TIMEOUT,
      autoPause: true,
    })
    return this.container
  }

  async initialize() {
    // Fetch project data from the database
    const dbProject = await db.query.sandbox.findFirst({
      where: (sandbox, { eq }) => eq(sandbox.id, this.projectId),
    })

    if (!dbProject) {
      throw new Error("Project not found")
    }

    // Load type and containerId from database
    this.type = dbProject.type
    this.containerId = dbProject.containerId

    // Acquire a lock to ensure exclusive access to the container
    const container = this.containerId
      ? await this.connectToContainer(this.containerId)
      : await this.createContainer()

    if (!(await container.isRunning())) {
      throw new Error("Container is not running")
    }

    // Initialize the terminal manager if it hasn't been set up yet
    if (!this.terminalManager) {
      this.terminalManager = new TerminalManager(container)
      console.log(`Terminal manager set up for ${this.projectId}`)
    }

    // Initialize the file manager if it hasn't been set up yet
    if (!this.fileManager) {
      this.fileManager = new FileManager(container)
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
