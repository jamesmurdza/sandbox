import { env } from "@/lib/env"
import { hc } from "hono/client"
import type { AppType } from "."

/**
 * Hono client for making API requests to the server from client components.
 *
 * Note: This must be used in client components only.
 */
export const apiClient = hc<AppType>(env.NEXT_PUBLIC_APP_URL, {
  headers() {
    return {
      Cookie: document.cookie,
    } as Record<string, string>
  },
}).api
