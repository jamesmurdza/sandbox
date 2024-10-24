import { AIWorker } from "./AIWorker"
import { CONTAINER_TIMEOUT } from "./constants"
import { DokkuClient } from "./DokkuClient"
import { FileManager } from "./FileManager"
import { SecureGitClient } from "./SecureGitClient"
import { TerminalManager } from "./TerminalManager"
import { LockManager } from "./utils"

// Extract port number from a string
function extractPortNumber(inputString: string): number | null {
    const cleanedString = inputString.replace(/\x1B\[[0-9;]*m/g, "")
    const regex = /http:\/\/localhost:(\d+)/
    const match = cleanedString.match(regex)
    return match ? parseInt(match[1]) : null
}

// Handle heartbeat from a socket connection
export function handleHeartbeat(socket: any, data: any, containers: any) {
    containers[data.sandboxId].setTimeout(CONTAINER_TIMEOUT)
}

// Handle getting a file
export function handleGetFile(fileManager: FileManager, fileId: string) {
    return fileManager.getFile(fileId)
}

// Handle getting a folder
export function handleGetFolder(fileManager: FileManager, folderId: string) {
    return fileManager.getFolder(folderId)
}

// Handle saving a file
export function handleSaveFile(fileManager: FileManager, fileId: string, body: string) {
    return fileManager.saveFile(fileId, body)
}

// Handle moving a file
export function handleMoveFile(fileManager: FileManager, fileId: string, folderId: string) {
    return fileManager.moveFile(fileId, folderId)
}

// Handle listing apps
export async function handleListApps(client: DokkuClient | null) {
    if (!client) throw Error("Failed to retrieve apps list: No Dokku client")
    return { success: true, apps: await client.listApps() }
}

// Handle deploying code
export async function handleDeploy(git: SecureGitClient | null, fileManager: FileManager, sandboxId: string) {
    if (!git) throw Error("Failed to retrieve apps list: No git client")
    const fixedFilePaths = fileManager.sandboxFiles.fileData.map((file) => ({
        ...file,
        id: file.id.split("/").slice(2).join("/"),
    }))
    await git.pushFiles(fixedFilePaths, sandboxId)
    return { success: true }
}

// Handle creating a file
export function handleCreateFile(fileManager: FileManager, name: string) {
    return fileManager.createFile(name)
}

// Handle creating a folder
export function handleCreateFolder(fileManager: FileManager, name: string) {
    return fileManager.createFolder(name)
}

// Handle renaming a file
export function handleRenameFile(fileManager: FileManager, fileId: string, newName: string) {
    return fileManager.renameFile(fileId, newName)
}

// Handle deleting a file
export function handleDeleteFile(fileManager: FileManager, fileId: string) {
    return fileManager.deleteFile(fileId)
}

// Handle deleting a folder
export function handleDeleteFolder(fileManager: FileManager, folderId: string) {
    return fileManager.deleteFolder(folderId)
}

// Handle creating a terminal session
export async function handleCreateTerminal(lockManager: LockManager, terminalManager: TerminalManager, id: string, socket: any, containers: any, data: any) {
    await lockManager.acquireLock(data.sandboxId, async () => {
        await terminalManager.createTerminal(id, (responseString: string) => {
            socket.emit("terminalResponse", { id, data: responseString })
            const port = extractPortNumber(responseString)
            if (port) {
                socket.emit(
                    "previewURL",
                    "https://" + containers[data.sandboxId].getHost(port)
                )
            }
        })
    })
}

// Handle resizing a terminal
export function handleResizeTerminal(terminalManager: TerminalManager, dimensions: { cols: number; rows: number }) {
    terminalManager.resizeTerminal(dimensions)
}

// Handle sending data to a terminal
export function handleTerminalData(terminalManager: TerminalManager, id: string, data: string) {
    return terminalManager.sendTerminalData(id, data)
}

// Handle closing a terminal
export function handleCloseTerminal(terminalManager: TerminalManager, id: string) {
    return terminalManager.closeTerminal(id)
}

// Handle generating code
export function handleGenerateCode(aiWorker: AIWorker, userId: string, fileName: string, code: string, line: number, instructions: string) {
    return aiWorker.generateCode(userId, fileName, code, line, instructions)
}
}