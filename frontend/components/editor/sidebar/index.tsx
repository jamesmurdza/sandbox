import { File, Github } from "@/components/ui/icons"
import {
  Sidebar,
  SidebarButton,
  SidebarContent,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { Sandbox, TFile, TFolder, TTab } from "@/lib/types"
import { FileExplorer } from "./file-explorer"
import { GitHubSync } from "./github-sync"
const sidebarItems = [
  {
    id: "file",
    name: "File Explorer",
    icon: File,
  },
  {
    id: "github",
    name: "Sync to GitHub",
    icon: Github,
  },
]

interface AppSidebarProps {
  sandboxData: Sandbox
  files: (TFile | TFolder)[]
  selectFile: (tab: TTab) => void
  handleRename: (
    id: string,
    newName: string,
    oldName: string,
    type: "file" | "folder"
  ) => boolean
  handleDeleteFile: (file: TFile) => void
  handleDeleteFolder: (folder: TFolder) => void
  setFiles: (files: (TFile | TFolder)[]) => void
  deletingFolderId: string
  toggleAIChat: () => void
  isAIChatOpen: boolean
}

export default function AppSidebar({
  sandboxData,
  files,
  selectFile,
  handleRename,
  handleDeleteFile,
  handleDeleteFolder,
  setFiles,
  deletingFolderId,
  toggleAIChat,
  isAIChatOpen,
}: AppSidebarProps) {
  return (
    <Sidebar defaultActiveItem="file">
      <SidebarRail>
        {sidebarItems.map(({ id, name, icon: Icon }) => (
          <SidebarButton key={id} id={id} tooltip={name}>
            <Icon className="size-5" />
          </SidebarButton>
        ))}
      </SidebarRail>

      <SidebarContent id="file">
        <FileExplorer
          sandboxData={sandboxData}
          files={files}
          selectFile={selectFile}
          handleRename={handleRename}
          handleDeleteFile={handleDeleteFile}
          handleDeleteFolder={handleDeleteFolder}
          setFiles={setFiles}
          deletingFolderId={deletingFolderId}
          toggleAIChat={toggleAIChat}
          isAIChatOpen={isAIChatOpen}
        />
      </SidebarContent>

      <SidebarContent id="github">
        <GitHubSync sandboxId={sandboxData.id} userId={sandboxData.userId} />
      </SidebarContent>
    </Sidebar>
  )
}
