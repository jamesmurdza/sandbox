import {
  ignoredFiles,
  ignoredFolders,
} from "@/components/project/ai-chat/lib/ignored-paths"
import { TIERS } from "@/lib/tiers"
import { TFile, TFolder } from "@/lib/types"
import { apiClient } from "@/server/client"
import { Anthropic } from "@anthropic-ai/sdk"
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime"
import { currentUser } from "@clerk/nextjs/server"
import { templateConfigs } from "@gitwit/templates"

// Initialize clients based on available credentials
const useBedrockClient = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION &&
  process.env.AWS_ARN
)
const bedrockClient = useBedrockClient
  ? new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
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
    const user = await currentUser()
    if (!user) {
      return new Response("Unauthorized", { status: 401 })
    }

    // Check and potentially reset monthly usage
    const resetResponse = await apiClient.user["check-reset"].$post({
      json: { userId: user.id },
    })

    if (!resetResponse.ok) {
      console.error("Failed to check usage reset")
    }

    // Get user data and check tier
    const dbUser = await apiClient.user.$get({
      query: {},
    })
    if (!dbUser.ok) {
      const message = (await dbUser.json()).message || "User not found"
      return new Response(message, { status: dbUser.status })
    }
    const userData = (await dbUser.json()).data

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
      files,
      projectName,
    } = await request.json()

    // Separate handling for edit mode vs chat mode
    if (isEditMode) {
      // EDIT MODE: Direct code modification with strict output
      const editInstruction = messages[0].content
      const selectedCode = context

      const editPrompt = `You are a code editor. Your task is to modify the given code according to the instruction.
DO NOT explain changes. DO NOT use markdown. DO NOT add comments. ONLY output the modified code.

SELECTED CODE:
${selectedCode}

INSTRUCTION:
${editInstruction}

FILE NAME:
${fileName}

LINE NUMBER:
${line}

OUTPUT THE MODIFIED CODE ONLY, NO EXPLANATIONS OR FORMATTING.`

      // Create stream response for edit mode
      if (useBedrockClient && bedrockClient) {
        const input = {
          modelId: process.env.AWS_ARN,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: tierSettings.maxTokens,
            temperature: 0.1, // Lower temperature for more precise edits
            messages: [
              {
                role: "user",
                content: editPrompt,
              },
            ],
          }),
        }

        const command = new InvokeModelWithResponseStreamCommand(input)
        const response = await bedrockClient.send(command)

        // Increment user's generation count
        await apiClient.user["increment-generations"].$post({
          json: { userId: user.id },
        })

        // Return streaming response for Bedrock
        const encoder = new TextEncoder()
        return new Response(
          new ReadableStream({
            async start(controller) {
              if (!response.body) {
                console.error("No response body received from Bedrock")
                controller.close()
                return
              }

              try {
                for await (const chunk of response.body) {
                  if (chunk.chunk?.bytes) {
                    const jsonString = new TextDecoder().decode(
                      chunk.chunk.bytes
                    )
                    try {
                      const parsed = JSON.parse(jsonString)
                      if (
                        parsed.type === "message_start" ||
                        parsed.type === "content_block_start"
                      ) {
                        continue
                      }
                      if (
                        (parsed.type === "content_block_delta" ||
                          parsed.type === "message_delta") &&
                        parsed.delta?.text
                      ) {
                        controller.enqueue(encoder.encode(parsed.delta.text))
                      }
                    } catch (parseError) {
                      console.error("Error parsing Bedrock chunk:", parseError)
                    }
                  }
                }
                controller.close()
              } catch (error) {
                console.error("Bedrock streaming error:", error)
                controller.error(error)
              }
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
      } else {
        // Use Anthropic for edit mode
        const stream = await anthropicClient.messages.create({
          model: tierSettings.anthropicModel,
          max_tokens: tierSettings.maxTokens,
          temperature: 0.1, // Lower temperature for more precise edits
          messages: [
            {
              role: "user",
              content: editPrompt,
            },
          ],
          stream: true,
        })

        // Increment user's generation count
        await apiClient.user["increment-generations"].$post({
          json: { userId: user.id },
        })

        // Return streaming response for Anthropic
        const encoder = new TextEncoder()
        return new Response(
          new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of stream) {
                  if (
                    chunk.type === "content_block_delta" &&
                    chunk.delta.type === "text_delta"
                  ) {
                    controller.enqueue(encoder.encode(chunk.delta.text))
                  }
                }
                controller.close()
              } catch (error) {
                console.error("Anthropic streaming error:", error)
                controller.error(error)
              }
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
      }
    } else {
      // CHAT MODE: Regular assistant mode with markdown and explanations
      const templateConfig = templateConfigs[templateType]
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

      const chatSystemMessage = `You are an intelligent programming assistant for a ${templateType} project. Please respond to the following request concisely. When providing code:

1. Format it using triple backticks (\`\`\`) with the appropriate language identifier.
2. Always specify the complete file path relative to the project root in the format:
   filepath/to/file.ext

3. If creating a new file, specify the path as:
   filepath/to/file.ext (new file)

4. Format your code blocks as:

filepath/to/file.ext
\`\`\`language
code here
\`\`\`

If multiple files are involved, repeat the format for each file. Provide a clear and concise explanation along with any code snippets. Keep your response brief and to the point.

This is the project template:
${templateContext}

${context ? `Context:\n${context}\n` : ""}
${activeFileContent ? `Active File Content:\n${activeFileContent}\n` : ""}`

      // Create stream response for chat mode
      if (useBedrockClient && bedrockClient) {
        const input = {
          modelId: process.env.AWS_ARN,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify({
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: tierSettings.maxTokens,
            temperature: 0.7,
            system: chatSystemMessage,
            messages: messages.map(
              (msg: { role: string; content: string }) => ({
                role: msg.role === "human" ? "user" : "assistant",
                content: msg.content,
              })
            ),
          }),
        }

        const command = new InvokeModelWithResponseStreamCommand(input)
        const response = await bedrockClient.send(command)

        // Increment user's generation count
        await apiClient.user["increment-generations"].$post({
          json: { userId: user.id },
        })

        // Return streaming response for Bedrock
        const encoder = new TextEncoder()
        return new Response(
          new ReadableStream({
            async start(controller) {
              if (!response.body) {
                console.error("No response body received from Bedrock")
                controller.close()
                return
              }

              try {
                for await (const chunk of response.body) {
                  if (chunk.chunk?.bytes) {
                    const jsonString = new TextDecoder().decode(
                      chunk.chunk.bytes
                    )
                    try {
                      const parsed = JSON.parse(jsonString)
                      if (
                        parsed.type === "message_start" ||
                        parsed.type === "content_block_start"
                      ) {
                        continue
                      }
                      if (
                        (parsed.type === "content_block_delta" ||
                          parsed.type === "message_delta") &&
                        parsed.delta?.text
                      ) {
                        controller.enqueue(encoder.encode(parsed.delta.text))
                      }
                    } catch (parseError) {
                      console.error("Error parsing Bedrock chunk:", parseError)
                    }
                  }
                }
                controller.close()
              } catch (error) {
                console.error("Bedrock streaming error:", error)
                controller.error(error)
              }
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
      } else {
        // Use Anthropic for chat mode
        const stream = await anthropicClient.messages.create({
          model: tierSettings.anthropicModel,
          max_tokens: tierSettings.maxTokens,
          system: chatSystemMessage,
          messages: messages.map((msg: { role: string; content: string }) => ({
            role: msg.role === "human" ? "user" : "assistant",
            content: msg.content,
          })),
          stream: true,
        })

        // Increment user's generation count
        await apiClient.user["increment-generations"].$post({
          json: { userId: user.id },
        })

        // Return streaming response for Anthropic
        const encoder = new TextEncoder()
        return new Response(
          new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of stream) {
                  if (
                    chunk.type === "content_block_delta" &&
                    chunk.delta.type === "text_delta"
                  ) {
                    controller.enqueue(encoder.encode(chunk.delta.text))
                  }
                }
                controller.close()
              } catch (error) {
                console.error("Anthropic streaming error:", error)
                controller.error(error)
              }
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
      }
    }
  } catch (error) {
    console.error("AI generation error:", error)
    return new Response(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    )
  }
}
