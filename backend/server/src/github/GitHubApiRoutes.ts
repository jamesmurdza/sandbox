import express, { Request, Response } from "express"
import { requireGithubAuth } from "../middleware/GitHubAuthUsers"
import { Project } from "../Project"
import { extractAuthToken } from "../utils/ExtractAuthToken"
import { GitHubApiService } from "./GitHubApiService"

export class GitHubApiRoutes {
  public router = express.Router()
  private service: GitHubApiService | null
  // private projects: Record<string, Project>

  constructor(private readonly projects: Record<string, Project>) {
    this.service = null
    this.projects = projects
    this.initializeRoutes()
  }
  private ensureServiceInitialized(req: Request): GitHubApiService {
    if (!this.service) {
      this.service = new GitHubApiService(this.projects, req)
    }
    return this.service
  }
  private initializeRoutes() {
    this.router.get("/authenticate/url", async (req, res: Response) => {
      const data = await this.ensureServiceInitialized(req).getAuthUrl()
      return res.status(data.code).json(data)
    })

    this.router.get(
      "/user",
      requireGithubAuth,
      async (req: Request, res: Response) => {
        const data = await this.ensureServiceInitialized(req).getUserData(req)
        return res.status(data.code).json(data)
      }
    )
    // Route: Login
    this.router.post("/login", async (req: Request, res: Response) => {
      const data = await this.ensureServiceInitialized(req).authenticateUser(
        req
      )
      return res.status(data.code).json(data)
    })
    this.router.post(
      "/logout",
      requireGithubAuth,
      async (req: Request, res: Response) => {
        const data = await this.ensureServiceInitialized(req).logoutUser(req)
        return res.status(data.code).json(data)
      }
    )
    this.router.get(
      "/repo/status",
      requireGithubAuth,
      async (req: Request, res: Response) => {
        const authToken = extractAuthToken(req)
        const data = await this.ensureServiceInitialized(req).checkRepoStatus(
          req.query.projectId as string,
          authToken
        )
        return res.status(data.code).json(data)
      }
    )
    this.router.post(
      "/repo/create",
      requireGithubAuth,
      async (req: Request, res: Response) => {
        const result = await this.ensureServiceInitialized(req).createRepo(req)
        return res.status(result.code).json(result)
      }
    )
    this.router.post(
      "/repo/commit",
      requireGithubAuth,
      async (req: Request, res: Response) => {
        const response = await this.ensureServiceInitialized(req).createCommit(
          req
        )
        return res.status(response.code).json(response)
      }
    )
    this.router.post(
      "/repo/remove",
      requireGithubAuth,
      async (req: Request, res: Response) => {
        const authToken = extractAuthToken(req)
        const data = await this.ensureServiceInitialized(
          req
        ).removeRepoFromSandbox(req.body.projectId, authToken)
        return res.status(data.code).json(data)
      }
    )
  }
}
