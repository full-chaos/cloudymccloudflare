# CloudlyMcCloudFlare

Multi-zone Cloudflare management dashboard. Manage DNS records, WAF/security rules, and zone groups across all your domains from a single interface.

<img width="1031" height="753" alt="Safari 2026-02-26 13 20 45" src="https://github.com/user-attachments/assets/29269fe2-df79-4924-9f0a-408991734f7a" />

## Stack

| Layer    | Technology                                 |
| -------- | ------------------------------------------ |
| Frontend | React 19, Tailwind CSS 4, Vite 8           |
| Backend  | Hono (Cloudflare Workers), Drizzle ORM     |
| Database | Cloudflare D1 (SQLite)                     |
| Runtime  | Cloudflare Workers (prod), Miniflare (dev) |
| API      | Cloudflare API v4                          |

## Prerequisites

- Node.js 20+
- A Cloudflare account with zones
- A Cloudflare API token (see [Token Setup](#api-token-setup))
- Wrangler CLI (`npm install -g wrangler` or use via npx)

## Quick Start

```bash
# Install dependencies
npm install

# Create .dev.vars from the example
cp .env.example .dev.vars

# Edit .dev.vars with your real Cloudflare API token
# (see Token Setup below)

# Apply D1 migrations locally
npm run db:migrate:local

# Start the dev server
npm run dev

# Open http://localhost:5173
```

## API Token Setup

Create a token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) with these permissions:

| Permission        | Access      |
| ----------------- | ----------- |
| Zone              | Read        |
| DNS               | Read + Edit |
| Zone Settings     | Read + Edit |
| Firewall Services | Read + Edit |
| Zone WAF          | Read + Edit |

Scope: **All zones in account** (or specific zones if preferred).

Paste the token into `.dev.vars`:

```
CF_API_TOKEN=your_token_here
CF_ACCOUNT_ID=your_account_id_here
APP_SECRET=your_app_secret_here
```

`APP_SECRET` protects the API in production. In local dev, auth is bypassed for localhost and private-network requests so the browser can call `/api/*` without injecting an `Authorization` header.

## Environment Variables

| Variable        | Where                        | Purpose                                |
| --------------- | ---------------------------- | -------------------------------------- |
| `CF_API_TOKEN`  | `.dev.vars` / Workers Secret | Cloudflare API bearer token            |
| `CF_ACCOUNT_ID` | `wrangler.jsonc` `vars`      | Cloudflare account ID                  |
| `APP_SECRET`    | `.dev.vars` / Workers Secret | Bearer token for API auth (production) |
| `ENVIRONMENT`   | `wrangler.jsonc` `vars`      | `development` or `production`          |

## Project Structure

```
cloudy-mccloudflare/
├── src/
│   ├── client/                  # React SPA (Vite root)
│   │   ├── components/
│   │   │   ├── dashboard/       # Zone overview + domain clustering
│   │   │   ├── dns/             # DNS record CRUD per zone
│   │   │   ├── groups/          # Zone grouping management
│   │   │   ├── security/        # WAF rule builder + deployment
│   │   │   ├── templates/       # Pre-built security rule templates
│   │   │   ├── layout/          # AppShell, Header, Sidebar
│   │   │   └── shared/          # Modal, Toast, ConfirmDialog, etc.
│   │   ├── hooks/               # React hooks (useZones, useDNS, etc.)
│   │   ├── lib/api.ts           # Client HTTP layer → /api/* routes
│   │   ├── types/               # Client-specific types
│   │   └── styles/global.css    # Tailwind 4 entry + @theme design tokens
│   ├── server/                  # Hono Workers backend
│   │   ├── routes/              # API route handlers
│   │   │   ├── zones.ts         # GET /api/zones, zone detail, settings
│   │   │   ├── dns.ts           # CRUD /api/dns/:zoneId
│   │   │   ├── groups.ts        # CRUD /api/groups
│   │   │   ├── security.ts      # WAF rules + batch deploy
│   │   │   ├── templates.ts     # Built-in rule templates
│   │   │   └── health.ts        # GET /api/health
│   │   ├── services/
│   │   │   ├── cloudflare.ts    # CF API v4 client (retry, pagination, concurrency queue)
│   │   │   ├── dns.service.ts   # DNS business logic
│   │   │   ├── group.service.ts # Group/zone membership logic
│   │   │   └── security.service.ts # WAF deployment logic
│   │   ├── middleware/
│   │   │   ├── auth.ts          # Bearer token auth (skipped in dev)
│   │   │   └── errorHandler.ts  # Global error handler
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle schema (5 tables)
│   │   │   └── index.ts         # DB connection factory
│   │   ├── types/
│   │   │   ├── env.ts           # Worker Bindings type
│   │   │   └── cloudflare.ts    # CF API response types
│   │   └── index.ts             # Hono app entry point
│   └── shared/                  # Types + validators shared by client & server
│       ├── types.ts
│       ├── validators.ts
│       └── constants.ts
├── migrations/
│   └── 0001_init.sql            # D1 schema (groups, templates, deploy log, zone cache)
├── wrangler.jsonc               # Workers + D1 config
├── vite.config.ts               # Vite + @cloudflare/vite-plugin
├── drizzle.config.ts            # Drizzle Kit config
├── postcss.config.js            # @tailwindcss/postcss (Tailwind 4 entry)
├── tsconfig.json
└── package.json
```

## API Routes

All routes are prefixed with `/api`.

| Method | Route                             | Description                             |
| ------ | --------------------------------- | --------------------------------------- |
| GET    | `/health`                         | Health check + environment info         |
| GET    | `/zones`                          | List all zones (cached in D1, 5min TTL) |
| GET    | `/zones/:id`                      | Zone detail                             |
| GET    | `/zones/:id/settings`             | Zone settings                           |
| PATCH  | `/zones/:id/settings`             | Update a zone setting                   |
| POST   | `/zones/sync`                     | Force re-sync zone cache                |
| GET    | `/dns/:zoneId`                    | List DNS records for a zone             |
| POST   | `/dns/:zoneId`                    | Create a DNS record                     |
| PATCH  | `/dns/:zoneId/:recordId`          | Update a DNS record                     |
| DELETE | `/dns/:zoneId/:recordId`          | Delete a DNS record                     |
| POST   | `/dns/batch`                      | Batch DNS operations                    |
| GET    | `/groups`                         | List all groups                         |
| POST   | `/groups`                         | Create a group                          |
| GET    | `/groups/:id`                     | Get group detail                        |
| PUT    | `/groups/:id`                     | Update a group                          |
| DELETE | `/groups/:id`                     | Delete a group                          |
| POST   | `/groups/:id/zones`               | Add zones to group                      |
| DELETE | `/groups/:id/zones`               | Remove zones from group                 |
| GET    | `/security/:zoneId/rules`         | Get WAF rules for zone                  |
| POST   | `/security/:zoneId/rules`         | Deploy rules to zone                    |
| DELETE | `/security/:zoneId/rules/:ruleId` | Delete a rule                           |
| POST   | `/security/deploy`                | Batch deploy to zones/groups            |
| GET    | `/security/deployments`           | Deployment audit log                    |
| GET    | `/templates`                      | List built-in rule templates            |

## Database Schema (D1)

Five tables managed via Drizzle ORM:

- **`groups`** — Named zone groups with color labels
- **`group_zones`** — Many-to-many zone membership (cascade delete)
- **`custom_templates`** — User-created rule templates
- **`deployment_log`** — Audit log for all WAF deployments
- **`zone_cache`** — Cached CF zone data (avoids API calls within 5min window)

## Scripts

```bash
npm run dev            # Start Vite + Miniflare dev server
npm run build          # Build client + server for Workers
npm run deploy         # Build + deploy to Cloudflare Workers
npm run typecheck      # TypeScript type checking
npm run test           # Run vitest
npm run db:migrate     # Apply D1 migrations (remote)
npm run db:migrate:local  # Apply D1 migrations (local Miniflare)
npm run db:generate    # Generate Drizzle migrations from schema
```

## Architecture Notes

### Vite + Cloudflare Plugin

The Vite `root` is `src/client` but the Wrangler config lives at the project root. Two config options bridge this:

```ts
cloudflare({
  configPath: path.resolve(__dirname, "wrangler.jsonc"),
  persistState: { path: path.resolve(__dirname, ".wrangler/state") },
});
```

`persistState` ensures `wrangler d1 migrations apply --local` and the Vite dev server share the same SQLite files.

### Cloudflare API Client

`src/server/services/cloudflare.ts` implements a full CF API v4 client with:

- **Automatic pagination** for zones, DNS records, and IP access rules
- **Exponential backoff retry** (3 attempts) with 429 rate-limit handling
- **Concurrency queue** (max 4 parallel requests) for batch zone operations
- **Typed responses** matching CF API shapes

### Auth

In production, all `/api/*` routes (except `/api/health`) require a `Bearer <APP_SECRET>` header. In local dev, auth is automatically bypassed for localhost and private-network requests.

`GET /api/health` also reports whether that bypass is active for the current request host via `result.auth.localBypassActive`, which makes local/prod auth behavior easy to confirm from the browser or `curl`.

### Styling (Tailwind 4 CSS-first)

All design tokens (colors, fonts, animation keyframes) live in `src/client/styles/global.css` inside a single `@theme` block. Tailwind 4 generates both the utility classes (`bg-bg-primary`, `font-display`, `animate-fade-up`) and the matching `:root` CSS custom properties (`var(--color-bg-primary)`, `var(--font-display)`) from those declarations, so there is no separate `tailwind.config.ts` and no parallel `:root { --color-*: … }` block. Add new tokens to `@theme` rather than re-introducing a JS config.

## Deployment

```bash
# Set production secrets
wrangler secret put CF_API_TOKEN
wrangler secret put APP_SECRET

# Apply migrations to remote D1
npm run db:migrate

# Build and deploy
npm run deploy
```

## License

Private.
