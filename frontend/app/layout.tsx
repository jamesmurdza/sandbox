import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { PreviewProvider } from "@/context/PreviewContext"
import { ReactQueryProvider } from "@/context/ReactQuery"
import { SocketProvider } from "@/context/SocketContext"
import { ClerkProvider } from "@clerk/nextjs"
import { Analytics } from "@vercel/analytics/react"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import type { Metadata } from "next"
import "./globals.css"

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
    <ReactQueryProvider>
      <ClerkProvider>
        <html
          lang="en"
          className={`${GeistSans.variable} ${GeistMono.variable}`}
        >
          <body>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              disableTransitionOnChange
            >
              <SocketProvider>
                <PreviewProvider>{children}</PreviewProvider>
              </SocketProvider>
              <Analytics />
              <Toaster position="bottom-left" richColors />
            </ThemeProvider>
          </body>
        </html>
      </ClerkProvider>
    </ReactQueryProvider>
  )
}
