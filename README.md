# GitWit Sandbox 📦🪄

![2024-10-2307 17 42-ezgif com-resize](https://github.com/user-attachments/assets/a4057129-81a7-4a31-a093-c8bc8189ae72)

Sandbox is an open-source cloud-based code editing environment with custom AI code generation, live preview, real-time collaboration and AI chat.

For the latest updates, join our Discord server: [discord.gitwit.dev](https://discord.gitwit.dev/).

## Running Locally

Notes:

- Double check that whatever you change "SUPERDUPERSECRET" to, it's the same in all config files.
- Right now we are loading project templates from a custom Cloudflare bucket which isn't covered in this guide, but that be updated/fixed very soon.

### 0. Requirements

The application uses NodeJS for the backend, NextJS for the frontend and Cloudflare workers for additional backend tasks.

Needed accounts to set up:

- [Clerk](https://clerk.com/): Used for user authentication.
- [Liveblocks](https://liveblocks.io/): Used for collaborative editing.
- [E2B](https://e2b.dev/): Used for the terminals and live preview.
- [Cloudflare](https://www.cloudflare.com/): Used for relational data storage (D2) and file storage (R2).

A quick overview of the tech before we start: The deployment uses a **NextJS** app for the frontend and an **ExpressJS** server on the backend. Presumably that's because NextJS integrates well with Clerk middleware but not with Socket.io.

### 1. Initial setup

No surprise in the first step:

```bash
git clone https://github.com/jamesmurdza/sandbox
cd sandbox
```

Run `npm install` in:

```
/frontend
/backend/database
/backend/storage
/backend/server
/backend/ai
```

### 2. Adding Clerk

Setup the Clerk account.
Get the API keys from Clerk.

Update `/frontend/.env`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='🔑'
CLERK_SECRET_KEY='🔑'
```

### 3. Deploying the storage bucket

Go to Cloudflare.
Create and name an R2 storage bucket in the control panel.
Copy the account ID of one domain.

Update `/backend/storage/src/wrangler.toml`:

```
account_id = '🔑'
bucket_name = '🔑'
key = 'SUPERDUPERSECRET'
```

In the `/backend/storage/src` directory:

```
npx wrangler deploy
```

### 4. Deploying the database

Create a database:

```
npx wrangler d1 create sandbox-database
```

Use the output for the next setp.

Update `/backend/database/src/wrangler.toml`:

```
database_name = '🔑'
database_id = '🔑'
KEY = 'SUPERDUPERSECRET'
STORAGE_WORKER_URL = 'https://storage.🍎.workers.dev'
```

In the `/backend/database/src` directory:

```
npx wrangler deploy
```

### 5. Applying the database schema

Delete the `/backend/database/drizzle/meta` directory.

In the `/backend/database/` directory:

```
npm run generate
npx wrangler d1 execute sandbox-database --remote --file=./drizzle/0000_🍏_🍐.sql
```

### 6. Configuring the server

Update `/backend/server/.env`:

```
DATABASE_WORKER_URL='https://database.🍎.workers.dev'
STORAGE_WORKER_URL='https://storage.🍎.workers.dev'
WORKERS_KEY='SUPERDUPERSECRET'
```

### 7. Adding Liveblocks

Setup the Liveblocks account.

Update `/frontend/.env`:

```
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY='🔑'
LIVEBLOCKS_SECRET_KEY='🔑'
```

### 8. Adding E2B

Setup the E2B account.

Update `/backend/server/.env`:

```
E2B_API_KEY='🔑'
```

### 9. Adding AI code generation

In the `/backend/ai` directory:

```
npx wrangler deploy
```

Update `/backend/server/.env`:

```
AI_WORKER_URL='https://ai.🍎.workers.dev'
```

### 10. Configuring the frontend

Update `/frontend/.env`:

```
NEXT_PUBLIC_DATABASE_WORKER_URL='https://database.🍎.workers.dev'
NEXT_PUBLIC_STORAGE_WORKER_URL='https://storage.🍎.workers.dev'
NEXT_PUBLIC_WORKERS_KEY='SUPERDUPERSECRET'
```

### 11. Running the IDE

Run `npm run dev` simultaneously in:

```
/frontend
/backend/server
```

## Setting up Deployments

The steps above do not include steps to setup [Dokku](https://github.com/dokku/dokku), which is required for deployments.

**Note:** This is completely optional to set up if you just want to run GitWit Sandbox.

Setting up deployments first requires a separate domain (such as gitwit.app, which we use).

We then deploy Dokku on a separate server, according to this guide: https://dev.to/jamesmurdza/host-your-own-paas-platform-as-a-service-on-amazon-web-services-3f0d

The Sandbox platform connects to the Dokku server via SSH, using SSH keys specifically generated for this connection. The SSH key is stored on the Sandbox server, and the following environment variables are set in /backend/server/.env:

```bash
DOKKU_HOST=
DOKKU_USERNAME=
DOKKU_KEY=
```

## Creating Custom Templates

We're working on a process whereby anyone can contribute a custom template that others can use in the Sandbox environment. The process includes:

- Creating a [custom E2B Sandbox](https://e2b.dev/docs/sandbox-template) including the template files and dependencies
- Creating a file to specify the run command (e.g. "npm run dev")
- Testing the template with Dokku for deployment

Please reach out to us [on Discord](https://discord.gitwit.dev/) if you're interested in contributing.

## Contributing

Thanks for your interest in contributing! Review this section before submitting your first pull request. If you need any help, feel free contact us [on Discord](https://discord.gitwit.dev/).

### Structure

```
frontend/
├── app
├── assets
├── components
└── lib
backend/
├── server
├── database/
│   ├── src
│   └── drizzle
├── storage
└── ai
```

| Path               | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| `frontend`         | The Next.js application for the frontend.                    |
| `backend/server`   | The Express websocket server.                                |
| `backend/database` | API for interfacing with the D1 database (SQLite).           |
| `backend/storage`  | API for interfacing with R2 storage. Service-bound to `/backend/database`. |
| `backend/ai`       | API for making requests to Workers AI .                      |

### Development

#### Fork this repo

You can fork this repo by clicking the fork button in the top right corner of this page.

#### Clone repository

```bash
git clone https://github.com/<your-username>/sandbox.git
cd sandbox
```

#### Create a new branch

```bash
git checkout -b my-new-branch
```

### Commit convention

Before you create a Pull Request, please check that you use the [Conventional Commits format](https://www.conventionalcommits.org/en/v1.0.0/)

It should be in the form `category(scope or module): message` in your commit message from the following categories:

- `feat / feature`: all changes that introduce completely new code or new
  features

- `fix`: changes that fix a bug (ideally you will additionally reference an
  issue if present)

- `refactor`: any code related change that is not a fix nor a feature

- `docs`: changing existing or creating new documentation (i.e. README, docs for
  usage of a lib or cli usage)

- `chore`: all changes to the repository that do not fit into any of the above
  categories

  e.g. `feat(editor): improve tab switching speed`

---

## Tech stack

### Frontend

- [Next.js](https://nextjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Clerk](https://clerk.com/)
- [Monaco](https://microsoft.github.io/monaco-editor/)
- [Liveblocks](https://liveblocks.io/)

### Backend

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
  - [D1 database](https://developers.cloudflare.com/d1/)
  - [R2 storage](https://developers.cloudflare.com/r2/)
  - [Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Express](https://expressjs.com/)
- [Socket.io](https://socket.io/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [E2B](https://e2b.dev/)
