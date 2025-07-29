"use client"

import { useSocket } from "@/context/SocketContext"
import {
  closeTerminal as closeTerminalHelper,
  createTerminal as createTerminalHelper,
} from "@/lib/api/terminal"
import { Terminal } from "@xterm/xterm"
import React, { createContext, useContext, useState } from "react"
import { toast } from "sonner"

interface TerminalContextType {
  terminals: { id: string; terminal: Terminal | null }[]
  setTerminals: React.Dispatch<
    React.SetStateAction<{ id: string; terminal: Terminal | null }[]>
  >
  activeTerminalId: string
  setActiveTerminalId: React.Dispatch<React.SetStateAction<string>>
  creatingTerminal: boolean
  setCreatingTerminal: React.Dispatch<React.SetStateAction<boolean>>
  createNewTerminal: (command?: string) => Promise<void>
  closeTerminal: (id: string) => void
  deploy: (callback: () => void) => void
  getAppExists:
    | ((appName: string) => Promise<{ success: boolean; exists?: boolean }>)
    | null
}

const TerminalContext = createContext<TerminalContextType | undefined>(
  undefined
)

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { socket, isSocketReady } = useSocket()
  const [terminals, setTerminals] = useState<
    { id: string; terminal: Terminal | null }[]
  >([])
  const [activeTerminalId, setActiveTerminalId] = useState<string>("")
  const [creatingTerminal, setCreatingTerminal] = useState<boolean>(false)

  const createNewTerminal = async (command?: string): Promise<void> => {
    if (!socket) return
    setCreatingTerminal(true)
    try {
      createTerminalHelper({
        setTerminals,
        setActiveTerminalId,
        setCreatingTerminal,
        command,
        socket,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create new terminal"
      )
    } finally {
      setCreatingTerminal(false)
    }
  }

  const closeTerminal = (id: string) => {
    if (!socket) return
    const terminalToClose = terminals.find((term) => term.id === id)
    if (terminalToClose) {
      closeTerminalHelper({
        term: terminalToClose,
        terminals,
        setTerminals,
        setActiveTerminalId,
        setClosingTerminal: () => {},
        socket,
        activeTerminalId,
      })
    }
  }

  const deploy = (callback: () => void) => {
    if (!socket) console.error("Couldn't deploy: No socket")
    socket?.emit("deploy", {}, () => {
      callback()
    })
  }

  const getAppExists = async (
    appName: string
  ): Promise<{ success: boolean; exists?: boolean }> => {
    if (!socket) {
      console.error("Couldn't check if app exists: No socket")
      return { success: false }
    }
    const response: { success: boolean; exists?: boolean } = await new Promise(
      (resolve) => socket.emit("getAppExists", { appName }, resolve)
    )
    return response
  }

  const value = {
    terminals,
    setTerminals,
    activeTerminalId,
    setActiveTerminalId,
    creatingTerminal,
    setCreatingTerminal,
    createNewTerminal,
    closeTerminal,
    deploy,
    getAppExists: isSocketReady ? getAppExists : null,
  }

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  )
}

export const useTerminal = (): TerminalContextType => {
  const context = useContext(TerminalContext)
  if (!context) {
    throw new Error("useTerminal must be used within a TerminalProvider")
  }
  return context
}
