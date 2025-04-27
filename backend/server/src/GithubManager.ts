import { createJiti } from "jiti"
const jiti = createJiti(__dirname)
const { Octokit } = jiti("@octokit/core")

export class GithubManager {
  authToken: string | null
  public octokit: any = null
  private username: string | null = null
  private accessToken: string | null = null

  constructor(authToken: string | null) {
    this.octokit = null
    this.username = null
    this.authToken = authToken
    this.accessToken = null
  }

  async authenticate(code: string, userId: string) {
    try {
      console.log("[GitHub Flow] Server authenticating user:", userId)
      let accessToken = ""
      if (code) {
        console.log(
          "[GitHub Flow] Server exchanging OAuth code for access token"
        )
        accessToken = await this.getAccessToken(code)
        if (accessToken) {
          console.log(
            "[GitHub Flow] Server received access token, updating user in database"
          )
          try {
            // Update user's GitHub token in database
            const response = await fetch(`${process.env.SERVER_URL}/api/user`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.authToken}`,
              },
              body: JSON.stringify({
                id: userId,
                githubToken: accessToken,
              }),
            })

            if (!response.ok) {
              const errorData = await response.text()
              console.error(
                "[GitHub Flow] Server failed to update user GitHub token in database:",
                response.status,
                errorData
              )
              throw new Error(
                `Failed to update user's GitHub token: ${response.status}`
              )
            } else {
              console.log(
                "[GitHub Flow] Server successfully updated GitHub token in database"
              )
              // Store the token locally too
              this.accessToken = accessToken
            }
          } catch (updateError) {
            console.error(
              "[GitHub Flow] Server error updating GitHub token:",
              updateError
            )
            throw updateError
          }
        } else {
          console.error(
            "[GitHub Flow] Server failed to get access token from GitHub"
          )
        }
      }

      // Small delay to ensure database update is complete
      await new Promise((resolve) => setTimeout(resolve, 500))

      console.log("[GitHub Flow] Server fetching user data from database")
      try {
        const userResponse = await fetch(
          `${process.env.SERVER_URL}/api/user?id=${userId}`,
          {
            headers: {
              Authorization: `Bearer ${this.authToken}`,
            },
          }
        )

        if (!userResponse.ok) {
          console.error(
            "[GitHub Flow] Server failed to fetch user data:",
            userResponse.status
          )
          throw new Error(`Failed to fetch user data: ${userResponse.status}`)
        }

        const userData = await userResponse.json()
        console.log(
          "[GitHub Flow] Server user data retrieved, checking for GitHub token"
        )

        // Use the saved token if the database retrieval didn't work
        accessToken = userData.githubToken || this.accessToken

        // Check if GitHub token exists, if not, just return
        if (!accessToken) {
          console.log(
            "[GitHub Flow] Server no GitHub token found for user. Skipping authentication."
          )
          if (this.accessToken) {
            console.log(
              "[GitHub Flow] Server using locally stored access token as fallback"
            )
            accessToken = this.accessToken
          } else {
            return null
          }
        }
      } catch (fetchError) {
        console.error(
          "[GitHub Flow] Server error fetching user data:",
          fetchError
        )
        // Use the token we got earlier if database fetch failed
        if (this.accessToken) {
          console.log(
            "[GitHub Flow] Server using locally stored access token as fallback after fetch error"
          )
          accessToken = this.accessToken
        } else {
          throw fetchError
        }
      }

      console.log("[GitHub Flow] Server initializing Octokit with access token")
      this.octokit = new Octokit({ auth: accessToken })
      const { data } = await this.octokit.request("GET /user")
      this.username = data.login
      console.log(
        "[GitHub Flow] Server successfully authenticated with GitHub for user:",
        data.login
      )
      return data
    } catch (error) {
      console.error("[GitHub Flow] Server GitHub authentication failed:", error)
      return null
    }
  }

  async getAccessToken(code: string): Promise<string> {
    // Exchange the OAuth code for an access token
    try {
      console.log(
        "[GitHub Flow] Server making request to GitHub OAuth token endpoint"
      )
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
      console.log(
        "[GitHub Flow] Server response from GitHub token endpoint:",
        data.error || "Success"
      )
      if (data.error) {
        console.error(
          "[GitHub Flow] Server GitHub OAuth error:",
          data.error_description || data.error
        )
      }
      return data.access_token
    } catch (error) {
      console.error("[GitHub Flow] Server error getting access token:", error)
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
      console.log(
        `[GitHub] Repository ${repoName} found for user ${this.username}`
      )
      return {
        exists: !!repoData,
      }
    } catch (error: any) {
      // Check if this is a 404 error, which is expected if repo doesn't exist
      if (error.status === 404) {
        console.log(
          `[GitHub] Repository ${repoName} does not exist for user ${this.username} (404)`
        )
        return { exists: false }
      }

      // Only log as error if it's not a 404
      console.error(
        "[GitHub] Error checking if repo exists:",
        error.message || error
      )
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
      console.log(`[GitHub] Repository with ID ${repoId} found`)
      return {
        exists: !!githubRepo,
        repoId: githubRepo?.id?.toString() || "",
        repoName: githubRepo?.name || "",
      }
    } catch (error: any) {
      // Check if this is a 404 error, which is expected if repo doesn't exist
      if (error.status === 404) {
        console.log(
          `[GitHub] Repository with ID ${repoId} does not exist (404)`
        )
      } else {
        console.error(
          "[GitHub] Error checking repository by ID:",
          error.message || error
        )
      }
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
        Authorization: `Bearer ${this.authToken}`,
      },
      body: JSON.stringify({
        id: userId,
        githubToken: "",
      }),
    })
    return { success: true }
  }
}
