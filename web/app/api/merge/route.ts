import OpenAI from "openai/index.mjs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { originalCode, newCode, fileName } = await request.json()

    const systemPrompt = `You are a code merging assistant. Your task is to merge the new code snippet with the original file content while following these strict rules:

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

IMPORTANT: Never add any code that isn't explicitly provided in the new code snippet.`

    const mergedCode = `Original file (${fileName}):\n${originalCode}\n\nNew code to merge:\n${newCode}`

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: mergedCode },
      ],
      prediction: {
        type: "content",
        content: mergedCode,
      },
      stream: true,
    })

    // Clean and stream response
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        async start(controller) {
          let buffer = ""
          for await (const chunk of response) {
            if (chunk.choices[0]?.delta?.content) {
              buffer += chunk.choices[0].delta.content
              // Clean any code fence markers that might appear in the stream
              const cleanedContent = buffer
                .replace(/^```[\w-]*\n|```\s*$/gm, "") // Remove code fences
                .replace(/^(javascript|typescript|python|html|css)\n/gm, "") // Remove language identifiers
              controller.enqueue(encoder.encode(cleanedContent))
              buffer = ""
            }
          }
          controller.close()
        },
      })
    )
  } catch (error) {
    console.error("Merge error:", error)
    return new Response(
      error instanceof Error ? error.message : "Failed to merge code",
      { status: 500 }
    )
  }
}
