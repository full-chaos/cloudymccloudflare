import { describe, expect, it } from "vitest";
import { colorForAction } from "../../src/client/components/analytics/WAFRuleBreakdown";

describe("colorForAction", () => {
  it("returns red for block", () => {
    expect(colorForAction("block")).toBe("#f87171");
  });

  it("returns amber for challenge variants", () => {
    expect(colorForAction("managed_challenge")).toBe("#fbbf24");
    expect(colorForAction("challenge")).toBe("#fbbf24");
    expect(colorForAction("jschallenge")).toBe("#fbbf24");
    expect(colorForAction("captcha")).toBe("#fbbf24");
  });

  it("returns grey for log/allow", () => {
    expect(colorForAction("log")).toBe("#888888");
    expect(colorForAction("allow")).toBe("#888888");
  });

  it("returns purple fallback for unknown actions", () => {
    expect(colorForAction("connection_close")).toBe("#a78bfa");
    expect(colorForAction("")).toBe("#a78bfa");
    expect(colorForAction("future_action_2030")).toBe("#a78bfa");
  });
});
