import { createId } from "@paralleldrive/cuid2"
import { relations, sql } from "drizzle-orm"
import {
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import { createInsertSchema, createUpdateSchema } from "drizzle-zod"
import z from "zod"
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
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  generations: integer("generations").default(0).notNull(),
  bio: varchar("bio"),
  personalWebsite: varchar("personalWebsite"),
  links: json("links")
    .notNull()
    .$type<UserLink[]>()
    .default(sql`'[]'::json`),
  tier: varchar("tier", { enum: ["FREE", "PRO", "ENTERPRISE"] })
    .default("FREE")
    .notNull(),
  tierExpiresAt: timestamp("tierExpiresAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  lastResetDate: timestamp("lastResetDate")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
})

export type User = typeof user.$inferSelect
export const userInsertSchema = createInsertSchema(user, {
  id: (schema) =>
    schema.openapi({
      description: "Unique identifier for the user",
    }),
  name: (schema) =>
    schema.openapi({
      description: "Name of the user",
    }),
  email: (schema) =>
    schema.openapi({
      description: "Email address of the user",
    }),
  username: (schema) =>
    schema.openapi({
      description: "Username of the user",
    }),
  avatarUrl: (schema) =>
    schema.openapi({
      description: "Avatar URL of the user",
    }),
  githubToken: (schema) =>
    schema.openapi({
      description: "GitHub token for the user",
    }),
  createdAt: (schema) =>
    schema.openapi({
      description: "Creation timestamp of the user",
    }),
})

export const userUpdateSchema = createUpdateSchema(user, {
  id: (schema) =>
    schema.openapi({
      description: "Unique identifier for the user",
    }),
  name: (schema) =>
    schema.openapi({
      description: "Name of the user",
    }),
  email: (schema) =>
    schema.openapi({
      description: "Email address of the user",
    }),
  username: (schema) =>
    schema.openapi({
      description: "Username of the user",
    }),
  avatarUrl: (schema) =>
    schema.openapi({
      description: "Avatar URL of the user",
    }),
  githubToken: (schema) =>
    schema.openapi({
      description: "GitHub token for the user",
    }),
  createdAt: (schema) =>
    schema.openapi({
      description: "Creation timestamp of the user",
    }),
  lastResetDate: z.coerce.date().optional().openapi({
    description: "Last reset date for the user",
  }),
})
export const sandbox = pgTable("sandbox", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey()
    .unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  visibility: varchar("visibility", { enum: ["public", "private"] }).notNull(),
  createdAt: timestamp("createdAt")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  likeCount: integer("likeCount").default(0).notNull(),
  viewCount: integer("viewCount").default(0).notNull(),
  containerId: text("containerId"),
  repositoryId: text("repositoryId"),
})

export const sandboxInsertSchema = createInsertSchema(sandbox, {
  name: (schema) =>
    schema.openapi({
      description: "Name of the sandbox",
    }),
  type: (schema) =>
    schema.openapi({
      description: "Type of the sandbox",
    }),
  visibility: (schema) =>
    schema.openapi({
      description: "Visibility of the sandbox",
    }),
  createdAt: z.coerce.date().optional().openapi({
    description: "Creation timestamp of the sandbox",
  }),
  userId: (schema) =>
    schema.openapi({
      description: "ID of the user who created the sandbox",
    }),
  containerId: (schema) =>
    schema.openapi({
      description: "Container ID for the sandbox",
    }),
  repositoryId: (schema) =>
    schema.openapi({
      description: "Repository ID for the sandbox",
    }),
}).omit({
  id: true,
})
export const sandboxUpdateSchema = createUpdateSchema(sandbox, {
  name: (schema) =>
    schema.openapi({
      description: "Name of the sandbox",
    }),
  type: (schema) =>
    schema.openapi({
      description: "Type of the sandbox",
    }),
  visibility: (schema) =>
    schema.openapi({
      description: "Visibility of the sandbox",
    }),
  createdAt: z.coerce.date().optional().openapi({
    description: "Creation timestamp of the sandbox",
  }),
  userId: (schema) =>
    schema.openapi({
      description: "ID of the user who created the sandbox",
    }),
  containerId: (schema) =>
    schema.openapi({
      description: "Container ID for the sandbox",
    }),
  repositoryId: (schema) =>
    schema.openapi({
      description: "Repository ID for the sandbox",
    }),
}).omit({
  type: true, // Type is not updatable
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
  (table: any) => ({
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
  sharedOn: timestamp("sharedOn").notNull(),
})
export type UsersToSandboxes = typeof usersToSandboxes.$inferSelect

// #region Relations
export const userRelations = relations(user, ({ many }: any) => ({
  sandbox: many(sandbox),
  usersToSandboxes: many(usersToSandboxes),
  likes: many(sandboxLikes),
}))

export const sandboxRelations = relations(sandbox, ({ one, many }: any) => ({
  author: one(user, {
    fields: [sandbox.userId],

    references: [user.id],
  }),
  usersToSandboxes: many(usersToSandboxes),
  likes: many(sandboxLikes),
}))

export const sandboxLikesRelations = relations(
  sandboxLikes,
  ({ one }: any) => ({
    user: one(user, {
      fields: [sandboxLikes.userId],

      references: [user.id],
    }),
    sandbox: one(sandbox, {
      fields: [sandboxLikes.sandboxId],
      references: [sandbox.id],
    }),
  })
)

export const usersToSandboxesRelations = relations(
  usersToSandboxes,
  ({ one }: any) => ({
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
