import { env } from "@/lib/env"
import { createRouter } from "@/lib/server/create-app"
import jsonContent from "@/lib/server/utils"
import { db } from "@gitwit/db"
import { sandbox as sandboxSchema, user } from "@gitwit/db/schema"
import { Project } from "@gitwit/lib/services/Project"
import { and, eq } from "drizzle-orm"
import { describeRoute } from "hono-openapi"
import { validator as zValidator } from "hono-openapi/zod"
import z from "zod"
import { githubAuth } from "../middlewares/githubAuth"

export const githubRouter = createRouter()
  // #region GET /auth_url
  .get(
    "/auth_url",
    describeRoute({
      tags: ["Github"],
      description: "Get GitHub authentication URL",
      responses: {
        200: jsonContent(z.object({}), "GitHub authentication URL response"),
      },
    }),
    (c) => {
      return c.json(
        {
          success: true,
          messaege: "GitHub authentication URL retrieved successfully",
          data: {
            auth_url: `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo%20delete_repo`,
          },
        },
        200
      )
    }
  )
  // #endregion
  // #region POST /login
  .post(
    "/login",
    describeRoute({
      tags: ["Github"],
      description: "Authenticate user with GitHub",
      responses: {
        200: jsonContent(z.object({}), "User authenticated successfully"),
        403: jsonContent(
          z.object({}),
          "Forbidden - GitHub authentication required"
        ),
      },
    }),
    zValidator(
      "query",
      z.object({
        code: z.string(),
      })
    ),
    async (c) => {
      const { code } = c.req.valid("query")
      try {
        const response = await fetch(
          "https://github.com/login/oauth/access_token",
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              client_id: env.GITHUB_CLIENT_ID,
              client_secret: env.GITHUB_CLIENT_SECRET,
              code,
            }),
          }
        )

        const accessToken = (await response.json()).access_token as string
        if (!accessToken) {
          return c.json(
            { success: false, message: "GitHub authentication failed" },
            403
          )
        }
        // update user in database with GitHub token
        const userId = c.get("user").id
        const res = (
          await db
            .update(user)
            .set({
              githubToken: accessToken,
            })
            .where(eq(user.id, userId))
            .returning()
        )[0]
        if (!res) {
          return c.json({ success: false, message: "User not found" }, 404)
        }
        return c.json(
          {
            success: true,
            message: "GitHub authentication successful",
          },
          200
        )
      } catch (e) {}
    }
  )
  // #endregion
  .use(githubAuth)
  // #region GET /user
  .get(
    "/user",
    describeRoute({
      tags: ["Github"],
      description: "Get authenticated user data from GitHub",
      responses: {
        200: jsonContent(z.object({}), "Authenticated user data"),
      },
    }),
    async (c) => {
      const githubManager = c.get("manager")
      const githubUser = await githubManager.getUser()
      return c.json(
        {
          success: true,
          message: "User data retrieved successfully",
          data: githubUser,
        },
        200
      )
    }
  )
  // #endregion
  // #region POST /logout
  .post(
    "/logout",
    describeRoute({
      tags: ["Github"],
      description: "Logout user from GitHub",
      responses: {
        200: jsonContent(z.object({}), "User logged out successfully"),
      },
    }),
    async (c) => {
      const githubManager = c.get("manager")
      try {
        const res = await githubManager.logoutUser(c.get("user").id)
        return c.json(
          {
            success: res.success,
            message: "User logged out successfully",
          },
          200
        )
      } catch (error) {
        console.error("Logout error:", error) // Log the error for debugging
        return c.json(
          { success: false, message: "Failed to log out user" },
          500
        )
      }
    }
  )
  // #endregion
  // #region GET /repo/status
  .get(
    "/repo/status",
    describeRoute({
      tags: ["Github"],
      description: "Check if a repository exists for the authenticated user",
      responses: {
        200: jsonContent(
          z.object({ exists: z.boolean() }),
          "Repository existence status"
        ),
      },
    }),
    zValidator(
      "query",
      z.object({
        projectId: z.string(),
      })
    ),
    async (c) => {
      const githubManager = c.get("manager")
      const userId = c.get("user").id
      const { projectId } = c.req.valid("query")
      const sandbox = await db.query.sandbox.findFirst({
        where: (sandbox, { eq, and }) =>
          and(eq(sandbox.id, projectId), eq(sandbox.userId, userId)),
      })
      if (!sandbox) {
        return c.json({ success: false, message: "Project not found" }, 404)
      }
      const { name: repoName, repositoryId } = sandbox

      if (repositoryId) {
        const repoExists = await githubManager.repoExistsByID(repositoryId)
        if (repoExists.exists) {
          return c.json(
            {
              success: true,
              message: "Repository found in both DB and GitHub",
              data: {
                existsInDB: true,
                existsInGitHub: true,
                repo: {
                  id: repoExists.repoId,
                  name: repoExists.repoName,
                },
              },
            },
            200
          )
        }
        return c.json(
          {
            success: true,

            message: "Repository found in DB, not in GitHub",
            data: { existsInDB: true, existsInGitHub: false, repo: null },
          },
          200
        )
      }
      const { exists } = await githubManager.repoExistsByName(repoName)
      if (exists) {
        return c.json(
          {
            success: true,
            message: "Repository found in GitHub, not in DB",
            data: { existsInDB: false, existsInGitHub: true, repo: null },
          },
          200
        )
      }

      return c.json(
        {
          success: true,
          message: "Repository not found in DB or GitHub",
          data: { existsInDB: false, existsInGitHub: false, repo: null },
        },
        200
      )
    }
  )
  // #endregion
  // #region POST /repo/create
  .post(
    "/repo/create",
    describeRoute({
      tags: ["Github"],
      description: "Create a new public repository for the authenticated user",
      responses: {
        200: jsonContent(
          z.object({ id: z.string() }),
          "Repository created successfully"
        ),
        404: jsonContent(z.object({}), "Not Found - Project not found"),
      },
    }),
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
      })
    ),
    async (c) => {
      const githubManager = c.get("manager")
      const userId = c.get("user").id
      const { projectId } = c.req.valid("json")
      try {
        // Fetch sandbox data
        const sandbox = await db.query.sandbox.findFirst({
          where: (sandbox, { eq, and }) =>
            and(eq(sandbox.id, projectId), eq(sandbox.userId, userId)),
        })
        if (!sandbox) {
          return c.json({ success: false, message: "Project not found" }, 404)
        }
        if (sandbox.repositoryId) {
          const repoExists = await githubManager.repoExistsByID(
            sandbox.repositoryId
          )
          if (repoExists.exists) {
            return c.json(
              {
                success: false,
                message: "Repository already exists",
                data: {
                  repoId: repoExists.repoId,
                  repoName: repoExists.repoName,
                },
              },
              400
            )
          }
          // If repository exists in DB but not in GitHub, remove it from DB
          await db
            .update(sandboxSchema)
            .set({
              repositoryId: null,
            })
            .where(
              and(
                eq(sandboxSchema.id, projectId),
                eq(sandboxSchema.userId, userId)
              )
            )
          console.log(
            `Removed repository ID from sandbox ${projectId} for user ${userId}`
          )
          return c.json(
            {
              success: false,
              message: "Repository exists in DB but not in GitHub",
            },
            400
          )
        }
        let repoName = sandbox.name

        // Check if repo exists and handle naming conflicts
        repoName = await resolveRepoNameConflict(
          repoName,
          githubManager.repoExistsByName
        )

        // Create the repository
        const { id } = await githubManager.createRepo(repoName)

        // Update sandbox with repository ID
        await db
          .update(sandboxSchema)
          .set({ repositoryId: id })
          .where(
            and(
              eq(sandboxSchema.id, projectId),
              eq(sandboxSchema.userId, userId)
            )
          )

        // Create initial commit
        const project = new Project(projectId)
        await project.initialize()
        const files = await collectFilesForCommit(project)
        if (files.length === 0) {
          return c.json(
            {
              success: false,
              message: "No files to commit",
              data: null,
            },
            400
          )
        }
        const username = githubManager.getUsername()
        const repo = await githubManager.createCommit(
          id,
          files,
          "initial commit from GitWit"
        )
        const repoUrl = `https://github.com/${username}/${repo.repoName}`

        return c.json(
          {
            success: true,
            message: "Repository created and files committed successfully",
            data: { repoUrl },
          },
          200
        )
      } catch (error: any) {
        console.error(
          "Failed to create repository or commit files:",
          error instanceof Error ? error.message : error
        )
        return c.json(
          {
            success: false,
            message: "Failed to create repository or commit files",
            data: error.message,
          },
          500
        )
      }
    }
  )
  // #endregion
  // #region POST /repo/commit
  .post(
    "/repo/commit",
    describeRoute({
      tags: ["Github"],
      description: "Commit changes to the repository",
      responses: {
        200: jsonContent(
          z.object({ message: z.string(), data: z.any() }),
          "Changes committed successfully"
        ),
        404: jsonContent(z.object({}), "Not Found - Project not found"),
      },
    }),
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        message: z.string().optional(),
      })
    ),
    async (c) => {
      const githubManager = c.get("manager")
      const userId = c.get("user").id
      const { projectId, message: commitMessage } = c.req.valid("json")
      try {
        // Fetch sandbox data
        const sandbox = await db.query.sandbox.findFirst({
          where: (sandbox, { eq, and }) =>
            and(eq(sandbox.id, projectId), eq(sandbox.userId, userId)),
        })
        if (!sandbox) {
          return c.json({ success: false, message: "Project not found" }, 404)
        }
        if (!sandbox.repositoryId) {
          return c.json(
            { success: false, message: "Repository not found" },
            404
          )
        }
        const project = new Project(projectId)
        await project.initialize()
        const files = await collectFilesForCommit(project)
        if (files.length === 0) {
          return c.json(
            { success: false, message: "No files to commit", data: null },
            400
          )
        }
        const repo = await githubManager.createCommit(
          sandbox.repositoryId,
          files,
          commitMessage || "commit from GitWit"
        )
        return c.json(
          {
            success: true,
            message: "Changes committed successfully",
            data: repo,
          },
          200
        )
      } catch (error) {
        console.error("Failed to commit changes:", error)
        return c.json(
          { success: false, message: "Failed to commit changes" },
          500
        )
      }
    }
  )
  // #endregion
  // #region POST /repo/remove
  .delete(
    "/repo/remove",
    describeRoute({
      tags: ["Github"],
      description: "Remove repository from the sandbox",
      responses: {
        200: jsonContent(z.object({}), "Repository removed successfully"),
        404: jsonContent(z.object({}), "Not Found - Project not found"),
      },
    }),
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
      })
    ),
    async (c) => {
      const githubManager = c.get("manager")
      const userId = c.get("user").id
      const { projectId } = c.req.valid("json")
      try {
        // Fetch sandbox data
        const sandbox = await db.query.sandbox.findFirst({
          where: (sandbox, { eq, and }) =>
            and(eq(sandbox.id, projectId), eq(sandbox.userId, userId)),
        })
        if (!sandbox) {
          return c.json({ success: false, message: "Project not found" }, 404)
        }
        if (!sandbox.repositoryId) {
          return c.json(
            { success: false, message: "Repository not found" },
            404
          )
        }
        // Remove repository from GitHub
        await githubManager.removeRepo(sandbox.repositoryId)

        // Remove repository ID from sandbox
        await db
          .update(sandboxSchema)
          .set({ repositoryId: null })
          .where(
            and(
              eq(sandboxSchema.id, projectId),
              eq(sandboxSchema.userId, userId)
            )
          )

        return c.json(
          { success: true, message: "Repository removed successfully" },
          200
        )
      } catch (error) {
        console.error("Failed to remove repository:", error)
        return c.json(
          { success: false, message: "Failed to remove repository" },
          500
        )
      }
    }
  )
