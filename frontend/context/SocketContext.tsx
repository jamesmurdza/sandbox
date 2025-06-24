"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"

interface SocketContextType {
  socket: Socket | null
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export const SocketProvider: React.FC<{
  children: React.ReactNode
  token: string | null
  userId: string
  sandboxId: string
}> = ({ children, token, userId, sandboxId }) => {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    console.log("Initializing socket connection...")
    const newSocket = io(
      `${process.env.NEXT_PUBLIC_SERVER_URL}?userId=${userId}&sandboxId=${sandboxId}`,
      {
        auth: {
          token,
          sandboxId,
        },
      }
    )
    console.log("Socket instance:", newSocket)
    setSocket(newSocket)

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id)
    })

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected")
    })

    return () => {
      console.log("Disconnecting socket...")
      newSocket.disconnect()
    }
  }, [])

  const value = {
    socket,
  }

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  )
}

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider")
  }
  return context
}
