# Analytics Visualizations Plan

Add charts/graphs to the **Account Overview**, **Group Drilldown**, and **Cluster Drilldown** analytics pages, mirroring the proven pattern on **Zone (Domain) Drilldown** while adding aggregate-specific visualizations that only make sense above the single-domain level.

---

## 1. Context & Current State

### 1.1 Page hierarchy

```
AnalyticsView (router via subView state)
├── AccountOverview   ── KPI cards + group/cluster summary cards          ← NO CHARTS
├── GroupDrilldown    ── KPI cards + SortableZoneTable                    ← NO CHARTS
├── ClusterDrilldown  ── KPI cards + SortableZoneTable                    ← NO CHARTS
└── ZoneDrilldown     ── KPI cards + RequestsChart (4-metric tabbed area) ← REFERENCE
```

### 1.2 Domain (Zone) Drilldown chart inventory

The reference page uses **Recharts v3.8.1**. One reusable chart, four metrics, dark-theme styled.

| # | Component | Type | Metrics | Notes |
|---|---|---|---|---|
| 1 | `RequestsChart` (`src/client/components/analytics/RequestsChart.tsx`) | `AreaChart` smoothed (`type="monotone"`), gradient fill (0.35 → 0 opacity), no animation | Tabbed swap between **Requests** (`#f97316`), **Bandwidth** (`#60a5fa`), **Cached** (`#34d399`), **Threats** (`#f87171`) | Hourly buckets, X = time, Y = linear, custom dark tooltip in JetBrains Mono, `connectNulls={false}` so missing-bucket gaps render as gaps |
| 2 | `MetricCard` × 5 | KPI tile | Requests, Bandwidth, Cached, Cache hit ratio, Threats | Same accent colors as the area chart, threats card goes red when `> 0` |
| 3 | `TimeRangePicker` | Control | Window selector: 24h / 7d / 30d | Also surfaces `sampleInterval` warning + `lastFetchedAt` |

The chart accepts a generic `ZoneTimeSeriesPoint[]` — it is **already reusable** at any aggregation level. The only thing missing is aggregate `series[]` data from the backend.

### 1.3 Backend reality check

| Endpoint | Returns | Has time-series? |
|---|---|---|
| `GET /api/analytics/account` → `AccountAnalytics` | totals + `perZone[]` | **NO** |
| `GET /api/analytics/group/:id` → `GroupAnalytics` | totals + `perZone[]` | **NO** |
| `GET /api/analytics/zone/:id` → `ZoneAnalytics` | totals + `series[]` | **YES** |

Underlying D1 table `analytics_zone_hourly` already stores per-zone hourly buckets. Aggregating across N zones is a single `SELECT … GROUP BY hourBucket` away. **No new Cloudflare API calls or schema migrations are needed for Phase 1–4 of this plan.**

What is **not** available without new backend work (Phase 5):

- Top countries / paths / status codes
- Per-WAF-rule firewall event breakdown
- Sub-hour resolution (real-time)

---

## 2. Implementation Strategy (Phased)

| Phase | Scope | Backend? | Frontend? | Unblocks |
|---|---|---|---|---|
| **A. Series aggregation** | Add `series[]` to `AccountAnalytics` and `GroupAnalytics` | YES | Types only | All trend charts at aggregate levels |
| **B. Mirror RequestsChart** | Drop `RequestsChart` into Overview, Group, Cluster | NO | YES | Visual parity with drilldown |
| **C. Aggregate-specific charts** | Top-N bar, stacked area, treemap, sparklines | NO (uses existing `perZone`) | YES | Insights that only make sense above zone level |
| **D. Polish & info density** | Sparklines on summary cards + table rows, hit-ratio rings, threat heatmap | NO | YES | "Quick view understanding" the user explicitly asked for |
| **E. New dimensions (future)** | Countries, status codes, paths via `httpRequests1hGroups` extra fields | YES (new GraphQL query, new D1 columns) | YES | Geo maps, status code donuts, top-paths bars |

