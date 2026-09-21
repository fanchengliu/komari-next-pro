import { it, expect } from "vitest";
import {
  defaultSettings,
  resolveThemeSettings,
  type NodeInfo,
  type NodeStatus,
} from "../../packages/contracts";
import { groupRegions, regionCode } from "../../apps/theme/src/domain/regions";
it("preserves v1 settings while adding v2 defaults and isolating invalid fields", () => {
  const config = resolveThemeSettings(
    { version: 1, accent: "#123456", mood: false, fields: ["cpu", "ping"] },
    { timezone: "not-a-timezone", desktopLayout: "compact" },
  );
  expect(config.version).toBe(2);
  expect(config.accent).toBe("#123456");
  expect(config.mood).toBe(false);
  expect(config.fields).toEqual(["cpu", "ping"]);
  expect(config.timezone).toBe(defaultSettings.timezone);
  expect(config.desktopLayout).toBe("compact");
  expect(config.mobileLayout).toBe("daily");
});
it("recognizes real region codes and flag prefixes without guessing unknown places", () => {
  expect(regionCode("🇭🇰 香港")).toBe("HK");
  expect(regionCode("us")).toBe("US");
  expect(regionCode("UK")).toBe("GB");
  expect(regionCode("somewhere")).toBeNull();
  expect(regionCode("ZZ")).toBeNull();
});
it("counts each region once, separates unmapped nodes, and distinguishes stale status", () => {
  const now = Date.now();
  const nodes = [
    { id: "a", region: "US" },
    { id: "b", region: "🇺🇸" },
    { id: "c", region: "KR" },
    { id: "d", region: "unknown" },
    { id: "e", region: "DE" },
  ] as NodeInfo[];
  const statuses = {
    a: { online: true, at: now },
    b: { online: false, at: now },
    c: { online: false, at: now },
    e: { online: true, at: now - 300000 },
  } as unknown as Record<string, NodeStatus>;
  const result = groupRegions(nodes, statuses, "en", now);
  expect(result.regions).toHaveLength(3);
  expect(result.lit).toBe(2);
  expect(result.regions.find((g) => g.id === "US")?.nodes).toHaveLength(2);
  expect(result.regions.find((g) => g.id === "DE")?.state).toBe("stale");
  expect(result.unmapped.map((n) => n.id)).toEqual(["d"]);
});
it("does not mark an unknown node status as confirmed offline", () => {
  const result = groupRegions(
    [{ id: "a", region: "FR" }] as NodeInfo[],
    {},
    "en",
  );
  expect(result.regions[0].state).toBe("unknown");
  expect(result.lit).toBe(0);
});
