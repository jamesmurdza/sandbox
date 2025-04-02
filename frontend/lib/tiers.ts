export const TIERS = {
  FREE: {
    //   generations: 100,
    //   maxTokens: 1024,
    generations: 1000,
    maxTokens: 4096,
    model: "claude-3-5-sonnet-20240620",
  },
  PRO: {
    generations: 500,
    maxTokens: 2048,
    model: "claude-3-5-sonnet-20240620",
  },
  ENTERPRISE: {
    generations: 1000,
    maxTokens: 4096,
    model: "claude-3-5-sonnet-20240620",
  },
}
