import { createRouter } from "@/lib/server/create-app"
import jsonContent from "@/lib/server/utils"
import { describeRoute } from "hono-openapi"
import { validator as zValidator } from "hono-openapi/zod"
import z from "zod"
import { CONTAINER_TIMEOUT } from "../../../backend/server/src/utils/constants"

import { Project } from "../../../backend/server/src/services/Project"

export const fileRouter = createRouter()
  // Get file content
  .get(
    "/",
    describeRoute({
      operationId: "getFile",
      tags: ["File"],
      parameters: [
        {
          in: "query",
          name: "fileId",
          required: true,
          schema: {
            type: "string",
          },
        },
        {
          in: "query",
          name: "projectId",
          required: true,
          schema: {
            type: "string",
          },
        },
      ],
      responses: {
        200: {
          description: "File content",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  content: { type: "string" },
                },
              },
            },
          },
        },
        404: {
          description: "File not found",
        },
        500: {
          description: "Error reading file",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        fileId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { fileId, projectId } = c.req.valid("query")

      // Initialize project
      const project = new Project(projectId)
      await project.initialize()

      try {
        if (!project.fileManager) {
          throw new Error("File manager not available")
        }

        const file = await project.fileManager.getFile(fileId)
        return c.json({ message: "success", data: file })
      } catch (error) {
        console.error(`Error reading file ${fileId}:`, error)
        const errorMessage =
          error instanceof Error ? error.message : "Failed to read file"
        return c.json({ error: errorMessage }, 500)
      } finally {
        // Clean up project resources if needed
        await project.disconnect()
      }
    }
  )

  // Save file content
  .post(
    "/save",
    describeRoute({
      tags: ["File"],
      description: "Save file content",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                fileId: { type: "string" },
                content: { type: "string" },
                projectId: { type: "string" },
              },
              required: ["fileId", "content", "projectId"],
            },
          },
        },
      },
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "File save response"
        ),
        400: { description: "Invalid request" },
      },
    }),
    zValidator(
      "json",
      z.object({
        fileId: z.string(),
        content: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { fileId, content, projectId } = c.req.valid("json")

      // Initialize project
      const project = new Project(projectId)
      await project.initialize()

      try {
        // Apply rate limiting
        // const user = c.get("user") as User
        // await saveFileRL.consume(user.id, 1)

        if (!project.fileManager) {
          throw new Error("File manager not available")
        }

        await project.fileManager.saveFile(fileId, content)
        return c.json(
          {
            success: true,
            message: "File saved successfully",
          },
          200
        )
      } catch (error) {
        console.error("Error saving file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to save file: ${errorMessage}`,
          },
          500
        )
      } finally {
        // Clean up project resources
        await project.disconnect()
      }
    }
  )

  // Create a new file
  .post(
    "/create",
    describeRoute({
      tags: ["File"],
      description: "Create a new file",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                projectId: { type: "string" },
              },
              required: ["name", "projectId"],
            },
          },
        },
      },
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "File creation response"
        ),
        400: { description: "Invalid request" },
      },
    }),
    zValidator(
      "json",
      z.object({
        name: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { name, projectId } = c.req.valid("json")

      // Initialize project
      const project = new Project(projectId)
      await project.initialize()

      try {
        // Apply rate limiting
        // const user = c.get("user") as User
        // await createFileRL.consume(user.id, 1)

        if (!project.fileManager) {
          throw new Error("File manager not available")
        }

        const success = await project.fileManager.createFile(name)
        return c.json(
          {
            success,
            message: success
              ? "File created successfully"
              : "Failed to create file",
          },
          200
        )
      } catch (error) {
        console.error("Error creating file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to create file: ${errorMessage}`,
          },
          500
        )
      } finally {
        // Clean up project resources if needed
        await project.disconnect()
      }
    }
  )

  // Delete a file
  .delete(
    "/",
    describeRoute({
      tags: ["File"],
      description: "Delete a file",
      parameters: [
        {
          in: "query",
          name: "fileId",
          required: true,
          schema: { type: "string" },
        },
        {
          in: "query",
          name: "projectId",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "File deletion response"
        ),
        404: { description: "File not found" },
      },
    }),
    zValidator(
      "query",
      z.object({
        fileId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { fileId, projectId } = c.req.valid("query")

      const project = new Project(projectId)
      await project.initialize()

      try {
        // Apply rate limiting
        // const user = c.get("user") as User
        // await deleteFileRL.consume(user.id, 1)

        const result = await project.fileManager?.deleteFile(fileId)
        return c.json(
          {
            success: true,
            message: "File deleted successfully",
            data: result,
          },
          200
        )
      } catch (error) {
        console.error("Error deleting file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to delete file: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Move a file
  .post(
    "/move",
    describeRoute({
      tags: ["File"],
      description: "Move a file to a different folder",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                fileId: { type: "string" },
                folderId: { type: "string" },
                projectId: { type: "string" },
              },
              required: ["fileId", "folderId", "projectId"],
            },
          },
        },
      },
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "File move response"
        ),
        400: { description: "Invalid request" },
      },
    }),
    zValidator(
      "json",
      z.object({
        fileId: z.string(),
        folderId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { fileId, folderId, projectId } = c.req.valid("json")

      const project = new Project(projectId)
      await project.initialize()

      try {
        const result = await project.fileManager?.moveFile(fileId, folderId)
        return c.json(
          {
            success: true,
            message: "File moved successfully",
            data: result,
          },
          200
        )
      } catch (error) {
        console.error("Error moving file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to move file: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Rename a file
  .post(
    "/rename",
    describeRoute({
      tags: ["File"],
      description: "Rename a file",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                fileId: { type: "string" },
                newName: { type: "string" },
                projectId: { type: "string" },
              },
              required: ["fileId", "newName", "projectId"],
            },
          },
        },
      },
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "File rename response"
        ),
        400: { description: "Invalid request" },
      },
    }),
    zValidator(
      "json",
      z.object({
        fileId: z.string(),
        newName: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { fileId, newName, projectId } = c.req.valid("json")

      const project = new Project(projectId)
      await project.initialize()

      try {
        await project.fileManager?.renameFile(fileId, newName)
        return c.json(
          {
            success: true,
            message: "File renamed successfully",
          },
          200
        )
      } catch (error) {
        console.error("Error renaming file:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to rename file: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Create a folder
  .post(
    "/folder",
    describeRoute({
      tags: ["File"],
      description: "Create a new folder",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                projectId: { type: "string" },
              },
              required: ["name", "projectId"],
            },
          },
        },
      },
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "Folder creation response"
        ),
        400: { description: "Invalid request" },
      },
    }),
    zValidator(
      "json",
      z.object({
        name: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { name, projectId } = c.req.valid("json")

      const project = new Project(projectId)
      await project.initialize()

      try {
        // Apply rate limiting
        // const user = c.get("user") as User
        // await createFolderRL.consume(user.id, 1)

        await project.fileManager?.createFolder(name)
        return c.json(
          {
            success: true,
            message: "Folder created successfully",
          },
          200
        )
      } catch (error) {
        console.error("Error creating folder:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to create folder: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Delete a folder
  .delete(
    "/folder",
    describeRoute({
      tags: ["File"],
      description: "Delete a folder",
      parameters: [
        {
          in: "query",
          name: "folderId",
          required: true,
          schema: { type: "string" },
        },
        {
          in: "query",
          name: "projectId",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          "Folder deletion response"
        ),
        404: { description: "Folder not found" },
      },
    }),
    zValidator(
      "query",
      z.object({
        folderId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { folderId, projectId } = c.req.valid("query")

      const project = new Project(projectId)
      await project.initialize()

      try {
        const result = await project.fileManager?.deleteFolder(folderId)
        return c.json(
          {
            success: true,
            message: "Folder deleted successfully",
            data: result,
          },
          200
        )
      } catch (error) {
        console.error("Error deleting folder:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to delete folder: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Get folder contents
  .get(
    "/folder",
    describeRoute({
      tags: ["File"],
      description: "Get folder contents",
      parameters: [
        {
          in: "query",
          name: "folderId",
          required: true,
          schema: { type: "string" },
        },
        {
          in: "query",
          name: "projectId",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: jsonContent(
          z.object({
            id: z.string(),
            name: z.string(),
            files: z.array(z.any()),
            folders: z.array(z.any()),
          }),
          "Folder contents response"
        ),
        404: { description: "Folder not found" },
      },
    }),
    zValidator(
      "query",
      z.object({
        folderId: z.string(),
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { folderId, projectId } = c.req.valid("query")

      const project = new Project(projectId)
      await project.initialize()

      try {
        const folder = await project.fileManager?.getFolder(folderId)
        if (!folder) {
          return c.json({ error: "Folder not found" }, 404)
        }
        return c.json(folder, 200)
      } catch (error) {
        console.error("Error getting folder:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            error: `Failed to get folder: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Download files as archive
  .get(
    "/download",
    describeRoute({
      operationId: "downloadFilesArchive",
      tags: ["File"],
      parameters: [
        {
          in: "query",
          name: "projectId",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: {
          description: "Download files as archive",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  archive: { type: "string" },
                },
              },
            },
          },
        },
        500: {
          description: "Error downloading files",
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { projectId } = c.req.valid("query")
      const project = new Project(projectId)
      await project.initialize()

      try {
        if (!project.fileManager) {
          throw new Error("No file manager")
        }

        const archive = await project.fileManager.getFilesForDownload()
        return c.json({ archive })
      } catch (error) {
        console.error("Error downloading files:", error)
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to download files",
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Get file tree
  .get(
    "/tree",
    describeRoute({
      tags: ["File"],
      description: "Get the complete file tree structure",
      parameters: [
        {
          in: "query",
          name: "projectId",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
            data: z.any(), // File tree structure
          }),
          "File tree response"
        ),
        500: { description: "Error getting file tree" },
      },
    }),
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
      })
    ),
    async (c) => {
      const { projectId } = c.req.valid("query")

      const project = new Project(projectId)
      await project.initialize()

      try {
        const fileTree = await project.fileManager?.getFileTree()
        return c.json(
          {
            success: true,
            data: fileTree,
          },
          200
        )
      } catch (error) {
        console.error("Error getting file tree:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to get file tree: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )

  // Handle heartbeat
  .post(
    "/heartbeat",
    describeRoute({
      tags: ["File"],
      description: "Handle heartbeat from socket connection",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                projectId: { type: "string" },
                isOwner: { type: "boolean" },
              },
              required: ["projectId", "isOwner"],
            },
          },
        },
      },
      responses: {
        200: jsonContent(
          z.object({
            success: z.boolean(),
          }),
          "Heartbeat response"
        ),
        500: { description: "Error handling heartbeat" },
      },
    }),
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        isOwner: z.boolean(),
      })
    ),
    async (c) => {
      const { projectId, isOwner } = c.req.valid("json")

      const project = new Project(projectId)
      await project.initialize()

      try {
        // Only keep the container alive if the owner is still connected
        if (isOwner) {
          try {
            await project.container?.setTimeout(CONTAINER_TIMEOUT)
          } catch (error) {
            console.error("Failed to set container timeout:", error)
            return c.json({ success: false }, 500)
          }
        }
        return c.json({ success: true }, 200)
      } catch (error) {
        console.error("Error handling heartbeat:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to handle heartbeat: ${errorMessage}`,
          },
          500
        )
      } finally {
        await project.disconnect()
      }
    }
  )
