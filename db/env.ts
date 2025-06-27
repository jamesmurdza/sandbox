import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    E2B_API_KEY: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
    AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    AWS_REGION: z.string().min(1).optional().default("us-east-1"),
    AWS_BUCKET: z.string().min(1).optional().default("gitwit-sandbox"),
    DATABASE_URL: z.string().url().min(1),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    NEXT_PUBLIC_SERVER_PORT: z.string().optional().default("4000"),
    NEXT_PUBLIC_APP_URL: z.string(),
    NEXT_PUBLIC_SERVER_URL: z
      .string()
      .url()
      .min(1)
      .optional()
      .default("http://localhost:4000"),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z
      .string()
      .min(1)
      .optional()
      .default("/sign-in"),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z
      .string()
      .min(1)
      .optional()
      .default("/sign-up"),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z
      .string()
      .min(1)
      .optional()
      .default("/sign-in"),
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z
      .string()
      .min(1)
      .optional()
      .default("/sign-up"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SERVER_PORT: process.env.NEXT_PUBLIC_SERVER_PORT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
      process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
  },
})
