"use client"

import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

export default function LoadingPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get the authorization code from URL parameters
    const code = searchParams.get("code")
    console.log(
      "[GitHub Auth Loading] Detected on loading page with code:",
      code
    )

    if (code) {
      try {
        // Try to communicate with opener (parent window)
        if (window.opener && !window.opener.closed) {
          console.log(
            "[GitHub Auth Loading] Found opener window, attempting to communicate"
          )

          // Try to call a function on the parent window
          if (typeof window.opener.postMessage === "function") {
            console.log(
              "[GitHub Auth Loading] Sending message to parent window with code"
            )
            window.opener.postMessage({ type: "github-auth-code", code }, "*")
          } else {
            console.error(
              "[GitHub Auth Loading] Parent window doesn't have postMessage function"
            )
          }
        } else {
          console.error(
            "[GitHub Auth Loading] No opener window found or it's closed"
          )
        }
      } catch (error) {
        console.error(
          "[GitHub Auth Loading] Error communicating with parent window:",
          error
        )
      }
    } else {
      console.error("[GitHub Auth Loading] No code parameter found in URL")
    }

    // Close this window after a short delay if it wasn't closed by the parent
    const timer = setTimeout(() => {
      console.log("[GitHub Auth Loading] Closing window after timeout")
      window.close()
    }, 5000)

    return () => clearTimeout(timer)
  }, [searchParams])

  return (
    <div className="min-h-screen flex flex-col justify-center items-center">
      <Loader2 className="animate-spin size-12" />
      <p className="text-sm text-muted-foreground mt-4">
        Redirecting back to the app...
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        If you are not redirected automatically, please close this window and
        return to the app.
      </p>
    </div>
  )
}
