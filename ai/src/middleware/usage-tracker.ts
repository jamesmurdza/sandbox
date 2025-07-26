import { db, schema } from "@gitwit/db"
import { TIERS } from "@gitwit/web/lib/tiers"
import { eq } from "drizzle-orm"

/**
 * Usage tracker middleware that monitors and enforces monthly AI generation limits per user
 * Automatically resets usage counters at the beginning of each month
 *
 * @example
 * ```typescript
 * const tracker = new UsageTracker("user123")
 * await tracker.checkUsage() // Throws if monthly limit exceeded
 * await tracker.increment() // Increments usage counter
 * ```
 */
export class UsageTracker {
  private userId: string

  /**
   * Creates a new usage tracker instance for a specific user
   *
   * @param userId - The unique identifier of the user to track usage for
   */
  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Checks if the user has exceeded their monthly usage limit based on their tier
   * Automatically resets the usage counter if a new month has started
   *
   * @throws {Error} When user is not found in the database
   * @throws {Error} When monthly AI generation limit is reached for the user's tier
   */
  async checkUsage(): Promise<void> {
    // Check and reset monthly usage if needed
    const now = new Date()
    const user = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, this.userId),
    })

    if (!user) {
      throw new Error("User not found")
    }

    // Reset monthly usage if needed
    if (user.lastResetDate) {
      const lastUpdate = new Date(user.lastResetDate)
      if (
        lastUpdate.getMonth() !== now.getMonth() ||
        lastUpdate.getFullYear() !== now.getFullYear()
      ) {
        await db
          .update(schema.user)
          .set({
            generations: 0,
            lastResetDate: now,
          })
          .where(eq(schema.user.id, this.userId))
      }
    }

    // Check tier limits
    const tier = TIERS[user.tier as keyof typeof TIERS] || TIERS.FREE
    if (user.generations >= tier.generations) {
      throw new Error(
        `AI generation limit reached for ${user.tier || "FREE"} tier`
      )
    }
  }

  /**
   * Increments the user's AI generation counter by 1
   * Updates the last reset date to track monthly usage periods
   *
   * @throws {Error} When user is not found in the database
   */
  async increment(): Promise<void> {
    const user = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, this.userId),
    })

    if (!user) {
      throw new Error("User not found")
    }

    await db
      .update(schema.user)
      .set({
        generations: user.generations + 1,
        lastResetDate: new Date(),
      })
      .where(eq(schema.user.id, this.userId))
  }
}
