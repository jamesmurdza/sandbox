"use client"

import { Button } from "@/components/ui/button"
import { useEditorLayout } from "@/context/EditorLayoutContext"
import { useTerminal } from "@/context/TerminalContext"
import { Sandbox } from "@/lib/types"
import { templateConfigs } from "@gitwit/templates"
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
  const { setIsPreviewCollapsed, previewPanelRef } = useEditorLayout()
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
  const handleRun = async () => {
    if (isRunning && lastCreatedTerminalRef.current) {
      await closeTerminal(lastCreatedTerminalRef.current)
      lastCreatedTerminalRef.current = null
      setIsPreviewCollapsed(true)
      previewPanelRef.current?.collapse()
    } else if (!isRunning && terminals.length < 4) {
      const command =
        templateConfigs[sandboxData.type]?.runCommand || "npm run dev"

      try {
        // Create a new terminal with the appropriate command
        await createNewTerminal(command)
        setIsPreviewCollapsed(false)
        previewPanelRef.current?.expand()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to create new terminal"
        )
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
