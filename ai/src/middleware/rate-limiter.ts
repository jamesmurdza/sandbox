import { db } from "@gitwit/db"
import { TIERS } from "@gitwit/web/lib/tiers"
import { RateLimiterMemory } from "rate-limiter-flexible"

/**
 * Rate limiter middleware that enforces per-user request limits based on their tier
 *
 * @example
 * ```typescript
 * const rateLimiter = new RateLimiter("user123")
 * await rateLimiter.checkLimit() // Throws if rate limit exceeded
 * ```
 */
export class RateLimiter {
  private limiter: RateLimiterMemory
  private userId: string

  /**
   * Creates a new rate limiter instance for a specific user
   *
   * @param userId - The unique identifier of the user to rate limit
   */
  constructor(userId: string) {
    this.userId = userId
    this.limiter = new RateLimiterMemory({
      points: 10, // Default, will be overridden
      duration: 60, // Per minute
    })
  }

  /**
   * Checks if the user has exceeded their rate limit based on their tier
   * Updates the rate limiter configuration with tier-specific limits
   *
   * @throws {Error} When user is not found in the database
   * @throws {Error} When rate limit is exceeded, includes retry-after time
   */
  async checkLimit(): Promise<void> {
    const user = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, this.userId),
    })

    if (!user) {
      throw new Error("User not found")
    }

    const tier = TIERS[user.tier as keyof typeof TIERS] || TIERS.FREE

    // Update limiter with tier-specific settings
    this.limiter = new RateLimiterMemory({
      points: tier.generations || 10,
      duration: 60,
    })

    try {
      await this.limiter.consume(this.userId)
    } catch (rejRes) {
      const retryAfter =
        rejRes && typeof rejRes === "object" && "msBeforeNext" in rejRes
          ? Math.round((rejRes as any).msBeforeNext / 1000)
          : 60
      throw new Error(`Rate limit exceeded. Try again in ${retryAfter} seconds`)
    }
  }
}
