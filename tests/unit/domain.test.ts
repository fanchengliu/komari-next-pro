import { describe, it, expect } from "vitest";
import {
  normalizeNodes,
  normalizeStatuses,
  percent,
  quotaUsage,
  assetTotals,
  bytes,
  safeMediaUrl,
  level,
  mood,
} from "../../apps/theme/src/domain/model";
import {
  counterStep,
  trafficWindow,
  summarizeDirection,
  trafficItems,
} from "../../packages/contracts/traffic";
import type { MetricSeries } from "../../packages/contracts";
import { demoNodes } from "../fixtures/komari";
const series = (
  values: (number | null)[],
  key = "traffic.up",
): MetricSeries => ({
  entity_id: "a",
  metric_key: key,
  points: values.map((value, i) => ({
    time: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    value,
  })),
});
describe("protocol normalization and display policy", () => {
  it("reproduces the uptime tiers and moods in the visual reference samples", () => {
    const node = normalizeNodes(demoNodes(1))[0];
    node.memory = 1024 ** 3;
    const sample = (days: number, ram: number, online = true) =>
      normalizeStatuses({
        a: {
          online,
          uptime: days * 86400,
          cpu: 0.8,
          ram: (node.memory * ram) / 100,
        },
      }).a;
    expect([10, 51, 98].map((d) => level(sample(d, 9)).level)).toEqual([
      2, 3, 4,
    ]);
    expect(level(sample(98, 9, false)).level).toBe(1);
    expect([9, 35, 49].map((r) => mood(node, sample(10, r)))).toEqual([
      "😴",
      "😌",
      "😊",
    ]);
  });
  it("never converts absent status into a real zero", () => {
    const s = normalizeStatuses({
      a: { time: "2026-01-01T00:00:00Z", online: false, cpu: 0 },
    }).a;
    expect(s.cpu).toBe(0);
    expect(s.downRate).toBeNull();
    expect(bytes(s.downRate)).toBe("--");
    expect(bytes(0)).toBe("0 B");
  });
  it("keeps names as text, skips malformed entries, sorts metadata", () => {
    const [n] = normalizeNodes([
      { uuid: "a", name: "<img src=x onerror=alert(1)>", weight: 0 },
      null,
      { name: "bad" },
    ]);
    expect(n.name).toContain("<img");
    expect(n.expires).toBeNull();
  });
  it("handles quota billing modes and unknown inputs", () => {
    expect(
      ["sum", "max", "min", "up", "down"].map((m) =>
        quotaUsage(10, 20, m as any),
      ),
    ).toEqual([30, 20, 10, 10, 20]);
    expect(quotaUsage(null, 20, "sum")).toBeNull();
    expect(percent(10, 0)).toBeNull();
  });
  it("excludes free assets, leaves unknown currencies out of totals explicitly", () => {
    const nodes = normalizeNodes(demoNodes(3));
    nodes[0].price = 10;
    nodes[0].billingDays = 30;
    nodes[0].currency = "$";
    nodes[1].currency = "UNKNOWN";
    nodes[2].price = -1;
    const totals = assetTotals(nodes, { $: 7 });
    expect(totals.value).toBe(70);
    expect(totals.monthly).toBe(70);
    expect(totals.unknown).toBe(1);
  });
  it("rejects executable and protocol relative media links", () => {
    expect(safeMediaUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeMediaUrl("//host/file")).toBeUndefined();
    expect(safeMediaUrl("/media/logo.png")).toBe("/media/logo.png");
  });
});
describe("traffic accounting", () => {
  it("uses the US Eastern DST calendar instead of subtracting 24h", () => {
    const spring = trafficWindow(
      "yesterday",
      Date.parse("2026-03-09T12:00:00Z"),
    );
    expect(spring.end - spring.start).toBe(23 * 3600000);
    const fall = trafficWindow("yesterday", Date.parse("2026-11-02T12:00:00Z"));
    expect(fall.end - fall.start).toBe(25 * 3600000);
  });
  it("keeps rolling seven days separate from calendar days", () => {
    const now = Date.parse("2026-03-09T12:34:56Z");
    expect(trafficWindow("7d", now).start).toBe(now - 7 * 86400000);
  });
  it("does not add counter deltas to real deltas", () => {
    expect(
      summarizeDirection(
        series([3, 4, 5]),
        series([100, 200, 300], "net.total.up"),
      ),
    ).toEqual({ value: 12, estimated: false });
  });
  it("recovers a migrated zero bucket within a mixed modern/historical range", () => {
    expect(
      summarizeDirection(
        series([0, 0, 5]),
        series([100, 120, 125], "net.total.up"),
      ),
    ).toEqual({ value: 25, estimated: true });
  });
  it("deduplicates and sorts samples, preserving null vs known zero", () => {
    const d = series([0, 3, 4]);
    d.points = [d.points[2], d.points[0], d.points[1], d.points[1]];
    expect(summarizeDirection(d, undefined).value).toBe(7);
    expect(summarizeDirection(series([null]), undefined).value).toBeNull();
    expect(summarizeDirection(series([0]), undefined).value).toBe(0);
  });
  it("handles resets and excludes suspicious multi-TB downward counter jitter", () => {
    expect(counterStep(100, 20)).toBe(20);
    expect(counterStep(1024 ** 4 * 10, 1024 ** 4 * 9)).toBe(0);
  });
  it("labels coarse retained history as approximate", () => {
    const n = normalizeNodes(demoNodes(1))[0];
    const up = { ...series([2, 3]), entity_id: n.id, interval_seconds: 3600 };
    const down = { ...up, metric_key: "traffic.down" };
    expect(trafficItems([n], [up, down])[0].precision).toBe("estimated");
  });
});
