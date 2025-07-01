import { drizzle } from "drizzle-orm/node-postgres" // Import drizzle for PostgreSQL
import { env } from "./env"
import * as schema from "./schema"

export const db = drizzle(env.DATABASE_URL as string, { schema })
export { schema }
