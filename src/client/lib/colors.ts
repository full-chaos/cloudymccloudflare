export const CLUSTER_PALETTE = [
  "#7dd3fc",
  "#fde68a",
  "#c4b5fd",
  "#fda4af",
  "#86efac",
  "#fdba74",
  "#67e8f9",
  "#d8b4fe",
] as const;

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function colorForCluster(clusterName: string): string {
  const idx = hash(clusterName) % CLUSTER_PALETTE.length;
  return CLUSTER_PALETTE[idx];
}

export function colorForZone(zone: { groupColors: string[]; clusterName: string | null }): string {
  if (zone.groupColors && zone.groupColors.length > 0) {
    return zone.groupColors[0];
  }
  if (zone.clusterName) {
    return colorForCluster(zone.clusterName);
  }
  return "#555555";
}
