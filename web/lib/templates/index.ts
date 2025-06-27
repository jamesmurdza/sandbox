export interface TemplateConfig {
  id: string
  name: string
  runCommand: string
  fileStructure: {
    [key: string]: {
      purpose: string
      description: string
    }
  }
  conventions: string[]
  dependencies?: {
    [key: string]: string
  }
  scripts?: {
    [key: string]: string
  }
}

export const templateConfigs: { [key: string]: TemplateConfig } = {
  reactjs: {
    id: "reactjs",
    name: "React",
    runCommand: "npm run dev",
    fileStructure: {
      "src/": {
        purpose: "source",
        description: "Contains all React components and application logic",
      },
      "src/components/": {
        purpose: "components",
        description: "Reusable React components",
      },
      "src/lib/": {
        purpose: "utilities",
        description: "Utility functions and shared code",
      },
      "src/App.tsx": {
        purpose: "entry",
        description: "Main application component",
      },
      "src/index.tsx": {
        purpose: "entry",
        description: "Application entry point",
      },
      "src/index.css": {
        purpose: "styles",
        description: "Global CSS styles",
      },
      "public/": {
        purpose: "static",
        description: "Static assets and index.html",
      },
      "tsconfig.json": {
        purpose: "config",
        description: "TypeScript configuration",
      },
      "vite.config.ts": {
        purpose: "config",
        description: "Vite bundler configuration",
      },
      "package.json": {
        purpose: "config",
        description: "Project dependencies and scripts",
      },
    },
    conventions: [
      "Use functional components with hooks",
      "Follow React naming conventions (PascalCase for components)",
      "Keep components small and focused",
      "Use TypeScript for type safety",
    ],
    dependencies: {
      "@radix-ui/react-icons": "^1.3.0",
      "@radix-ui/react-slot": "^1.1.0",
      "class-variance-authority": "^0.7.0",
      clsx: "^2.1.1",
      "lucide-react": "^0.441.0",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "tailwind-merge": "^2.5.2",
      "tailwindcss-animate": "^1.0.7",
    },
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
  },
  // Next.js template config
  nextjs: {
    id: "nextjs",
    name: "NextJS",
    runCommand: "npm run dev",
    fileStructure: {
      "pages/": {
        purpose: "routing",
        description: "Page components and API routes",
      },
      "pages/api/": {
        purpose: "api",
        description: "API route handlers",
      },
      "pages/_app.tsx": {
        purpose: "entry",
        description: "Application wrapper component",
      },
      "pages/index.tsx": {
        purpose: "page",
        description: "Homepage component",
      },
      "public/": {
        purpose: "static",
        description: "Static assets and files",
      },
      "styles/": {
        purpose: "styles",
        description: "CSS modules and global styles",
      },
      "styles/globals.css": {
        purpose: "styles",
        description: "Global CSS styles",
      },
      "styles/Home.module.css": {
        purpose: "styles",
        description: "Homepage-specific styles",
      },
      "next.config.js": {
        purpose: "config",
        description: "Next.js configuration",
      },
      "next-env.d.ts": {
        purpose: "types",
        description: "Next.js TypeScript declarations",
      },
      "tsconfig.json": {
        purpose: "config",
        description: "TypeScript configuration",
      },
      "package.json": {
        purpose: "config",
        description: "Project dependencies and scripts",
      },
    },
    conventions: [
      "Use file-system based routing",
      "Keep API routes in pages/api",
      "Use CSS Modules for component styles",
      "Follow Next.js data fetching patterns",
    ],
    dependencies: {
      next: "^14.1.0",
      react: "^18.2.0",
      "react-dom": "18.2.0",
      tailwindcss: "^3.4.1",
    },
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
  },
  // Streamlit template config
  streamlit: {
    id: "streamlit",
    name: "Streamlit",
    runCommand: "./venv/bin/streamlit run main.py --server.runOnSave true",
    fileStructure: {
      "main.py": {
        purpose: "entry",
        description: "Main Streamlit application file",
      },
      "requirements.txt": {
        purpose: "dependencies",
        description: "Python package dependencies",
      },
      Procfile: {
        purpose: "deployment",
        description: "Deployment configuration for hosting platforms",
      },
      "venv/": {
        purpose: "environment",
        description: "Python virtual environment directory",
      },
    },
    conventions: [
      "Use Streamlit components for UI",
      "Follow PEP 8 style guide",
      "Keep dependencies in requirements.txt",
      "Use virtual environment for isolation",
    ],
    dependencies: {
      streamlit: "^1.40.0",
      altair: "^5.5.0",
    },
    scripts: {
      start: "streamlit run main.py",
      dev: "./venv/bin/streamlit run main.py --server.runOnSave true",
    },
  },
  // HTML template config
  vanillajs: {
    id: "vanillajs",
    name: "HTML/JS",
    runCommand: "npm run dev",
    fileStructure: {
      "index.html": {
        purpose: "entry",
        description: "Main HTML entry point",
      },
      "style.css": {
        purpose: "styles",
        description: "Global CSS styles",
      },
      "script.js": {
        purpose: "scripts",
        description: "JavaScript application logic",
      },
      "package.json": {
        purpose: "config",
        description: "Project dependencies and scripts",
      },
      "package-lock.json": {
        purpose: "config",
        description: "Locked dependency versions",
      },
      "vite.config.js": {
        purpose: "config",
        description: "Vite bundler configuration",
      },
    },
    conventions: [
      "Use semantic HTML elements",
      "Keep CSS modular and organized",
      "Write clean, modular JavaScript",
      "Follow modern ES6+ practices",
    ],
    dependencies: {
      vite: "^5.0.12",
    },
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
  },
  // PHP template config
  php: {
    id: "php",
    name: "PHP",
    runCommand: "npx vite",
    fileStructure: {
      "index.php": {
        purpose: "entry",
        description: "Main PHP entry point",
      },
      "package.json": {
        purpose: "config",
        description: "Frontend dependencies and scripts",
      },
      "package-lock.json": {
        purpose: "config",
        description: "Locked dependency versions",
      },
      "vite.config.js": {
        purpose: "config",
        description: "Vite configuration for frontend assets",
      },
      "node_modules/": {
        purpose: "dependencies",
        description: "Frontend dependency files",
      },
    },
    conventions: [
      "Follow PSR-12 coding standards",
      "Use modern PHP 8+ features",
      "Organize assets with Vite",
      "Keep PHP logic separate from presentation",
    ],
    dependencies: {
      vite: "^5.0.0",
    },
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
  },
}
