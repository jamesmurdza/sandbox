# GitWit Sandbox 📦🪄

![Screenshot 2025-06-26 at 7 45 45 PM](https://github.com/user-attachments/assets/dbb5f9e9-1407-4e28-bc3f-14e2db0ef03d)

Sandbox is an open-source cloud-based code editing environment with custom AI code generation, live preview, real-time collaboration, and AI chat.

For the latest updates, join our Discord server: [discord.gitwit.dev](https://discord.gitwit.dev/).

## Minimal Setup

A quick overview of the tech before we start: The deployment uses a **NextJS** app for the frontend and an **ExpressJS** server on the backend.

**Required accounts to get started:**

- [Clerk](https://clerk.com/): Used for user authentication.
- [E2B](https://e2b.dev/): Used for the terminals and live preview.
- [Anthropic](https://anthropic.com/) or AWS Bedrock: API keys for code generation.
- [OpenAI](https://openai.com/): API keys for applying AI-generated code diffs.

### 1. Clone the repository

No surprise in the first step:

```bash
git clone https://github.com/jamesmurdza/sandbox
cd sandbox
```

Copy .env files:

```bash
cp .env.example .env
cp web/.env.example web/.env
cp server/.env.example server/.env
```

Install dependencies:

```bash
npm install
```

### 2. Create a database

Create a database:

```sh
psql postgres -c "CREATE DATABASE sandbox;"
# psql postgres -U  postgres -c "CREATE DATABASE sandbox;"
```

Delete the `/db/drizzle/meta` directory.

In the `/web/` directory run:

```
npm run generate
npm run migrate
```

### 3. Configure environment variables

Get API keys for E2B, Clerk, OpenAI, and Anthropic.

Add them to the `.env` file along with the database connection string.

```
DATABASE_URL='🔑'
E2B_API_KEY='🔑'
CLERK_SECRET_KEY='🔑'
OPENAI_API_KEY='🔑'
ANTHROPIC_API_KEY='🔑'
```

As an alternative to the Anthropic API, you can use AWS Bedrock as described in [this section](#add-inference-on-aws-bedrock).

### 4. Run the IDE

Start the web app and server in development mode:

```bash
npm run dev
```

## Optional setup

### Add GitHub integration

<details>
<summary>Instructions</summary>

Setup GitHub OAuth for authentication.

Update `.env`:

```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

To get your GitHub Client ID and Client Secret:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) and create a new OAuth App
2. Set the "Authorization callback URL" to `http://localhost:3000/loading` if running locally
3. Set the "Homepage URL" to `http://localhost:3000` if running locally
4. Get the "Client ID" and "Client Secret" from the OAuth App

To get a Personal Access Token (PAT):

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Sandbox Testing")
4. Select the necessary scopes (typically `repo`, `user`, `read:org`)
5. Generate the token and copy it securely
</details>

### Add inference on AWS Bedrock

<details>
<summary>Instructions</summary>
To use the `anthropic.claude-3-7-sonnet-20250219-v1:0` model via Amazon Bedrock, follow these steps:

1. **Create an AWS Account** (if you don't have one)

   - Go to [aws.amazon.com](https://aws.amazon.com/) and sign up for an AWS account.

2. **Create an IAM User with Programmatic Access**

   - Navigate to IAM in the AWS Management Console.
   - Click "Users" → "Add users".
   - Enter a username and select "Programmatic access".
   - Attach permissions for Amazon Bedrock:

     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": ["bedrock:*", "kms:GenerateDataKey", "kms:Decrypt"],
           "Resource": "*"
         }
       ]
     }
     ```

   - Complete the process and save your Access Key ID and Secret Access Key.

3. **Enable Model Access in Bedrock**

   - Go to Amazon Bedrock in the AWS Console.
   - Navigate to "Model access" and request access to Anthropic Claude 3.7 Sonnet.
   - Wait for approval (usually immediate).
   - Note: Ensure you're in a supported region. Claude 3.7 Sonnet is available in regions like `us-east-1` (N. Virginia), `us-west-2` (Oregon), and others.

4. **Create a Provisioned Throughput**

   - In Bedrock, go to "Inference and Assessment" → "Provisioned Throughput".
   - Create a new inference profile for Claude 3.7 Sonnet.
   - Select the model ID: `anthropic.claude-3-7-sonnet-20250219-v1:0`
   - Choose your desired throughput capacity.
   - Copy the ARN (Amazon Resource Name) of your inference profile.

5. **Configure Environment Variables**

   - Add the following to your `.env` file:

     ```
     AWS_ACCESS_KEY_ID=your_access_key_id
     AWS_SECRET_ACCESS_KEY=your_secret_access_key
     AWS_REGION=your_aws_region
     AWS_ARN=your_inference_profile_arn
     ```

6. **Verify Setup**
   - After configuring the environment variables, restart your application.
   - Test the connection by sending a simple prompt to the model.
   - If you encounter issues, check the AWS CloudWatch logs for error messages.

**Note:** Using AWS Bedrock incurs costs based on your usage and provisioned throughput. Review the [AWS Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) before setting up.

</details>

### Add Deployments

<details>
<summary>Instructions</summary>
The steps above do not include steps to setup [Dokku](https://github.com/dokku/dokku), which is required for deployments.

**Note:** This is completely optional to set up if you just want to run GitWit Sandbox.

Setting up deployments first requires a separate domain (such as gitwit.app, which we use).

We then deploy Dokku on a separate server, according to this guide: <https://dev.to/jamesmurdza/host-your-own-paas-platform-as-a-service-on-amazon-web-services-3f0d>

And we install [dokku-daemon](https://github.com/dokku/dokku-daemon) with the following commands:

```
git clone https://github.com/dokku/dokku-daemon
cd dokku-daemon
sudo make install
systemctl start dokku-daemon
```

The Sandbox platform connects to the Dokku server via SSH, using SSH keys specifically generated for this connection. The SSH key is stored on the Sandbox server, and the following environment variables are set in `.env`:

```bash
DOKKU_HOST=
DOKKU_USERNAME=
DOKKU_KEY=
```

</details>

## Creating Custom Templates

<details>
<summary>Instructions</summary>
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
</details>

## Running Tests

To run the test suite, ensure both web app and server are running.

First, install dependencies in the test directory:

```bash
cd tests
npm install
```

Set up the following environment variables in the test directory:

```
CLERK_SECRET_KEY=sk_xxxxxxxxxxxxxxxxxxxxxx
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxx
CLERK_TEST_USER_ID=user_xxxxxxxxxxxxxxxxxxxxxx
```

**Note:** The `CLERK_TEST_USER_ID` should match the user ID that was used to sign up and is stored in your PostgreSQL database. You can find this ID in your database's users table or from your Clerk dashboard.

Make sure both web app and server are running, then execute:

```bash
npm run test
```

## Deployment

The backend server and deployments server can be deployed using AWS's EC2 service. See [our video guide](https://www.youtube.com/watch?v=WN8HQnimjmk) on how to do this.

## Contributing

Thanks for your interest in contributing! Review this section before submitting your first pull request. If you need any help, feel free contact us [on Discord](https://discord.gitwit.dev/).

### Structure

| Path         | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `web`        | The Next.js application for the frontend.                        |
| `web/api`    | API routes, db, and middlewares used by the frontend.            |
| `server`     | The Express websocket server and backend logic.                  |
| `server/src` | Source code for backend (db, middleware, services, utils, etc.). |
| `tests`      | Integration and unit tests for the project.                      |

### Code formatting

This repository uses [Prettier](https://marketplace.cursorapi.com/items?itemName=esbenp.prettier-vscode) for code formatting, which you will be prompted to install when you open the project. The formatting rules are specified in [.prettierrc](.prettierrc).

### Commit convention

When commiting, please use the [Conventional Commits format](https://www.conventionalcommits.org/en/v1.0.0/). Your commit should be in the form `category: message` using the following categories:

| Type               | Description                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `feat` / `feature` | All changes that introduce completely new code or new features                               |
| `fix`              | Changes that fix a bug (ideally with a reference to an issue if present)                     |
| `refactor`         | Any code-related change that is not a fix nor a feature                                      |
| `docs`             | Changing existing or creating new documentation (e.g., README, usage docs, CLI usage guides) |
| `chore`            | All changes to the repository that do not fit into any of the above categories               |
