"use client"

import { useEditorShortcuts } from "@/components/editor/hooks/useEditorShortcuts"
import { PreviewProvider } from "@/context/PreviewContext"
import { Sandbox, User } from "@/lib/types"
import ChangesAlert from "./changes-alert"
import EditorLayout from "./EditorLayout"
import Sidebar from "./sidebar"

export default function CodeEditor({
  userData,
  sandboxData,
}: {
  userData: User
  sandboxData: Sandbox
}) {
  const isOwner = sandboxData.userId === userData.id

  // Keyboard shortcuts and browser events
  useEditorShortcuts()

  return (
    <div className="flex max-h-full overflow-hidden">
      <ChangesAlert />
      <PreviewProvider>
        {/* Sidebar */}
        <Sidebar
          sandboxData={sandboxData}
          toggleAIChat={() => {}}
          isAIChatOpen={false}
        />

        {/* Main Editor Layout */}
        <EditorLayout isOwner={isOwner} sandboxData={sandboxData} />
      </PreviewProvider>
    </div>
  )
}
