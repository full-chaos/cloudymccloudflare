/**
 * In-memory D1 mock using miniflare for integration tests.
 * Falls back to a simple mock for unit tests that don't need real SQL.
 */
import { vi } from "vitest";

/**
 * Creates a minimal D1Database mock that can be used with Hono route tests.
 * For full SQL support, use createD1FromSQL which sets up a real SQLite DB.
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
