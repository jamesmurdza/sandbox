import { NextFunction, Request, Response } from "express"

// This allows us to add a custom property (`authToken`) to the Express Request type.
// This way, TypeScript knows about `req.authToken` and won't give you type errors.
declare module "express-serve-static-core" {
  interface Request {
    authToken?: string | null
  }
}

/**
 * Express middleware to extract the Bearer token from the Authorization header.
 * - If the header is present, parses and attaches the token to `req.authToken`.
 * - If missing, sets `req.authToken` to null.
 * - Always calls `next()` to continue the middleware chain.
 */
export function attachAuthToken(req: Request, _: Response, next: NextFunction) {
  const authHeader = req.headers.authorization // Get the Authorization header
  if (!authHeader) {
    req.authToken = null // If missing, set authToken to null
    return next()
  }
  const parts = authHeader.split(" ") // Split the header (expected: "Bearer <token>")
  req.authToken = parts[1] ?? null // Assign the token part, or null if missing
  next()
}
