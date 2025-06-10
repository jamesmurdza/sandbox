import createApp from "@/lib/server/create-app"
import "zod-openapi/extend" // For extending the Zod schema with OpenAPI properties
import { clerkAuth } from "./middlewares/clerkAuth"
import { fileRouter } from "./routes/file"
import { githubRouter } from "./routes/github"
import { projectRouter } from "./routes/project"
import { userRouter } from "./routes/user"

const app = createApp()
  .use(clerkAuth)
  .route("/project", projectRouter)
  .route("/user", userRouter)
  .route("/file", fileRouter)
  .route("/github", githubRouter)

export type AppType = typeof app

export default app
