import { User } from "@/lib/types"
import { generateUniqueUsername } from "@/lib/username-generator"
import { currentUser } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default async function AppAuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await currentUser()

  if (!user) {
    redirect("/")
  }

  const dbUser = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${user.id}`,
    {
      headers: {
        Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
      },
    }
  )
  const dbUserJSON = (await dbUser.json()) as User

  if (!dbUserJSON.id) {
    // Try to get GitHub username if available
    const githubUsername = user.externalAccounts.find(
      (account) => account.provider === "github"
    )?.username

    const username =
      githubUsername ||
      (await generateUniqueUsername(async (username) => {
        // Check if username exists in database
        const userCheck = await fetch(
          `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user/check-username?username=${username}`,
          {
            headers: {
              Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
            },
          }
        )
        const exists = await userCheck.json()
        return exists.exists
      }))

    const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.NEXT_PUBLIC_WORKERS_KEY}`,
      },
      body: JSON.stringify({
        id: user.id,
        name: user.firstName + " " + user.lastName,
        email: user.emailAddresses[0].emailAddress,
        username: username,
        avatarUrl: user.imageUrl || null,
        createdAt: new Date().toISOString(),
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error("Failed to create user:", error)
    } else {
      const data = await res.json()
      console.log("User created successfully:", data)
    }
  }

  return <>{children}</>
}
