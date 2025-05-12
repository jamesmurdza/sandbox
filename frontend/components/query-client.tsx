"use client"

import { getQueryClient } from "@/lib/get-query-client"
import { QueryClientProvider as TanstackQueryClientProvider } from "@tanstack/react-query"
import * as React from "react"

export function QueryClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const queryClient = getQueryClient()
  // const token = await (await auth()).getToken()
  return (
    <TanstackQueryClientProvider client={queryClient}>
      {children}
    </TanstackQueryClientProvider>
  )
}
