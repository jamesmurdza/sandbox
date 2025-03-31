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
