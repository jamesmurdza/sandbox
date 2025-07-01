import React from "react"
import { ContextTab } from "./types"

/**
 * Chat Utilities
 * Combined utilities for chat functionality
 */

// ============= String & Content Utilities =============

/**
 * Convert any content to a string representation
 * Handles React elements, objects, arrays, and circular references
 */
export const stringifyContent = (
  content: any,
  seen = new WeakSet()
): string => {
  // Handle primitive types
  if (typeof content === "string") return content
  if (content == null) return String(content)
  if (typeof content === "number" || typeof content === "boolean") {
    return content.toString()
  }
  if (typeof content === "function") return content.toString()
  if (typeof content === "symbol") return content.toString()
  if (typeof content === "bigint") return content.toString() + "n"

  // Handle React elements
  if (React.isValidElement(content)) {
    return React.Children.toArray(
      (content as React.ReactElement).props.children
    )
      .map((child) => stringifyContent(child, seen))
      .join("")
  }

  // Handle arrays
  if (Array.isArray(content)) {
    return (
      "[" + content.map((item) => stringifyContent(item, seen)).join(", ") + "]"
    )
  }

  // Handle objects
  if (typeof content === "object") {
    if (seen.has(content)) return "[Circular]"
    seen.add(content)
    try {
      const pairs = Object.entries(content).map(
        ([key, value]) => `${key}: ${stringifyContent(value, seen)}`
      )
      return "{" + pairs.join(", ") + "}"
    } catch (error) {
      return Object.prototype.toString.call(content)
    }
  }

  return String(content)
}

// ============= Clipboard Utilities =============

/**
 * Copy text to clipboard with feedback
 */
export const copyToClipboard = async (
  text: string,
  setCopiedText: (text: string | null) => void
) => {
  try {
    await navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 2000)
  } catch (error) {
    console.error("Failed to copy:", error)
  }
}

// ============= Code Detection Utilities =============

/**
 * Check if text looks like code based on common patterns
 */
export const looksLikeCode = (text: string): boolean => {
  const codeIndicators = [
    /^import\s+/m, // import statements
    /^function\s+/m, // function declarations
    /^class\s+/m, // class declarations
    /^const\s+/m, // const declarations
    /^let\s+/m, // let declarations
    /^var\s+/m, // var declarations
    /[{}\[\]();]/, // common code syntax
    /^\s*\/\//m, // comments
    /^\s*\/\*/m, // multi-line comments
    /=>/, // arrow functions
    /^export\s+/m, // export statements
  ]

  return codeIndicators.some((pattern) => pattern.test(text))
}

/**
 * Check if text is a file path
 */
export const isFilePath = (text: string): boolean => {
  // Match patterns like styles/SignIn.module.css or path/to/file.ext (new file)
  const pattern =
    /^(?:[a-zA-Z0-9_.\- ]+\/)*[a-zA-Z0-9_.\- ]+\.[a-zA-Z0-9]+(\s+\(new file\))?$/
  return pattern.test(text)
}

// ============= Message Utilities =============

/**
 * Parse context string into tabs for display
 * Handles File, Code, and Image context types
 */
export function parseContextToTabs(context: string): ContextTab[] {
  // Use specific regex patterns to avoid matching import statements
  const sections = context.split(/(?=File |Code from |Image \d{1,2}:)/)

  return sections
    .map((section, index) => {
      const lines = section.trim().split("\n")
      const titleLine = lines[0]
      let content = lines.slice(1).join("\n").trim()

      // Remove code block markers for display
      content = content.replace(/^```[\w-]*\n/, "").replace(/\n```$/, "")

      // Determine the type of context
      const isFile = titleLine.startsWith("File ")
      const isImage = titleLine.startsWith("Image ")
      const type = isFile ? "file" : isImage ? "image" : "code"
      const name = titleLine
        .replace(/^(File |Code from |Image )/, "")
        .replace(":", "")
        .trim()

      // Skip if the content is empty or if it's just an import statement
      if (!content || content.trim().startsWith('from "')) {
        return null
      }

      return {
        id: `context-${index}`,
        type: type as "file" | "code" | "image",
        name: name,
        content: content,
      }
    })
    .filter(
      (tab): tab is NonNullable<typeof tab> =>
        tab !== null && tab.content.length > 0
    )
}

/**
 * Format timestamp for chat messages
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-US", {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
  })
}
