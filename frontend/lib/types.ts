// DB Types

import { KNOWN_PLATFORMS } from "./constants"

export type User = {
  id: string
  name: string
  email: string
  username: string
  avatarUrl: string | null
  createdAt: string
  generations: number
  bio: string | null
  personalWebsite: string | null
  links: UserLink[]
  tier: "FREE" | "PRO" | "ENTERPRISE"
  tierExpiresAt: string
  lastResetDate: string
  sandbox: Sandbox[]
  usersToSandboxes: UsersToSandboxes[]
}

export type KnownPlatform = (typeof KNOWN_PLATFORMS)[number]
export type UserLink = {
  url: string
  platform: KnownPlatform
}

export type Sandbox = {
  id: string
  name: string
  type: string
  visibility: "public" | "private"
  createdAt: string
  userId: string
  likeCount: number
  viewCount: number
  // usersToSandboxes: UsersToSandboxes[]
}
export type SandboxWithLiked = Sandbox & {
  liked: boolean
}
export type UsersToSandboxes = {
  userId: string
  sandboxId: string
  sharedOn: string
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

export type TTab = TFile & {
  saved: boolean
}

export type TFileData = {
  id: string
  data: string
}

// Granular diff types for line-by-line change management
export interface LineChange {
  id: string // unique identifier for this change
  lineNumber: number // line number in the combined view
  type: 'added' | 'removed'
  content: string
  blockId: string // groups related changes together
  accepted: boolean | null // null = pending, true = accepted, false = rejected
  originalLineNumber?: number // original line number for tracking
  timestamp?: number // when this change was processed
}

export interface DiffBlock {
  id: string
  startLine: number
  endLine: number
  changes: LineChange[]
  type: 'modification' | 'addition' | 'deletion'
  originalStartLine?: number // original line number where this block started
}

export interface GranularDiffState {
  blocks: DiffBlock[]
  originalCode: string
  mergedCode: string
  allAccepted: boolean
  timestamp?: number // when this state was created
  lineMapping?: Map<number, number> // original -> document line mapping
  version?: number // state version for tracking changes
}
