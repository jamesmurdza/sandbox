import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"

export function useGitHubLoadingStates() {
  const queryClient = useQueryClient()
  const [loadingStates, setLoadingStates] = useState({
    isGettingAuthUrl: false,
    isLoggingIn: false,
    isSyncingToGithub: false,
    isCreatingRepo: false,
    isDeletingRepo: false,
    isPulling: false,
    isLoggingOut: false,
  })

  const latestStatesRef = useRef(loadingStates)

  useEffect(() => {
    const updateLoadingStates = () => {
      const mutations = queryClient.getMutationCache().getAll()

      const newStates = {
        isGettingAuthUrl: mutations.some(
          (m) =>
            m.options.mutationKey?.[0] === "github" &&
            m.options.mutationKey?.[1] === "gethAuthUrl" &&
            m.state.status === "pending"
        ),
        isLoggingIn: mutations.some(
          (m) =>
            m.options.mutationKey?.[0] === "github" &&
            m.options.mutationKey?.[1] === "login" &&
            m.state.status === "pending"
        ),
        isSyncingToGithub: mutations.some(
          (m) =>
            m.options.mutationKey?.[0] === "github" &&
            m.options.mutationKey?.[1] === "createCommit" &&
            m.state.status === "pending"
        ),
        isCreatingRepo: mutations.some(
          (m) =>
            m.options.mutationKey?.[0] === "github" &&
            m.options.mutationKey?.[1] === "createRepo" &&
            m.state.status === "pending"
        ),
        isDeletingRepo: mutations.some(
          (m) =>
            m.options.mutationKey?.[0] === "github" &&
            m.options.mutationKey?.[1] === "removeRepo" &&
            m.state.status === "pending"
        ),
        isPulling: mutations.some(
          (m) =>
            m.options.mutationKey?.[0] === "github" &&
            m.options.mutationKey?.[1] === "pullFromGithub" &&
            m.state.status === "pending"
        ),
        isLoggingOut: mutations.some(
          (m) =>
            m.options.mutationKey?.[0] === "github" &&
            m.options.mutationKey?.[1] === "logout" &&
            m.state.status === "pending"
        ),
      }

      // Only update if states actually changed
      const hasChanged = Object.keys(newStates).some(
        (key) =>
          newStates[key as keyof typeof newStates] !==
          latestStatesRef.current[key as keyof typeof latestStatesRef.current]
      )

      if (hasChanged) {
        latestStatesRef.current = newStates
        setLoadingStates(newStates)
      }
    }

    // Initial update
    updateLoadingStates()

    // Subscribe to mutation cache changes
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      updateLoadingStates()
    })

    return unsubscribe
  }, [queryClient])

  return loadingStates
}
