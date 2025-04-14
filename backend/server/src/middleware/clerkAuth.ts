import { Clerk, User } from "@clerk/clerk-sdk-node"
import dotenv from "dotenv"
import { NextFunction, Request, Response } from "express"

dotenv.config()

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY })

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        user: User
      }
    }
  }
}

// Express middleware for Clerk authentication
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" })
  }

  try {
    const decoded = await clerk.verifyToken(token)
    const user = await clerk.users.getUser(decoded.sub)
    // Attach the user to the request object
    req.auth = {
      userId: user.id,
      user: user,
    }

    next()
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" })
  }
}
