# GitWit Sandbox 📦🪄

![2024-10-2307 17 42-ezgif com-resize](https://github.com/user-attachments/assets/a4057129-81a7-4a31-a093-c8bc8189ae72)

Sandbox is an open-source cloud-based code editing environment with custom AI code generation, live preview, real-time collaboration, and AI chat.

For the latest updates, join our Discord server: [discord.gitwit.dev](https://discord.gitwit.dev/).

## Running Locally

### 0. Requirements

The application uses NodeJS for the backend, NextJS for the frontend, and Cloudflare workers for additional backend tasks.

Needed accounts to set up:

- [Clerk](https://clerk.com/): Used for user authentication.
- [E2B](https://e2b.dev/): Used for the terminals and live preview.
- [Anthropic](https://anthropic.com/) and [OpenAI](https://openai.com/): API keys for code generation.

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
/backend/server
```

### 2. Adding Clerk

Setup the Clerk account.
Get the API keys from Clerk.

Update `/frontend/.env`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='🔑'
CLERK_SECRET_KEY='🔑'
```

### 4. Deploying the database

Create a database:

```
psql postgres -c "CREATE DATABASE sandbox;"
```

Update `backend/server/.env` with the database connection string.

```
DATABASE_URL=postgresql://localhost:5432/sandbox
```

Follow this [guide](https://docs.google.com/document/d/1w5dA5daic_sIYB5Seni1KvnFx51pPV2so6lLdN2xa7Q/edit?usp=sharing) for more info.

### 5. Applying the database schema

Delete the `/backend/server/drizzle/meta` directory.

In the `/backend/server/` directory:

```
npm run generate
npm run migrate
```

### 6. Adding E2B

Setup the E2B account.

Update `/backend/server/.env`:

```
E2B_API_KEY='🔑'
```

### 7. Configuring the frontend

Update `/frontend/.env`:

```
NEXT_PUBLIC_SERVER_URL='http://localhost:4000'
ANTHROPIC_API_KEY='🔑'

OPENAI_API_KEY='🔑'
```

### 8. Running the IDE

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

And we install [dokku-daemon](https://github.com/dokku/dokku-daemon) with the following commands:

```
git clone https://github.com/dokku/dokku-daemon
cd dokku-daemon
sudo make install
systemctl start dokku-daemon
```

The Sandbox platform connects to the Dokku server via SSH, using SSH keys specifically generated for this connection. The SSH key is stored on the Sandbox server, and the following environment variables are set in /backend/server/.env:

```bash
DOKKU_HOST=
DOKKU_USERNAME=
DOKKU_KEY=
```

## Deploying to AWS

The backend server and deployments server can be deployed using AWS's EC2 service. See [our video guide](https://www.youtube.com/watch?v=WN8HQnimjmk) on how to do this.

## Creating Custom Templates

Anyone can contribute a custom template for integration in Sandbox. Since Sandbox is built on E2B, there is no limitation to what langauge or runtime a Sandbox can use.

Currently there are five templates:

- [jamesmurdza/dokku-reactjs-template](https://github.com/jamesmurdza/dokku-reactjs-template)
- [jamesmurdza/dokku-vanillajs-template](https://github.com/jamesmurdza/dokku-vanillajs-template)
- [jamesmurdza/dokku-nextjs-template](https://github.com/jamesmurdza/dokku-nextjs-template)
- [jamesmurdza/dokku-streamlit-template](https://github.com/jamesmurdza/dokku-streamlit-template)
- [omarrwd/dokku-php-template](https://github.com/omarrwd/dokku-php-template)

To create your own template, you can fork one of the above templates or start with a new blank repository. The template should have at least an `e2b.Dockerfile`, which is used by E2B to create the development environment. Optionally, a `Dockerfile` can be added which will be used to create the project build when it is deployed.

To test the template, you must have an [E2B account](https://e2b.dev/) and the [E2B CLI tools](https://e2b.dev/docs/cli) installed. Then, in the Terminal, run:

```
e2b auth login
```

Then, navigate to your template directory and run the following command where **TEMPLATENAME** is the name of your template:

```
e2b template build -d e2b.Dockerfile -n TEMPLATENAME
```

Finally, to test your template run:

```
e2b sandbox spawn TEMPLATENAME
cd project
```

You will see a URL in the form of `https://xxxxxxxxxxxxxxxxxxx.e2b-staging.com`.

Now, run the command to start your development server.

To see the running server, visit the public url `https://<PORT>-xxxxxxxxxxxxxxxxxxx.e2b-staging.com`.

If you've done this and it works, let us know and we'll add your template to Sandbox! Please reach out to us [on Discord](https://discord.gitwit.dev/) with any questions or to submit your working template.

Note: In the future, we will add a way to specify the command triggered by the "Run" button (e.g. "npm run dev").

For more information, see:

- [Custom E2B Sandboxes](https://e2b.dev/docs/sandbox-template)
- [Dokku Builders](https://dokku.com/docs/deployment/builders/builder-management/)

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
└── storage
```

| Path               | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `frontend`         | The Next.js application for the frontend.                                  |
| `backend/server`   | The Express websocket server.                                              |
| `backend/database` | API for interfacing with the D1 database (SQLite).                         |
| `backend/storage`  | API for interfacing with R2 storage. Service-bound to `/backend/database`. |

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

### Code formatting

This repository uses [Prettier](https://marketplace.cursorapi.com/items?itemName=esbenp.prettier-vscode) for code formatting, which you will be prompted to install when you open the project. The formatting rules are specified in [.prettierrc](.prettierrc).

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
