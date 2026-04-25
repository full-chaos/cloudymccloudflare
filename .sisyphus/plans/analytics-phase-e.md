# Analytics Phase E — New Dimensions

**Linear:** CHAOS-1293 · **Milestone:** Visualization Update · **Branch:** `feat/analytics-phase-e` · **Base:** `main` @ `37a07bd`

## 1. Goal

Add non-volume drilldown dimensions to the analytics pages built in PR #17 so users can see traffic broken down by **country**, **HTTP status code**, **HTTP/TLS protocol versions**, and **WAF rule activity**, on the same Account Overview / Group Drilldown / Cluster Drilldown / Zone Drilldown pages.

## 2. CF Plan Reality Check (PROBED)

Account `f39dbcd4130fd731be7f0f77bf013e01` is on Cloudflare's **Free Website** plan. Live GraphQL probes against `https://api.cloudflare.com/client/v4/graphql`:

| Field / dataset | Status on Free | Notes |
|---|---|---|
| `httpRequests1hGroups.sum.countryMap` | ✅ Works | Returns `{clientCountryName, requests}[]` per hour bucket |
| `httpRequests1hGroups.sum.responseStatusMap` | ✅ Works | Returns `{edgeResponseStatus, requests}[]` per hour bucket |
| `httpRequests1hGroups.sum.clientHTTPVersionMap` | ✅ Works | `{clientHTTPProtocol, requests}[]` — HTTP/1.0, HTTP/1.1, HTTP/2, HTTP/3 |
| `httpRequests1hGroups.sum.clientSSLMap` | ✅ Works | `{clientSSLProtocol, requests}[]` — TLSv1.2, TLSv1.3, unknown |
| `firewallEventsAdaptive` (raw events) | ✅ Works | Has `ruleId, source, action, clientCountryName, clientRequestPath, edgeResponseStatus, datetime` per event. **Max window 1 day per query** |
| `firewallEventsAdaptiveGroups` (server-aggregated) | ❌ `authz` denied | Forces us to aggregate firewall events client-side |
| `httpRequests1mGroups` (minute granularity) | ❌ `authz` denied | Blocks per-path top-N |
| Window > 3 days on `httpRequests1hGroups` | ❌ `quota` denied | Existing `splitGraphQLWindows` already handles |

**Implication:** of the 4 dimensions Phase E originally promised (country, status, paths, WAF), **3 ship as designed; "top URL paths" is not implementable on Free plan**. Replacing it with **Connection Profile** (HTTP version + TLS version donuts), which IS available, gives a 4th meaningful dimension on the same surface.

## 3. Scope

### In-Scope (this PR)

| Sub-feature | Backend dataset | Frontend chart | Tabs added to |
|---|---|---|---|
| **E-Country** | `httpRequests1hGroups.sum.countryMap` | `GeoChoropleth` + `TopNBarChart` | Account, Group, Cluster, Zone |
| **E-Status** | `httpRequests1hGroups.sum.responseStatusMap` | `StatusCodeDonut` | Account, Group, Cluster, Zone |
| **E-Protocol** | `httpRequests1hGroups.sum.clientHTTPVersionMap` + `clientSSLMap` | `ConnectionProfileDonuts` (two side-by-side donuts) | Account, Group, Cluster, Zone |
| **E-Firewall** | `firewallEventsAdaptive` raw events, aggregated by `(ruleId, source, action)` | `WAFRuleBreakdown` (horizontal bar, top 10 rules) + count of events under each `action` | Account, Group, Cluster, Zone |

All 4 dimensions hang off a new `<DimensionTabs>` strip placed beneath the existing chart sections. Each drilldown level scopes the data to its own zone(s).

### Explicitly Out-of-Scope

- **Top URL paths** — requires Pro+ plan or `httpRequests1mGroups`. File CHAOS-1295 follow-up "Top requested paths (requires Pro plan)" with the probe transcript attached.
- **Bot-vs-human split** — original ticket mentions; deferred (needs Bot Management feature).
- **Sub-hour resolution** — original ticket mentions; deferred.
- **Period-over-period comparison** — separate ticket.

## 4. Architecture

### 4.1 D1 Schema (new tables — migration `0004_analytics_dimensions.sql`)

Four narrow append-only tables. All `(zone_id, hour_bucket, …)` PKs with onConflictDoUpdate matching the existing `analytics_zone_hourly` pattern.

