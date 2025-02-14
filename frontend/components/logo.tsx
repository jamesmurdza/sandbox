"use client"

import DarkLogo from "@/assets/logo-dark.svg"
import LightLogo from "@/assets/logo-light.svg"
import { useTheme } from "next-themes"
import Image from "next/image"

interface LogoProps extends React.HTMLAttributes<HTMLImageElement> {
  size?: number
}
export function Logo({ size = 36, ...props }: LogoProps) {
  const { resolvedTheme: theme } = useTheme()
  return (
    <Image
      src={theme === "light" ? LightLogo : DarkLogo}
      alt="Logo"
      width={size}
      height={size}
      {...props}
    />
  )
}
