"use client"

import { Button } from "@/components/ui/button"
import { usePreview } from "@/context/PreviewContext"
import { useTerminal } from "@/context/TerminalContext"
import { Sandbox } from "@/lib/types"
import { Play, StopCircle } from "lucide-react"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

export default function RunButtonModal({
  isRunning,
  setIsRunning,
  sandboxData,
}: {
  isRunning: boolean
  setIsRunning: (running: boolean) => void
  sandboxData: Sandbox
}) {
  const { createNewTerminal, closeTerminal, terminals } = useTerminal()
  const { setIsPreviewCollapsed, previewPanelRef } = usePreview()
  // Ref to keep track of the last created terminal's ID
  const lastCreatedTerminalRef = useRef<string | null>(null)

  // Effect to update the lastCreatedTerminalRef when a new terminal is added
  useEffect(() => {
    if (terminals.length > 0 && !isRunning) {
      const latestTerminal = terminals[terminals.length - 1]
      if (
        latestTerminal &&
        latestTerminal.id !== lastCreatedTerminalRef.current
      ) {
        lastCreatedTerminalRef.current = latestTerminal.id
      }
    }
  }, [terminals, isRunning])
  // commands to run in the terminal
  const COMMANDS = {
    streamlit: "./venv/bin/streamlit run main.py --server.runOnSave true",
    php: "echo http://localhost:80 && npx vite",
    default: "npm run dev",
  } as const
  const handleRun = async () => {
    if (isRunning && lastCreatedTerminalRef.current) {
      await closeTerminal(lastCreatedTerminalRef.current)
      lastCreatedTerminalRef.current = null
      setIsPreviewCollapsed(true)
      previewPanelRef.current?.collapse()
    } else if (!isRunning && terminals.length < 4) {
      const command =
        COMMANDS[sandboxData.type as keyof typeof COMMANDS] ?? COMMANDS.default

      try {
        // Create a new terminal with the appropriate command
        await createNewTerminal(command)
        setIsPreviewCollapsed(false)
        previewPanelRef.current?.expand()
      } catch (error) {
        toast.error("Failed to create new terminal.")
        console.error("Error creating new terminal:", error)
        return
      }
    } else if (!isRunning) {
      toast.error("You've reached the maximum number of terminals.")
      return
    }

    setIsRunning(!isRunning)
  }

  return (
    <Button variant="outline" onClick={handleRun}>
      {isRunning ? (
        <StopCircle className="w-4 h-4 mr-2" />
      ) : (
        <Play className="w-4 h-4 mr-2" />
      )}
      {isRunning ? "Stop" : "Run"}
    </Button>
  )
}
