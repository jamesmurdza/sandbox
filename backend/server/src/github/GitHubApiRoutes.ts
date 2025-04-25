import express, { Request, Response } from "express"
import { GitHubApiService } from "./GitHubApiService"
import { Project } from "../Project"
import { extractAuthToken } from "../utils/ExtractAuthToken"


export class GitHubApiRoutes {
  public router = express.Router()
  private service: GitHubApiService

  constructor(private readonly projects: Record<string, Project> ) {
    this.service = new GitHubApiService(this.projects)
    this.initializeRoutes()
  }
  private initializeRoutes() {
    this.router.get("/authenticate/url", async (_, res: Response) => {
      const data = await this.service.getAuthUrl()
      return res.status(data.code).json(data)
    })

   // Route: Login
   this.router.post("/login", async (req: Request, res: Response) => {
    const data = await this.service.authenticateUser(req)
    return res.status(data.code).json(data)
  })
  this.router.post("/logout", async (req: Request, res: Response) => {
    const data = await this.service.logoutUser(req)
    return res.status(data.code).json(data)
  })
  this.router.post("/repo/status", async (req: Request, res: Response) => {
    const authToken = extractAuthToken(req)
    const data = await this.service.checkRepoStatus(req.body.projectId, authToken)
    return res.status(data.code).json(data)
  })
  this.router.post("/repo/create", async (req: Request, res: Response) => {
    const result = await this.service.createRepo(req)
    return res.status(result.code).json(result)
  })
  this.router.post("/repo/commit", async (req: Request, res: Response) => {
    const response = await this.service.createCommit(req)
    return res.status(response.code).json(response)
  })
  this.router.post("/repo/remove", async (req: Request, res: Response) => {
    const authToken = extractAuthToken(req)
    const data = await this.service.removeRepoFromSandbox(req.body.projectId, authToken)
    return res.status(data.code).json(data)
  })
  }
  
}

