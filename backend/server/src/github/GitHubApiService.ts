import dotenv from "dotenv"
import { Request } from "express"
import { Project } from "../Project"
import { ApiResponse } from "../types"
import { GithubManager } from "./GithubManager"
import { extractAuthToken } from "../utils/ExtractAuthToken" 

dotenv.config()

export class GitHubApiService {
  private githubManager: GithubManager
  constructor(private readonly projects: Record<string, Project>) {
    this.githubManager = new GithubManager()
  }
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

  async authenticateUser(req: Request): Promise<ApiResponse> {
    try {
      const authToken = extractAuthToken(req)
      const { code, userId } = req.body
      if (!userId) {
        return {
          success: false,
          code: 400,
          message: "Missing user id",
          data: null,
        }
      }
      const auth = await this.githubManager.authenticate(
        code,
        userId,
        authToken
      )
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
  async logoutUser(req: Request): Promise<ApiResponse> {
    try {
      const authToken = extractAuthToken(req)
      const { userId } = req.body
      if (!userId) {
        return {
          success: false,
          code: 400,
          message: "Missing user id",
          data: null,
        }
      }
      await this.githubManager.logoutGithubUser(userId, authToken)
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
  async checkRepoStatus(
    projectId: string,
    authToken: string | null
  ): Promise<ApiResponse> {
    try {
      if (!this.githubManager.octokit) {
        return {
          success: false,
          code: 401,
          message: "Not authenticated",
          data: null,
        }
      }

      if (!projectId) {
        return {
          success: false,
          code: 400,
          message: "Missing project id",
          data: null,
        }
      }

      const dbResponse = await fetch(
        `${process.env.SERVER_URL}/api/sandbox?id=${projectId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      )
      const sandbox = await dbResponse.json()
      const repoName = sandbox.name

      if (sandbox && sandbox.repositoryId) {
        const repoExists = await this.githubManager.repoExistsByID(
          sandbox.repositoryId
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
  async removeRepoFromSandbox(projectId: string,authToken: string | null): Promise<ApiResponse> {
    try {
      if (!projectId) {
        return {
          success: false,
          code: 400,
          message: "Missing id",
          data: null,
        }
      }

      await fetch(`${process.env.SERVER_URL}/api/sandbox`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" ,
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          id: projectId.toString(),
          repositoryId: null,
        }),
      })

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
  async createCommit(req: Request): Promise<ApiResponse> {
    try {
      const authToken = extractAuthToken(req)
      const { projectId, message } = req.body

      // 1. Validate project
      const project = this.projects[projectId]
      if (!project) {
        return {
          success: false,
          code: 404,
          message: "Project not found",
          data: null,
        }
      }

      // 2. Validate GitHub authentication
      const username = this.githubManager.getUsername()
      if (!this.githubManager?.octokit || !username) {
        return {
          success: false,
          code: 401,
          message: "Please authenticate with GitHub first",
          data: null,
        }
      }
      const projectData = await this.fetchSandboxData(projectId,authToken)
      const repoId = projectData.repositoryId
      // 3. Validate repoId
      if (!repoId) {
        return {
          success: false,
          code: 400,
          message: "Repository ID is required",
          data: null,
        }
      }

      // 4. Verify repository still exists
      const repoCheck = await this.githubManager.repoExistsByID(repoId)
      if (!repoCheck.exists) {
        await this.removeRepoFromSandbox(projectId,authToken)
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

      // 5. Get and prepare files
      const files = await this.collectFilesForCommit(project)
      if (files.length === 0) {
        return {
          success: false,
          code: 400,
          message: "No files to commit",
          data: null,
        }
      }

      // 6. Create the commit
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
  async createRepo(req: Request): Promise<ApiResponse> {
    try {
      const authToken = extractAuthToken(req)
      const { projectId } = req.body

      // 1. Validate project
      const project = this.projects[projectId]

      if (!project) {
        return {
          success: false,
          code: 404,
          message: "Project not found",
          data: null,
        }
      }

      // 2. Validate GitHub authentication
      if (!this.githubManager?.octokit) {
        return {
          success: false,
          code: 401,
          message: "Please authenticate with GitHub first",
          data: null,
        }
      }

      // 3. Fetch sandbox data
      const sandbox = await this.fetchSandboxData(projectId,authToken)
      let repoName = sandbox.name

      // 4. Check if repo exists and handle naming conflicts
      const { data: repoExists } = await this.checkRepoStatus(
        projectId,
        authToken
      )
      repoName = await this.handleRepoScenariosAndUpdateName(
        repoExists,
        repoName,
        projectId,
        authToken
      )

      // 5. Create the repository
      const { id } = await this.githubManager.createRepo(repoName)

      // 6. Update sandbox with repository ID
      await this.updateSandboxWithRepoId(projectId, id.toString(),authToken)

      // 7. Create initial commit
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
  // --- Helper methods below ---

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

  private async fetchSandboxData(projectId: string,authToken: string | null) {
    const dbResponse = await fetch(
      `${process.env.SERVER_URL}/api/sandbox?id=${projectId}`,
      {
         method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
       }
    )
    return await dbResponse.json()
  }

  private async updateSandboxWithRepoId(projectId: string, repoId: string,authToken: string | null) {
    return await fetch(`${process.env.SERVER_URL}/api/sandbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        id: projectId.toString(),
        repositoryId: repoId,
      }),
    })
  }

  private async handleRepoScenariosAndUpdateName(
    repoExists: { existsInDB: any; existsInGitHub: any },
    repoName: string,
    projectId: string,
    authToken: string | null
  ) {
    if (!repoExists.existsInDB && repoExists.existsInGitHub) {
      let newRepoName = `${repoName}-gitwit`
      console.log(`Original repo name taken, using: ${newRepoName}`)
      return newRepoName
    }

    if (repoExists.existsInDB && !repoExists.existsInGitHub) {
      await this.removeRepoFromSandbox(projectId,authToken)
    } else if (repoExists.existsInDB && repoExists.existsInGitHub) {
      throw new Error("Repository already exists")
    }

    return repoName
  }
}
