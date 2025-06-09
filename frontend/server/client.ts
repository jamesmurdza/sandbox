import { hc } from "hono/client"
import { cookies } from "next/headers"
import type { AppType } from "."

/**
 * Hono client for making API requests to the server.
 *
 * Note: This must be used in server components only.
 */
if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error("NEXT_PUBLIC_APP_URL environment variable is not defined")
}

export const apiClient = hc<AppType>(process.env.NEXT_PUBLIC_APP_URL, {
  async headers() {
    const cookieString = (await cookies()).toString()
    return {
      Cookie: cookieString,
    } as Record<string, string>
  },
}).api
