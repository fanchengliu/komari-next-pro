import type {
  MetricResponse,
  MetricSeries,
  NodeInfo,
} from "../../../../packages/contracts";
export interface TimeWindow {
  start: number;
  end: number;
}
export type NetworkPreset = "1h" | "6h" | "24h" | "7d" | "peak" | "custom";
export interface PingTask {
  id: string;
  name: string;
  type: string;
  interval: number;
  weight: number;
  clients: string[];
}
export interface Sample {
  time: number;
  value: number | null;
  count: number;
  interval: number;
  estimated: boolean;
}
export interface PingStat {
  entity_id: string;
  task_id: string;
  name?: string;
  total: number;
  valid: number;
  loss: number;
  loss_approximate?: boolean;
  min?: number | null;
  max?: number | null;
  avg?: number | null;
}
export interface PingStatsResponse {
  start: string;
  end: string;
  interval_seconds?: number;
  stats: PingStat[];
}
export interface NetworkSummary {
  average: number | null;
  p95: number | null;
  min: number | null;
  max: number | null;
  loss: number | null;
  total: number;
  valid: number;
  estimated: boolean;
  coverageStart: number | null;
  coverageEnd: number | null;
}
export interface NetworkLine {
  id: string;
  nodeId: string;
  taskId: string;
  name: string;
  latency: Sample[];
  loss: Sample[];
  summary: NetworkSummary;
  interval: number;
}
export interface NetworkPayload {
  window: TimeWindow;
  lines: NetworkLine[];
  warnings: string[];
}
export interface TimeBucket {
  start: number;
  end: number;
  latency: number | null;
  loss: number | null;
  latencyCount: number;
  lossCount: number;
  estimated: boolean;
}
export const taskKey = (id: string, taskId: string) =>
  JSON.stringify([id, taskId]);
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const nonnegative = (v: unknown) => {
  const x = num(v);
  return x !== null && x >= 0 ? x : null;
};
export function normalizeTasks(
  input: unknown,
  visibleIds: string[],
): PingTask[] {
  const rows = Array.isArray(input)
    ? input
    : input && typeof input === "object"
      ? Object.values(input)
      : [];
  const visible = new Set(visibleIds);
  return rows
    .filter(
      (r) =>
        r &&
        typeof r === "object" &&
        (typeof r.id === "number" || typeof r.id === "string"),
    )
    .map((r) => ({
      id: String(r.id),
      name: typeof r.name === "string" ? r.name : String(r.id),
      type: typeof r.type === "string" ? r.type : "",
      interval: nonnegative(r.interval) ?? 0,
      weight: num(r.weight) ?? 0,
      clients: Array.isArray(r.clients)
        ? r.clients.filter(
            (v: unknown): v is string =>
              typeof v === "string" && visible.has(v),
          )
        : [],
    }))
    .sort(
      (a, b) =>
        a.weight - b.weight ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
}
function metricTask(
  s: MetricSeries,
  p?: { tags?: Record<string, string>; tag?: Record<string, string> },
) {
  return String(
    s.tags?.task_id ??
      s.tag?.task_id ??
      p?.tags?.task_id ??
      p?.tag?.task_id ??
      "unknown",
  );
}
function samples(series: MetricSeries[], loss = false): Sample[] {
  const records = new Map<number, Sample>();
  for (const s of series) {
    const interval = Math.max(0, num(s.interval_seconds) ?? 0) * 1000;
    for (const p of s.points ?? []) {
      const time = Date.parse(p.time);
      if (!Number.isFinite(time)) continue;
      let value =
        !loss && (s.downsampled || (p.count ?? 0) > 1)
          ? num(p.value)
          : nonnegative(p.value);
      const count =
        p.count === undefined
          ? value === null
            ? 0
            : 1
          : (nonnegative(p.count) ?? 0);
      if (loss && value !== null) {
        const percent = s.unit === "%" || s.unit === "percent";
        if (value > (percent ? 100 : 1)) value = null;
        else if (!percent) value *= 100;
      }
      const item = {
        time,
        value: count > 0 ? value : null,
        count,
        interval,
        estimated: !!s.downsampled || count > 1,
      };
      const old = records.get(time);
      // Duplicate series/pages are not additional samples. Prefer the finer existing representation.
      if (
        !old ||
        item.interval < old.interval ||
        (item.interval === old.interval && item.count >= old.count)
      )
        records.set(time, item);
    }
  }
  return [...records.values()].sort((a, b) => a.time - b.time);
}
const overlaps = (p: Sample, w: TimeWindow) =>
  p.time < w.end &&
  (p.interval > 0 ? p.time + p.interval > w.start : p.time >= w.start);
export function weightedQuantile(points: Sample[], q: number): number | null {
  const good = points
    .filter((p) => p.value !== null && p.count > 0)
    .sort((a, b) => a.value! - b.value!);
  const total = good.reduce((sum, p) => sum + p.count, 0);
  if (!total) return null;
  let cumulative = 0;
  const target = Math.max(1, Math.ceil(total * q));
  for (const p of good) {
    cumulative += p.count;
    if (cumulative >= target) return p.value;
  }
  return good.at(-1)?.value ?? null;
}
function mean(points: Sample[]): number | null {
  let sum = 0,
    count = 0;
  for (const p of points)
    if (p.value !== null && p.count > 0) {
      sum += p.value * p.count;
      count += p.count;
    }
  return count ? sum / count : null;
}
export function summarize(
  latency: Sample[],
  loss: Sample[],
  stat?: PingStat,
): NetworkSummary {
  const good = latency.filter((p) => p.value !== null && p.count > 0),
    lossPoints = loss.filter((p) => p.value !== null && p.count > 0);
  const valid = good.reduce((sum, p) => sum + p.count, 0),
    total =
      lossPoints.reduce((sum, p) => sum + p.count, 0) ||
      latency.reduce((sum, p) => sum + p.count, 0);
  const nativeTotal = nonnegative(stat?.total),
    nativeLoss = nonnegative(stat?.loss);
  const values = good.map((p) => p.value!),
    all = [...good, ...lossPoints];
  return {
    average: mean(good),
    p95: weightedQuantile(good, 0.95),
    min: nonnegative(stat?.min) ?? (values.length ? Math.min(...values) : null),
    max: nonnegative(stat?.max) ?? (values.length ? Math.max(...values) : null),
    loss:
      nativeTotal && nativeLoss !== null && nativeLoss <= 100
        ? nativeLoss
        : mean(lossPoints),
    total: nativeTotal && nativeTotal > 0 ? nativeTotal : total,
    valid: nativeTotal ? (nonnegative(stat?.valid) ?? valid) : valid,
    estimated: !!stat?.loss_approximate || all.some((p) => p.estimated),
    coverageStart: all.length ? Math.min(...all.map((p) => p.time)) : null,
    coverageEnd: all.length
      ? Math.max(...all.map((p) => p.time + p.interval))
      : null,
  };
}
/** Normalize paired latency/loss series from the pinned Komari metric contract. */
export function normalizeNetwork(
  metrics: MetricResponse,
  window: TimeWindow,
  tasks: PingTask[],
  ids: string[],
  stats?: PingStatsResponse,
): NetworkPayload {
  const allowed = new Set(ids),
    groups = new Map<
      string,
      {
        nodeId: string;
        taskId: string;
        latency: MetricSeries[];
        loss: MetricSeries[];
      }
    >();
  for (const s of metrics.series ?? []) {
    if (
      !allowed.has(s.entity_id) ||
      !["ping.latency_ms", "ping.loss"].includes(s.metric_key)
    )
      continue;
    const taskId = metricTask(
      s,
      s.points?.find((p) => p.tags || p.tag),
    );
    const key = taskKey(s.entity_id, taskId);
    let g = groups.get(key);
    if (!g) {
      g = { nodeId: s.entity_id, taskId, latency: [], loss: [] };
      groups.set(key, g);
    }
    g[s.metric_key === "ping.loss" ? "loss" : "latency"].push(s);
  }
  for (const id of ids)
    for (const task of tasks)
      if (task.clients.includes(id) && !groups.has(taskKey(id, task.id)))
        groups.set(taskKey(id, task.id), {
          nodeId: id,
          taskId: task.id,
          latency: [],
          loss: [],
        });
  const warnings = new Set<string>();
  const lines = [...groups.entries()].map(([key, g]): NetworkLine => {
    const latency = samples(g.latency).filter((p) => overlaps(p, window)),
      loss = samples(g.loss, true).filter((p) => overlaps(p, window));
    const lossByTime = new Map(loss.map((p) => [p.time, p]));
    const corrected = latency.map((p) => {
      const pair = lossByTime.get(p.time);
      if (!p.estimated) return p;
      // Komari 1.5 stores timeout as -1 in latency averages; remove that sentinel contribution
      // only when equal-count, equal-resolution loss buckets establish the exact denominator.
      if (
        pair?.value !== null &&
        pair?.value !== undefined &&
        pair.count === p.count &&
        pair.interval === p.interval
      ) {
        const fraction = pair.value / 100;
        if (fraction >= 1) return { ...p, value: null, count: 0 };
        if (p.value !== null) {
          const corrected = (p.value + fraction) / (1 - fraction);
          return {
            ...p,
            value: corrected >= 0 ? corrected : null,
            count: corrected >= 0 ? p.count * (1 - fraction) : 0,
          };
        }
      }
      if (p.value !== null)
        warnings.add("部分历史缺少配对样本，延迟按后端聚合值展示");
      return p.value !== null && p.value < 0 ? { ...p, value: null } : p;
    });
    const interval = Math.max(
      0,
      ...latency.map((p) => p.interval),
      ...loss.map((p) => p.interval),
    );
    const summary = summarize(
      corrected,
      loss,
      stats?.stats?.find(
        (s) => s.entity_id === g.nodeId && String(s.task_id) === g.taskId,
      ),
    );
    if (
      latency.some(
        (p) =>
          p.time < window.start ||
          (p.interval > 0 && p.time + p.interval > window.end),
      ) ||
      loss.some(
        (p) => p.time < window.start || p.time + p.interval > window.end,
      )
    ) {
      summary.estimated = true;
      warnings.add("边界包含聚合桶，统计精度受保留粒度限制");
    }
    return {
      id: key,
      nodeId: g.nodeId,
      taskId: g.taskId,
      name:
        tasks.find((t) => t.id === g.taskId)?.name ??
        stats?.stats?.find((s) => String(s.task_id) === g.taskId)?.name ??
        `#${g.taskId}`,
      latency: corrected,
      loss,
      summary,
      interval,
    };
  });
  lines.sort(
    (a, b) =>
      ids.indexOf(a.nodeId) - ids.indexOf(b.nodeId) ||
      tasks.findIndex((t) => t.id === a.taskId) -
        tasks.findIndex((t) => t.id === b.taskId) ||
      a.taskId.localeCompare(b.taskId, undefined, { numeric: true }),
  );
  return { window, lines, warnings: [...warnings] };
}
export function timeBuckets(
  lines: NetworkLine[],
  window: TimeWindow,
  target = 24,
): TimeBucket[] {
  const coarse = Math.max(0, ...lines.map((l) => l.interval)),
    duration = window.end - window.start;
  const count = Math.max(
    1,
    Math.min(target, coarse ? Math.floor(duration / coarse) : target),
  );
  const bins = Array.from({ length: count }, (_, i) => ({
    start: window.start + (i * duration) / count,
    end: window.start + ((i + 1) * duration) / count,
    latency: null as number | null,
    loss: null as number | null,
    latencyCount: 0,
    lossCount: 0,
    estimated: false,
    latencySum: 0,
    lossSum: 0,
  }));
  for (const line of lines)
    for (const kind of ["latency", "loss"] as const)
      for (const p of line[kind]) {
        if (p.value === null || p.count <= 0 || !overlaps(p, window)) continue;
        const position = Math.max(
          window.start,
          Math.min(window.end - 1, p.time + p.interval / 2),
        );
        const index = Math.min(
            count - 1,
            Math.floor(((position - window.start) / duration) * count),
          ),
          b = bins[index];
        b[(kind + "Sum") as "latencySum" | "lossSum"] += p.value * p.count;
        b[(kind + "Count") as "latencyCount" | "lossCount"] += p.count;
        b.estimated ||=
          p.estimated ||
          p.time < b.start ||
          (p.interval > 0 && p.time + p.interval > b.end);
      }
  return bins.map(({ latencySum, lossSum, ...b }) => ({
    ...b,
    latency: b.latencyCount ? latencySum / b.latencyCount : null,
    loss: b.lossCount ? lossSum / b.lossCount : null,
  }));
}
export function combineSummary(lines: NetworkLine[]): NetworkSummary {
  const summary = summarize(
    lines.flatMap((l) => l.latency),
    lines.flatMap((l) => l.loss),
  );
  const known = lines.filter(
      (l) => l.summary.loss !== null && l.summary.total > 0,
    ),
    total = known.reduce((s, l) => s + l.summary.total, 0);
  return {
    ...summary,
    loss: total
      ? known.reduce((s, l) => s + l.summary.loss! * l.summary.total, 0) / total
      : null,
    total: lines.reduce((s, l) => s + l.summary.total, 0),
    valid: lines.reduce((s, l) => s + l.summary.valid, 0),
    estimated: lines.some((l) => l.summary.estimated),
    min: lines.some((l) => l.summary.min !== null)
      ? Math.min(
          ...lines.flatMap((l) =>
            l.summary.min === null ? [] : [l.summary.min],
          ),
        )
      : null,
    max: lines.some((l) => l.summary.max !== null)
      ? Math.max(
          ...lines.flatMap((l) =>
            l.summary.max === null ? [] : [l.summary.max],
          ),
        )
      : null,
  };
}
export function selectVisibleIds(
  requested: string[],
  nodes: NodeInfo[],
  limit = 4,
) {
  const visible = new Set(nodes.map((n) => n.id));
  return [...new Set(requested)]
    .filter((id) => visible.has(id))
    .slice(0, limit);
}
export const routeColors = [
  "#477fdf",
  "#9471d8",
  "#d99a39",
  "#19a18e",
  "#cc7393",
  "#708cac",
  "#a57a53",
];
export function taskColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return routeColors[hash % routeColors.length];
}
