import { createId } from "@paralleldrive/cuid2"
import { relations, sql } from "drizzle-orm"
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const KNOWN_PLATFORMS = [
  "github",
  "twitter",
  "instagram",
  "bluesky",
  "linkedin",
  "youtube",
  "twitch",
  "discord",
  "mastodon",
  "threads",
  "gitlab",
  "generic",
] as const

export type KnownPlatform = (typeof KNOWN_PLATFORMS)[number]
export type UserLink = {
  url: string
  platform: KnownPlatform
}
// #region Tables
export const user = sqliteTable("user", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey()
    .unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  username: text("username").notNull().unique(),
  avatarUrl: text("avatarUrl"),
  githubToken: text("githubToken"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).default(
    sql`CURRENT_TIMESTAMP`
  ),
  generations: integer("generations").default(0),
  bio: text("bio"),
  personalWebsite: text("personalWebsite"),
  links: text("links", { mode: "json" }).default("[]").$type<UserLink[]>(),
  tier: text("tier", { enum: ["FREE", "PRO", "ENTERPRISE"] }).default("FREE"),
  tierExpiresAt: integer("tierExpiresAt"),
  lastResetDate: integer("lastResetDate"),
})

export type User = typeof user.$inferSelect

export const sandbox = sqliteTable("sandbox", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey()
    .unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  visibility: text("visibility", { enum: ["public", "private"] }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).default(
    sql`CURRENT_TIMESTAMP`
  ),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  likeCount: integer("likeCount").default(0),
  viewCount: integer("viewCount").default(0),
})

export type Sandbox = typeof sandbox.$inferSelect

export const sandboxLikes = sqliteTable(
  "sandbox_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    sandboxId: text("sandbox_id")
      .notNull()
      .references(() => sandbox.id),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).default(
      sql`CURRENT_TIMESTAMP`
    ),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sandboxId, table.userId] }),
  })
)

export const usersToSandboxes = sqliteTable("users_to_sandboxes", {
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  sandboxId: text("sandboxId")
    .notNull()
    .references(() => sandbox.id),
  sharedOn: integer("sharedOn", { mode: "timestamp_ms" }),
})

// #region Relations
export const userRelations = relations(user, ({ many }) => ({
  sandbox: many(sandbox),
  usersToSandboxes: many(usersToSandboxes),
  likes: many(sandboxLikes),
}))

export const sandboxRelations = relations(sandbox, ({ one, many }) => ({
  author: one(user, {
    fields: [sandbox.userId],
    references: [user.id],
  }),
  usersToSandboxes: many(usersToSandboxes),
  likes: many(sandboxLikes),
}))

export const sandboxLikesRelations = relations(sandboxLikes, ({ one }) => ({
  user: one(user, {
    fields: [sandboxLikes.userId],
    references: [user.id],
  }),
  sandbox: one(sandbox, {
    fields: [sandboxLikes.sandboxId],
    references: [sandbox.id],
  }),
}))

export const usersToSandboxesRelations = relations(
  usersToSandboxes,
  ({ one }) => ({
    group: one(sandbox, {
      fields: [usersToSandboxes.sandboxId],
      references: [sandbox.id],
    }),
    user: one(user, {
      fields: [usersToSandboxes.userId],
      references: [user.id],
    }),
  })
)

// #endregion
