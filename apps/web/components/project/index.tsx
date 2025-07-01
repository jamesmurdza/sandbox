"use client"

import { useEditorShortcuts } from "@/components/project/hooks/useEditorShortcuts"
import { Sandbox, User } from "@/lib/types"
import ChangesAlert from "./alerts/changes-alert"
import ProjectLayout from "./project-layout"
import Sidebar from "./sidebar"

export default function Project({
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
      {/* Main Project Layout */}
      <ProjectLayout
        isOwner={isOwner}
        projectName={sandboxData.name}
        projectType={sandboxData.type}
      />
    </div>
  )
}
