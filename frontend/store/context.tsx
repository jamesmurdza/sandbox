"use client"

import { type ReactNode, createContext, useContext, useRef } from "react"
import { useStore } from "zustand"

import { type Slices, createAppStore } from "@/store"

export type CounterStoreApi = ReturnType<typeof createAppStore>

export const CounterStoreContext = createContext<CounterStoreApi | undefined>(
  undefined
)

export interface AppStoreProviderProps {
  children: ReactNode
}

export const AppStoreProvider = ({ children }: AppStoreProviderProps) => {
  const storeRef = useRef<CounterStoreApi | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createAppStore()
  }

  return (
    <CounterStoreContext.Provider value={storeRef.current}>
      {children}
    </CounterStoreContext.Provider>
  )
}

export const useAppStore = <T,>(selector: (store: Slices) => T): T => {
  const counterStoreContext = useContext(CounterStoreContext)

  if (!counterStoreContext) {
    throw new Error(`useAppStore must be used within AppStoreProvider`)
  }

  return useStore(counterStoreContext, selector)
}
