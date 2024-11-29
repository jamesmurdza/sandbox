import { currentUser } from "@clerk/nextjs"

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    if (!user) {
      return new Response("Unauthorized", { status: 401 })
    }

    const { tier } = await request.json()

    // handle payment processing here

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_DATABASE_WORKER_URL}/api/user/update-tier`,
      {
        method: "POST",
        headers: {
          Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          tier,
          tierExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        }),
      }
    )

    if (!response.ok) {
      throw new Error("Failed to upgrade tier")
    }

    return new Response("Tier upgraded successfully")
  } catch (error) {
    console.error("Tier upgrade error:", error)
    return new Response(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 }
    )
  }
}
