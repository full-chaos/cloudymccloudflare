import type { RuleTemplate } from "./types";

// ─── DNS ──────────────────────────────────────────────────────────────────────

export const DNS_RECORD_TYPES = [
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SRV",
  "CAA",
] as const;

export const RECORD_TYPE_COLORS: Record<string, string> = {
  A: "#3b82f6",      // blue
  AAAA: "#6366f1",   // indigo
  CNAME: "#8b5cf6",  // violet
  MX: "#f97316",     // orange
  TXT: "#10b981",    // emerald
  NS: "#06b6d4",     // cyan
  SRV: "#ec4899",    // pink
  CAA: "#eab308",    // yellow
};

// ─── Groups ───────────────────────────────────────────────────────────────────

export const GROUP_COLORS = [
  "#f97316", // orange
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#ef4444", // red
  "#ec4899", // pink
  "#eab308", // yellow
  "#6366f1", // indigo
] as const;

// ─── Rule Templates ───────────────────────────────────────────────────────────

export const RULE_TEMPLATES: Record<string, RuleTemplate> = {
  "block-bad-bots": {
    name: "Block Known Bad Bots",
    description: "Block requests from known malicious user agents",
    expression:
      '(http.user_agent contains "sqlmap") or (http.user_agent contains "nikto") or (http.user_agent contains "masscan") or (http.user_agent contains "dirbuster") or (http.user_agent contains "nmap") or (http.user_agent contains "zgrab")',
    action: "block",
  },
  "block-empty-ua": {
    name: "Block Empty User Agents",
    description: "Challenge requests with no user agent string",
    expression: '(http.user_agent eq "")',
    action: "managed_challenge",
  },
  "protect-wp-login": {
    name: "Protect WordPress Login",
    description: "Rate-challenge access to wp-login and wp-admin",
    expression:
      '(http.request.uri.path contains "/wp-login.php") or (http.request.uri.path contains "/wp-admin" and not http.request.uri.path contains "/wp-admin/admin-ajax.php")',
    action: "managed_challenge",
  },
  "block-xmlrpc": {
    name: "Block XML-RPC",
    description: "Block access to xmlrpc.php (common attack vector)",
    expression: '(http.request.uri.path contains "/xmlrpc.php")',
    action: "block",
  },
  "geo-block": {
    name: "Geo Block (Customize Countries)",
    description: "Block traffic from specific countries",
    expression: '(ip.geoip.country in {"CN" "RU" "KP"})',
    action: "managed_challenge",
  },
  "hotlink-protection": {
    name: "Hotlink Protection",
    description: "Block hotlinking of images from external sites",
    expression:
      '(http.request.uri.path.extension in {"jpg" "jpeg" "png" "gif" "webp" "svg"} and not http.referer contains "yourdomain.com" and http.referer ne "")',
    action: "block",
  },
  "rate-limit-api": {
    name: "Challenge High-Rate API Access",
    description: "Challenge suspicious API endpoint access patterns",
    expression: '(http.request.uri.path contains "/api/" and not ip.src in {})',
    action: "managed_challenge",
  },
  "block-scanners": {
    name: "Block Path Scanners",
    description: "Block common vulnerability scanner paths",
    expression:
      '(http.request.uri.path contains "/.env") or (http.request.uri.path contains "/.git") or (http.request.uri.path contains "/wp-config") or (http.request.uri.path contains "/phpmyadmin") or (http.request.uri.path contains "/.htaccess") or (http.request.uri.path contains "/config.php")',
    action: "block",
  },
};
