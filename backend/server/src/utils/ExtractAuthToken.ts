import { Request } from "express"

export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader) return null
  const parts = authHeader.split(" ")
  return parts[1]
}