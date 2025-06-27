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
