"use client"

import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClientProvider } from "@/lib/get-query-client"
import { AppProgressProvider as ProgressProvider } from "@bprogress/next"
import { ClerkProvider } from "@clerk/nextjs"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Analytics } from "@vercel/analytics/react"
import * as React from "react"
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider>
      <ClerkProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
        >
          <TooltipProvider>
            <ProgressProvider
              height="4px"
              delay={500}
              color="hsl(var(--foreground))"
              options={{ showSpinner: false }}
              shallowRouting
            >
              {children}
              <Analytics />
              <Toaster position="bottom-left" richColors />
            </ProgressProvider>
          </TooltipProvider>
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
