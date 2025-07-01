import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load parent .env first
// Then load local .env to override
dotenv.config({ path: path.resolve(__dirname, "../.env") })
dotenv.config({ path: path.resolve(__dirname, ".env") })

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable", // 1 year
          },
        ],
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        hostname: "cdn.simpleicons.org",
      },
      {
        hostname: "img.clerk.com",
      },
      {
        hostname: "images.clerk.dev",
      },
    ],
  },
}

export default nextConfig
