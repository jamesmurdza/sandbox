"use client"

import dynamic from "next/dynamic"
import Loading from "./loading"

// Dynamically import the CodeEditor with no SSR
const ProjectWrapper = dynamic(() => import("./index"), {
  ssr: false,
  loading: () => <Loading />,
})

export { ProjectWrapper }
