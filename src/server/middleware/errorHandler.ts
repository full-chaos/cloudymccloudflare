import type { ErrorHandler } from "hono";
import type { Bindings } from "../types/env";
import { CloudflareApiError } from "../services/cloudflare";

export const errorHandler: ErrorHandler<{ Bindings: Bindings }> = (err, c) => {
  console.error("[ErrorHandler]", err.message, err.stack);

  if (err instanceof CloudflareApiError) {
    const statusCode = err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode as 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503
      : 502;

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
      statusCode
    );
  }

  // Handle Zod validation errors (they get thrown as HTTPException from zValidator)
  if (err.name === "ZodError") {
    return c.json(
      {
        success: false,
        errors: [{ code: 400, message: `Validation error: ${err.message}` }],
      },
      400
    );
  }

  // Handle generic HTTP exceptions from Hono
  const status = "status" in err && typeof err.status === "number" ? err.status : 500;
  const httpStatus = (status >= 400 && status < 600 ? status : 500) as
    | 400
    | 401
    | 403
    | 404
    | 405
    | 409
    | 422
    | 429
    | 500
    | 502
    | 503;

  return c.json(
    {
      success: false,
      errors: [
        {
          code: httpStatus,
          message: err.message || "An unexpected error occurred",
        },
      ],
    },
    httpStatus
  );
};
