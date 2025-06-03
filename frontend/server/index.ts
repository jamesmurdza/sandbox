import createApp from "@/lib/server/create-app"
import "zod-openapi/extend" // For extending the Zod schema with OpenAPI properties
import { clerkAuth } from "./middlewares/clerkAuth"
import { sandboxRouter } from "./routes/sandbox"
import { userRouter } from "./routes/user"

const app = createApp()
app.use(clerkAuth)
app.route("/user", userRouter)
app.route("/sandbox", sandboxRouter)

export default app
