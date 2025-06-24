import { createStore, StateCreator as ZStateCreator } from "zustand/vanilla"
import { createEditorSlice, EditorSlice } from "./slices/editor"

type Slices = EditorSlice
export type StateCreator<T> = ZStateCreator<Slices, [], [], T>
const createAppStore = () =>
  createStore<Slices>()((...a) => ({
    ...createEditorSlice(...a),
  }))

export { createAppStore, type Slices }
