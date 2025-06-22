import { TTab } from "@/lib/types"
import { StateCreator } from ".."

interface EditorSlice {
  // States
  tabs: TTab[]
  activeTab?: TTab
  activeTabContent: string
  unsavedAlert: boolean
  toBeRemovedTab?: TTab

  // Actions
  setTabs: (tabs: TTab[] | ((previousTabs: TTab[]) => TTab[])) => void
  setActiveTab: (tabs: TTab | ((previousTabs?: TTab) => TTab)) => void
  addTab: (tab: TTab) => void
  removeTab: (tab: TTab, override?: boolean) => void
  setActiveTabContent: (text: string) => void
  setUnsavedAlert: (state: boolean) => void
}

const createEditorSlice: StateCreator<EditorSlice> = (set, get) => ({
  //   #region State
  tabs: [],
  activeTabContent: "",
  unsavedAlert: false,

  // #endregion

  //   #region Actions
  setTabs: (tabsOrUpdater) => {
    set((state) => ({
      tabs:
        typeof tabsOrUpdater === "function"
          ? tabsOrUpdater(state.tabs)
          : tabsOrUpdater,
    }))
  },
  setActiveTab: (tabOrUpdater) => {
    set((state) => ({
      activeTab:
        typeof tabOrUpdater === "function"
          ? tabOrUpdater(state.activeTab)
          : tabOrUpdater,
    }))
  },
  addTab(tab) {
    set((state) => {
      const exists = state.tabs.some((t) => t.id === tab.id)
      return exists ? { tabs: state.tabs } : { tabs: [...state.tabs, tab] }
    })
  },
  removeTab: (tab, override = false) => {
    set((state) => {
      // Early return if tab doesn't exist
      const tabExists = state.tabs.some((t) => tabsMatch(t, tab))
      if (!tabExists) return state

      // Check for unsaved changes (only if not overriding)
      if (!override && !tab.saved) {
        return {
          tabs: state.tabs,
          activeTab: state.activeTab,
          unsavedAlert: true,
          toBeRemovedTab: tab,
        }
      }

      // Filter out matching tabs
      const filteredTabs = state.tabs.filter((t) => !tabsMatch(t, tab))

      // Determine next active tab
      const nextActiveTab = getNextActiveTab(state.tabs, tab, state.activeTab)

      return {
        tabs: filteredTabs,
        activeTab: nextActiveTab,
        unsavedAlert: false,
        toBeRemovedTab: undefined,
      }
    })
  },
  setActiveTabContent(text) {
    set({
      activeTabContent: text,
    })
  },
  setUnsavedAlert(state) {
    set({
      unsavedAlert: state,
    })
  },
  //   #endregion
})

export { createEditorSlice, type EditorSlice }

const getFileName = (name: string): string => name.split("/").pop() || ""

const tabsMatch = (tab1: TTab, tab2: TTab): boolean => {
  // Current implementation checks both ID and filename for safety
  const fileName1 = getFileName(tab1.name)
  const fileName2 = getFileName(tab2.name)

  return tab1.id === tab2.id && fileName1 === fileName2
}

const getNextActiveTab = (
  tabs: TTab[],
  removingTab: TTab,
  currentActiveTab: TTab | undefined
): TTab | undefined => {
  if (tabs.length <= 1) return undefined

  const index = tabs.findIndex((t) => tabsMatch(t, removingTab))
  if (index === -1) return currentActiveTab

  if (currentActiveTab && !tabsMatch(currentActiveTab, removingTab)) {
    return currentActiveTab
  }

  return index < tabs.length - 1 ? tabs[index + 1] : tabs[index - 1]
}
