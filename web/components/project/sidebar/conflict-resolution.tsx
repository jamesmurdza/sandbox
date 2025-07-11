"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConflictResolutionProps } from "@/lib/types"
import { Check } from "lucide-react"

export function ConflictResolution({
  conflictFiles,
  fileResolutions,
  onFileResolutionChange,
  onResolve,
  onCancel,
  open,
  pendingPull,
}: ConflictResolutionProps) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {conflictFiles.length} file{conflictFiles.length !== 1 ? "s" : ""}{" "}
            have conflicts. Please resolve each one.
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-8">
            {conflictFiles.map((file, idx) => (
              <div
                key={file.path}
                className="border rounded-lg p-4 bg-muted/40"
              >
                <div className="font-semibold mb-2 text-sm">{file.path}</div>
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Local */}
                  <div
                    className={`flex-1 border rounded p-2 bg-background ${
                      fileResolutions[idx]?.resolutions?.[0]?.resolution ===
                      "local"
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs">Local</span>
                      <Button
                        size="xs"
                        variant={
                          fileResolutions[idx]?.resolutions?.[0]?.resolution ===
                          "local"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => onFileResolutionChange(idx, "local")}
                      >
                        {fileResolutions[idx]?.resolutions?.[0]?.resolution ===
                          "local" && (
                          <Check className="inline mr-1" size={14} />
                        )}
                        Keep Local
                      </Button>
                    </div>
                    <pre className="text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto border bg-muted/10 p-2 rounded">
                      {file.localContent.slice(0, 1000) || (
                        <span className="text-muted-foreground">(empty)</span>
                      )}
                    </pre>
                  </div>
                  {/* Incoming */}
                  <div
                    className={`flex-1 border rounded p-2 bg-background ${
                      fileResolutions[idx]?.resolutions?.[0]?.resolution ===
                      "incoming"
                        ? "ring-2 ring-primary"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-xs">Incoming</span>
                      <Button
                        size="xs"
                        variant={
                          fileResolutions[idx]?.resolutions?.[0]?.resolution ===
                          "incoming"
                            ? "default"
                            : "outline"
                        }
                        onClick={() => onFileResolutionChange(idx, "incoming")}
                      >
                        {fileResolutions[idx]?.resolutions?.[0]?.resolution ===
                          "incoming" && (
                          <Check className="inline mr-1" size={14} />
                        )}
                        Use Incoming
                      </Button>
                    </div>
                    <pre className="text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto border bg-muted/10 p-2 rounded">
                      {file.incomingContent.slice(0, 1000) || (
                        <span className="text-muted-foreground">(empty)</span>
                      )}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-4 border-t bottom-0 bg-background z-10 mt-4">
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={onResolve} disabled={pendingPull}>
            Resolve All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
