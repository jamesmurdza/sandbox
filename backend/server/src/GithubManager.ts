import { createJiti } from "jiti"
const jiti = createJiti(__dirname)
const { Octokit } = jiti("@octokit/core")

export class GithubManager {
  public octokit: any = null
  private username: string | null = null
  private accessToken: string | null = null; 


  constructor() {
    this.octokit = null
    this.username = null
    this.accessToken = null; 
  }

  async authenticate(code: string) {
    try {
      console.log("Attempting to authenticate with GitHub...")
      const accessToken = await this.getAccessToken(code)
      this.accessToken = accessToken;
      console.log("Received GitHub OAuth code:", accessToken)

      this.octokit = new Octokit({ auth: accessToken })
      const { data } = await this.octokit.request("GET /user")
      this.username = data.login
      return {
        username: this.username,
        accessToken: this.accessToken, // Return both username and token
      }
    } catch (error) {
      console.error("GitHub authentication failed:", error)
      return null
    }
  }

  async getAccessToken(code: string): Promise<string> {
    // Exchange the OAuth code for an access token
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

    const data = await response.json()
    return data.access_token
  }

  getUsername() {
    return this.username
  }

  // Helper Methods
  async repoExists(repoName: string): Promise<boolean> {
    const repos = await this.octokit.request("GET /user/repos")
    return repos.data.some((repo: { name: string }) => repo.name === repoName)
  }

  async createRepo(repoName: string): Promise<string> {
    const { data } = await this.octokit.request("POST /user/repos", {
      name: repoName,
      auto_init: true,
      private: false,
    })
    return data.html_url
  }

  async createCommit(
    repoName: string,
    files: Array<{ id: string; data: string }>,
    message: string
  ) {
    const username = this.getUsername()

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
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data } = await this.octokit.request(
          "POST /repos/{owner}/{repo}/git/blobs",
          {
            owner: username,
            repo: repoName,
            content: file.data,
            encoding: "utf-8",
          }
        )

        return {
          path: file.id.replace(/^\/+/, "").replace(/^project\/+/, ""),
          mode: "100644",
          type: "blob",
          sha: data.sha,
        }
      })
    )

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
  }
}
