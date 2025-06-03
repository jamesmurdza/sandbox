import { User } from '@clerk/backend';
import type { Hono } from "hono";
import type { BlankSchema } from "hono/types";
export interface AppBindings {
    Variables: {
        user?: User
    };
};

export type AppOpenAPI = Hono<AppBindings, BlankSchema, "/">;