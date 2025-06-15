import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

const db = drizzle(process.env.DATABASE_URL as string, { schema })

export { db, schema }
