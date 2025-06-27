import { apiClient } from "@/api/client"
import Dashboard from "@/components/dashboard"
import Navbar from "@/components/dashboard/navbar"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const [userRes, sharedRes] = await Promise.all([
    apiClient.user.$get({
      query: {},
    }),
    apiClient.project.share.$get(),
  ])
  if (!userRes.ok || !sharedRes.ok) {
    redirect("/")
  }
  const userData = (await userRes.json()).data
  const shared = (await sharedRes.json()).data

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden overscroll-none">
      <Navbar userData={userData} />
      <Dashboard sandboxes={userData.sandbox} shared={shared} />
    </div>
  )
}