Phases A–D are an estimated **3–5 days** of focused work. Phase E is a separate ticket.

---

## 3. Per-Page Recommendations

### 3.1 Account Overview

Strategic question this page answers: **"Where is my traffic concentrated, what's healthy, what's spiking, what's under attack?"**

Recommended chart layout (top to bottom):

| Chart | Type | Metric | Why | Source |
|---|---|---|---|---|
| **Account-wide trend** | `AreaChart` (reuse `RequestsChart`) with metric tabs | Requests / Bandwidth / Cached / Threats | The single most important "what's the rhythm of my whole portfolio" view. Mirrors the drilldown so users have one mental model. | Phase A `series[]` on `AccountAnalytics` |
| **Top 10 zones by requests** | `BarChart` horizontal | Requests per zone | Pareto answer to "where's the volume?". Bar > pie when N > 5. Click-through to ZoneDrilldown. | Existing `perZone[]` |
| **Zone concentration treemap** | `Treemap` | Requests per zone, sized by share, **colored by primary group** | "Where is my traffic concentrated?" — each rectangle is one zone (mutually exclusive, areas sum to 100%). Color encodes group affiliation. Hover = zone + group + totals, click = ZoneDrilldown. See §6.1 for why we don't size by group. | Existing `perZone[]` + groups |
| **Group totals (overlap-honest)** | `BarChart` horizontal | Requests summed per group | A zone can belong to multiple groups (see `AccountOverview.tsx:337-383`), so group totals **may overlap and exceed account total**. Acceptable for a bar chart (each bar is independent) but breaks any share/pie/treemap. Label clearly: "Per-group totals — may double-count zones in multiple groups." | Existing `perZone[]` + groups (already aggregated as `groupRollups`) |
| **Cache hit ratio scatter** | `ScatterChart` (X = bandwidth, Y = hit ratio %) | Per-zone | One dot per zone. Bottom-right = "lots of bandwidth, bad cache" → action items. Top-right = "doing it right". | Existing `perZone[]` |
| **Threat radar** | `BarChart` horizontal, red, only zones with threats > 0 | Threats per zone | Quickly identify which domains are under fire. Hide entirely when no threats. Click → ZoneDrilldown. | Existing `perZone[]` |
| **Sparklines on group/cluster summary cards** (Phase D) | Inline `Area` mini-chart, no axes | Requests last 24h | Adds a "shape" hint to every summary tile so users see direction without clicking. Big info density win. | Phase A series + per-group rollup |

**Layout suggestion:**

```
[ KPI cards row (existing, keep) ]
[ Account trend chart with metric tabs (full width) ]
[ Top zones bar (½) | Zone concentration treemap (½) ]
[ Cache hit ratio scatter (½) | Threat radar (½, conditional) ]
[ Group totals bar with overlap-warning footnote (full width) ]
[ By group (existing, add sparklines) ]
[ By cluster (existing, add sparklines) ]
```

### 3.2 Group Drilldown

Strategic question: **"How is this group doing as a whole, and which zones in it are driving the numbers?"**

| Chart | Type | Metric | Why | Source |
|---|---|---|---|---|
| **Group trend** | `AreaChart` (reuse `RequestsChart`) with metric tabs | Same 4 metrics | Aggregate equivalent to drilldown. | Phase A `series[]` on `GroupAnalytics` |
| **Per-zone composition** | `StackedAreaChart` | Requests per zone over time | Shows BOTH the group total AND each zone's contribution in one view. Reveals "is one zone carrying this group?". | Phase A: extend `GroupAnalytics` with `perZoneSeries[]` (zoneId × series) — or compute client-side from per-zone backend calls (more requests, less cache benefit) |
| **Top zones in group** | `BarChart` horizontal | Requests per zone | Same as Overview's top-zones, scoped to this group. Already half-implemented as `SortableZoneTable` — keep the table, **add the bar visualization above it**. | Existing `perZone[]` |
| **Zone comparison sparklines** (Phase D) | One sparkline per row in `SortableZoneTable` | Requests | "Quick view understanding" — see each zone's trend without leaving the table. | Phase A per-zone series |

