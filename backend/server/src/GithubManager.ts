import { createJiti } from "jiti"
const jiti = createJiti(__dirname)
const { Octokit } = jiti("@octokit/core")

export class GithubManager {
  public octokit: any = null
  private username: string | null = null
  private accessToken: string | null = null

  constructor() {
    this.octokit = null
    this.username = null
    this.accessToken = null
  }

  async authenticate(code: string, userId: string) {
    try {
      console.log("Attempting to authenticate with GitHub...")
      let accessToken = ""
      if (code){
        accessToken = await this.getAccessToken(code)
        if (accessToken) {
          // Update user's GitHub token in database
          await fetch(`${process.env.SERVER_URL}/api/user`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: userId,
            githubToken: accessToken,
          }),
        })
      }
    }
      const user= await fetch(`${process.env.SERVER_URL}/api/user?id=${userId}`)
      const userData = await user.json()
      accessToken = userData.githubToken as string;
      this.accessToken = accessToken
      console.log("Received GitHub OAuth code:", accessToken)

      this.octokit = new Octokit({ auth: accessToken })
      const { data } = await this.octokit.request("GET /user")
      this.username = data.login
      return data
    } catch (error) {
      console.error("GitHub authentication failed:", error)
      return null
    }
  }

  async getAccessToken(code: string): Promise<string> {
    // Exchange the OAuth code for an access token
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

      const data = await response.json()
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
  async repoExistsByName(
    repoName: string
  ): Promise<{ exists: boolean; repoId?: string }> {
    const repos = await this.octokit.request("GET /user/repos")

    // Log all repositories for debugging
    console.log("Checking for repo name:", repoName)
    console.log("All user repositories:")
    repos.data.forEach((repo: { name: string; id: number }) => {
      console.log(`- ${repo.name} (ID: ${repo.id})`)
    })

    // Find the matching repository
    const existingRepo = repos.data.find(
      (repo: { name: string; }) =>
        repo.name.toLowerCase() === repoName.toLowerCase()
    ) // Case-insensitive comparison

    const result = {
      exists: !!existingRepo,
      repoId: existingRepo?.id?.toString(),
    }

    console.log("Returning result:", result)

    return result
  }

  async createRepo(
    repoName: string
  ): Promise<{ html_url: string; id: string }> {
    const { data } = await this.octokit.request("POST /user/repos", {
      name: repoName,
      auto_init: true,
      private: false,
    })
    return {
      html_url: data.html_url,
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
    return { repoName }

  }

  async repoExistsByID(
    repoId: string
  ): Promise<{ exists: boolean; repoId: string; repoName: string }> {
    const repos = await this.octokit.request("GET /user/repos")

    console.log("Checking for repo ID:", repoId)
    console.log("All user repositories:")
    repos.data.forEach((repo: { name: string; id: number }) => {
      console.log(`- ${repo.name} (ID: ${repo.id})`)
    })

    // Find the matching repository by ID
    const existingRepo = repos.data.find(
      (repo: {  id: number }) => repo.id.toString() === repoId
    )


    const result = {
      exists: !!existingRepo,
      repoId: existingRepo?.id?.toString() || "",
      repoName: existingRepo?.name || "",
    }

    console.log("Returning result:", result)

    return result
  }

  async logoutGithubUser(userId:string) {
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
