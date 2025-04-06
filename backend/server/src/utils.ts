import { Clerk } from "@clerk/clerk-sdk-node"
import "dotenv/config"

const clerkSecretKey = process.env.CLERK_SECRET_KEY
if (!clerkSecretKey) {
  console.warn(
    "Missing CLERK_SECRET_KEY in environment variables. Authentication will not work."
  )
}
export class LockManager {
  private locks: { [key: string]: Promise<any> }

  constructor() {
    this.locks = {}
  }

  async acquireLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    if (!this.locks[key]) {
      this.locks[key] = new Promise<T>(async (resolve, reject) => {
        try {
          const result = await task()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          delete this.locks[key]
        }
      })
    }
    return await this.locks[key]
  }
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