**Layout suggestion:**

```
[ KPI cards row (existing) ]
[ Group trend chart with metric tabs (full width) ]
[ Per-zone stacked area (full width) ]
[ Top zones bar (½) | spare for cache scatter or future chart (½) ]
[ Sortable zone table (existing) — with sparkline column ]
```

### 3.3 Cluster Drilldown

Same shape as Group, since clusters are zone-groupings (TLD-based instead of user-defined). Two cluster-specific recommendations on top:

| Chart | Type | Metric | Why |
|---|---|---|---|
| **Cluster trend** | `AreaChart` (reuse) | Same 4 metrics | Mirror group/zone. |
| **Per-TLD stacked area** | `StackedAreaChart` | Requests per zone (where each zone is a TLD variant of the same base name) | Shows whether `.com` dominates or whether traffic is spread across TLDs. Genuinely interesting because TLDs are often used for routing/AB/region. |
| **Per-TLD comparison line chart** | `LineChart` multi-line, no fill | Requests per zone | Alternative when zones are ~equal size and stacking obscures individual trends. **Suggest a toggle:** "Stacked / Compared". |
| **Top TLDs in cluster** | `BarChart` horizontal | Requests per TLD | Same pattern as Group. |
| **Sparklines in table** | per-row `Area` mini | Requests | Same. |

**Note:** `ClusterDrilldown` currently *reuses* `AccountAnalytics` data and filters client-side. To get a cluster-scoped `series[]`, either:
- (a) extend the backend with `GET /api/analytics/cluster/:name` (cleanest), or
- (b) keep client-side filtering and aggregate `perZoneSeries[]` from the account payload (avoids new endpoint but couples cluster logic to client).

**Recommendation: (a)** for symmetry with group, and to keep the client thin.

---

## 4. New Reusable Components To Build

| Component | Wraps | Used by |
|---|---|---|
| `TopNBarChart` | Recharts `BarChart` horizontal | Account, Group, Cluster — top zones rankings |
| `StackedAreaChart` | Recharts `AreaChart` with `stackId` | Group, Cluster — per-zone composition |
| `MetricSparkline` | Recharts `AreaChart` minimal (no axes, no tooltip, ~40px tall) | All summary cards + table rows |
| `TrafficTreemap` | Recharts `Treemap` | Account — group share view |
| `CacheHitScatter` | Recharts `ScatterChart` | Account — bandwidth vs hit-ratio |
| `MetricChartCard` | `<section>` + header + chart slot + empty/loading states | Wraps every chart for visual consistency |

All components must:
- Honor the existing dark theme tokens (`#1f1f2e` grid, `#888` axis, `#111118` tooltip bg, JetBrains Mono tooltip font)
- Use the established metric color palette: `#f97316` requests, `#60a5fa` bandwidth, `#34d399` cached, `#f87171` threats, `#a78bfa` cache hit ratio
- Render an empty state matching `<div className="h-64 flex items-center justify-center text-text-muted text-xs">No data in this window.</div>`
- Never animate (`isAnimationActive={false}`) — matches existing convention
- Be wrapped in `ResponsiveContainer` so they reflow on sidebar collapse

---

## 5. Backend Changes (Phase A) — Specifics

### 5.1 New service function

In `src/server/services/analytics.service.ts`, add:

```ts
async function fillAggregatedHourlySeries(
  db: D1Database,
  zoneIds: string[],
  range: AnalyticsRange,
): Promise<ZoneTimeSeriesPoint[]>
```

SQL skeleton:

