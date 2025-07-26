/**
 * Context interface for logger instances
 * Allows attaching metadata to log messages
 */
export interface LogContext {
  userId?: string
  projectId?: string
  provider?: string
  model?: string
  mode?: string
  [key: string]: any
}

/**
 * Logger class with contextual logging capabilities
 * Provides structured logging for the AI service with automatic context injection
 *
 * @example
 * ```typescript
 * const logger = new Logger()
 * logger.setContext({ userId: "user123", provider: "anthropic" })
 * logger.info("Request processed") // Includes context in output
 * ```
 */
class Logger {
  private context: LogContext = {}

  /**
   * Sets the context for all subsequent log messages
   *
   * @param context - Context object to merge with existing context
   */
  setContext(context: LogContext) {
    this.context = { ...this.context, ...context }
  }

  /**
   * Clears all context from the logger instance
   */
  clearContext() {
    this.context = {}
  }

  /**
   * Formats a log message with level, context, and additional data
   *
   * @param level - Log level string (DEBUG, INFO, WARN, ERROR)
   * @param message - Main log message
   * @param extra - Additional data to include in the log
   * @returns Formatted log string
   */
  private format(level: string, message: string, extra?: any): string {
    const contextStr =
      Object.keys(this.context).length > 0
        ? ` ${Object.entries(this.context)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ")}`
        : ""
    const extraStr = extra ? ` ${JSON.stringify(extra)}` : ""

    return `[AI] → ${level}: ${message}${contextStr}${extraStr}`
  }

  /**
   * Logs a debug message
   *
   * @param message - Debug message to log
   * @param extra - Additional debug data
   */
  debug(message: string, extra?: any) {
    console.debug(this.format("DEBUG", message, extra))
  }

  /**
   * Logs an info message
   *
   * @param message - Info message to log
   * @param extra - Additional info data
   */
  info(message: string, extra?: any) {
    console.info(this.format("INFO", message, extra))
  }

  /**
   * Logs a warning message
   *
   * @param message - Warning message to log
   * @param extra - Additional warning data
   */
  warn(message: string, extra?: any) {
    console.warn(this.format("WARN", message, extra))
  }

  /**
   * Logs an error message with optional error object
   *
   * @param message - Error message to log
   * @param error - Error object or additional error data
   * @param extra - Additional context data
   */
  error(message: string, error?: any, extra?: any) {
    const errorDetails =
      error instanceof Error
        ? {
            message: error.message,
            ...extra,
          }
        : { error, ...extra }

    console.error(this.format("ERROR", message, errorDetails))
  }

  /**
   * Creates a child logger with additional context
   * The child logger inherits the parent's context and adds new context
   *
   * @param context - Additional context for the child logger
   * @returns New logger instance with combined context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger()
    childLogger.context = { ...this.context, ...context }
    return childLogger
  }
}

/**
 * Default logger instance for the AI service
 * Can be used directly or extended with child loggers for specific contexts
 */
export const logger = new Logger()
