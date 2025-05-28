// import { Room } from "@/components/editor/live/room"
import CodeEditor from "@/components/editor/CodeEditorWrapper"
import Navbar from "@/components/editor/navbar"
import { PreviewProvider } from "@/context/PreviewContext"
import { SocketProvider } from "@/context/SocketContext"
import { TerminalProvider } from "@/context/TerminalContext"
import { github } from "@/hooks/github"
import { getQueryClient } from "@/lib/get-query-client"
import { fetchWithAuth } from "@/lib/server-utils"
import { Sandbox, User, UsersToSandboxes } from "@/lib/types"
import { auth, currentUser } from "@clerk/nextjs/server"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { notFound, redirect } from "next/navigation"

export const revalidate = 0

const getUserData = async (id: string) => {
  const userRes = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${id}`
  )
  const userData: User = await userRes.json()
  return userData
}

const getSandboxData = async (id: string) => {
  const sandboxRes = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox?id=${id}`
  )
  const sandboxData: Sandbox = await sandboxRes.json()
  return sandboxData
}

const getSharedUsers = async (usersToSandboxes: UsersToSandboxes[]) => {
  if (!usersToSandboxes) {
    return []
  }

  const shared = await Promise.all(
    usersToSandboxes.map(async (user) => {
      const userRes = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${user.userId}`
      )
      const userData: User = await userRes.json()
      return {
        id: userData.id,
        name: userData.name,
        avatarUrl: userData.avatarUrl,
      }
    })
  )

  return shared
}

export default async function CodePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const [user, authToken] = await Promise.all([
    currentUser(),
    (async () => (await auth()).getToken())(),
  ])

  const sandboxId = (await params).id
  const queryClient = getQueryClient()
  if (!user) {
    redirect("/")
  }

  const [userData, sandboxData] = await Promise.all([
    getUserData(user.id),
    getSandboxData(sandboxId),
  ])

  const [shared] = await Promise.all([
    getSharedUsers(sandboxData.usersToSandboxes),
    queryClient.prefetchQuery(
      github.githubUser.getOptions({
        userId: sandboxData.userId,
      })
    ),
    queryClient.prefetchQuery(
      github.repoStatus.getOptions({
        projectId: sandboxData.id,
      })
    ),
  ])

  const isOwner = sandboxData.userId === user.id
  const isSharedUser = shared.some((uts) => uts.id === user.id)

  if (!isOwner && !isSharedUser) {
    return notFound()
  }

  if (isSharedUser && sandboxData.visibility === "private") {
    return notFound()
  }

  return (
    <PreviewProvider>
      <SocketProvider token={authToken}>
        <TerminalProvider>
          {/* <Room id={sandboxId}> */}
          <div className="overflow-hidden overscroll-none w-screen h-screen grid [grid-template-rows:3.5rem_auto] bg-background">
            <Navbar
              userData={userData}
              sandboxData={sandboxData}
              shared={
                shared as { id: string; name: string; avatarUrl: string }[]
              }
            />
            <HydrationBoundary state={dehydrate(queryClient)}>
              <CodeEditor userData={userData} sandboxData={sandboxData} />
            </HydrationBoundary>
          </div>
          {/* </Room> */}
        </TerminalProvider>
      </SocketProvider>
    </PreviewProvider>
  )
}
