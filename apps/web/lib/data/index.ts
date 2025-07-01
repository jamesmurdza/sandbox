import {
  AtSign,
  Github,
  GitlabIcon as GitlabLogo,
  Globe,
  Instagram,
  Link,
  Linkedin,
  MessageCircle,
  Twitch,
  Twitter,
  Youtube,
} from "lucide-react"
import { KnownPlatform } from "../types"

export const socialIcons: Record<
  KnownPlatform | "website",
  React.ComponentType<any>
> = {
  github: Github,
  twitter: Twitter,
  instagram: Instagram,
  bluesky: AtSign,
  linkedin: Linkedin,
  youtube: Youtube,
  twitch: Twitch,
  discord: MessageCircle,
  mastodon: AtSign,
  threads: AtSign,
  gitlab: GitlabLogo,
  generic: Link,
  website: Globe,
}

export const projectTemplates: {
  id: string
  name: string
  icon: string
  description: string
  disabled: boolean
}[] = [
  {
    id: "reactjs",
    name: "React",
    icon: "/project-icons/react.svg",
    description: "A JavaScript library for building user interfaces",
    disabled: false,
  },
  {
    id: "vanillajs",
    name: "HTML/JS",
    icon: "/project-icons/more.svg",
    description: "A simple HTML/JS project for building web apps",
    disabled: false,
  },
  {
    id: "nextjs",
    name: "NextJS",
    icon: "/project-icons/next-js.svg",
    description: "a React framework for building full-stack web applications",
    disabled: false,
  },
  {
    id: "streamlit",
    name: "Streamlit",
    icon: "/project-icons/python.svg",
    description: "A faster way to build and share data apps",
    disabled: false,
  },
  {
    id: "php",
    name: "PHP",
    description: "PHP development environment",
    icon: "/project-icons/php.svg",
    disabled: false,
  },
]
