"use client"

import { Logo } from "@/components/ui/logo"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import UserButton from "@/components/ui/userButton"
import { Sandbox, User } from "@/lib/types"
import { Pencil } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
// import { Avatars } from "../live/avatars"
import DeployButtonModal from "./deploy"
import DownloadButton from "./downloadButton"
import EditSandboxModal from "./edit"
import RunButtonModal from "./run"
import ShareSandboxModal from "./share"

export default function Navbar({
  userData,
  sandboxData,
  shared,
}: {
  userData: User
  sandboxData: Sandbox
  shared: { id: string; name: string; avatarUrl: string }[]
}) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isShareOpen, setIsShareOpen] = useState(false)

  const isOwner = sandboxData.userId === userData.id

  return (
    <>
      <EditSandboxModal
        open={isEditOpen}
        setOpen={setIsEditOpen}
        data={sandboxData}
      />
      <ShareSandboxModal
        open={isShareOpen}
        setOpen={setIsShareOpen}
        data={sandboxData}
        shared={shared}
      />
      <div className="h-14 shrink-0 px-2 w-full flex items-center justify-between border-b border-border">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard"
            className="ring-offset-2 transition-all ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            <Logo />
          </Link>
          <div className="text-sm font-medium flex items-center">
            {sandboxData.name}
            {isOwner ? (
              <button
                onClick={() => setIsEditOpen(true)}
                className="h-7 w-7 ml-2 flex items-center justify-center bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-md ring-offset-2 transition-all ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
        <RunButtonModal sandboxData={sandboxData} />
        <div className="flex items-center h-full space-x-4">
          {/* <Avatars /> */}

          {isOwner ? (
            <>
              <DeployButtonModal data={sandboxData} userData={userData} />
              {/* <Button variant="outline" onClick={() => setIsShareOpen(true)}>
                <Users className="w-4 h-4 mr-2" />
                Share
              </Button> */}
              <DownloadButton
                name={sandboxData.name}
                projectId={sandboxData.id}
              />
            </>
          ) : null}
          <ThemeSwitcher />
          <UserButton userData={userData} />
        </div>
      </div>
    </>
  )
}
