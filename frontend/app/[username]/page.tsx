import ProfilePage from "@/components/profile"
import ProfileNavbar from "@/components/profile/navbar"
import { SandboxWithLiked } from "@/lib/types"
import { apiClient } from "@/server/client"
import { notFound } from "next/navigation"

export default async function Page({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username: rawUsername } = await params
  const username = decodeURIComponent(rawUsername).replace("@", "")

  const [profileOwnerResponse, loggedInUserResponse] = await Promise.all([
    apiClient.user.$get({
      query: {
        username,
      },
    }),
    apiClient.user.$get({
      query: {},
    }),
  ])
  if (!profileOwnerResponse.ok || !loggedInUserResponse.ok) {
    notFound()
  }

  const profileOwner = (await profileOwnerResponse.json()).data
  const loggedInUser = (await loggedInUserResponse.json()).data

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
