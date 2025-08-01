import crypto from "crypto"
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
   * Pulls files from GitHub and updates the sandbox filesystem using SHA-based comparison
   * @param repoId - GitHub repository ID
   * @param commitSha - Optional specific commit SHA to pull from
   * @returns Object containing pull results and any conflicts
   */
  async pullFromGitHub(
    repoId: string,
    commitSha?: string
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
      // Get current local files with their SHAs
      const currentFilePaths = await this.fileManager.getProjectPaths()
      const currentFilesWithSHA: Array<{
        path: string
        content: string
        sha: string
      }> = []

      for (const filePath of currentFilePaths) {
        if (!filePath.endsWith("/")) {
          // Skip directories
          try {
            const content = await this.fileManager.safeReadFile(
              path.posix.join(this.dirName, filePath)
            )
            if (content != undefined) {
              currentFilesWithSHA.push({
                path: filePath,
                content,
                sha: this.computeFileSHA(content),
              })
            }
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error)
          }
        }
      }

      // Get remote file metadata (path + SHA only)
      const remoteFiles = (await this.getFilesFromCommit(
        repoId,
        commitSha,
        true
      )) as Array<{ path: string; sha: string }>

      // Create maps for efficient lookup
      const currentFileMap = new Map(
        currentFilesWithSHA.map((file) => [file.path, file])
      )
      const remoteFileMap = new Map(
        remoteFiles.map((file) => [file.path, file])
      )

      // Find files to delete (exist locally but not in remote)
      for (const [path] of currentFileMap) {
        if (!remoteFileMap.has(path)) {
          await this.fileManager.deleteFile(path)
          deletedFiles.push(path)
        }
      }

      // Process remote files
      for (const [filePath, remoteFile] of remoteFileMap) {
        const currentFile = currentFileMap.get(filePath)

        if (!currentFile) {
          // New file - need to download content
          try {
            const repoInfo = await this.githubManager.repoExistsByID(repoId)
            if (!repoInfo.exists) {
              throw new Error("Repository not found")
            }

            const blobResponse = await this.githubManager.octokit.request(
              "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
              {
                owner: this.githubManager.username,
                repo: (
                  repoInfo as { exists: true; repoId: string; repoName: string }
                ).repoName,
                file_sha: remoteFile.sha,
              }
            )

            const blob = blobResponse?.data
            if (blob && blob.content !== undefined) {
              const content = Buffer.from(blob.content, "base64").toString(
                "utf-8"
              )

              // Create the new file
              const fullPath = path.posix.join(this.dirName, filePath)
              await this.container.files.write(fullPath, content)
              newFiles.push(filePath)
            }
          } catch (error) {
            console.error(
              `Failed to fetch remote content for ${filePath}:`,
              error
            )
          }
        } else if (currentFile.sha !== remoteFile.sha) {
          // File exists but SHA differs - need to download remote content for conflict
          try {
            const repoInfo = await this.githubManager.repoExistsByID(repoId)
            if (!repoInfo.exists) {
              throw new Error("Repository not found")
            }

            const blobResponse = await this.githubManager.octokit.request(
              "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
              {
                owner: this.githubManager.username,
                repo: (
                  repoInfo as { exists: true; repoId: string; repoName: string }
                ).repoName,
                file_sha: remoteFile.sha,
              }
            )

            const blob = blobResponse?.data
            if (blob && blob.content !== undefined) {
              const remoteContent = Buffer.from(
                blob.content,
                "base64"
              ).toString("utf-8")

              // Add to conflicts - don't update file yet, wait for user resolution
              conflicts.push({
                path: filePath,
                localContent: currentFile.content,
                incomingContent: remoteContent,
              })
            }
          } catch (error) {
            console.error(
              `Failed to fetch remote content for ${filePath}:`,
              error
            )
          }
        }
        // If SHA is the same, no action needed
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
   * Gets files from a specific commit or latest commit
   * @param repoId - GitHub repository ID
   * @param commitSha - Optional specific commit SHA (if not provided, gets latest from main branch)
   * @param shaOnly - If true, returns only path and SHA; if false, returns path and content
   * @returns Array of file objects with path and SHA or content based on shaOnly parameter
   */
  async getFilesFromCommit(
    repoId: string,
    commitSha?: string,
    shaOnly: boolean = false
  ): Promise<
    | Array<{ path: string; sha: string }>
    | Array<{ path: string; content: string }>
  > {
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
            repo: (
              repoInfo as { exists: true; repoId: string; repoName: string }
            ).repoName,
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
            repo: (
              repoInfo as { exists: true; repoId: string; repoName: string }
            ).repoName,
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
          repo: (repoInfo as { exists: true; repoId: string; repoName: string })
            .repoName,
          tree_sha: treeSha,
        }
      )

      const tree = treeResponse?.data
      if (!tree || !tree.tree) {
        throw new Error("Failed to fetch repository tree.")
      }

      // Filter out directories
      const files = tree.tree.filter((item: any) => item.type === "blob")

      if (shaOnly) {
        // Return only path and SHA
        return files.map((file: any) => ({
          path: file.path,
          sha: file.sha,
        }))
      } else {
        // Return path and content
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

                if (blob && blob.content !== undefined) {
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
      }
    } catch (error) {
      console.error("Error getting files from commit:", error)
      throw error
    }
  }

  /**
   * Computes SHA-1 hash for a file content (matching Git's blob format)
   * @param content - File content as string
   * @returns SHA-1 hash string
   */
  private computeFileSHA(content: string): string {
    // Git stores blobs as: "blob <size>\0<content>"
    const blobHeader = `blob ${Buffer.byteLength(content)}\0`
    const blobData = Buffer.concat([
      Buffer.from(blobHeader, "utf8"),
      Buffer.from(content, "utf8"),
    ])

    return crypto.createHash("sha1").update(blobData).digest("hex")
  }

  /**
   * Efficiently compares files using SHA hashes first, then downloads content only for changed files
   * @param repoId - GitHub repository ID
   * @param commitSha - Optional specific commit SHA to compare against
   * @returns Object containing file changes with content only for modified files
   */
  async getChangedFilesEfficiently(
    repoId: string,
    commitSha?: string
  ): Promise<{
    modified: Array<{
      path: string
      localContent: string
      remoteContent: string
    }>
    created: Array<{ path: string; content: string }>
    deleted: Array<{ path: string }>
  }> {
    try {
      // Get current local files with their SHAs
      const currentFilePaths = await this.fileManager.getProjectPaths()
      const currentFilesWithSHA: Array<{
        path: string
        content: string
        sha: string
      }> = []

      for (const filePath of currentFilePaths) {
        if (!filePath.endsWith("/")) {
          // Skip directories
          try {
            const content = await this.fileManager.safeReadFile(
              path.posix.join(this.dirName, filePath)
            )
            if (content != undefined) {
              currentFilesWithSHA.push({
                path: filePath,
                content,
                sha: this.computeFileSHA(content),
              })
            }
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error)
          }
        }
      }

      // Get remote file metadata (path + SHA only)
      const remoteFiles = (await this.getFilesFromCommit(
        repoId,
        commitSha,
        true
      )) as Array<{ path: string; sha: string }>

      const currentFileMap = new Map(
        currentFilesWithSHA.map((file) => [file.path, file])
      )
      const remoteFileMap = new Map(
        remoteFiles.map((file) => [
          file.path,
          { path: file.path, sha: file.sha },
        ])
      )

      const modified: Array<{
        path: string
        localContent: string
        remoteContent: string
      }> = []
      const created: Array<{ path: string; content: string }> = []
      const deleted: Array<{ path: string }> = []

      // Find modified and created files
      for (const [path, currentFile] of currentFileMap) {
        const remoteFile = remoteFileMap.get(path)

        if (!remoteFile) {
          // File exists locally but not in remote
          created.push({ path, content: currentFile.content })
        } else if (currentFile.sha !== remoteFile.sha) {
          // File exists in both but SHA differs - need to download remote content
          try {
            const repoInfo = await this.githubManager.repoExistsByID(repoId)
            if (!repoInfo.exists) {
              throw new Error("Repository not found")
            }

            const blobResponse = await this.githubManager.octokit.request(
              "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
              {
                owner: this.githubManager.username,
                repo: (
                  repoInfo as { exists: true; repoId: string; repoName: string }
                ).repoName,
                file_sha: remoteFile.sha,
              }
            )

            const blob = blobResponse?.data
            if (blob && blob.content !== undefined) {
              const remoteContent = Buffer.from(
                blob.content,
                "base64"
              ).toString("utf-8")
              modified.push({
                path,
                localContent: currentFile.content,
                remoteContent,
              })
            }
          } catch (error) {
            console.error(`Failed to fetch remote content for ${path}:`, error)
          }
        }
        // If SHA is the same, no action needed
      }

      // Find deleted files
      for (const [path] of remoteFileMap) {
        if (!currentFileMap.has(path)) {
          deleted.push({ path })
        }
      }

      return {
        modified,
        created,
        deleted,
      }
    } catch (error) {
      console.error("Error getting changed files efficiently:", error)
      throw error
    }
  }
}
