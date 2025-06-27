"use client"

import dynamic from "next/dynamic"
import Loading from "./loading"

// Dynamically import the CodeEditor with no SSR
const CodeEditor = dynamic(() => import("./index"), {
  ssr: false,
  loading: () => <Loading />,
})

export default CodeEditor
