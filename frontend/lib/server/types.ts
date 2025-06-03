import type { Hono } from "hono";
import type { BlankSchema } from "hono/types";

export interface AppBindings {
    Variables: {
        // user?: User & {
        //     uid: string;
        // };
    };
};

export type AppOpenAPI = Hono<AppBindings, BlankSchema, "/">;