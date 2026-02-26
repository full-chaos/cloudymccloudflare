/**
 * Lightweight D1Database mock for tests.
 * Implements only the minimal method surface using vi.fn() stubs and does not
 * provide real SQL or storage semantics.
 */
import { vi } from "vitest";

/**
 * Creates a minimal D1Database-shaped mock that can be used with Hono route
 * tests and other unit tests that only assert calls and basic return values.
 * This mock always returns canned results and does not execute SQL.
 */
export function createMockD1(): D1Database {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [], success: true }),
    run: vi.fn().mockResolvedValue({ success: true }),
    raw: vi.fn().mockResolvedValue([]),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0 }),
  } as unknown as D1Database;
}
