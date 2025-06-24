"use client"

import DarkLogo from "@/assets/logo-dark.svg"
import LightLogo from "@/assets/logo-light.svg"
import Image from "next/image"

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number
}

export function Logo({ size = 36, ...props }: LogoProps) {
  return (
    <div className="relative" style={{ width: size, height: size }} {...props}>
      <Image
        src={LightLogo}
        alt="Logo"
        fill
        className="block dark:hidden"
        priority
      />
      <Image
        src={DarkLogo}
        alt="Logo"
        fill
        className="hidden dark:block"
        priority
      />
    </div>
  )
}
