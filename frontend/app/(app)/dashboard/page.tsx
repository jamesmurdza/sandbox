import Dashboard from "@/components/dashboard"
import Navbar from "@/components/dashboard/navbar"
import { fetchWithAuth } from "@/lib/server-utils"
import { User } from "@/lib/types"
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const user = await currentUser()

  if (!user) {
    redirect("/")
  }

  const userRes = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${user.id}`
  )
  const userData = (await userRes.json()) as User

  const sharedRes = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/sandbox/share?id=${user.id}`
  )
  const shared = (await sharedRes.json()) as {
    id: string
    name: string
    type: "react" | "node"
    author: string
    sharedOn: Date
    authorAvatarUrl: string
  }[]

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden overscroll-none">
      <Navbar userData={userData} />
      <Dashboard sandboxes={userData.sandbox} shared={shared} />
    </div>
  )
}
