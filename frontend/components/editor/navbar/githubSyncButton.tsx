"use client"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { Github } from "lucide-react"
import { useSocket } from "@/context/SocketContext"

export default function GitHubSyncButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { socket } = useSocket()
  const [githubUser, setGithubUser] = useState<string | null>(null) // Store username
  const handleGithubAuth = async () => {    
    setIsLoading(true)
    socket?.emit("authenticateGithub", {}, (response: { authUrl: string }) => {
      if (response.authUrl) {
        window.location.href = response.authUrl
      }
    })
  }

  useEffect(() => {
    const socketHandler = () => {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      
      if (code && socket) {
        socket?.emit('authenticateGithubWithCode', { code })
      }
    }

    if (socket) {
      const intervalId = setInterval(() => {
      
          clearInterval(intervalId)
          socketHandler()
        
      }, 3000)
    }
  }, [socket])

  return (
    <Button 
      variant="outline" 
      onClick={handleGithubAuth}
      disabled={isLoading}
    >
      <Github className="w-4 h-4 mr-2" />
      {githubUser || "GitHub Login"}  {/* Display the username if authenticated, otherwise show "GitHub Login" */}
    </Button>
  )
}