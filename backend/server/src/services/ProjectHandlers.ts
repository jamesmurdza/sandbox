import { Socket } from "socket.io"
import { CONTAINER_TIMEOUT } from "../utils/constants"
import { LockManager } from "../utils/lock"
import { Project } from "./Project"

import {
  createFileRL,
  createFolderRL,
  deleteFileRL,
  renameFileRL,
  saveFileRL,
} from "../utils/ratelimit"

type ServerContext = {
  dokkuClient: any | null
  gitClient: any | null
}

type ConnectionInfo = {
  userId: string
  isOwner: boolean
  socket: Socket
}

type SocketHandler = (options: any) => Promise<any> | any

export const createProjectHandlers = (
  project: Project,
  connection: ConnectionInfo,
  context: ServerContext
) => {
  const { dokkuClient, gitClient } = context
  const lockManager = new LockManager()

  // Extract port number from a string
  function extractPortNumber(inputString: string): number | null {
    const cleanedString = inputString.replace(/\x1B\[[0-9;]*m/g, "")
    const regex = /http:\/\/localhost:(\d+)/
    const match = cleanedString.match(regex)
    return match ? parseInt(match[1]) : null
  }

  // Handle heartbeat from a socket connection
  const handleHeartbeat: SocketHandler = async () => {
    // Only keep the container alive if the owner is still connected
    if (connection.isOwner) {
      try {
        await project.container?.setTimeout(CONTAINER_TIMEOUT)
      } catch (error) {
        console.error("Failed to set container timeout:", error)
        return false
      }
    }
    return true
  }

  // Handle getting a file
  const handleGetFile: SocketHandler = ({ fileId }: { fileId: string }) => {
    return project.fileManager?.getFile(fileId)
  }

  // Handle getting a folder
  const handleGetFolder: SocketHandler = ({
    folderId,
  }: {
    folderId: string
  }) => {
    return project.fileManager?.getFolder(folderId)
  }

  // Handle saving a file
  const handleSaveFile: SocketHandler = async ({
    fileId,
    body,
  }: {
    fileId: string
    body: string
  }) => {
    saveFileRL.consume(connection.userId, 1)
    return project.fileManager?.saveFile(fileId, body)
  }

  // Handle moving a file
  const handleMoveFile: SocketHandler = ({
    fileId,
    folderId,
  }: {
    fileId: string
    folderId: string
  }) => {
    return project.fileManager?.moveFile(fileId, folderId)
  }

  // Handle listing apps
  const handleListApps: SocketHandler = async () => {
    if (!dokkuClient)
      throw new Error("Failed to retrieve apps list: No Dokku client")
    return { success: true, apps: await dokkuClient.listApps() }
  }

  // Handle getting app creation timestamp
  const handleGetAppCreatedAt: SocketHandler = async ({
    appName,
  }: {
    appName: string
  }) => {
    if (!dokkuClient) {
      throw new Error(
        "Failed to retrieve app creation timestamp: No Dokku client"
      )
    }
    return {
      success: true,
      createdAt: await dokkuClient.getAppCreatedAt(appName),
    }
  }

  // Handle checking if an app exists
  const handleAppExists: SocketHandler = async ({
    appName,
  }: {
    appName: string
  }) => {
    if (!dokkuClient) {
      console.log("Failed to check app existence: No Dokku client")
      return { success: false }
    }
    if (!dokkuClient.isConnected) {
      console.log(
        "Failed to check app existence: The Dokku client is not connected"
      )
      return { success: false }
    }
    return {
      success: true,
      exists: await dokkuClient.appExists(appName),
    }
  }

  // Handle deploying code
  const handleDeploy: SocketHandler = async () => {
    if (!gitClient) throw new Error("No git client")
    if (!project.fileManager) throw new Error("No file manager")

    const tarBase64 = await project.fileManager.getFilesForDownload()
    await gitClient.pushFiles(tarBase64, project.projectId)
    return { success: true }
  }

  // Handle creating a file
  const handleCreateFile: SocketHandler = async ({
    name,
  }: {
    name: string
  }) => {
    createFileRL.consume(connection.userId, 1)
    return { success: await project.fileManager?.createFile(name) }
  }

  // Handle creating a folder
  const handleCreateFolder: SocketHandler = async ({
    name,
  }: {
    name: string
  }) => {
    createFolderRL.consume(connection.userId, 1)
    return { success: await project.fileManager?.createFolder(name) }
  }

  // Handle renaming a file
  const handleRenameFile: SocketHandler = async ({
    fileId,
    newName,
  }: {
    fileId: string
    newName: string
  }) => {
    renameFileRL.consume(connection.userId, 1)
    return project.fileManager?.renameFile(fileId, newName)
  }

  // Handle deleting a file
  const handleDeleteFile: SocketHandler = async ({
    fileId,
  }: {
    fileId: string
  }) => {
    deleteFileRL.consume(connection.userId, 1)
    return project.fileManager?.deleteFile(fileId)
  }

  // Handle deleting a folder
  const handleDeleteFolder: SocketHandler = ({
    folderId,
  }: {
    folderId: string
  }) => {
    return project.fileManager?.deleteFolder(folderId)
  }

  // Handle creating a terminal session
  const handleCreateTerminal: SocketHandler = async ({
    id,
  }: {
    id: string
  }) => {
    await lockManager.acquireLock(project.projectId, async () => {
      await project.terminalManager?.createTerminal(
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
              "https://" + project.container?.getHost(port)
            )
          }
        }
      )
    })
  }

  // Handle resizing a terminal
  const handleResizeTerminal: SocketHandler = ({
    dimensions,
  }: {
    dimensions: { cols: number; rows: number }
  }) => {
    project.terminalManager?.resizeTerminal(dimensions)
  }

  // Handle sending data to a terminal
  const handleTerminalData: SocketHandler = ({
    id,
    data,
  }: {
    id: string
    data: string
  }) => {
    return project.terminalManager?.sendTerminalData(id, data)
  }

  // Handle closing a terminal
  const handleCloseTerminal: SocketHandler = ({ id }: { id: string }) => {
    return project.terminalManager?.closeTerminal(id)
  }

  // Handle downloading files by download button
  const handleDownloadFiles: SocketHandler = async () => {
    if (!project.fileManager) throw new Error("No file manager")
    return { archive: await project.fileManager.getFilesForDownload() }
  }

  // Return all handlers as a map of event names to handler functions
  return {
    heartbeat: handleHeartbeat,
    getFile: handleGetFile,
    getFolder: handleGetFolder,
    saveFile: handleSaveFile,
    moveFile: handleMoveFile,
    listApps: handleListApps,
    getAppCreatedAt: handleGetAppCreatedAt,
    appExists: handleAppExists,
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
    downloadFiles: handleDownloadFiles,
  }
}
