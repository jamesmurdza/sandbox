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
export type AlertState = null | { type: "tab"; id: string }

export default function ChangesAlert({
  state,
  setState,
  onAccept,
}: {
  state: AlertState
  setState: (state: AlertState) => void
  onAccept: () => void
}) {
  return (
    <AlertDialog
      open={!!state}
      onOpenChange={(open) => (open ? null : setState(null))}
    >
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
              setState(null)
            }}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onAccept()
              setState(null)
            }}
          >
            Okay
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
