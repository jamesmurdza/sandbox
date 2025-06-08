import { hc } from "hono/client"
import type { AppType } from "."

/**
 * Hono client for making API requests to the server from client components.
 *
 * Note: This must be used in client components only.
 */
if (!process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error("NEXT_PUBLIC_APP_URL environment variable is not defined")
}

export const apiClient = hc<AppType>(process.env.NEXT_PUBLIC_APP_URL, {
  headers() {
    return {
      Cookie: document.cookie,
    } as Record<string, string>
  },
}).api