```sql
SELECT
  hour_bucket AS timestamp,
  SUM(requests) AS requests,
  SUM(bytes) AS bytes,
  SUM(cached_bytes) AS cachedBytes,
  SUM(threats) AS threats
FROM analytics_zone_hourly
WHERE zone_id IN (?, ?, …)
  AND hour_bucket >= ?
GROUP BY hour_bucket
ORDER BY hour_bucket ASC;
```

Then run the same `fillHourlySeries` gap-padding logic the zone version uses so missing buckets become `0` inside the window and `null` outside.

### 5.2 Type changes (`src/shared/types.ts`)

```ts
export interface AccountAnalytics {
  // …existing fields
  series: ZoneTimeSeriesPoint[];                    // NEW: account-wide aggregate
  perZoneSeries?: Record<string, ZoneTimeSeriesPoint[]>; // OPTIONAL — see decision below
}

export interface GroupAnalytics {
  // …existing fields
  series: ZoneTimeSeriesPoint[];                    // NEW: group-wide aggregate
  perZoneSeries?: Record<string, ZoneTimeSeriesPoint[]>;
}

export interface ClusterAnalytics extends Omit<GroupAnalytics, 'groupId' | 'groupName'> {
  clusterName: string;
}
```

### 5.3 Open decision: `perZoneSeries`

The stacked-area and per-zone-sparkline charts need per-zone time series. Options:

1. **Bundle into one response** (`perZoneSeries` map). Adds payload weight (24h × N zones). For 30 zones × 720 buckets at 30d, that's ~21k points — still trivial.
2. **Lazy-load** via separate `GET /api/analytics/zone/:id?range=…` calls when stacked view is opened. More requests, more L1 cache hits.

**Recommendation: option 1**, gated behind `?include=perZoneSeries` query param. Pages that need it ask for it; KPI-only views stay light.

### 5.4 New endpoint (cluster)

```
GET /api/analytics/cluster/:clusterName?range=…&include=perZoneSeries
```

Resolves cluster → zone IDs server-side via `toClusters(zones)` (already exists in `src/client/lib/clusters.ts` — port it to a shared helper or re-derive on server using zone cache).

---

## 6. Decisions

### 6.1 Decided: Zone-level treemap, not group-level treemap

The current data model (see `src/client/components/analytics/AccountOverview.tsx:337-383`) **explicitly allows a zone to belong to multiple groups**, and the `groupRollups` aggregator counts the zone's metrics in *each* group it belongs to. That makes any "share of total" visualization at the **group** level mathematically broken: pie slices and treemap rectangles would not sum to 100%, and the user has no way to tell which segments are double-counted.

**Decision:** for the Account Overview concentration chart, the treemap operates at the **zone** level (every zone is a leaf, mutually exclusive, areas sum to account total). Group affiliation is encoded as fill color, not as parent rectangle.

This decision cascades:
- **Cluster treemap (if we add one later):** safe — clusters ARE mutually exclusive (`toClusters()` partitions zones by base name).
- **Group sparklines on summary cards:** safe — each card is independent, no share semantics.
- **Per-group stacked area on Group Drilldown:** safe — only zones in *this* group are shown, so the only overlap is between groups, not within.

For "I want to see group rollups", the **Group totals bar chart** in the same layout serves that purpose, with an explicit footnote that totals may overlap. Bar charts handle overlap honestly (each bar stands alone); share-of-whole charts don't.

### 6.2 Decided: Treemap fill-color rules

When rendering the zone-level treemap, each zone's fill color is determined by:

1. **Zone is in ≥1 named group** → use the alphabetically-first group's `color` (deterministic, no schema change needed). Tooltip lists all groups the zone belongs to so users can see when one wins the tiebreaker.
2. **Zone is ungrouped** → use the color of its **cluster** (TLD base name). Cluster colors are auto-assigned from a fixed palette using a deterministic hash of `cluster.baseName % palette.length`, so the same cluster gets the same color across renders, refreshes, and time-range changes.

