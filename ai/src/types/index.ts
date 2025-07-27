import { z } from "zod"

/**
 * Tool definition interface for AI function calling
 */
export interface AITool {
  description: string
  parameters: z.ZodSchema<any>
  execute: (args: any) => Promise<any> | any
}

/**
 * Zod schema for validating AI request objects
 * Ensures all required fields are present and properly typed
 */
export const AIRequestSchema = z.object({
  /** Array of conversation messages between user, assistant, and system */
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().positive().optional(),
  maxSteps: z.number().positive().optional().default(1),
  stream: z.boolean().optional().default(true),
  tools: z.record(z.any()).optional(),
  context: z.object({
    userId: z.string(),
    projectId: z.string().optional(),
    templateType: z.string().optional(),
    activeFile: z.string().optional(),
    files: z.array(z.any()).optional(),
  }),
  mode: z.enum(["chat", "edit", "merge"]).default("chat"),
})

export type AIRequest = z.infer<typeof AIRequestSchema>

/**
 * Response interface for streaming AI responses
 */
export interface AIStreamResponse {
  stream: ReadableStream
  headers?: Record<string, string>
}

/**
 * Response interface for complete AI responses
 */
export interface AICompletionResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Configuration interface for AI provider setup
 */
export interface AIProviderConfig {
  provider: "anthropic" | "bedrock" | "openai"
  apiKey?: string
  region?: string
  modelId?: string
  baseURL?: string
  tools?: Record<string, AITool>
}

/**
 * Configuration interface for user tier settings
 * Defines limits and capabilities for different subscription tiers
 */
export interface AITierConfig {
  generations: number
  maxTokens: number
  model: string
  anthropicModel: string
  rateLimit?: {
    /** Number of requests allowed */
    requests: number
    /** Time window in seconds */
    window: number
  }
}
