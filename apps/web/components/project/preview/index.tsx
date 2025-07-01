"use client"

import { Button } from "@/components/ui/button"
import {
  ArrowDownToLine,
  ArrowRightToLine,
  Link,
  RotateCw,
  UnfoldVertical,
} from "lucide-react"
import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { toast } from "sonner"

export default forwardRef(function PreviewWindow(
  {
    collapsed,
    open,
    src,
    isHorizontal,
    toggleLayout,
    isAIChatOpen,
  }: {
    collapsed: boolean
    open: () => void
    src: string
    isHorizontal: boolean
    toggleLayout: () => void
    isAIChatOpen: boolean
  },
  ref: React.Ref<{
    refreshIframe: () => void
  }>
) {
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
      <div className="flex items-center justify-between">
        <Button
          onClick={toggleLayout}
          size="sm"
          variant="ghost"
          className="mr-2 border"
          disabled={isAIChatOpen}
        >
          {isHorizontal ? (
            <ArrowRightToLine className="w-4 h-4" />
          ) : (
            <ArrowDownToLine className="w-4 h-4" />
          )}
        </Button>
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
      </div>
      <div className="w-full grow rounded-md overflow-hidden bg-background mt-2">
        {src ? (
          <iframe key={iframeKey} width="100%" height="100%" src={src} />
        ) : null}
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
