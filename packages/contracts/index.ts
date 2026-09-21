import { z } from "zod";
export const VERSION = "3.0.1";
export const locales = ["zh-CN", "zh-TW", "en", "ja", "ko"] as const;
export type Locale = (typeof locales)[number];
export const API = "/komari-ds-api/v1";
export type QuotaMode = "sum" | "max" | "min" | "up" | "down";
export interface NodeInfo {
  id: string;
  name: string;
  group: string;
  region: string;
  os: string;
  cpuName: string;
  cores: number;
  arch: string;
  virtualization?: string;
  memory: number;
  swap: number;
  disk: number;
  weight: number;
  price: number;
  currency: string;
  billingDays: number;
  expires: string | null;
  created: string;
  hidden: boolean;
  quota: number;
  quotaMode: QuotaMode;
  ipv4?: string;
  ipv6?: string;
}
export interface PingSummary {
  id: string;
  name: string;
  latest: number | null;
  average: number | null;
  loss: number | null;
  tail: number | null;
}
export interface NodeStatus {
  id: string;
  at: number;
  online: boolean;
  cpu: number | null;
  memory: number | null;
  swap: number | null;
  disk: number | null;
  downRate: number | null;
  upRate: number | null;
  downTotal: number | null;
  upTotal: number | null;
  uptime: number | null;
  load: number | null;
  processes: number | null;
  tcp: number | null;
  udp: number | null;
  ping: PingSummary[];
}
export interface Viewer {
  logged_in: boolean;
  username: string;
  uuid?: string;
}
export interface PublicInfo {
  sitename: string;
  description?: string;
  theme: string;
  theme_settings: Record<string, unknown>;
  private_site?: boolean;
  disable_password_login?: boolean;
  oauth_enable?: boolean;
  ping_record_preserve_time?: number;
}
export interface MetricPoint {
  time: string;
  value: number | null;
  count?: number;
  tags?: Record<string, string>;
  tag?: Record<string, string>;
}
export interface MetricSeries {
  metric_key: string;
  entity_id: string;
  unit?: string;
  points: MetricPoint[];
  interval_seconds?: number;
  downsampled?: boolean;
  downsample_algorithm?: string;
  tags?: Record<string, string>;
  tag?: Record<string, string>;
}
export interface MetricResponse {
  series: MetricSeries[];
  start: string;
  end: string;
}
export type TrafficRange = "today" | "yesterday" | "7d" | "30d";
export interface TrafficItem {
  id: string;
  name: string;
  up: number | null;
  down: number | null;
  quota: number;
  quotaMode: QuotaMode;
  precision: "native" | "estimated" | "unavailable";
  notes: string[];
}
export interface TrafficReport {
  range: TrafficRange;
  start: string;
  end: string;
  timezone: string;
  items: TrafficItem[];
}
export function validatedMediaUrl(value: string): string | undefined {
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {}
  return undefined;
}
export const mediaItemSchema = z.object({
  id: z.string().max(128),
  url: z
    .string()
    .max(2048)
    .refine(
      (v) => validatedMediaUrl(v) !== undefined,
      "仅支持 HTTP(S) 或站内路径",
    ),
  kind: z.enum(["image", "video"]),
  name: z.string().max(160).default(""),
  duration: z.number().min(2).max(3600).default(10),
});
export const playlistSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["image", "video", "none"]),
  order: z.enum(["rotation", "random", "hold"]),
  selectedId: z.string().max(128).optional(),
  videoTiming: z.enum(["full", "fixed"]),
  interval: z.number().int().min(2).max(3600),
  items: z.array(mediaItemSchema).max(100),
});
export type MediaItem = z.infer<typeof mediaItemSchema>;
export type Playlist = z.infer<typeof playlistSchema>;
export const emptyPlaylist: Playlist = {
  version: 1,
  mode: "video",
  order: "rotation",
  videoTiming: "full",
  interval: 10,
  items: [],
};
export const settingsSchema = z.object({
  version: z.literal(2).default(2),
  accent: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#3b82f6"),
  uploadColor: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#f59e0b"),
  downloadColor: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .default("#3b82f6"),
  appearance: z.enum(["light", "dark", "system"]).default("light"),
  cardOpacity: z.number().int().min(0).max(100).nullable().default(null),
  ipQualityView: z.enum(["reference", "provider"]).default("reference"),
  locale: z.enum(locales).default("zh-CN"),
  timezone: z
    .string()
    .max(80)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "无效时区")
    .default("Asia/Shanghai"),
  logo: z
    .string()
    .max(2048)
    .refine((v) => !v || validatedMediaUrl(v) !== undefined)
    .default(""),
  background: z
    .string()
    .max(2048)
    .refine((v) => !v || validatedMediaUrl(v) !== undefined)
    .default(""),
  backgroundSource: z.enum(["playlist", "single", "none"]).default("playlist"),
  backgroundKind: z.enum(["image", "video"]).default("video"),
  setupCompleted: z.boolean().default(false),
  presetId: z.string().max(40).default("custom"),
  entrance: z.boolean().default(false),
  mood: z.boolean().default(true),
  level: z.boolean().default(true),
  cards: z
    .array(z.enum(["clock", "online", "regions", "traffic", "speed", "assets"]))
    .default(["clock", "online", "regions", "traffic", "speed", "assets"]),
  fields: z
    .array(
      z.enum([
        "cpu",
        "memory",
        "disk",
        "monthly",
        "rates",
        "totals",
        "ping",
        "expiry",
      ]),
    )
    .default([
      "cpu",
      "memory",
      "disk",
      "monthly",
      "rates",
      "totals",
      "ping",
      "expiry",
    ]),
  visitorMask: z.boolean().default(true),
  visitorKeyboard: z.boolean().default(true),
  desktopLayout: z.enum(["daily", "compact"]).default("daily"),
  mobileLayout: z.enum(["daily", "compact", "mobile"]).default("daily"),
  pingMode: z.enum(["auto", "all", "custom"]).default("auto"),
  pingHistoryHours: z.number().min(0.25).max(24).default(1),
  pingTaskIds: z.array(z.string().min(1).max(128)).max(64).default([]),
  globeEnabled: z.boolean().default(true),
  globeAutoRotate: z.boolean().default(true),
  exchangeRates: z
    .record(z.string(), z.number().positive())
    .default({ "¥": 1, CNY: 1, $: 7.2, USD: 7.2, "€": 7.8, EUR: 7.8 }),
});
export type ThemeSettings = z.infer<typeof settingsSchema>;
export const defaultSettings = settingsSchema.parse({});
/** v1 -> v2 is additive; invalid fields do not erase unrelated, valid preferences. */
export function resolveThemeSettings(
  source: unknown,
  preferences: unknown = {},
  assetDefaults: Partial<ThemeSettings> = {},
): ThemeSettings {
  const merge = { ...defaultSettings, ...assetDefaults };
  for (const input of [source, preferences]) {
    if (!input || typeof input !== "object" || Array.isArray(input)) continue;
    for (const [key, schema] of Object.entries(settingsSchema.shape)) {
      if (key === "version" || !Object.hasOwn(input, key)) continue;
      const value = (input as Record<string, unknown>)[key];
      const parsed = schema.safeParse(value);
      if (parsed.success) (merge as Record<string, unknown>)[key] = parsed.data;
    }
  }
  return { ...merge, version: 2 };
}
export type JobKind = "ip" | "unlock" | "services";
export interface Job {
  id: string;
  nodeId: string;
  kind: JobKind;
  state: "queued" | "running" | "done" | "partial" | "failed";
  createdAt: string;
  updatedAt: string;
  result?: unknown;
  error?: string;
}
export interface ExtensionCapabilities {
  version: string;
  media: boolean;
  transcode?: boolean;
  remoteImport?: boolean;
  ip: boolean;
  unlock: boolean;
  services: boolean;
  traffic: boolean;
  exchangeRates?: boolean;
}
