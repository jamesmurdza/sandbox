import { createEnv } from "@t3-oss/env-core"
import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

export const env = createEnv({
  server: {
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_TEST_USER_ID: z.string().min(1),
    BACKEND_URL: z.string().min(1).default("http://localhost:3000"),
    GITHUB_PAT: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
