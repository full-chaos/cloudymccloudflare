import type { MiddlewareHandler } from "hono";
import type { Bindings } from "../types/env";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(options: {
  name: string;
  limit: number;
  windowMs: number;
}): MiddlewareHandler<{ Bindings: Bindings }> {
  return async (c, next) => {
    const now = Date.now();
    const identity =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const key = `${options.name}:${identity}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    if (current.count >= options.limit) {
      return c.json(
        {
          success: false,
          errors: [{ code: 429, message: "Too many requests" }],
        },
        429,
      );
    }

    current.count += 1;
    await next();
  };
}
