import { Octokit } from "@octokit/core"
import { eq } from "drizzle-orm"
// import { createJiti } from "jiti"
import { db } from "@gitwit/db"
import { user } from "@gitwit/db/schema"

export interface GitHubTokenResponse {
  access_token: string
}

export interface UserData {
  githubToken: string
}

/**
 * Manages GitHub API interactions and authentication.
 * Handles user authentication, repository operations, and GitHub API requests.
 */
export class GitHubManager {
  // GitHub API client instance
  public _octokit: Octokit | null = null
  // Authenticated GitHub username
  private _username: string | null = null
  // User GitHub token from the request
  private githubToken: string

  /**
   * Creates a new GitHubManager instance
   * @param req - Express request object
   */
  constructor({ token }: { token: string }) {
    this.githubToken = token
  }

  /**
   * Initializes the Octokit instance with stored GitHub token
   * @param req - Express request object
   */
  async init() {
    try {
      this._octokit = new Octokit({ auth: this.githubToken })
      // Fetch user data to set username
      const res = await this._octokit?.request("GET /user")
      // Check if user data not found
      if (!res?.data) {
        throw new Error("Failed to fetch user data from GitHub.")
      }
      // Set the username from the fetched user data
      this._username = res.data.login
    } catch (error) {
      console.error("Error initializing Octokit:", error)
      // throw error
    }
  }
  // Public getter guarantees octokit is available after init
  get octokit(): Octokit {
    if (!this._octokit) {
      throw new Error(
        "GitHubManager.init() must be called before using octokit."
      )
    }
    return this._octokit
  }
  // Public getter guarantees octokit is available after init
  get username(): string {
    if (!this._username) {
      throw new Error(
        "GitHubManager.init() must be called before using octokit."
      )
    }
    return this._username
  }

  /**
   * Fetches GitHub user data for the authenticated user
   * @returns GitHub user data
   */
  async getUser() {
    try {
      const response = await this.octokit.request("GET /user")
      return response?.data
    } catch (error) {
      throw error
    }
  }

  /**
   * Gets the authenticated user's GitHub username
   * @returns GitHub username
   */
  getUsername() {
    return this.username
  }

  /**
   * Checks if a repository exists for the authenticated user
   * @param repoName - Name of the repository to check
   * @returns Object indicating if the repository exists
   */
  async repoExistsByName(repoName: string): Promise<{ exists: boolean }> {
    try {
      const repoData = await this.octokit.request("GET /repos/{owner}/{repo}", {
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
    const response = await this.octokit.request("POST /user/repos", {
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
    const username = this.username
    // First get repo name from ID
    const repoInfo = await this.repoExistsByID(repoID)
    if (!repoInfo.exists) {
      throw new Error("Repository not found")
    }
    const repoName = repoInfo.repoName

    // Get the current commit SHA
    const refResponse = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      {
        owner: username,
        repo: repoName,
        ref: "heads/main",
      }
    )
    const ref = refResponse?.data

    if (!ref || !ref.object?.sha) {
      throw new Error("Failed to fetch reference for the main branch.")
    }

    const baseTreeResponse = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
      {
        owner: username,
        repo: repoName,
        commit_sha: ref.object.sha,
      }
    )
    if (!baseTreeResponse) {
      throw new Error("Failed to fetch base tree for commit.")
    }
    const baseTree = baseTreeResponse.data

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
          const blobResponse = await this.octokit.request(
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
    const treeResponse = await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/trees",
      {
        owner: username,
        repo: repoName,
        base_tree: baseTree.tree.sha,
        tree: blobs as any,
      }
    )
    if (!treeResponse) {
      throw new Error("Failed to create tree for commit.")
    }
    const tree = treeResponse.data

    // Create a new commit
    const newCommitResponse = await this.octokit.request(
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
      throw new Error("Failed to create new commit.")
    }
    const newCommit = newCommitResponse.data

    // Update the reference
    await this.octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: username,
      repo: repoName,
      ref: "heads/main",
      sha: newCommit.sha,
    })
    return { repoName, commitUrl: newCommit.html_url }
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
      const response = await this.octokit.request("GET /repositories/:id", {
        id: repoId,
      })
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
  // add a removeRepo
  /**
   * Removes a repository by its GitHub repository ID
   * @param repoId - GitHub repository ID to remove
   * @returns Object indicating success of the removal operation
   */
  async removeRepo(repoId: string): Promise<{ success: boolean }> {
    try {
      const response = await this.octokit.request("DELETE /repositories/:id", {
        id: repoId,
      })
      if (response.status === 204) {
        return { success: true }
      } else {
        throw new Error("Failed to delete repository")
      }
    } catch (error) {
      console.error(`Error removing repo "${repoId}":`, error)
      return { success: false }
    }
  }
  /**
   * Logs out a user from GitHub by clearing their GitHub token
   * @param userId - ID of the user to log out
   * @returns Object indicating success of the logout operation
   */
  async logoutUser(userId: string) {
    this._octokit = null
    // Update user's GitHub token in database

    await db.update(user).set({ githubToken: null }).where(eq(user.id, userId))

    return { success: true }
  }
}
