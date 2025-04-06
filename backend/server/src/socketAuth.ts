import { Socket } from "socket.io"
import { z } from "zod"
import { Project, User } from "./types"
import { isClerkConfigured, verifyClerkToken } from "./utils"

// Middleware for socket authentication
export const socketAuth = async (socket: Socket, next: Function) => {
  try {
    // Define the schema for handshake query/auth validation
    const handshakeSchema = z.object({
      token: z.string(), // Clerk token
      sandboxId: z.string(),
    })

    const q = (socket.handshake.auth as any) || socket.handshake.query
    console.log("Socket handshake query:", q)
    const parseQuery = handshakeSchema.safeParse(q)

    // Check if the query is valid according to the schema
    if (!parseQuery.success) {
      next(new Error("Invalid request: Missing required fields"))
      return
    }

    const { sandboxId: projectId, token } = parseQuery.data

    // Verify Clerk token and get user
    if (!isClerkConfigured()) {
      next(new Error("Authentication system not configured"))
      return
    }

    try {
      const { user: clerkUser } = await verifyClerkToken(token)
      const userId = clerkUser.id

      // Fetch project data from the database
      const dbProject = await fetch(
        `${process.env.SERVER_URL}/api/sandbox?id=${projectId}`
      )
      const dbProjectJSON = (await dbProject.json()) as Project

      if (!dbProjectJSON) {
        next(new Error("Project not found"))
        return
      }

      // Fetch user data to verify project access
      const dbUser = await fetch(
        `${process.env.SERVER_URL}/api/user?id=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      const dbUserJSON = (await dbUser.json()) as User
      console.log("DB User JSON:", dbUserJSON)

      if (!dbUserJSON) {
        next(new Error("User not found"))
        return
      }

      // Check if the user owns the project or has shared access
      const project = dbUserJSON.sandbox.find((s) => s.id === projectId)
      const sharedProjects = dbUserJSON.usersToSandboxes.find(
        (uts) => uts.sandboxId === projectId
      )

      // If user doesn't own or have shared access to the project, deny access
      if (!project && !sharedProjects) {
        next(new Error("Unauthorized: No access to this project"))
        return
      }

      // Set socket data with user information
      socket.data = {
        userId,
        projectId,
        isOwner: project !== undefined,
        type: dbProjectJSON.type,
        containerId: dbProjectJSON.containerId,
      }

      // Also set Clerk auth data
      socket.auth = {
        userId,
        user: clerkUser,
      }
      console.log(`Socket Authenticated user: ${userId}`)
      // Allow the connection
      next()
    } catch (error) {
      console.error("Token verification failed:", error)
      next(new Error("Authentication failed"))
    }
  } catch (error) {
    console.error("Socket authentication error:", error)
    next(new Error("Internal server error"))
  }
}
