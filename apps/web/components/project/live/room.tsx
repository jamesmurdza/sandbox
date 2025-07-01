"use client"

import { RoomProvider } from "@/liveblocks.config"

export function Room({
  id,
  children,
}: {
  id: string
  children: React.ReactNode
}) {
  return (
    <RoomProvider
      id={id}
      initialPresence={{
        cursor: null,
      }}
    >
      {/* <ClientSideSuspense fallback={<Loading />}> */}
      {children}
      {/* </ClientSideSuspense> */}
    </RoomProvider>
  )
}
