/** @type {import('next').NextConfig} */
const nextConfig = {
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
