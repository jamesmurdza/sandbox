import type { Config } from "drizzle-kit"
import { defineConfig } from "drizzle-kit"
import "zod-openapi/extend" // For extending the Zod schema with OpenAPI properties

export default defineConfig({
  out: "./drizzle",
  schema: "./schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
}) satisfies Config