The cluster palette excludes the metric-color tokens (`#f97316`, `#60a5fa`, `#34d399`, `#f87171`, `#a78bfa`) to avoid visual collision with axis-bound charts. Suggested 8-color palette:

```ts
const CLUSTER_PALETTE = [
  "#7dd3fc", // sky-300
  "#fde68a", // amber-200
  "#c4b5fd", // violet-300
  "#fda4af", // rose-300
  "#86efac", // green-300 (lighter than cached green)
  "#fdba74", // orange-300 (lighter than requests orange)
  "#67e8f9", // cyan-300
  "#d8b4fe", // purple-300
];
```

This keeps named groups visually distinct (user-chosen colors) and cluster fallback colors low-saturation (signaling "system-assigned").

### 6.3 Decided: Cluster endpoint

New `GET /api/analytics/cluster/:name` (mirrors group shape). Client-side filtering of the account payload is rejected because it (a) duplicates `toClusters()` logic on the client, (b) blocks server-side cluster aggregation in CMC-A3, and (c) makes the cluster page slower than the group page despite identical mental model.

### 6.4 Decided: `perZoneSeries` bundling strategy

Bundle behind `?include=perZoneSeries` on account/group/cluster endpoints. Reasoning:

- 30 zones × 720 hourly buckets × 4 metrics × ~8 bytes ≈ 700 KB on the wire (uncompressed). With gzip, ~150 KB. Acceptable for a one-time chart load.
- Single round trip → no waterfall, no client-side merge.
- For 30d specifically, we can additionally bin to daily server-side if real-world payloads exceed ~1 MB. **Defer until measured** (covered in §8 perf gate).
- Lazy-load is more complex (per-zone N+1 fetches, separate cache entries) and only wins when most users never expand the per-zone view. We don't have that signal yet.

### 6.5 Decided: Keep `SortableZoneTable`

The new bar/treemap charts are for visual scan; the table stays for sortable detail (sort by bandwidth, threats, hit ratio, etc.). Adding a sparkline column (CMC-D2) closes the loop — the table itself becomes a mini-trend grid.

### 6.6 Decided: Granularity for 30d view

Client-side daily binning when `range === '30d'`. Server keeps returning hourly so we can change our mind without a backend change. Implementation lives in CMC-D3 (`src/client/lib/timeseries.ts:binByDay`).

### 6.7 Open: Treemap library escape hatch

Recharts has a basic `Treemap`. If labels overflow or hierarchy looks crowded with 30+ zones, evaluate `react-vis-treemap` or `visx`. **Defer until we see Recharts output in CMC-C3.**

---

## 7. Out of Scope (Explicitly)

- New Cloudflare GraphQL datasets (firewall event detail, bot management, Workers Analytics) — **Phase E only**.
- Geographic visualizations (country choropleth) — needs Phase E backend.
- Real-time / sub-hour resolution.
- Comparison vs previous period (e.g., "last 7d vs prior 7d") — worth a follow-up ticket.
- Export-to-PNG / scheduled reports.
- Alerting / threshold lines on charts.

---

## 8. Global Acceptance & Verification

The whole effort is done when **every ticket below passes its QA scenario** and the global gates below pass:

| Gate | Command | Expected |
|---|---|---|
| Type-check | `npm run typecheck` | Exit 0, no errors |
| Lint/diagnostics | `lsp_diagnostics` on all changed files | Zero errors, zero warnings caused by this work |
| Tests | `npm run test` | Pass (or note pre-existing failures unrelated to analytics) |
| Build | `npm run build` | Exit 0 |
| Performance smoke | `curl -s "$DEV_URL/api/analytics/account?range=30d&include=perZoneSeries" -o /dev/null -w "%{time_total}\n"` against an account with ≥10 zones | < 0.5 s |

> **Note on response shape.** Every route in this codebase wraps its payload as `{ success: true, result: <…> }` (see `src/server/routes/analytics.ts:25,38,48,56,65`). All `jq` commands below access `.result.*` accordingly.

