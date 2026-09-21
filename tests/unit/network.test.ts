import { describe, it, expect } from "vitest";
import type { MetricSeries, NodeInfo } from "../../packages/contracts";
import {
  normalizeNetwork,
  combineSummary,
  timeBuckets,
  weightedQuantile,
  normalizeTasks,
  selectVisibleIds,
  type PingTask,
  type TimeWindow,
} from "../../apps/theme/src/domain/network";
const at = Date.parse("2026-09-20T11:00:00Z"),
  window: TimeWindow = { start: at, end: at + 600000 };
const tasks: PingTask[] = [
  {
    id: "1",
    name: "移动",
    type: "tcp",
    interval: 60,
    weight: 0,
    clients: ["a"],
  },
  {
    id: "2",
    name: "联通",
    type: "tcp",
    interval: 180,
    weight: 1,
    clients: ["a"],
  },
];
function series(
  key: string,
  values: (number | null)[],
  counts: number[] = [],
  task = "1",
  unit = key === "ping.loss" ? "ratio" : "ms",
  node = "a",
  interval = 60,
): MetricSeries {
  return {
    metric_key: key,
    entity_id: node,
    tags: { task_id: task },
    unit,
    downsampled: true,
    interval_seconds: interval,
    points: values.map((value, i) => ({
      time: new Date(at + i * 60000).toISOString(),
      value,
      count: counts[i] ?? 1,
    })),
  };
}
const build = (list: MetricSeries[]) =>
  normalizeNetwork(
    {
      series: list,
      start: new Date(window.start).toISOString(),
      end: new Date(window.end).toISOString(),
    },
    window,
    tasks,
    ["a"],
  );
describe("network metric semantics", () => {
  it("removes timeout sentinel contribution from equal-count paired aggregate buckets", () => {
    const data = build([
      series("ping.latency_ms", [49.5], [2]),
      series("ping.loss", [0.5], [2]),
    ]);
    const line = data.lines[0];
    expect(line.summary.average).toBe(100);
    expect(line.summary.valid).toBe(1);
    expect(line.summary.total).toBe(2);
    expect(line.summary.loss).toBe(50);
    expect(line.summary.estimated).toBe(true);
  });
  it("keeps a legitimate zero latency and zero loss", () => {
    const l = build([series("ping.latency_ms", [0]), series("ping.loss", [0])])
      .lines[0];
    expect(l.summary.average).toBe(0);
    expect(l.summary.loss).toBe(0);
    expect(l.summary.p95).toBe(0);
  });
  it("retains complete packet loss without fabricating a successful latency", () => {
    const l = build([
      series("ping.latency_ms", [null], [5]),
      series("ping.loss", [1], [5]),
    ]).lines[0];
    expect(l.summary.loss).toBe(100);
    expect(l.summary.total).toBe(5);
    expect(l.summary.valid).toBe(0);
    expect(l.summary.average).toBeNull();
    expect(l.summary.p95).toBeNull();
  });
  it("weights loss by probe counts instead of averaging percentages", () => {
    const data = build([
      series("ping.loss", [0], [90], "1"),
      series("ping.loss", [1], [10], "2"),
    ]);
    expect(combineSummary(data.lines).loss).toBe(10);
    expect(timeBuckets(data.lines, window, 1)[0].loss).toBe(10);
  });
  it("uses one bucket value per actual period, with missing periods kept unknown", () => {
    const l = build([
      series("ping.latency_ms", [100, null, 200]),
      series("ping.loss", [0, null, 1]),
    ]);
    const buckets = timeBuckets(l.lines, window, 10);
    expect(buckets[0].loss).toBe(0);
    expect(buckets[1].loss).toBeNull();
    expect(buckets[2].loss).toBe(100);
    expect(buckets[3].lossCount).toBe(0);
  });
  it("does not pretend coarse retained history has finer independent time cells", () => {
    const l = build([series("ping.loss", [0.2], [5], "1", "ratio", "a", 300)]);
    expect(timeBuckets(l.lines, window, 24)).toHaveLength(2);
  });
  it("deduplicates repeated timestamps and ignores out-of-window points", () => {
    const s = series("ping.loss", [0, 0.5], [2, 2]);
    s.points.push(s.points[1], {
      time: new Date(at - 600000).toISOString(),
      value: 1,
      count: 500,
    });
    expect(build([s]).lines[0].summary.total).toBe(4);
    expect(build([s]).lines[0].summary.loss).toBe(25);
  });
  it("accepts percent units and rejects malformed ratio values", () => {
    expect(
      build([series("ping.loss", [50], [10], "1", "%")]).lines[0].summary.loss,
    ).toBe(50);
    expect(
      build([series("ping.loss", [50], [10])]).lines[0].summary.loss,
    ).toBeNull();
  });
  it("does not use mismatched-count loss data to correct latency averages", () => {
    const l = build([
      series("ping.latency_ms", [80], [4]),
      series("ping.loss", [0.5], [2]),
    ]);
    expect(l.lines[0].summary.average).toBe(80);
    expect(l.warnings.length).toBeGreaterThan(0);
  });
  it("does not invent zero loss when only latency exists", () => {
    const l = build([series("ping.latency_ms", [100], [4])]);
    const summary = combineSummary(l.lines);
    expect(summary.loss).toBeNull();
    expect(summary.total).toBe(4);
    expect(summary.valid).toBe(4);
  });
  it("filters unsolicited entities and keeps task metadata limited to visible clients", () => {
    expect(
      build([
        series("ping.loss", [1], [1], "1", "ratio", "hidden"),
      ]).lines.every((l) => l.nodeId === "a"),
    ).toBe(true);
    const t = normalizeTasks(
      [
        { id: 2, name: "B", clients: ["a", "hidden"], weight: 0 },
        { id: 1, name: "A", clients: ["hidden"], weight: 2 },
      ],
      ["a"],
    );
    expect(t[0].id).toBe("2");
    expect(t[0].clients).toEqual(["a"]);
    expect(t[1].clients).toEqual([]);
  });
  it("supports singular tag metadata and count-weighted percentile estimates", () => {
    const s = series("ping.latency_ms", [10, 100], [95, 5]);
    s.tag = s.tags;
    delete s.tags;
    const l = build([s]).lines[0];
    expect(l.taskId).toBe("1");
    expect(l.summary.p95).toBe(10);
    expect(l.summary.estimated).toBe(true);
  });
  it("bounds comparisons to four visible, distinct nodes", () => {
    const nodes = ["a", "b", "c", "d", "e"].map((id) => ({ id }) as NodeInfo);
    expect(
      selectVisibleIds(["a", "a", "private", "b", "c", "d", "e"], nodes),
    ).toEqual(["a", "b", "c", "d"]);
  });
  it("handles empty histories without NaN or synthetic samples", () => {
    const p = build([]);
    expect(p.lines).toHaveLength(2);
    expect(combineSummary(p.lines).average).toBeNull();
    expect(
      timeBuckets(p.lines, window).every(
        (b) => b.loss === null && b.latency === null,
      ),
    ).toBe(true);
  });
});

it("recovers valid sub-millisecond samples even when timeout contributions make the bucket negative", () => {
  const l = build([
    series("ping.latency_ms", [-0.4], [2]),
    series("ping.loss", [0.5], [2]),
  ]).lines[0];
  expect(l.summary.average).toBeCloseTo(0.2);
  expect(l.summary.valid).toBe(1);
  expect(
    build([series("ping.latency_ms", [-0.4], [2])]).lines[0].summary.average,
  ).toBeNull();
});
