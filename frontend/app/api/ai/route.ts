import { currentUser } from "@clerk/nextjs"
import { Anthropic } from "@anthropic-ai/sdk"
import { TIERS } from "@/lib/tiers"
import { templateConfigs } from "@/lib/templates"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Check and potentially reset monthly usage
    const resetResponse = await fetch(
      `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/user/check-reset`,
      {
        method: "POST",
        headers: {
          Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      }
    )

    if (!resetResponse.ok) {
      console.error("Failed to check usage reset")
    }

    // Get user data and check tier
    const dbUser = await fetch(
      `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/user?id=${user.id}`,
      {
        headers: {
          Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
        },
      }
    )
    const userData = await dbUser.json()

    // Get tier settings
    const tierSettings =
      TIERS[userData.tier as keyof typeof TIERS] || TIERS.FREE
    if (userData.generations >= tierSettings.generations) {
      return new Response(
        `AI generation limit reached for your ${userData.tier || "FREE"} tier`,
        { status: 429 }
      )
    }

    const {
      messages,
      context,
      activeFileContent,
      isEditMode,
      fileName,
      line,
      templateType,
    } = await request.json()

    // Get template configuration
    const templateConfig = templateConfigs[templateType]

    // Create template context
    const templateContext = templateConfig
      ? `
Project Template: ${templateConfig.name}

File Structure:
${Object.entries(templateConfig.fileStructure)
  .map(([path, info]) => `${path} - ${info.description}`)
  .join("\n")}

Conventions:
${templateConfig.conventions.join("\n")}

Dependencies:
${JSON.stringify(templateConfig.dependencies, null, 2)}
`
      : ""

    // Create system message based on mode
    let systemMessage
    if (isEditMode) {
      systemMessage = `You are an AI code editor working in a ${templateType} project. Your task is to modify the given code based on the user's instructions. Only output the modified code, without any explanations or markdown formatting. The code should be a direct replacement for the existing code. If there is no code to modify, refer to the active file content and only output the code that is relevant to the user's instructions.

${templateContext}

File: ${fileName}
Line: ${line}

Context:
${context || "No additional context provided"}

Active File Content:
${activeFileContent}

Instructions: ${messages[0].content}

Respond only with the modified code that can directly replace the existing code.`
    } else {
      systemMessage = `You are an intelligent programming assistant for a ${templateType} project. Please respond to the following request concisely. If your response includes code, please format it using triple backticks (\`\`\`) with the appropriate language identifier. For example:

      \`\`\`python
      print("Hello, World!")
      \`\`\`
      
      Provide a clear and concise explanation along with any code snippets. Keep your response brief and to the point.

This is the project template:
${templateContext}

${context ? `Context:\n${context}\n` : ""}
${activeFileContent ? `Active File Content:\n${activeFileContent}\n` : ""}`
    }

    // Create stream response
    const stream = await anthropic.messages.create({
      model: tierSettings.model,
      max_tokens: tierSettings.maxTokens,
      system: systemMessage,
      messages: messages.map((msg: { role: string; content: string }) => ({
        role: msg.role === "human" ? "user" : "assistant",
        content: msg.content,
      })),
      stream: true,
    })

    // Increment user's generation count
    await fetch(
      `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/user/increment-generations`,
      {
        method: "POST",
        headers: {
          Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user.id }),
      }
    )

    // Return streaming response
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
          controller.close()
        },
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    )
  } catch (error) {
    console.error("AI generation error:", error)
    return new Response(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    )
  }
}
