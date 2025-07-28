import { createRouter } from "@/lib/api/create-app"
import jsonContent from "@/lib/api/utils"
import { env } from "@/lib/env"
import { TFile, TFolder } from "@/lib/types"
import { db } from "@gitwit/db"
import { sandbox as sandboxSchema, user } from "@gitwit/db/schema"
import { Project } from "@gitwit/lib/services/Project"
import { and, eq } from "drizzle-orm"
import { describeRoute } from "hono-openapi"
import { validator as zValidator } from "hono-openapi/zod"
import path from "path"
import z from "zod"
import { GithubSyncManager } from "../../../lib/services/GithubSyncManager"
import { githubAuth } from "../middlewares/githubAuth"

// Import minimatch using require to avoid webpack issues
const minimatch = require("minimatch")

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
      let project: Project | null = null
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

        // Pull the README.md that GitHub auto-created
        project = new Project(projectId)
        await project.initialize()

        // Get the README.md file that GitHub created
        const githubFiles = await githubManager.getLatestFiles(id)
        const readmeFile = githubFiles.find((file) => file.path === "README.md")

        if (readmeFile && project.fileManager) {
          // Add the README.md to the local filesystem
          await project.fileManager.writeFileByPath(
            "/home/user/project/README.md",
            readmeFile.content
          )
          // Refresh file tree to include the new README.md
          await project.fileManager.getFileTree()
        }

        // Create initial commit with all local files
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
        // Update lastCommit in DB
        await db
          .update(sandboxSchema)
          .set({ lastCommit: repo.commitSha })
          .where(
            and(
              eq(sandboxSchema.id, projectId),
              eq(sandboxSchema.userId, userId)
            )
          )

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
      } finally {
        // Clean up project resources
        if (project) {
          await project.disconnect()
        }
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
        // Update lastCommit in DB
        await db
          .update(sandboxSchema)
          .set({ lastCommit: repo.commitSha })
          .where(
            and(
              eq(sandboxSchema.id, projectId),
              eq(sandboxSchema.userId, userId)
            )
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
  // #region GET /repo/pull/check
  .get(
    "/repo/pull/check",
    describeRoute({
      tags: ["Github"],
      description: "Check if pull is needed from GitHub",
      responses: {
        200: jsonContent(z.object({}), "Pull check completed"),
        404: jsonContent(z.object({}), "Not Found - Project not found"),
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
            { success: false, message: "No repository linked to this project" },
            404
          )
        }

        // Create GithubSyncManager instance
        const project = new Project(projectId)
        await project.initialize()

        if (!project.fileManager || !project.container) {
          throw new Error("Project not properly initialized")
        }

        const githubSyncManager = new GithubSyncManager(
          githubManager,
          project.fileManager,
          project.container
        )

        // Check if pull is needed
        const pullCheck = await githubSyncManager.checkIfPullNeeded(
          sandbox.repositoryId,
          sandbox.lastCommit || undefined // pass local lastCommit
        )

        return c.json(
          {
            success: true,
            message: "Pull check completed",
            data: pullCheck,
          },
          200
        )
      } catch (error: any) {
        console.error("Failed to check pull status:", error)
        return c.json(
          {
            success: false,
            message: "Failed to check pull status",
            data: error.message,
          },
          500
        )
      }
    }
  )
  // #endregion
  // #region POST /repo/pull
  .post(
    "/repo/pull",
    describeRoute({
      tags: ["Github"],
      description: "Pull latest changes from GitHub",
      responses: {
        200: jsonContent(z.object({}), "Pull completed successfully"),
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
            { success: false, message: "No repository linked to this project" },
            404
          )
        }

        // Initialize project
        const project = new Project(projectId)
        await project.initialize()

        if (!project.fileManager || !project.container) {
          throw new Error("Project not properly initialized")
        }

        // Create GithubSyncManager instance
        const githubSyncManager = new GithubSyncManager(
          githubManager,
          project.fileManager,
          project.container
        )

        // Get latest files from GitHub
        const githubFiles = await githubSyncManager.getLatestFiles(
          sandbox.repositoryId
        )

        // Pull files from GitHub
        const pullResult = await githubSyncManager.pullFromGitHub(githubFiles)

        // Note: Conflict resolutions are now handled by the separate /repo/resolve-conflicts endpoint
        // This endpoint only pulls files and detects conflicts

        // Get latest commit SHA from GitHub
        const latestCommit = await githubSyncManager.getLatestCommitSha(
          sandbox.repositoryId
        )
        await db
          .update(sandboxSchema)
          .set({ lastCommit: latestCommit })
          .where(
            and(
              eq(sandboxSchema.id, projectId),
              eq(sandboxSchema.userId, userId)
            )
          )

        return c.json(
          {
            success: true,
            message: "Pull completed successfully",
            data: pullResult,
          },
          200
        )
      } catch (error: any) {
        console.error("Failed to pull from GitHub:", error)
        return c.json(
          {
            success: false,
            message: "Failed to pull from GitHub",
            data: error.message,
          },
          500
        )
      }
    }
  )
  // #endregion
  // #region POST /repo/resolve-conflicts
  .post(
    "/repo/resolve-conflicts",
    describeRoute({
      tags: ["Github"],
      description: "Apply conflict resolutions to files",
      responses: {
        200: jsonContent(z.object({}), "Conflicts resolved successfully"),
        404: jsonContent(z.object({}), "Not Found - Project not found"),
      },
    }),
    zValidator(
      "json",
      z.object({
        projectId: z.string(),
        conflictResolutions: z.array(
          z.object({
            path: z.string(),
            resolutions: z.array(
              z.object({
                conflictIndex: z.number(),
                resolution: z.enum(["local", "incoming"]),
                localContent: z.string(),
                incomingContent: z.string(),
              })
            ),
          })
        ),
      })
    ),
    async (c) => {
      const userId = c.get("user").id
      const { projectId, conflictResolutions } = c.req.valid("json")
      let project: Project | null = null

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
            { success: false, message: "No repository linked to this project" },
            404
          )
        }

        // Initialize project
        project = new Project(projectId)
        await project.initialize()

        if (!project.fileManager || !project.container) {
          throw new Error("Project not properly initialized")
        }

        // Create GithubSyncManager instance
        const githubManager = c.get("manager")
        const githubSyncManager = new GithubSyncManager(
          githubManager,
          project.fileManager,
          project.container
        )

        // Transform conflict resolutions to match FileManager format
        const transformedResolutions = conflictResolutions.map((res) => ({
          path: res.path,
          resolution:
            res.resolutions[0]?.resolution === "incoming"
              ? "incoming"
              : "local",
          localContent: res.resolutions[0]?.localContent || "",
          incomingContent: res.resolutions[0]?.incomingContent || "",
        })) as Array<{
          path: string
          resolution: "incoming" | "local"
          localContent: string
          incomingContent: string
        }>

        // Apply file-level conflict resolutions
        await githubSyncManager.applyFileLevelResolutions(
          transformedResolutions
        )

        // Get latest commit SHA from GitHub and update
        const latestCommit = await githubSyncManager.getLatestCommitSha(
          sandbox.repositoryId
        )
        await db
          .update(sandboxSchema)
          .set({ lastCommit: latestCommit })
          .where(
            and(
              eq(sandboxSchema.id, projectId),
              eq(sandboxSchema.userId, userId)
            )
          )

        return c.json({
          success: true,
          message: "Conflicts resolved successfully",
        })
      } catch (error) {
        console.error("Error resolving conflicts:", error)
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        return c.json(
          {
            success: false,
            message: `Failed to resolve conflicts: ${errorMessage}`,
          },
          500
        )
      } finally {
        // Clean up project resources
        if (project) {
          await project.disconnect()
        }
      }
    }
  )
  // #endregion
  // #region GET /repo/changed-files
  .get(
    "/repo/changed-files",
    describeRoute({
      tags: ["Github"],
      description: "Get changed files since last commit",
      responses: {
        200: jsonContent(z.object({}), "Changed files retrieved successfully"),
        404: jsonContent(z.object({}), "Not Found - Project not found"),
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
      let project: Project | null = null

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
            { success: false, message: "No repository linked to this project" },
            404
          )
        }

        if (!sandbox.lastCommit) {
          return c.json(
            { success: false, message: "No previous commit found" },
            404
          )
        }

        // Initialize project
        project = new Project(projectId)
        await project.initialize()

        if (!project.fileManager) {
          throw new Error("File manager not initialized")
        }

        // Get current local files
        const currentFileTree = await project.fileManager.getFileTree()
        const currentFiles = flattenFileTreeForComparison(currentFileTree)

        // Get file contents for current files
        const currentFilesWithContent: Array<{
          path: string
          content: string
        }> = []
        for (const filePath of currentFiles) {
          // Skip hidden files (files that start with '.')
          if (filePath.includes("/.") || filePath.startsWith(".")) {
            continue
          }

          try {
            const content = await project.fileManager.getFile(`/${filePath}`)
            if (content !== undefined && content !== null) {
              currentFilesWithContent.push({
                path: filePath,
                content: String(content),
              })
            }
          } catch (error) {
            console.error(`Error reading file ${filePath}:`, error)
          }
        }

        // Get .gitignore content to filter ignored files
        let gitignoreContent: string | undefined
        try {
          const gitignoreFile = await project.fileManager.getFile("/.gitignore")
          if (gitignoreFile !== undefined && gitignoreFile !== null) {
            gitignoreContent = String(gitignoreFile)
          }
        } catch (error) {
          // .gitignore doesn't exist, which is fine
          console.log("No .gitignore file found")
        }

        // Filter out ignored files from current files
        const filteredCurrentFiles = filterIgnoredFiles(
          currentFilesWithContent,
          gitignoreContent
        ).filter((file) => file.content !== undefined) as Array<{
          path: string
          content: string
        }>

        // Get last committed files from GitHub
        const lastCommittedFiles = await githubManager.getFilesFromCommit(
          sandbox.repositoryId,
          sandbox.lastCommit
        )

        // Filter out hidden files and ignored files from last committed files
        const filteredLastCommittedFiles = filterIgnoredFiles(
          lastCommittedFiles.filter(
            (file) => !file.path.includes("/.") && !file.path.startsWith(".")
          ),
          gitignoreContent
        ).filter((file) => file.content !== undefined) as Array<{
          path: string
          content: string
        }>

        // Compare and categorize changes
        const changes = compareFiles(
          filteredCurrentFiles,
          filteredLastCommittedFiles
        )

        return c.json(
          {
            success: true,
            message: "Changed files retrieved successfully",
            data: changes,
          },
          200
        )
      } catch (error: any) {
        console.error("Failed to get changed files:", error)
        return c.json(
          {
            success: false,
            message: "Failed to get changed files",
            data: error.message,
          },
          500
        )
      } finally {
        // Clean up project resources
        if (project !== null) {
          await project.disconnect()
        }
      }
    }
  )