```sql
CREATE TABLE analytics_zone_country_hourly (
  zone_id        TEXT NOT NULL,
  hour_bucket    TEXT NOT NULL,            -- ISO 8601 UTC, top of hour
  country_code   TEXT NOT NULL,            -- ISO 3166-1 alpha-2 ('US', 'DE', 'XX' for unknown)
  requests       INTEGER NOT NULL DEFAULT 0,
  fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, country_code)
);
CREATE INDEX idx_country_zone_hour ON analytics_zone_country_hourly (zone_id, hour_bucket);

CREATE TABLE analytics_zone_status_hourly (
  zone_id        TEXT NOT NULL,
  hour_bucket    TEXT NOT NULL,
  status_code    INTEGER NOT NULL,          -- 200, 301, 403, 404, 500, ...; 0 = "no response"
  requests       INTEGER NOT NULL DEFAULT 0,
  fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, status_code)
);
CREATE INDEX idx_status_zone_hour ON analytics_zone_status_hourly (zone_id, hour_bucket);

-- HTTP version and TLS version are stored in TWO separate tables. CF returns
-- them as independent marginal aggregates (clientHTTPVersionMap, clientSSLMap),
-- not as a joint distribution, so a single table keyed on the cross-product
-- would have no source data to populate. The frontend renders two independent
-- donuts side-by-side which exactly matches this schema.
CREATE TABLE analytics_zone_http_version_hourly (
  zone_id        TEXT NOT NULL,
  hour_bucket    TEXT NOT NULL,
  http_version   TEXT NOT NULL,             -- 'HTTP/1.0', 'HTTP/1.1', 'HTTP/2', 'HTTP/3', 'unknown'
  requests       INTEGER NOT NULL DEFAULT 0,
  fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, http_version)
);
CREATE INDEX idx_http_version_zone_hour ON analytics_zone_http_version_hourly (zone_id, hour_bucket);

CREATE TABLE analytics_zone_ssl_version_hourly (
  zone_id        TEXT NOT NULL,
  hour_bucket    TEXT NOT NULL,
  ssl_version    TEXT NOT NULL,             -- 'TLSv1.2', 'TLSv1.3', 'unknown', 'none'
  requests       INTEGER NOT NULL DEFAULT 0,
  fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, ssl_version)
);
CREATE INDEX idx_ssl_version_zone_hour ON analytics_zone_ssl_version_hourly (zone_id, hour_bucket);

CREATE TABLE analytics_zone_firewall_hourly (
  zone_id        TEXT NOT NULL,
  hour_bucket    TEXT NOT NULL,
  rule_id        TEXT NOT NULL,             -- e.g. 'iuam', or UUID for managed rules
  source         TEXT NOT NULL,             -- 'securitylevel', 'firewallManaged', 'wafCustom', ...
  action         TEXT NOT NULL,             -- 'block', 'managed_challenge', 'log', ...
  events         INTEGER NOT NULL DEFAULT 0,
  fetched_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, rule_id, source, action)
);
CREATE INDEX idx_firewall_zone_hour ON analytics_zone_firewall_hourly (zone_id, hour_bucket);
```

**Note:** firewall events come from `firewallEventsAdaptive` (raw event log). The backfill aggregates them client-side into the `firewall_hourly` shape above before insert — never store raw events in D1. This keeps row counts bounded.

### 4.2 GraphQL Query Expansion

In `src/server/services/analytics-backfill.service.ts`, expand the existing `ZONE_BATCH_QUERY` to include the four new map sums plus add a second query for firewall events.

```graphql
# ZONE_BATCH_QUERY — additive only
httpRequests1hGroups(...) {
  dimensions { datetime }
  sum {
    requests, bytes, cachedBytes, threats        # existing
    countryMap         { clientCountryName, requests }    # NEW
    responseStatusMap  { edgeResponseStatus, requests }   # NEW
    clientHTTPVersionMap { clientHTTPProtocol, requests } # NEW
    clientSSLMap       { clientSSLProtocol, requests }    # NEW
  }
  avg { sampleInterval }
}

# NEW second query — fetched per zone (1-day window cap)
firewallEventsAdaptive(
  limit: 5000,
  filter: { datetime_geq: $since, datetime_leq: $until }
) {
  datetime, ruleId, source, action
}
```

The existing `splitGraphQLWindows` chunker (3-day cap) handles the http query. Add a parallel `splitFirewallWindows` (1-day cap) for the firewall query. Run both per cron tick.