// #endregion

// #region Utilities
/**
 * The function `resolveRepoNameConflict` resolves conflicts in repository names by appending a counter
 * if the name is already taken.

 */
async function resolveRepoNameConflict(
  repoName: string,
  isNameTaken: (name: string) => Promise<{ exists: boolean }>
): Promise<string> {
  const { exists } = await isNameTaken(repoName)
  if (!exists) {
    return repoName
  }

  let counter = 1
  let newName = `${repoName}-${counter}`

  while ((await isNameTaken(newName)).exists) {
    counter++
    newName = `${repoName}-${counter}`
  }

  return newName
}

/**
 * Collects files for commit
 * @param project - Project instance
 * @returns Array of files for commit
 */
async function collectFilesForCommit(project: Project) {
  const fileTree = await project.fileManager?.getFileTree()
  if (!fileTree || fileTree.length === 0) {
    return []
  }

  const files: { id: any; data: any }[] = []

  // Recursively process the file tree
  const processNode = async (node: {
    type: string
    id: any
    children?: any
  }) => {
    if (node.type === "file") {
      const content = await project.fileManager?.getFile(node.id)
      if (content) {
        files.push({ id: node.id, data: content })
      }
    } else if (node.type === "folder" && node.children) {
      for (const child of node.children) {
        await processNode(child)
      }
    }
  }

  for (const node of fileTree) {
    await processNode(node)
  }

  return files
}
// #endregion
