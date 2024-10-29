"use client"

import { Link, RotateCw, UnfoldVertical } from "lucide-react"
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"

export default forwardRef(function PreviewWindow(
  {
    collapsed,
    open,
    src,
  }: {
    collapsed: boolean
    open: () => void
    src: string
  },
  ref: React.Ref<{
    refreshIframe: () => void
  }>
) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const refreshIframe = () => {
    setIframeKey((prev) => prev + 1)
  }
  // Refresh the preview when the URL changes.
  useEffect(refreshIframe, [src])
  // Expose refreshIframe method to the parent.
  useImperativeHandle(ref, () => ({ refreshIframe }))

  return (
    <>
      <div className="h-8 rounded-md px-3 bg-secondary flex items-center w-full justify-between">
        <div className="text-xs">Preview</div>
        <div className="flex space-x-1 translate-x-1">
          {collapsed ? (
            <PreviewButton onClick={open}>
              <UnfoldVertical className="w-4 h-4" />
            </PreviewButton>
          ) : (
            <>
              <PreviewButton onClick={open}>
                <UnfoldVertical className="w-4 h-4" />
              </PreviewButton>

              <PreviewButton
                onClick={() => {
                  navigator.clipboard.writeText(src)
                  toast.info("Copied preview link to clipboard")
                }}
              >
                <Link className="w-4 h-4" />
              </PreviewButton>
              <PreviewButton onClick={refreshIframe}>
                <RotateCw className="w-3 h-3" />
              </PreviewButton>
            </>
          )}
        </div>
      </div>
    </>
  )
})

function PreviewButton({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`${
        disabled ? "pointer-events-none opacity-50" : ""
      } p-0.5 h-5 w-5 ml-0.5 flex items-center justify-center transition-colors bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
