"use client"

import { Loader2, X } from "lucide-react"
import * as React from "react"
import { MouseEventHandler } from "react"
import { Button } from "./button"

export default function Tab({
  children,
  creating = false,
  saved = true,
  selected = false,
  onClick,
  onClose,
  closing = false,
}: {
  children: React.ReactNode
  creating?: boolean
  saved?: boolean
  selected?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  onClose?: () => void
  closing?: boolean
}) {
  const tabRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (selected && tabRef.current) {
      tabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      })
    }
  }, [selected])

  return (
    <Button
      ref={tabRef}
      onClick={onClick ?? undefined}
      size="sm"
      variant={"secondary"}
      className={`font-normal select-none ${
        selected
          ? "bg-muted-foreground/50 hover:bg-muted-foreground/40 text-foreground"
          : "text-muted-foreground"
      }`}
    >
      {children}
      <div
        onClick={
          onClose && !closing
            ? (e) => {
                e.stopPropagation()
                e.preventDefault()
                onClose()
              }
            : undefined
        }
        className="h-5 w-5 ml-0.5 group flex items-center justify-center translate-x-1 transition-colors bg-transparent hover:bg-muted-foreground/25 cursor-pointer rounded-sm"
      >
        {closing || creating ? (
          <Loader2 className="animate-spin w-3 h-3" />
        ) : saved ? (
          <X className="w-3 h-3" />
        ) : (
          <>
            <X className="w-3 h-3 group-hover:block hidden" />
            <div className="w-2 h-2 rounded-full bg-foreground group-hover:hidden" />
          </>
        )}
      </div>
    </Button>
  )
}
