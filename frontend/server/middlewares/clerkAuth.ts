import { env } from '@/lib/env'
import { AppBindings } from '@/lib/server/types'
import { createClerkClient, verifyToken } from '@clerk/backend'
import { createMiddleware } from 'hono/factory'

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY })

export const clerkAuth = createMiddleware<AppBindings>(async (c, next) => {
  const token = c.req.header("Authorization")?.split(" ")[1]
  if (!token) {
    return c.json({ error: "Unauthorized: No token provided" }, 401)
  }
  try {
    const decoded = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY
    })
    const user = await clerk.users.getUser(decoded.sub)
    // Attach the user to the request object
    c.set("user", user)

    next()
  } catch (error) {
    return c.json({ error: "Unauthorized: Invalid token" }, 401)
  }
})
