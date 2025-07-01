import { Loader2 } from "lucide-react"

export default function LoadingPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center">
      <Loader2 className="animate-spin size-12" />
    </div>
  )
}
