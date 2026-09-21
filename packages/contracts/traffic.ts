import type {
  MetricSeries,
  TrafficRange,
  TrafficItem,
  NodeInfo,
} from "./index";
/** Convert a civil midnight in a named timezone without assuming every day is 24 hours. */
export function midnight(
  year: number,
  month: number,
  day: number,
  zone: string,
): number {
  const civil = Date.UTC(year, month - 1, day);
  let utc = civil;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(
      fmt.formatToParts(utc).map((x) => [x.type, x.value]),
    );
    const displayed = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    utc += civil - displayed;
  }
  return utc;
}
export function trafficWindow(
  range: TrafficRange,
  now = Date.now(),
  zone = "America/New_York",
) {
  if (range === "7d" || range === "30d")
    return {
      start: now - (range === "7d" ? 7 : 30) * 86400000,
      end: now,
      timezone: zone,
    };
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  const today = midnight(+p.year, +p.month, +p.day, zone);
  const prev = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - 1));
  return {
    start:
      range === "today"
        ? today
        : midnight(
            prev.getUTCFullYear(),
            prev.getUTCMonth() + 1,
            prev.getUTCDate(),
            zone,
          ),
    end: range === "today" ? now : today,
    timezone: zone,
  };
}
export function counterStep(previous: number, current: number) {
  return current >= previous
    ? current - previous
    : current <= 64 * 1024 ** 3
      ? current
      : 0;
}
/** Aggregated API returns one resolution, not overlapping raw/rollup tables. Nulls stay unknown. */
export function summarizeDirection(
  delta: MetricSeries | undefined,
  counter: MetricSeries | undefined,
) {
  const samples = new Map(
    (delta?.points ?? []).map((p) => [Date.parse(p.time), p.value]),
  );
  const counters = new Map(
    (counter?.points ?? [])
      .filter((p) => p.value !== null)
      .map((p) => [Date.parse(p.time), p.value!]),
  );
  const times = [...new Set([...samples.keys(), ...counters.keys()])]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let total = 0,
    known = false,
    estimated = false,
    previous: number | undefined;
  for (const time of times) {
    const direct = samples.get(time),
      current = counters.get(time);
    // Recover each migrated zero bucket individually. Modern nonzero buckets are never augmented.
    if (direct !== undefined && direct !== null && direct > 0) {
      total += direct;
      known = true;
    } else if (current !== undefined && previous !== undefined) {
      const recovered = counterStep(previous, current);
      if (recovered > 0) {
        total += recovered;
        estimated = true;
        known = true;
      } else if (direct === 0) known = true;
    } else if (direct === 0) known = true;
    if (current !== undefined) previous = current;
  }
  return { value: known ? total : null, estimated };
}
export function trafficItems(
  nodes: NodeInfo[],
  series: MetricSeries[],
): TrafficItem[] {
  return nodes.map((node) => {
    const find = (key: string) =>
      series.find((s) => s.entity_id === node.id && s.metric_key === key);
    const up = summarizeDirection(find("traffic.up"), find("net.total.up"));
    const down = summarizeDirection(
      find("traffic.down"),
      find("net.total.down"),
    );
    const coarse = series.some(
      (s) => s.entity_id === node.id && (s.interval_seconds ?? 0) > 60,
    );
    return {
      id: node.id,
      name: node.name,
      up: up.value,
      down: down.value,
      quota: node.quota,
      quotaMode: node.quotaMode,
      precision:
        up.value === null || down.value === null
          ? "unavailable"
          : up.estimated || down.estimated || coarse
            ? "estimated"
            : "native",
      notes: [
        ...(up.estimated || down.estimated
          ? ["历史增量为空，按保留的累计计数估算；边界与重置可能产生误差"]
          : []),
        ...(coarse ? ["包含聚合桶，范围边界精度受保留粒度限制"] : []),
      ],
    };
  });
}
