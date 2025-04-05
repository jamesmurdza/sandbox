"use client"
// Custom sidebar component not using Shadcn

import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"
import { AnimatePresence, motion } from "framer-motion"
import * as React from "react"

// #region Context
type SidebarContextType = {
  activeItem: string | null
  setActiveItem: (id: string | null) => void
  registerItem: (id: string) => void
  unregisterItem: (id: string) => void
  items: string[]
}

const SidebarContext = React.createContext<SidebarContextType | undefined>(
  undefined
)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

interface SidebarProviderProps {
  children: React.ReactNode
  defaultActiveItem?: string | null
}

export function SidebarProvider({
  children,
  defaultActiveItem = null,
}: SidebarProviderProps) {
  const [activeItem, setActiveItem] = React.useState<string | null>(
    defaultActiveItem
  )
  const [items, setItems] = React.useState<string[]>([])

  const registerItem = React.useCallback((id: string) => {
    setItems((prev) => {
      if (prev.includes(id)) return prev
      return [...prev, id]
    })
  }, [])

  const unregisterItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item !== id))
  }, [])

  const value = React.useMemo(
    () => ({
      activeItem,
      setActiveItem,
      registerItem,
      unregisterItem,
      items,
    }),
    [activeItem, registerItem, unregisterItem, items]
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}
// #endregion

// #region Button
interface SidebarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  id: string
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | null
    | undefined
  size?: "default" | "sm" | "lg" | "icon" | "smIcon" | null | undefined
}

export const SidebarButton = React.forwardRef<
  HTMLButtonElement,
  SidebarButtonProps
>(
  (
    {
      asChild = false,
      id,
      variant = "ghost",
      size = "smIcon",
      tooltip,
      className,
      onClick,
      children,
      ...props
    },
    ref
  ) => {
    const { activeItem, setActiveItem, registerItem, unregisterItem } =
      useSidebar()
    const isActive = activeItem === id

    React.useEffect(() => {
      registerItem(id)
      return () => unregisterItem(id)
    }, [id, registerItem, unregisterItem])

    const Comp = asChild ? Slot : "button"

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e)
        setActiveItem(isActive ? null : id)
      },
      [onClick, setActiveItem, isActive, id]
    )

    const button = (
      <Comp
        ref={ref}
        data-active={isActive}
        className={cn(
          buttonVariants({ variant: isActive ? "secondary" : variant, size }),
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Comp>
    )

    if (!tooltip) {
      return (
        <div className="relative">
          {isActive && (
            <motion.div
              layoutId="sidebar-indicator"
              className="absolute -left-2 top-0 right-0 w-[2px] h-full bg-primary rounded-full"
            />
          )}
          {button}
        </div>
      )
    }

    const tooltipContent =
      typeof tooltip === "string" ? { children: tooltip } : tooltip

    return (
      <div className="relative">
        {isActive && (
          <motion.div
            layoutId="sidebar-indicator"
            className="absolute -left-2 top-0 right-0 w-[2px] h-full bg-primary rounded-full"
          />
        )}
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" align="center" {...tooltipContent} />
        </Tooltip>
      </div>
    )
  }
)

SidebarButton.displayName = "SidebarButton"
// #endregion

// #region Content
interface SidebarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string
  children: React.ReactNode
}

export function SidebarContent({
  id,
  children,
  className,
  ...props
}: SidebarContentProps) {
  const { activeItem } = useSidebar()
  const isActive = activeItem === id
  const hideSidebar = activeItem === null

  return (
    <div
      className={cn(
        "h-full transition-all duration-300 delay-75",
        hideSidebar ? "w-0" : "w-56",
        !isActive && "hidden",
        className
      )}
      {...props}
    >
      <AnimatePresence initial={false} mode="wait">
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full select-none flex flex-col text-sm"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
// #endregion

// #region Rail
interface SidebarRailProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SidebarRail({
  children,
  className,
  ...props
}: SidebarRailProps) {
  return (
    <div
      className={cn(
        "w-12 flex flex-col items-center gap-3 pt-2 border-r border-secondary",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// #endregion
// #region Sidebar
interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultActiveItem?: string | null
  children: React.ReactNode
}

export function Sidebar({
  defaultActiveItem,
  children,
  className,
  ...props
}: SidebarProps) {
  return (
    <SidebarProvider defaultActiveItem={defaultActiveItem}>
      <TooltipProvider>
        <div className={cn("flex h-full", className)} {...props}>
          {children}
        </div>
      </TooltipProvider>
    </SidebarProvider>
  )
}

// #endregion
