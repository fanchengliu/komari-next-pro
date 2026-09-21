import centers from "../assets/region-centers.json";
import type { NodeInfo, NodeStatus } from "../../../../packages/contracts";
export interface RegionGroup {
  id: string;
  name: string;
  lat: number;
  lon: number;
  nodes: NodeInfo[];
  nodeStates: Record<string, "online" | "offline" | "unknown" | "stale">;
  online: number;
  unknown: number;
  stale: number;
  state: "online" | "offline" | "unknown" | "stale";
}
const positions = centers as Record<
  string,
  { lat: number; lon: number; name: string }
>;
export function regionCode(region: string): string | null {
  const value = region.trim();
  const chars = [...value];
  let code = "";
  if (
    chars.length >= 2 &&
    chars
      .slice(0, 2)
      .every(
        (c) => c.codePointAt(0)! >= 0x1f1e6 && c.codePointAt(0)! <= 0x1f1ff,
      )
  )
    code = chars
      .slice(0, 2)
      .map((c) => String.fromCharCode(c.codePointAt(0)! - 0x1f1e6 + 65))
      .join("");
  else if (/^[A-Za-z]{2}(?:$|[\s,/-])/.test(value))
    code = value.slice(0, 2).toUpperCase();
  if (code === "UK") code = "GB";
  return positions[code] ? code : null;
}
export function regionName(code: string, locale: string) {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(code) ??
      positions[code]?.name ??
      code
    );
  } catch {
    return positions[code]?.name ?? code;
  }
}
export function groupRegions(
  nodes: NodeInfo[],
  statuses: Record<string, NodeStatus>,
  locale = "zh-CN",
  now = Date.now(),
) {
  const map = new Map<string, RegionGroup>(),
    unmapped: NodeInfo[] = [];
  for (const node of nodes) {
    const id = regionCode(node.region);
    if (!id) {
      unmapped.push(node);
      continue;
    }
    const position = positions[id];
    let group = map.get(id);
    if (!group) {
      group = {
        id,
        name: regionName(id, locale),
        lat: position.lat,
        lon: position.lon,
        nodes: [],
        nodeStates: {},
        online: 0,
        unknown: 0,
        stale: 0,
        state: "offline",
      };
      map.set(id, group);
    }
    group.nodes.push(node);
    const s = statuses[node.id];
    group.nodeStates[node.id] = !s
      ? "unknown"
      : !s.online
        ? "offline"
        : !s.at || now - s.at > 60000
          ? "stale"
          : "online";
    if (!s) group.unknown++;
    else if (s.online) {
      group.online++;
      if (!s.at || now - s.at > 60000) group.stale++;
    }
  }
  const regions = [...map.values()].map((g) => ({
    ...g,
    state: (g.online
      ? g.stale === g.online
        ? "stale"
        : "online"
      : g.unknown
        ? "unknown"
        : "offline") as RegionGroup["state"],
  }));
  return { regions, unmapped, lit: regions.filter((g) => g.online > 0).length };
}
