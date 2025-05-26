import ProfilePage from "@/components/profile"
import ProfileNavbar from "@/components/profile/navbar"
import { fetchWithAuth } from "@/lib/server-utils"
import { SandboxWithLiked, User } from "@/lib/types"
import { currentUser } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username: rawUsername } = await params
  const username = decodeURIComponent(rawUsername).replace("@", "")
  const loggedInClerkUser = await currentUser()

  const [profileOwnerResponse, loggedInUserResponse] = await Promise.all([
    fetchWithAuth(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?username=${username}&currentUserId=${loggedInClerkUser?.id}`
    ),
    fetchWithAuth(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${loggedInClerkUser?.id}`
    ),
  ])

  const profileOwner = (await profileOwnerResponse.json()) as User
  const loggedInUser = (await loggedInUserResponse.json()) as User

  if (!Boolean(profileOwner?.id)) {
    notFound()
  }
  const publicSandboxes: SandboxWithLiked[] = []
  const privateSandboxes: SandboxWithLiked[] = []

  profileOwner?.sandbox?.forEach((sandbox) => {
    if (sandbox.visibility === "public") {
      publicSandboxes.push(sandbox as SandboxWithLiked)
    } else if (sandbox.visibility === "private") {
      privateSandboxes.push(sandbox as SandboxWithLiked)
    }
  })

  const isUserLoggedIn = Boolean(loggedInUser?.id)
  return (
    <section>
      <ProfileNavbar userData={loggedInUser} />
      <ProfilePage
        publicSandboxes={publicSandboxes}
        privateSandboxes={
          profileOwner?.id === loggedInUser.id ? privateSandboxes : []
        }
        profileOwner={profileOwner}
        loggedInUser={isUserLoggedIn ? loggedInUser : null}
      />
    </section>
  )
}
