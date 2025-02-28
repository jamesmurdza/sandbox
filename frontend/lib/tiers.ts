export const TIERS = {
  FREE: {
    //   generations: 100,
    //   maxTokens: 1024,
    generations: 1000,
    maxTokens: 4096,
    model: "anthropic.claude-3-7-sonnet-20250219-v1:0",
    anthropicModel: "claude-3-7-sonnet-20250219",
  },
  PRO: {
    generations: 500,
    maxTokens: 2048,
    model: "anthropic.claude-3-7-sonnet-20250219-v1:0",
    anthropicModel: "claude-3-7-sonnet-20250219",
  },
  ENTERPRISE: {
    generations: 1000,
    maxTokens: 4096,
    model: "anthropic.claude-3-7-sonnet-20250219-v1:0",
    anthropicModel: "claude-3-7-sonnet-20250219",
  },
}
