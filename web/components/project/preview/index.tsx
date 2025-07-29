"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditorLayout } from "@/context/EditorLayoutContext"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import {
  AppWindowIcon,
  ArrowDownToLine,
  ArrowRightToLine,
  Columns3CogIcon,
  Link,
  Maximize,
  Minimize,
  RotateCw,
  UnfoldVertical,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
export function PreviewWindow({
  ref,
}: {
  ref: React.Ref<{
    refreshIframe: () => void
  }>
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const [previewMaximized, setPreviewMaximized] = useState(false)
  const refreshIframe = useCallback(() => {
    setIframeKey((prev) => prev + 1)
  }, [])
  const { previewURL: src } = useEditorLayout()

  const togglePreviewMaximize = useCallback(() => {
    if (!src) {
      toast.error("No preview URL available")
      return
    }
    setPreviewMaximized((prev) => !prev)
  }, [src])

  // Refresh the preview when the URL changes.
  useEffect(refreshIframe, [src])
  useEffect(() => {
    // when escape is pressed, toggle preview maximize state
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewMaximized(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])
  // Expose refreshIframe method to the parent.
  useImperativeHandle(ref, () => ({ refreshIframe }))

  return (
    <>
      <AnimatePresence>
        {previewMaximized && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="fixed inset-0 z-20 bg-background/10"
            transition={{ duration: 0.2 }}
            onClick={togglePreviewMaximize}
          />
        )}
      </AnimatePresence>
      <motion.div
        layout="position"
        className={cn(
          "flex flex-col gap-2 bg-background transition-shadow shadow-[0_0_0_0px_hsl(var(--muted-foreground))]",
          previewMaximized
            ? "fixed inset-4 z-50 rounded-lg shadow-[0_0_0_1px_hsl(var(--muted-foreground)_/_0.4)]"
            : "relative w-full h-full"
        )}
      >
        <PreviewHeader
          {...{
            refreshIframe,
            previewMaximized,
            togglePreviewMaximize,
          }}
        />
        <motion.div
          layout
          className="w-full grow rounded-md overflow-hidden bg-background mt-2"
        >
          {src ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              title="Gitwit Sandbox project preview"
              width="100%"
              height="100%"
              src={src}
              allow="fullscreen; camera; microphone; gyroscope; accelerometer; geolocation; clipboard-write; autoplay"
              loading="eager"
              className="bg-secondary"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="text-sm">No preview available</p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  )
}

PreviewWindow.displayName = "PreviewWindow"

function PreviewHeader({
  refreshIframe,
  previewMaximized,
  togglePreviewMaximize,
}: {
  refreshIframe: () => void
  previewMaximized: boolean
  togglePreviewMaximize: () => void
}) {
  const {
    isHorizontalLayout: isHorizontal,
    isPreviewCollapsed: collapsed,
    previewURL: src,
    togglePreviewPanel: open,
    toggleLayout,
  } = useEditorLayout()

  const copyLink = useCallback(() => {
    if (!src) {
      toast.error("No preview URL available")
      return
    }
    navigator.clipboard
      .writeText(src)
      .then(() => {
        toast.success("Preview link copied to clipboard")
      })
      .catch((err) => {
        console.error("Failed to copy link: ", err)
        toast.error("Failed to copy preview link")
      })
  }, [src])

  const openInNewTab = useCallback(() => {
    if (!src) {
      toast.error("No preview URL available")
      return
    }
    window.open(src, "_blank")
  }, [src])

  return (
    <motion.div
      layout
      className={cn(
        "flex gap-2 items-center justify-between",
        previewMaximized && "px-2 pt-2"
      )}
    >
      <div className="flex gap-2 items-center">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger disabled={previewMaximized} asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="smIcon"
                  variant="outline"
                  className="h-8 w-8 rounded-md"
                >
                  <Columns3CogIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Layout Options</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={toggleLayout}>
              {isHorizontal ? (
                <ArrowRightToLine className="size-4 mr-2 opacity-80" />
              ) : (
                <ArrowDownToLine className="size-4 mr-2 opacity-80" />
              )}
              Toggle Layout
            </DropdownMenuItem>
            <DropdownMenuItem onClick={open}>
              <UnfoldVertical className="size-4 mr-2 opacity-80" />
              {(isHorizontal ? !collapsed : collapsed)
                ? "Expand Preview"
                : "Collapse Preview"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <motion.div
        layout
        className="h-8 rounded-md bg-secondary px-1 flex gap-2 items-center w-full justify-between"
      >
        <PreviewButton label="Reload" onClick={refreshIframe}>
          <RotateCw className="size-3" />
        </PreviewButton>
        <div className="text-xs flex-1">Preview</div>
        <div className="flex gap-1">
          <PreviewButton
            label={previewMaximized ? "Minimize" : "Maximize"}
            onClick={togglePreviewMaximize}
          >
            {previewMaximized ? (
              <Minimize className="size-3" />
            ) : (
              <Maximize className="size-3" />
            )}
          </PreviewButton>
          {previewMaximized ? (
            <PreviewButton label="open in new tab" onClick={openInNewTab}>
              <AppWindowIcon className="size-3" />
            </PreviewButton>
          ) : (
            <PreviewButton label="copy link" onClick={copyLink}>
              <Link className="size-3" />
            </PreviewButton>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function PreviewButton({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={`${
            disabled ? "pointer-events-none opacity-50" : ""
          } p-0.5 size-6  flex items-center justify-center transition-colors bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm`}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}
