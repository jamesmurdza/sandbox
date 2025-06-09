import { User as ClerkUser } from "@clerk/clerk-sdk-node"
import { Socket as SocketIO } from "socket.io"

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
  containerId: string
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

// Add Socket.IO type declarations
declare module "socket.io" {
  interface Socket {
    auth?: {
      userId: string
      user: ClerkUser
    }
  }
}

// Export a custom socket type that includes our auth property
export type CustomSocket = SocketIO & {
  auth?: {
    userId: string
    user: ClerkUser
  }
}

export interface GitHubTokenResponse {
  access_token: string
}

export interface UserData {
  githubToken: string
}
export interface ApiResponse {
  success: boolean
  code: number
  message: string
  data: any
}
