import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { originalCode, newCode, fileName } = await request.json()

    const systemPrompt = `You are a code merging assistant. Your task is to merge the new code snippet with the original file content while:
1. Preserving the original file's functionality
2. Ensuring proper integration of the new code
3. Maintaining consistent style and formatting
4. Resolving any potential conflicts
5. Output ONLY the raw code without any:
   - Code fence markers (\`\`\`)
   - Language identifiers (typescript, javascript, etc.)
   - Explanations or comments
   - Markdown formatting

The output should be the exact code that will replace the existing code, nothing more and nothing less.`

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
