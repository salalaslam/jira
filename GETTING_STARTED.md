# Getting Started

This guide covers local setup, deployment, and the main technical shape of the
app.

## Stack

- TanStack Start
- Tailwind CSS with shadcn/ui primitives
- Convex for data, auth sessions, and realtime updates
- Vercel for deployment

## Prerequisites

- Node.js 20+
- pnpm
- A Convex account for a dev deployment

## First-time setup

Install dependencies:

```bash
pnpm install
```

Provision or reconnect a Convex development deployment:

```bash
npx convex dev
```

That command stores `CONVEX_DEPLOYMENT` in `.env.local`, pushes the current
backend code, and regenerates `convex/_generated/*`.

Create local env values:

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

```bash
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
ALICE_PASSWORD=super-secret-alice
BOB_PASSWORD=super-secret-bob
```

Configure Better Auth on the Convex deployment:

```bash
npx convex env set SITE_URL http://localhost:3000
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
```

Seed the two demo users:

```bash
pnpm seed
```

Re-running `pnpm seed` resets their passwords to whatever is currently in
`.env.local`.

To add a real account (sign-up is disabled in the app):

```bash
npx convex run users:create '{"username":"jane","displayName":"Jane"}'
npx convex run users:setPassword '{"username":"jane"}'   # reset later
```

Both print a generated password once; pass `"password"` to choose one.
Resetting a password signs that user out everywhere, including Claude.

## Run locally

Start the frontend and Convex watcher together:

```bash
pnpm dev:all
```

Or run them separately:

```bash
pnpm dev
pnpm dev:convex
```

The app runs at `http://localhost:3000`.

Sign in with:

- `alice`
- `bob`

Use the passwords you configured in `.env.local`.

## File attachments (S3-compatible storage)

Todo attachments are stored on MinIO (or any S3-compatible object store). Convex
actions upload and download files through presigned URLs, so the storage endpoint
must be reachable from Convex cloud and from your deployed app origin.

### 1. Expose MinIO publicly

Run MinIO behind HTTPS on your server. A minimal reverse-proxy example lives in
`scripts/minio-nginx.example.conf` — replace the placeholder hostnames and TLS
paths before deploying.

