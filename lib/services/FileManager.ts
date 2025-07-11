import { Sandbox as Container, FilesystemEvent, WatchHandle } from "e2b"
import path from "path"
import { MAX_BODY_SIZE } from "../utils/ratelimit"
import { TFile, TFolder } from "../utils/types"

// Local enum to avoid issues with const enums and isolatedModules
enum LocalFilesystemEventType {
  CREATE = "CREATE",
  REMOVE = "REMOVE",
  RENAME = "RENAME",
}

// Type guard to check if the event type is one we care about
function isRelevantEventType(
  type: string
): type is "CREATE" | "REMOVE" | "RENAME" {
  return type === "CREATE" || type === "REMOVE" || type === "RENAME"
}

// FileManager class to handle file operations in a container
export class FileManager {
  private container: Container
  private fileWatchers: WatchHandle[] = []
  private dirName = "/home/user/project"
  private fileWatchCallback: ((files: (TFolder | TFile)[]) => void) | null =
    null

  // Constructor to initialize the FileManager
  constructor(container: Container) {
    this.container = container
    // Make the logged in user the owner of all project files
    this.fixPermissions()
  }

  async getFileTree(): Promise<(TFolder | TFile)[]> {
    // Run the command to retrieve paths
    // Ignore node_modules until we make this faster
    const result = await this.container.commands.run(
      `cd /home/user/project && find * \\( -path 'node_modules' -prune \\) -o \\( -type d -exec echo {}/ \\; -o -type f -exec echo {} \\; \\)`
    )

    // Process the stdout into an array of paths
    const paths = result.stdout.trim().split("\n")

    // Root folder structure
    const root: TFolder = { id: "/", type: "folder", name: "/", children: [] }

    // Iterate through paths to build the hierarchy
    paths.forEach((path) => {
      const parts = path.split("/").filter((part) => part) // Split and remove empty parts
      let current: TFolder = root

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isFile = i === parts.length - 1 && !path.endsWith("/") // Last part and not a folder
        const existing = current.children.find((child) => child.name === part)

        if (existing) {
          if (!isFile) {
            current = existing as TFolder // Navigate to the existing folder
          }
        } else {
          if (isFile) {
            const file: TFile = {
              id: `/${parts.join("/")}`,
              type: "file",
              name: part,
            }
            current.children.push(file)
          } else {
            const folder: TFolder = {
              id: `/${parts.slice(0, i + 1).join("/")}`,
              type: "folder",
              name: part,
              children: [],
            }
            current.children.push(folder)
            current = folder // Move to the newly created folder
          }
        }
      }
    })

