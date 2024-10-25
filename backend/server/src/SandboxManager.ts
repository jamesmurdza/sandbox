import { Sandbox } from "e2b"
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
import { TFile, TFolder } from "./types"
import { LockManager } from "./utils"

const lockManager = new LockManager()

// Define a type for SocketHandler functions
type SocketHandler<T = Record<string, any>> = (args: T) => any;

// Extract port number from a string
function extractPortNumber(inputString: string): number | null {
    const cleanedString = inputString.replace(/\x1B\[[0-9;]*m/g, "")
    const regex = /http:\/\/localhost:(\d+)/
    const match = cleanedString.match(regex)
    return match ? parseInt(match[1]) : null
}

type SandboxManagerContext = {
    aiWorker: AIWorker;
    dokkuClient: DokkuClient | null;
    gitClient: SecureGitClient | null;
    socket: Socket;
};

export class SandboxManager {
    fileManager: FileManager | null;
    terminalManager: TerminalManager | null;
    container: Sandbox | null;
    dokkuClient: DokkuClient | null;
    gitClient: SecureGitClient | null;
    aiWorker: AIWorker;
    socket: Socket;
    sandboxId: string;
    userId: string;

    constructor(sandboxId: string, userId: string, { aiWorker, dokkuClient, gitClient, socket }: SandboxManagerContext) {
        this.fileManager = null;
        this.terminalManager = null;
        this.container = null;
        this.sandboxId = sandboxId;
        this.userId = userId;
        this.aiWorker = aiWorker;
        this.dokkuClient = dokkuClient;
        this.gitClient = gitClient;
        this.socket = socket;
    }

    async initializeContainer() {

        await lockManager.acquireLock(this.sandboxId, async () => {
            if (this.container && await this.container.isRunning()) {
                console.log(`Found existing container ${this.sandboxId}`)
            } else {
                console.log("Creating container", this.sandboxId)
                this.container = await Sandbox.create({
                    timeoutMs: CONTAINER_TIMEOUT,
                })
            }
        })
        if (!this.container) throw new Error("Failed to create container")

        if (!this.terminalManager) {
            this.terminalManager = new TerminalManager(this.container)
            console.log(`Terminal manager set up for ${this.sandboxId}`)
        }

        if (!this.fileManager) {
            this.fileManager = new FileManager(
                this.sandboxId,
                this.container,
                (files: (TFolder | TFile)[]) => {
                    this.socket.emit("loaded", files)
                }
            )
            this.fileManager.initialize()
            this.socket.emit("loaded", this.fileManager.files)
        }
    }

    async disconnect() {
        await this.terminalManager?.closeAllTerminals()
        await this.fileManager?.closeWatchers()
    }

    handlers() {

        // Handle heartbeat from a socket connection
        const handleHeartbeat: SocketHandler = (_: any) => {
            this.container?.setTimeout(CONTAINER_TIMEOUT)
        }

        // Handle getting a file
        const handleGetFile: SocketHandler = ({ fileId }: any) => {
            return this.fileManager?.getFile(fileId)
        }

        // Handle getting a folder
        const handleGetFolder: SocketHandler = ({ folderId }: any) => {
            return this.fileManager?.getFolder(folderId)
        }

        // Handle saving a file
        const handleSaveFile: SocketHandler = async ({ fileId, body }: any) => {
            await saveFileRL.consume(this.userId, 1);
            return this.fileManager?.saveFile(fileId, body)
        }

        // Handle moving a file
        const handleMoveFile: SocketHandler = ({ fileId, folderId }: any) => {
            return this.fileManager?.moveFile(fileId, folderId)
        }

        // Handle listing apps
        const handleListApps: SocketHandler = async (_: any) => {
            if (!this.dokkuClient) throw Error("Failed to retrieve apps list: No Dokku client")
            return { success: true, apps: await this.dokkuClient.listApps() }
        }

        // Handle deploying code
        const handleDeploy: SocketHandler = async (_: any) => {
            if (!this.gitClient) throw Error("No git client")
            if (!this.fileManager) throw Error("No file manager")
            const fixedFilePaths = this.fileManager?.fileData.map((file) => ({
                ...file,
                id: file.id.split("/").slice(2).join("/"),
            }))
            await this.gitClient.pushFiles(fixedFilePaths, this.sandboxId)
            return { success: true }
        }

        // Handle creating a file
        const handleCreateFile: SocketHandler = async ({ name }: any) => {
            await createFileRL.consume(this.userId, 1);
            return { "success": await this.fileManager?.createFile(name) }
        }

        // Handle creating a folder
        const handleCreateFolder: SocketHandler = async ({ name }: any) => {
            await createFolderRL.consume(this.userId, 1);
            return { "success": await this.fileManager?.createFolder(name) }
        }

        // Handle renaming a file
        const handleRenameFile: SocketHandler = async ({ fileId, newName }: any) => {
            await renameFileRL.consume(this.userId, 1)
            return this.fileManager?.renameFile(fileId, newName)
        }

        // Handle deleting a file
        const handleDeleteFile: SocketHandler = async ({ fileId }: any) => {
            await deleteFileRL.consume(this.userId, 1)
            return this.fileManager?.deleteFile(fileId)
        }

        // Handle deleting a folder
        const handleDeleteFolder: SocketHandler = ({ folderId }: any) => {
            return this.fileManager?.deleteFolder(folderId)
        }

        // Handle creating a terminal session
        const handleCreateTerminal: SocketHandler = async ({ id }: any) => {
            await lockManager.acquireLock(this.sandboxId, async () => {
                await this.terminalManager?.createTerminal(id, (responseString: string) => {
                    this.socket.emit("terminalResponse", { id, data: responseString })
                    const port = extractPortNumber(responseString)
                    if (port) {
                        this.socket.emit(
                            "previewURL",
                            "https://" + this.container?.getHost(port)
                        )
                    }
                })
            })
        }

        // Handle resizing a terminal
        const handleResizeTerminal: SocketHandler = ({ dimensions }: any) => {
            this.terminalManager?.resizeTerminal(dimensions)
        }

        // Handle sending data to a terminal
        const handleTerminalData: SocketHandler = ({ id, data }: any) => {
            return this.terminalManager?.sendTerminalData(id, data)
        }

        // Handle closing a terminal
        const handleCloseTerminal: SocketHandler = ({ id }: any) => {
            return this.terminalManager?.closeTerminal(id)
        }

        // Handle generating code
        const handleGenerateCode: SocketHandler = ({ fileName, code, line, instructions }: any) => {
            return this.aiWorker.generateCode(this.userId, fileName, code, line, instructions)
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