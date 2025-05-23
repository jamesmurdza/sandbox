import { type Octokit as OctokitType } from "@octokit/core"
import { Request } from "express"
import { createJiti } from "jiti"
import { GitHubTokenResponse, UserData } from "../types"

// Initialize jiti for dynamic imports
const jiti = createJiti(__dirname)
const { Octokit } = jiti("@octokit/core")

/**
 * Manages GitHub API interactions and authentication.
 * Handles user authentication, repository operations, and GitHub API requests.
 */
export class GitHubManager {
  // GitHub API client instance
  public octokit: OctokitType | null = null
  // Authenticated GitHub username
  private username: string | null = null
  // Express request object
  private request: Request

  /**
   * Creates a new GitHubManager instance
   * @param req - Express request object
   */
  constructor(req: Request) {
    this.octokit = null
    this.username = null
    this.request = req
  }

  /**
   * Authenticates a user with GitHub
   * @param code - GitHub OAuth code (optional)
   * @param userId - User's ID in the system
   * @param authToken - Authentication token (optional)
   * @returns GitHub user data or null if authentication fails
   */
  async authenticate(
    code: string | null,
    userId: string,
    authToken: string | null
  ) {
    try {
      let accessToken = code ? await this.getAccessToken(code) : ""

      if (accessToken) {
        await this.updateUserToken(userId, accessToken, authToken)
      }

      const userData = await this.fetchUserData(userId, authToken ?? null)
      accessToken = userData.githubToken

      if (!accessToken) {
        console.log("No GitHub token found for user. Skipping authentication.")
        return null
      }

      this.octokit = new Octokit({ auth: accessToken })
      const res = await this.octokit?.request("GET /user")
      if (!res?.data) {
        throw new Error("Failed to fetch user data from GitHub.")
      }
      this.username = res.data.login

      return res.data
    } catch (error) {
      console.error("GitHub authentication failed:", error)
      return null
    }
  }

  /**
   * Updates the user's GitHub token in the database
   * @param userId - User's ID
   * @param token - New GitHub token
   * @param authToken - Authentication token
   */
  private async updateUserToken(
    userId: string,
    token: string,
    authToken: string | null
  ): Promise<void> {
    await fetch(`${process.env.SERVER_URL}/api/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        id: userId,
        githubToken: token,
      }),
    })
  }

  /**
   * Fetches user data from the database
   * @param userId - User's ID
   * @param authToken - Authentication token
   * @returns User data including GitHub token
   */
  private async fetchUserData(
    userId: string,
    authToken: string | null
  ): Promise<UserData> {
    const response = await fetch(
      `${process.env.SERVER_URL}/api/user?id=${userId}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    )
    return response.json()
  }

