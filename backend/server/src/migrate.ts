import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const db = drizzle(pool)

async function main() {
  try {
    console.log("Starting migrations...")
    const start = Date.now()

    await migrate(db, { migrationsFolder: "./drizzle" })

    const end = Date.now()
    console.log(`✅ Migrations completed successfully (${end - start}ms)`)

  } catch (error) {
    console.error("❌ Migration failed:", error)
    throw error
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error("Migration process failed:", err)
  process.exit(1)
})
