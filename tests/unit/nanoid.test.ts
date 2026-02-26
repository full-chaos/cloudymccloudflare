import { describe, it, expect } from "vitest";
import { nanoid } from "@server/utils/nanoid";

describe("nanoid", () => {
  it("generates a string of default length 21", () => {
    const id = nanoid();
    expect(id).toHaveLength(21);
  });

  it("generates a string of custom length", () => {
    const id = nanoid(10);
    expect(id).toHaveLength(10);
  });

  it("only contains alphanumeric characters", () => {
    const id = nanoid(100);
    expect(id).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => nanoid()));
    expect(ids.size).toBe(100);
  });
});
