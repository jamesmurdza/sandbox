/**
 * Custom error class for AI-related errors with additional context
 * Extends the standard Error class with error codes and HTTP status codes
 *
 * @example
 * ```typescript
 * throw new AIError("Rate limit exceeded", "RATE_LIMIT", 429)
 * ```
 */
export class AIError extends Error {
  code: string
  statusCode: number

  /**
   * Creates a new AI error instance
   *
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling (default: "AI_ERROR")
   * @param statusCode - HTTP status code (default: 500)
   */
  constructor(
    message: string,
    code: string = "AI_ERROR",
    statusCode: number = 500
  ) {
    super(message)
    this.name = "AIError"
    this.code = code
    this.statusCode = statusCode
  }
}

/**
 * Handles and normalizes various error types into AIError instances
 * Provides consistent error handling across the AI service
 *
 * @param error - The error to handle (can be any type)
 * @returns AIError instance with appropriate code and status
 *
 * @example
 * ```typescript
 * try {
 *   await someAIOperation()
 * } catch (error) {
 *   const aiError = handleAIError(error)
 *   console.log(aiError.code) // "RATE_LIMIT", "USAGE_LIMIT", etc.
 * }
 * ```
 */
export function handleAIError(error: unknown): AIError {
  if (error instanceof AIError) {
    return error
  }

  if (error instanceof Error) {
    if (error.message.includes("rate limit")) {
      return new AIError(error.message, "RATE_LIMIT", 429)
    }
    if (error.message.includes("limit reached")) {
      return new AIError(error.message, "USAGE_LIMIT", 429)
    }
    if (error.message.includes("unauthorized")) {
      return new AIError(error.message, "UNAUTHORIZED", 401)
    }
    return new AIError(error.message, "INTERNAL_ERROR", 500)
  }

  return new AIError("An unexpected error occurred", "UNKNOWN_ERROR", 500)
}
