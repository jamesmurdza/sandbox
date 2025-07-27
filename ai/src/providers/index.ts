import { bedrock } from "@ai-sdk/amazon-bedrock"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { generateText, LanguageModel, streamText, Tool, tool } from "ai"
import { z } from "zod"
import { AIProviderConfig, AIRequest, AITool } from "../types"
import { logger, StreamHandler } from "../utils"

/**
 * AI provider class that handles communication with different AI services
 * Supports Anthropic Claude, AWS Bedrock, and OpenAI models
 *
 * @example
 * ```typescript
 * const provider = new AIProvider({
 *   provider: "anthropic",
 *   modelId: "claude-3-5-sonnet-20241022"
 * })
 * const response = await provider.generate(request)
 * ```
 */
export class AIProvider {
  private model: LanguageModel
  private logger: typeof logger
  private tools: Record<string, Tool> = {}

  /**
   * Creates a new AI provider instance with the specified configuration
   *
   * @param config - Configuration object specifying the provider type and model settings
   */
  constructor(config: AIProviderConfig) {
    this.logger = logger.child({
      provider: config.provider,
      model: config.modelId,
    })

    this.model = this.initializeModel(config)

    // Convert AITool definitions to Vercel AI SDK tool format
    if (config.tools) {
      this.tools = this.convertTools(config.tools)
    }

    this.logger.info("AI Provider initialized", {
      toolCount: Object.keys(this.tools).length,
    })
  }

  /**
   * Converts AITool definitions to Vercel AI SDK tool format
   */
  private convertTools(aiTools: Record<string, AITool>): Record<string, Tool> {
    const convertedTools: Record<string, Tool> = {}

    for (const [name, aiTool] of Object.entries(aiTools)) {
      convertedTools[name] = tool({
        description: aiTool.description || "",
        parameters: aiTool.parameters || z.object({}),
        execute: aiTool.execute,
      })
    }

    return convertedTools
  }

  /**
   * Initializes the appropriate AI model based on the provider configuration
   *
   * @param config - Provider configuration object
   * @returns Initialized language model instance
   * @throws {Error} When AWS region is missing for Bedrock provider
   * @throws {Error} When an unsupported provider is specified
   */
  private initializeModel(config: AIProviderConfig): LanguageModel {
    this.logger.debug("Initializing model", {
      provider: config.provider,
      modelId: config.modelId,
    })

    switch (config.provider) {
      case "anthropic":
        return anthropic(config.modelId || "claude-3-5-sonnet-20241022")

      case "bedrock":
        if (!config.region) throw new Error("AWS region required for Bedrock")
        const arn = config.modelId || process.env.AWS_ARN!
        return bedrock(arn)

      case "openai":
        return openai(config.modelId || "gpt-4o-mini")

      default:
        throw new Error(`Unsupported provider: ${config.provider}`)
    }
  }

  /**
   * Generates a streaming AI response
   * Returns a ReadableStream that can be consumed chunk by chunk
   *
   * @param request - AI request object containing messages and generation parameters
   * @returns Promise that resolves to an HTTP Response with a streaming body
   * @throws {Error} When stream generation fails or produces no content
   */
  async generateStream(request: AIRequest) {
    const { messages, temperature, maxTokens, maxSteps = 1 } = request

    this.logger.debug("Generating stream", {
      messageCount: messages.length,
      temperature,
      maxTokens,
      maxSteps,
      toolCount: Object.keys(this.tools).length,
    })

    try {
      const result = await streamText({
        model: this.model,
        messages,
        temperature,
        maxTokens,
        maxSteps,
        tools: this.tools,
      })

      const encoder = new TextEncoder()
      let chunkCount = 0

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.textStream) {
              chunkCount++
              controller.enqueue(encoder.encode(chunk))
            }

            if (chunkCount === 0) {
              logger.error("Stream is empty - no content generated")
              controller.error(new Error("No content generated from AI model"))
            } else {
              controller.close()
            }
          } catch (error) {
            logger.error("Stream processing error", error)
            controller.error(error)
          }
        },
      })

      return StreamHandler.createStreamResponse(stream)
    } catch (error) {
      this.logger.error("Stream generation failed", error)
      throw error
    }
  }

  /**
   * Generates a complete AI response
   * Returns the full response as a JSON object with content and usage information
   *
   * @param request - AI request object containing messages and generation parameters
   * @returns Promise that resolves to an HTTP Response with JSON body containing the complete response
   */
  async generate(request: AIRequest) {
    const { messages, temperature, maxTokens, maxSteps = 1 } = request

    const result = await generateText({
      model: this.model,
      messages,
      temperature,
      maxTokens,
      maxSteps,
      tools: this.tools,
    })

    // Return response with tool results if any
    return new Response(
      JSON.stringify({
        content: result.text,
        usage: result.usage,
        steps: result.steps, // Include steps for agent behavior
        toolCalls: result.toolCalls,
        toolResults: result.toolResults,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
}

/**
 * Factory function to create an AI provider with tools
 * Automatically detects the appropriate provider based on available API keys
 *
 * @param overrides - Optional configuration overrides
 * @returns Configured AI provider instance
 *
 * @example
 * ```typescript
 * // Auto-detects provider from environment
 * const provider = createAIProvider()
 *
 * // Override specific settings
 * const customProvider = createAIProvider({
 *   provider: "openai",
 *   modelId: "gpt-4"
 * })
 * ```
 */
export function createAIProvider(
  overrides?: Partial<AIProviderConfig>
): AIProvider {
  const config: AIProviderConfig = {
    provider: "anthropic",
    ...overrides,
  }

  // Auto-detect provider based on available environment variables
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.provider = "bedrock"
    config.region = process.env.AWS_REGION || "us-east-1"
    config.modelId = process.env.AWS_ARN
  } else if (process.env.ANTHROPIC_API_KEY) {
    config.provider = "anthropic"
    config.apiKey = process.env.ANTHROPIC_API_KEY
  } else if (process.env.OPENAI_API_KEY) {
    config.provider = "openai"
    config.apiKey = process.env.OPENAI_API_KEY
  }

  return new AIProvider(config)
}
