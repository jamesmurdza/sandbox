import { Plus, X, ChevronDown, ChevronUp, Image as ImageIcon, FileText } from "lucide-react"
import { useState } from "react"
import { Button } from "../../ui/button"
import { TFile, TFolder } from "@/lib/types"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Socket } from "socket.io-client"

interface ContextTab {
  id: string
  type: "file" | "code" | "image"
  name: string
  content: string
  sourceFile?: string
  lineRange?: {
    start: number
    end: number
  }
}

interface ContextTabsProps {
  activeFileName: string
  onAddFile: () => void
  contextTabs: ContextTab[]
  onRemoveTab: (id: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
  files?: (TFile | TFolder)[]
  onFileSelect?: (file: TFile) => void
  socket: Socket | null
}

export default function ContextTabs({
  onAddFile,
  contextTabs,
  onRemoveTab,
  className,
  files = [],
  onFileSelect,
}: ContextTabsProps & { className?: string }) {
  const [previewTab, setPreviewTab] = useState<ContextTab | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const togglePreview = (tab: ContextTab) => {
    if (previewTab?.id === tab.id) {
      setPreviewTab(null)
    } else {
      setPreviewTab(tab)
    }
  }

  const handleRemoveTab = (id: string) => {
    if (previewTab?.id === id) {
      setPreviewTab(null)
    }
    onRemoveTab(id)
  }

  const getAllFiles = (items: (TFile | TFolder)[]): TFile[] => {
    return items.reduce((acc: TFile[], item) => {
      if (item.type === "file") {
        acc.push(item)
      } else {
        acc.push(...getAllFiles(item.children))
      }
      return acc
    }, [])
  }

  const allFiles = getAllFiles(files)
  const filteredFiles = allFiles.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className={`border-none ${className || ''}`}>
      <div className="flex flex-col">
        <div className="flex items-center gap-1 overflow-hidden mb-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-[200px] overflow-y-auto">
                {filteredFiles.map((file) => (
                  <Button
                    key={file.id}
                    variant="ghost"
                    className="w-full justify-start text-sm mb-1"
                    onClick={() => onFileSelect?.(file)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {file.name}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {contextTabs.length === 0 && (
            <div className="flex items-center gap-1 px-2 rounded">
              <span className="text-sm text-muted-foreground">Add Context</span>
            </div>
          )}
          {contextTabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-1 px-2 bg-input rounded text-sm cursor-pointer hover:bg-muted"
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
          <div className="p-2 bg-input rounded-md max-h-[200px] overflow-auto mb-2">
            {previewTab.lineRange && (
              <div className="text-xs text-muted-foreground mt-1">
                Lines {previewTab.lineRange.start}-{previewTab.lineRange.end}
              </div>
            )}
            {previewTab.type === "image" ? (
              <img 
                src={previewTab.content} 
                alt={previewTab.name}
                className="max-w-full h-auto"
              />
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {previewTab.content}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}