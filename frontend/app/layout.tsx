import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "Sandbox",
  description:
    "an open-source cloud-based code editing environment with custom AI code generation, live preview, real-time collaboration, and AI chat",
  metadataBase: new URL("https://sandbox.gitwit.dev/"),
  openGraph: {
    type: "website",
    url: "https://sandbox.gitwit.dev",
    title: "Sandbox",
    description:
      "an open-source cloud-based code editing environment with custom AI code generation, live preview, real-time collaboration, and AI chat",
  },
  twitter: {
    site: "https://sandbox.gitwit.dev",
    title: "Sandbox by Gitwit",
    description:
      "an open-source cloud-based code editing environment with custom AI code generation, live preview, real-time collaboration, and AI chat",
    creator: "@gitwitdev",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
