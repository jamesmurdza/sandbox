"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useEditorLayout } from "@/context/EditorLayoutContext"
import { cn } from "@/lib/utils"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightToLine,
  ExternalLinkIcon,
  Link,
  Loader2,
  Maximize,
  Minimize,
  RotateCw,
  UnfoldVertical,
} from "lucide-react"
import {
  createContext,
  useCallback,
  useContext,
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
  const { previewURL: src } = useEditorLayout()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const {
    iframeKey,
    isMaximized,
    isLoading,
    hasError,
    refreshIframe,
    toggleMaximize,
    setIsLoading,
    setIsMaximized,
    setHasError,
  } = usePreviewState(src)

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false)
    setHasError(false)
  }, [setIsLoading, setHasError])

  const handleIframeError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
  }, [setIsLoading, setHasError])

  useEffect(() => {
    // when escape is pressed, toggle preview maximize state
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !(event.target as HTMLElement)?.matches(
          "input, textarea, [contenteditable]"
        )
      ) {
        setIsMaximized(false)
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
    <PreviewContext.Provider value={{ isMaximized, toggleMaximize }}>
      <LayoutGroup>
        <AnimatePresence>
          {isMaximized && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              className="fixed inset-0 z-20 bg-background/10"
              transition={{ duration: 0.3 }}
              onClick={toggleMaximize}
            />
          )}
        </AnimatePresence>
        <motion.div
          layout
          layoutDependency={isMaximized}
          className={cn(
            "flex flex-col gap-2 bg-background transition-shadow shadow-[0_0_0_0px_hsl(var(--muted-foreground))]",
            isMaximized
              ? "fixed inset-4 z-50 rounded-lg shadow-[0_0_0_1px_hsl(var(--muted-foreground)_/_0.4)]"
              : "relative w-full h-full"
          )}
        >
          <PreviewHeader
            {...{
              refreshIframe,
            }}
          />
          <motion.div
            layout
            layoutDependency={isMaximized}
            className="w-full grow rounded-md overflow-hidden bg-background mt-2"
          >
            {src ? (
              <>
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
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                />

                {/* Loading overlay */}
                {isLoading && (
                  <div className="h-full flex items-center justify-center bg-secondary">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-sm">Loading preview...</span>
                    </div>
                  </div>
                )}

                {/* Error overlay */}
                {hasError && (
                  <div className="h-full flex items-center justify-center bg-secondary">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="size-8" />
                      <span className="text-sm">Failed to load preview</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={refreshIframe}
                        className="mt-2"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">No preview available</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </LayoutGroup>
    </PreviewContext.Provider>
  )
}

PreviewWindow.displayName = "PreviewWindow"

function PreviewHeader({ refreshIframe }: { refreshIframe: () => void }) {
  const {
    isHorizontalLayout: isHorizontal,
    isPreviewCollapsed: collapsed,
    previewURL: src,
    togglePreviewPanel: open,
    toggleLayout,
  } = useEditorLayout()
  const { isMaximized, toggleMaximize } = usePreviewContext()

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
      layoutDependency={isMaximized}
      className={cn("flex gap-2 items-center", isMaximized && "px-2 pt-2")}
    >
      <div className={cn(isMaximized && "hidden")}>
        <Tooltip>
          <TooltipTrigger disabled={isMaximized} asChild>
            <Button
              size="smIcon"
              variant="outline"
              className="size-8 rounded-md"
              onClick={toggleLayout}
            >
              {isHorizontal ? (
                <ArrowRightToLine className="size-4 opacity-80" />
              ) : (
                <ArrowDownToLine className="size-4 opacity-80" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Toggle Layout</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <motion.div
        layout
        layoutDependency={isMaximized}
        className="h-8 rounded-md bg-secondary px-1 flex gap-2 items-center w-full"
      >
        <PreviewButton label="Reload" onClick={refreshIframe}>
          <RotateCw className="size-3" />
        </PreviewButton>
        <div className="text-xs flex-1">Preview</div>
        <div className="flex gap-1">
          <PreviewButton
            label={isMaximized ? "Minimize" : "Maximize"}
            onClick={toggleMaximize}
          >
            {isMaximized ? (
              <Minimize className="size-3" />
            ) : (
              <Maximize className="size-3" />
            )}
          </PreviewButton>
          {isMaximized ? (
            <PreviewButton label="open in new tab" onClick={openInNewTab}>
              <ExternalLinkIcon className="size-3" />
            </PreviewButton>
          ) : (
            <PreviewButton label="copy link" onClick={copyLink}>
              <Link className="size-3" />
            </PreviewButton>
          )}
        </div>
      </motion.div>
      <div className={cn(isMaximized && "hidden")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="smIcon"
              variant="outline"
              className="size-8 rounded-md"
              onClick={open}
            >
              <UnfoldVertical className="size-4 opacity-80" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {(isHorizontal ? !collapsed : collapsed)
              ? "Expand Preview"
              : "Collapse Preview"}
          </TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  )
}

const usePreviewState = (src: string | undefined) => {
  const [iframeKey, setIframeKey] = useState(() => Date.now())
  const [isMaximized, setIsMaximized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)

  const refreshIframe = useCallback(() => {
    setIframeKey(Date.now())
    setIsLoading(true)
    setHasError(false)
  }, [])

  const toggleMaximize = useCallback(() => {
    if (!src) {
      toast.error("No preview URL available")
      return
    }
    setIsMaximized((prev) => !prev)
  }, [src])

  // Reset states when URL changes
  useEffect(() => {
    if (!src) return
    setIsLoading(true)
    setHasError(false)
    refreshIframe()
  }, [src, refreshIframe])

  return {
    iframeKey,
    isMaximized,
    isLoading,
    hasError,
    refreshIframe,
    toggleMaximize,
    setIsMaximized,
    setIsLoading,
    setHasError,
  }
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
  const { isMaximized } = usePreviewContext()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          layout="position"
          layoutDependency={isMaximized}
          className={cn(
            disabled && "pointer-events-none opacity-50",
            "p-0.5 size-6  flex items-center justify-center transition-colors bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm"
          )}
          onClick={onClick}
        >
          {children}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

const PreviewContext = createContext<{
  isMaximized: boolean
  toggleMaximize: () => void
} | null>(null)

const usePreviewContext = () => {
  const context = useContext(PreviewContext)
  if (!context) {
    throw new Error("usePreviewContext must be used within a PreviewProvider")
  }
  return context
}