Point DNS for your public MinIO hostname at the server. If you use a CDN or
reverse proxy in front of the origin, ensure [Convex egress IPs](https://docs.convex.dev/production/networking)
can still reach the storage endpoint.

Restrict public access to:

- **Browser uploads/downloads** from your production app origin (and optionally
  `http://localhost:3000` during local dev)
- **Convex backend** calls (AWS SDK auth from Convex egress IPs)

### 2. Create a bucket and access key

In the MinIO console, create a dedicated bucket and an access key scoped to
that bucket.

### 3. Configure Convex environment variables

In the [Convex dashboard](https://dashboard.convex.dev) for this deployment,
set:

| Variable | Example |
| --- | --- |
| `MINIO_ENDPOINT` | `https://<your-minio-host>` |
| `MINIO_PUBLIC_URL` | `https://<your-minio-host>` |
| `MINIO_ACCESS_KEY` | your access key |
| `MINIO_SECRET_KEY` | your secret key |
| `MINIO_BUCKET` | `<your-bucket>` |
| `MINIO_ALLOWED_ORIGINS` | `https://<your-vercel-app>.vercel.app` |

`MINIO_PUBLIC_URL` can differ from `MINIO_ENDPOINT` when Convex signs against an
internal URL but browsers must use a public host. For a single public endpoint,
set both to the same value.

`MINIO_ALLOWED_ORIGINS` is required — comma-separate multiple origins if needed
(e.g. production URL plus `http://localhost:3000` for local dev).

Attachments are limited to **20 MB** per file.

## Useful scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Runs the frontend on `http://localhost:3000`. |
| `pnpm dev:convex` | Runs Convex in watch mode and regenerates types. |
| `pnpm dev:all` | Runs frontend and Convex together. |
| `pnpm seed` | Creates the Alice and Bob accounts or resets their passwords. |
| `pnpm ticket` | CLI to show or change a ticket's status (`--help` for usage). |
| `pnpm build` | Builds the production app. |
| `pnpm preview` | Previews the production build locally. |
| `pnpm typecheck` | Runs `tsc --noEmit`. |
| `pnpm check` | Runs Biome checks. |
| `pnpm test` | Runs the Vitest suite. |

## Deployment

1. Push the repository to GitHub.
2. Promote your Convex development deployment to production, or run `npx convex deploy`.
3. In Vercel, import the repository.
4. Set these environment variables in Vercel:
   - `VITE_CONVEX_URL` with the production Convex URL
   - `CONVEX_DEPLOY_KEY` from the Convex dashboard deploy keys section
5. Use the default install command `pnpm install` and build command `pnpm build`.
6. On the production Convex deployment, set `SITE_URL` to the public app URL
   (e.g. `https://<your-vercel-app>.vercel.app`) and a fresh
   `BETTER_AUTH_SECRET`, then create accounts with
   `npx convex run --prod users:create '{...}'`.

`scripts/deploy.sh` deploys Convex then Vercel in one step.

## Technical overview

```text
convex/                 Convex functions and schema
  schema.ts             users, sessions, projects, todos, activities, attachments
  auth.ts               login, logout, getMe, seedUsers, changePassword
  projects.ts           list, get, create, update, archive, unarchive
  todos.ts              list, get, create, update, archive, unarchive
  attachments.ts        attachment metadata queries and mutations
  attachmentActions.ts  presigned MinIO upload/download actions
  storage.ts            MinIO S3 client (Node actions only)
  activities.ts         activity queries
  helpers.ts            requireUser(token)

src/
  routes/
    __root.tsx          app shell, providers, theme, toaster
    index.tsx           projects dashboard
    login.tsx           sign-in screen
    archived.tsx        archived projects and todos
    projects.$projectId.tsx
                        project detail with filters and activity
  components/
    AppShell.tsx        navigation and account menu
    AuthGate.tsx        route guard for signed-in views
    ui/                 shadcn-based UI primitives
  lib/
    convex.ts           Convex client singleton
    session.tsx         session provider and auth actions
    auth.ts             localStorage token persistence

scripts/
  seed.ts               seed base users
```

### Auth model

Auth is [Better Auth](https://better-auth.com) running inside Convex via the
`@convex-dev/better-auth` component. Users sign in with username + password;
public sign-up is disabled and accounts are created with `users:create`.

- The web app proxies `/api/auth/*` to the Convex HTTP actions origin, so the
  session cookie is first-party. The browser exchanges it for a short-lived
  Convex JWT, and functions read the user with `requireUser(ctx)`.
- App tables reference the app's own `users` table; `users.authUserId` links
  each row to its Better Auth user.
- Passwords are bcrypt hashes, so hashes from the pre-Better Auth system keep
  working (`userAccounts:migrateLegacyUsers` moved them over).

### MCP server (Claude connector)

`/api/mcp` is a remote MCP server (Streamable HTTP) so teammates can read and
update tickets from Claude. It is implemented in `convex/http.ts` and
`convex/mcpTools.ts`, and proxied through the web app.

- OAuth 2.1 with dynamic client registration and PKCE comes from Better Auth's
  `mcp` plugin. Discovery documents are served at `/.well-known/*`.
- Client registration only accepts Claude's callback URLs and loopback
  addresses. Add others with the `MCP_ALLOWED_REDIRECT_URIS` Convex env var
  (comma-separated).
- Tools: `list_projects`, `list_tickets`, `get_ticket`, `create_ticket`,
  `update_ticket`. Changes are attributed to the signed-in user and respect
  project locks. Archiving and project admin are intentionally not exposed.

See [docs/claude-connector.md](./docs/claude-connector.md) for the end-user
setup guide.

### Activity model

Every create, update, archive, and unarchive operation writes an activity row.
That activity can be shown per todo or as a timeline for an entire project.

## Extending the app

1. Update the schema in `convex/schema.ts` if the data model changes.
2. Add or update the relevant Convex query or mutation.
3. Validate auth with `requireUser(ctx)` for protected operations.
4. Write an activity row whenever a change should appear in history.
5. Connect the UI with `useQuery` and `useMutation`.
6. If MCP clients should have it too, add a tool in `convex/http.ts` backed by
   an internal function in `convex/mcpTools.ts`.
