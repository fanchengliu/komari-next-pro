import type { NetworkPreset, TimeWindow } from "./network";
const parts = (time: number, zone: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(time)
      .map((p) => [p.type, p.value]),
  );
export function toLocalInput(time: number, zone: string) {
  const p = parts(time, zone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
/** Strict civil-time parser. Gaps are rejected; repeated DST times use the earlier instant. */
export function fromLocalInput(value: string, zone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error("请选择完整的日期和时间");
  const civil = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (!Number.isFinite(civil)) throw new Error("无效时间");
  const candidates = new Set<number>();
  for (const offsetHours of [-36, 0, 36]) {
    const probe = civil + offsetHours * 3600000,
      p = parts(probe, zone);
    const asUTC = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    const candidate = civil - (asUTC - probe);
    if (toLocalInput(candidate, zone) === value) candidates.add(candidate);
  }
  if (!candidates.size) throw new Error("该本地时间不存在，请检查日期或夏令时");
  return Math.min(...candidates);
}
export function validateWindow(
  window: TimeWindow,
  now = Date.now(),
  maxHours = 744,
): string | null {
  if (!Number.isFinite(window.start) || !Number.isFinite(window.end))
    return "无效时间范围";
  if (window.end - window.start < 1000) return "结束时间至少比开始时间晚一秒";
  if (window.end > now + 1000) return "不能查询尚未发生的时段";
  if (
    window.end - window.start >
    Math.min(744, Math.max(1, maxHours)) * 3600000
  )
    return "所选范围超过当前查询上限";
  return null;
}
export function presetWindow(
  preset: Exclude<NetworkPreset, "custom">,
  zone: string,
  now = Date.now(),
  day?: string,
): TimeWindow {
  if (preset !== "peak")
    return {
      start: now - { "1h": 1, "6h": 6, "24h": 24, "7d": 168 }[preset] * 3600000,
      end: now,
    };
  let date = day ?? toLocalInput(now, zone).slice(0, 10);
  let start = fromLocalInput(date + "T19:00", zone),
    end = fromLocalInput(date + "T23:00", zone);
  if (!day && start >= now) {
    const p = parts(now, zone);
    const prev = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - 1));
    date = prev.toISOString().slice(0, 10);
    start = fromLocalInput(date + "T19:00", zone);
    end = fromLocalInput(date + "T23:00", zone);
  }
  return { start, end: Math.min(end, now) };
}
export const windowKey = (w: TimeWindow) => [w.start, w.end] as const;
export function parseRangeParams(
  params: URLSearchParams,
  zone: string,
  now = Date.now(),
): { preset: NetworkPreset; window: TimeWindow; error: string | null } {
  const from = params.get("from"),
    to = params.get("to");
  if (from !== null || to !== null) {
    const window = { start: Date.parse(from ?? ""), end: Date.parse(to ?? "") };
    const error = validateWindow(window, now);
    return {
      preset: "custom",
      window: error ? presetWindow("6h", zone, now) : window,
      error,
    };
  }
  const preset = params.get("range");
  const key = (
    ["1h", "6h", "24h", "7d", "peak"].includes(preset ?? "") ? preset : "6h"
  ) as Exclude<NetworkPreset, "custom">;
  return { preset: key, window: presetWindow(key, zone, now), error: null };
}
