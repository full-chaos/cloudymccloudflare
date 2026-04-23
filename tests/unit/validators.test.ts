import { describe, it, expect } from "vitest";
import {
  createDNSRecordSchema,
  updateDNSRecordSchema,
  createGroupSchema,
  updateGroupSchema,
  addZonesToGroupSchema,
  removeZonesFromGroupSchema,
  customRuleSchema,
  deployRulesSchema,
  replaceWAFRulesSchema,
  updateZoneSettingSchema,
  createIPAccessRuleSchema,
  createTemplateSchema,
} from "@shared/validators";

describe("createDNSRecordSchema", () => {
  it("accepts a valid A record", () => {
    const result = createDNSRecordSchema.safeParse({
      type: "A",
      name: "example.com",
      content: "192.0.2.1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid MX record with priority", () => {
    const result = createDNSRecordSchema.safeParse({
      type: "MX",
      name: "example.com",
      content: "mail.example.com",
      priority: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing type", () => {
    const result = createDNSRecordSchema.safeParse({
      name: "example.com",
      content: "192.0.2.1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = createDNSRecordSchema.safeParse({
      type: "A",
      name: "",
      content: "192.0.2.1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid DNS type", () => {
    const result = createDNSRecordSchema.safeParse({
      type: "INVALID",
      name: "example.com",
      content: "192.0.2.1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative priority", () => {
    const result = createDNSRecordSchema.safeParse({
      type: "MX",
      name: "example.com",
      content: "mail.example.com",
      priority: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects priority > 65535", () => {
    const result = createDNSRecordSchema.safeParse({
      type: "MX",
      name: "example.com",
      content: "mail.example.com",
      priority: 70000,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateDNSRecordSchema", () => {
  it("accepts partial updates", () => {
    const result = updateDNSRecordSchema.safeParse({ content: "192.0.2.2" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateDNSRecordSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("createGroupSchema", () => {
  it("accepts valid group with name only", () => {
    const result = createGroupSchema.safeParse({ name: "Production" });
    expect(result.success).toBe(true);
  });

  it("accepts valid group with all fields", () => {
    const result = createGroupSchema.safeParse({
      name: "Production",
      color: "#ff6600",
      description: "Production domains",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createGroupSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = createGroupSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid hex color", () => {
    const result = createGroupSchema.safeParse({ name: "Test", color: "red" });
    expect(result.success).toBe(false);
  });

  it("rejects description over 500 chars", () => {
    const result = createGroupSchema.safeParse({
      name: "Test",
      description: "a".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateGroupSchema", () => {
  it("accepts partial updates", () => {
    const result = updateGroupSchema.safeParse({ color: "#00ff00" });
    expect(result.success).toBe(true);
  });
});

describe("addZonesToGroupSchema", () => {
  it("accepts valid zones array", () => {
    const result = addZonesToGroupSchema.safeParse({
      zones: [{ zoneId: "z1", zoneName: "example.com" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty zones array", () => {
    const result = addZonesToGroupSchema.safeParse({ zones: [] });
    expect(result.success).toBe(false);
  });
});

describe("removeZonesFromGroupSchema", () => {
  it("accepts valid zoneIds array", () => {
    const result = removeZonesFromGroupSchema.safeParse({ zoneIds: ["z1"] });
    expect(result.success).toBe(true);
  });

  it("rejects empty array", () => {
    const result = removeZonesFromGroupSchema.safeParse({ zoneIds: [] });
    expect(result.success).toBe(false);
  });
});

describe("customRuleSchema", () => {
  it("accepts valid rule", () => {
    const result = customRuleSchema.safeParse({
      expression: '(ip.src eq "1.2.3.4")',
      action: "block",
      description: "Block bad IP",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(true); // default
    }
  });

  it("rejects empty expression", () => {
    const result = customRuleSchema.safeParse({
      expression: "",
      action: "block",
      description: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid action", () => {
    const result = customRuleSchema.safeParse({
      expression: "(true)",
      action: "destroy",
      description: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid actions", () => {
    const actions = ["block", "managed_challenge", "js_challenge", "challenge", "skip", "log"];
    for (const action of actions) {
      const result = customRuleSchema.safeParse({
        expression: "(true)",
        action,
        description: "Test",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("deployRulesSchema", () => {
  it("accepts valid deploy payload", () => {
    const result = deployRulesSchema.safeParse({
      target: { type: "zones", ids: ["z1", "z2"] },
      rules: [
        { expression: "(true)", action: "block", description: "Test" },
      ],
      mode: "append",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty rules array", () => {
    const result = deployRulesSchema.safeParse({
      target: { type: "zones", ids: ["z1"] },
      rules: [],
      mode: "append",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid mode", () => {
    const result = deployRulesSchema.safeParse({
      target: { type: "zones", ids: ["z1"] },
      rules: [{ expression: "(true)", action: "block", description: "Test" }],
      mode: "merge",
    });
    expect(result.success).toBe(false);
  });
});

describe("replaceWAFRulesSchema", () => {
  it("accepts a rules array with multiple valid rules", () => {
    const result = replaceWAFRulesSchema.safeParse({
      rules: [
        { expression: "(true)", action: "block", description: "A" },
        { expression: "(false)", action: "log", description: "B", enabled: false },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rules[0].enabled).toBe(true);
      expect(result.data.rules[1].enabled).toBe(false);
    }
  });

  it("accepts an empty rules array (clears the ruleset)", () => {
    const result = replaceWAFRulesSchema.safeParse({ rules: [] });
    expect(result.success).toBe(true);
  });

  it("rejects missing rules field", () => {
    const result = replaceWAFRulesSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a non-array rules field", () => {
    const result = replaceWAFRulesSchema.safeParse({ rules: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects a rule with an invalid action", () => {
    const result = replaceWAFRulesSchema.safeParse({
      rules: [{ expression: "(true)", action: "destroy", description: "Test" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a rule with an empty expression", () => {
    const result = replaceWAFRulesSchema.safeParse({
      rules: [{ expression: "", action: "block", description: "Test" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("updateZoneSettingSchema", () => {
  it("accepts setting with string value", () => {
    const result = updateZoneSettingSchema.safeParse({ id: "ssl", value: "full" });
    expect(result.success).toBe(true);
  });

  it("accepts setting with boolean value", () => {
    const result = updateZoneSettingSchema.safeParse({ id: "always_use_https", value: true });
    expect(result.success).toBe(true);
  });

  it("rejects empty setting id", () => {
    const result = updateZoneSettingSchema.safeParse({ id: "", value: "on" });
    expect(result.success).toBe(false);
  });
});

describe("createIPAccessRuleSchema", () => {
  it("accepts valid IP block rule", () => {
    const result = createIPAccessRuleSchema.safeParse({
      mode: "block",
      configuration: { target: "ip", value: "1.2.3.4" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid mode", () => {
    const result = createIPAccessRuleSchema.safeParse({
      mode: "drop",
      configuration: { target: "ip", value: "1.2.3.4" },
    });
    expect(result.success).toBe(false);
  });
});

describe("createTemplateSchema", () => {
  it("accepts valid template", () => {
    const result = createTemplateSchema.safeParse({
      name: "Block Scanners",
      expression: '(http.request.uri.path contains "/.env")',
      action: "block",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing expression", () => {
    const result = createTemplateSchema.safeParse({
      name: "Test",
      action: "block",
    });
    expect(result.success).toBe(false);
  });
});
