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
}
