import { env } from "@/lib/env"
import { hc } from "hono/client"
import type { AppType } from "."

/**
 * Hono client for making API requests to the server.
 *
 * Note: This can be used on both server and client.
 */
export const apiClient = hc<AppType>(env.NEXT_PUBLIC_APP_URL, {
  async headers() {
    if (typeof window === "undefined") {
      const { cookies } = require("next/headers")
      const cookieString = (await cookies()).toString()
      return {
        Cookie: cookieString,
      }
    }
    return {
      Cookie: document.cookie,
    } as Record<string, string>
  },
}).api
