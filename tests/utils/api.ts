import axios from "axios"
import { getCachedToken, getJwtToken } from "./auth"
import { env } from "./env"
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

interface RequestOptions<TBody = undefined> {
  body?: TBody
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function request<TBody = undefined>(
  method: HTTPMethod,
  url: string,
  options: RequestOptions<TBody> = {}
): Promise<Response> {
  const jwt = await getJwtToken()

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

  return fetch(joinUrl(env.BACKEND_URL, "/api/", url), fetchOptions)
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
export const apiClient = axios.create({
  baseURL: `${env.BACKEND_URL}/api`,
  validateStatus: () => true, // Accept all status codes
  adapter: "fetch",
})
// Add request interceptor
apiClient.interceptors.request.use(async (config) => {
  const token = await getCachedToken()
  config.headers.Authorization = `Bearer ${token}`
  config.headers["Content-Type"] = "application/json"
  config.headers["Accept"] = "application/json"
  return config
})
// // Add response interceptor
// apiClient.interceptors.response.use((response) => {
//   try {
//     if (typeof response.data === "string") {
//       response.data = JSON.parse(response.data)
//     }
//   } catch {
//     /* empty */
//   }
//   return response
// })

function joinUrl(...parts: string[]): string {
  return parts
    .map((part) => part.replace(/(^\/+|\/+$)/g, "")) // Remove leading/trailing slashes
    .join("/") // Join with slashes
    .replace(/\/+/g, "/") // Ensure single slashes
}
