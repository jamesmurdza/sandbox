"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User } from "@/lib/types"
import { useClerk } from "@clerk/nextjs"
import {
  Crown,
  LayoutDashboard,
  LogOut,
  Sparkles,
  User as UserIcon,
} from "lucide-react"
import Link from "next/link"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Avatar from "./avatar"
import { Button } from "./button"
import { TIERS } from "@/lib/tiers"

// TODO: Remove this once we have a proper tier system
const TIER_INFO = {
  FREE: {
    color: "text-gray-500",
    icon: Sparkles,
    limit: TIERS.FREE.generations,
  },
  PRO: {
    color: "text-blue-500",
    icon: Crown,
    limit: TIERS.PRO.generations,
  },
  ENTERPRISE: {
    color: "text-purple-500",
    icon: Crown,
    limit: TIERS.ENTERPRISE.generations,
  },
} as const

export default function UserButton({
  userData: initialUserData,
}: {
  userData: User
}) {
  const [userData, setUserData] = useState<User>(initialUserData)
  const [isOpen, setIsOpen] = useState(false)
  const { signOut } = useClerk()
  const router = useRouter()

  const fetchUserData = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/user?id=${userData.id}`,
        {
          cache: "no-store",
        }
      )
      if (res.ok) {
        const updatedUserData = await res.json()
        setUserData(updatedUserData)
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchUserData()
    }
  }, [isOpen])

  const tierInfo =
    TIER_INFO[userData.tier as keyof typeof TIER_INFO] || TIER_INFO.FREE
  const TierIcon = tierInfo.icon
  const usagePercentage = Math.floor(
    ((userData.generations || 0) * 100) / tierInfo.limit
  )

  const handleUpgrade = async () => {
    router.push(`/@${userData.username}`)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger>
        <Avatar name={userData.name} avatarUrl={userData.avatarUrl} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <div className="py-1.5 px-2 w-full">
          <div className="font-medium">{userData.name}</div>
          <div className="text-sm w-full overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
            {userData.email}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link href={"/dashboard"}>
            <LayoutDashboard className="mr-2 size-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" asChild>
          <Link href={`/@${userData.username}`}>
            <UserIcon className="mr-2 size-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <div className="py-1.5 px-2 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TierIcon className={`h-4 w-4 ${tierInfo.color}`} />
              <span className="text-sm font-medium">
                {userData.tier || "FREE"} Plan
              </span>
            </div>
            {(userData.tier === "FREE" || userData.tier === "PRO") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs border-b hover:border-b-foreground"
                onClick={handleUpgrade}
              >
                Upgrade
              </Button>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <div className="w-full">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>AI Usage</span>
              <span>
                {userData.generations}/{tierInfo.limit}
              </span>
            </div>

            <div className="rounded-full w-full h-2 overflow-hidden bg-secondary mb-1">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  usagePercentage > 90
                    ? "bg-red-500"
                    : usagePercentage > 75
                    ? "bg-yellow-500"
                    : tierInfo.color.replace("text-", "bg-")
                }`}
                style={{
                  width: `${Math.min(usagePercentage, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />

        {/* <DropdownMenuItem className="cursor-pointer">
          <Pencil className="mr-2 size-4" />
          <span>Edit Profile</span>
        </DropdownMenuItem> */}
        <DropdownMenuItem
          onClick={() => signOut(() => router.push("/"))}
          className="!text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 size-4" />
          <span>Log Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
