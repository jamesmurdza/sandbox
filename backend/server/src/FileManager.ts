import { FilesystemEvent, FilesystemEventType, Sandbox, WatchHandle } from "e2b"
import path from "path"
import { MAX_BODY_SIZE } from "./ratelimit"
import { TFile, TFolder } from "./types"

// FileManager class to handle file operations in a sandbox
export class FileManager {
  private sandbox: Sandbox
  private fileWatchers: WatchHandle[] = []
  private dirName = "/home/user/project"
  private refreshFileList: ((files: (TFolder | TFile)[]) => void) | null

  // Constructor to initialize the FileManager
  constructor(
    sandbox: Sandbox,
    refreshFileList: ((files: (TFolder | TFile)[]) => void) | null
  ) {
    this.sandbox = sandbox
    this.refreshFileList = refreshFileList
  }

  async getFileTree(): Promise<(TFolder | TFile)[]> {
    // Run the command to retrieve paths
    // Ignore node_modules until we make this faster
    const result = await this.sandbox.commands.run(
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

  // Initialize the FileManager
  async initialize() {
    // Make the logged in user the owner of all project files
    this.fixPermissions()

    await this.watchDirectory(this.dirName)
    await this.watchSubdirectories(this.dirName)
  }

  // Change the owner of the project directory to user
  private async fixPermissions() {
    try {
      await this.sandbox.commands.run(`sudo chown -R user "${this.dirName}"`)
    } catch (e: any) {
      console.log("Failed to fix permissions: " + e)
    }
  }

  // Watch a directory for changes
  async watchDirectory(directory: string): Promise<WatchHandle | undefined> {
    try {
      const handle = await this.sandbox.files.watchDir(
        directory,
        async (event: FilesystemEvent) => {
          try {
            // Tell the client to reload the file list
            if (
              event.type === FilesystemEventType.CREATE ||
              event.type === FilesystemEventType.REMOVE ||
              event.type === FilesystemEventType.RENAME
            ) {
              this.refreshFileList?.(await this.getFileTree())
            }
          } catch (error) {
            console.error(
              `Error handling ${event.type} event for ${event.name}:`,
              error
            )
          }
        },
        { timeoutMs: 0 }
      )
      this.fileWatchers.push(handle)
      return handle
    } catch (error) {
      console.error(`Error watching filesystem:`, error)
    }
  }

  // Watch subdirectories recursively
  async watchSubdirectories(directory: string) {
    const dirContent = await this.sandbox.files.list(directory)
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
    const fileContent = await this.sandbox.files.read(filePath)
    return fileContent
  }

  // Get folder content
  async getFolder(folderId: string): Promise<string[]> {
    return (await this.sandbox.files.list(folderId)).map((entry) =>
      path.posix.join(folderId, entry.name)
    )
  }

  // Save file content
  async saveFile(fileId: string, body: string): Promise<void> {
    if (!fileId) return // handles saving when no file is open

    if (Buffer.byteLength(body, "utf-8") > MAX_BODY_SIZE) {
      throw new Error("File size too large. Please reduce the file size.")
    }

    // Save to sandbox filesystem
    const filePath = path.posix.join(this.dirName, fileId)
    await this.sandbox.files.write(filePath, body)

    this.refreshFileList?.(await this.getFileTree())
    this.fixPermissions()
  }

  // Move a file to a different folder
  async moveFile(
    fileId: string,
    folderId: string
  ): Promise<(TFolder | TFile)[]> {
    const parts = fileId.split("/")
    const newFileId = folderId + "/" + parts.pop()

    await this.moveFileInContainer(fileId, newFileId)
    await this.fixPermissions()

    return await this.getFileTree()
  }

  // Move a file within the container
  private async moveFileInContainer(oldPath: string, newPath: string) {
    try {
      const fileContents = await this.sandbox.files.read(
        path.posix.join(this.dirName, oldPath)
      )
      await this.sandbox.files.write(
        path.posix.join(this.dirName, newPath),
        fileContents
      )
      await this.sandbox.files.remove(path.posix.join(this.dirName, oldPath))
    } catch (e) {
      console.error(`Error moving file from ${oldPath} to ${newPath}:`, e)
    }
  }

  // Create a new file
  async createFile(name: string): Promise<boolean> {
    const id = `/${name}`

    await this.sandbox.files.write(path.posix.join(this.dirName, id), "")
    await this.fixPermissions()

    return true
  }

  public async getFilesForDownload(): Promise<string> {
    // TODO: Use E2B to create the zip file
    return ""
  }

  // Create a new folder
  async createFolder(name: string): Promise<void> {
    await this.sandbox.files.makeDir(path.posix.join(this.dirName, name))
  }

  // Rename a file
  async renameFile(fileId: string, newName: string): Promise<void> {
    const parts = fileId.split("/")
    const newFileId = parts.slice(0, parts.length - 1).join("/") + "/" + newName

    await this.moveFileInContainer(fileId, newFileId)
    await this.fixPermissions()
  }

  // Delete a file
  async deleteFile(fileId: string): Promise<(TFolder | TFile)[]> {
    await this.sandbox.files.remove(path.posix.join(this.dirName, fileId))
    return await this.getFileTree()
  }

  // Delete a folder
  async deleteFolder(folderId: string): Promise<(TFolder | TFile)[]> {
    this.sandbox.files.remove(path.posix.join(this.dirName, folderId))
    return await this.getFileTree()
  }

  // Close all file watchers
  async closeWatchers() {
    await Promise.all(
      this.fileWatchers.map(async (handle: WatchHandle) => {
        await handle.stop()
      })
    )
  }
}
