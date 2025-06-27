import { z } from "zod"
import { KNOWN_PLATFORMS } from "../constants"

export const editUserSchema = z.object({
  id: z.string().trim(),
  username: z.string().trim().min(1, "Username must be at least 1 character"),
  oldUsername: z.string().trim(),
  name: z.string().trim().min(1, "Name must be at least 1 character"),
  bio: z.string().trim().optional(),
  personalWebsite: z.string().trim().optional(),
  links: z
    .array(
      z.object({
        url: z.string().trim(),
        platform: z.enum(KNOWN_PLATFORMS),
      })
    )
    .catch([]),
})
export type EditUserSchema = z.infer<typeof editUserSchema>