Per-ticket acceptance criteria with concrete verification steps live in §9.

---

## 9. Tickets — Each With Runnable QA Scenario

Each ticket below is independently shippable and has: **goal**, **files**, **verification command/steps**, and **expected result**.

### Phase A — Backend series aggregation

#### CMC-A1 · Aggregated `series[]` on `AccountAnalytics`
- **Goal**: Add hourly aggregated time-series across all account zones to the existing account endpoint.
- **Files**: `src/server/services/analytics.service.ts`, `src/shared/types.ts`, `src/server/routes/analytics.ts`.
- **Verify**:
  ```bash
  curl -s "$DEV_URL/api/analytics/account?range=24h" \
    | jq '(.result.series | length), (.result.series[0]), (.result.series | map(.requests // 0) | add), (.result.totals.requests)'
  ```
- **Expected**: `length` is 24 (or fewer if data window is short); first point has `timestamp` (ISO hour), `requests`, `bytes`, `cachedBytes`, `threats` keys (numeric or null); summed `series.requests` matches `totals.requests` within rounding.

#### CMC-A2 · Aggregated `series[]` on `GroupAnalytics`
- **Goal**: Same as A1 for a single group.
- **Files**: same as A1.
- **Verify**:
  ```bash
  GROUP_ID=$(curl -s "$DEV_URL/api/groups" | jq -r '.result[0].id')
  curl -s "$DEV_URL/api/analytics/group/$GROUP_ID?range=7d" \
    | jq '(.result.series | length), (.result.series | map(.requests // 0) | add), (.result.totals.requests)'
  ```
- **Expected**: `length` is 168 (24×7) or fewer if shorter window; summed `series.requests` equals `totals.requests` within rounding.

#### CMC-A3 · New `GET /api/analytics/cluster/:name`
- **Goal**: Cluster-scoped analytics endpoint, parallel shape to group.
- **Files**: `src/server/routes/analytics.ts`, `src/server/services/analytics.service.ts`, `src/shared/types.ts` (new `ClusterAnalytics`), `src/client/lib/api.ts` (new `api.analytics.cluster()`), shared `toClusters` helper port to server.
- **Verify**:
  ```bash
  CLUSTER=$(curl -s "$DEV_URL/api/zones" | jq -r '.result[0].name | split(".")[0]')
  curl -s "$DEV_URL/api/analytics/cluster/$CLUSTER?range=24h" \
    | jq '(.result | keys), (.result.clusterName), (.result.totals.requests), (.result.series | length)'
  ```
- **Expected**: response includes `clusterName`, `totals`, `series`, `perZone`, `lastFetchedAt`, `sampleInterval` keys; `clusterName` equals `$CLUSTER`; `series` length ≤ 24.

#### CMC-A4 · Optional `?include=perZoneSeries`
- **Goal**: Per-zone time-series bundled in account/group/cluster responses when explicitly requested.
- **Files**: `src/server/routes/analytics.ts` (parse query), `src/server/services/analytics.service.ts` (extra rollup branch), `src/shared/types.ts` (`perZoneSeries?: Record<string, ZoneTimeSeriesPoint[]>`), `src/shared/validators.ts` (Zod for query).
- **Verify**:
  ```bash
  curl -s "$DEV_URL/api/analytics/account?range=24h" \
    | jq '.result | has("perZoneSeries")'
  curl -s "$DEV_URL/api/analytics/account?range=24h&include=perZoneSeries" \
    | jq '(.result.perZoneSeries | keys | length), (.result.perZone | length)'
  ```
- **Expected**: first call → `false`. Second call → two equal numbers (`perZoneSeries` keys count equals `perZone` length).

### Phase B — Mirror RequestsChart

