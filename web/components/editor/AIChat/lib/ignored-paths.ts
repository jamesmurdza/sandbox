// Ignore certain folders and files from the file tree

export const ignoredFolders = [
  // Package managers
  "node_modules",
  "venv",
  ".env",
  "env",
  ".venv",
  "virtualenv",
  "pip-wheel-metadata",

  // Build outputs
  ".next",
  "dist",
  "build",
  "out",
  "__pycache__",
  ".webpack",
  ".serverless",
  "storybook-static",

  // Version control
  ".git",
  ".svn",
  ".hg", // Mercurial

  // Cache and temp files
  ".cache",
  "coverage",
  "tmp",
  ".temp",
  ".npm",
  ".pnpm",
  ".yarn",
  ".eslintcache",
  ".stylelintcache",

  // IDE specific
  ".idea",
  ".vscode",
  ".vs",
  ".sublime",

  // Framework specific
  ".streamlit",
  ".next",
  "static",
  ".pytest_cache",
  ".nuxt",
  ".docusaurus",
  ".remix",
  ".parcel-cache",
  "public/build", // Remix/Rails
  ".turbo", // Turborepo

  // Logs
  "logs",
  "*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "pnpm-debug.log*",
] as const

export const ignoredFiles = [
  ".DS_Store",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  ".env*.local",
  ".gitignore",
  ".npmrc",
  ".yarnrc",
  ".editorconfig",
  ".prettierrc",
  ".eslintrc",
  ".browserslistrc",
  "tsconfig.tsbuildinfo",
  "*.pyc",
  "*.pyo",
  "*.pyd",
  "*.so",
  "*.dll",
  "*.dylib",
  "*.class",
  "*.exe",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "composer.lock",
  "poetry.lock",
  "Gemfile.lock",
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.chunk.*",
  "*.hot-update.*",
  ".vercel",
  ".netlify",
] as const
