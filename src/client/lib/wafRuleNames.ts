export const FRIENDLY_NAMES: Record<string, string> = {
  iuam: "I'm Under Attack Mode",
  xss: "XSS Filter",
  waf: "WAF",
  hot: "Hotlink Protection",
  bic: "Browser Integrity Check",
  uablock: "User-Agent Block",
  securitylevel: "Security Level",
  hotlink: "Hotlink Protection",
  ratelimit: "Rate Limit",
  scrapeshield: "Scrape Shield",
  zonelockdown: "Zone Lockdown",
  ip: "IP Access Rule",
};

export function friendlyRuleName(ruleId: string): string {
  if (FRIENDLY_NAMES[ruleId]) return FRIENDLY_NAMES[ruleId];
  // UUID-style managed rule IDs: show first 8 chars
  if (/^[0-9a-f]{32}$/.test(ruleId)) return ruleId.slice(0, 8) + "…";
  return ruleId;
}
