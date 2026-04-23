import { validator } from "hono/validator";
import { HTTPException } from "hono/http-exception";
import type { ZodSchema } from "zod";

/**
 * Hono middleware that validates the JSON body against a Zod schema.
 * Throws a 400 HTTPException if validation fails.
 */
export function zValidator<T>(schema: ZodSchema<T>) {
  return validator("json", async (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      // Zod 4: `error.errors` → `error.issues`.
      const message = result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new HTTPException(400, { message: `Validation error: ${message}` });
    }
    return result.data;
  });
}

/**
 * Validates query/param data against a Zod schema.
 */
export function zValidatorParam<T>(schema: ZodSchema<T>) {
  return validator("param", (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new HTTPException(400, { message: `Invalid parameters: ${message}` });
    }
    return result.data;
  });
}

/**
 * Validates query-string data against a Zod schema.
 * Throws a 400 HTTPException if validation fails.
 */
export function zValidatorQuery<T>(schema: ZodSchema<T>) {
  return validator("query", (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const message = result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      throw new HTTPException(400, { message: `Invalid query parameters: ${message}` });
    }
    return result.data;
  });
}
