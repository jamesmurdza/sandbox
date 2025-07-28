import { Sandbox as Container } from "e2b"
import path from "path"
import { TFile, TFolder } from "../utils/types"
import { FileManager } from "./FileManager"
import { GitHubManager } from "./github"

export class GithubSyncManager {
  private githubManager: GitHubManager
  private fileManager: FileManager
  private dirName = "/home/user/project"
  private container: Container
  private fileWatchCallback: ((files: (TFolder | TFile)[]) => void) | null =
    null

  constructor(
    githubManager: GitHubManager,
    fileManager: FileManager,
    container: Container
  ) {
    this.githubManager = githubManager
    this.fileManager = fileManager
    this.container = container
  }

  private async fixPermissions() {
    try {
      await this.container.commands.run(`sudo chown -R user "${this.dirName}"`)
    } catch (e: any) {
      console.log("Failed to fix permissions: " + e)
    }
  }

  /**
   * Gets the latest commit SHA from GitHub
   * @param repoId - GitHub repository ID
   * @returns Latest commit SHA string
   */
  async getLatestCommitSha(repoId: string): Promise<string> {
    const repoInfo = await this.githubManager.repoExistsByID(repoId)
    if (!repoInfo.exists) {
      throw new Error("Repository not found")
    }
    const refResponse = await this.githubManager.octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      {
        owner: this.githubManager.username,
        repo: repoInfo.repoName,
        ref: "heads/main",
      }
    )
    const ref = refResponse?.data
    if (!ref || !ref.object?.sha) {
      throw new Error("Failed to fetch reference for the main branch.")
    }
    return ref.object.sha
  }

  /**
   * Checks if a pull is needed by comparing local and remote commit hashes
   * @param repoId - GitHub repository ID
   * @param localSha - Last synced commit SHA from DB
   * @returns Object indicating if pull is needed and the latest commit info
   */
  async checkIfPullNeeded(
    repoId: string,
    localSha?: string
  ): Promise<{
    needsPull: boolean
    latestCommit?: {
      sha: string
      message: string
      date: string
    }
  }> {
    try {
      const repoInfo = await this.githubManager.repoExistsByID(repoId)
      if (!repoInfo.exists) {
        throw new Error("Repository not found")
      }
      // Get the latest commit from the main branch
      const refResponse = await this.githubManager.octokit.request(
        "GET /repos/{owner}/{repo}/git/ref/{ref}",
        {
          owner: this.githubManager.username,
          repo: repoInfo.repoName,
          ref: "heads/main",
        }
      )
      const ref = refResponse?.data
      if (!ref || !ref.object?.sha) {
        throw new Error("Failed to fetch reference for the main branch.")
      }
      // Get commit details
      const commitResponse = await this.githubManager.octokit.request(
        "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
        {
          owner: this.githubManager.username,
          repo: repoInfo.repoName,
          commit_sha: ref.object.sha,
        }
      )
      const commit = commitResponse?.data
      if (!commit) {
        throw new Error("Failed to fetch commit details.")
      }
      const needsPull = !localSha || localSha !== commit.sha
      return {
        needsPull,
        latestCommit: {
          sha: commit.sha,
          message: commit.message,
          date: commit.author?.date || new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error("Error checking if pull is needed:", error)
      throw error
    }
  }

  /**
   * Pulls files from GitHub and updates the sandbox filesystem
   * @param githubFiles - Array of files from GitHub with path and content
   * @returns Object containing pull results and any conflicts
   */
  async pullFromGitHub(
    githubFiles: Array<{ path: string; content: string }>
  ): Promise<{
    success: boolean
    conflicts: Array<{
      path: string
      localContent: string
      incomingContent: string
    }>
    newFiles: string[]
    deletedFiles: string[]
    updatedFiles: string[]
  }> {
    const conflicts: Array<{
      path: string
      localContent: string
      incomingContent: string
    }> = []
    const newFiles: string[] = []
    const deletedFiles: string[] = []
    const updatedFiles: string[] = []

    try {
      // Get current file tree to compare
      //const currentFiles = await this.getFileTree() no need to get whole tree only paths needed
      const currentFilePaths = await this.fileManager.getProjectPaths() //gets all paths in project

      // Get GitHub file paths
      const githubFilePaths = githubFiles.map((f) => f.path)

      // Find files to delete (exist locally but not in GitHub)
      for (const localPath of currentFilePaths) {
        if (!localPath.endsWith("/")) {
          //excludes folder paths
          if (!githubFilePaths.includes(localPath)) {
            await this.fileManager.deleteFile(localPath)
            deletedFiles.push(localPath)
          }
        }
      }

      // Process GitHub files
      for (const githubFile of githubFiles) {
        const filePath = path.posix.join(this.dirName, githubFile.path)

        // Safely read file content (returns null if file doesn't exist)
        const localContent = await this.fileManager.safeReadFile(filePath)

        if (localContent === null) {
          // New file - create it
          await this.container.files.write(filePath, githubFile.content)
          newFiles.push(githubFile.path)
        } else if (localContent !== githubFile.content) {
          // File exists but content differs - add to conflicts
          conflicts.push({
            path: githubFile.path,
            localContent,
            incomingContent: githubFile.content,
          })
          // Do not update the file yet; wait for user resolution
        }
        // If content is the same, no action needed
      }

      // Fix permissions after all file operations
      await this.fixPermissions()

      // Refresh file tree
      this.fileWatchCallback?.(await this.fileManager.getFileTree())

      return {
        success: true,
        conflicts,
        newFiles,
        deletedFiles,
        updatedFiles,
      }
    } catch (error) {
      console.error("Error pulling from GitHub:", error)
      return {
        success: false,
        conflicts: [],
        newFiles: [],
        deletedFiles: [],
        updatedFiles: [],
      }
    }
  }

  /**
   * Apply file-level conflict resolutions after user selects Local or Incoming in modal
   * @param resolutions - Array of { path, resolution: 'local' | 'incoming', localContent, incomingContent }
   */
  async applyFileLevelResolutions(
    resolutions: Array<{
      path: string
      resolution: "local" | "incoming"
      localContent: string
      incomingContent: string
    }>
  ): Promise<void> {
    for (const res of resolutions) {
      const filePath = path.posix.join(this.dirName, res.path)
      if (res.resolution === "incoming") {
        await this.container.files.write(filePath, res.incomingContent)
      } // else keep local (do nothing)
    }
    await this.fixPermissions()
    this.fileWatchCallback?.(await this.fileManager.getFileTree())
  }

  /**
   * Resolves conflicts by applying user's choice
   * @param conflicts - Array of conflicts with user's resolution choice
   */
  async resolveConflicts(
    conflicts: Array<{
      path: string
      localContent: string
      githubContent: string
      resolution: "local" | "github" | "merged"
      mergedContent?: string
    }>
  ): Promise<void> {
    for (const conflict of conflicts) {
      const filePath = path.posix.join(this.dirName, conflict.path)

      let contentToWrite: string
      switch (conflict.resolution) {
        case "local":
          contentToWrite = conflict.localContent
          break
        case "github":
          contentToWrite = conflict.githubContent
          break
        case "merged":
          contentToWrite = conflict.mergedContent || conflict.githubContent
          break
        default:
          contentToWrite = conflict.githubContent
      }

      await this.container.files.write(filePath, contentToWrite)
    }

    await this.fixPermissions()
    this.fileWatchCallback?.(await this.fileManager.getFileTree())
  }

  /**
   * Gets files from a specific commit or latest commit in a GitHub repository
   * @param repoId - GitHub repository ID
   * @param commitSha - Optional specific commit SHA. If not provided, gets latest commit from main branch
   * @returns Array of file objects with path and content
   */
  async getFilesFromCommit(
    repoId: string,
    commitSha?: string
  ): Promise<Array<{ path: string; content: string }>> {
    try {
      const repoInfo = await this.githubManager.repoExistsByID(repoId)
      if (!repoInfo.exists) {
        throw new Error("Repository not found")
      }

      let treeSha: string

      if (commitSha) {
        // Get the commit details for specific commit
        const commitResponse = await this.githubManager.octokit.request(
          "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
          {
            owner: this.githubManager.username,
            repo: repoInfo.repoName,
            commit_sha: commitSha,
          }
        )

        const commit = commitResponse?.data
        if (!commit || !commit.tree) {
          throw new Error("Failed to fetch commit details.")
        }
        treeSha = commit.tree.sha
      } else {
        // Get the latest tree from the main branch
        const refResponse = await this.githubManager.octokit.request(
          "GET /repos/{owner}/{repo}/git/ref/{ref}",
          {
            owner: this.githubManager.username,
            repo: repoInfo.repoName,
            ref: "heads/main",
          }
        )

        const ref = refResponse?.data
        if (!ref || !ref.object?.sha) {
          throw new Error("Failed to fetch reference for the main branch.")
        }
        treeSha = ref.object.sha
      }

      // Get the tree
      const treeResponse = await this.githubManager.octokit.request(
        "GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1",
        {
          owner: this.githubManager.username,
          repo: repoInfo.repoName,
          tree_sha: treeSha,
        }
      )

      const tree = treeResponse?.data
      if (!tree || !tree.tree) {
        throw new Error("Failed to fetch repository tree.")
      }

      // Filter out directories and get file contents
      const files = tree.tree.filter((item: any) => item.type === "blob")
      const fileContents: Array<{ path: string; content: string }> = []

      // Process files in batches to avoid rate limits
      const batchSize = 10
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)

        await Promise.all(
          batch.map(async (file: any) => {
            try {
              const blobResponse = await this.githubManager.octokit.request(
                "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
                {
                  owner: this.githubManager.username,
                  repo: repoInfo.repoName,
                  file_sha: file.sha,
                }
              )

              const blob = blobResponse?.data
              if (blob && blob.content) {
                // Decode base64 content
                const content = Buffer.from(blob.content, "base64").toString(
                  "utf-8"
                )
                fileContents.push({
                  path: file.path,
                  content,
                })
              }
            } catch (error) {
              console.error(`Failed to fetch file ${file.path}:`, error)
            }
          })
        )

        // Add delay between batches to respect rate limits
        if (i + batchSize < files.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      return fileContents
    } catch (error) {
      console.error("Error getting files from commit:", error)
      throw error
    }
  }

  /**
   * Gets the latest files from a GitHub repository
   * @param repoId - GitHub repository ID
   * @returns Array of file objects with path and content
   */
  async getLatestFiles(
    repoId: string
  ): Promise<Array<{ path: string; content: string }>> {
    return await this.getFilesFromCommit(repoId) //no commit sha needed as we want latest commit
  }
}
