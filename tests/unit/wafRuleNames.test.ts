import { describe, expect, it } from "vitest";
import { friendlyRuleName } from "../../src/client/lib/wafRuleNames";

describe("friendlyRuleName", () => {
  it("returns friendly name for known rule IDs", () => {
    expect(friendlyRuleName("iuam")).toBe("I'm Under Attack Mode");
    expect(friendlyRuleName("xss")).toBe("XSS Filter");
    expect(friendlyRuleName("waf")).toBe("WAF");
  });

  it("truncates 32-character UUIDs to 8 characters with ellipsis", () => {
    expect(friendlyRuleName("1234567890abcdef1234567890abcdef")).toBe("12345678…");
    expect(friendlyRuleName("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4")).toBe("a1b2c3d4…");
  });

  it("passes through unknown short IDs", () => {
    expect(friendlyRuleName("unknown_rule")).toBe("unknown_rule");
    expect(friendlyRuleName("custom-123")).toBe("custom-123");
    expect(friendlyRuleName("1234567")).toBe("1234567");
  });
});
