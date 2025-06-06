import { generateUniqueUsername } from "@/lib/username-generator"
import { apiClient } from "@/server/client"
import { currentUser } from "@clerk/nextjs/server"
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

  const dbUser = await apiClient.user.$get({
    query: {},
  })
  if (!dbUser.ok) {
    redirect("/?error=User not found or not authenticated")
  }
  const dbUserJSON = (await dbUser.json()).data

  if (!dbUserJSON.id) {
    // Try to get GitHub username if available
    const githubUsername = user.externalAccounts.find(
      (account) => account.provider === "github"
    )?.username

    const username =
      githubUsername ||
      (await generateUniqueUsername(async (username) => {
        // Check if username exists in database
        const userCheck = await apiClient.user["check-username"].$get({
          query: {
            username,
          },
        })
        const exists = await userCheck.json()
        return exists.exists
      }))

    const res = await apiClient.user.$post({
      json: {
        id: user.id,
        name: user.firstName + " " + user.lastName,
        email: user.emailAddresses[0].emailAddress,
        username: username,
        avatarUrl: user.imageUrl || null,
        createdAt: new Date(),
        githubToken: null, // Set to null initially, can be updated later
      },
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