### 4.3 Backfill Service Changes

`runAnalyticsBackfill` extended to:
1. Fetch httpRequests1hGroups (current behavior + new map fields).
2. For each zone (in chunks of 10), fetch firewallEventsAdaptive in 1d windows.
3. Client-side aggregate firewall events into `(zoneId, hourBucket, ruleId, source, action) → count` rows.
4. Upsert all 4 new tables in addition to the existing `analytics_zone_hourly`.
5. Same lock + log strategy.
6. Pull retention policy: keep 30 days of dimension data (matches existing `analytics_zone_hourly`).

### 4.4 Service Layer (`analytics.service.ts`)

New methods, all reusing the existing `rangeToWindow` (range parser) and `getZoneIds*` (account/group/cluster scope expansion) helpers in `analytics.service.ts` from PR #17:

- `getDimensionAggregate(scope, dim, range)` — returns array of `{ key, requests }` sorted desc, where `scope = {kind: 'account' | 'group' | 'cluster' | 'zone', id?}` and `dim = 'country' | 'status' | 'firewall'`.
- For dim='protocol', returns the discriminated shape `{ kind: 'protocol', httpVersions: [{key, requests}], sslVersions: [{key, requests}] }` — internally queries `analytics_zone_http_version_hourly` and `analytics_zone_ssl_version_hourly` separately and merges into one response.
- For dim='firewall', returns the discriminated shape `{ kind: 'firewall', rules: [{ ruleId, source, action, events }] }` top 50.
- For dim='country' and dim='status', returns `{ kind: 'country' | 'status', items: [{ key, requests }] }`.

If PR #17 named these helpers differently than `rangeToWindow` / `getZoneIds*`, Wave 1.6 inspects the existing service file first and uses the actual exported names — no helper renames as part of Phase E.

### 4.5 New Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/analytics/account/dimensions?range=&dim=` | aggregated dimension for whole account |
| GET | `/api/analytics/group/:id/dimensions?range=&dim=` | scoped to group's zones |
| GET | `/api/analytics/cluster/:name/dimensions?range=&dim=` | scoped to cluster's zones |
| GET | `/api/analytics/zone/:id/dimensions?range=&dim=` | single zone |

`dim` validator enum: `country | status | protocol | firewall`. Reuse `analyticsQuerySchema`. Range stays `24h | 7d | 30d`.

### 4.6 Frontend Chart Components (new in `src/client/components/analytics/`)

