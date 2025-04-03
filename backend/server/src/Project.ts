import { Sandbox as Container } from "e2b"
import { Socket } from "socket.io"
import { CONTAINER_PAUSE, CONTAINER_TIMEOUT } from "./constants"
import { DokkuClient } from "./DokkuClient"
import { FileManager } from "./FileManager"
import { GithubManager } from "./GithubManager"
import {
  createFileRL,
  createFolderRL,
  deleteFileRL,
  renameFileRL,
  saveFileRL,
} from "./ratelimit"
import { SecureGitClient } from "./SecureGitClient"
import { TerminalManager } from "./TerminalManager"
import { TFile, TFolder } from "./types"
import { LockManager } from "./utils"

const lockManager = new LockManager()

// Define a type for SocketHandler functions
type SocketHandler<T = Record<string, any>> = (args: T) => any

// Extract port number from a string
function extractPortNumber(inputString: string): number | null {
  const cleanedString = inputString.replace(/\x1B\[[0-9;]*m/g, "")
  const regex = /http:\/\/localhost:(\d+)/
  const match = cleanedString.match(regex)
  return match ? parseInt(match[1]) : null
}

type ServerContext = {
  dokkuClient: DokkuClient | null
  gitClient: SecureGitClient | null
}

export class Project {
  // Project properties:
  projectId: string
  type: string
  fileManager: FileManager | null
  terminalManager: TerminalManager | null
  container: Container | null
  containerId: string | null
  // Server context:
  dokkuClient: DokkuClient | null
  gitClient: SecureGitClient | null
  pauseTimeout: NodeJS.Timeout | null = null // Store the timeout ID
  githubManager: GithubManager // Dynamically import the ESM module

  constructor(
    projectId: string,
    type: string,
    containerId: string,
    { dokkuClient, gitClient }: ServerContext
  ) {
    // Project properties:
    this.projectId = projectId
    this.type = type
    this.fileManager = null
    this.terminalManager = null
    this.container = null
    this.containerId = containerId
    // Server context:
    this.dokkuClient = dokkuClient
    this.gitClient = gitClient
    this.pauseTimeout = null
    this.githubManager = new GithubManager()
  }

  // Initializes the project and the "container," which is an E2B sandbox
  async initialize(
    fileWatchCallback: ((files: (TFolder | TFile)[]) => void) | undefined
  ) {
    // Acquire a lock to ensure exclusive access to the container
    await lockManager.acquireLock(this.projectId, async () => {
      // Discard the current container if it has timed out
      if (this.container) {
        if (await this.container.isRunning()) {
          console.log(`Found running container ${this.container.sandboxId}`)
        } else {
          console.log("Found a timed out container")
          this.container = null
        }
      }

      // If there's no running container, check for a paused container.
      if (!this.container && this.containerId) {
        console.log(`Resuming paused container ${this.containerId}`)
        this.container = await Container.resume(this.containerId, {
          timeoutMs: CONTAINER_TIMEOUT,
        })
      }

      // If there's no container, create a new one from the template.
      if (!this.container) {
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
        })
        console.log("Created container ", this.container.sandboxId)
      }
    })
    // Ensure a container was successfully created
    if (!this.container) throw new Error("Failed to create container")

    this.createPauseTimer()

    // Initialize the terminal manager if it hasn't been set up yet
    if (!this.terminalManager) {
      this.terminalManager = new TerminalManager(this.container)
      console.log(`Terminal manager set up for ${this.projectId}`)
    }

    // Initialize the file manager if it hasn't been set up yet
    if (!this.fileManager) {
      this.fileManager = new FileManager(
        this.container,
        fileWatchCallback ?? null
      )
      // Initialize the file manager and emit the initial files
      await this.fileManager.initialize()
    }
  }

  // Called when the client disconnects from the project
  async disconnect() {
    // Close all terminals managed by the terminal manager
    await this.terminalManager?.closeAllTerminals()
    // This way the terminal manager will be set up again if we reconnect
    this.terminalManager = null
    // Close all file watchers managed by the file manager
    await this.fileManager?.closeWatchers()
    // This way the file manager will be set up again if we reconnect
    this.fileManager = null
  }

  createPauseTimer() {
    // Clear the existing timeout if it exists
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout)
    }

    // Set a new timer to pause the container one second before timeout
    this.pauseTimeout = setTimeout(async () => {
      console.log("Pausing container...")
      this.containerId = (await this.container?.pause()) ?? null

      // Save the container ID for this project so it can be resumed later
      await fetch(`${process.env.SERVER_URL}/api/sandbox`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: this.projectId,
          containerId: this.containerId,
        }),
      })

      console.log(`Paused container ${this.containerId}`)
    }, CONTAINER_PAUSE)
  }

  handlers(connection: { userId: string; isOwner: boolean; socket: Socket }) {
    // Handle heartbeat from a socket connection
    const handleHeartbeat: SocketHandler = async (_: any) => {
      // Only keep the container alive if the owner is still connected
      if (connection.isOwner) {
        try {
          await this.container?.setTimeout(CONTAINER_TIMEOUT)
        } catch (error) {
          console.error("Failed to set container timeout:", error)
          return false
        }

        // Set a new timer to pause the container one second before timeout
        this.createPauseTimer()
      }

      return true
    }

    // Handle getting a file
    const handleGetFile: SocketHandler = ({ fileId }: any) => {
      return this.fileManager?.getFile(fileId)
    }

    // Handle getting a folder
    const handleGetFolder: SocketHandler = ({ folderId }: any) => {
      return this.fileManager?.getFolder(folderId)
    }

    // Handle saving a file
    const handleSaveFile: SocketHandler = async ({ fileId, body }: any) => {
      await saveFileRL.consume(connection.userId, 1)
      return this.fileManager?.saveFile(fileId, body)
    }

    // Handle moving a file
    const handleMoveFile: SocketHandler = ({ fileId, folderId }: any) => {
      return this.fileManager?.moveFile(fileId, folderId)
    }

    // Handle listing apps
    const handleListApps: SocketHandler = async (_: any) => {
      if (!this.dokkuClient)
        throw Error("Failed to retrieve apps list: No Dokku client")
      return { success: true, apps: await this.dokkuClient.listApps() }
    }

    // Handle getting app creation timestamp
    const handleGetAppCreatedAt: SocketHandler = async ({ appName }) => {
      if (!this.dokkuClient)
        throw new Error(
          "Failed to retrieve app creation timestamp: No Dokku client"
        )
      return {
        success: true,
        createdAt: await this.dokkuClient.getAppCreatedAt(appName),
      }
    }

    // Handle checking if an app exists
    const handleAppExists: SocketHandler = async ({ appName }) => {
      if (!this.dokkuClient) {
        console.log("Failed to check app existence: No Dokku client")
        return {
          success: false,
        }
      }
      if (!this.dokkuClient.isConnected) {
        console.log(
          "Failed to check app existence: The Dokku client is not connected"
        )
        return {
          success: false,
        }
      }
      return {
        success: true,
        exists: await this.dokkuClient.appExists(appName),
      }
    }

    // Handle deploying code
    const handleDeploy: SocketHandler = async (_: any) => {
      if (!this.gitClient) throw Error("No git client")
      if (!this.fileManager) throw Error("No file manager")
      // TODO: Get files from E2B and deploy them
      const tarBase64 = await this.fileManager.getFilesForDownload()
      await this.gitClient.pushFiles(tarBase64, this.projectId)
      return { success: true }
    }

    // Handle creating a file
    const handleCreateFile: SocketHandler = async ({ name }: any) => {
      await createFileRL.consume(connection.userId, 1)
      return { success: await this.fileManager?.createFile(name) }
    }

    // Handle creating a folder
    const handleCreateFolder: SocketHandler = async ({ name }: any) => {
      await createFolderRL.consume(connection.userId, 1)
      return { success: await this.fileManager?.createFolder(name) }
    }

    // Handle renaming a file
    const handleRenameFile: SocketHandler = async ({
      fileId,
      newName,
    }: any) => {
      await renameFileRL.consume(connection.userId, 1)
      return this.fileManager?.renameFile(fileId, newName)
    }

    // Handle deleting a file
    const handleDeleteFile: SocketHandler = async ({ fileId }: any) => {
      await deleteFileRL.consume(connection.userId, 1)
      return this.fileManager?.deleteFile(fileId)
    }

    // Handle deleting a folder
    const handleDeleteFolder: SocketHandler = ({ folderId }: any) => {
      return this.fileManager?.deleteFolder(folderId)
    }

    // Handle creating a terminal session
    const handleCreateTerminal: SocketHandler = async ({ id }: any) => {
      await lockManager.acquireLock(this.projectId, async () => {
        await this.terminalManager?.createTerminal(
          id,
          (responseString: string) => {
            connection.socket.emit("terminalResponse", {
              id,
              data: responseString,
            })
            const port = extractPortNumber(responseString)
            if (port) {
              connection.socket.emit(
                "previewURL",
                "https://" + this.container?.getHost(port)
              )
            }
          }
        )
      })
    }

    // Handle resizing a terminal
    const handleResizeTerminal: SocketHandler = ({ dimensions }: any) => {
      this.terminalManager?.resizeTerminal(dimensions)
    }

    // Handle sending data to a terminal
    const handleTerminalData: SocketHandler = ({ id, data }: any) => {
      return this.terminalManager?.sendTerminalData(id, data)
    }

    // Handle closing a terminal
    const handleCloseTerminal: SocketHandler = ({ id }: any) => {
      return this.terminalManager?.closeTerminal(id)
    }

    // Handle downloading files by download button
    const handleDownloadFiles: SocketHandler = async () => {
      if (!this.fileManager) throw Error("No file manager")

      // Get the Base64 encoded tar.gz string
      const tarBase64 = await this.fileManager.getFilesForDownload()

      return { tarBlob: tarBase64 }
    }
    const handleCreateRepo: SocketHandler = async () => {
      // 1. Validate GitHub authentication
      if (!this.githubManager?.octokit) {
        return {
          success: false,
          error: "Please authenticate with GitHub first",
        }
      }

      try {
        // 2. Fetch sandbox data
        const sandbox = await fetchSandboxData(this.projectId)
        let repoName = sandbox.name

        // 3. Check if repo exists and handle naming conflicts
        const repoExists = await handleCheckSandboxRepo({})

        // Handle repository existence scenarios and update repoName
        repoName = await handleRepoScenariosAndUpdateName(repoExists, repoName)

        // 4. Create the repository
        const { id } = await this.githubManager.createRepo(repoName)
        // 5. Update sandbox with repository ID
        await updateSandboxWithRepoId(this.projectId, id.toString())
        console.log({ id })
        // 6. Create initial commit
        console.log("Creating initial commit to repo: ", id)
        const files = await collectFilesForCommit()
        if (files.length === 0) {
          return { success: false, error: "No files to commit" }
        }
 
        const username = this.githubManager.getUsername()
        const repo = await this.githubManager.createCommit(
          id,
          files,
          "chore: initial commit from GitWit"
        )
        const repoUrl = `https://github.com/${username}/${repo.repoName}`
        return {
          success: true,
          repoUrl: repoUrl,
          message: "Repository created and files committed successfully",
        }
      } catch (error) {
        console.log(
          "Failed to create repository or commit files:",
          error instanceof Error ? error.message : error
        )
        return {
          success: false,
          error: "Failed to create repository or commit files",
        }
      }
    }

    const handleCreateCommit = async (data: {
      repoId: any
      repoName: string
      message: any
    }) => {
      // 1. Validate GitHub authentication
      console.log("data recieved: ",data)
      const username = this.githubManager.getUsername()
      if (!this.githubManager?.octokit || !username) {
        console.error("Error: Not authenticated with Github")
        return {
          success: false,
          error: "Please authenticate with GitHub first",
        }
      }

      const { repoId, message } = data
      if (!repoId) {
        console.error("Error: Repo ID is required")
        return {
          success: false,
          error: "Repository ID is required",
        }
      }

      try {
        // 2. Verify repository still exists
        const repoCheck = await this.githubManager.repoExistsByID(
          data.repoId
        )
        console.log("RepoCheck: ", repoCheck)
        if (!repoCheck.exists) {
          console.error("Error: Repo no longer exists in GitHub or DB")
          await handleDeleteRepodIdFromDB({})
          return {
            success: false,
            error: "Repository no longer exists in GitHub or DB",
            existsInGitHub: false,
            existsInDB: false,
          }
        }

        // 3. Get and prepare files
        const files = await collectFilesForCommit()
        if (files.length === 0) {
          return { success: false, error: "No files to commit" }
        }

        // 4. Create the commit
        const commitMessage = message || "chore: initial commit from GitWit"
        const repo = await this.githubManager.createCommit(
          repoId,
          files,
          commitMessage
        )
        const repoUrl = `https://github.com/${username}/${repo.repoName}`
        console.log("Success: Commit created - ", repoUrl)
        return {
          success: true,
          repoUrl,
        }
      } catch (error) {
        console.error("Failed to create commit:", error)
        return { success: false, error: "Failed to create commit" }
      }
    }

    // Helper functions

    const collectFilesForCommit = async () => {
      const fileTree = await this.fileManager?.getFileTree()
      if (!fileTree || fileTree.length === 0) {
        return []
      }

      const files: { id: any; data: any }[] = []

      // Process file tree recursively
      const processNode = async (node: {
        type: string
        id: any
        children?: any
      }) => {
        if (node.type === "file") {
          const content = await this.fileManager?.getFile(node.id)
          if (content) {
            files.push({ id: node.id, data: content })
          }
        } else if (node.type === "folder" && node.children) {
          for (const child of node.children) {
            await processNode(child)
          }
        }
      }

      // Process all nodes in the file tree
      for (const node of fileTree) {
        await processNode(node)
      }

      return files
    }

    const fetchSandboxData = async (projectId: string) => {
      const dbResponse = await fetch(
        `${process.env.SERVER_URL}/api/sandbox?id=${projectId}`,
        { method: "GET" }
      )
      return await dbResponse.json()
    }

    const updateSandboxWithRepoId = async (
      projectId: string,
      repoId: string
    ) => {
      return await fetch(`${process.env.SERVER_URL}/api/sandbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId.toString(),
          repositoryId: repoId,
        }),
      })
    }

    const handleRepoScenariosAndUpdateName = async (
      repoExists: { existsInDB: any; existsInGitHub: any },
      repoName: any
    ) => {
      if (!repoExists.existsInDB && repoExists.existsInGitHub) {
        let newRepoName = `${repoName}-gitwit`
        console.log(`Original repo name taken, using: ${newRepoName}`)
        return newRepoName
      }

      if (repoExists.existsInDB && !repoExists.existsInGitHub) {
        await handleDeleteRepodIdFromDB({})
      } else if (repoExists.existsInDB && repoExists.existsInGitHub) {
        throw new Error("Repository already exists")
      }

      return repoName
    }
    const handleCheckSandboxRepo: SocketHandler = async () => {
      if (!this.githubManager?.octokit) {
        return {
          existsInDB: false,
        existsInGitHub: false,
        }
      }
      console.log("Checking Sandbox Repo...")
      // First check if we have this sandbox in DB
      const dbResponse = await fetch(
        `${process.env.SERVER_URL}/api/sandbox?id=${this.projectId}`,
        {
          method: "GET",
        }
      )

      const sandbox = await dbResponse.json()
      const repoName = sandbox.name
      console.log
      // Case 1: Sandbox has repositoryId - check if it exists in GitHub
      if (sandbox && sandbox.repositoryId) {
        console.log("Found repo in DB, checking GitHub by ID...")

        const repoExists = await this.githubManager.repoExistsByID(
          sandbox.repositoryId
        )

        if (repoExists.exists) {
          console.log("1--- repoExists ")
          return {
            existsInDB: true,
            existsInGitHub: true,
            repo: {
              id: repoExists.repoId,
              name: repoExists.repoName,
            },
          }
        } else {
          console.log("2--- repoExists ")
          return {
            existsInDB: true,
            existsInGitHub: false,
          }
        }
      }

      // If we get here, no repository is linked to this sandbox
      // Check if the repo exists in GitHub by name
      const githubRepoCheck = await this.githubManager.repoExistsByName(
        repoName
      )

      if (githubRepoCheck.exists) {
        console.log("3--- repoExists ")
        // Case 2: Exists in GitHub but not in DB
        return {
          existsInDB: false,
          existsInGitHub: true,
        }
      }

      // Case 3: Doesn't exist in either place
      console.log("4--- repo not exists in both ")
      return {
        existsInDB: false,
        existsInGitHub: false,
      }
    }

    const handleDeleteRepodIdFromDB: SocketHandler = async () => {
      try {
        await fetch(`${process.env.SERVER_URL}/api/sandbox`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: this.projectId.toString(),
            repositoryId: null,
          }),
        })
        console.log("Repository removed from sandbox successfully")

        return { success: true }
      } catch (error) {
        console.error("Failed to remove repository from sandbox:", error)
        return {
          success: false,
          error: "Failed to remove repository from sandbox",
        }
      }
    }
    const handleGitHubUser: SocketHandler = async (data) => {
      const { code } = data
      console.log("GitHub code: ", code)
      const auth = await this.githubManager.authenticate(
        code,
        connection.userId
      )
      if (auth) {
        return auth
      }
      return { error: "Authentication failed" }
    }
    const handleGitHubUserName: SocketHandler = async (data) => {
      const { code } = data
      const auth = await this.githubManager.authenticate(
        code,
        connection.userId
      )
      if (auth) {
        return { username: auth.username, accessToken: auth.accessToken }
      }
      return { error: "Authentication failed" }
    }
    const handleAuthenticateGithub: SocketHandler = async () => {
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo`
      return { authUrl }
    }
    const handleGithubUserLogout = async () => {
      return this.githubManager.logoutGithubUser(connection.userId)
    }
    return {
      heartbeat: handleHeartbeat,
      getFile: handleGetFile,
      downloadFiles: handleDownloadFiles,
      getFolder: handleGetFolder,
      saveFile: handleSaveFile,
      moveFile: handleMoveFile,
      listApps: handleListApps,
      getAppCreatedAt: handleGetAppCreatedAt,
      getAppExists: handleAppExists,
      deploy: handleDeploy,
      createFile: handleCreateFile,
      createFolder: handleCreateFolder,
      renameFile: handleRenameFile,
      deleteFile: handleDeleteFile,
      deleteFolder: handleDeleteFolder,
      createTerminal: handleCreateTerminal,
      resizeTerminal: handleResizeTerminal,
      terminalData: handleTerminalData,
      closeTerminal: handleCloseTerminal,
      // getGitHubUserName: handleGitHubUserName,
      getGitHubUser: handleGitHubUser,
      sandboxRepoStatus: handleCheckSandboxRepo,
      checkSandboxRepo: handleCheckSandboxRepo,
      deleteRepodIdFromDB: handleDeleteRepodIdFromDB,
      authenticateGithub: handleAuthenticateGithub,
      createCommit: handleCreateCommit,
      createRepo: handleCreateRepo,
      logoutGithubUser: handleGithubUserLogout,
    }
  }
}
