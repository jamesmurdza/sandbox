import { QueryClientProvider } from "@/components/query-client"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { PreviewProvider } from "@/context/PreviewContext"
import { SocketProvider } from "@/context/SocketContext"
import { ClerkProvider } from "@clerk/nextjs"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Analytics } from "@vercel/analytics/react"
import * as React from "react"

export function Providers({
  children,
  authToken,
}: {
  children: React.ReactNode
  authToken: string | null
}) {
  return (
    <QueryClientProvider>
      <ClerkProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
        >
          <SocketProvider token={authToken}>
            <PreviewProvider>{children}</PreviewProvider>
            <Analytics />
            <Toaster position="bottom-left" richColors />
          </SocketProvider>
        </ThemeProvider>
      </ClerkProvider>
      <ReactQueryDevtools />
    </QueryClientProvider>
  )
}

// From "./providers.js"
// "use client"
// import posthog from "posthog-js"
// import { PostHogProvider } from "posthog-js/react"

// if (typeof window !== "undefined") {
//   posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
//     api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
//   })
// }

// export function PHProvider({ children }) {
//   return <PostHogProvider client={posthog}>{children}</PostHogProvider>
// }
