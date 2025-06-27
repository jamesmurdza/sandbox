import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fileRouter } from "@/lib/api"
import { X } from "lucide-react"
import { useParams } from "next/navigation"
import * as React from "react"
import { Button } from "../../ui/button"

export function SessionTimeoutDialog({ isOwner }: { isOwner: boolean }) {
  const { id: projectId } = useParams<{ id: string }>()
  const [timeoutDialog, setTimeoutDialog] = React.useState(false)
  const { isError } = fileRouter.heartbeat.useQuery({
    variables: {
      isOwner,
      projectId,
    },
  })

  if (isError && !timeoutDialog) {
    setTimeoutDialog(true)
  }
  return (
    <Dialog open={timeoutDialog} onOpenChange={setTimeoutDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <X className="h-5 w-5 text-destructive" />
            Session Timeout
          </DialogTitle>
          <DialogDescription className="pt-2">
            Your project session has timed out. Please refresh the page to
            continue working.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button variant="default" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