  /**
   * Exchanges GitHub OAuth code for an access token
   * @param code - GitHub OAuth code
   * @returns GitHub access token
   */
  async getAccessToken(code: string): Promise<string> {
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
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
          }),
        }
      )

      const data = (await response.json()) as GitHubTokenResponse
      return data.access_token
    } catch (error) {
      console.log("Error getting access token:", error)
      throw error
    }
  }

  /**
   * Gets the authenticated user's GitHub username
   * @returns GitHub username or empty string if not authenticated
   */
  getUsername() {
    return this.username || ""
  }

  /**
   * Initializes the Octokit instance with stored GitHub token
   * @param req - Express request object
   */
  async initializeOctokit(req: Request) {
    try {
      const userId = req.auth?.userId
      const authToken = req.authToken
      // Authenticate using stored token
      if (!userId) {
        throw new Error("User ID not found in request.")
      }
      const user = await this.fetchUserData(userId, authToken ?? null)
      if (!user?.githubToken) {
        throw new Error("GitHub authentication token not found for user.")
      }
      this.octokit = new Octokit({ auth: user.githubToken })
    } catch (error) {
      console.error("Error initializing Octokit:", error)
      // throw error
    }
  }

  /**
   * Ensures Octokit is initialized before making GitHub API calls
   * @returns Initialized Octokit instance
   * @throws Error if initialization fails
   */
  private async ensureInitialized(): Promise<OctokitType> {
    if (!this.octokit) {
      await this.initializeOctokit(this.request)
      if (!this.octokit) {
        throw new Error("Octokit initialization failed.")
      }
    }
    return this.octokit as OctokitType
  }

  /**
   * Fetches GitHub user data for the authenticated user
   * @param params.code - Optional GitHub OAuth code
   * @param params.authToken - Authentication token
   * @param params.userId - User's ID
   * @returns GitHub user data
   */
  async getGithubUser({
    code,
    authToken,
    userId,
  }: {
    code?: string
    authToken: string
    userId: string
  }) {
    try {
     await this.ensureInitialized()
      const response = await this.octokit?.request("GET /user")
      return response?.data
    } catch (error) {
      throw error
    }
  }

  /**
   * Checks if a repository exists for the authenticated user
   * @param repoName - Name of the repository to check
   * @returns Object indicating if the repository exists
   */
  async repoExistsByName(repoName: string): Promise<{ exists: boolean }> {
    try {
       await this.ensureInitialized()
      const repoData = await this.octokit?.request("GET /repos/{owner}/{repo}", {
        owner: this.username || "",
        repo: repoName,
      })
      return {
        exists: !!repoData,
      }
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`Repo "${repoName}" does not exist`)
      } else {
        console.log(`Error checking repo "${repoName}":`, error)
      }
      return { exists: false }
    }
  }

  /**
   * Creates a new public GitHub repository
   * @param repoName - Name for the new repository
   * @returns Object containing the new repository's ID
   */
  async createRepo(repoName: string): Promise<{ id: string }> {
    await this.ensureInitialized()
    const response = await this.octokit?.request("POST /user/repos", {
      name: repoName,
      auto_init: true,
      private: false,
    })
    return {
      id: response?.data.id.toString() || "",
    }
  }

  /**
   * Creates a new commit in a GitHub repository with multiple files
   * @param repoID - ID of the target repository
   * @param files - Array of file objects to commit, each containing:
   *               - id: File path relative to repo root
   *               - data: File content as string
   * @param message - Commit message
   * @returns Object containing the repository name
   * @throws Error if repository not found or blob creation fails
   *
   * Note: Files are processed in batches to avoid overwhelming the GitHub API
   */
  async createCommit(
    repoID: string,
    files: Array<{ id: string; data: string }>,
    message: string
  ) {
    const username = this.getUsername()
    // First get repo name from ID
    const repoInfo = await this.repoExistsByID(repoID)
    if (!repoInfo.exists) {
      throw new Error("Repository not found")
    }
    const repoName = repoInfo.repoName

     await this.ensureInitialized()
    // Get the current commit SHA
    const refResponse = await this.octokit?.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      {
        owner: username,
        repo: repoName,
        ref: "heads/main",
      }
    )
    const ref = refResponse?.data

    if (!ref || !ref.object?.sha) {
      throw new Error("Failed to fetch reference for the main branch.");
    }

    const baseTreeResponse = await this.octokit?.request(
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
      {
        owner: username,
        repo: repoName,
        commit_sha: ref.object.sha,
      }
    )
    if (!baseTreeResponse) {
      throw new Error("Failed to fetch base tree for commit.");
    }
    const baseTree = baseTreeResponse.data;

    // Create blobs for all files
    // Process files in batches with retry logic
    const blobs = []
    const batchSize = 7 // Process 7 files at a time

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      console.log(
        `Processing batch ${i / batchSize + 1} of ${Math.ceil(
          files.length / batchSize
        )}`
      )

      // Process each file in the batch sequentially
      for (const file of batch) {
        try {
          const blobResponse = await this.octokit?.request(
            "POST /repos/{owner}/{repo}/git/blobs",
            {
              owner: username,
              repo: repoName,
              content: file.data,
              encoding: "utf-8",
            }
          )
          if (!blobResponse) {
            throw new Error(`Failed to create blob for file: ${file.id}`)
          }
          blobs.push({
            path: file.id.replace(/^\/+/, "").replace(/^project\/+/, ""),
            mode: "100644",
            type: "blob",
            sha: blobResponse.data.sha,
          })

          console.log(`Successfully created blob for file: ${file.id}`)
        } catch (error) {
          console.error(`Failed to create blob for file: ${file.id}`, error)
          throw error
        }
      }

      // Add a delay between batches to avoid overwhelming the connection
      if (i + batchSize < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Create a new tree
    const treeResponse = await this.octokit?.request(
      "POST /repos/{owner}/{repo}/git/trees",
      {
        owner: username,
        repo: repoName,
        base_tree: baseTree.tree.sha,
        tree: blobs as any,
      }
    )
    if (!treeResponse) {
      throw new Error("Failed to create tree for commit.");
    }
    const tree = treeResponse.data;

    // Create a new commit
    const newCommitResponse = await this.octokit?.request(
      "POST /repos/{owner}/{repo}/git/commits",
      {
        owner: username,
        repo: repoName,
        message,
        tree: tree.sha,
        parents: [ref.object.sha],
      }
    )
    if (!newCommitResponse) {
      throw new Error("Failed to create new commit.");
    }
    const newCommit = newCommitResponse.data;

    // Update the reference
    await this.octokit?.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: username,
      repo: repoName,
      ref: "heads/main",
      sha: newCommit.sha,
    })
    return { repoName }
  }

  /**
   * Checks if a repository exists by its GitHub repository ID
   * @param repoId - GitHub repository ID to check
   * @returns Object containing repository information if found:
   *          - exists: true/false indicating if repo exists
   *          - repoId: repository ID if found
   *          - repoName: repository name if found
   *          If not found, returns { exists: false }
   */
  async repoExistsByID(
    repoId: string
  ): Promise<
    { exists: boolean; repoId: string; repoName: string } | { exists: false }
  > {
    try {
      await this.ensureInitialized()
      const response = await this.octokit?.request(
        "GET /repositories/:id",
        {
          id: repoId,
        }
      )
      const githubRepo = response?.data
      return {
        exists: !!githubRepo,
        repoId: githubRepo?.id?.toString() || "",
        repoName: githubRepo?.name || "",
      }
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`Repo with id "${repoId}" does not exist`)
      } else {
        console.log(`Error checking repo "${repoId}":`, error)
      }
      return {
        exists: false,
      }
    }
  }

  /**
   * Logs out a user from GitHub by clearing their GitHub token
   * @param userId - ID of the user to log out
   * @param authToken - Authentication token for the API request
   * @returns Object indicating success of the logout operation
   */
  async logoutGithubUser(userId: string, authToken: string | null) {
    this.octokit = null
    // Update user's GitHub token in database
    await fetch(`${process.env.SERVER_URL}/api/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        id: userId,
        githubToken: "",
      }),
    })
    return { success: true }
  }
}