// #endregion
// #endregion

// #endregion

// #region Utilities
/**
 * Parses .gitignore patterns and filters files that should be ignored
 * @param files - Array of files with paths
 * @param gitignoreContent - Content of .gitignore file
 * @returns Array of files that should not be ignored
 */
function filterIgnoredFiles(
  files: Array<{ path: string; content?: string }>,
  gitignoreContent?: string
): Array<{ path: string; content?: string }> {
  // First, filter out hidden files (files that start with '.')
  const nonHiddenFiles = files.filter(
    (file) => !file.path.includes("/.") && !file.path.startsWith(".")
  )

  if (!gitignoreContent) {
    return nonHiddenFiles
  }

  // Parse .gitignore patterns
  const ignorePatterns = gitignoreContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")) // Remove comments and empty lines

  return nonHiddenFiles.filter((file) => {
    // Check if file matches any ignore pattern
    return !ignorePatterns.some((pattern) => {
      // Handle different pattern types
      if (pattern.startsWith("/")) {
        // Absolute path from root
        return minimatch(file.path, pattern.slice(1))
      } else if (pattern.endsWith("/")) {
        // Directory pattern
        return minimatch(file.path, pattern + "**")
      } else {
        // Regular pattern
        return minimatch(file.path, pattern)
      }
    })
  })
}

