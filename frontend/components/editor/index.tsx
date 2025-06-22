"use client"

import { useEditorShortcuts } from "@/components/editor/hooks/useEditorShortcuts"
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
      {/* Sidebar */}
      <Sidebar userId={sandboxData.userId} />
      {/* Main Editor Layout */}
      <EditorLayout
        isOwner={isOwner}
        projectName={sandboxData.name}
        projectType={sandboxData.type}
      />
    </div>
  )
}
