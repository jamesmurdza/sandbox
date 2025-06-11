import { diffLines } from "diff"

export async function POST(request: Request) {
  try {
    const { originalCode, newCode, fileName } = await request.json()

    // Detect merge strategy based on content
    const strategy = detectMergeStrategy(originalCode, newCode, fileName)

    let mergedResult: string

    switch (strategy) {
      case "full-replacement":
        // Complete file replacement (e.g., full HTML files)
        mergedResult = newCode
        break

      case "smart-insert":
        // Insert snippet at appropriate location
        mergedResult = smartInsertCode(originalCode, newCode, fileName)
        break

      case "diff-merge":
        // Use diff algorithm for partial updates
        mergedResult = performDiffMerge(originalCode, newCode)
        break

      default:
        mergedResult = performDiffMerge(originalCode, newCode)
    }

    return new Response(mergedResult, {
      headers: { "Content-Type": "text/plain" },
    })
  } catch (error) {
    console.error("Merge error:", error)
    return new Response(
      error instanceof Error ? error.message : "Failed to merge code",
      { status: 500 }
    )
  }
}

function detectMergeStrategy(
  original: string,
  newCode: string,
  fileName: string
): string {
  const trimmedNew = newCode.trim()
  const lineCount = trimmedNew.split("\n").length

  // Full HTML document
  if (trimmedNew.startsWith("<!DOCTYPE") || trimmedNew.startsWith("<html")) {
    return "full-replacement"
  }

  // Small snippet (likely an insertion)
  if (
    lineCount <= 10 &&
    !trimmedNew.includes("function") &&
    !trimmedNew.includes("class")
  ) {
    return "smart-insert"
  }

  // Default to diff merge
  return "diff-merge"
}

function smartInsertCode(
  original: string,
  snippet: string,
  fileName: string
): string {
  // CRITICAL: Detect and preserve line endings
  const lineEnding = original.includes("\r\n") ? "\r\n" : "\n"
  const lines = original.split(/\r?\n/)
  const ext = fileName.split(".").pop()?.toLowerCase()

  // Find insertion point based on file type and content
  let insertIndex = -1

  if (ext === "html" || ext === "htm") {
    // For HTML, find appropriate location
    if (
      snippet.includes("<head>") ||
      snippet.includes("<meta") ||
      snippet.includes("<link")
    ) {
      // Insert in head
      insertIndex = lines.findIndex((line) => line.includes("</head>"))
    } else if (snippet.includes("<script")) {
      // Insert before closing body
      insertIndex = lines.findIndex((line) => line.includes("</body>"))
    } else {
      // Insert in body - look for opening body tag
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("<body")) {
          // Find the closing > of the body tag
          let j = i
          while (j < lines.length && !lines[j].includes(">")) {
            j++
          }
          insertIndex = j + 1
          break
        }
      }
    }
  } else if (["js", "jsx", "ts", "tsx"].includes(ext || "")) {
    // For JS/TS files
    if (snippet.includes("import")) {
      // Insert with other imports
      const lastImport = lines.findLastIndex((line) =>
        line.trim().startsWith("import")
      )
      insertIndex = lastImport !== -1 ? lastImport + 1 : 0
    } else if (snippet.includes("export")) {
      // Insert at end
      insertIndex = lines.length
    } else {
      // Insert before first function/class or at end
      const funcIndex = lines.findIndex(
        (line) =>
          line.includes("function") ||
          line.includes("class") ||
          line.includes("const")
      )
      insertIndex = funcIndex !== -1 ? funcIndex : lines.length
    }
  }

  // Default to end if no suitable location found
  if (insertIndex === -1 || insertIndex > lines.length) {
    insertIndex = lines.length
  }

  // Get indentation from the previous non-empty line
  let indentLevel = 0
  for (let i = insertIndex - 1; i >= 0; i--) {
    if (lines[i].trim()) {
      indentLevel = getIndentLevel(lines[i])
      break
    }
  }

  // Prepare the snippet with proper indentation
  const snippetLines = snippet.split(/\r?\n/)
  const indentedSnippetLines = snippetLines.map((line) =>
    line.trim() ? " ".repeat(indentLevel) + line.trim() : ""
  )

  // CRITICAL: Insert without modifying the original array structure
  const result = [
    ...lines.slice(0, insertIndex),
    ...indentedSnippetLines,
    ...lines.slice(insertIndex),
  ]

  // CRITICAL: Preserve exact line ending format
  return result.join(lineEnding)
}

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/)
  return match ? match[1].length : 0
}

function performDiffMerge(original: string, updated: string): string {
  const changes = diffLines(original, updated, { ignoreWhitespace: false })

  // Build merged result
  let result = ""

  for (const change of changes) {
    if (change.added) {
      // Add new content
      result += change.value
    } else if (!change.removed) {
      // Keep unchanged content
      result += change.value
    }
    // Skip removed content
  }

  return result
}
