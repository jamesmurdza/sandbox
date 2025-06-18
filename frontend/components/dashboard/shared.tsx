import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { projectTemplates } from "@/lib/data"
import { ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import Avatar from "../ui/avatar"
import Button from "../ui/customButton"

export default function DashboardSharedWithMe({
  shared,
}: {
  shared: {
    id: string
    name: string
    type: string
    author: string
    authorAvatarUrl: string
    sharedOn: string
  }[]
}) {
  return (
    <div className="grow p-4 flex flex-col">
      <div className="text-xl font-medium mb-8">Shared With Me</div>
      {shared.length > 0 ? (
        <div className="grow w-full">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-background">
                <TableHead>Sandbox Name</TableHead>
                <TableHead>Shared By</TableHead>
                <TableHead>Sent On</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shared.map((sandbox) => (
                <TableRow>
                  <TableCell>
                    <div className="font-medium flex items-center">
                      <Image
                        alt=""
                        src={
                          projectTemplates.find((p) => p.id === sandbox.type)
                            ?.icon ?? "/project-icons/node.svg"
                        }
                        width={20}
                        height={20}
                        className="mr-2"
                      />
                      {sandbox.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Avatar
                        name={sandbox.author}
                        avatarUrl={sandbox.authorAvatarUrl}
                        className="mr-2"
                      />
                      {sandbox.author}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(sandbox.sharedOn).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/code/${sandbox.id}`}>
                      <Button>
                        Open <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-muted-foreground text-sm">
          No sandboxes here. Get a friend to share one with you, and try out
          live collaboration!
        </div>
      )}
    </div>
  )
}
