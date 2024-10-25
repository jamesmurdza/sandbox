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
export function handleHeartbeat({ data }: { data: any }, context: HandlerContext) {
    context.sandboxManager.setTimeout(CONTAINER_TIMEOUT)
}

// Handle getting a file
export function handleGetFile({ fileId }: { fileId: string }, context: HandlerContext) {
    return context.fileManager.getFile(fileId)
}

// Handle getting a folder
export function handleGetFolder({ folderId }: { folderId: string }, context: HandlerContext) {
    return context.fileManager.getFolder(folderId)
}

// Handle saving a file
export function handleSaveFile({ fileId, body }: { fileId: string, body: string }, context: HandlerContext) {
    return context.fileManager.saveFile(fileId, body)
}

// Handle moving a file
export function handleMoveFile({ fileId, folderId }: { fileId: string, folderId: string }, context: HandlerContext) {
    return context.fileManager.moveFile(fileId, folderId)
}

// Handle listing apps
export async function handleListApps({ }, context: HandlerContext) {
    if (!context.dokkuClient) throw Error("Failed to retrieve apps list: No Dokku client")
    return { success: true, apps: await context.dokkuClient.listApps() }
}

// Handle deploying code
export async function handleDeploy({ sandboxId }: { sandboxId: string }, context: HandlerContext) {
    if (!context.gitClient) throw Error("Failed to retrieve apps list: No git client")
    const fixedFilePaths = context.fileManager.sandboxFiles.fileData.map((file) => ({
        ...file,
        id: file.id.split("/").slice(2).join("/"),
    }))
    await context.gitClient.pushFiles(fixedFilePaths, sandboxId)
    return { success: true }
}

// Handle creating a file
export function handleCreateFile({ name }: { name: string }, context: HandlerContext) {
    return context.fileManager.createFile(name)
}

// Handle creating a folder
export function handleCreateFolder({ name }: { name: string }, context: HandlerContext) {
    return context.fileManager.createFolder(name)
}

// Handle renaming a file
export function handleRenameFile({ fileId, newName }: { fileId: string, newName: string }, context: HandlerContext) {
    return context.fileManager.renameFile(fileId, newName)
}

// Handle deleting a file
export function handleDeleteFile({ fileId }: { fileId: string }, context: HandlerContext) {
    return context.fileManager.deleteFile(fileId)
}

// Handle deleting a folder
export function handleDeleteFolder({ folderId }: { folderId: string }, context: HandlerContext) {
    return context.fileManager.deleteFolder(folderId)
}

// Handle creating a terminal session
export async function handleCreateTerminal({ id, socket, data }: { id: string, socket: any, data: any }, context: HandlerContext) {
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
export function handleResizeTerminal({ dimensions }: { dimensions: { cols: number; rows: number } }, context: HandlerContext) {
    context.terminalManager.resizeTerminal(dimensions)
}

// Handle sending data to a terminal
export function handleTerminalData({ id, data }: { id: string, data: string }, context: HandlerContext) {
    return context.terminalManager.sendTerminalData(id, data)
}

// Handle closing a terminal
export function handleCloseTerminal({ id }: { id: string }, context: HandlerContext) {
    return context.terminalManager.closeTerminal(id)
}

// Handle generating code
export function handleGenerateCode({ userId, fileName, code, line, instructions }: { userId: string, fileName: string, code: string, line: number, instructions: string }, context: HandlerContext) {
    return context.aiWorker.generateCode(userId, fileName, code, line, instructions)
}