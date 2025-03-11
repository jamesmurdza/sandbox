import Dashboard from "@/components/dashboard"
import Navbar from "@/components/dashboard/navbar"
import { User } from "@/lib/types"
import { currentUser } from "@clerk/nextjs"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const user = await currentUser()

  if (!user) {
    redirect("/")
  }

  const userRes = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${user.id}`
  )
  const userData = (await userRes.json()) as User

  const sharedRes = await fetch(
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

  const openRouterSettingsRes = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/openrouter/settings?id=${user.id}`
  )
  const openRouterSettings = await openRouterSettingsRes.json()

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden overscroll-none">
      <Navbar userData={userData} openRouterSettings={openRouterSettings} />
      <Dashboard sandboxes={userData.sandbox} shared={shared} />
      <div className="p-4">
        <h2 className="text-xl font-semibold">OpenRouter Settings</h2>
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">
            Enabled
          </label>
          <input
            type="checkbox"
            checked={openRouterSettings.enabled}
            className="mt-1"
            readOnly
          />
        </div>
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">
            API Key
          </label>
          <input
            type="text"
            value={openRouterSettings.apiKey}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            readOnly
          />
        </div>
        <div className="mt-2">
          <label className="block text-sm font-medium text-gray-700">
            Model
          </label>
          <input
            type="text"
            value={openRouterSettings.model}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            readOnly
          />
        </div>
      </div>
    </div>
  )
}
