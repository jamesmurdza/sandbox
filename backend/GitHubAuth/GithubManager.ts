// GithubManager.ts
// Correct way to import Octokit dynamically in an ESM environment
import { Octokit } from "@octokit/core";
export class GithubManager {
  
  private octokit: any = null; // Use 'any' for now since Octokit is dynamically imported
  private username: string | null = null;

  constructor() {
    this.octokit = null;
    this.username = null;
  }

  async authenticate(code: string) {
    try {

      // Exchange the authorization code for an access token
      const accessToken = await this.getAccessToken(code);

      // Initialize the Octokit client with the access token
      this.octokit = new Octokit({ auth: accessToken });

      // Get the authenticated user's info
      const { data } = await this.octokit.request("GET /user");
      console.log("Authenticated user:", data);
      this.username = data.login;

      return this.username;
    } catch (error) {
      console.error("GitHub authentication failed:", error);
      return null;
    }
  }

  private async getAccessToken(code: string): Promise<string> {
    // Exchange the OAuth code for an access token
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();
    return data.access_token;
  }

  getUsername() {
    return this.username;
  }
}