import axios from "axios"
import { getCachedToken } from "./auth"
import { env } from "./env"

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
