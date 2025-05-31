import dotenv from "dotenv"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Request } from "express"
import * as schema from "../db/schema"
import { sandbox } from "../db/schema"
import { GitHubManager } from "../services/GitHubManager"
import { Project } from "../services/Project"
import { ApiResponse } from "../utils/types"

dotenv.config()

export class GitHubApiService {
  private githubManager: GitHubManager

  /**
   * Initializes a new instance of GitHubApiService
   * @param req - Express request object
   */
  constructor(req: Request) {
    this.githubManager = new GitHubManager(req)
  }

  /**
   * Generates GitHub OAuth authorization URL
   * @returns Promise containing the GitHub authorization URL
   */
  getAuthUrl(): Promise<ApiResponse> {
    return Promise.resolve({
      success: true,
      code: 200,
      message: "Authenticated URL",
      data: {
        auth_url: `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo`,
      },
    })
  }

  /**
   * Retrieves GitHub user data using OAuth code
   * @param req - Express request containing code and userId
   * @returns Promise containing user data from GitHub
   */
  async getUserData(_: Request): Promise<ApiResponse> {
    try {
      const res = await this.githubManager.getGithubUser()
      return {
        success: true,
        code: 200,
        message: "User data gotten successfully",
        data: res,
      }
    } catch (error: any) {
      return {
        success: false,
        code: 500,
        message: "Date retrieval Failed",
        data: error.message,
      }
    }
  }

  /**
   * Authenticates a user with GitHub using OAuth code
   * @param req - Express request containing code and userId
   * @returns Promise containing authentication result
   */
  async authenticateUser(req: Request): Promise<ApiResponse> {
    try {
      const { code, userId } = req.body
      if (!userId) {
        return {
          success: false,
          code: 400,
          message: "Missing user id",
          data: null,
        }
      }
      const auth = await this.githubManager.authenticate(code, userId)
      return {
        success: true,
        code: 200,
        message: "Authenticated successfully",
        data: auth,
      }
    } catch (error: any) {
      return {
        success: false,
        code: 500,
        message: "Authenticated Failed",
        data: error.message,
      }
    }
  }

  /**
   * Logs out a user from GitHub
   * @param req - Express request containing userId
   * @returns Promise containing logout result
   */
  async logoutUser(req: Request): Promise<ApiResponse> {
    try {
      const { userId } = req.body
      if (!userId) {
        return {
          success: false,
          code: 400,
          message: "Missing user id",
          data: null,
        }
      }
      await this.githubManager.logoutGithubUser(userId)
      return {
        success: true,
        code: 200,
        message: "Logout successful",
        data: null,
      }
    } catch (error: any) {
      return {
        success: false,
        code: 500,
        message: "Logout failed",
        data: error.message,
      }
    }
  }

  /**
   * Checks if a repository exists in both GitHub and local database
   * @param projectId - ID of the project to check
   * @returns Promise containing repository status in both GitHub and DB
   */
  async checkRepoStatus(projectId: string): Promise<ApiResponse> {
    try {
      if (!projectId) {
        return {
          success: false,
          code: 400,
          message: "Missing project id",
          data: null,
        }
      }
      const sandboxData = await this.fetchSandboxData(projectId)
      const repoName = sandboxData.name

      if (sandboxData && sandboxData.repositoryId) {
        const repoExists = await this.githubManager.repoExistsByID(
          sandboxData.repositoryId
        )
        if (repoExists.exists) {
          return {
            success: true,
            code: 200,
            message: "Repository found in both DB and GitHub",
            data: {
              existsInDB: true,
              existsInGitHub: true,
              repo: {
                id: repoExists.repoId,
                name: repoExists.repoName,
              },
            },
          }
        } else {
          return {
            success: true,
            code: 200,
            message: "Repository found in DB, not in GitHub",
            data: { existsInDB: true, existsInGitHub: false },
          }
        }
      }

      const githubRepoCheck = await this.githubManager.repoExistsByName(
        repoName
      )
      if (githubRepoCheck.exists) {
        return {
          success: true,
          code: 200,
          message: "Repository found in GitHub, not in DB",
          data: { existsInDB: false, existsInGitHub: true },
        }
      }

      return {
        success: true,
        code: 200,
        message: "Repository not found in DB or GitHub",
        data: { existsInDB: false, existsInGitHub: false },
      }
    } catch (error: any) {
      return {
        success: false,
        code: 500,
        message: "Error Happened",
        data: error.message,
      }
    }
  }

  /**
   * Removes repository connection from sandbox project
   * @param projectId - ID of the project to remove repo from
   * @returns Promise containing removal operation result
   */
  async removeRepoFromSandbox(projectId: string): Promise<ApiResponse> {
    try {
      if (!projectId) {
        return {
          success: false,
          code: 400,
          message: "Missing id",
          data: null,
        }
      }
      const db = drizzle(process.env.DATABASE_URL as string, { schema })

      await db
        .update(sandbox)
        .set({ repositoryId: null })
        .where(eq(sandbox.id, projectId))

      return {
        success: true,
        code: 200,
        message: "Repository removed from sandbox",
        data: null,
      }
    } catch (error: any) {
      console.error("Failed to remove repository from sandbox:", error)
      return {
        success: false,
        code: 500,
        message: "Failed to remove repository from sandbox",
        data: error.message,
      }
    }
  }

