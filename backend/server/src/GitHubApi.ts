import express from "express";
import dotenv from "dotenv";
import { GithubManager } from "./GithubManager";

dotenv.config();

const router = express.Router();
const githubManager = new GithubManager();

// Unified response helper
const respond = (
  res: express.Response,
  {
    success,
    code,
    message,
    data,
  }: { success: boolean; code: number; message: string; data: any }
) => res.status(code).json({ success, code, message, data });

// Route: Get GitHub OAuth URL
router.get("/authenticate/url", (_, res) => {
  respond(res, {
    success: true,
    code: 200,
    message: "GitHub OAuth URL generated",
    data: {
      authUrl: `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo`,
    },
  });
});

// Route: Login
router.post("/login", async (req, res) => {
  try {
    const { code = null, user_id } = req.body;
    if (!user_id)
      return respond(res, {
        success: false,
        code: 400,
        message: "Missing userId",
        data: null,
      });

    const auth = await githubManager.authenticate(code, user_id);
    return respond(res, {
      success: true,
      code: 200,
      message: "Authenticated successfully",
      data: auth,
    });
  } catch (error: any) {
    return respond(res, {
      success: false,
      code: 500,
      message: "Authenticated Failed" ,
      data: error.message,
    });
  }
});

// Route: Logout
router.post("/logout", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id)
      return respond(res, {
        success: false,
        code: 400,
        message: "Missing user id",
        data: null,
      });
    await githubManager.logoutGithubUser(user_id);
    return respond(res, {
      success: true,
      code: 200,
      message: "Logout successful",
      data: null,
    });
  } catch (error: any) {
    return respond(res, {
      success: false,
      code: 500,
      message: "Logout failed",
      data: error.message,
    });
  }
});

// Route: Check Sandbox Repo Status
router.get("/repo/status", async (req, res) => {
  try {
    if (!githubManager.octokit) {
      return respond(res, {
        success: false,
        code: 401,
        message: "Not authenticated",
        data: null,
      });
    }

    const { project_id } = req.body;
    const dbResponse = await fetch(
      `${process.env.SERVER_URL}/api/sandbox?id=${project_id}`,
      { method: "GET" }
    );
    const sandbox = await dbResponse.json();
    const repoName = sandbox.name;

    if (sandbox && sandbox.repositoryId) {
      const repoExists = await githubManager.repoExistsByID(sandbox.repositoryId);
      if (repoExists.exists) {
        return respond(res, {
          success: true,
          code: 200,
          message: "Repository found in both DB and GitHub",
          data: {
            existsInDB: true,
            existsInGitHub: true,
            repo: {
              id: repoExists.repoId,
              name: repoExists.repoName,
            },
          },
        });
      } else {
        return respond(res, {
          success: true,
          code: 200,
          message: "Repository found in DB, not in GitHub",
          data: { existsInDB: true, existsInGitHub: false },
        });
      }
    }

    const githubRepoCheck = await githubManager.repoExistsByName(repoName);
    if (githubRepoCheck.exists) {
      return respond(res, {
        success: true,
        code: 200,
        message: "Repository found in GitHub, not in DB",
        data: { existsInDB: false, existsInGitHub: true },
      });
    }

    return respond(res, {
      success: true,
      code: 200,
      message: "Repository not found in DB or GitHub",
      data: { existsInDB: false, existsInGitHub: false },
    });
  } catch (error: any) {
    return respond(res, {
      success: false,
      code: 500,
      message: 'Error Happened',
      data: error.message,
    });
  }
});

// Route: Remove repositoryId from DB (unlink repo from sandbox)
router.post("/remove/repo", async (req, res) => {
  try {
    const { id } = req.body;
    if (!id)
      return respond(res, {
        success: false,
        code: 400,
        message: "Missing id",
        data: null,
      });

    await fetch(`${process.env.SERVER_URL}/api/sandbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: id.toString(),
        repositoryId: null,
      }),
    });

    return respond(res, {
      success: true,
      code: 200,
      message: "Repository removed from sandbox",
      data: null,
    });
  } catch (error: any) {
    console.error("Failed to remove repository from sandbox:", error);
    return respond(res, {
      success: false,
      code: 500,
      message: "Failed to remove repository from sandbox",
      data: error.message,
    });
  }
});

export default router;