# byome · tasks

A tiny WhatsApp-driven task manager for the two of us. Create projects, track
todos inside them, see who did what. Nothing ever gets deleted — only archived.

**Stack**: TanStack Start · Tailwind CSS + shadcn/ui · Convex · Vercel.

---

## Features

- Per-user password login (Thomas, Salal).
- Projects with colour tags and live todo counts.
- Todos with `title`, `description`, `status` (todo / in progress / done) and
  `priority` (low / medium / high).
- Inline status cycling, priority drop-down, and filters.
- Archive instead of delete — everything is recoverable from the **Archive**
  page.
- Per-item activity timeline (who created / updated / archived, and what
  changed).
- Realtime updates thanks to Convex subscriptions.

---

## First-time setup

```bash
pnpm install

# 1. Provision a Convex deployment. Follow the CLI prompts — it stores
#    CONVEX_DEPLOYMENT in .env.local and prints your deployment URL.
npx convex dev
```

When `convex dev` is running it watches `convex/**` and regenerates
`convex/_generated/*`. Leave it running or stop after the first successful push.

Copy the Convex URL that `convex dev` printed into `.env.local`:

```bash
cp .env.example .env.local
# then edit .env.local:
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
THOMAS_PASSWORD=super-secret-thomas
SALAL_PASSWORD=super-secret-salal
```

Seed Thomas and Salal:

```bash
pnpm seed
```

Re-running `pnpm seed` rotates their passwords, which is handy.

---

## Day-to-day

```bash
# Runs Vite + Convex together
pnpm dev:all

# Or separately
pnpm dev          # web on http://localhost:3000
pnpm dev:convex   # Convex schema push + type generation
```

Open http://localhost:3000 and sign in with `thomas` / `salal` plus the
password you set.

Useful scripts:

| Command | What it does |
| --- | --- |
| `pnpm build` | Production build via Nitro (Vercel preset). |
| `pnpm preview` | Preview the built app locally. |
| `pnpm seed` | Create/update Thomas & Salal using env passwords. |
| `pnpm typecheck` | `tsc --noEmit` across the app. |
| `pnpm check` | Biome lint + format check. |

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Convex, promote your dev deployment to production (or run
   `npx convex deploy`). Copy the **production** URL.
3. On Vercel:
   - Import the repo.
   - Framework preset: **TanStack Start** (Vercel auto-detects Nitro).
   - Add env vars:
     - `VITE_CONVEX_URL` → the prod Convex URL.
     - `CONVEX_DEPLOY_KEY` → from Convex dashboard → Settings → Deploy keys.
   - Build command: `pnpm build` (default). Install command: `pnpm install`.
4. Deploy. After the first deploy, seed the production DB:
   ```bash
   # point `VITE_CONVEX_URL` at production then:
   pnpm seed
   ```

That's it — the Vercel URL is the one you share. No server work on `byome`
needed; if you want a pretty URL, reverse-proxy it from your box or use a
Vercel custom domain.

---

## Architecture

```
convex/                 Convex functions (server)
  schema.ts             users, sessions, projects, todos, activities
  auth.ts               login / logout / getMe / seedUsers / changePassword
  projects.ts           list, get, create, update, archive, unarchive
  todos.ts              list, get, create, update, archive, unarchive
  activities.ts         listForEntity, listForProject
  helpers.ts            requireUser(token) session guard

src/
  routes/
    __root.tsx          HTML shell + Convex + Session providers
    index.tsx           Projects dashboard
    login.tsx           Sign-in form
    archived.tsx        Archive (projects + todos, one-click restore)
    projects.$projectId.tsx   Project detail — todos + activity sidebar
  components/
    AppShell.tsx        Top bar with nav and user menu
    AuthGate.tsx        Redirect to /login if no session
    ui/                 shadcn primitives (button, dialog, etc.)
  lib/
    convex.ts           ConvexReactClient singleton
    session.tsx         SessionProvider: token in localStorage, getMe query
    auth.ts             getStoredToken / setStoredToken

scripts/
  seed.ts               Create Thomas & Salal via Convex HTTP client
```

**Auth model** — sessions are random 32-byte tokens stored in Convex and the
browser's localStorage. Every mutation/query that changes data takes the token
as an argument and is validated with `requireUser`. Bcrypt hashes are stored
server-side only.

**Activity tracking** — every create / update / archive / unarchive writes an
`activities` row with `userId`, `entityType`, `entityId`, and a human-readable
`details` string. Queryable per-entity (todo history modal) or per-project
(sidebar timeline).

---

## Adding a feature

1. Add/adjust the Convex table in `convex/schema.ts`.
2. Write a mutation or query in `convex/<module>.ts` — always call
   `await requireUser(ctx, token)` first, always write an `activities` row if
   you change state.
3. Wire it in the UI via `useQuery(api.x.y, { token, ... })` or
   `useMutation(api.x.y)`.

Because everything flows through Convex, other tabs/users see changes
immediately without extra plumbing.
