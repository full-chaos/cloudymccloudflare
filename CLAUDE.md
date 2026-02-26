# CLAUDE.md — CloudlyMcCloudFlare

## What This Is

A Cloudflare zone management dashboard — React SPA + Hono API on Workers + D1 database. Manages DNS records, WAF/security rules, and zone groups across all domains in a CF account.

## Getting Started

```bash
npm install
cp .env.example .dev.vars   # Add your CF_API_TOKEN
npm run db:migrate:local     # Set up local D1 tables
npm run dev                  # http://localhost:5173
```

See [README.md](./README.md) for full setup including API token permissions.

## Key Commands

```bash
npm run dev              # Dev server (Vite + Miniflare)
npm run build            # Production build
npm run deploy           # Build + deploy to Workers
npm run typecheck        # tsc --noEmit
npm run test             # vitest
npm run db:migrate:local # Apply D1 migrations locally
npm run db:migrate       # Apply D1 migrations to remote D1
```

## Architecture

### Vite Root Gotcha

Vite `root` is `src/client`, NOT project root. The `@cloudflare/vite-plugin` needs explicit `configPath` and `persistState` in `vite.config.ts` to find `wrangler.jsonc` and share D1 state with the `wrangler` CLI. Do not change these without understanding the implications.

### Client ↔ Server Route Alignment

The #1 source of bugs. Server routes are mounted in `src/server/index.ts`:

```
/api/zones     /api/dns     /api/groups     /api/security     /api/templates
```

Client calls in `src/client/lib/api.ts` must match. The client `BASE_URL` is `/api`, so client paths are relative (e.g., `/dns/${zoneId}` maps to `/api/dns/:zoneId`).

**Always update both files together when adding/changing routes.**

### Path Aliases

`@shared`, `@server`, `@client` — configured in tsconfig.json and vite.config.ts.

### Auth

Bearer token auth on all `/api/*` except `/api/health`. Automatically bypassed in local dev when `APP_SECRET` is unset or equals `"your_app_secret_here"`. Do not weaken the production auth.

### CF API Client

`src/server/services/cloudflare.ts` — handles pagination, retry with exponential backoff, rate-limit queue (concurrency=4). Add new CF API methods here following the existing pattern.

### Database

D1 (SQLite) via Drizzle ORM. Schema in `src/server/db/schema.ts`, raw SQL migrations in `migrations/`. Five tables: `groups`, `group_zones`, `custom_templates`, `deployment_log`, `zone_cache`.

## Conventions

- **TypeScript strict mode** — no `any`, no implicit returns
- **Hono** for all API routes — typed bindings via `Bindings` type
- **Drizzle ORM** for all D1 queries — no raw SQL in route handlers
- **Zod** for request validation via `zValidator` wrapper
- **Tailwind CSS 3** with dark theme — no CSS modules
- **React 19** with function components and hooks only
- **Shared types** in `src/shared/types.ts` — imported by both client and server
- One hook per domain in `src/client/hooks/`
- One view component per nav item in `src/client/components/<domain>/`
- Optimistic UI updates with rollback on error (see `useDNSRecords`, `useGroups`)

## File Index

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite + CF plugin config (configPath, persistState) |
| `wrangler.jsonc` | Workers + D1 binding config |
| `src/server/index.ts` | Hono app — all route mounts |
| `src/server/services/cloudflare.ts` | CF API v4 client |
| `src/server/db/schema.ts` | Drizzle table definitions |
| `src/server/middleware/auth.ts` | Bearer auth (bypassed in dev) |
| `src/client/lib/api.ts` | Client HTTP layer (must match server routes) |
| `src/client/App.tsx` | Root component with view routing |
| `src/shared/types.ts` | Domain types shared by client + server |
| `src/shared/validators.ts` | Zod schemas for request validation |
| `migrations/0001_init.sql` | D1 schema DDL |

## Sensitive Files

- `.dev.vars` — contains `CF_API_TOKEN` (gitignored, never commit)
- `wrangler.jsonc` — contains `CF_ACCOUNT_ID` and D1 database ID (committed, not secret but account-specific)
