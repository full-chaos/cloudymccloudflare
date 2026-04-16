import type { DomainCluster, Zone } from "../types";

/**
 * Group zones by their base name (the label before the first dot) to form
 * TLD clusters. e.g. chrisgeorge.{ai,app,com} → one cluster called "chrisgeorge".
 *
 * Result is sorted by cluster size DESC (biggest clusters first) so the UI
 * surfaces meaningful groupings at the top.
 */
export function toClusters(zones: Zone[]): DomainCluster[] {
  const map = new Map<string, Zone[]>();
  for (const zone of zones) {
    const dotIdx = zone.name.indexOf(".");
    const base = dotIdx !== -1 ? zone.name.slice(0, dotIdx) : zone.name;
    if (!map.has(base)) map.set(base, []);
    map.get(base)!.push(zone);
  }
  return Array.from(map.entries())
    .map(([baseName, clusterZones]) => ({ baseName, zones: clusterZones }))
    .sort((a, b) => b.zones.length - a.zones.length);
}
