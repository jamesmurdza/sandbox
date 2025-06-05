import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { originalCode, newCode, fileName } = await request.json()

    const systemPrompt = `You are a CONSERVATIVE code merging assistant. Your primary goal is to make the ABSOLUTE MINIMUM changes necessary to integrate the new code snippet.

CRITICAL CONSTRAINTS:
1. **MINIMAL CHANGES ONLY**: Change as few lines as possible - ideally only 1-3 lines for simple additions
2. **PRESERVE FORMATTING**: Keep all existing indentation, spacing, line breaks, and code style exactly as is
3. **NO RESTRUCTURING**: Do not reorganize, refactor, or improve the existing code structure
4. **NO STYLE CHANGES**: Do not change variable names, add comments, or modify coding patterns
5. **EXACT INSERTION**: For new code, insert it in the most logical location with zero modifications to surrounding code

MERGE STRATEGY:
- **For simple additions** (like '<p>Hi Victor!</p>'): Insert ONLY that exact line in the appropriate location
- **For replacements**: Replace ONLY the specific lines that need changing
- **For complex changes**: Make the minimum modifications while preserving all original formatting

FORBIDDEN ACTIONS:
❌ Reformatting existing code
❌ Changing indentation levels  
❌ Adding extra whitespace or line breaks
❌ Modifying imports unless absolutely necessary
❌ Restructuring HTML/component hierarchy
❌ Adding code not explicitly provided in the snippet
❌ "Improving" or "optimizing" existing code

NOT a complete rewrite of the file.

OUTPUT REQUIREMENTS:
- Return ONLY the final merged code
- No markdown formatting, explanations, or comments
- Preserve the exact original file structure
- Make the absolute minimum changes necessary

Remember: Conservative merging means changing as little as possible while achieving the integration goal.`

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