/**
 * Flattens file tree to get all file paths for comparison
 * @param files - File tree structure
 * @returns Array of file paths
 */
function flattenFileTreeForComparison(files: (TFolder | TFile)[]): string[] {
  const paths: string[] = []

  const processNode = (node: TFolder | TFile, currentPath: string = "") => {
    if (node.type === "file") {
      paths.push(path.posix.join(currentPath, node.name))
    } else if (node.type === "folder" && node.children) {
      const folderPath = path.posix.join(currentPath, node.name)
      node.children.forEach((child: TFolder | TFile) =>
        processNode(child, folderPath)
      )
    }
  }

  files.forEach((file) => processNode(file))
  return paths
}

/**
 * Compares current files with last committed files and categorizes changes
 * @param currentFiles - Current local files with content
 * @param lastCommittedFiles - Last committed files from GitHub
 * @returns Object with categorized changes
 */
function compareFiles(
  currentFiles: Array<{ path: string; content: string }>,
  lastCommittedFiles: Array<{ path: string; content: string }>
) {
  const currentFileMap = new Map(
    currentFiles.map((file) => [file.path, file.content])
  )
  const lastCommittedFileMap = new Map(
    lastCommittedFiles.map((file) => [file.path, file.content])
  )

  const modified: Array<{
    path: string
    localContent: string
    remoteContent: string
  }> = []
  const created: Array<{ path: string; content: string }> = []
  const deleted: Array<{ path: string }> = []

  // Find modified and created files
  for (const [path, content] of currentFileMap) {
    const lastCommittedContent = lastCommittedFileMap.get(path)
    if (lastCommittedContent === undefined) {
      // File exists locally but not in last commit
      created.push({ path, content })
    } else if (lastCommittedContent !== content) {
      // File exists in both but content differs
      modified.push({
        path,
        localContent: content,
        remoteContent: lastCommittedContent,
      })
    }
  }

  // Find deleted files
  for (const [path] of lastCommittedFileMap) {
    if (!currentFileMap.has(path)) {
      // File exists in last commit but not locally
      deleted.push({ path })
    }
  }

  return {
    modified,
    created,
    deleted,
  }
}

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

  // Get .gitignore content to filter ignored files
  let gitignoreContent: string | undefined
  try {
    const gitignoreFile = await project.fileManager?.getFile("/.gitignore")
    if (gitignoreFile !== undefined && gitignoreFile !== null) {
      gitignoreContent = String(gitignoreFile)
    }
  } catch (error) {
    // .gitignore doesn't exist, which is fine
    console.log("No .gitignore file found")
  }

  const files: { id: any; data: any }[] = []

  // Recursively process the file tree
  const processNode = async (node: {
    type: string
    id: any
    children?: any
  }) => {
    if (node.type === "file") {
      // Skip hidden files (files that start with '.')
      const filePath = node.id.replace(/^\/+/, "") // Remove leading slashes
      if (filePath.includes("/.") || filePath.startsWith(".")) {
        return
      }

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

  // Apply .gitignore filtering to the collected files
  if (gitignoreContent) {
    const filesWithPaths = files.map((file) => ({
      path: file.id.replace(/^\/+/, ""),
      content: file.data,
    }))

    const filteredFiles = filterIgnoredFiles(filesWithPaths, gitignoreContent)

    // Convert back to the format expected by createCommit
    return filteredFiles.map((file) => ({
      id: `/${file.path}`,
      data: file.content || "",
    }))
  }

  return files
}
// #endregion
