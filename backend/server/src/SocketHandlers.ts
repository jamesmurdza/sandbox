import { Socket } from 'socket.io'
import { AIWorker } from "./AIWorker"
import { CONTAINER_TIMEOUT } from "./constants"
import { DokkuClient } from "./DokkuClient"
import { FileManager } from "./FileManager"
import {
    createFileRL,
    createFolderRL,
    deleteFileRL,
    renameFileRL,
    saveFileRL,
} from "./ratelimit"
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
    socket: Socket
}

// Extract port number from a string
function extractPortNumber(inputString: string): number | null {
    const cleanedString = inputString.replace(/\x1B\[[0-9;]*m/g, "")
    const regex = /http:\/\/localhost:(\d+)/
    const match = cleanedString.match(regex)
    return match ? parseInt(match[1]) : null
}

// Handle heartbeat from a socket connection
const handleHeartbeat: SocketHandler = (_: any, context: HandlerContext) => {
    context.sandboxManager.setTimeout(CONTAINER_TIMEOUT)
}

// Handle getting a file
const handleGetFile: SocketHandler = ({ fileId }: any, context: HandlerContext) => {
    return context.fileManager.getFile(fileId)
}

// Handle getting a folder
const handleGetFolder: SocketHandler = ({ folderId }: any, context: HandlerContext) => {
    return context.fileManager.getFolder(folderId)
}

// Handle saving a file
const handleSaveFile: SocketHandler = async ({ fileId, body, userId }: any, context: HandlerContext) => {
    await saveFileRL.consume(userId, 1);
    return context.fileManager.saveFile(fileId, body)
}

// Handle moving a file
const handleMoveFile: SocketHandler = ({ fileId, folderId }: any, context: HandlerContext) => {
    return context.fileManager.moveFile(fileId, folderId)
}

// Handle listing apps
const handleListApps: SocketHandler = async (_: any, context: HandlerContext) => {
    if (!context.dokkuClient) throw Error("Failed to retrieve apps list: No Dokku client")
    return { success: true, apps: await context.dokkuClient.listApps() }
}

// Handle deploying code
const handleDeploy: SocketHandler = async ({ sandboxId }: any, context: HandlerContext) => {
    if (!context.gitClient) throw Error("Failed to retrieve apps list: No git client")
    const fixedFilePaths = context.fileManager.sandboxFiles.fileData.map((file) => ({
        ...file,
        id: file.id.split("/").slice(2).join("/"),
    }))
    await context.gitClient.pushFiles(fixedFilePaths, sandboxId)
    return { success: true }
}

// Handle creating a file
const handleCreateFile: SocketHandler = async ({ name, userId }: any, context: HandlerContext) => {
    await createFileRL.consume(userId, 1);
    return { "success": await context.fileManager.createFile(name) }
}

// Handle creating a folder
const handleCreateFolder: SocketHandler = async ({ name, userId }: any, context: HandlerContext) => {
    await createFolderRL.consume(userId, 1);
    return { "success": await context.fileManager.createFolder(name) }
}

// Handle renaming a file
const handleRenameFile: SocketHandler = async ({ fileId, newName, userId }: any, context: HandlerContext) => {
    await renameFileRL.consume(userId, 1)
    return context.fileManager.renameFile(fileId, newName)
}

// Handle deleting a file
const handleDeleteFile: SocketHandler = async ({ fileId, userId }: any, context: HandlerContext) => {
    await deleteFileRL.consume(userId, 1)
    return context.fileManager.deleteFile(fileId)
}

// Handle deleting a folder
const handleDeleteFolder: SocketHandler = ({ folderId }: any, context: HandlerContext) => {
    return context.fileManager.deleteFolder(folderId)
}

// Handle creating a terminal session
const handleCreateTerminal: SocketHandler = async ({ id, sandboxId }: any, context: HandlerContext) => {
    await context.lockManager.acquireLock(sandboxId, async () => {
        await context.terminalManager.createTerminal(id, (responseString: string) => {
            context.socket.emit("terminalResponse", { id, data: responseString })
            const port = extractPortNumber(responseString)
            if (port) {
                context.socket.emit(
                    "previewURL",
                    "https://" + context.sandboxManager.getHost(port)
                )
            }
        })
    })
}

// Handle resizing a terminal
const handleResizeTerminal: SocketHandler = ({ dimensions }: any, context: HandlerContext) => {
    context.terminalManager.resizeTerminal(dimensions)
}

// Handle sending data to a terminal
const handleTerminalData: SocketHandler = ({ id, data }: any, context: HandlerContext) => {
    return context.terminalManager.sendTerminalData(id, data)
}

// Handle closing a terminal
const handleCloseTerminal: SocketHandler = ({ id }: any, context: HandlerContext) => {
    return context.terminalManager.closeTerminal(id)
}

// Handle generating code
const handleGenerateCode: SocketHandler = ({ userId, fileName, code, line, instructions }: any, context: HandlerContext) => {
    return context.aiWorker.generateCode(userId, fileName, code, line, instructions)
}

// Define a type for SocketHandler functions
type SocketHandler<T = Record<string, any>> = (args: T, context: HandlerContext) => any;

export const eventHandlers = {
    "heartbeat": handleHeartbeat,
    "getFile": handleGetFile,
    "getFolder": handleGetFolder,
    "saveFile": handleSaveFile,
    "moveFile": handleMoveFile,
    "list": handleListApps,
    "deploy": handleDeploy,
    "createFile": handleCreateFile,
    "createFolder": handleCreateFolder,
    "renameFile": handleRenameFile,
    "deleteFile": handleDeleteFile,
    "deleteFolder": handleDeleteFolder,
    "createTerminal": handleCreateTerminal,
    "resizeTerminal": handleResizeTerminal,
    "terminalData": handleTerminalData,
    "closeTerminal": handleCloseTerminal,
    "generateCode": handleGenerateCode,
};
