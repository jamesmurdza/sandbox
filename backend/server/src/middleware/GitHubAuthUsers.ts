import { drizzle } from "drizzle-orm/node-postgres"
import { NextFunction, Request, Response } from "express"
import * as schema from "../db/schema"

// Load the database credentials
import "dotenv/config"

// Initialize database
const db = drizzle(process.env.DATABASE_URL as string, { schema })

export async function requireGithubAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.auth?.userId
    const authToken = req.headers.authorization?.split(" ")[1]
    if (!userId || !authToken) {
      return res
        .status(401)
        .json({ error: "Unauthorized: Missing user ID or token" })
    }

    // Fetch user from database using Drizzle
    const user = await db.query.user.findFirst({
      where: (user, { eq }) => eq(user.id, userId),
    })

    if (!user?.githubToken) {
      return res.status(403).json({ error: "GitHub authentication required" })
    }
    next()
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" })
  }
}
