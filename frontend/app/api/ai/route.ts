import {
  ignoredFiles,
  ignoredFolders,
} from "@/components/editor/AIChat/lib/ignored-paths"
import { templateConfigs } from "@/lib/templates"
import { TIERS } from "@/lib/tiers"
import { TFile, TFolder } from "@/lib/types"
import { currentUser } from "@clerk/nextjs"
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime"

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

// Format file structure for context
function formatFileStructure(
  items: (TFile | TFolder)[] | undefined,
  prefix = ""
): string {
  if (!items || !Array.isArray(items)) {
    return "No files available"
  }

  // Sort items to show folders first, then files
  const sortedItems = [...items].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === "folder" ? -1 : 1
  })

  return sortedItems
    .map((item) => {
      if (
        item.type === "file" &&
        !ignoredFiles.some(
          (pattern) =>
            item.name.endsWith(pattern.replace("*", "")) ||
            item.name === pattern
        )
      ) {
        return `${prefix}├── ${item.name}`
      } else if (
        item.type === "folder" &&
        !ignoredFolders.some((folder) => folder === item.name)
      ) {
        const folderContent = formatFileStructure(
          item.children,
          `${prefix}│   `
        )
        return `${prefix}├── ${item.name}/\n${folderContent}`
      }
      return null
    })
    .filter(Boolean)
    .join("\n")
}

export async function POST(request: Request) {
  try {
    // Auth is now handled by middleware
    const {
      messages,
      context,
      activeFileContent,
      isEditMode,
      fileName,
      line,
      templateType,
      files,
      projectName,
    } = await request.json()

    // Check and potentially reset monthly usage
    const resetResponse = await fetch(
      `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/user/check-reset`,
      {
        method: "POST",
        headers: {
          Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: request.headers.get('x-clerk-user-id') }),
        cache: 'no-store'
      }
    )

    if (!resetResponse.ok) {
      console.error("Failed to check usage reset")
    }

    // Get user data and check tier
    const dbUser = await fetch(
      `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/user?id=${request.headers.get('x-clerk-user-id')}`,
      {
        headers: {
          Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
        },
        cache: 'no-store'
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

    // Get template configuration
    const templateConfig = templateConfigs[templateType]

    // Create template context
    const templateContext = templateConfig
      ? `
Project Template: ${templateConfig.name}

Current File Structure:
${files ? formatFileStructure(files) : "No files available"}

Conventions:
${templateConfig.conventions.join("\n")}

Dependencies:
${JSON.stringify(templateConfig.dependencies, null, 2)}

Scripts:
${JSON.stringify(templateConfig.scripts, null, 2)}
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
      systemMessage = `You are an intelligent programming assistant for a ${templateType} project. Please respond to the following request concisely. When providing code:

1. Format it using triple backticks (\`\`\`) with the appropriate language identifier.
2. Always specify the complete file path in the format:
   ${projectName}/filepath/to/file.ext

3. If creating a new file, specify the path as:
   ${projectName}/filepath/to/file.ext (new file)

4. Format your code blocks as:

${projectName}/filepath/to/file.ext
\`\`\`language
code here
\`\`\`

If multiple files are involved, repeat the format for each file. Provide a clear and concise explanation along with any code snippets. Keep your response brief and to the point.

This is the project template:
${templateContext}

${context ? `Context:\n${context}\n` : ""}
${activeFileContent ? `Active File Content:\n${activeFileContent}\n` : ""}`
    }

    // Create stream response
    const input = {
      modelId: tierSettings.model,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: tierSettings.maxTokens,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: systemMessage
          },
          ...messages.map((msg: { role: string; content: string }) => ({
            role: msg.role === "human" ? "user" : "assistant",
            content: msg.content,
          }))
        ]
      })
    }

    const command = new InvokeModelWithResponseStreamCommand(input)
    const response = await bedrockClient.send(command)

    // Return streaming response
    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream({
        async start(controller) {
          if (!response.body) {
            console.error('No response body received')
            controller.close()
            return
          }

          try {
            for await (const chunk of response.body) {
              if (chunk.chunk?.bytes) {
                const jsonString = new TextDecoder().decode(chunk.chunk.bytes)
                try {
                  const parsed = JSON.parse(jsonString)
                  if (parsed.type === 'message_start') {
                    continue
                  }
                  if (parsed.type === 'content_block_start') {
                    continue
                  }
                  if (parsed.type === 'content_block_delta') {
                    if (parsed.delta?.text) {
                      controller.enqueue(encoder.encode(parsed.delta.text))
                    }
                  }
                  if (parsed.type === 'message_delta') {
                    if (parsed.delta?.text) {
                      controller.enqueue(encoder.encode(parsed.delta.text))
                    }
                  }
                } catch (parseError) {
                  console.error('Error parsing chunk:', parseError)
                }
              }
            }
            controller.close()
          } catch (error) {
            console.error("Streaming error:", error)
            controller.error(error)
          }
        }
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
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
