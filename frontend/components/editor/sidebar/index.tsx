import { File, Github } from "@/components/ui/icons"
import {
  Sidebar,
  SidebarButton,
  SidebarContent,
  SidebarRail,
} from "@/components/ui/sidebar"
import type { Sandbox } from "@/lib/types"
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
}

export default function AppSidebar({ sandboxData }: AppSidebarProps) {
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
        <FileExplorer sandboxData={sandboxData} />
      </SidebarContent>

      <SidebarContent id="github">
        <GitHubSync sandboxId={sandboxData.id} userId={sandboxData.userId} />
      </SidebarContent>
    </Sidebar>
  )
}
