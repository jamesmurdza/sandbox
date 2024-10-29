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
          <DialogTitle>About this project</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">
          Sandbox is an open-source cloud-based code editing environment with
          custom AI code autocompletion and real-time collaboration.
        </div>
      </DialogContent>
    </Dialog>
  )
}
