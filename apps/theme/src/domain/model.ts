import { validatedMediaUrl } from "../../../../packages/contracts";
import { currencyRate } from "../../../../packages/contracts/exchange";
import type {
  NodeInfo,
  NodeStatus,
  PingSummary,
  QuotaMode,
  ThemeSettings,
  Viewer,
} from "../../../../packages/contracts";
export function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
const n = (v: unknown, fallback = 0) => number(v) ?? fallback;
const s = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
export function normalizeNodes(input: unknown): NodeInfo[] {
  const entries = Array.isArray(input)
    ? input
    : Object.values((input ?? {}) as object);
  return entries
    .filter(
      (v): v is Record<string, unknown> =>
        !!v && typeof v === "object" && typeof v.uuid === "string",
    )
    .map((r) => ({
      id: s(r.uuid),
      name: s(r.name, "未命名节点"),
      group: s(r.group),
      region: s(r.region, "🌐"),
      os: s(r.os),
      cpuName: s(r.cpu_name),
      cores: n(r.cpu_cores),
      arch: s(r.arch),
      virtualization: s(r.virtualization),
      memory: n(r.mem_total),
      swap: n(r.swap_total),
      disk: n(r.disk_total),
      weight: n(r.weight),
      price: n(r.price),
      currency: s(r.currency, "¥"),
      billingDays: n(r.billing_cycle),
      expires: typeof r.expired_at === "string" ? r.expired_at : null,
      created: s(r.created_at),
      hidden: r.hidden === true,
      quota: n(r.traffic_limit),
      quotaMode: ["max", "min", "up", "down"].includes(s(r.traffic_limit_type))
        ? (r.traffic_limit_type as QuotaMode)
        : "sum",
      ipv4: typeof r.ipv4 === "string" ? r.ipv4 : undefined,
      ipv6: typeof r.ipv6 === "string" ? r.ipv6 : undefined,
    }))
    .sort((a, b) => a.weight - b.weight || a.name.localeCompare(b.name));
}
export function normalizeStatuses(input: unknown): Record<string, NodeStatus> {
  if (!input || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, v]) => v && typeof v === "object")
      .map(([id, r]) => [
        id,
        {
          id,
          at: Date.parse(r.time) || 0,
          online: r.online === true,
          cpu: number(r.cpu),
          memory: number(r.ram),
          swap: number(r.swap),
          disk: number(r.disk),
          downRate: number(r.net_in),
          upRate: number(r.net_out),
          downTotal: number(r.net_total_down),
          upTotal: number(r.net_total_up),
          uptime: number(r.uptime),
          load: number(r.load),
          processes: number(r.process),
          tcp: number(r.connections),
          udp: number(r.connections_udp),
          ping: Object.entries(r.ping ?? {}).map(
            ([key, p]: [string, any]): PingSummary => ({
              id: key,
              name: s(p.name, key),
              latest: number(p.latest),
              average: number(p.avg),
              loss: number(p.loss),
              tail: number(p.tail),
            }),
          ),
        },
      ]),
  );
}
export const percent = (value: number | null | undefined, total: number) =>
  value == null || total <= 0 ? null : (value / total) * 100;
export const quotaUsage = (
  up: number | null,
  down: number | null,
  mode: QuotaMode,
): number | null =>
  up === null || down === null
    ? null
    : {
        sum: up + down,
        max: Math.max(up, down),
        min: Math.min(up, down),
        up,
        down,
      }[mode];
export function bytes(value: number | null | undefined, precision = 2): string {
  if (value == null || !Number.isFinite(value)) return "--";
  const units = ["B", "KB", "GB", "TB"]; // The intermediate MiB unit is inserted below for binary display.
  const all = [units[0], units[1], "MB", units[2], units[3], "PB"];
  const exponent =
    value === 0
      ? 0
      : Math.max(
          0,
          Math.min(5, Math.floor(Math.log(Math.abs(value)) / Math.log(1024))),
        );
  return `${(value / 1024 ** exponent).toFixed(exponent ? precision : 0).replace(/\.0+$|(?<=\.[0-9]*)0+$/g, "")} ${all[exponent]}`;
}
export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? "--" : `${v.toFixed(digits)}%`;
export const daysLeft = (node: NodeInfo, now = Date.now()) =>
  node.expires && Number.isFinite(Date.parse(node.expires))
    ? Math.ceil((Date.parse(node.expires) - now) / 86400000)
    : null;
export function assetTotals(nodes: NodeInfo[], rates: Record<string, number>) {
  let monthly = 0,
    yearly = 0,
    value = 0,
    unknown = 0,
    paid = 0;
  for (const node of nodes) {
    if (node.price <= 0 || node.billingDays <= 0) continue;
    const rate = currencyRate(rates, node.currency);
    if (!rate) {
      unknown++;
      continue;
    }
    paid++;
    value += node.price * rate;
    monthly += (node.price * rate * 30) / node.billingDays;
    yearly += (node.price * rate * 365) / node.billingDays;
  }
  return { value, monthly, yearly, unknown, paid };
}
export function policy(viewer: Viewer, settings: ThemeSettings) {
  return {
    privateDetails: viewer.logged_in,
    write: viewer.logged_in,
    mask: !viewer.logged_in && settings.visitorMask,
    keyboard: !viewer.logged_in && settings.visitorKeyboard,
  };
}
export const safeMediaUrl = validatedMediaUrl;
export function level(status: NodeStatus | undefined) {
  const xp = status?.online ? Math.max(0, (status.uptime ?? 0) / 86400) : 0;
  const thresholds = [0, 7, 30, 90, 180, 365];
  let index = 0;
  for (let i = 0; i < thresholds.length; i++)
    if (xp >= thresholds[i]) index = i;
  return {
    level: index + 1,
    progress: Math.min(
      100,
      ((xp - thresholds[index]) /
        (thresholds[index + 1] - thresholds[index] || 1000)) *
        100,
    ),
  };
}
export function mood(node: NodeInfo, status: NodeStatus | undefined) {
  if (!status) return "…";
  if (!status.online) return "💀";
  const cpu = status.cpu ?? 0,
    ram = percent(status.memory, node.memory) ?? 0;
  if (cpu >= 80 || ram >= 90) return "🥵";
  if (cpu >= 10 || ram >= 40) return "😊";
  if (cpu < 5 && ram < 15) return "😴";
  return "😌";
}
export function selectedPing(status: NodeStatus | undefined) {
  const p =
    status?.ping.filter((p) => p.average !== null && p.average >= 0) ?? [];
  return p.length
    ? {
        latency: p.reduce((a, b) => a + (b.average ?? 0), 0) / p.length,
        loss: p.reduce((a, b) => a + (b.loss ?? 0), 0) / p.length,
      }
    : { latency: null, loss: null };
}

export function isLongTerm(node: NodeInfo, now = Date.now()) {
  if (!node.expires) return false;
  const end = Date.parse(node.expires),
    cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() + 10);
  return Number.isFinite(end) && end > cutoff.getTime();
}
export function expiryText(node: NodeInfo, now = Date.now()) {
  const d = daysLeft(node, now);
  return isLongTerm(node, now)
    ? "长期"
    : d === null
      ? "--"
      : d < 0
        ? "已过期"
        : `${d}天`;
}
