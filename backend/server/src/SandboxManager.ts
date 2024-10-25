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

// Define a type for SocketHandler functions
type SocketHandler<T = Record<string, any>> = (args: T) => any;

// Extract port number from a string
function extractPortNumber(inputString: string): number | null {
    const cleanedString = inputString.replace(/\x1B\[[0-9;]*m/g, "")
    const regex = /http:\/\/localhost:(\d+)/
    const match = cleanedString.match(regex)
    return match ? parseInt(match[1]) : null
}

export class SandboxManager {
    fileManager: FileManager;
    terminalManager: TerminalManager;
    container: any;
    aiWorker: AIWorker;
    dokkuClient: DokkuClient | null;
    gitClient: SecureGitClient | null;
    lockManager: LockManager;
    socket: Socket;

    constructor(fileManager: FileManager, terminalManager: TerminalManager, aiWorker: AIWorker, dokkuClient: DokkuClient | null, gitClient: SecureGitClient | null, lockManager: LockManager, sandboxManager: any, socket: Socket) {
        this.fileManager = fileManager;
        this.terminalManager = terminalManager;
        this.aiWorker = aiWorker;
        this.dokkuClient = dokkuClient;
        this.gitClient = gitClient;
        this.lockManager = lockManager;
        this.socket = socket;
        this.container = sandboxManager;
    }

    handlers() {

        // Handle heartbeat from a socket connection
        const handleHeartbeat: SocketHandler = (_: any) => {
            this.container.setTimeout(CONTAINER_TIMEOUT)
        }

        // Handle getting a file
        const handleGetFile: SocketHandler = ({ fileId }: any) => {
            return this.fileManager.getFile(fileId)
        }

        // Handle getting a folder
        const handleGetFolder: SocketHandler = ({ folderId }: any) => {
            return this.fileManager.getFolder(folderId)
        }

        // Handle saving a file
        const handleSaveFile: SocketHandler = async ({ fileId, body, userId }: any) => {
            await saveFileRL.consume(userId, 1);
            return this.fileManager.saveFile(fileId, body)
        }

        // Handle moving a file
        const handleMoveFile: SocketHandler = ({ fileId, folderId }: any) => {
            return this.fileManager.moveFile(fileId, folderId)
        }

        // Handle listing apps
        const handleListApps: SocketHandler = async (_: any) => {
            if (!this.dokkuClient) throw Error("Failed to retrieve apps list: No Dokku client")
            return { success: true, apps: await this.dokkuClient.listApps() }
        }

        // Handle deploying code
        const handleDeploy: SocketHandler = async ({ sandboxId }: any) => {
            if (!this.gitClient) throw Error("Failed to retrieve apps list: No git client")
            const fixedFilePaths = this.fileManager.sandboxFiles.fileData.map((file) => ({
                ...file,
                id: file.id.split("/").slice(2).join("/"),
            }))
            await this.gitClient.pushFiles(fixedFilePaths, sandboxId)
            return { success: true }
        }

        // Handle creating a file
        const handleCreateFile: SocketHandler = async ({ name, userId }: any) => {
            await createFileRL.consume(userId, 1);
            return { "success": await this.fileManager.createFile(name) }
        }

        // Handle creating a folder
        const handleCreateFolder: SocketHandler = async ({ name, userId }: any) => {
            await createFolderRL.consume(userId, 1);
            return { "success": await this.fileManager.createFolder(name) }
        }

        // Handle renaming a file
        const handleRenameFile: SocketHandler = async ({ fileId, newName, userId }: any) => {
            await renameFileRL.consume(userId, 1)
            return this.fileManager.renameFile(fileId, newName)
        }

        // Handle deleting a file
        const handleDeleteFile: SocketHandler = async ({ fileId, userId }: any) => {
            await deleteFileRL.consume(userId, 1)
            return this.fileManager.deleteFile(fileId)
        }

        // Handle deleting a folder
        const handleDeleteFolder: SocketHandler = ({ folderId }: any) => {
            return this.fileManager.deleteFolder(folderId)
        }

        // Handle creating a terminal session
        const handleCreateTerminal: SocketHandler = async ({ id, sandboxId }: any) => {
            await this.lockManager.acquireLock(sandboxId, async () => {
                await this.terminalManager.createTerminal(id, (responseString: string) => {
                    this.socket.emit("terminalResponse", { id, data: responseString })
                    const port = extractPortNumber(responseString)
                    if (port) {
                        this.socket.emit(
                            "previewURL",
                            "https://" + this.container.getHost(port)
                        )
                    }
                })
            })
        }

        // Handle resizing a terminal
        const handleResizeTerminal: SocketHandler = ({ dimensions }: any) => {
            this.terminalManager.resizeTerminal(dimensions)
        }

        // Handle sending data to a terminal
        const handleTerminalData: SocketHandler = ({ id, data }: any) => {
            return this.terminalManager.sendTerminalData(id, data)
        }

        // Handle closing a terminal
        const handleCloseTerminal: SocketHandler = ({ id }: any) => {
            return this.terminalManager.closeTerminal(id)
        }

        // Handle generating code
        const handleGenerateCode: SocketHandler = ({ userId, fileName, code, line, instructions }: any) => {
            return this.aiWorker.generateCode(userId, fileName, code, line, instructions)
        }

        return {
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

    }

}