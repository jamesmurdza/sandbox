"use client";

import { Button } from "@/components/ui/button";
import { useSocket } from "@/context/SocketContext";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function CreateRepoButton({ sandboxName }: { sandboxName: string }) {
  const [isCreating, setIsCreating] = useState(false);
  const [repoExists, setRepoExists] = useState(false); // Track if the repo exists
  const { socket } = useSocket();

  const handleCreateRepo = () => {
    setIsCreating(true);

    socket?.emit(
      "createRepo",
      { repoName: sandboxName }, // Use sandboxName for repo name
      (response: { success: boolean; repoUrl?: string; error?: string }) => {
        if (response.success && response.repoUrl) {
          window.open(response.repoUrl, "_blank");
        } else if (response.error === "Repository already exists") {
          setRepoExists(true); // Mark that the repo exists
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
          console.error("Failed to create commit:", response.error);
        }
        setIsCreating(false); // Reset the loading state
      }
    );
  };

  return (
    <Button
      variant="outline"
      onClick={repoExists ? handleCreateCommit : handleCreateRepo} // Call the correct function based on repoExists
      disabled={isCreating}
    >
      <Plus className="w-4 h-4 mr-2" />
      {isCreating ? "Processing..." : repoExists ? "Add New Commit" : "Create Repo"}
    </Button>
  );
}
