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
THOMAS_PASSWORD=super-secret-thomas
SALAL_PASSWORD=super-secret-salal
```

Seed the two built-in users:

```bash
pnpm seed
```

Re-running `pnpm seed` updates the user records and rotates their passwords to
whatever is currently in `.env.local`.

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

- `thomas`
- `salal`

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
| `pnpm seed` | Creates or updates the Thomas and Salal accounts. |
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
6. After the first production deploy, seed users against the production Convex URL:

```bash
pnpm seed
```

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

Sessions are random tokens stored in Convex and mirrored in browser
localStorage. Mutations and queries that require a signed-in user receive the
token explicitly and validate it with `requireUser`.

### Activity model

Every create, update, archive, and unarchive operation writes an activity row.
That activity can be shown per todo or as a timeline for an entire project.

## Extending the app

1. Update the schema in `convex/schema.ts` if the data model changes.
2. Add or update the relevant Convex query or mutation.
3. Validate auth with `requireUser` for protected operations.
4. Write an activity row whenever a change should appear in history.
5. Connect the UI with `useQuery` and `useMutation`.