  /**
   * Creates a commit in the GitHub repository for a project
   * @param req - Express request containing projectId and commit message
   * @returns Promise containing commit result
   */
  async createCommit(req: Request): Promise<ApiResponse> {
    try {
      const { projectId, message } = req.body

      // Validate GitHub authentication
      const username = this.githubManager.getUsername()
      if (!this.githubManager?.octokit || !username) {
        return {
          success: false,
          code: 401,
          message: "Please authenticate with GitHub first",
          data: null,
        }
      }
      const projectData = await this.fetchSandboxData(projectId)
      const repoId = projectData.repositoryId
      // Validate repoId
      if (!repoId) {
        return {
          success: false,
          code: 400,
          message: "Repository ID is required",
          data: null,
        }
      }

      // Verify repository still exists
      const repoCheck = await this.githubManager.repoExistsByID(repoId)
      if (!repoCheck.exists) {
        await this.removeRepoFromSandbox(projectId)
        return {
          success: false,
          code: 404,
          message: "Repository no longer exists in GitHub or DB",
          data: {
            existsInGitHub: false,
            existsInDB: false,
          },
        }
      }

      // Get and prepare files
      const project = new Project(
        projectId,
        projectData.type,
        projectData.containerId || ""
      )
      await project.initialize()
      const files = await this.collectFilesForCommit(project)
      if (files.length === 0) {
        return {
          success: false,
          code: 400,
          message: "No files to commit",
          data: null,
        }
      }

      // Create the commit
      const commitMessage = message || "initial commit from GitWit"
      const repo = await this.githubManager.createCommit(
        repoId,
        files,
        commitMessage
      )
      const repoUrl = `https://github.com/${username}/${repo.repoName}`

      return {
        success: true,
        code: 200,
        message: "Commit created successfully",
        data: {
          repoUrl,
        },
      }
    } catch (error: any) {
      console.error("Failed to create commit:", error)
      return {
        success: false,
        code: 500,
        message: "Failed to create commit",
        data: error.message,
      }
    }
  }

  /**
   * Creates a new repository in GitHub for a project
   * @param req - Express request containing projectId and userId
   * @returns Promise containing repository creation result
   */
  async createRepo(req: Request): Promise<ApiResponse> {
    try {
      const { projectId } = req.body

      // Fetch sandbox data
      const sandbox = await this.fetchSandboxData(projectId)
      let repoName = sandbox.name

      // Check if repo exists and handle naming conflicts
      const { data: repoExists } = await this.checkRepoStatus(projectId)
      repoName = await this.handleRepoScenariosAndUpdateName(
        repoExists,
        repoName,
        projectId
      )

      // Create the repository
      const { id } = await this.githubManager.createRepo(repoName)

      // Update sandbox with repository ID
      await this.updateSandboxWithRepoId(projectId, id.toString())

      // Create initial commit
      const project = new Project(
        projectId,
        sandbox.type,
        sandbox.containerId || ""
      )
      await project.initialize()
      const files = await this.collectFilesForCommit(project)
      if (files.length === 0) {
        return {
          success: false,
          code: 400,
          message: "No files to commit",
          data: null,
        }
      }

      const username = this.githubManager.getUsername()
      const repo = await this.githubManager.createCommit(
        id,
        files,
        "initial commit from GitWit"
      )
      const repoUrl = `https://github.com/${username}/${repo.repoName}`

      return {
        success: true,
        code: 200,
        message: "Repository created and files committed successfully",
        data: { repoUrl },
      }
    } catch (error: any) {
      console.error(
        "Failed to create repository or commit files:",
        error instanceof Error ? error.message : error
      )
      return {
        success: false,
        code: 500,
        message: "Failed to create repository or commit files",
        data: error.message,
      }
    }
  }

  /**
   * Collects files for commit
   * @param project - Project instance
   * @returns Array of files for commit
   */
  private async collectFilesForCommit(project: Project) {
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
  private async fetchSandboxData(projectId: string) {
    const db = drizzle(process.env.DATABASE_URL as string, { schema })

    const sandboxData = await db
      .select()
      .from(sandbox)
      .where(eq(sandbox.id, projectId))
      .limit(1)

    if (!sandboxData || sandboxData.length === 0) {
      throw new Error(`Sandbox not found with ID: ${projectId}`)
    }

    return sandboxData[0]
  }
  /**
   * Updates sandbox with repository ID
   * @param projectId - ID of the project
   * @param repoId - ID of the repository
   * @returns Promise containing update result
   */
  private async updateSandboxWithRepoId(projectId: string, repoId: string) {
    const db = drizzle(process.env.DATABASE_URL as string, { schema })

    await db
      .update(sandbox)
      .set({ repositoryId: repoId })
      .where(eq(sandbox.id, projectId))

    return { success: true }
  }

  /**
   * Handles repository scenarios and updates repository name if necessary
   * @param repoExists - Object containing repository existence status in both GitHub and DB
   * @param repoName - Name of the repository
   * @param projectId - ID of the project
   * @returns Updated repository name
   */
  private async handleRepoScenariosAndUpdateName(
    repoExists: { existsInDB: any; existsInGitHub: any },
    repoName: string,
    projectId: string
  ) {
    if (!repoExists.existsInDB && repoExists.existsInGitHub) {
      let newRepoName = `${repoName}-gitwit`
      console.log(`Original repo name taken, using: ${newRepoName}`)
      return newRepoName
    }

    if (repoExists.existsInDB && !repoExists.existsInGitHub) {
      await this.removeRepoFromSandbox(projectId)
    } else if (repoExists.existsInDB && repoExists.existsInGitHub) {
      throw new Error("Repository already exists")
    }

    return repoName
  }
}
