"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AboutModal({
  open,
  setOpen,
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Help & Support</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* <div className="text-sm text-muted-foreground">
            Sandbox is an open-source cloud-based code editing environment with
            custom AI code autocompletion and real-time collaboration.
          </div> */}
          <div className="text-sm text-muted-foreground">
            Get help and support through our Discord community or by creating issues on GitHub:
          </div>
          <div className="space-y-2">
            <div className="text-sm">
              <a 
                href="https://discord.gitwit.dev/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Join our Discord community →
              </a>
            </div>
            <div className="text-sm">
              <a 
                href="https://github.com/jamesmurdza/sandbox/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Report issues on GitHub →
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
