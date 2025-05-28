import Landing from "@/components/landing"
import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function Home() {
  const user = await currentUser()

  if (user) {
    redirect("/dashboard")
  }

  return <Landing />
}
