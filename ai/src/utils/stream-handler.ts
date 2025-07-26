/**
 * Utility class for handling streaming responses from AI providers
 * Provides methods for parsing and creating streaming HTTP responses
 *
 * @example
 * ```typescript
 * // Parse a stream
 * for await (const chunk of StreamHandler.parseStream(stream)) {
 *   console.log(chunk)
 * }
 *
 * // Create a streaming response
 * const response = StreamHandler.createStreamResponse(stream)
 * ```
 */
export class StreamHandler {
  /**
   * Parses a ReadableStream into an async generator of string chunks
   * Handles text decoding and stream cleanup automatically
   *
   * @param stream - ReadableStream to parse
   * @yields String chunks from the stream
   *
   * @example
   * ```typescript
   * const stream = new ReadableStream(...)
   * for await (const chunk of StreamHandler.parseStream(stream)) {
   *   process(chunk)
   * }
   * ```
   */
  static async *parseStream(stream: ReadableStream): AsyncGenerator<string> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        yield decoder.decode(value, { stream: true })
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Creates an HTTP Response object with appropriate headers for AI text streaming
   * Sets up headers optimized for plain text streaming from AI models
   *
   * @param stream - ReadableStream to wrap in the response
   * @returns HTTP Response object configured for AI text streaming
   *
   * @example
   * ```typescript
   * const stream = new ReadableStream(...)
   * const response = StreamHandler.createStreamResponse(stream)
   * return response // Can be returned from API routes
   * ```
   */
  static createStreamResponse(stream: ReadableStream): Response {
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }
}
