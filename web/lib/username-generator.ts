// Constants for username generation
const WORDS = {
  adjectives: [
    "azure",
    "crimson",
    "golden",
    "silver",
    "violet",
    "emerald",
    "cobalt",
    "amber",
    "coral",
    "jade",
    "cyber",
    "digital",
    "quantum",
    "neural",
    "binary",
    "cosmic",
    "stellar",
    "atomic",
    "crypto",
    "nano",
    "swift",
    "brave",
    "clever",
    "wise",
    "noble",
    "rapid",
    "bright",
    "sharp",
    "keen",
    "bold",
    "dynamic",
    "epic",
    "mega",
    "ultra",
    "hyper",
    "super",
    "prime",
    "elite",
    "alpha",
    "omega",
    "pixel",
    "vector",
    "sonic",
    "laser",
    "matrix",
    "nexus",
    "proxy",
    "cloud",
    "data",
    "tech",
  ],
  nouns: [
    "coder",
    "hacker",
    "dev",
    "ninja",
    "guru",
    "wizard",
    "admin",
    "mod",
    "chief",
    "boss",
    "wolf",
    "eagle",
    "phoenix",
    "dragon",
    "tiger",
    "falcon",
    "shark",
    "lion",
    "hawk",
    "bear",
    "byte",
    "bit",
    "node",
    "stack",
    "cache",
    "chip",
    "core",
    "net",
    "web",
    "app",
    "star",
    "nova",
    "pulsar",
    "comet",
    "nebula",
    "quasar",
    "cosmos",
    "orbit",
    "astro",
    "solar",
    "mind",
    "soul",
    "spark",
    "pulse",
    "force",
    "power",
    "wave",
    "storm",
    "flash",
    "surge",
  ],
  prefixes: [
    "the",
    "mr",
    "ms",
    "dr",
    "pro",
    "master",
    "lord",
    "captain",
    "chief",
    "agent",
  ],
} as const

// Helper function to get random element from array
const getRandomElement = <T>(array: readonly T[]): T => {
  return array[Math.floor(Math.random() * array.length)]
}

// Username pattern generators
const usernamePatterns = {
  basic: (): string => {
    const adjective = getRandomElement(WORDS.adjectives)
    const noun = getRandomElement(WORDS.nouns)
    const number = Math.floor(Math.random() * 10000)
    return `${adjective}${noun}${number}`
  },

  prefixed: (): string => {
    const prefix = getRandomElement(WORDS.prefixes)
    const noun = getRandomElement(WORDS.nouns)
    const number = Math.floor(Math.random() * 100)
    return `${prefix}${noun}${number}`
  },

  doubleAdjective: (): string => {
    const adj1 = getRandomElement(WORDS.adjectives)
    const adj2 = getRandomElement(WORDS.adjectives)
    const noun = getRandomElement(WORDS.nouns)
    return `${adj1}${adj2}${noun}`
  },

  doubleNoun: (): string => {
    const noun1 = getRandomElement(WORDS.nouns)
    const noun2 = getRandomElement(WORDS.nouns)
    const number = Math.floor(Math.random() * 100)
    return `${noun1}${number}${noun2}`
  },
}

export function generateUsername(): string {
  const patterns = Object.values(usernamePatterns)
  const selectedPattern = getRandomElement(patterns)
  return selectedPattern()
}

export async function generateUniqueUsername(
  checkExists: (username: string) => Promise<boolean>
): Promise<string> {
  const MAX_ATTEMPTS = 10
  let attempts = 0
  let username = generateUsername()

  while ((await checkExists(username)) && attempts < MAX_ATTEMPTS) {
    username = generateUsername()
    attempts++
  }

  if (attempts >= MAX_ATTEMPTS) {
    // Add a large random number to ensure uniqueness
    username = generateUsername() + Math.floor(Math.random() * 1000000)
  }

  return username
}
