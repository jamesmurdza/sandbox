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
      async (response: { tarBlob: string }) => {
        const { tarBlob } = response

        // Decode Base64 back to binary data
        const binary = atob(tarBlob)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
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
