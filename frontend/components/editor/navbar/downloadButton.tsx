import JSZip from 'jszip'
import { useSocket } from "@/context/SocketContext"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export default function DownloadButton({ name }: { name: string }) {
  const { socket } = useSocket()

  const handleDownload = async () => {
    socket?.emit("downloadFiles", {}, async (response: {files: {path: string, content: string}[]}) => {
      const zip = new JSZip()
      
      response.files.forEach(file => {
        zip.file(file.path, file.content)
      })
      
      const blob = await zip.generateAsync({type: "blob"})
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.zip`
      a.click()
      window.URL.revokeObjectURL(url)
    })
  }


  return (
    <Button variant="outline" onClick={handleDownload}>
      <Download className="w-4 h-4 mr-2" />
      Download
    </Button>
  )
}
