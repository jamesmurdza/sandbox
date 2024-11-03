import { Socket } from "socket.io"
import { z } from "zod"
import { Sandbox, User } from "./types"

// Middleware for socket authentication
export const socketAuth = async (socket: Socket, next: Function) => {
    // Define the schema for handshake query validation
    const handshakeSchema = z.object({
        userId: z.string(),
        sandboxId: z.string(),
        EIO: z.string(),
        transport: z.string(),
    })

    const q = socket.handshake.query
    const parseQuery = handshakeSchema.safeParse(q)

    // Check if the query is valid according to the schema
    if (!parseQuery.success) {
        next(new Error("Invalid request."))
        return
    }

    const { sandboxId, userId } = parseQuery.data
    // Fetch user data from the database
    const dbUser = await fetch(
        `${process.env.DATABASE_WORKER_URL}/api/user?id=${userId}`,
        {
            headers: {
                Authorization: `${process.env.WORKERS_KEY}`,
            },
        }
    )
    const dbUserJSON = (await dbUser.json()) as User

    // Fetch sandbox data from the database
    const dbSandbox = await fetch(
        `${process.env.DATABASE_WORKER_URL}/api/sandbox?id=${sandboxId}`,
        {
            headers: {
                Authorization: `${process.env.WORKERS_KEY}`,
            },
        }
    )
    const dbSandboxJSON = (await dbSandbox.json()) as Sandbox

    // Check if user data was retrieved successfully
    if (!dbUserJSON) {
        next(new Error("DB error."))
        return
    }

    // Check if the user owns the sandbox or has shared access
    const sandbox = dbUserJSON.sandbox.find((s) => s.id === sandboxId)
    const sharedSandboxes = dbUserJSON.usersToSandboxes.find(
        (uts) => uts.sandboxId === sandboxId
    )

    // If user doesn't own or have shared access to the sandbox, deny access
    if (!sandbox && !sharedSandboxes) {
        next(new Error("Invalid credentials."))
        return
    }

    // Set socket data with user information
    socket.data = {
        userId,
        sandboxId: sandboxId,
        isOwner: sandbox !== undefined,
        type: dbSandboxJSON.type
    }

    // Allow the connection
    next()
}
