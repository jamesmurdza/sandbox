// React component for download button
import { Button } from "@/components/ui/button"
import { useSocket } from "@/context/SocketContext"
import { Download } from "lucide-react"

export default function DownloadButton({ name }: { name: string }) {
  const { socket } = useSocket()

  const handleDownload = async () => {
    socket?.emit(
      "downloadFiles",
      { timestamp: Date.now() },
      async ({ tarBlob }: { tarBlob: string }) => {
        // Decode Base64 to a blob
        const bytes = Uint8Array.from(atob(tarBlob), (char) =>
          char.charCodeAt(0)
        )
        const blob = new Blob([bytes], { type: "application/gzip" })

        // Create URL and download
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${name}.tar.gz`
        a.click()
        window.URL.revokeObjectURL(url)
      }
    )
  }

  return (
    <Button variant="outline" onClick={handleDownload}>
      <Download className="w-4 h-4 mr-2" />
      Download
    </Button>
  )
}
