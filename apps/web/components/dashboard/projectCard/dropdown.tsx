"use client"

import { Sandbox } from "@/lib/types"
import { Ellipsis, Globe, Lock, Trash2 } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function ProjectCardDropdown({
  visibility,
  onVisibilityChange,
  onDelete,
}: {
  visibility: Sandbox["visibility"]
  onVisibilityChange: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        className="h-6 w-6 z-10 flex items-center justify-center transition-colors bg-transparent hover:bg-muted-foreground/25 rounded-sm outline-foreground"
      >
        <Ellipsis className="w-4 h-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onVisibilityChange()
          }}
          className="cursor-pointer"
        >
          {visibility === "public" ? (
            <>
              <Lock className="mr-2 h-4 w-4" />
              <span>Make Private</span>
            </>
          ) : (
            <>
              <Globe className="mr-2 h-4 w-4" />
              <span>Make Public</span>
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="!text-destructive cursor-pointer"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete Project</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
