import type { MiddlewareHandler } from "hono";
import type { Bindings } from "../types/env";

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
  // Skip auth for health check endpoint
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

  const secret = c.env.APP_SECRET;
  const isProduction = c.env.ENVIRONMENT === "production";
  const secretConfigured = Boolean(secret) && secret !== PLACEHOLDER_SECRET;

  // Local/dev bypass: only outside production AND when no real secret is set.
  // In production we always fall through to the bearer check below, so a
  // missing or placeholder APP_SECRET fails closed instead of granting access.
  if (!isProduction && !secretConfigured) {
    return next();
  }

  // Production without a configured secret = misconfiguration. Reject every
  // request rather than allow the placeholder value to act as a de facto key.
  if (!secretConfigured) {
    return c.json(
      {
        success: false,
        errors: [{ code: 401, message: "Authentication not configured" }],
      },
      401
    );
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        errors: [{ code: 401, message: "Missing or invalid Authorization header" }],
      },
      401
    );
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token || token !== secret) {
    return c.json(
      {
        success: false,
        errors: [{ code: 401, message: "Invalid token" }],
      },
      401
    );
  }

  return next();
};
