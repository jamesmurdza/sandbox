import createApp from "@/lib/server/create-app"
import { clerkAuth } from "./middlewares/clerkAuth"
import { fileRouter } from "./routes/file"
import { githubRouter } from "./routes/github"
import { projectRouter } from "./routes/project"
import { openUserRouter, userRouter } from "./routes/user"

const app = createApp()
  .route("/user", openUserRouter)
  .use(clerkAuth)
  .route("/user", userRouter)
  .route("/project", projectRouter)
  .route("/file", fileRouter)
  .route("/github", githubRouter)

export type AppType = typeof app

export default app
