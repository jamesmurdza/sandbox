import { AIWorker } from "./AIWorker"
import { CONTAINER_TIMEOUT } from "./constants"
import { DokkuClient } from "./DokkuClient"
import { FileManager } from "./FileManager"
import { SecureGitClient } from "./SecureGitClient"
import { TerminalManager } from "./TerminalManager"
import { LockManager } from "./utils"

export interface HandlerContext {
    fileManager: FileManager;
    terminalManager: TerminalManager;
    sandboxManager: any;
    aiWorker: AIWorker;
    dokkuClient: DokkuClient | null;
    gitClient: SecureGitClient | null;
    lockManager: LockManager
}

// Extract port number from a string
function extractPortNumber(inputString: string): number | null {
    const cleanedString = inputString.replace(/\x1B\[[0-9;]*m/g, "")
    const regex = /http:\/\/localhost:(\d+)/
    const match = cleanedString.match(regex)
    return match ? parseInt(match[1]) : null
}

// Handle heartbeat from a socket connection
export const handleHeartbeat: SocketHandler = (_: any, context: HandlerContext) => {
    context.sandboxManager.setTimeout(CONTAINER_TIMEOUT)
}

// Handle getting a file
export const handleGetFile: SocketHandler = ({ fileId }: any, context: HandlerContext) => {
    return context.fileManager.getFile(fileId)
}

// Handle getting a folder
export const handleGetFolder: SocketHandler = ({ folderId }: any, context: HandlerContext) => {
    return context.fileManager.getFolder(folderId)
}

// Handle saving a file
export const handleSaveFile: SocketHandler = ({ fileId, body }: any, context: HandlerContext) => {
    return context.fileManager.saveFile(fileId, body)
}

// Handle moving a file
export const handleMoveFile: SocketHandler = ({ fileId, folderId }: any, context: HandlerContext) => {
    return context.fileManager.moveFile(fileId, folderId)
}

// Handle listing apps
export const handleListApps: SocketHandler = async ({ }: any, context: HandlerContext) => {
    if (!context.dokkuClient) throw Error("Failed to retrieve apps list: No Dokku client")
    return { success: true, apps: await context.dokkuClient.listApps() }
}

// Handle deploying code
export const handleDeploy: SocketHandler = async ({ sandboxId }: any, context: HandlerContext) => {
    if (!context.gitClient) throw Error("Failed to retrieve apps list: No git client")
    const fixedFilePaths = context.fileManager.sandboxFiles.fileData.map((file) => ({
        ...file,
        id: file.id.split("/").slice(2).join("/"),
    }))
    await context.gitClient.pushFiles(fixedFilePaths, sandboxId)
    return { success: true }
}

// Handle creating a file
export const handleCreateFile: SocketHandler = ({ name }: any, context: HandlerContext) => {
    return context.fileManager.createFile(name)
}

// Handle creating a folder
export const handleCreateFolder: SocketHandler = ({ name }: any, context: HandlerContext) => {
    return context.fileManager.createFolder(name)
}

// Handle renaming a file
export const handleRenameFile: SocketHandler = ({ fileId, newName }: any, context: HandlerContext) => {
    return context.fileManager.renameFile(fileId, newName)
}

// Handle deleting a file
export const handleDeleteFile: SocketHandler = ({ fileId }: any, context: HandlerContext) => {
    return context.fileManager.deleteFile(fileId)
}

// Handle deleting a folder
export const handleDeleteFolder: SocketHandler = ({ folderId }: any, context: HandlerContext) => {
    return context.fileManager.deleteFolder(folderId)
}

// Handle creating a terminal session
export const handleCreateTerminal: SocketHandler = async ({ id, socket, data }: any, context: HandlerContext) => {
    await context.lockManager.acquireLock(data.sandboxId, async () => {
        await context.terminalManager.createTerminal(id, (responseString: string) => {
            socket.emit("terminalResponse", { id, data: responseString })
            const port = extractPortNumber(responseString)
            if (port) {
                socket.emit(
                    "previewURL",
                    "https://" + context.sandboxManager.getHost(port)
                )
            }
        })
    })
}

// Handle resizing a terminal
export const handleResizeTerminal: SocketHandler = ({ dimensions }: any, context: HandlerContext) => {
    context.terminalManager.resizeTerminal(dimensions)
}

// Handle sending data to a terminal
export const handleTerminalData: SocketHandler = ({ id, data }: any, context: HandlerContext) => {
    return context.terminalManager.sendTerminalData(id, data)
}

// Handle closing a terminal
export const handleCloseTerminal: SocketHandler = ({ id }: any, context: HandlerContext) => {
    return context.terminalManager.closeTerminal(id)
}

// Handle generating code
export const handleGenerateCode: SocketHandler = ({ userId, fileName, code, line, instructions }: any, context: HandlerContext) => {
    return context.aiWorker.generateCode(userId, fileName, code, line, instructions)
}

// Define a type for SocketHandler functions
type SocketHandler<T = Record<string, any>> = (args: T, context: HandlerContext) => any;
