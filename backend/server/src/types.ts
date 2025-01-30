// DB Types

export type User = {
  id: string
  name: string
  email: string
  generations: number
  sandbox: Project[]
  usersToSandboxes: UsersToSandboxes[]
}

export type Project = {
  id: string
  name: string
  type: "reactjs" | "vanillajs" | "nextjs" | "streamlit"
  visibility: "public" | "private"
  createdAt: Date
  userId: string
  usersToSandboxes: UsersToSandboxes[]
}

export type UsersToSandboxes = {
  userId: string
  sandboxId: string
  sharedOn: Date
}

export type TFolder = {
  id: string
  type: "folder"
  name: string
  children: (TFile | TFolder)[]
}

export type TFile = {
  id: string
  type: "file"
  name: string
}

export type TFileData = {
  id: string
  data: string
}

export type R2Files = {
  objects: R2FileData[]
  truncated: boolean
  delimitedPrefixes: any[]
}

export type R2FileData = {
  storageClass: string
  uploaded: string
  checksums: any
  httpEtag: string
  etag: string
  size: number
  version: string
  key: string
}

export type R2FileBody = R2FileData & {
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer: Promise<ArrayBuffer>
  text: Promise<string>
  json: Promise<any>
  blob: Promise<Blob>
}
export interface DokkuResponse {
  success: boolean
  apps?: string[]
  message?: string
}
