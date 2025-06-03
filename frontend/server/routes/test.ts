
import { createRouter } from "@/lib/server/create-app";

export const testRouter = createRouter();

testRouter.get("/", (c) => {
    return c.json({
        message: "Hello from test route",
    });
})

