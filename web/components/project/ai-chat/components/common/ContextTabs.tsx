import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { TFile, TFolder } from "@/lib/types"
import { FileText, Image as ImageIcon, Plus, X } from "lucide-react"
import { useState } from "react"
import { Button } from "../../../../ui/button"
import { ContextTab, ContextTabsProps } from "../../lib/types"
// Ignore certain folders and files from the file tree
import { cn } from "@/lib/utils"
import { ignoredFiles, ignoredFolders } from "../../lib/ignored-paths"

export default function ContextTabs({
  contextTabs,
  onRemoveTab,
  files = [],
  onAddFile,
}: ContextTabsProps & {
  onAddFile: (file: TFile) => void
}) {
  // State for preview tab
  const [previewTab, setPreviewTab] = useState<ContextTab | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Allow preview for images and code selections from editor
  const togglePreview = (tab: ContextTab) => {
    if (!tab.lineRange && tab.type !== "image") {
      return
    }

    // Toggle preview for images and code selections from editor
    if (previewTab?.id === tab.id) {
      setPreviewTab(null)
    } else {
      setPreviewTab(tab)
    }
  }

  // Remove tab from context when clicking on X
  const handleRemoveTab = (id: string) => {
    if (previewTab?.id === id) {
      setPreviewTab(null)
    }
    onRemoveTab(id)
  }

  // Get all files from the file tree to search for context
  const getAllFiles = (items: (TFile | TFolder)[]): TFile[] => {
    if (!items || !Array.isArray(items)) {
      return []
    }

    return items.reduce((acc: TFile[], item) => {
      // Add file if it's not ignored
      if (item.type === "file") {
        const isIgnored = ignoredFiles.some((pattern: string) => {
          if (pattern.includes("*")) {
            // Handle glob patterns properly
            const regex = new RegExp(pattern.replace(/\*/g, ".*"))
            return regex.test(item.name)
          }
          return item.name === pattern
        })

        if (!isIgnored) {
          acc.push(item)
        }
      } else if (item.type === "folder") {
        // Check if folder should be ignored
        const isIgnoredFolder = ignoredFolders.some(
          (folder: string) => folder === item.name
        )

        if (!isIgnoredFolder && item.children && Array.isArray(item.children)) {
          acc.push(...getAllFiles(item.children))
        }
      }

      return acc
    }, [])
  }

  // Get all files from the file tree to search for context when adding context
  const allFiles = getAllFiles(files)
  const filteredFiles = allFiles.filter((file: TFile) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-1 mb-2 rounded bg-muted-foreground/0 w-fit",
        "border-none"
      )}
    >
      <div className="flex items-center gap-1 overflow-hiddenflex-wrap">
        {/* Add context tab button */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          {/* Add context tab popover */}
          <PopoverContent className="w-64 p-2">
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {filteredFiles.map((file) => (
                <Button
                  key={file.id}
                  variant="ghost"
                  className="w-full justify-start text-sm mb-1"
                  onClick={() => onAddFile(file)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {file.name}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {/* Add context tab button */}
        {contextTabs.length === 0 && (
          <div className="flex items-center gap-1 px-2 rounded">
            <span className="text-sm text-foreground/80">Add Context</span>
          </div>
        )}
        {/* Render context tabs */}
        {contextTabs.map((tab) => (
          <div
            key={tab.id}
            className="flex items-center gap-1 px-2 py-0.5 bg-input rounded text-sm cursor-pointer hover:bg-muted text-foreground"
            onClick={() => togglePreview(tab)}
          >
            {tab.type === "image" && <ImageIcon className="h-3 w-3" />}
            <span>{tab.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              onClick={(e) => {
                e.stopPropagation()
                handleRemoveTab(tab.id)
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Preview Section */}
      {previewTab && (
        <div className="p-2 bg-input rounded-md max-h-[200px] overflow-auto">
          {previewTab.type === "image" ? (
            <img
              src={previewTab.content}
              alt={previewTab.name}
              className="max-w-full h-auto"
            />
          ) : (
            previewTab.lineRange && (
              <>
                <div className="text-xs text-muted-foreground mt-1">
                  Lines {previewTab.lineRange.start}-{previewTab.lineRange.end}
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {previewTab.content}
                </pre>
              </>
            )
          )}
          {/* Render file context tab */}
          {previewTab.type === "file" && (
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {previewTab.content}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
