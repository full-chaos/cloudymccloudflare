type ToolInput = Record<string, unknown>;

function str(input: ToolInput, key: string): string {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : "?";
}

// Compact one-line summary of a ZoneAgent tool call, e.g. "Looked up DNS for example.com".
export function describeToolCall(toolName: string, input: unknown): string {
  const args: ToolInput = input && typeof input === "object" ? (input as ToolInput) : {};
  switch (toolName) {
    case "list_zones":
      return "Listed zones";
    case "list_groups":
      return "Listed groups";
    case "get_dns_records":
      return `Looked up DNS for ${str(args, "zone")}`;
    case "get_waf_rules":
      return `Looked up WAF rules for ${str(args, "target")}`;
    case "get_deployment_log":
      return "Read the WAF deployment log";
    case "get_traffic_analytics": {
      const scope = str(args, "scope");
      const target = scope === "account" ? "the account" : str(args, "name");
      return `Read traffic analytics for ${target} (${args.range ?? "7d"})`;
    }
    case "get_top_error_zones":
      return `Ranked zones by ${str(args, "statusClass")} errors (${args.range ?? "7d"})`;
    case "create_dns_record":
      return `Create ${str(args, "type")} record ${str(args, "name")} → ${str(args, "content")} in ${str(args, "zone")}`;
    default:
      return `Called ${toolName}`;
  }
}
