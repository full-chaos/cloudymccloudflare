// Display formatting helpers for analytics numbers.
// Binary bytes (KiB/MiB/GiB) and decimal counts (K/M/B).

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  const digits = value < 10 && exp > 0 ? 2 : value < 100 && exp > 0 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[exp]}`;
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs < 1e10 ? 2 : 1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs < 1e7 ? 2 : 1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(abs < 1e4 ? 2 : 1)}K`;
  return n.toString();
}

export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/**
 * Client-side mirror of analytics.service.computeCacheHitRatio.
 * Returns NaN when `bytes === 0` so UI can render "—" instead of misleading "0%".
 */
export function computeCacheHitRatio(bytes: number, cachedBytes: number): number {
  if (bytes <= 0) return Number.NaN;
  const ratio = cachedBytes / bytes;
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;
  return ratio;
}

// "5 min ago", "2h ago", "just now"
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

// Hour-bucket ISO → "14:00" local time for chart axis labels.
export function formatHourLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Hour-bucket ISO → "Apr 16, 14:00" for tooltips.
export function formatHourFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
