import * as monaco from "monaco-editor"
import { useEffect, useRef, useState } from "react"

/**
 * DiffLineControls Component
 * 
 * Provides hover-based accept/reject controls for diff chunks.
 * Updated to work with chunks instead of individual lines.
 */

interface DiffLineControlsProps {
  editorRef: monaco.editor.IStandaloneCodeEditor
  // decorations prop is not used, consider removing if not planned for future use
  // decorations: monaco.editor.IModelDeltaDecoration[] 
  changeChunks: ChangeChunk[]
  appliedChunks: Set<string>
  lineToChunkMap: Map<number, string>
  onAcceptChunk: (chunkId: string) => void
  onRejectChunk: (chunkId: string) => void
}

interface ChangeChunk {
  id: string
  type: "addition" | "deletion" | "modification"
  startLine: number // Original start line of the chunk (0-indexed)
  endLine: number // Original end line of the chunk (0-indexed)
  originalLines: string[]
  targetLines: string[]
}

export default function DiffLineControls({
  editorRef,
  changeChunks,
  appliedChunks,
  lineToChunkMap,
  onAcceptChunk,
  onRejectChunk,
}: DiffLineControlsProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null)
  const [buttonPosition, setButtonPosition] = useState<{ top: number; right: number } | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>()

  useEffect(() => {
    if (!editorRef || !overlayRef.current) return

    const overlay = overlayRef.current
    const editorDomNode = editorRef.getDomNode()
    if (!editorDomNode) return

    if (getComputedStyle(editorDomNode).position === 'static') {
      editorDomNode.style.position = 'relative'
    }
    editorDomNode.appendChild(overlay)

    const handleMouseMove = (e: monaco.editor.IEditorMouseEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      const target = e.target
      if (!target || !target.position) {
        timeoutRef.current = setTimeout(() => {
          setHoveredChunkId(null)
          setButtonPosition(null)
        }, 1000)
        return
      }

      const lineNumber = target.position.lineNumber
      const chunkId = lineToChunkMap.get(lineNumber)

      if (chunkId && !appliedChunks.has(chunkId)) {
        const lineTop = editorRef.getTopForLineNumber(lineNumber)
        const scrollTop = editorRef.getScrollTop()
        const actualTop = lineTop - scrollTop
        
        const editorLineHeight = editorRef.getOption(monaco.editor.EditorOption.lineHeight);
        const layoutInfo = editorRef.getLayoutInfo()
        if (actualTop >= -editorLineHeight && actualTop <= layoutInfo.height) {
          setHoveredChunkId(chunkId)
          setButtonPosition({ top: actualTop, right: 20 })
        } else {
          timeoutRef.current = setTimeout(() => {
            setHoveredChunkId(null)
            setButtonPosition(null)
          }, 1000)
        }
      } else {
        timeoutRef.current = setTimeout(() => {
          setHoveredChunkId(null)
          setButtonPosition(null)
        }, 1000)
      }
    }

    const handleMouseLeave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        setHoveredChunkId(null)
        setButtonPosition(null)
      }, 1500)
    }

    const mouseMoveSubscription = editorRef.onMouseMove(handleMouseMove)
    const mouseLeaveSubscription = editorRef.onMouseLeave(handleMouseLeave)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      mouseMoveSubscription.dispose()
      mouseLeaveSubscription.dispose()
      if (overlay.parentNode === editorDomNode) {
        editorDomNode.removeChild(overlay)
      }
    }
  }, [editorRef, lineToChunkMap, appliedChunks])

  useEffect(() => {
    if (!overlayRef.current || !editorRef) return // Added editorRef check

    const overlay = overlayRef.current
    const editorDomNode = editorRef.getDomNode() // Defined here for this scope
    if (!editorDomNode) return

    const existingButtonContainer = overlay.querySelector(".diff-chunk-buttons")
    if (existingButtonContainer) {
      existingButtonContainer.remove()
    }

    if (!hoveredChunkId || !buttonPosition) return

    const chunk = changeChunks.find((c) => c.id === hoveredChunkId)
    if (!chunk) return

    const buttonContainer = document.createElement("div")
    buttonContainer.className = "diff-chunk-buttons"
    buttonContainer.style.cssText = `
      position: absolute;
      top: ${buttonPosition.top}px;
      right: ${buttonPosition.right}px;
      display: flex;
      gap: 4px;
      background: hsl(var(--background));
      border: 1px solid hsl(var(--border));
      border-radius: 6px;
      padding: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      z-index: 2000;
    `

    buttonContainer.onmouseenter = (e) => {
      e.stopPropagation()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }

    buttonContainer.onmouseleave = (e) => {
      e.stopPropagation()
      timeoutRef.current = setTimeout(() => {
        setHoveredChunkId(null)
        setButtonPosition(null)
      }, 1000)
    }

    const indicator = document.createElement("div")
    indicator.style.cssText = `
      padding: 2px 6px;
      font-size: 11px;
      color: hsl(var(--muted-foreground));
      display: flex;
      align-items: center;
      font-weight: 500;
      font-family: var(--font-geist-mono);
      user-select: none;
      max-width: 200px;
      white-space: nowrap;
    `

    const originalCount = chunk.originalLines.length
    const targetCount = chunk.targetLines.length
    let indicatorText: string

    // Note: chunk.startLine is 0-indexed from the diff algorithm.
    // Displaying as 1-indexed for user readability.
    const displayStartLine = chunk.startLine + 1;

    if (chunk.type === "addition") {
      indicatorText = `L${displayStartLine}: +${targetCount} line${targetCount !== 1 ? "s" : ""}`;
    } else if (chunk.type === "deletion") {
      indicatorText = `L${displayStartLine}: -${originalCount} line${originalCount !== 1 ? "s" : ""}`;
    } else {
      indicatorText = `L${displayStartLine}: -${originalCount} +${targetCount}`;
    }
    indicator.textContent = indicatorText
    buttonContainer.appendChild(indicator)

    const separator = document.createElement("div")
    separator.style.cssText = `
      width: 1px;
      background: hsl(var(--border));
      margin: 0 2px;
    `
    buttonContainer.appendChild(separator)

    const acceptBtn = document.createElement("button")
    acceptBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"></polyline>
      </svg>
    `
    acceptBtn.style.cssText = `
      background: transparent;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #22c55e;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      transition: background-color 0.15s;
    `
    acceptBtn.title = "Accept this change"
    acceptBtn.onmouseenter = () => { acceptBtn.style.backgroundColor = "rgba(34, 197, 94, 0.1)" }
    acceptBtn.onmouseleave = () => { acceptBtn.style.backgroundColor = "transparent" }
    acceptBtn.onclick = (e) => {
      e.stopPropagation()
      onAcceptChunk(chunk.id)
      setHoveredChunkId(null)
      setButtonPosition(null)
    }
    buttonContainer.appendChild(acceptBtn)

    const rejectBtn = document.createElement("button")
    rejectBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `
    rejectBtn.style.cssText = `
      background: transparent;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      transition: background-color 0.15s;
    `
    rejectBtn.title = "Reject this change"
    rejectBtn.onmouseenter = () => { rejectBtn.style.backgroundColor = "rgba(239, 68, 68, 0.1)" }
    rejectBtn.onmouseleave = () => { rejectBtn.style.backgroundColor = "transparent" }
    rejectBtn.onclick = (e) => {
      e.stopPropagation()
      onRejectChunk(chunk.id)
      setHoveredChunkId(null)
      setButtonPosition(null)
    }
    buttonContainer.appendChild(rejectBtn)
    
    let chunkLinesForHighlight: number[] = [];
    if (lineToChunkMap && hoveredChunkId) {
        lineToChunkMap.forEach((cId, lineNum) => {
            if (cId === hoveredChunkId) {
                chunkLinesForHighlight.push(lineNum);
            }
        });
    }

    buttonContainer.onmouseenter = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      chunkLinesForHighlight.forEach(lineNumber => {
        try {
          const lineElement = editorDomNode?.querySelector(
            `.view-line:nth-child(${lineNumber})`
          ) as HTMLElement | null;
          if (lineElement) {
            lineElement.style.setProperty("filter", "brightness(1.2)", "important");
            lineElement.style.transition = "filter 0.1s ease-in-out";
          }
        } catch (err) {
          // Silently ignore DOM query errors
        }
      });
    };
    
    buttonContainer.onmouseleave = () => {
      timeoutRef.current = setTimeout(() => {
        setHoveredChunkId(null);
        setButtonPosition(null);
      }, 1000);
      chunkLinesForHighlight.forEach(lineNumber => {
        try {
          const lineElement = editorDomNode?.querySelector(
            `.view-line:nth-child(${lineNumber})`
          ) as HTMLElement | null;
          if (lineElement) {
            lineElement.style.removeProperty("filter");
          }
        } catch (err) {
          // Silently ignore DOM query errors
        }
      });
    };

    overlay.appendChild(buttonContainer)
  },
  [hoveredChunkId, buttonPosition, changeChunks, lineToChunkMap, editorRef, onAcceptChunk, onRejectChunk]
)

  return <div ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1000 }} />;
} 