import type { MiddlewareHandler } from "hono";
import type { Bindings } from "../types/env";
import { verifyCfAccessJwt } from "./cf-access";

const PLACEHOLDER_SECRET = "your_app_secret_here";

function isPrivateIpv4Host(hostname: string): boolean {
  if (hostname.startsWith("10.")) return true;
  if (hostname.startsWith("192.168.")) return true;
  const m = hostname.match(/^172\.(\d{1,3})\./);
  if (!m) return false;
  const octet = Number.parseInt(m[1], 10);
  return octet >= 16 && octet <= 31;
}

export function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local") ||
    isPrivateIpv4Host(hostname)
  );
}

export const authMiddleware: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  const requestUrl = new URL(c.req.url);
  const path = requestUrl.pathname;
  if (path === "/api/health") {
    return next();
  }

  // Local dev browser traffic never injects Authorization headers, so bypass
  // auth for loopback/private-network hosts even if ENVIRONMENT is mis-set.
  if (isLocalDevHost(requestUrl.hostname)) {
    return next();
  }

  const { TEAM_DOMAIN, POLICY_AUD, APP_SECRET, ENVIRONMENT } = c.env;
  const isProduction = ENVIRONMENT === "production";
  const cfAccessConfigured = Boolean(TEAM_DOMAIN) && Boolean(POLICY_AUD);
  const secretConfigured = Boolean(APP_SECRET) && APP_SECRET !== PLACEHOLDER_SECRET;

  // Local/dev bypass: outside production AND no auth mechanism configured.
  if (!isProduction && !cfAccessConfigured && !secretConfigured) {
    return next();
  }

  // Misconfiguration in production — neither mechanism set up. Fail closed.
  if (!cfAccessConfigured && !secretConfigured) {
    return c.json(
      {
        success: false,
        errors: [{ code: 401, message: "Authentication not configured" }],
      },
      401,
    );
  }

  // Primary: Cloudflare Access JWT. Requests through CF Access carry
  // `Cf-Access-Jwt-Assertion`; a valid signature for our team + AUD is proof
  // the user satisfied the Access policy at the edge.
  if (cfAccessConfigured) {
    const cfJwt = c.req.header("Cf-Access-Jwt-Assertion");
    if (cfJwt) {
      const payload = await verifyCfAccessJwt(cfJwt, TEAM_DOMAIN, POLICY_AUD);
      if (payload) {
        return next();
      }
    }
  }

  // Fallback: APP_SECRET bearer token — for CLI / scripts that bypass Access
  // via a service token or hit the Worker directly.
  if (secretConfigured) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === APP_SECRET) {
      return next();
    }
  }

  return c.json(
    {
      success: false,
      errors: [{ code: 401, message: "Unauthorized" }],
    },
    401,
  );
};
