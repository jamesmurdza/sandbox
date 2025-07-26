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
