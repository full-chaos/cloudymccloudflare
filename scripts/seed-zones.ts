/**
 * Seed the local D1 `zone_cache` table with zones from the configured
 * Cloudflare account. Used for fresh-clone quickstart so the dashboard has
 * data before the first `/api/zones/sync` runs.
 *
 * Strategy:
 *   1. Try the Cloudflare REST API (`GET /zones?account.id=…`) using the
 *      token in `.dev.vars`. This gives real zone metadata (status, plan,
 *      name_servers, etc.) and is persisted verbatim in `raw_json`.
 *   2. Fall back to the hardcoded `ZONES` constant in `src/shared/constants`
 *      when the token is missing, the network is unavailable, or the API
 *      errors. Fallback rows contain only id+name; other columns use the
 *      schema's defaults so the app still renders the sidebar correctly.
 *
 * Conflict behavior: INSERT OR REPLACE with `synced_at = datetime('now')`,
 * so re-running the seed is idempotent and resets every row to a known state.
 *
 * Runs via `npm run db:seed` → `npx tsx scripts/seed-zones.ts`.
 * Writes land in the local D1 SQLite file that Miniflare + wrangler share
 * (`.wrangler/state/v3/d1/…`) via `wrangler d1 execute --local`.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, ZONES } from "../src/shared/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeedZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  planName: string;
  planPrice: number;
  nameServers: string[];
  accountId: string;
  rawJson: string | null;
}

interface CFZonesResponse {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: Array<{
    id: string;
    name: string;
    status: string;
    paused: boolean;
    plan?: { name?: string; price?: number };
    name_servers?: string[];
    account?: { id?: string };
  }>;
  result_info?: { page: number; total_pages: number };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // `--remote` targets production D1 on Cloudflare's edge; default is `--local`
  // (the `.wrangler/state` SQLite that Miniflare/vite dev reads from).
  // Because this project is never deployed, the typical use case is actually
  // remote — but defaulting to remote would be surprising / destructive, so
  // we keep local as the default and require the explicit flag.
  const remote = process.argv.includes("--remote");
  const target = remote ? "remote (production D1)" : "local D1";

  const zones = await loadZones();
  console.log(`Seeding ${zones.length} zone${zones.length === 1 ? "" : "s"} into ${target}…`);

  const sql = zones.map(toUpsertSql).join("\n");
  const dir = mkdtempSync(path.join(tmpdir(), "seed-zones-"));
  const sqlFile = path.join(dir, "seed.sql");
  writeFileSync(sqlFile, sql);

  // Shell out to wrangler. Using execFileSync (not execSync) to bypass the
  // shell entirely — arguments are handed to the child process verbatim, so
  // there's no risk of shell interpretation even if the temp path contained
  // odd characters.
  execFileSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "cloudlymccloudflare-db",
      remote ? "--remote" : "--local",
      `--file=${sqlFile}`,
    ],
    { stdio: "inherit" },
  );
  console.log(`✓ Seeded ${zones.length} zones into zone_cache (${target})`);
}

// ─── Data sources ─────────────────────────────────────────────────────────────

async function loadZones(): Promise<SeedZone[]> {
  const vars = parseDevVars(".dev.vars");
  const token = vars.CF_API_TOKEN;
  if (!token || token === "your_cf_api_token_here") {
    console.log("No CF_API_TOKEN in .dev.vars — using static ZONES fallback.");
    return fromStatic();
  }

  try {
    console.log("Fetching zones from Cloudflare API…");
    return await fromCloudflare(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`CF fetch failed (${msg}); falling back to static ZONES.`);
    return fromStatic();
  }
}

function fromStatic(): SeedZone[] {
  return ZONES.map((z) => ({
    id: z.id,
    name: z.name,
    status: "active",
    paused: false,
    planName: "",
    planPrice: 0,
    nameServers: [],
    accountId: ACCOUNT_ID,
    rawJson: null,
  }));
}

async function fromCloudflare(token: string): Promise<SeedZone[]> {
  const base = "https://api.cloudflare.com/client/v4/zones";
  const perPage = 50;
  const out: SeedZone[] = [];
  let page = 1;

  while (true) {
    const url = `${base}?account.id=${ACCOUNT_ID}&page=${page}&per_page=${perPage}&status=active`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = (await res.json()) as CFZonesResponse;
    if (!payload.success || !payload.result) {
      const msg = payload.errors?.map((e) => `[${e.code}] ${e.message}`).join("; ") ?? res.statusText;
      throw new Error(`CF API error: ${msg}`);
    }

    for (const z of payload.result) {
      out.push({
        id: z.id,
        name: z.name,
        status: z.status ?? "active",
        paused: Boolean(z.paused),
        planName: z.plan?.name ?? "",
        planPrice: z.plan?.price ?? 0,
        nameServers: z.name_servers ?? [],
        accountId: z.account?.id ?? ACCOUNT_ID,
        rawJson: JSON.stringify(z),
      });
    }

    const info = payload.result_info;
    if (!info || page >= info.total_pages) break;
    page++;
  }

  return out;
}

// ─── .dev.vars parser ─────────────────────────────────────────────────────────
// Minimal KEY=value reader — matches the `.env`-style format wrangler uses.

function parseDevVars(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const raw of readFileSync(filePath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
}

// ─── SQL generation ───────────────────────────────────────────────────────────

function toUpsertSql(z: SeedZone): string {
  const cols = "id, name, status, paused, plan_name, plan_price, name_servers, account_id, raw_json, synced_at";
  const values = [
    sqlStr(z.id),
    sqlStr(z.name),
    sqlStr(z.status),
    z.paused ? 1 : 0,
    sqlStr(z.planName),
    z.planPrice,
    sqlStr(JSON.stringify(z.nameServers)),
    sqlStr(z.accountId),
    z.rawJson === null ? "NULL" : sqlStr(z.rawJson),
    "datetime('now')",
  ].join(", ");
  return `INSERT OR REPLACE INTO zone_cache (${cols}) VALUES (${values});`;
}

// Single-quote-doubled SQL string literal. This is a local-dev seed sourced
// from our own account's data, so injection isn't a realistic concern, but
// escaping apostrophes is still necessary for values like JSON with "don't".
function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
