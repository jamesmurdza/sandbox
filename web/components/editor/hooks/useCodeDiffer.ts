import * as monaco from "monaco-editor"
import { useCallback } from "react"

export interface UseCodeDifferProps {
  editorRef: monaco.editor.IStandaloneCodeEditor | null
}

export interface UseCodeDifferReturn {
  handleApplyCode: (
    mergedCode: string,
    originalCode: string
  ) => monaco.editor.IEditorDecorationsCollection | null
}

/**
 * Hook for handling code diff visualization and merging
 */
export function useCodeDiffer({
  editorRef,
}: UseCodeDifferProps): UseCodeDifferReturn {
  const handleApplyCode = useCallback(
    (
      mergedCode: string,
      originalCode: string
    ): monaco.editor.IEditorDecorationsCollection | null => {
      if (!editorRef) return null
      const model = editorRef.getModel()
      if (!model)
        return null

        // Store original content on model for potential restoration
      ;(model as any).originalContent = originalCode

      const originalLines = originalCode.split("\n")
      const mergedLines = mergedCode.split("\n")
      const decorations: monaco.editor.IModelDeltaDecoration[] = []
      const combinedLines: string[] = []

      let i = 0
      let inDiffBlock = false
      let diffBlockStart = 0
      let originalBlock: string[] = []
      let mergedBlock: string[] = []

      // Process line-by-line diff
      while (i < Math.max(originalLines.length, mergedLines.length)) {
        if (originalLines[i] !== mergedLines[i]) {
          if (!inDiffBlock) {
            inDiffBlock = true
            diffBlockStart = combinedLines.length
            originalBlock = []
            mergedBlock = []
          }

          if (i < originalLines.length) originalBlock.push(originalLines[i])
          if (i < mergedLines.length) mergedBlock.push(mergedLines[i])
        } else {
          if (inDiffBlock) {
            // Add the entire original block with deletion decoration
            originalBlock.forEach((line) => {
              combinedLines.push(line)
              decorations.push({
                range: new monaco.Range(
                  combinedLines.length,
                  1,
                  combinedLines.length,
                  1
                ),
                options: {
                  isWholeLine: true,
                  className: "removed-line-decoration",
                  glyphMarginClassName: "removed-line-glyph",
                  linesDecorationsClassName: "removed-line-number",
                  minimap: { color: "rgb(255, 0, 0, 0.2)", position: 2 },
                },
              })
            })

            // Add the entire merged block with addition decoration
            mergedBlock.forEach((line) => {
              combinedLines.push(line)
              decorations.push({
                range: new monaco.Range(
                  combinedLines.length,
                  1,
                  combinedLines.length,
                  1
                ),
                options: {
                  isWholeLine: true,
                  className: "added-line-decoration",
                  glyphMarginClassName: "added-line-glyph",
                  linesDecorationsClassName: "added-line-number",
                  minimap: { color: "rgb(0, 255, 0, 0.2)", position: 2 },
                },
              })
            })

            inDiffBlock = false
          }

          combinedLines.push(originalLines[i])
        }
        i++
      }

      // Handle any remaining diff block at the end
      if (inDiffBlock) {
        originalBlock.forEach((line) => {
          combinedLines.push(line)
          decorations.push({
            range: new monaco.Range(
              combinedLines.length,
              1,
              combinedLines.length,
              1
            ),
            options: {
              isWholeLine: true,
              className: "removed-line-decoration",
              glyphMarginClassName: "removed-line-glyph",
              linesDecorationsClassName: "removed-line-number",
              minimap: { color: "rgb(255, 0, 0, 0.2)", position: 2 },
            },
          })
        })

        mergedBlock.forEach((line) => {
          combinedLines.push(line)
          decorations.push({
            range: new monaco.Range(
              combinedLines.length,
              1,
              combinedLines.length,
              1
            ),
            options: {
              isWholeLine: true,
              className: "added-line-decoration",
              glyphMarginClassName: "added-line-glyph",
              linesDecorationsClassName: "added-line-number",
              minimap: { color: "rgb(0, 255, 0, 0.2)", position: 2 },
            },
          })
        })
      }

      // Apply the merged code to the editor
      model.setValue(combinedLines.join("\n"))

      // Create and return decorations collection
      const newDecorations = editorRef.createDecorationsCollection(decorations)
      return newDecorations
    },
    [editorRef]
  )

  return {
    handleApplyCode,
  }
}