1. **GeoChoropleth.tsx** — uses `react-svg-worldmap` (`<WorldMap>`). Pass `data={[{country: 'US', value: 1234}, ...]}` (ISO 3166-1 alpha-2 codes lowercased per the lib's API). Color-scale via the lib's built-in `color` prop (a single accent color, lib quantile-fills based on `value`). Wrapper `<div style={{ height: 320 }}>`. Tooltip is provided by the library out of the box; format the value via the `valueSuffix` prop (e.g. " requests"). Click handler not in v1.
2. **StatusCodeDonut.tsx** — Recharts `<PieChart>` with `<Pie innerRadius="55%" outerRadius="80%">`. Group statuses into bands: 2xx green (`#34d399`), 3xx blue (`#60a5fa`), 4xx amber (`#fbbf24`), 5xx red (`#f87171`), other grey. Tooltip shows exact code + count. Center text shows total.
3. **WAFRuleBreakdown.tsx** — reuse `<TopNBarChart>` shape with `data: [{id: ruleId, label: friendlyName(ruleId), value: events}]`. Bars colored by action (block=red, challenge=amber, log=grey). Friendly-name lookup for known managed rules (`iuam` → "I'm Under Attack", `xss` → "XSS Filter", etc.); fall back to first 8 chars for UUIDs.
4. **ConnectionProfileDonuts.tsx** — two `<PieChart>` instances side-by-side via grid: one for HTTP version, one for TLS version. Same donut style as StatusCodeDonut. Self-contained — no shared color across the two donuts.
5. **DimensionTabs.tsx** — pure presentational tab strip: `<DimensionTabs active={dim} onChange={…} />` with 4 buttons (Geography / Status / Connection / Firewall). Reuses Tailwind tab styles already used by RequestsChart's metric tabs.

All 5 components follow PR #17 conventions (no animations, dark theme, JetBrains Mono tooltips, ResponsiveContainer with `initialDimension={{width:1,height:1}}`).

### 4.7 Frontend Hooks (new in `src/client/hooks/`)

- `useDimensions(scope, dim, range)` — `{ data, loading, error, refresh }`
- Cache key: `[scope.kind, scope.id, dim, range]`. Auto-refetches when any change.

### 4.8 Page Wiring + State Lifting

The active dimension tab MUST persist when the user drills Account → Group/Cluster → Zone (and back), so the `dim` state is **lifted into `AnalyticsView`** alongside the existing `range` and `subView` state at `src/client/components/analytics/AnalyticsView.tsx:21-25`. New state:

```tsx
const [activeDim, setActiveDim] = useState<Dim>("country");
```

`activeDim` and `setActiveDim` are passed to each of `AccountOverview`, `GroupDrilldown`, `ClusterDrilldown`, `ZoneDrilldown` as props (`dim`, `onDimChange`). None of the drilldown components own the dimension state.

Each drilldown component renders the bottom section identically:

```tsx
<section>
  <h2>Dimensions</h2>
  <DimensionTabs active={dim} onChange={onDimChange} />
  {dim === 'country' && <GeoChoropleth data={dims.data} />}
  {dim === 'status' && <StatusCodeDonut data={dims.data} />}
  {dim === 'protocol' && <ConnectionProfileDonuts data={dims.data} />}
  {dim === 'firewall' && <WAFRuleBreakdown data={dims.data} />}
</section>
```

Initial value: `country`. URL deep-link not in scope.

## 5. Dependency Decisions

- **`react-svg-worldmap`** v2.0.2 added. **Why this over `react-simple-maps`:** the project is on React 19 (`package.json: "react": "^19.2.5"`), but `react-simple-maps@3.0.0` declares `peerDependencies.react: ^16.8.0 || 17.x || 18.x` — install would require `--legacy-peer-deps` or fail in CI. `react-svg-worldmap@2.0.2` declares `react: ">=16.8"` (open-ended, accepts React 19 cleanly). Bundles `d3-geo`, `topojson-client`, and a built-in tooltip; ships its own world TopoJSON internally — no separate static asset needed. Bundle add ~60 KB gz.
- No additional static assets.
- No new backend deps.

**Verified at plan time:**
```
curl -s "https://registry.npmjs.org/react-svg-worldmap/latest" | jq '{version, peerDependencies, dependencies}'
# version: 2.0.2, peer: react/react-dom >=16.8, deps: d3-geo, topojson-client, react-path-tooltip, tslib
```

## 6. Wave Plan

### Wave 1 — Backend foundation (sequential, 1 deep agent)

| Task | Files | Verify |
|---|---|---|
| 1.1 Drizzle schema additions | `src/server/db/schema.ts` | typecheck |
| 1.2 SQL migration `0004_analytics_dimensions.sql` | `migrations/` | `wrangler d1 migrations apply --local` runs clean |
| 1.3 Expand `ZONE_BATCH_QUERY` + add `FIREWALL_EVENTS_QUERY` | `analytics-backfill.service.ts` | typecheck |
| 1.4 Add `splitFirewallWindows` (1d cap) helper | `analytics-backfill.service.ts` | unit test in `tests/unit/firewall-windows.test.ts` |
| 1.5 Update `runAnalyticsBackfill` to ingest 5 new tables (country, status, http_version, ssl_version, firewall) | `analytics-backfill.service.ts` | typecheck + manual `POST /api/analytics/refresh` returns success and `country`, `status`, `http_version`, `ssl_version` tables each have > 0 rows after one run. `firewall` table may be empty if no events occurred in the lookback window — that's expected on quiet zones (Free-tier accounts often see 0 firewall events for hours at a time). |
| 1.6 Add service methods `getDimensionAggregate` | `src/server/services/analytics.service.ts` | typecheck |
| 1.7 Add validator enum for `dim` query | `src/shared/validators.ts` | typecheck |
| 1.8 Add 4 new endpoint handlers | `src/server/routes/analytics.ts` | curl returns 200 + correct shape |
| 1.9 Apply migration locally + trigger refresh + curl-verify each endpoint returns success | (runtime) | All 4 dimension endpoints return `{success: true}`. `country`, `status`, `protocol` results must be non-empty (sum reconciles with existing endpoints within 1%). `firewall` result may be empty `{rules:[]}` on quiet windows — verify shape, not non-emptiness. |

Wave 1 commits atomically per step. Cannot start Wave 2 until 1.9 succeeds.

### Wave 2 — Frontend chart components (5 parallel visual-engineering agents)

| Component | Files | Verify |
|---|---|---|
| 2.1 GeoChoropleth | `src/client/components/analytics/GeoChoropleth.tsx` + `package.json` (add `react-svg-worldmap@^2.0.2` — chosen over `react-simple-maps` for React 19 peer-dep compatibility, see §5) | typecheck, 1 vitest snapshot under `tests/unit/` |
| 2.2 StatusCodeDonut | `src/client/components/analytics/StatusCodeDonut.tsx` | typecheck, vitest |
| 2.3 WAFRuleBreakdown | `src/client/components/analytics/WAFRuleBreakdown.tsx` (+ `src/client/lib/wafRuleNames.ts` for friendly names) | typecheck, vitest |
| 2.4 ConnectionProfileDonuts | `src/client/components/analytics/ConnectionProfileDonuts.tsx` | typecheck, vitest |
| 2.5 DimensionTabs | `src/client/components/analytics/DimensionTabs.tsx` | typecheck, vitest |

Each agent:
- Loads `frontend-ui-ux` skill
- Mirrors PR #17 component conventions exactly (read 2-3 existing components first)
- Writes minimal vitest snapshot with mocked data
- Does NOT commit — orchestrator commits all 5 in one wave

Wave leader (orchestrator) commits at end of wave with one commit per component.

### Wave 3 — Hooks + Page wiring (sequential, 1 deep agent)

Wave 3 also lifts `activeDim`/`setActiveDim` into `AnalyticsView` (per §4.8) so the dim choice persists across drilldowns.

| Task | Files | Verify (concrete) |
|---|---|---|
| 3.1 New hook `useDimensions` + `api.analytics.dimensions(scope, dim, range)` client method + co-located test at `tests/unit/useDimensions.test.ts` (vitest include glob is `tests/**/*.test.ts` per `vitest.config.ts:14`) | `src/client/hooks/useDimensions.ts`, `src/client/lib/api.ts`, `tests/unit/useDimensions.test.ts` | `npm run typecheck` exit 0; `npm test` exit 0 with the new test passing alongside the existing 13 files |
| 3.2 Lift `activeDim` state into `AnalyticsView`; pass to all 4 child views | `src/client/components/analytics/AnalyticsView.tsx` | typecheck; manual: in dev, drill Account→Group→Zone and back without `activeDim` resetting |
| 3.3 Wire into AccountOverview (add Dimensions section, accept `dim` + `onDimChange` props) | `src/client/components/analytics/AccountOverview.tsx` | Playwright: navigate `http://localhost:5173/` → click `Analytics` → assert section heading "Dimensions" present, default tab "Geography" active, choropleth renders within 2s; click `Status` tab → donut renders with at least one band; click `Connection` → 2 donuts render; click `Firewall` → either bar chart renders OR the empty-state text "No firewall events in this window." renders (this account is a Free-tier zone with intermittent firewall activity, so 0 events is acceptable for any given 24h window — see §4.2 / §4.6 for matching backend tolerance). Console: 0 errors, 0 Recharts warnings. |
| 3.4 Wire into GroupDrilldown | `src/client/components/analytics/GroupDrilldown.tsx` | **Setup (must run BEFORE the Playwright session opens; `useGroups` only fetches on mount or explicit refresh per `src/client/hooks/useGroups.ts:27-42` and the group is passed down from `src/client/App.tsx:218-221`):** (a) create a test group: `GID=$(curl -s -X POST http://localhost:5173/api/groups -H "Content-Type: application/json" -d '{"name":"photography","color":"#86efac"}' \| jq -r '.result.id')` ; (b) capture 2 zones: `ZONES_JSON=$(curl -s http://localhost:5173/api/zones \| jq -c '[.result[0:2][] \| {zoneId: .id, zoneName: .name}]')` ; (c) add them per `src/shared/validators.ts:88-97`: `curl -s -X POST "http://localhost:5173/api/groups/$GID/zones" -H "Content-Type: application/json" -d "{\"zones\":$ZONES_JSON}" \| jq '.success'` → must return `true`. **If the Playwright session is already open from §3.3**, hard-reload the page (`browser_navigate http://localhost:5173/`) so `useGroups` re-fetches and the new group appears in the sidebar/cards. **Verify:** click the `photography` group card → assert "Dimensions" section visible, `activeDim` from §3.3 is preserved (if browser was reloaded, default `country` is fine — drop the preservation assertion in that path), country count is sum of group's zones (verify via `curl -s "http://localhost:5173/api/analytics/group/$GID/dimensions?dim=country&range=24h" \| jq '[.result.items[].requests] \| add'` matches chart). 0 console errors. |
| 3.5 Wire into ClusterDrilldown | `src/client/components/analytics/ClusterDrilldown.tsx` | Playwright: back to Account Overview → click `chrisgeorge` cluster card → assert "Dimensions" section visible, dim preserved, all 4 tabs render with cluster-scoped data. Verify reconciliation: `curl /api/analytics/cluster/chrisgeorge/dimensions?dim=country` sum equals on-page chart sum. 0 console errors. |
| 3.6 Wire into ZoneDrilldown | `src/client/components/analytics/ZoneDrilldown.tsx` | Playwright: from Cluster Drilldown click `chrisgeorge.biz` row in zones table → assert "Dimensions" section visible, dim preserved, all 4 tabs render with single-zone data. Verify reconciliation: `curl /api/analytics/zone/<zoneId>/dimensions?dim=status` matches on-page donut bands. 0 console errors. |

Sequential because §3.2 must land first (state lifting); the 4 page wirings depend on the new prop API.

### Wave 4 — Verification & PR (orchestrator, sequential)

| Task | Concrete command / steps | Expected result |
|---|---|---|
| 4.1 Apply migration | `npm run db:migrate:local` then `wrangler d1 execute cloudymccloudface --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'analytics_%' ORDER BY name"` (note: D1 binding uses `cloudymccloudface` per `wrangler.jsonc:16` — Boaty McBoatface joke) | All 5 new tables present in result: `analytics_zone_country_hourly`, `analytics_zone_status_hourly`, `analytics_zone_http_version_hourly`, `analytics_zone_ssl_version_hourly`, `analytics_zone_firewall_hourly` (alongside existing `analytics_zone_hourly`, `analytics_sync_log`, `analytics_locks`) |
| 4.2 Trigger backfill | `npm run dev` (start server in background); `curl -s -X POST http://localhost:5173/api/analytics/refresh \| jq` | `{"success": true, "result": {"rowsUpserted": >0, ...}}` ; non-zero rows in each new table via `wrangler d1 execute cloudymccloudface --local --command "SELECT 'country' AS t, COUNT(*) AS n FROM analytics_zone_country_hourly UNION SELECT 'status', COUNT(*) FROM analytics_zone_status_hourly UNION SELECT 'http', COUNT(*) FROM analytics_zone_http_version_hourly UNION SELECT 'ssl', COUNT(*) FROM analytics_zone_ssl_version_hourly UNION SELECT 'firewall', COUNT(*) FROM analytics_zone_firewall_hourly"` — every row's `n` should be > 0 except `firewall` which may be 0 if no events occurred in the last 24h (acceptable) |
| 4.3 Endpoint reconciliation (country) | `curl -s "http://localhost:5173/api/analytics/account/dimensions?dim=country&range=24h" \| jq '[.result.items[].requests] \| add'` and `curl -s "http://localhost:5173/api/analytics/account?range=24h" \| jq '.result.totals.requests'` | The two values must agree within 1% (allows for sampling drift) |
| 4.4 Endpoint reconciliation (status) | Same pattern, `dim=status` | Sum of all status-code requests within 1% of `totals.requests` |
| 4.5 Endpoint reconciliation (protocol) | `curl -s ".../dimensions?dim=protocol&range=24h" \| jq '[.result.httpVersions[].requests] \| add'` and same for `sslVersions` | Both sums within 1% of `totals.requests` |
| 4.6 Endpoint smoke (firewall) | `curl -s ".../dimensions?dim=firewall&range=24h" \| jq '{count: (.result.rules \| length), top: .result.rules[0]}'` | Endpoint returns `success=true`. If `count > 0`: top entry must have non-empty `ruleId` and `events > 0`. If `count == 0`: that's acceptable (Free-tier zones can have quiet 24h windows with no firewall events) — verified by checking that `.success == true` and the response shape is well-formed. Re-test with `range=7d` if needed to find a window with events for screenshot purposes. |
| 4.7 Playwright full sweep | Run §3.3–3.6 manual steps end-to-end in a single session | All assertions in §3.3–3.6 hold; 0 Recharts warnings on every page (no CHAOS-1294 regression) |
| 4.8 Build size check | `npm run build` | Exit 0; client + worker gz total < 350 KB; alert if vendor chunk grew >200 KB gz vs PR #17 baseline (201 KB → must be < 401 KB) |
| 4.9 Test gate | `npm run typecheck` and `npm test` | typecheck exit 0; all vitest files green (existing 13 + ~3 new = 16 files expected) |
| 4.10 Open PR | `gh pr create --title "..." --body "..."` | PR opens against `main`, body links CHAOS-1293, attaches Playwright screenshots from 4.7 |
| 4.11 File follow-up | Create `CHAOS-1295: Top requested paths (requires Pro+ plan)` via Linear MCP/CLI, attach §2 probe transcript | Issue created in Cloudy McCloudflare project, milestone "Backlog" |
| 4.12 Close milestone | After PR merges, comment on CHAOS-1293 with PR link; verify Linear milestone "Visualization Update" shows 100% progress | Milestone progress = 100% |

## 7. QA Scenarios (per ticket / per chart)

### E-Country
- ✅ Country with 0 requests doesn't appear in the chart at all (filtered server-side).
- ✅ 'XX' or empty country code is grouped under "Unknown" in tooltip.
- ✅ Tooltip on a country with 1 request says "1 request" (not "1 requests"). Tooltip on >1 says "N requests".
- ✅ Choropleth ramp goes light → accent for [min, max] of returned data; if all countries have same count, fill is mid-tone.
- ✅ Account view: countries summed across all 32 zones.
- ✅ Group view: countries summed across the group's 4 (or 6) zones.
- ✅ Cluster view: countries summed across the cluster's TLDs.
- ✅ Zone view: countries for that single zone.
- ✅ All 4 ranges (24h / 7d / 30d) return data. 7d/30d use `binByDay`-style aggregation in the service layer (sum across hour buckets within the window).
- ✅ Empty state: "No country data in this window." when service returns []`.

### E-Status
- ✅ Donut renders bands in fixed clockwise order: 2xx, 3xx, 4xx, 5xx, other.
- ✅ Center label shows total request count + "across N status codes".
- ✅ Hover on a band shows the breakdown of individual status codes within it (e.g. "200: 12K, 304: 800").
- ✅ Edge case: zone with 100% 200 responses renders as a single full-circle band (no holes).
- ✅ All 4 scope levels work; sums reconcile with primary `analytics_zone_hourly.requests`.

### E-Protocol
- ✅ Two donuts side-by-side at >=768px viewport; stacked vertically below 768px.
- ✅ HTTP donut shows up to 5 versions (1.0, 1.1, 2, 3, unknown).
- ✅ TLS donut shows up to 4 (TLSv1.2, TLSv1.3, unknown, none).
- ✅ Center label per donut = "Most: {version}".
- ✅ All 4 scope levels.
- ✅ Sum across HTTP versions equals sum across TLS versions equals total requests (within sampling tolerance).

### E-Firewall
- ✅ Top 10 rules sorted by event count desc.
- ✅ Each bar labeled with friendly name when known, raw ruleId otherwise.
- ✅ Bar color: red for `block`, amber for `managed_challenge`/`challenge`, grey for `log`/`allow`.
- ✅ Empty state when zone has no firewall events: "No firewall events in this window."
- ✅ Account view aggregates events across all zones; rules with same `ruleId` from different zones combine.
- ✅ All 4 scope levels.

### Smoke (whole feature)
- ✅ Landing on Account Overview → DimensionTabs strip visible, default tab "Geography", chart renders within 1.5s of data fetch.
- ✅ Switching tabs is instant (< 100ms perceived). Hooks share one cache.
- ✅ Refresh button triggers `useDimensions.refresh()` along with existing analytics queries.
- ✅ Range change triggers all dimensions to refetch.
- ✅ Drill from Account → Group → Zone preserves the active dimension tab choice.
- ✅ 0 Recharts warnings (no regression on CHAOS-1294).
- ✅ Bundle size: client gz < 350 KB after addition.

## 8. Rollout Safety

### Migration safety
- Migration `0004_analytics_dimensions.sql` is **additive only** — no ALTER TABLE on existing tables. Safe to apply during a deploy without downtime; old code ignores new tables; new code falls back to empty data if tables exist but are empty.
- D1 migrations run via `npm run db:migrate` in CI/deploy step (already wired). Locally via `npm run db:migrate:local`.

### Backfill safety
- Existing `analyticsLocks` table prevents concurrent backfills.
- New queries run inside the same lock. If the firewall query fails, the http query still upserts (Promise.allSettled at the boundary).
- New tables are written best-effort; partial writes don't break the existing analytics endpoints.
- Cron cadence stays 15min; new queries add ~1 GraphQL call per zone-chunk (worst case 4x the existing CF API budget — still within the 300/5min ceiling for a 30-zone account).

### Rollback
- If something breaks in prod after merge: revert PR, run `wrangler d1 execute cloudymccloudface --remote --command "DROP TABLE analytics_zone_country_hourly; DROP TABLE analytics_zone_status_hourly; DROP TABLE analytics_zone_http_version_hourly; DROP TABLE analytics_zone_ssl_version_hourly; DROP TABLE analytics_zone_firewall_hourly;"`. The original `analytics_zone_hourly` table is untouched. (DB name is `cloudymccloudface`, not `cloudymccloudflare` — see `wrangler.jsonc:16`.)

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `firewallEventsAdaptive` returns >5000 events for a busy zone-day | Med | Lose tail events | Cap at 5000/day per zone. Note in tooltip: "Showing top events". Aggregation is dominated by the head anyway. |
| Country list explodes (>200 unique per hour) | Low | D1 row growth | Cap top-50 per (zone, hour) bucket before insert. |
| `react-svg-worldmap` D3 transitive dep conflicts | Low | Build break | Probe verified the lib's open-ended React peer dep (>=16.8) resolves cleanly with React 19 (this repo). D3-geo is bundled, no conflict with existing deps (no D3 in repo today). |
| Vite bundle exceeds 500 KB warning | Med | Lighthouse drops | Dynamic-import GeoChoropleth: `const GeoChoropleth = lazy(() => import('./GeoChoropleth'))`. |
| Free plan changes / dimension behavior changes | Low | Silent breakage | Probe queries documented in §2 — re-run if anomalies appear. |
| Firewall events from `firewallEventsAdaptive` use UTC `datetime` per event; bucketing by hour requires careful timezone handling | Med | Off-by-one in counts | Use `datetime.slice(0,13)+":00:00Z"` to compute hour bucket; matches existing convention in `analytics_zone_hourly`. |

## 10. Files Changed Summary (estimate)

- **Backend**: schema (+5 tables), backfill service (+~180 LOC), analytics service (+~150 LOC), routes (+~60 LOC), validators (+~10 LOC), 1 new migration file
- **Frontend**: 5 new components, 1 new hook, api.ts (+~50 LOC), 4 page integrations (~30 LOC each)
- **Tests**: ~3 new vitest files, ~5 component snapshot tests
- **Assets**: 1 world-110m.json (~110 KB raw)
- **Deps**: +`react-simple-maps`

Estimated 25-30 commits across the 3 waves.

## 11. Acceptance Checklist

- [ ] `npm run typecheck` exit 0
- [ ] All vitest files green (existing 13 + ~3 new)
- [ ] `npm run build` exit 0; total gz < 350 KB
- [ ] Migration `0004_analytics_dimensions.sql` applies clean to local + remote D1; `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'analytics_%' ORDER BY name` lists all 5 new tables (alongside the 3 existing ones)
- [ ] One full backfill cycle completes; `country`, `status`, `http_version`, `ssl_version` tables have > 0 rows; `firewall` table may be 0 if the window had no events
- [ ] All 4 dimension tabs render either data OR documented empty-state on Account / Group / Cluster / Zone (4 × 4 = 16 page-tab combinations) per §3.3–3.6 Playwright assertions. Firewall tab may show empty-state on quiet windows — that's acceptable per §4.6.
- [ ] Active dimension tab is preserved across drilldown navigation (Account → Group → Zone, and back) — verified manually in §3.4–3.6
- [ ] 0 Recharts warnings (no CHAOS-1294 regression) on every page
- [ ] Country / Status / Protocol sums reconcile with existing `analytics_zone_hourly.requests` totals within 1% (per §4.3–4.5)
- [ ] CHAOS-1295 follow-up filed for "Top requested paths (requires Pro+ plan)" with §2 probe transcript attached
- [ ] PR opened against `main`, linked to CHAOS-1293, smoke screenshots attached
