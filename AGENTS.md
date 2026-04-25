# AGENTS.md — CloudlyMcCloudFlare

Instructions for AI agents working on this codebase.

## Repo Layout

This is a **monorepo-style full-stack app** deployed to Cloudflare Workers:

```
src/client/   → React 19 SPA (Vite root is here)
src/server/   → Hono API on Workers
src/shared/   → Types + validators shared between client and server
migrations/   → D1 SQL migrations (applied via wrangler)
```

## Critical: Vite Root vs Project Root

Vite's `root` is `src/client`, NOT the project root. This means:

- `index.html` lives at `src/client/index.html`
- The `@cloudflare/vite-plugin` needs explicit `configPath` pointing to `wrangler.jsonc` at project root
- `persistState.path` must point to `.wrangler/state` at project root so Miniflare and `wrangler d1` CLI share the same SQLite
- Path aliases (`@shared`, `@server`, `@client`) are resolved from project root in `vite.config.ts`

If you add a new Vite plugin or change root, update `configPath` and `persistState` accordingly.

## Path Aliases

Three aliases are available everywhere:

```
@shared → src/shared
@server → src/server
@client → src/client
```

Configured in both `tsconfig.json` (paths) and `vite.config.ts` (resolve.alias).

## Client ↔ Server Route Contract

This is the most common source of bugs. The client (`src/client/lib/api.ts`) and server (`src/server/index.ts` route mounts) MUST agree on paths.

**Server mounts:**
```
/api/health    → health.ts
/api/zones     → zones.ts
/api/dns       → dns.ts      (routes use /:zoneId internally)
/api/groups    → groups.ts
/api/security  → security.ts (routes use /:zoneId/rules internally)
/api/templates → templates.ts
```

**When adding a new route:**
1. Add the handler in `src/server/routes/<name>.ts`
2. Mount it in `src/server/index.ts`: `app.route("/api/<name>", handler)`
3. Add the client method in `src/client/lib/api.ts` under the appropriate namespace
4. The client path must be relative to `/api` (the `BASE_URL`), so for a server route at `/api/dns/:zoneId`, the client calls `/dns/${zoneId}`

## Database (D1 + Drizzle)

- Schema: `src/server/db/schema.ts` (Drizzle ORM definitions)
- Migrations: `migrations/` directory (raw SQL, applied via `wrangler d1 migrations apply`)
- Connection factory: `src/server/db/index.ts` — call `createDb(c.env.DB)` in route handlers

**Tables:** groups, group_zones, custom_templates, deployment_log, zone_cache

When adding tables:
1. Add the Drizzle table in `schema.ts`
2. Create a new SQL migration file in `migrations/` (increment the number)
3. Apply locally: `npm run db:migrate:local`
4. Apply remote: `npm run db:migrate`

## Cloudflare API Client

`src/server/services/cloudflare.ts` — a typed client for CF API v4.

Key features to know:
- **ConcurrencyQueue** limits parallel requests to 4 (CF rate limits)
- **Retry with backoff** (3 attempts, exponential)
- **Automatic pagination** for list endpoints
- All methods are typed against `src/server/types/cloudflare.ts`

When adding new CF API calls, follow the existing pattern:
- Add types to `cloudflare.ts`
- Add the method to `CloudflareClient` class
- Use `this.request<T>()` for simple endpoints
- Use manual pagination for list endpoints that return `result_info`

## Auth Middleware

`src/server/middleware/auth.ts` — Bearer token auth on all `/api/*` routes.

- **Skips** `/api/health` always
- **Skips** when `APP_SECRET` is unset or equals `"your_app_secret_here"` (local dev)
- In production, requires `Authorization: Bearer <APP_SECRET>` header

Do NOT remove or weaken the production auth check. The dev bypass is intentional.

## Environment & Bindings

Worker bindings are typed in `src/server/types/env.ts`:

```ts
type Bindings = {
  DB: D1Database;        // D1 binding
  CF_API_TOKEN: string;  // From .dev.vars or Workers Secrets
  CF_ACCOUNT_ID: string; // From wrangler.jsonc vars
  APP_SECRET: string;    // From .dev.vars or Workers Secrets
  ENVIRONMENT: string;   // "development" or "production"
};
```

Access them in Hono handlers via `c.env.DB`, `c.env.CF_API_TOKEN`, etc.

## Frontend Patterns

### Hooks
Each domain has a dedicated hook in `src/client/hooks/`:
- `useZones.ts` — zone list + selected zone
- `useDNSRecords.ts` — DNS CRUD with optimistic updates
- `useGroups.ts` — group CRUD with optimistic updates
- `useSecurityRules.ts` — WAF rule deployment + log
- `useToast.ts` — toast notifications

### Components
- Views: `src/client/components/<domain>/<Domain>View.tsx` — one per nav item
- Layout: `AppShell.tsx` wraps Header + Sidebar + main content
- Shared: `Modal`, `Toast`, `ConfirmDialog`, `EmptyState`, `LoadingSpinner`

### Styling
Tailwind CSS 3 with a dark theme. Global styles in `src/client/styles/global.css`. No CSS modules or styled-components.

## Shared Types

`src/shared/types.ts` defines domain types used by both client and server: `Zone`, `DNSRecord`, `Group`, `CustomRule`, `DeployPayload`, `RuleTemplate`, etc.

`src/shared/validators.ts` has Zod schemas for request validation (used server-side via `zValidator` wrapper).

## Running Locally

```bash
npm install
cp .env.example .dev.vars   # Edit with your real CF_API_TOKEN
npm run db:migrate:local     # Create D1 tables in local SQLite
npm run dev                  # Vite + Miniflare on http://localhost:5173
```

## Parallel Agent Guidelines

This codebase supports parallel work across these boundaries:

**Safe to parallelize:**
- Frontend component work (different views are independent)
- Backend route work (different route files are independent)
- Tests (when they exist)

**Must coordinate:**
- Changes to `src/shared/types.ts` affect both client and server
- Changes to `src/client/lib/api.ts` must match server routes
- Changes to `src/server/index.ts` (route mounts) affect the client
- Database schema changes require matching migration files

**When splitting work:**
- Assign one agent per view (DNS, Groups, Security, Templates, Dashboard)
- Keep `api.ts` ↔ route mount alignment as a review gate
- Shared types should be defined first before implementation agents start

## Linear

This project uses **Linear** for issue tracking.
Default team: **CHAOS**

### Creating Issues

```bash
# Create a simple issue
linear issues create "Fix login bug" --team CHAOS --priority high

# Create with full details and dependencies
linear issues create "Add OAuth integration" \
  --team CHAOS \
  --description "Integrate Google and GitHub OAuth providers" \
  --parent CHAOS-100 \
  --depends-on CHAOS-99 \
  --labels "backend,security" \
  --estimate 5

# List and view issues
linear issues list
linear issues get CHAOS-123
```

### Fetching private Linear images

`uploads.linear.app` URLs in issue descriptions require authentication.
Do **NOT** use `WebFetch` or `curl` — they will 401.

```bash
linear attachments download "https://uploads.linear.app/..."
# → /tmp/linear-img-<hash>.png
```

Then `Read` that path to view the image.

### Claude Code Skills

Available workflow skills (install with `linear skills install --all`):
- `/prd` - Create agent-friendly tickets with PRDs and sub-issues
- `/triage` - Analyze and prioritize backlog
- `/cycle-plan` - Plan cycles using velocity analytics
- `/retro` - Generate sprint retrospectives
- `/deps` - Analyze dependency chains

Run `linear skills list` for details.
