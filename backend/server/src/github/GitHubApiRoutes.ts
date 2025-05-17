import express, { Request, Response } from "express"
import { requireGithubAuth } from "../middleware/GitHubAuthUsers"
import { Project } from "../Project"
import { extractAuthToken } from "../utils/ExtractAuthToken"
import { GitHubApiService } from "./GitHubApiService"

export class GitHubApiRoutes {
  public router = express.Router()
  private service: GitHubApiService | null

  /**
   * Initializes a new instance of GitHubApiRoutes
   * @param projects - Map of project IDs to Project instances
   */
  constructor(private readonly projects: Record<string, Project>) {
    this.service = null
    this.initializeRoutes()
  }

  /**
   * Ensures the GitHub API service is initialized
   * @param req - Express request object
   * @returns Initialized GitHubApiService instance
   */
  private ensureServiceInitialized(req: Request): GitHubApiService {
    if (!this.service) {
      this.service = new GitHubApiService(this.projects, req)
    }
    return this.service
  }

  /**
   * Sets up all GitHub API routes including authentication, user management, and repository operations
   */
  /**
   * Helper method to handle route execution with common error handling and response formatting
   */
  private async handleRoute(
    req: Request,
    res: Response,
    action: (service: GitHubApiService) => Promise<any>
  ) {
    try {
      const service = this.ensureServiceInitialized(req)
      const result = await action(service)
      return res.status(result.code).json(result)
    } catch (error) {
      console.error("Route handler error:", error)
      return res.status(500).json({ code: 500, error: "Internal server error" })
    }
  }

  private initializeRoutes() {
    // Public routes
    this.router.get("/authenticate/url", (req, res) =>
      this.handleRoute(req, res, (service) => service.getAuthUrl())
    )

    this.router.post("/login", (req, res) =>
      this.handleRoute(req, res, (service) => service.authenticateUser(req))
    )

    // Protected routes
    this.router.get("/user", requireGithubAuth, (req, res) =>
      this.handleRoute(req, res, (service) => service.getUserData(req))
    )

    this.router.post("/logout", requireGithubAuth, (req, res) =>
      this.handleRoute(req, res, (service) => service.logoutUser(req))
    )

    this.router.get("/repo/status", requireGithubAuth, (req, res) =>
      this.handleRoute(req, res, (service) =>
        service.checkRepoStatus(
          req.query.projectId as string,
          extractAuthToken(req)
        )
      )
    )

    this.router.post("/repo/create", requireGithubAuth, (req, res) =>
      this.handleRoute(req, res, (service) => service.createRepo(req))
    )

    this.router.post("/repo/commit", requireGithubAuth, (req, res) =>
      this.handleRoute(req, res, (service) => service.createCommit(req))
    )

    this.router.post("/repo/remove", requireGithubAuth, (req, res) =>
      this.handleRoute(req, res, (service) =>
        service.removeRepoFromSandbox(req.body.projectId, extractAuthToken(req))
      )
    )
  }
}
