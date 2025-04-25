"use client"

import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { PreviewProvider } from "@/context/PreviewContext"
import { SocketProvider } from "@/context/SocketContext"
import { getQueryClient } from "@/lib/get-query-client"
import { ClerkProvider } from "@clerk/nextjs"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Analytics } from "@vercel/analytics/react"
import * as React from "react"

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
        >
          <SocketProvider>
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
