import { Sandbox as E2BSandbox } from "e2b"
import { Socket } from "socket.io"
import { CONTAINER_TIMEOUT } from "./constants"
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

export class Sandbox {
  // Sandbox properties:
  sandboxId: string
  type: string
  fileManager: FileManager | null
  terminalManager: TerminalManager | null
  container: E2BSandbox | null
  // Server context:
  dokkuClient: DokkuClient | null
  gitClient: SecureGitClient | null
  githubManager: GithubManager // Dynamically import the ESM module

  constructor(
    sandboxId: string,
    type: string,
    { dokkuClient, gitClient }: ServerContext
  ) {
    // Sandbox properties:
    this.sandboxId = sandboxId
    this.type = type
    this.fileManager = null
    this.terminalManager = null
    this.container = null
    // Server context:
    this.dokkuClient = dokkuClient
    this.gitClient = gitClient
    this.githubManager = new GithubManager()
  }

  // Initializes the container for the sandbox environment
  async initialize(
    fileWatchCallback: ((files: (TFolder | TFile)[]) => void) | undefined
  ) {
    // Acquire a lock to ensure exclusive access to the sandbox environment
    await lockManager.acquireLock(this.sandboxId, async () => {
      // Check if a container already exists and is running
      if (this.container && (await this.container.isRunning())) {
        console.log(`Found existing container ${this.sandboxId}`)
      } else {
        console.log("Creating container", this.sandboxId)
        // Create a new container with a specified template and timeout
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
        this.container = await E2BSandbox.create(template, {
          timeoutMs: CONTAINER_TIMEOUT,
        })
      }
    })
    // Ensure a container was successfully created
    if (!this.container) throw new Error("Failed to create container")

    // Initialize the terminal manager if it hasn't been set up yet
    if (!this.terminalManager) {
      this.terminalManager = new TerminalManager(this.container)
      console.log(`Terminal manager set up for ${this.sandboxId}`)
    }

    // Initialize the file manager if it hasn't been set up yet
    if (!this.fileManager) {
      this.fileManager = new FileManager(
        this.sandboxId,
        this.container,
        fileWatchCallback ?? null
      )
      // Initialize the file manager and emit the initial files
      await this.fileManager.initialize()
    }
  }

  // Called when the client disconnects from the Sandbox
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

