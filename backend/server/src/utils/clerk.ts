import { Clerk } from "@clerk/clerk-sdk-node"
import "dotenv/config"

const clerkSecretKey = process.env.CLERK_SECRET_KEY
if (!clerkSecretKey) {
  console.warn(
    "Missing CLERK_SECRET_KEY in environment variables. Authentication will not work."
  )
}

export const clerkClient = clerkSecretKey
  ? Clerk({ secretKey: clerkSecretKey })
  : null

// Helper to check if Clerk is configured
export const isClerkConfigured = (): boolean => !!clerkClient

// Helper function to verify token and get user
export const verifyClerkToken = async (token: string) => {
  if (!isClerkConfigured() || !clerkClient || !token) {
    throw new Error("Clerk is not configured or token is missing")
  }

  const decoded = await clerkClient.verifyToken(token)
  const user = await clerkClient.users.getUser(decoded.sub)
  return { decoded, user }
}
