import { File, Github } from "@/components/ui/icons"
import {
  Sidebar,
  SidebarButton,
  SidebarContent,
  SidebarRail,
} from "@/components/ui/sidebar"
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
  userId: string
}

export default function AppSidebar({ userId }: AppSidebarProps) {
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
        <FileExplorer />
      </SidebarContent>

      <SidebarContent id="github">
        <GitHubSync userId={userId} />
      </SidebarContent>
    </Sidebar>
  )
}
