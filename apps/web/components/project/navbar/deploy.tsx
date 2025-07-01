"use client"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTerminal } from "@/context/TerminalContext"
import { Sandbox, User } from "@/lib/types"
import { Globe } from "lucide-react"
import { useEffect, useState } from "react"

export default function DeployButtonModal({
  userData,
  data,
}: {
  userData: User
  data: Sandbox
}) {
  const { deploy, getAppExists } = useTerminal()
  const [isDeploying, setIsDeploying] = useState(false)
  const [isDeployed, setIsDeployed] = useState(false)
  const [deployButtonVisible, setDeployButtonEnabled] = useState(false)

  useEffect(() => {
    const checkDeployment = async () => {
      if (getAppExists) {
        const exists = await getAppExists(data.id)
        setDeployButtonEnabled(exists.success)
        setIsDeployed((exists.success && exists.exists) ?? false)
      }
    }
    checkDeployment()
  }, [data.id, getAppExists])

  const handleDeploy = () => {
    if (isDeploying) {
      setIsDeploying(false)
    } else {
      setIsDeploying(true)
      deploy(() => {
        setIsDeploying(false)
        setIsDeployed(true)
      })
    }
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          {deployButtonVisible && (
            <Button variant="outline">
              <Globe className="w-4 h-4 mr-2" />
              Deploy
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent
          className="p-4 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl rounded-lg shadow-lg"
          style={{ backgroundColor: "rgb(10,10,10)", color: "white" }}
        >
          <h3 className="font-semibold text-gray-300 mb-2">Domains</h3>
          <div className="flex flex-col gap-4">
            <DeploymentOption
              icon={<Globe className="text-gray-500 w-5 h-5" />}
              domain={`${data.id}.gitwit.app`}
              timestamp="Deployed 1m ago"
              user={userData.name}
              isDeployed={isDeployed}
            />
          </div>
          <Button
            variant="outline"
            className="mt-4 w-full bg-[#0a0a0a] text-white hover:bg-[#262626]"
            onClick={handleDeploy}
          >
            {isDeploying ? "Deploying..." : isDeployed ? "Update" : "Deploy"}
          </Button>
        </PopoverContent>
      </Popover>
    </>
  )
}

function DeploymentOption({
  icon,
  domain,
  timestamp,
  user,
  isDeployed,
}: {
  icon: React.ReactNode
  domain: string
  timestamp: string
  user: string
  isDeployed: boolean
}) {
  return (
    <div className="flex flex-col gap-2 w-full text-left p-2 rounded-md border border-gray-700 bg-gray-900">
      <div className="flex items-start gap-2 relative">
        <div className="flex-shrink-0">{icon}</div>
        {isDeployed ? (
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-300 hover:underline"
          >
            {domain}
          </a>
        ) : (
          <span className="font-semibold text-gray-300">{domain}</span>
        )}
      </div>
      <p className="text-sm text-gray-400 mt-0 ml-7">
        {isDeployed ? `${timestamp} • ${user}` : "Never deployed"}
      </p>
    </div>
  )
}
