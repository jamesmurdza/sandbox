import { AppBindings } from "@/lib/server/types"
import { createMiddleware } from "hono/factory"
import { db } from "../db"

export const githubAuth = createMiddleware<AppBindings>(async (c, next) => {
  const clerkUser = c.get("user")
  const dbUser = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.id, clerkUser.id),
  })
  if (!dbUser?.githubToken) {
    return c.json({ message: "GitHub authentication required" }, 403)
  }
  next()
})
