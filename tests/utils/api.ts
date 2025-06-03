import { getJwtToken } from "./auth"
import { env } from "./env"

type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

interface RequestOptions<TBody = undefined> {
  body?: TBody
  headers?: Record<string, string>
  signal?: AbortSignal
}

interface CachedToken {
  token: string
  expiresAt: number
  refreshPromise?: Promise<string>
}

class TokenCache {
  private cache: CachedToken | null = null
  private readonly BUFFER_TIME = 5000 // 5 seconds buffer before expiry
  private readonly MAX_RETRIES = 3
  private readonly RETRY_DELAY = 1000 // 1 second base delay


  async getToken(): Promise<string> {
    // If we have a valid cached token, return it
    if (this.isTokenValid()) {
      return this.cache!.token
    }

    // If token is expired or about to expire, but we're already refreshing, wait for that
    if (this.cache?.refreshPromise) {
      try {
        return await this.cache.refreshPromise
      } catch (error) {
        // If refresh failed, we'll try again below
        this.cache.refreshPromise = undefined
      }
    }

    // Need to get a new token
    return this.refreshToken()
  }

  async forceRefresh(): Promise<string> {
    this.invalidateCache()
    return this.refreshToken()
  }

  /**
   * Check if current cached token is still valid
   */
  private isTokenValid(): boolean {
    if (!this.cache) return false

    const now = Date.now()
    return now < (this.cache.expiresAt - this.BUFFER_TIME)
  }

  private async refreshToken(): Promise<string> {
    // Prevent multiple simultaneous refresh attempts
    if (this.cache?.refreshPromise) {
      return this.cache.refreshPromise
    }

    const refreshPromise = this.attemptTokenRefresh()

    // Store the promise to prevent concurrent refreshes
    if (this.cache) {
      this.cache.refreshPromise = refreshPromise
    } else {
      this.cache = {
        token: '',
        expiresAt: 0,
        refreshPromise
      }
    }

    try {
      const token = await refreshPromise

      // Update cache with new token
      this.cache = {
        token,
        expiresAt: Date.now() + 55000, // 55 seconds (5 second buffer from 60s expiry)
        refreshPromise: undefined
      }

      return token
    } catch (error) {
      // Clear the failed refresh promise
      if (this.cache) {
        this.cache.refreshPromise = undefined
      }
      throw error
    }
  }

  private async attemptTokenRefresh(): Promise<string> {
    let lastError: Error

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`Fetching JWT token (attempt ${attempt}/${this.MAX_RETRIES})`)
        return await getJwtToken()
      } catch (error) {
        lastError = error as Error
        console.warn(`Token fetch attempt ${attempt} failed:`, error)

        // Don't wait after the last attempt
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1) // Exponential backoff
          console.log(`Retrying in ${delay}ms...`)
          await this.sleep(delay)
        }
      }
    }

    throw new Error(`Failed to fetch JWT token after ${this.MAX_RETRIES} attempts.`)
  }

  private invalidateCache(): void {
    this.cache = null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }


  getCacheStatus(): {
    hasToken: boolean
    isValid: boolean
    expiresIn: number | null
    isRefreshing: boolean
  } {
    if (!this.cache) {
      return {
        hasToken: false,
        isValid: false,
        expiresIn: null,
        isRefreshing: false
      }
    }

    const now = Date.now()
    const expiresIn = Math.max(0, this.cache.expiresAt - now)

    return {
      hasToken: Boolean(this.cache.token),
      isValid: this.isTokenValid(),
      expiresIn,
      isRefreshing: Boolean(this.cache.refreshPromise)
    }
  }
}

// Create singleton instance
const tokenCache = new TokenCache()

async function request<TBody = undefined>(
  method: HTTPMethod,
  url: string,
  options: RequestOptions<TBody> = {}
): Promise<Response> {
  let response: Response

  try {
    // Get token from cache
    const jwt = await tokenCache.getToken()

    const headers: HeadersInit = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...options.headers,
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: options.signal,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    }

    response = await fetch(joinUrl(env.BACKEND_URL, "/api/", url), fetchOptions)

    // If we get a 401, the token might be invalid - try once with a fresh token
    if (response.status === 401) {
      console.log("Received 401, refreshing token and retrying...")

      const freshJwt = await tokenCache.forceRefresh()

      const retryHeaders: HeadersInit = {
        ...headers,
        Authorization: `Bearer ${freshJwt}`,
      }

      response = await fetch(joinUrl(env.BACKEND_URL, "/api/", url), {
        ...fetchOptions,
        headers: retryHeaders,
      })
    }

    return response
  } catch (error) {
    // Log cache status for debugging
    console.error("Request failed:", error)
    console.log("Token cache status:", tokenCache.getCacheStatus())
    throw error
  }
}

export const api = {
  get: (url: string, options?: RequestOptions) => request("GET", url, options),
  post: <TBody>(url: string, options: RequestOptions<TBody>) =>
    request("POST", url, options),
  put: <TBody>(url: string, options: RequestOptions<TBody>) =>
    request("PUT", url, options),
  delete: (url: string, options?: RequestOptions) =>
    request("DELETE", url, options),
  patch: <TBody>(url: string, options: RequestOptions<TBody>) =>
    request("PATCH", url, options),
}

export { tokenCache }

function joinUrl(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/(^\/+|\/+$)/g, "")) // Remove leading/trailing slashes
    .join("/") // Join with slashes
    .replace(/\/+/g, "/") // Ensure single slashes
}