#### CMC-B1 · Mount `RequestsChart` on `AccountOverview`
- **Goal**: Render the existing `RequestsChart` with metric tabs on Account Overview, fed by `data.series` from CMC-A1.
- **Files**: `src/client/components/analytics/AccountOverview.tsx`, `src/client/hooks/useAccountAnalytics.ts` (only if return shape needs adjustment).
- **Verify**: `npm run dev`, navigate to Analytics → Overview. Open DevTools network tab. Confirm `/api/analytics/account` request returns a `series` array. Click each metric tab (Requests/Bandwidth/Cached/Threats).
- **Expected**: Chart renders below KPI cards. Tabs swap the metric. Chart shape matches the data (hover any point, value matches one bucket in the response). When `series` is empty, chart shows the same "No data in this window." empty state used on ZoneDrilldown.

#### CMC-B2 · Mount `RequestsChart` on `GroupDrilldown`
- **Files**: `src/client/components/analytics/GroupDrilldown.tsx`.
- **Verify**: Navigate to Analytics → click any group. Confirm chart appears between KPI cards and `SortableZoneTable`.
- **Expected**: Same as B1 but scoped to that group's zones; sum of bucket values matches the group's `totals`.

#### CMC-B3 · Mount `RequestsChart` on `ClusterDrilldown`
- **Files**: `src/client/components/analytics/ClusterDrilldown.tsx`, `src/client/hooks/useClusterAnalytics.ts` (new, parallels group hook).
- **Verify**: Navigate to Analytics → click any cluster card.
- **Expected**: Same as B2 for cluster.

### Phase C — Aggregate-specific charts

#### CMC-C1 · `TopNBarChart` on Overview/Group/Cluster
- **Goal**: Horizontal bar chart of top 10 zones by requests, with click → ZoneDrilldown.
- **Files**: new `src/client/components/analytics/TopNBarChart.tsx`, mount in all three pages.
- **Verify**: Open DevTools, sort `data.perZone` by `requests` desc, take top 10. Compare visually to bar chart order. Click any bar.
- **Expected**: Bar order matches sorted `perZone` desc-by-requests. Click navigates to that zone's drilldown.

#### CMC-C2 · `StackedAreaChart` on Group/Cluster
- **Goal**: Per-zone stacked area, requires `perZoneSeries` from CMC-A4.
- **Files**: new `src/client/components/analytics/StackedAreaChart.tsx`, mount in `GroupDrilldown` and `ClusterDrilldown`. Hooks must call with `?include=perZoneSeries`.
- **Verify**: On a group with ≥3 zones, hover any time point.
- **Expected**: Tooltip lists each zone with its requests at that hour; the sum across zones equals the aggregated `series` value at that hour (within rounding).

#### CMC-C3 · `TrafficTreemap` on Overview
- **Goal**: Zone-level treemap (NOT group-level — see §6.1), each leaf a zone, color-by-primary-group, click → ZoneDrilldown.
- **Files**: new `src/client/components/analytics/TrafficTreemap.tsx`, mount in `AccountOverview`.
- **Verify**: Compare summed area of all leaves to `totals.requests`. Hover any rectangle.
- **Expected**: Total area conceptually equals 100% (areas proportional to `requests`, no double-counting). Tooltip shows zone name, group name(s), and request count. Click navigates to ZoneDrilldown for that zone.

#### CMC-C4 · `CacheHitScatter` on Overview
- **Goal**: Per-zone scatter with X = bytes, Y = cache hit ratio %.
- **Files**: new `src/client/components/analytics/CacheHitScatter.tsx`, mount in `AccountOverview`.
- **Verify**: Pick the zone in the bottom-right quadrant (high bytes, low hit ratio). Hover.
- **Expected**: Tooltip identifies the zone. Click → ZoneDrilldown. Y axis is 0–100 (percent).

