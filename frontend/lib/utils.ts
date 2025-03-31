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
  title?: string
  pollInterval?: number
}

export const createPopupTracker = () => {
  let popup: Window | null = null
  let observer: MutationObserver | null = null
  let pollTimer: number | null = null
  let lastUrl = ''
  
  // Enhanced URL change detection that combines multiple approaches
  const setupUrlChangeDetection = (onUrlChange?: (newUrl: string) => void, pollInterval = 100) => {
    if (!popup || !onUrlChange) return
    
    // Method 1: Try using MutationObserver (may fail due to CORS)
    try {
      observer = new MutationObserver(() => {
        try {
          const currentUrl = popup?.location.href
          if (currentUrl && currentUrl !== lastUrl) {
            lastUrl = currentUrl
            onUrlChange(currentUrl)
          }
        } catch (e) {
          // Likely CORS error, handle silently as we have polling as backup
        }
      })
      
      observer.observe(popup.document, {
        subtree: true,
        childList: true,
        attributes: true,
      })
    } catch (error) {
      // Fallback to polling if MutationObserver fails
      console.warn("Unable to observe popup DOM changes, falling back to polling")
    }
    
    // Method 2: Use polling as a more reliable fallback
    // This works even when same-origin policy prevents direct access
    pollTimer = window.setInterval(() => {
      try {
        const currentUrl = popup?.location.href
        if (currentUrl && currentUrl !== lastUrl) {
          lastUrl = currentUrl
          onUrlChange(currentUrl)
        }
      } catch (e) {
        // CORS error when trying to access location - this is expected
        // When the popup navigates to a different origin
      }
    }, pollInterval) as unknown as number
    
    // Method 3: Listen for navigation events if possible
    try {
      popup.addEventListener("beforeunload", () => {
        setTimeout(() => {
          try {
            const currentUrl = popup?.location.href
            if (currentUrl) {
              onUrlChange(currentUrl)
            }
          } catch (e) {
            // Handle CORS error silently
          }
        }, 0)
      })
    } catch (error) {
      // Ignore if we can't attach event listener due to CORS
    }
  }
  
  const setupCloseDetection = (onClose?: () => void) => {
    if (!popup || !onClose) return
    
    // Create an interval that checks if the popup is closed
    const closeCheckInterval = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(closeCheckInterval)
        onClose()
        cleanup()
      }
    }, 300)
    
    // Also listen for the unload event
    try {
      popup.addEventListener("unload", () => {
        // Small delay to ensure we're not triggering during page navigation
        setTimeout(() => {
          if (!popup || popup.closed) {
            onClose()
            cleanup()
          }
        }, 50)
      })
    } catch (error) {
      // Ignore CORS errors, we have the interval as backup
    }
    
    // Listen for blur on the parent window
    const checkPopup = () => {
      // If parent window loses focus and popup is closed, it was closed by user
      if (!popup || popup.closed) {
        window.removeEventListener("blur", checkPopup)
        onClose()
        cleanup()
      }
    }
    
    window.addEventListener("blur", checkPopup)
    
    // Clean up the interval when popup is explicitly closed
    return closeCheckInterval
  }
  
  const cleanup = () => {
    observer?.disconnect()
    observer = null
    
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    
    popup = null
  }
  
  const openPopup = (url: string, options: PopupOptions = {}) => {
    const { 
      width = 800, 
      height = 600, 
      onUrlChange, 
      onClose, 
      title = "Authentication", 
      pollInterval = 100 
    } = options
    
    // Close any existing popup before opening a new one
    closePopup()
    
    // Calculate center position for the popup
    const left = Math.max(0, (window.screen.width - width) / 2)
    const top = Math.max(0, (window.screen.height - height) / 2)
    
    // Try to open the popup with more robust features
    popup = window.open(
      url,
      title,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes,location=yes`
    )
    
    // Handle popup blockers
    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      console.error("Popup blocked! Please allow popups for this website.")
      return false
    }
    
    // Store initial URL
    try {
      lastUrl = popup.location.href
    } catch (e) {
      // Handle CORS error silently
      lastUrl = url
    }
    
    // Setup URL change detection after the page loads
    popup.addEventListener(
      "load",
      () => {
        setupUrlChangeDetection(onUrlChange, pollInterval)
      },
      { once: true }
    )
    
    // Setup close detection
    setupCloseDetection(onClose)
    
    // Focus the popup
    popup.focus()
    
    return true
  }
  
  const closePopup = () => {
    if (popup && !popup.closed) {
      popup.close()
    }
    cleanup()
  }
  
  const isOpen = () => popup !== null && !popup.closed
  
  const getPopupWindow = () => popup
  
  return {
    openPopup,
    closePopup,
    isOpen,
    getPopupWindow
  }
}