  handlers(connection: { userId: string; isOwner: boolean; socket: Socket }) {
    // Handle heartbeat from a socket connection
    const handleHeartbeat: SocketHandler = (_: any) => {
      // Only keep the sandbox alive if the owner is still connected
      if (connection.isOwner) {
        this.container?.setTimeout(CONTAINER_TIMEOUT)
      }
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
      await this.gitClient.pushFiles(
        await this.fileManager?.loadFileContent(),
        this.sandboxId
      )
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
      await lockManager.acquireLock(this.sandboxId, async () => {
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

      // Get the Base64 encoded ZIP string
      const zipBase64 = await this.fileManager.getFilesForDownload()

      return { zipBlob: zipBase64 }
    }

    // Add to handlers function

		const handleCreateRepo: SocketHandler = async (data) => {
			if (!this.githubManager?.octokit) {
				return {
					success: false,
					error: "Please authenticate with GitHub first",
				};
			}
		
			const { repoName } = data;
		
			try {
				// Check if repo exists in GitHub
				const githubRepoCheck = await this.githubManager.repoExists(repoName);
		
				// Check if repo exists in DB
				const dbResponse = await fetch(
					`${process.env.DATABASE_WORKER_URL}/api/repos?userId=${connection.userId}&repoId=${githubRepoCheck.repoId}`,
					{
						headers: {
							Authorization: `${process.env.WORKERS_KEY}`,
						},
					}
				);
		
				const dbRepo = await dbResponse.json();
				const existsInDB = dbRepo && dbRepo.length > 0;
		
		
				// Case 1: Exists in GitHub but not in DB
				if (githubRepoCheck.exists && !existsInDB) {
					return {
						success: false,
						repoExists: true,
						existsInDB: false,
						existsInGitHub: true,
						error: "Repository exists in GitHub but not in database",
					};
				}
				// Case 2: Exists in GitHub but not in DB
				if (!githubRepoCheck.exists && existsInDB) {
          await handleDeleteSandboxFromDB({ repoId: githubRepoCheck.repoId });

					return {
						success: false,
						repoExists: false,
						existsInDB: true,
						existsInGitHub: true,
						error: "Repository exists in database but not in GitHub",
					};
				}
				// Case 3: Doesn't exist in either GitHub or DB - Create new
					// Create new repo in GitHub
					const { html_url, id } = await this.githubManager.createRepo(repoName);
					console.log("Repo created:", id);
		
					// Store in DB
					await fetch(`${process.env.DATABASE_WORKER_URL}/api/repos`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `${process.env.WORKERS_KEY}`,
						},
						body: JSON.stringify({
							userId: connection.userId,
							repoId: id,
						}),
					});
		
					return { 
						success: true, 
						repoUrl: html_url,
						message: "Repository created successfully in both GitHub and database"
					};
		

			} catch (error) {
				console.error("Failed to create repository:", error);
				return { 
					success: false, 
					error: "Failed to create repository" 
				};
			}
		};
    
		const handleCreateCommit: SocketHandler = async (data) => {
			const username = this.githubManager.getUsername()
			if (!this.githubManager?.octokit || !username) {
				return {
					success: false,
					error: "Please authenticate with GitHub first",
				}
			}
		
			const { repoName, message } = data
		
			try {
				// First check if repo still exists
				const repoCheck = await this.githubManager.repoExists(repoName);
				if (!repoCheck.exists) {
					return {
						success: false,
						error: "Repository no longer exists in GitHub",
						existsInGitHub: false
					}
				}
		
				const files = await this.fileManager?.loadFileContent()
				if (!files || files.length === 0) {
					return { success: false, error: "No files to commit" }
				}
				const commitMessage = message || "Initial commit from GitWit"
		
				await this.githubManager.createCommit(repoName, files, commitMessage)
		
				return {
					success: true,
					repoUrl: `https://github.com/${username}/${repoName}`,
				}
			} catch (error) {
				console.error("Failed to create commit:", error)
				return { success: false, error: "Failed to create commit" }
			}
		}
    const handleCheckSandboxRepo: SocketHandler = async (data) => {
      const { repoName } = data;
      
      console.log(`Checking repo status for: ${repoName}`);
    
      // Check if repo exists in GitHub
      const githubRepoCheck = await this.githubManager.repoExists(repoName);
      console.log("GitHub Repo Exists:", githubRepoCheck.exists, "Repo ID:", githubRepoCheck.repoId);
    
      // Check if repo exists in DB
      const dbResponse = await fetch(`${process.env.DATABASE_WORKER_URL}/api/repos?userId=${connection.userId}&repoId=${githubRepoCheck.repoId}`, {
        headers: { Authorization: `${process.env.WORKERS_KEY}` },
      });
    
      const dbRepo = await dbResponse.json();
      console.log("DB Repo Exists:", dbRepo.length > 0);
    
      const existsInDB = dbRepo.length > 0;
    
      if (existsInDB && githubRepoCheck.exists) {
        console.log("Both DB and GitHub Repo exist ✅");
        return { existsInBoth:true };
      }
			return { existsInBoth:false};
    };
    
    
    const handleDeleteSandboxFromDB: SocketHandler = async (data) => {
      const { repoId } = data;
    console.log(`Deleting repo from DB: ${repoId}`);
      try {
        await fetch(`${process.env.DATABASE_WORKER_URL}/api/repos?userId=${connection.userId}&&repoId=${repoId}`, {
          method: "DELETE",
          headers: { Authorization: `${process.env.WORKERS_KEY}` },
        });
        console.log("Repo deleted from DB successfully");
    
        return { success: true };
      } catch (error) {
        console.error("Failed to delete repository from DB:", error);
        return { success: false, error: "Failed to delete repository from DB" };
      }
    };
		const handleGitHubUserName: SocketHandler = async (data) => {
      const { code } = data;
      const auth = await this.githubManager.authenticate(code,connection.userId);
      if (auth) {
       
    
        return { username: auth.username };
      }
      return { error: "Authentication failed" };
    };
    const handleAuthenticateGithub: SocketHandler = async () => {
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo`
      return { authUrl }
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
      createCommit: handleCreateCommit,
      createRepo: handleCreateRepo,
      list: handleListApps,
      getGitHubUserName: handleGitHubUserName,
      checkSandboxRepo: handleCheckSandboxRepo,
      deleteSandboxFromDB: handleDeleteSandboxFromDB,
      authenticateGithub: handleAuthenticateGithub,
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
    }
  }
}
