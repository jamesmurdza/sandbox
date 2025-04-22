import { createJiti } from "jiti"
import { GitHubTokenResponse, UserData } from "../types"
const jiti = createJiti(__dirname)
const { Octokit } = jiti("@octokit/core")
export class GithubManager {
  public octokit: any = null
  private username: string | null = null

  constructor() {
    this.octokit = null
    this.username = null
  }

  async authenticate(code: string | null, userId: string) {
    try {
      let accessToken = code ? await this.getAccessToken(code) : ""

      if (accessToken) {
        await this.updateUserToken(userId, accessToken)
      }

      const userData = await this.fetchUserData(userId)
      accessToken = userData.githubToken

      if (!accessToken) {
        console.log("No GitHub token found for user. Skipping authentication.")
        return null
      }

      this.octokit = new Octokit({ auth: accessToken })
      const { data } = await this.octokit.request("GET /user")
      this.username = data.login

      return data
    } catch (error) {
      console.error("GitHub authentication failed:", error)
      return null
    }
  }

  private async updateUserToken(userId: string, token: string): Promise<void> {
    await fetch(`${process.env.SERVER_URL}/api/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: userId,
        githubToken: token,
      }),
    })
  }

  private async fetchUserData(userId: string): Promise<UserData> {
    const response = await fetch(
      `${process.env.SERVER_URL}/api/user?id=${userId}`
    )
    return response.json()
  }

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

  getUsername() {
    return this.username
  }

  // Helper Methods
  async repoExistsByName(repoName: string): Promise<{ exists: boolean }> {
    try {
      const repoData = await this.octokit.request("GET /repos/{owner}/{repo}", {
        owner: this.username,
        repo: repoName,
      })
      const result = {
        exists: !!repoData,
      }

      return result
    } catch (error) {
      console.log("Error getting repo data:", error)
      return { exists: false }
    }
  }

  async createRepo(repoName: string): Promise<{ id: string }> {
    const { data } = await this.octokit.request("POST /user/repos", {
      name: repoName,
      auto_init: true,
      private: false,
    })
    return {
      id: data.id.toString(),
    }
  }

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

    // Get the current commit SHA
    const { data: ref } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      { owner: username, repo: repoName, ref: "heads/main" }
    )

    const { data: baseTree } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
      { owner: username, repo: repoName, commit_sha: ref.object.sha }
    )

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
          const { data } = await this.octokit.request(
            "POST /repos/{owner}/{repo}/git/blobs",
            {
              owner: username,
              repo: repoName,
              content: file.data,
              encoding: "utf-8",
            }
          )
          blobs.push({
            path: file.id.replace(/^\/+/, "").replace(/^project\/+/, ""),
            mode: "100644",
            type: "blob",
            sha: data.sha,
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
    const { data: tree } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/trees",
      {
        owner: username,
        repo: repoName,
        base_tree: baseTree.tree.sha,
        tree: blobs,
      }
    )

    // Create a new commit
    const { data: newCommit } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/git/commits",
      {
        owner: username,
        repo: repoName,
        message,
        tree: tree.sha,
        parents: [ref.object.sha],
      }
    )

    // Update the reference
    await this.octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: username,
      repo: repoName,
      ref: "heads/main",
      sha: newCommit.sha,
    })
    return { repoName }
  }

  async repoExistsByID(
    repoId: string
  ): Promise<
    { exists: boolean; repoId: string; repoName: string } | { exists: false }
  > {
    try {
      const { data: githubRepo } = await this.octokit.request(
        "GET /repositories/:id",
        {
          id: repoId,
        }
      )
      return {
        exists: !!githubRepo,
        repoId: githubRepo?.id?.toString() || "",
        repoName: githubRepo?.name || "",
      }
    } catch (error) {
      console.error("Error getting repository:", error)
      return {
        exists: false,
      }
    }
  }

  async logoutGithubUser(userId: string) {
    // Update user's GitHub token in database
    await fetch(`${process.env.SERVER_URL}/api/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: userId,
        githubToken: "",
      }),
    })
    return { success: true }
  }
}
