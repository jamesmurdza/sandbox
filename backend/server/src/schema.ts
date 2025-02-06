import { createId } from "@paralleldrive/cuid2"
import { relations, sql } from "drizzle-orm"
import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"

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
export const user = pgTable("user", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey()
    .unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  username: text("username").notNull().unique(),
  avatarUrl: text("avatarUrl"),
  githubToken: varchar("githubToken"),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  generations: integer("generations").default(0),
  bio: varchar("bio"),
  personalWebsite: varchar("personalWebsite"),
  links: varchar("links").default("[]").$type<UserLink[]>(),
  tier: varchar("tier", { enum: ["FREE", "PRO", "ENTERPRISE"] }).default(
    "FREE"
  ),
  tierExpiresAt: timestamp("tierExpiresAt"),
  lastResetDate: timestamp("lastResetDate"),
})

export type User = typeof user.$inferSelect

export const sandbox = pgTable("sandbox", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey()
    .unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  visibility: varchar("visibility", { enum: ["public", "private"] }),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  likeCount: integer("likeCount").default(0),
  viewCount: integer("viewCount").default(0),
  containerId: text("containerId"),
})

export type Sandbox = typeof sandbox.$inferSelect

export const sandboxLikes = pgTable(
  "sandbox_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    sandboxId: text("sandbox_id")
      .notNull()
      .references(() => sandbox.id),
    createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sandboxId, table.userId] }),
  })
)

export const usersToSandboxes = pgTable("users_to_sandboxes", {
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  sandboxId: text("sandboxId")
    .notNull()
    .references(() => sandbox.id),
  sharedOn: timestamp("sharedOn"),
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
