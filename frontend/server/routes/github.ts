import { createRouter } from "@/lib/server/create-app"
import { githubAuth } from "../middlewares/githubAuth"

export const githubRouter = createRouter().use(githubAuth)
