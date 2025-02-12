"use client";

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react";
import { Github, LogOut } from "lucide-react";
import { useSocket } from "@/context/SocketContext";

export default function GitHubSyncButton({ sandboxName }: { sandboxName: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const { socket } = useSocket();
  const [githubUser, setGithubUser] = useState<string | null>(null);

  const handleGithubAuth = async () => {
    setIsLoading(true);
    socket?.emit("authenticateGithub", {}, (response: { authUrl: string }) => {
      if (response.authUrl) {
        window.location.href = response.authUrl;
      }
    });
  };

  const handleGithubLogout = async () => {
    setIsLoading(true);
    setGithubUser(null);
    setIsLoading(false);
    socket?.emit("githubAuthStateChange", { username: null });
  };

  useEffect(() => {
    const socketHandler = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");

      if (code && socket) {
        socket?.emit(
          "getGitHubUserName",
          { code },
          (response: { username: string }) => {
            if (response.username) {
              setGithubUser(response.username);
              setIsLoading(false);
              
              // After successful login, check sandbox repo status
              socket?.emit(
                "checkSandboxRepo",
                { repoName: sandboxName },
                (repoStatus: { 
                  existsInDB: boolean; 
                  repoExists: boolean;
                }) => {
                  console.log("Initial repo check after login:", repoStatus);

                  // If repo exists in DB but not in GitHub, delete it from DB
                  if (repoStatus.existsInDB && !repoStatus.repoExists) {
                    console.log("Deleting repo from DB since it doesn't exist in GitHub");
                    socket?.emit(
                      "deleteSandboxFromDB", 
                      { 
                        repoName: sandboxName,
                      },
                      (deleteResponse: { success: boolean; error?: string }) => {
                        if (deleteResponse.success) {
                          console.log("Successfully deleted from DB");
                        } else {
                          console.error("Failed to delete from DB:", deleteResponse.error);
                        }
                      }
                    );
                  }

                  // Emit event to update repo button state
                  socket?.emit("githubAuthStateChange", { 
                    username: response.username,
                    existsInDB: repoStatus.existsInDB,
                    repoExists: repoStatus.repoExists
                  });
                }
              );
            }
          }
        );
      }
    };

    if (socket) {
      const intervalId = setInterval(() => {
        clearInterval(intervalId);
        socketHandler();
      }, 3000);
    }
  }, [socket, sandboxName]);

  return (
    <>
      {githubUser ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isLoading}>
              <Github className="w-4 h-4 mr-2" />
              {githubUser}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={handleGithubLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button variant="outline" onClick={handleGithubAuth} disabled={isLoading}>
          <Github className="w-4 h-4 mr-2" />
          GitHub Login
        </Button>
      )}
    </>
  );
}