#### CMC-C5 · Threat radar (variant of `TopNBarChart`)
- **Goal**: Conditional bar chart shown only when any zone has `threats > 0`, ranking zones by threat count.
- **Files**: reuse `TopNBarChart` with red color override and a `data.totals.threats === 0` short-circuit in `AccountOverview`.
- **Verify** (writes against the local D1 — schema reference: `analytics_zone_hourly` in `src/server/db/schema.ts:131-148`):
  ```bash
  # 1. Negative case: page reflects current state
  curl -s "$DEV_URL/api/analytics/account?range=24h" | jq '.result.totals.threats'
  # If 0, navigate to Analytics → Overview and confirm threat-radar section is NOT rendered.

  # 2. Seed threats on an arbitrary zone for the most recent hour bucket
  ZONE_ID=$(curl -s "$DEV_URL/api/zones" | jq -r '.result[0].id')
  HOUR_BUCKET=$(date -u -v-1H +"%Y-%m-%dT%H:00:00.000Z" 2>/dev/null \
                || date -u -d '1 hour ago' +"%Y-%m-%dT%H:00:00.000Z")
  npx wrangler d1 execute DB --local --command \
    "INSERT INTO analytics_zone_hourly (zone_id, hour_bucket, requests, bytes, cached_bytes, threats, sample_interval, fetched_at)
     VALUES ('$ZONE_ID', '$HOUR_BUCKET', 100, 0, 0, 42, 1, datetime('now'))
     ON CONFLICT(zone_id, hour_bucket) DO UPDATE SET threats = 42;"

  # 3. Positive case: refresh the page
  curl -s "$DEV_URL/api/analytics/account?range=24h" | jq '.result.totals.threats'
  ```
- **Expected**:
  - Step 1 (threats = 0): threat-radar chart **not rendered** in the DOM.
  - Step 3 (threats ≥ 42): page now renders the threat-radar chart with at least one bar (the seeded zone, length 42, color red `#f87171`); other zones with 0 threats do not appear; clicking the bar navigates to that zone's drilldown.
- **Cleanup**: `npx wrangler d1 execute DB --local --command "UPDATE analytics_zone_hourly SET threats = 0 WHERE zone_id = '$ZONE_ID' AND hour_bucket = '$HOUR_BUCKET';"`

### Phase D — Polish & info density

#### CMC-D1 · `MetricSparkline` on summary cards
- **Goal**: Tiny inline area chart (no axes/tooltip) on every `GroupSummaryCard` and `ClusterSummaryCard`.
- **Files**: new `src/client/components/analytics/MetricSparkline.tsx`, edit the two card components in `AccountOverview.tsx`. Requires `perZoneSeries` so each card can compute its own aggregate.
- **Verify**: Hover any group card's sparkline shape; should roughly match the trend of that group's zones in the main chart.
- **Expected**: Sparkline visible on every card, ~40px tall, no tooltip, color matches account-level palette.

#### CMC-D2 · Sparkline column on `SortableZoneTable`
- **Files**: `src/client/components/analytics/SortableZoneTable.tsx`. Needs `perZoneSeries`.
- **Verify**: Render the table, confirm one sparkline per row, sort the table — sparklines re-order with rows.
- **Expected**: Each sparkline reflects only that zone's data.

#### CMC-D3 · Client-side daily-bin helper for `30d`
- **Goal**: When `range === '30d'`, bin hourly series to daily on the client to keep the chart readable.
- **Files**: new `src/client/lib/timeseries.ts` with `binByDay(series)` and use sites in `RequestsChart`/`StackedAreaChart`.
- **Verify**: Switch the time range picker to `30d` on Account Overview. Inspect chart X axis.
- **Expected**: ~30 ticks (one per day), not 720. Daily totals equal sum of that day's hourly buckets.

---

### Suggested execution order

A1 → A2 → A3 → A4 (backend, sequential, share schema decisions)
B1 ‖ B2 ‖ B3 (parallelizable once A* lands)
C1 → C2/C3/C4/C5 (parallel after A4)
D1 → D2 (parallel) → D3 (last, optional)
