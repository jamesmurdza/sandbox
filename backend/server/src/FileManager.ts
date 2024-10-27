import { FilesystemEvent, Sandbox, WatchHandle } from "e2b"
import path from "path"
import RemoteFileStorage from "./RemoteFileStorage"
import { MAX_BODY_SIZE } from "./ratelimit"
import { TFile, TFileData, TFolder } from "./types"

// Convert list of paths to the hierchical file structure used by the editor
function generateFileStructure(paths: string[]): (TFolder | TFile)[] {
  const root: TFolder = { id: "/", type: "folder", name: "/", children: [] }

  paths.forEach((path) => {
    const parts = path.split("/")
    let current: TFolder = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1 && part.length
      const existing = current.children.find((child) => child.name === part)

      if (existing) {
        if (!isFile) {
          current = existing as TFolder
        }
      } else {
        if (isFile) {
          const file: TFile = { id: `/${parts.join("/")}`, type: "file", name: part }
          current.children.push(file)
        } else {
          const folder: TFolder = {
            id: `/${parts.slice(0, i + 1).join("/")}`,
            type: "folder",
            name: part,
            children: [],
          }
          current.children.push(folder)
          current = folder
        }
      }
    }
  })

  return root.children
}

// FileManager class to handle file operations in a sandbox
export class FileManager {
  private sandboxId: string
  private sandbox: Sandbox
  public files: (TFolder | TFile)[]
  public fileData: TFileData[]
  private fileWatchers: WatchHandle[] = []
  private dirName = "/home/user/project"
  private refreshFileList: ((files: (TFolder | TFile)[]) => void) | null

  // Constructor to initialize the FileManager
  constructor(
    sandboxId: string,
    sandbox: Sandbox,
    refreshFileList: ((files: (TFolder | TFile)[]) => void) | null
  ) {
    this.sandboxId = sandboxId
    this.sandbox = sandbox
    this.files = []
    this.fileData = []
    this.refreshFileList = refreshFileList
  }

  // Fetch file data from list of paths
  private async generateFileData(paths: string[]): Promise<TFileData[]> {
    const fileData: TFileData[] = []

    for (const path of paths) {
      const parts = path.split("/")
      const isFile = parts.length > 0 && parts[parts.length - 1].length > 0

      if (isFile) {
        const fileId = `/${parts.join("/")}`
        const data = await RemoteFileStorage.fetchFileContent(`projects/${this.sandboxId}${fileId}`)
        fileData.push({ id: fileId, data })
      }
    }

    return fileData
  }

  // Convert local file path to remote path
  private getRemoteFileId(localId: string): string {
    return `projects/${this.sandboxId}${localId}`
  }

  // Convert remote file path to local file path
  private getLocalFileId(remoteId: string): string | undefined {
    const allParts = remoteId.split("/")
    if (allParts[1] !== this.sandboxId) return undefined;
    return allParts.slice(2).join("/")
  }

  // Convert remote file paths to local file paths
  private getLocalFileIds(remoteIds: string[]): string[] {
    return remoteIds
      .map(this.getLocalFileId.bind(this))
      .filter((id) => id !== undefined);
  }

  // Download files from remote storage
  private async updateFileData(): Promise<TFileData[]> {
    const remotePaths = await RemoteFileStorage.getSandboxPaths(this.sandboxId)
    const localPaths = this.getLocalFileIds(remotePaths)
    this.fileData = await this.generateFileData(localPaths)
    return this.fileData
  }

  // Update file structure
  private async updateFileStructure(): Promise<(TFolder | TFile)[]> {
    const remotePaths = await RemoteFileStorage.getSandboxPaths(this.sandboxId)
    const localPaths = this.getLocalFileIds(remotePaths)
    this.files = generateFileStructure(localPaths)
    return this.files
  }

  // Initialize the FileManager
  async initialize() {

    // Download files from remote file storage
    await this.updateFileStructure()
    await this.updateFileData()

    // Copy all files from the project to the container
    const promises = this.fileData.map(async (file) => {
      try {
        const filePath = path.posix.join(this.dirName, file.id)
        const parentDirectory = path.dirname(filePath)
        if (!this.sandbox.files.exists(parentDirectory)) {
          await this.sandbox.files.makeDir(parentDirectory)
        }
        await this.sandbox.files.write(filePath, file.data)
      } catch (e: any) {
        console.log("Failed to create file: " + e)
      }
    })
    await Promise.all(promises)

    // Make the logged in user the owner of all project files
    this.fixPermissions()

    await this.watchDirectory(this.dirName)
    await this.watchSubdirectories(this.dirName)
  }

