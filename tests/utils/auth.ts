import axios, { AxiosError } from "axios"
import dotenv from "dotenv"
import { env } from "./env"

// Load environment variables from .env file
dotenv.config()

// Clerk API endpoint for session management
const CLERK_API_URL = "https://api.clerk.com/v1/sessions"

/**
 * Response interface for Clerk session creation
 */
export interface CreateSessionResponse {
  id: string // Unique session identifier
  object: string // Object type
  status: string // Session status
  last_active_at: number // Timestamp of last activity
  expire_at: number // Session expiration timestamp
}

/**
 * Response interface for session token
 */
interface SessionTokenResponse {
  jwt: string // JSON Web Token for authentication
}

/**
 * Class for handling Clerk authentication operations
 */
export class ClerkAuth {
  private readonly secretKey: string // Clerk API secret key

  /**
   * Initialize ClerkAuth with a secret key
   * @param secretKey - Optional Clerk API secret key. If not provided, uses CLERK_SECRET_KEY from environment
   * @throws {Error} If neither secretKey parameter nor CLERK_SECRET_KEY environment variable is provided
   */
  constructor(secretKey?: string) {
    if (!secretKey && !process.env.CLERK_SECRET_KEY) {
      throw new Error("Clerk secret key is required")
    }
    this.secretKey = secretKey || process.env.CLERK_SECRET_KEY!
  }

  /**
   * Creates a test session for a given user
   * @param userId - The ID of the user to create a session for
   * @returns Promise resolving to session creation response
   * @throws {Error} If the session creation fails
   */
  async createTestSession(userId: string): Promise<CreateSessionResponse> {
    try {
      const response = await axios.post<CreateSessionResponse>(
        CLERK_API_URL,
        { user_id: userId },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
        }
      )
      return response.data
    } catch (error) {
      const axiosError = error as AxiosError
      throw new Error(
        `Failed to create session: ${
          axiosError.response?.data || axiosError.message
        }`
      )
    }
  }

  /**
   * Generates a session token for the specified session
   * @param sessionId - The ID of the session to generate a token for
   * @returns Promise resolving to a JWT token string
   * @throws {Error} If token generation fails or the session is invalid
   */
  async getSessionToken(sessionId: string): Promise<string> {
    try {
      const response = await axios.post<SessionTokenResponse>(
        `${CLERK_API_URL}/${sessionId}/tokens`,
        {
          expires_in_seconds: 3600,
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            "Content-Type": "application/json",
          },
        }
      )

      return response.data.jwt
    } catch (error) {
      const axiosError = error as AxiosError
      throw new Error(
        `Failed to generate session token: ${
          axiosError.response?.data || axiosError.message
        }`
      )
    }
  }
}

export const getJwtToken = async () => {
  // Since the token expires in 60 seconds, we need to create a new one for each test
  const auth = new ClerkAuth()
  const session = await auth.createTestSession(env.CLERK_TEST_USER_ID!)
  const jwt = await auth.getSessionToken(session.id)
  return jwt
}

// tokenManager.ts
let cachedToken: string | null = null
let tokenExpiresAt: number | null = null // Unix timestamp in ms

export async function getCachedToken(): Promise<string> {
  const now = Date.now()

  // Return cached token if valid
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt) {
    return cachedToken
  }

  // Get a new token
  const jwt = await getJwtToken()
  console.log("Token fetched:", jwt)

  // Set new expiration (buffered 5 seconds before actual expiry)
  // Assume the token is valid for 60 seconds
  const EXPIRES_IN_MS = 60 * 1000
  tokenExpiresAt = now + EXPIRES_IN_MS - 5000
  cachedToken = jwt

  return jwt
}
