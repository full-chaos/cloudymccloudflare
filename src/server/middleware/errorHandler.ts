import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Bindings } from "../types/env";
import { CloudflareApiError } from "../services/cloudflare";

/**
 * Narrow an arbitrary numeric status from an upstream/unknown source
 * (e.g. a Cloudflare API response) to a Hono-friendly ContentfulStatusCode.
 * Anything outside the HTTP error range is treated as a bad-gateway / server error.
 */
function toErrorStatus(
  status: number,
  fallback: ContentfulStatusCode = 500,
): ContentfulStatusCode {
  return (status >= 400 && status < 600 ? status : fallback) as ContentfulStatusCode;
}

export const errorHandler: ErrorHandler<{ Bindings: Bindings }> = (err, c) => {
  console.error("[ErrorHandler]", err.message, err.stack);

  if (err instanceof CloudflareApiError) {
    return c.json(
      {
        success: false,
        errors: [
          {
            code: err.code,
            message: `Cloudflare API error: ${err.message}`,
          },
        ],
      },
      toErrorStatus(err.statusCode, 502),
    );
  }

  // Route handlers and src/server/utils/zvalidator.ts both surface failures
  // as HTTPException, so this single branch covers every validated request.
  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        errors: [{ code: err.status, message: err.message }],
      },
      err.status,
    );
  }

  return c.json(
    {
      success: false,
      errors: [{ code: 500, message: err.message || "An unexpected error occurred" }],
    },
    500,
  );
};
