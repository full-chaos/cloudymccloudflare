import { describe, it, expect } from "vitest";
import { DNS_RECORD_TYPES, RULE_TEMPLATES, GROUP_COLORS } from "@shared/constants";

describe("constants", () => {
  describe("DNS_RECORD_TYPES", () => {
    it("includes standard DNS types", () => {
      expect(DNS_RECORD_TYPES).toContain("A");
      expect(DNS_RECORD_TYPES).toContain("AAAA");
      expect(DNS_RECORD_TYPES).toContain("CNAME");
      expect(DNS_RECORD_TYPES).toContain("MX");
      expect(DNS_RECORD_TYPES).toContain("TXT");
    });
  });

  describe("RULE_TEMPLATES", () => {
    it("has at least 5 built-in templates", () => {
      expect(Object.keys(RULE_TEMPLATES).length).toBeGreaterThanOrEqual(5);
    });

    it("every template has required fields", () => {
      for (const tpl of Object.values(RULE_TEMPLATES)) {
        expect(tpl.name).toBeTruthy();
        expect(tpl.expression).toBeTruthy();
        expect(tpl.action).toBeTruthy();
        expect(tpl.description).toBeTruthy();
      }
    });

    it("all actions are valid CF actions", () => {
      const validActions = ["block", "managed_challenge", "js_challenge", "challenge", "skip", "log"];
      for (const tpl of Object.values(RULE_TEMPLATES)) {
        expect(validActions).toContain(tpl.action);
      }
    });
  });

  describe("GROUP_COLORS", () => {
    it("all colors are valid hex", () => {
      for (const color of GROUP_COLORS) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  });
});
