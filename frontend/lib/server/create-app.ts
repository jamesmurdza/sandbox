import { Scalar } from "@scalar/hono-api-reference"
import { Hono } from "hono"
import { openAPISpecs } from "hono-openapi"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import packageJSON from "../../package.json"
import { env } from "../env"
import type { AppBindings } from "./types"

export function createRouter() {
  return new Hono<AppBindings>({
    strict: false,
  })
}

export default function createApp() {
  const app = createRouter().basePath("/api")

  // Not Found
  app.notFound((c) => {
    return c.json(
      {
        message: `Route not found - ${c.req.path}`,
      },
      404
    )
  })

  // Not Found
  app.onError((err, c) => {
    const currentStatus =
      "status" in err ? err.status : c.newResponse(null).status
    const statusCode =
      currentStatus !== 200 ? (currentStatus as ContentfulStatusCode) : 500
    // eslint-disable-next-line node/prefer-global/process
    return c.json(
      {
        success: false,
        message: err.message,

        stack: env.NODE_ENV === "production" ? undefined : err.stack,
      },
      statusCode
    )
  })

  // OpenAPI Documentation
  app.get(
    "/openapi.json",
    openAPISpecs(app, {
      documentation: {
        info: {
          title: "Sandbox by GitWit",
          version: packageJSON.version,
          description:
            "API for the GitWit Sandbox project, an open-source cloud-based code editing environment with custom AI code generation, live preview, real-time collaboration, and AI chat.",
        },
        servers: [
          {
            url: "http://localhost:3000",
            description: "Local server",
          },
          {
            url: "", //      TODO: HELLO
            description: "Live server",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
    })
  )

  // OpenAPI Documentation UI
  app.get(
    "/docs",
    Scalar({
      url: "/api/openapi.json",
      pageTitle: "Sandbox by GitWit API Documentation",
      theme: "kepler",
      layout: "classic",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    })
  )
  return app
}
