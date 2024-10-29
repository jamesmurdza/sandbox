import * as dotenv from "dotenv"
import { R2Files } from "./types"

dotenv.config()

export const RemoteFileStorage = {
  getSandboxPaths: async (id: string) => {
    const res = await fetch(
      `${process.env.STORAGE_WORKER_URL}/api?sandboxId=${id}`,
      {
        headers: {
          Authorization: `${process.env.WORKERS_KEY}`,
        },
      }
    )
    const data: R2Files = await res.json()

    return data.objects.map((obj) => obj.key)
  },

  getFolder: async (folderId: string) => {
    const res = await fetch(
      `${process.env.STORAGE_WORKER_URL}/api?folderId=${folderId}`,
      {
        headers: {
          Authorization: `${process.env.WORKERS_KEY}`,
        },
      }
    )
    const data: R2Files = await res.json()

    return data.objects.map((obj) => obj.key)
  },

  fetchFileContent: async (fileId: string): Promise<string> => {
    try {
      const fileRes = await fetch(
        `${process.env.STORAGE_WORKER_URL}/api?fileId=${fileId}`,
        {
          headers: {
            Authorization: `${process.env.WORKERS_KEY}`,
          },
        }
      )
      return await fileRes.text()
    } catch (error) {
      console.error("ERROR fetching file:", error)
      return ""
    }
  },

  createFile: async (fileId: string) => {
    const res = await fetch(`${process.env.STORAGE_WORKER_URL}/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.WORKERS_KEY}`,
      },
      body: JSON.stringify({ fileId }),
    })
    return res.ok
  },

  renameFile: async (
    fileId: string,
    newFileId: string,
    data: string
  ) => {
    const res = await fetch(`${process.env.STORAGE_WORKER_URL}/api/rename`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.WORKERS_KEY}`,
      },
      body: JSON.stringify({ fileId, newFileId, data }),
    })
    return res.ok
  },

  saveFile: async (fileId: string, data: string) => {
    const res = await fetch(`${process.env.STORAGE_WORKER_URL}/api/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.WORKERS_KEY}`,
      },
      body: JSON.stringify({ fileId, data }),
    })
    return res.ok
  },

  deleteFile: async (fileId: string) => {
    const res = await fetch(`${process.env.STORAGE_WORKER_URL}/api`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${process.env.WORKERS_KEY}`,
      },
      body: JSON.stringify({ fileId }),
    })
    return res.ok
  },

  getProjectSize: async (id: string) => {
    const res = await fetch(
      `${process.env.STORAGE_WORKER_URL}/api/size?sandboxId=${id}`,
      {
        headers: {
          Authorization: `${process.env.WORKERS_KEY}`,
        },
      }
    )
    return (await res.json()).size
  }
}

export default RemoteFileStorage