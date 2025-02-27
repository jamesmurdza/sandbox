import { type ClassValue, clsx } from "clsx"
// import { toast } from "sonner"
import { twMerge } from "tailwind-merge"
import fileExtToLang from "./file-extension-to-language.json"
import { KnownPlatform, TFile, TFolder, UserLink } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function processFileType(file: string) {
  const extension = file.split(".").pop()
  const fileExtToLangMap = fileExtToLang as Record<string, string>
  if (extension && fileExtToLangMap[extension]) {
    return fileExtToLangMap[extension]
  }

  return "plaintext"
}

export function validateName(
  newName: string,
  oldName: string,
  type: "file" | "folder"
) {
  if (newName === oldName || newName.length === 0) {
    return { status: false, message: "" }
  }
  if (
    newName.includes("/") ||
    newName.includes("\\") ||
    newName.includes(" ") ||
    (type === "file" && !newName.includes(".")) ||
    (type === "folder" && newName.includes("."))
  ) {
    return { status: false, message: "Invalid file name." }
  }
  return { status: true, message: "" }
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T {
  let timeout: NodeJS.Timeout | null = null
  return function (...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  } as T
}

// Deep merge utility function
export const deepMerge = (target: any, source: any) => {
  const output = { ...target }
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          output[key] = deepMerge(target[key], source[key])
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    })
  }
  return output
}

const isObject = (item: any) => {
  return item && typeof item === "object" && !Array.isArray(item)
}

export function sortFileExplorer(
  items: (TFile | TFolder)[]
): (TFile | TFolder)[] {
  return items
    .sort((a, b) => {
      // First, sort by type (folders before files)
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1
      }

      // Then, sort alphabetically by name
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    })
    .map((item) => {
      // If it's a folder, recursively sort its children
      if (item.type === "folder") {
        return {
          ...item,
          children: sortFileExplorer(item.children),
        }
      }
      return item
    })
}

export function parseSocialLink(url: string): UserLink {
  try {
    // Handle empty or invalid URLs
    if (!url) return { url: "", platform: "generic" }

    // Add https:// if no protocol is specified
    const urlWithProtocol =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`

    // Remove protocol and www prefix for consistent parsing
    const cleanUrl = urlWithProtocol
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0] // Get just the domain part

    // Platform detection mapping
    const platformPatterns: Record<
      Exclude<KnownPlatform, "generic">,
      RegExp
    > = {
      github: /github\.com/,
      twitter: /(?:twitter\.com|x\.com|t\.co)/,
      instagram: /instagram\.com/,
      bluesky: /(?:bsky\.app|bluesky\.social)/,
      linkedin: /linkedin\.com/,
      youtube: /(?:youtube\.com|youtu\.be)/,
      twitch: /twitch\.tv/,
      discord: /discord\.(?:gg|com)/,
      mastodon: /mastodon\.(?:social|online|world)/,
      threads: /threads\.net/,
      gitlab: /gitlab\.com/,
    }

    // Check URL against each pattern
    for (const [platform, pattern] of Object.entries(platformPatterns)) {
      if (pattern.test(cleanUrl)) {
        return {
          url: urlWithProtocol,
          platform: platform as KnownPlatform,
        }
      }
    }

    // Fall back to generic if no match found
    return {
      url: urlWithProtocol,
      platform: "generic",
    }
  } catch (error) {
    console.error("Error parsing social link:", error)
    return {
      url: url || "",
      platform: "generic",
    }
  }
}



type PopupOptions = {
  onUrlChange?: (newUrl: string) => void
  onClose?: () => void
  width?: number
  height?: number
}

export const createPopupTracker = () => {
  let popup: Window | null = null
  let observer: MutationObserver | null = null

  const setupUrlChangeDetection = (onUrlChange?: (newUrl: string) => void) => {
    if (!popup) return

    try {
      observer = new MutationObserver(() => {
        onUrlChange?.(popup?.location.href || "")
      })

      observer.observe(popup.document, {
        subtree: true,
        childList: true,
        attributes: true,
      })

      popup.addEventListener("beforeunload", () => {
        setTimeout(() => {
          onUrlChange?.(popup?.location.href || "")
        }, 0)
      })
    } catch (error) {
      if (error instanceof DOMException) {
        console.warn("Cannot access popup URL due to same-origin policy")
      } else {
        console.error("Error setting up URL tracking:", error)
      }
    }
  }

  const setupCloseDetection = (onClose?: () => void) => {
    if (!popup || !onClose) return

    // Method 1: Listen for the unload event on the popup
    popup.addEventListener("unload", () => {
      // Small delay to ensure we're not triggering during page navigation
      setTimeout(() => {
        if (!popup || popup.closed) {
          onClose()
          cleanup()
        }
      }, 50)
    })

    // Method 2: Listen for blur on the parent window
    window.addEventListener("blur", function checkPopup() {
      // If parent window loses focus and popup is closed, it was closed by user
      if (!popup || popup.closed) {
        window.removeEventListener("blur", checkPopup)
        onClose()
        cleanup()
      }
    })
  }

  const cleanup = () => {
    observer?.disconnect()
    observer = null
    popup = null
  }

  const openPopup = (url: string, options: PopupOptions = {}) => {
    const { width = 800, height = 600, onUrlChange, onClose } = options

    const left = (window.screen.width - width) / 2
    const top = (window.screen.height - height) / 2

    popup = window.open(
      url,
      "PopupWindow",
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=no`
    )

    if (popup) {
      // Handle popup blockers
      if (popup.closed || typeof popup.closed === "undefined") {
        return false
      }

      popup.addEventListener(
        "load",
        () => {
          setupUrlChangeDetection(onUrlChange)
        },
        { once: true }
      )

      setupCloseDetection(onClose)

      return true
    }

    return false
  }

  const closePopup = () => {
    if (popup && !popup.closed) {
      popup.close()
    }
    cleanup()
  }

  const isOpen = () => popup !== null && !popup.closed

  return {
    openPopup,
    closePopup,
    isOpen,
  }
}
