import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// ─── Remote-binding auth shim ─────────────────────────────────────────────────
// The cloudflare vite-plugin starts a "remote proxy session" when any binding
// in wrangler.jsonc has `"remote": true`. That session authenticates via
// CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID env vars (NOT the Worker's
// CF_API_TOKEN binding, and NOT the OAuth creds from `wrangler login`).
//
// Rather than require users to `wrangler login` AND maintain shell env setup,
// we reuse the same CF_API_TOKEN already in `.dev.vars` — it has D1 write
// scope so it satisfies what the remote proxy needs. CLOUDFLARE_ACCOUNT_ID is
// extracted from the wrangler.jsonc `vars.CF_ACCOUNT_ID` so we only define it
// in one place.
//
// No-op when `.dev.vars` is absent or the env vars are already set by the
// caller (CI, explicit shell override), so this stays safe in all contexts.
seedRemoteProxyAuthFromDevVars();

function seedRemoteProxyAuthFromDevVars() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    const devVarsPath = path.resolve(__dirname, ".dev.vars");
    if (existsSync(devVarsPath)) {
      const vars: Record<string, string> = {};
      for (const line of readFileSync(devVarsPath, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
      // Prefer an explicit CLOUDFLARE_API_TOKEN so users can keep the
      // wrangler/remote-binding token (needs Workers Scripts: Edit + D1: Edit)
      // separate from the app's CF_API_TOKEN (DNS / Zones / Analytics scopes).
      // Fall back to CF_API_TOKEN when only one token is configured.
      const token = vars.CLOUDFLARE_API_TOKEN || vars.CF_API_TOKEN;
      if (token) process.env.CLOUDFLARE_API_TOKEN = token;
    }
  }
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
    const wranglerPath = path.resolve(__dirname, "wrangler.jsonc");
    if (existsSync(wranglerPath)) {
      const m = readFileSync(wranglerPath, "utf8").match(
        /"CF_ACCOUNT_ID"\s*:\s*"([^"]+)"/,
      );
      if (m) process.env.CLOUDFLARE_ACCOUNT_ID = m[1];
    }
  }
}

export default defineConfig({
  root: "src/client",
  plugins: [
    react(),
    cloudflare({
      configPath: path.resolve(__dirname, "wrangler.jsonc"),
      persistState: {
        path: path.resolve(__dirname, ".wrangler/state"),
      },
    }),
  ],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@server": path.resolve(__dirname, "src/server"),
      "@client": path.resolve(__dirname, "src/client"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    // @cloudflare/vite-plugin v1.32 emits one subdirectory per environment,
    // so outDir is `dist/` (not `dist/client/`). That gives us:
    //   dist/client/…              — SPA bundle (wrangler.jsonc points assets here)
    //   dist/cloudymccloudflare/…  — Worker bundle (named after wrangler.jsonc "name")
    // With the old `dist/client/` we got `dist/client/client/…` nested one
    // level too deep, and wrangler uploaded the worker bundle (including a
    // copy of .dev.vars) as static assets.
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
