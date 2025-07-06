import dotenv from "dotenv"
import type { Config } from "drizzle-kit"
import { defineConfig } from "drizzle-kit"
import path from "path"
import "zod-openapi/extend" // For extending the Zod schema with OpenAPI properties

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, "../.env") })

export default defineConfig({
  out: "./drizzle",
  schema: "./schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
}) satisfies Config