    return root.children
  }

  // Start watching the filesystem for changes
  async startWatching(callback: (files: (TFolder | TFile)[]) => void) {
    // Set the refresh callback
    this.fileWatchCallback = callback

    // Watch the directories and subdirectories of the project directory
    await this.watchDirectory(this.dirName)
    await this.watchSubdirectories(this.dirName)
  }

  // Change the owner of the project directory to user
  private async fixPermissions() {
    try {
      await this.container.commands.run(`sudo chown -R user "${this.dirName}"`)
    } catch (e: any) {
      console.log("Failed to fix permissions: " + e)
    }
  }

  // Watch a directory for changes
  async watchDirectory(directory: string): Promise<WatchHandle | undefined> {
    try {
      const handle = await this.container.files.watchDir(
        directory,
        async (event: FilesystemEvent) => {
          try {
            // Tell the client to reload the file list
            if (isRelevantEventType(event.type)) {
              this.fileWatchCallback?.(await this.getFileTree())
            }
          } catch (error) {
            console.error(
              `Error handling ${event.type} event for ${event.name}:`,
              error
            )
          }
        },
        // The timeout of zero means the watcher never times out
        { timeoutMs: 0 }
      )
      this.fileWatchers.push(handle)
      return handle
    } catch (error) {
      console.error(`Error watching filesystem:`, error)
    }
  }

  // Watch the contents of top-level subdirectories
  async watchSubdirectories(directory: string) {
    const dirContent = await this.container.files.list(directory)
    await Promise.all(
      dirContent.map(async (item) => {
        if (item.type === "dir") {
          console.log("Watching " + item.path)
          await this.watchDirectory(item.path)
        }
      })
    )
  }

  // Get file content
  async getFile(fileId: string): Promise<string | undefined> {
    const filePath = path.posix.join(this.dirName, fileId)
    const fileContent = await this.container.files.read(filePath)
    return fileContent
  }

  // Get folder content
  async getFolder(folderId: string): Promise<string[]> {
    return (await this.container.files.list(folderId)).map((entry) =>
      path.posix.join(folderId, entry.name)
    )
  }

  // Save file content
  async saveFile(fileId: string, body: string): Promise<void> {
    if (!fileId) return // handles saving when no file is open

    if (Buffer.byteLength(body, "utf-8") > MAX_BODY_SIZE) {
      throw new Error("File size too large. Please reduce the file size.")
    }

    // Save to container filesystem
    const filePath = path.posix.join(this.dirName, fileId)
    await this.container.files.write(filePath, body)

    // Refresh the file tree in case saving creates a new file
    this.fileWatchCallback?.(await this.getFileTree())
    this.fixPermissions()
  }

  // Move a file to a different folder
  async moveFile(
    fileId: string,
    folderId: string
  ): Promise<(TFolder | TFile)[]> {
    const newFileId = path.posix.join(folderId, path.posix.basename(fileId))
    await this.moveFileInContainer(fileId, newFileId)
    await this.fixPermissions()
    return await this.getFileTree()
  }

  // Move a file within the container
  private async moveFileInContainer(oldPath: string, newPath: string) {
    const fileContents = await this.container.files.read(
      path.posix.join(this.dirName, oldPath)
    )
    await this.container.files.write(
      path.posix.join(this.dirName, newPath),
      fileContents
    )
    await this.container.files.remove(path.posix.join(this.dirName, oldPath))
  }

  // Create a new file
  async createFile(name: string): Promise<boolean> {
    await this.container.files.write(path.posix.join(this.dirName, name), "")
    await this.fixPermissions()

    return true
  }

  public async getFilesForDownload(): Promise<string> {
    // Create an output path in /tmp
    const tempTarPath = "/tmp/project.tar.gz"

    // Create an archive of the project directory
    await this.container.commands.run(
      `cd ${this.dirName} && tar --exclude="node_modules" --exclude="venv" -czvf ${tempTarPath} .`,
      {
        timeoutMs: 5000,
      }
    )

    // Read the archive contents in base64 format
    const base64Result = await this.container.commands.run(
      `cat ${tempTarPath} | base64 -w 0`
    )

    // Delete the archive
    await this.container.commands.run(`rm ${tempTarPath}`)

    // Return the base64 encoded tar.gz content
    return base64Result.stdout.trim()
  }

  // Create a new folder
  async createFolder(name: string): Promise<void> {
    await this.container.files.makeDir(path.posix.join(this.dirName, name))
  }

  // Rename a file
  async renameFile(fileId: string, newName: string): Promise<void> {
    const newFileId = path.posix.join(path.posix.dirname(fileId), newName)

    await this.moveFileInContainer(fileId, newFileId)
    await this.fixPermissions()
  }

  // Delete a file
  async deleteFile(fileId: string): Promise<(TFolder | TFile)[]> {
    await this.container.files.remove(path.posix.join(this.dirName, fileId))
    return await this.getFileTree()
  }

  // Delete a folder
  async deleteFolder(folderId: string): Promise<(TFolder | TFile)[]> {
    await this.container.files.remove(path.posix.join(this.dirName, folderId))
    return await this.getFileTree()
  }

  // Close all file watchers
  async stopWatching() {
    await Promise.all(
      this.fileWatchers.map(async (handle: WatchHandle) => {
        await handle.stop()
      })
    )
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
      const currentFiles = await this.getFileTree()
      const currentFilePaths = this.flattenFileTree(currentFiles)

      // Get GitHub file paths
      const githubFilePaths = githubFiles.map((f) => f.path)

      // Find files to delete (exist locally but not in GitHub)
      for (const localPath of currentFilePaths) {
        if (!githubFilePaths.includes(localPath)) {
          await this.deleteFile(localPath)
          deletedFiles.push(localPath)
        }
      }

      // Process GitHub files
      for (const githubFile of githubFiles) {
        const filePath = path.posix.join(this.dirName, githubFile.path)
        try {
          // Check if file exists locally
          const localContent = await this.container.files.read(filePath)
          if (localContent === undefined) {
            // New file
            await this.container.files.write(filePath, githubFile.content)
            newFiles.push(githubFile.path)
          } else if (localContent !== githubFile.content) {
            // File exists but content differs - add to conflicts, do NOT write conflict markers
            conflicts.push({
              path: githubFile.path,
              localContent,
              incomingContent: githubFile.content,
            })
            // Do not update the file yet; wait for user resolution
          } else {
            // Content is the same, no action needed
          }
        } catch (error) {
          console.error(`Error processing file ${githubFile.path}:`, error)
        }
      }

      // Fix permissions after all file operations
      await this.fixPermissions()

      // Refresh file tree
      this.fileWatchCallback?.(await this.getFileTree())

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
    this.fileWatchCallback?.(await this.getFileTree())
  }

  /**
   * Creates Git conflict markers for a file with conflicts
   * @param localContent - Current local file content
   * @param githubContent - GitHub file content
   * @param filePath - Path of the file (for conflict header)
   * @returns File content with Git conflict markers
   */
  private createGitConflictMarkers(
    localContent: string,
    githubContent: string,
    filePath: string
  ): string {
    return `<<<<<<< HEAD
${localContent}
=======
${githubContent}
>>>>>>> origin/main
`
  }

  /**
   * Flattens the file tree to get all file paths
   * @param files - File tree structure
   * @returns Array of file paths
   */
  private flattenFileTree(files: (TFolder | TFile)[]): string[] {
    const paths: string[] = []

    const processNode = (node: TFolder | TFile, currentPath: string = "") => {
      if (node.type === "file") {
        paths.push(path.posix.join(currentPath, node.name))
      } else if (node.type === "folder" && node.children) {
        const folderPath = path.posix.join(currentPath, node.name)
        node.children.forEach((child) => processNode(child, folderPath))
      }
    }

    files.forEach((file) => processNode(file))
    return paths
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
    this.fileWatchCallback?.(await this.getFileTree())
  }

  /**
   * Detects Git conflict markers in a file and parses them
   * @param content - File content to check for conflicts
   * @returns Array of conflict sections with line-by-line details
   */
  parseGitConflicts(content: string): Array<{
    startLine: number
    endLine: number
    currentLines: string[]
    incomingLines: string[]
    separatorLine: number
  }> {
    const lines = content.split("\n")
    const conflicts: Array<{
      startLine: number
      endLine: number
      currentLines: string[]
      incomingLines: string[]
      separatorLine: number
    }> = []

    let i = 0
    while (i < lines.length) {
      const line = lines[i]

      // Check for conflict start marker
      if (line.startsWith("<<<<<<<")) {
        const startLine = i + 1 // Convert to 1-based line numbers
        const currentLines: string[] = []

        // Collect current (local) lines
        i++
        while (i < lines.length && !lines[i].startsWith("=======")) {
          currentLines.push(lines[i])
          i++
        }

        if (i >= lines.length) break // Malformed conflict

        const separatorLine = i + 1
        const incomingLines: string[] = []

        // Collect incoming (GitHub) lines
        i++
        while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
          incomingLines.push(lines[i])
          i++
        }

        if (i >= lines.length) break // Malformed conflict

        const endLine = i + 1

        conflicts.push({
          startLine,
          endLine,
          currentLines,
          incomingLines,
          separatorLine,
        })
      }

      i++
    }

    return conflicts
  }

  /**
   * Resolves a Git conflict by applying user's line-by-line choices
   * @param content - Original file content with conflict markers
   * @param resolutions - Array of resolutions for each conflict section
   * @returns Resolved file content
   */
  resolveGitConflicts(
    content: string,
    resolutions: Array<{
      conflictIndex: number
      resolution: "current" | "incoming" | "manual"
      manualContent?: string
    }>
  ): string {
    const lines = content.split("\n")
    const conflicts = this.parseGitConflicts(content)

    // Sort resolutions by conflict index in descending order
    // so we can replace from bottom to top without affecting line numbers
    const sortedResolutions = [...resolutions].sort(
      (a, b) => b.conflictIndex - a.conflictIndex
    )

    for (const resolution of sortedResolutions) {
      const conflict = conflicts[resolution.conflictIndex]
      if (!conflict) continue

      let resolvedContent: string

      switch (resolution.resolution) {
        case "current":
          resolvedContent = conflict.currentLines.join("\n")
          break
        case "incoming":
          resolvedContent = conflict.incomingLines.join("\n")
          break
        case "manual":
          resolvedContent =
            resolution.manualContent || conflict.incomingLines.join("\n")
          break
        default:
          resolvedContent = conflict.incomingLines.join("\n")
      }

      // Replace the conflict section with resolved content
      const beforeConflict = lines.slice(0, conflict.startLine - 1)
      const afterConflict = lines.slice(conflict.endLine)
      const newLines = [...beforeConflict, resolvedContent, ...afterConflict]

      // Update lines array for next iteration
      lines.splice(0, lines.length, ...newLines)
    }

    return lines.join("\n")
  }

  /**
   * Checks if a file has Git conflict markers
   * @param content - File content to check
   * @returns True if file contains conflict markers
   */
  hasGitConflicts(content: string): boolean {
    return (
      content.includes("<<<<<<<") &&
      content.includes("=======") &&
      content.includes(">>>>>>>")
    )
  }

  /**
   * Read file content by path
   * @param filePath - Full path to the file
   * @returns File content or null if file doesn't exist
   */
  async readFileByPath(filePath: string): Promise<string | null> {
    try {
      const content = await this.container.files.read(filePath)
      return content || null
    } catch (error) {
      return null
    }
  }

  /**
   * Write file content by path
   * @param filePath - Full path to the file
   * @param content - Content to write
   */
  async writeFileByPath(filePath: string, content: string): Promise<void> {
    await this.container.files.write(filePath, content)
  }
}
