import { Logo } from "@/components/ui/logo"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"
import { User } from "@/lib/types"
import Link from "next/link"
import UserButton from "../../ui/userButton"
import DashboardNavbarSearch from "./search"

export default function DashboardNavbar({ userData }: { userData: User }) {
  return (
    <div className=" py-2 px-4 w-full flex items-center justify-between border-b border-border">
      <div className="flex items-center space-x-2">
        <Link
          href="/dashboard"
          className="ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none rounded-sm"
        >
          <Logo />
        </Link>
        <h1 className="text-xl">
          <span className="font-semibold">Sandbox</span>{" "}
          <span className="text-xs font-medium text-muted-foreground">
            by gitwit
          </span>
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        <DashboardNavbarSearch />
        <ThemeSwitcher />
        <UserButton userData={userData} />
      </div>
    </div>
  )
}