  // Check if the given path is a directory
  private async isDirectory(directoryPath: string): Promise<boolean> {
    try {
      const result = await this.sandbox.commands.run(
        `[ -d "${directoryPath}" ] && echo "true" || echo "false"`
      )
      return result.stdout.trim() === "true"
    } catch (e: any) {
      console.log("Failed to check if directory: " + e)
      return false
    }
  }

  // Change the owner of the project directory to user
  private async fixPermissions() {
    try {
      await this.sandbox.commands.run(
        `sudo chown -R user "${this.dirName}"`
      )
    } catch (e: any) {
      console.log("Failed to fix permissions: " + e)
    }
  }

  // Watch a directory for changes
  async watchDirectory(directory: string): Promise<WatchHandle | undefined> {
    try {
      const handle = await this.sandbox.files.watch(
        directory,
        async (event: FilesystemEvent) => {
          try {
            function removeDirName(path: string, dirName: string) {
              return path.startsWith(dirName)
                ? path.slice(dirName.length)
                : path
            }

            // This is the absolute file path in the container
            const containerFilePath = path.posix.join(directory, event.name)
            // This is the file path relative to the project directory
            const sandboxFilePath = removeDirName(containerFilePath, this.dirName)
            // This is the directory being watched relative to the project directory
            const sandboxDirectory = removeDirName(directory, this.dirName)

            // Helper function to find a folder by id
            function findFolderById(
              files: (TFolder | TFile)[],
              folderId: string
            ) {
              return files.find(
                (file: TFolder | TFile) =>
                  file.type === "folder" && file.id === folderId
              )
            }

            // Handle file/directory creation event
            if (event.type === "create") {
              const folder = findFolderById(
                this.files,
                sandboxDirectory
              ) as TFolder
              const isDir = await this.isDirectory(containerFilePath)

              const newItem = isDir
                ? ({
                  id: sandboxFilePath,
                  name: event.name,
                  type: "folder",
                  children: [],
                } as TFolder)
                : ({
                  id: sandboxFilePath,
                  name: event.name,
                  type: "file",
                } as TFile)

              if (folder) {
                // If the folder exists, add the new item (file/folder) as a child
                folder.children.push(newItem)
              } else {
                // If folder doesn't exist, add the new item to the root
                this.files.push(newItem)
              }

              if (!isDir) {
                const fileData = await this.sandbox.files.read(
                  containerFilePath
                )
                const fileContents =
                  typeof fileData === "string" ? fileData : ""
                this.fileData.push({
                  id: sandboxFilePath,
                  data: fileContents,
                })
              }

              console.log(`Create ${sandboxFilePath}`)
            }

            // Handle file/directory removal or rename event
            else if (event.type === "remove" || event.type == "rename") {
              const folder = findFolderById(
                this.files,
                sandboxDirectory
              ) as TFolder
              const isDir = await this.isDirectory(containerFilePath)

              const isFileMatch = (file: TFolder | TFile | TFileData) =>
                file.id === sandboxFilePath ||
                file.id.startsWith(containerFilePath + "/")

              if (folder) {
                // Remove item from its parent folder
                folder.children = folder.children.filter(
                  (file: TFolder | TFile) => !isFileMatch(file)
                )
              } else {
                // Remove from the root if it's not inside a folder
                this.files = this.files.filter(
                  (file: TFolder | TFile) => !isFileMatch(file)
                )
              }

              // Also remove any corresponding file data
              this.fileData = this.fileData.filter(
                (file: TFileData) => !isFileMatch(file)
              )

              console.log(`Removed: ${sandboxFilePath}`)
            }

            // Handle file write event
            else if (event.type === "write") {
              const folder = findFolderById(
                this.files,
                sandboxDirectory
              ) as TFolder
              const fileToWrite = this.fileData.find(
                (file) => file.id === sandboxFilePath
              )

              if (fileToWrite) {
                fileToWrite.data = await this.sandbox.files.read(
                  containerFilePath
                )
                console.log(`Write to ${sandboxFilePath}`)
              } else {
                // If the file is part of a folder structure, locate it and update its data
                const fileInFolder = folder?.children.find(
                  (file) => file.id === sandboxFilePath
                )
                if (fileInFolder) {
                  const fileData = await this.sandbox.files.read(
                    containerFilePath
                  )
                  const fileContents =
                    typeof fileData === "string" ? fileData : ""
                  this.fileData.push({
                    id: sandboxFilePath,
                    data: fileContents,
                  })
                  console.log(`Write to ${sandboxFilePath}`)
                }
              }
            }

            // Tell the client to reload the file list
            if (event.type !== "chmod") {
              this.refreshFileList?.(this.files)
            }
          } catch (error) {
            console.error(
              `Error handling ${event.type} event for ${event.name}:`,
              error
            )
          }
        },
        { timeout: 0 }
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
    const file = this.fileData.find((f) => f.id === fileId)
    return file?.data
  }

  // Get folder content
  async getFolder(folderId: string): Promise<string[]> {
    const remotePaths = await RemoteFileStorage.getFolder(this.getRemoteFileId(folderId))
    return this.getLocalFileIds(remotePaths)
  }

  // Save file content
  async saveFile(fileId: string, body: string): Promise<void> {
    if (!fileId) return // handles saving when no file is open

    if (Buffer.byteLength(body, "utf-8") > MAX_BODY_SIZE) {
      throw new Error("File size too large. Please reduce the file size.")
    }
    await RemoteFileStorage.saveFile(this.getRemoteFileId(fileId), body)
    const file = this.fileData.find((f) => f.id === fileId)
    if (!file) return
    file.data = body

    await this.sandbox.files.write(path.posix.join(this.dirName, file.id), body)
    this.fixPermissions()
  }

  // Move a file to a different folder
  async moveFile(
    fileId: string,
    folderId: string
  ): Promise<(TFolder | TFile)[]> {
    const fileData = this.fileData.find((f) => f.id === fileId)
    const file = this.files.find((f) => f.id === fileId)
    if (!fileData || !file) return this.files

    const parts = fileId.split("/")
    const newFileId = folderId + "/" + parts.pop()

    await this.moveFileInContainer(fileId, newFileId)

    await this.fixPermissions()

    fileData.id = newFileId
    file.id = newFileId

    await RemoteFileStorage.renameFile(this.getRemoteFileId(fileId), this.getRemoteFileId(newFileId), fileData.data)
    return this.updateFileStructure()
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
    const size: number = await RemoteFileStorage.getProjectSize(this.sandboxId)
    if (size > 200 * 1024 * 1024) {
      throw new Error("Project size exceeded. Please delete some files.")
    }

    const id = `/${name}`

    await this.sandbox.files.write(path.posix.join(this.dirName, id), "")
    await this.fixPermissions()

    this.files.push({
      id,
      name,
      type: "file",
    })

    this.fileData.push({
      id,
      data: "",
    })

    await RemoteFileStorage.createFile(this.getRemoteFileId(id))

    return true
  }

  // Create a new folder
  async createFolder(name: string): Promise<void> {
    const id = `/${name}`
    await this.sandbox.files.makeDir(path.posix.join(this.dirName, id))
  }

  // Rename a file
  async renameFile(fileId: string, newName: string): Promise<void> {
    const fileData = this.fileData.find((f) => f.id === fileId)
    const file = this.files.find((f) => f.id === fileId)
    if (!fileData || !file) return

    const parts = fileId.split("/")
    const newFileId = parts.slice(0, parts.length - 1).join("/") + "/" + newName

    await this.moveFileInContainer(fileId, newFileId)
    await this.fixPermissions()
    await RemoteFileStorage.renameFile(this.getRemoteFileId(fileId), this.getRemoteFileId(newFileId), fileData.data)

    fileData.id = newFileId
    file.id = newFileId
  }

  // Delete a file
  async deleteFile(fileId: string): Promise<(TFolder | TFile)[]> {
    const file = this.fileData.find((f) => f.id === fileId)
    if (!file) return this.files

    await this.sandbox.files.remove(path.posix.join(this.dirName, fileId))
    this.fileData = this.fileData.filter(
      (f) => f.id !== fileId
    )

    await RemoteFileStorage.deleteFile(this.getRemoteFileId(fileId))
    return this.updateFileStructure()
  }

  // Delete a folder
  async deleteFolder(folderId: string): Promise<(TFolder | TFile)[]> {
    const files = await RemoteFileStorage.getFolder(this.getRemoteFileId(folderId))

    await Promise.all(
      files.map(async (file) => {
        await this.sandbox.files.remove(path.posix.join(this.dirName, file))
        this.fileData = this.fileData.filter(
          (f) => f.id !== file
        )
        await RemoteFileStorage.deleteFile(this.getRemoteFileId(file))
      })
    )

    return this.updateFileStructure()
  }

  // Close all file watchers
  async closeWatchers() {
    await Promise.all(
      this.fileWatchers.map(async (handle: WatchHandle) => {
        await handle.close()
      })
    )
  }
}
