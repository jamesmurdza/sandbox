"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Terminal } from '@xterm/xterm';
import { createId } from '@paralleldrive/cuid2';
import { createTerminal as createTerminalHelper, closeTerminal as closeTerminalHelper } from '@/lib/terminal'; // Adjust the import path as necessary

interface TerminalContextType {
  socket: Socket | null;
  terminals: { id: string; terminal: Terminal | null }[];
  setTerminals: React.Dispatch<React.SetStateAction<{ id: string; terminal: Terminal | null }[]>>;
  activeTerminalId: string;
  setActiveTerminalId: React.Dispatch<React.SetStateAction<string>>;
  creatingTerminal: boolean;
  setCreatingTerminal: React.Dispatch<React.SetStateAction<boolean>>;
  createNewTerminal: () => void;
  closeTerminal: (id: string) => void;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [terminals, setTerminals] = useState<{ id: string; terminal: Terminal | null }[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('');
  const [creatingTerminal, setCreatingTerminal] = useState<boolean>(false);

  useEffect(() => {
    // Replace with your server URL
    const socketIo = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'); 
    setSocket(socketIo);

    // Log socket events
    socketIo.on('connect', () => {
      console.log('Socket connected:', socketIo.id);
    });

    socketIo.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      socketIo.disconnect();
    };
  }, []);

  const createNewTerminal = () => {
    if (socket) {
      createTerminalHelper({
        setTerminals,
        setActiveTerminalId,
        setCreatingTerminal,
        socket,
      });
    }
  };

  const closeTerminal = (id: string) => {
    const terminalToClose = terminals.find(term => term.id === id);
    if (terminalToClose && socket) {
      closeTerminalHelper({
        term: terminalToClose,
        terminals,
        setTerminals,
        setActiveTerminalId,
        setClosingTerminal: () => {}, // Implement if needed
        socket,
        activeTerminalId,
      });
    }
  };

  const value = {
    socket,
    terminals,
    setTerminals,
    activeTerminalId,
    setActiveTerminalId,
    creatingTerminal,
    setCreatingTerminal,
    createNewTerminal,
    closeTerminal,
  };

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = (): TerminalContextType => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
};
