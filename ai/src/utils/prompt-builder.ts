import { templateConfigs } from "@gitwit/templates"
import { AIRequest } from "../types"

/**
 * Prompt builder class that generates context-aware system prompts for AI interactions
 * Supports different modes (chat, edit, generate) and project templates
 *
 * @example
 * ```typescript
 * const builder = new PromptBuilder()
 * const prompt = builder.build({
 *   mode: "chat",
 *   context: { templateType: "nextjs", userId: "user123" },
 *   messages: []
 * })
 * ```
 */
export class PromptBuilder {
  /**
   * Builds a system prompt based on the AI request mode and context
   *
   * @param request - AI request object containing mode and context information
   * @returns Generated system prompt string tailored to the request
   */
  build(request: AIRequest): string {
    const { mode, context } = request

    switch (mode) {
      case "edit":
        return this.buildEditPrompt(request)
      case "merge":
        return this.buildMergePrompt(request)
      case "chat":
      default:
        return this.buildChatPrompt(request)
    }
  }

  /**
   * Builds a chat-oriented system prompt with project context and conventions
   * Includes template-specific information when available
   *
   * @param request - AI request object with chat context
   * @returns System prompt optimized for conversational AI interactions
   */
  private buildChatPrompt(request: AIRequest): string {
    const { context } = request
    const templateConfig = context.templateType
      ? templateConfigs[context.templateType]
      : null

    let prompt = `You are an intelligent programming assistant for a ${
      context.templateType || "web"
    } project.`

    if (templateConfig) {
      prompt += `
      
Project Template: ${templateConfig.name}

Conventions:
${templateConfig.conventions.join("\n")}

Dependencies:
${JSON.stringify(templateConfig.dependencies, null, 2)}

Scripts:
${JSON.stringify(templateConfig.scripts, null, 2)}
`
    }

    if (context.activeFile) {
      prompt += `\n\nActive File Content:\n${context.activeFile}`
    }

    prompt += `

Please respond concisely. When providing code:
1. Format it using triple backticks with the appropriate language identifier
2. Always specify the complete file path relative to the project root
3. For new files, add "(new file)" after the path
4. Keep responses brief and to the point`

    return prompt
  }

  /**
   * Builds an edit-focused system prompt for code modification tasks
   * Emphasizes minimal context and precise code changes
   *
   * @param request - AI request object with edit context
   * @returns System prompt optimized for code editing operations
   */
  private buildEditPrompt(request: AIRequest): string {
    const { context } = request

    return `You are a code editor AI. Your task is to generate ONLY the code needed for the edit.

Rules:
- Return ONLY code, no explanations
- Include minimal context (few lines before/after changes)
- Use comments to indicate where unchanged code is skipped
- Preserve the exact formatting and style of the existing code
- If multiple edits are needed, show them in order of appearance

Current file: ${context.activeFile || "unknown"}
${context.activeFile ? `\nFile content:\n${context.activeFile}` : ""}`
  }

  /**
   * Builds a merge-focused system prompt for code merging tasks
   * Emphasizes strict rules for merging new code with existing files
   *
   * @param request - AI request object with merge context
   * @returns System prompt optimized for code merging operations
   */
  private buildMergePrompt(request: AIRequest): string {
    const { context } = request

    return `You are a code merging assistant. Your task is to merge the new code snippet with the original file content while following these strict rules:

1. Code Integration Rules:
   - ONLY use code from the provided new code snippet
   - DO NOT add any new code that isn't in the snippet
   - DO NOT modify existing code unless directly replaced by the snippet
   - Preserve all existing imports, exports, and component structure

2. Structure Preservation:
   - Keep the original file's organization intact
   - Maintain existing code patterns and style
   - Preserve all comments and documentation
   - Keep type definitions and interfaces unchanged

3. Merge Guidelines:
   - Replace the exact portions of code that match the snippet's context
   - If the snippet contains new code, place it in the most logical location
   - Maintain consistent indentation and formatting
   - Keep existing error handling and type safety

4. Output Requirements:
   - Return ONLY the final merged code
   - Do not include:
     • Code fence markers (\`\`\`)
     • Language identifiers
     • Explanations or comments about changes
     • Markdown formatting
     • Line numbers
     • Any text before or after the code

The output must be the exact code that will replace the existing file content, nothing more and nothing less.

IMPORTANT: Never add any code that isn't explicitly provided in the new code snippet.

Current file: ${context.activeFile || "unknown"}`
  }
}
