import { Button } from "@/components/ui/button";
import { useSocket } from "@/context/SocketContext";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export default function CreateRepoButton({ sandboxName }: { sandboxName: string }) {
  const [isCreating, setIsCreating] = useState(false);
  const [repoExists, setRepoExists] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Check repo status on mount
    checkRepoStatus();

    // Updated handler to accept both username and repo status
    const handleAuthSuccess = (data: { 
      username: string | null;
      existsInDB?: boolean;
      repoExists?: boolean;
    }) => {
      if (data.username) {
        // If we received repo status with the auth event, use it
        if (typeof data.existsInDB !== 'undefined' && typeof data.repoExists !== 'undefined') {
          if (data.existsInDB && data.repoExists) {
            setRepoExists(true);
          } else if (data.existsInDB && !data.repoExists) {
            console.log("Deleting from DB since repo not found in GitHub...");
            socket.emit("deleteSandboxFromDB", { repoName: sandboxName });
            setRepoExists(false);
          } else {
            setRepoExists(false);
          }
        } else {
          // If no repo status in auth event, check it
          checkRepoStatus();
        }
      } else {
        setRepoExists(false);
      }
    };
  
    socket.on("githubAuthStateChange", handleAuthSuccess);
  
    return () => {
      socket.off("githubAuthStateChange", handleAuthSuccess);
    };
  }, [socket, sandboxName]);

  const checkRepoStatus = () => {
    socket?.emit(
      "checkSandboxRepo",
      { repoName: sandboxName },
      (response: { existsInDB: boolean; repoExists: boolean }) => {
        console.log("checkSandboxRepo response:", response);
        
        if (response.existsInDB && response.repoExists) {
          setRepoExists(true);
        } else if (response.existsInDB && !response.repoExists) {
          console.log("Deleting from DB since repo not found in GitHub...");
          socket.emit("deleteSandboxFromDB", { repoName: sandboxName });
          setRepoExists(false);
        } else {
          setRepoExists(false);
        }
      }
    );
  };

  const handleCreateRepo = () => {
    setIsCreating(true);

    socket?.emit(
      "createRepo",
      { repoName: sandboxName },
      (response: { success: boolean; repoUrl?: string; error?: string }) => {
        if (response.success && response.repoUrl) {
          window.open(response.repoUrl, "_blank");
          setRepoExists(true);
        } else if (response.error) {
          alert(response.error);
        }
        setIsCreating(false);
      }
    );
  };

  const handleCreateCommit = () => {
    const commitMessage = prompt("Enter your commit message:", `New commit to ${sandboxName}`);
    if (!commitMessage) {
      alert("Commit message is required!");
      return;
    }

    setIsCreating(true);

    socket?.emit(
      "createCommit",
      { repoName: sandboxName, message: commitMessage },
      (response: { success: boolean; error?: string }) => {
        if (response.success) {
          alert("New commit created successfully!");
        } else {
          alert(response.error || "Failed to create commit");
        }
        setIsCreating(false);
      }
    );
  };

  return (
    <Button
      variant="outline"
      onClick={repoExists ? handleCreateCommit : handleCreateRepo}
      disabled={isCreating}
    >
      <Plus className="w-4 h-4 mr-2" />
      {isCreating ? "Processing..." : repoExists ? "Add New Commit" : "Create Repo"}
    </Button>
  );
}