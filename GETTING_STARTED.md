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
  schema.ts             users, sessions, projects, todos, activities
  auth.ts               login, logout, getMe, seedUsers, changePassword
  projects.ts           list, get, create, update, archive, unarchive
  todos.ts              list, get, create, update, archive, unarchive
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
