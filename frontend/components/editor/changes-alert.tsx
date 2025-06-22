import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAppStore } from "@/store/context"
export type AlertState = null | { type: "tab"; id: string }

export default function ChangesAlert() {
  const state = useAppStore((s) => s.unsavedAlert)
  const setState = useAppStore((s) => s.setUnsavedAlert)
  const onAccept = useAppStore((s) => s.removeTab)
  const toBeRemovedTab = useAppStore((s) => s.toBeRemovedTab)
  return (
    <AlertDialog open={state} onOpenChange={setState}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes in this tab. Do you want to close it
            anyway?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              setState(false)
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (toBeRemovedTab) {
                onAccept(toBeRemovedTab, true)
              }
            }}
          >
            Okay
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
