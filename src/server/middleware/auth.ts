import type { MiddlewareHandler } from "hono";
import type { AppEnv, Bindings } from "../types/env";
import type { JWTPayload } from "jose";
import { verifyCfAccessJwt } from "./cf-access";

const PLACEHOLDER_SECRET = "your_app_secret_here";

function isDevAuthBypassEnabled(env: Bindings): boolean {
  return env.ENVIRONMENT !== "production" && env.ENABLE_DEV_AUTH_BYPASS === "true";
}

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

export function isLocalAuthBypassActive(env: Bindings, hostname: string): boolean {
  return isDevAuthBypassEnabled(env) && isLocalDevHost(hostname);
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let i = 0; i < maxLength; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }

  return diff === 0;
}

// Access service-token JWTs carry an empty `sub` and a `common_name` instead.
function accessIdentity(payload: JWTPayload): string {
  const candidates = [payload.email, payload.sub, payload.common_name];
  const found = candidates.find((v): v is string => typeof v === "string" && v.length > 0);
  return (found ?? "access-unknown").toLowerCase();
}

export const LOCAL_DEV_IDENTITY = "local-dev";
export const SERVICE_TOKEN_IDENTITY = "service-token";

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestUrl = new URL(c.req.url);
  const path = requestUrl.pathname;
  if (path === "/api/health") {
    return next();
  }

  // Local dev browser traffic never injects Authorization headers. This bypass
  // is explicit and non-production-only; hostname alone is not trusted.
  if (isLocalAuthBypassActive(c.env, requestUrl.hostname)) {
    c.set("identity", LOCAL_DEV_IDENTITY);
    return next();
  }

  const { TEAM_DOMAIN, POLICY_AUD, APP_SECRET, ENVIRONMENT } = c.env;
  const isProduction = ENVIRONMENT === "production";
  const cfAccessConfigured = Boolean(TEAM_DOMAIN) && Boolean(POLICY_AUD);
  const secretConfigured = Boolean(APP_SECRET) && APP_SECRET !== PLACEHOLDER_SECRET;

  // Explicit local/dev bypass: outside production AND no auth mechanism configured.
  if (!isProduction && !cfAccessConfigured && !secretConfigured && isDevAuthBypassEnabled(c.env)) {
    c.set("identity", LOCAL_DEV_IDENTITY);
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
        c.set("identity", accessIdentity(payload));
        return next();
      }
    }
  }

  // Fallback: APP_SECRET bearer token — for CLI / scripts that bypass Access
  // via a service token or hit the Worker directly.
  if (secretConfigured) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ") && timingSafeEqual(authHeader.slice(7), APP_SECRET)) {
      c.set("identity", SERVICE_TOKEN_IDENTITY);
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
