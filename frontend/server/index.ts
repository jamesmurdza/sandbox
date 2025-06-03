import createApp from "@/lib/server/create-app";
import { testRouter } from "./routes/test";

const app = createApp()

app.route("/test", testRouter);


export default app;
