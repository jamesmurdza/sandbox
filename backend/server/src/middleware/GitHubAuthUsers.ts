import { Request, Response, NextFunction } from "express"

export async function requireGithubAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.auth?.userId
    const authToken = req.headers.authorization?.split(" ")[1]
    if (!userId || !authToken) {
      return res.status(401).json({ error: "Unauthorized: Missing user ID or token" })
    }

    // Fetch user from your backend API
    const userRes = await fetch(`${process.env.SERVER_URL}/api/user?id=${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    const user = await userRes.json()
    if (!user?.githubToken) {
      return res.status(403).json({ error: "GitHub authentication required" })
    }
    next()
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" })
  }
}