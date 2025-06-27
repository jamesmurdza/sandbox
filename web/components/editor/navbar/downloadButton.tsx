// React component for download button
import { apiClient } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { toast } from "sonner"

export default function DownloadButton({
  name,
  projectId,
}: {
  name: string
  projectId: string
}) {
  const handleDownload = async () => {
    try {
      const response = await apiClient.file.download.$get({
        query: {
          projectId,
        },
      })

      const data = await response.json()
      if ("error" in data) {
        throw new Error(data.error)
      }

      const bytes = Uint8Array.from(atob(data.archive), (char) =>
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to download files"
      )
    }
  }

  return (
    <Button variant="outline" onClick={handleDownload}>
      <Download className="w-4 h-4 mr-2" />
      Download
    </Button>
  )
}
