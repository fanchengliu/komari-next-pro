import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Calendar as CalendarDays,
  ArrowUp,
  ArrowDown,
  Clock,
  ChartPie,
  Cloud,
  Activity,
  Wifi,
  Settings,
} from "lucide-react";
import type { TFunction } from "i18next";

import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData, Record } from "../types/LiveData";
import { getOSImage, getOSName } from "@/utils";
import { formatBytes } from "@/utils/unitHelper";

import Flag from "./Flag";
import { usePingBlocks } from "@/hooks/usePingBlocks";

// ── Helpers ──

export function formatUptime(seconds: number, t: TFunction): string {
  if (!seconds || seconds < 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}${t("nodeCard.time_day", { defaultValue: 'd' })}`;
  if (h > 0) return `${h}${t("nodeCard.time_hour", { defaultValue: 'h' })} ${m}${t("nodeCard.time_minute", { defaultValue: 'm' })}`;
  return `${m}${t("nodeCard.time_minute", { defaultValue: 'm' })}`;
}

function formatBytesInt(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B','KB','MB','GB','TB','PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const v = bytes / Math.pow(k, i);
  return `${Math.round(v)} ${sizes[i]}`;
}

function formatSpeed(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(i >= 2 ? 2 : 1)) + " " + sizes[i];
}

function getExpiryDays(expiredAt: string | undefined): number | null {
  if (!expiredAt) return null;
  const exp = new Date(expiredAt);
  if (isNaN(exp.getTime())) return null;
  return Math.ceil((exp.getTime() - Date.now()) / 86400000);
}

function formatExpiry(expiredAt: string | undefined): string {
  const diffDays = getExpiryDays(expiredAt);
  if (diffDays == null) return "--";
  if (diffDays < 0) return 'expired';
  return `${diffDays}天`;
}

function getExpiryClass(expiredAt: string | undefined): string {
  const days = getExpiryDays(expiredAt);
  if (days == null) return "";
  if (days < 3) return "ds-exp-red";
  if (days <= 10) return "ds-exp-yellow";
  return "";
}

function ell(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + "..." : s || "";
}

function formatLatencyMs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "--";
  return `${Math.round(value)} ms`;
}

function formatPacketLoss(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "--";
  return `${value.toFixed(1)}%`;
}

function pingBlockClass(latency: number, loss: boolean, empty: boolean, mode: "latency" | "loss") {
  if (empty) return "ds-pb ds-pb-none";
  if (mode === "loss") return `ds-pb ${loss ? "ds-pb-bad" : "ds-pb-good"}`;
  if (loss || latency < 0) return "ds-pb ds-pb-bad";
  if (latency >= 200) return "ds-pb ds-pb-bad";
  if (latency >= 100) return "ds-pb ds-pb-warn";
  return "ds-pb ds-pb-good";
}

function PingBlocksStrip({
  blocks,
  mode,
}: {
  blocks: { latency: number; time: string; loss: boolean }[];
  mode: "latency" | "loss";
}) {
  return (
    <div className="ds-pblocks" aria-label={mode === "latency" ? "latency samples" : "packet loss samples"}>
      {blocks.map((b, i) => {
        const empty = !b.time;
        const title = empty
          ? "no data"
          : mode === "loss"
            ? (b.loss ? "loss" : "ok")
            : (b.loss || b.latency < 0 ? "loss" : `${b.latency.toFixed(1)} ms`);
        return <span key={`${b.time || "empty"}-${i}`} className={pingBlockClass(b.latency, b.loss, empty, mode)} title={title} />;
      })}
    </div>
  );
}


function getDtOsSlug(os: string): string | null {
  const s = String(os || "").toLowerCase();
  const map: { slug: string; keywords: string[] }[] = [
    { slug: 'ubuntu', keywords: ['ubuntu'] },
    { slug: 'debian', keywords: ['debian'] },
    { slug: 'redhat', keywords: ['red hat','redhat','rhel'] },
    { slug: 'centos', keywords: ['centos'] },
    { slug: 'fedora', keywords: ['fedora'] },
    { slug: 'opensuse', keywords: ['opensuse','suse'] },
    { slug: 'archlinux', keywords: ['arch linux','arch'] },
    { slug: 'alpinelinux', keywords: ['alpine linux','alpine'] },
    { slug: 'rockylinux', keywords: ['rocky linux','rocky'] },
    { slug: 'almalinux', keywords: ['alma linux','alma'] },
    { slug: 'linuxmint', keywords: ['linux mint','mint'] },
    { slug: 'freebsd', keywords: ['freebsd'] },
    { slug: 'openbsd', keywords: ['openbsd'] },
    { slug: 'windows', keywords: ['windows server','windows'] },
    { slug: 'apple', keywords: ['darwin','macos','mac','osx','apple'] },
    { slug: 'android', keywords: ['android'] },
    { slug: 'docker', keywords: ['docker'] },
    { slug: 'linux', keywords: ['linux'] },
  ];
  for (const item of map) {
    if (item.keywords.some(k => s.includes(k))) return item.slug;
  }
  return null;
}

function getDtOsIconUrl(os: string): string | null {
  const slug = getDtOsSlug(os);
  if (!slug) return null;
  return `/img/os-logos/streamline/${slug}.svg`;
}

// ── Progress Bar ──
function Bar({ value, cls }: { value: number; cls: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="ds-track">
      <div className={`ds-fill ${cls}`} style={{ width: `${v}%` }} />
    </div>
  );
}

// ── Metric Row ──
function MetricRow({
  icon,
  label,
  value,
  barCls,
  barValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  barCls?: string;
  barValue?: number;
}) {
  return (
    <div className="ds-mr">
      <div className="ds-mr-top">
        <span className="ds-mr-icon">{icon}</span>
        <span className="ds-mr-label">{label}</span>
        <span className="ds-mr-val">{value}</span>
      </div>
      {barCls != null && barValue != null && <Bar value={barValue} cls={barCls} />}
    </div>
  );
}

// ── Footer item ──
function FootItem({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className="ds-fi">
      <span className="ds-fi-icon">{icon}</span>
      <span className="ds-fi-label">{label}</span>
      <span className={`ds-fi-val ${className}`}>{value}</span>
    </div>
  );
}

// ── Node Card ──
interface NodeProps {
  basic: NodeBasicInfo;
  live: Record | undefined;
  online: boolean;
}

type NodeCardVisibility = {
  cpu: boolean; memory: boolean; disk: boolean; monthlyTraffic: boolean;
  latency: boolean; packetLoss: boolean;
  downloadSpeed: boolean; uploadSpeed: boolean; downloadTotal: boolean; uploadTotal: boolean;
  expire: boolean; uptime: boolean; ipBadges: boolean; osIcon: boolean; regionFlag: boolean;
};
const DEFAULT_NODE_CARD_VISIBILITY: NodeCardVisibility = {
  cpu: true, memory: true, disk: true, monthlyTraffic: true,
  latency: true, packetLoss: true,
  downloadSpeed: true, uploadSpeed: true, downloadTotal: true, uploadTotal: true,
  expire: true, uptime: true, ipBadges: true, osIcon: true, regionFlag: true,
};
const VISIBILITY_FIELDS: { key: keyof NodeCardVisibility; label: string }[] = [
  {key:'cpu', label:'CPU'}, {key:'memory', label:'内存'}, {key:'disk', label:'磁盘'}, {key:'monthlyTraffic', label:'月度流量'},
  {key:'latency', label:'延迟'}, {key:'packetLoss', label:'丢包'},
  {key:'downloadSpeed', label:'下载速度'}, {key:'uploadSpeed', label:'上传速度'}, {key:'downloadTotal', label:'下载流量'}, {key:'uploadTotal', label:'上传流量'},
  {key:'expire', label:'到期'}, {key:'uptime', label:'运行时间'}, {key:'ipBadges', label:'IPv4/IPv6'}, {key:'osIcon', label:'系统图标'}, {key:'regionFlag', label:'地区旗帜'},
];

const Node = ({ basic, live, online }: NodeProps) => {
  const [t] = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeProConfig, setThemeProConfig] = useState<any>(null);
  const [draftVisibility, setDraftVisibility] = useState<NodeCardVisibility>(DEFAULT_NODE_CARD_VISIBILITY);
  const [publicCap, setPublicCap] = useState<{ hasIPv4?: boolean; hasIPv6?: boolean } | null>(null);
  const pingBlocks = usePingBlocks(basic.uuid);
  useEffect(() => { fetch("/api/me").then(r => r.ok ? r.json() : null).then(me => setIsLoggedIn(!!me?.logged_in)).catch(() => setIsLoggedIn(false)); }, []);
  useEffect(() => {
    if (settingsOpen) document.body.classList.add('ds-card-settings-open');
    else document.body.classList.remove('ds-card-settings-open');
    return () => document.body.classList.remove('ds-card-settings-open');
  }, [settingsOpen]);
  useEffect(() => { if (isLoggedIn || !basic.uuid) return; fetch(`/unlock-probe/unlock/capability-public?uuid=${encodeURIComponent(basic.uuid)}`).then(r => r.ok ? r.json() : null).then(j => j?.ok && setPublicCap({ hasIPv4: !!j.hasIPv4, hasIPv6: !!j.hasIPv6 })).catch(() => {}); }, [isLoggedIn, basic.uuid]);
  useEffect(() => { fetch('/unlock-probe/theme-config', { credentials:'include' }).then(r => r.ok ? r.json() : null).then(j => { if(j?.ok){ setThemeProConfig(j.config); setDraftVisibility({ ...DEFAULT_NODE_CARD_VISIBILITY, ...(j.config?.nodeCardVisibilityByUuid?.[basic.uuid] || {}) }); } }).catch(()=>{}); }, [basic.uuid]);
  const visibility: NodeCardVisibility = { ...DEFAULT_NODE_CARD_VISIBILITY, ...(themeProConfig?.nodeCardVisibilityByUuid?.[basic.uuid] || {}) };
  const saveCardVisibility = async () => { const next = { ...(themeProConfig || { nodeCardVisibilityByUuid: {} }) }; next.nodeCardVisibilityByUuid = { ...(next.nodeCardVisibilityByUuid || {}), [basic.uuid]: draftVisibility }; const resp = await fetch('/unlock-probe/theme-config', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(next) }); const json = await resp.json(); if(json?.ok){ setThemeProConfig(json.config); setSettingsOpen(false); } };
  const resetCardVisibility = async () => { const next = { ...(themeProConfig || { nodeCardVisibilityByUuid: {} }) }; next.nodeCardVisibilityByUuid = { ...(next.nodeCardVisibilityByUuid || {}) }; delete next.nodeCardVisibilityByUuid[basic.uuid]; const resp = await fetch('/unlock-probe/theme-config', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(next) }); const json = await resp.json(); if(json?.ok){ setThemeProConfig(json.config); setDraftVisibility(DEFAULT_NODE_CARD_VISIBILITY); setSettingsOpen(false); } };
  const cpuUsage = live?.cpu?.usage ?? 0;
  const memUsed = live?.ram?.used ?? 0;
  const memTotal = basic.mem_total ?? 1;
  const memPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
  const diskUsed = live?.disk?.used ?? 0;
  const diskTotal = basic.disk_total ?? 1;
  const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  const totalUp = live?.network?.totalUp ?? 0;
  const totalDown = live?.network?.totalDown ?? 0;
  const trafficLimitType = basic.traffic_limit_type ?? "sum";
  const trafficUsed =
    trafficLimitType === "up" ? totalUp :
    trafficLimitType === "down" ? totalDown :
    trafficLimitType === "max" ? Math.max(totalUp, totalDown) :
    trafficLimitType === "min" ? Math.min(totalUp, totalDown) :
    totalUp + totalDown;
  const monthlyPct = basic.traffic_limit > 0 ? (trafficUsed / basic.traffic_limit) * 100 : 0;

  const netUp = live?.network?.up ?? 0;
  const netDown = live?.network?.down ?? 0;
  const uptime = live?.uptime ?? 0;
  const recentPingBlocks = pingBlocks.blocks.slice(-10);
  const recentLatencyValues = recentPingBlocks
    .filter((b) => b.time && !b.loss && b.latency >= 0)
    .map((b) => b.latency);
  const recentLatencyAvg = recentLatencyValues.length
    ? recentLatencyValues.reduce((sum, value) => sum + value, 0) / recentLatencyValues.length
    : 0;

  const osName = getOSName(basic.os);
  const osImage = getOSImage(basic.os);
  const subText = useMemo(() => {
    const p: string[] = [];
    if (osName) p.push(osName);
    if (basic.arch) p.push(basic.arch);
    if (basic.cpu_cores > 0) p.push(`${basic.cpu_cores}${t('nodeCard.cpu_cores_suffix', { defaultValue: '核' })}`);
    return p.join(" · ");
  }, [osName, basic.arch, basic.cpu_cores]);

  return (
    <div className={`ds-card2 ${!online ? "ds-card2-off" : ""}`}>
      {!online && (
        <div className="ds-off-mask">
          <span className="ds-off-pill">⏻ {t("nodeCard.offline", "离线")}</span>
        </div>
      )}

      {/* ─ Header ─ */}
      <div className="ds-hdr2">
        <div className="ds-hdr2-left">
          {visibility.regionFlag ? <span className="ds-hdr-flag"><Flag flag={basic.region} /></span> : null}
          <Link href={`/instance/${basic.uuid}`} className="ds-hdr-name" title={basic.name}>
            {ell(basic.name, 16)}
          </Link>
          
        </div>
        <div className="ds-hdr2-right">
          {visibility.osIcon && getDtOsIconUrl(basic.os) && (
            <img className="ds-hdr-os2" src={getDtOsIconUrl(basic.os)!} alt={basic.os} />
          )}
          {visibility.ipBadges && (isLoggedIn ? basic.ipv4 : publicCap?.hasIPv4) && <span className="ds-hdr-badge">IPv4</span>}
          {visibility.ipBadges && (isLoggedIn ? basic.ipv6 : publicCap?.hasIPv6) && <span className="ds-hdr-badge">IPv6</span>}
          {isLoggedIn ? (
            <button
              type="button"
              className="ds-card-settings-btn"
              title="卡片显示设置"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDraftVisibility(visibility); setSettingsOpen(true); }}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          ) : null}
          <span className={`ds-hdr-dot ${online ? "on" : "off"}`} />
        </div>
      </div>
      {settingsOpen ? (
        <div className="ds-card-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="ds-card-settings-panel" onClick={(e)=>e.stopPropagation()}>
            <div className="ds-card-settings-title">{basic.name} 显示设置</div>
            <div className="ds-card-settings-grid">
              {VISIBILITY_FIELDS.map((f) => (
                <label key={f.key} className="ds-card-settings-option">
                  <input type="checkbox" checked={draftVisibility[f.key]} onChange={(e)=>setDraftVisibility(v=>({...v,[f.key]:e.target.checked}))} />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
            <div className="ds-card-settings-actions">
              <button type="button" onClick={resetCardVisibility}>默认</button>
              <button type="button" onClick={()=>setSettingsOpen(false)}>取消</button>
              <button type="button" className="primary" onClick={saveCardVisibility}>保存</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─ Two-column body ─ */}
      <div className="ds-body">
        {/* LEFT COLUMN */}
        <div className="ds-col">
          {visibility.cpu ? <MetricRow icon={<Cpu className="w-3.5 h-3.5" />} label="CPU" value={`${cpuUsage.toFixed(1)}%`} barCls="ds-fill-cpu" barValue={cpuUsage} /> : null}
          {visibility.disk ? <MetricRow icon={<HardDrive className="w-3.5 h-3.5" />} label={t("nodeCard.disk", "磁盘")} value={`${diskPct.toFixed(1)}%`} barCls="ds-fill-disk" barValue={diskPct} /> : null}

          {/* Download speed */}
          {visibility.downloadSpeed ? <div className="ds-sr">
            <ArrowDown className="w-3.5 h-3.5 ds-c-blue" />
            <span className="ds-sr-label">{t("nodeCard.download", "下载")}</span>
            <span className="ds-sr-val">{formatSpeed(netDown)}</span>
          </div> : null}

          {/* Download total */}
          {visibility.downloadTotal ? <div className="ds-sr">
            <Cloud className="w-3.5 h-3.5 ds-c-muted" />
            <span className="ds-sr-label">{t("nodeCard.downloadTotal", "下载流量")}</span>
            <span className="ds-sr-val">{formatBytes(totalDown)}</span>
          </div> : null}

          {/* Latency blocks */}
          {visibility.latency ? <div className="ds-ping-mini">
            <div className="ds-sr">
              <Activity className="w-3.5 h-3.5 ds-c-blue" />
              <span className="ds-sr-label">{t("nodeCard.latency", { defaultValue: "延迟" })}</span>
              <span className="ds-sr-val">{pingBlocks.hasData ? formatLatencyMs(recentLatencyAvg) : "--"}</span>
            </div>
            <PingBlocksStrip blocks={recentPingBlocks} mode="latency" />
          </div> : null}

          {/* Expiry */}
          {visibility.expire ? <FootItem icon={<CalendarDays className="w-3.5 h-3.5" />} label={t("nodeCard.expire", "到期")} className={getExpiryClass(basic.expired_at)} value={formatExpiry(basic.expired_at) === 'expired' ? t('nodeCard.expired', { defaultValue: '已过期' }) : formatExpiry(basic.expired_at)} /> : null}
        </div>

        {/* RIGHT COLUMN */}
        <div className="ds-col">
          {visibility.memory ? <MetricRow icon={<MemoryStick className="w-3.5 h-3.5" />} label={t("nodeCard.memory", "内存")} value={`${memPct.toFixed(1)}%`} barCls="ds-fill-mem" barValue={memPct} /> : null}
          {visibility.monthlyTraffic ? <MetricRow
            icon={<ChartPie className="w-3.5 h-3.5" />}
            label={t("nodeCard.monthly", "月度")}
            value={basic.traffic_limit > 0 ? `${formatBytesInt(trafficUsed)}/${formatBytesInt(basic.traffic_limit)}` : "--"}
            barCls="ds-fill-monthly"
            barValue={monthlyPct}
          /> : null}

          {/* Upload speed */}
          {visibility.uploadSpeed ? <div className="ds-sr">
            <ArrowUp className="w-3.5 h-3.5 ds-c-green" />
            <span className="ds-sr-label">{t("nodeCard.upload", "上传")}</span>
            <span className="ds-sr-val">{formatSpeed(netUp)}</span>
          </div> : null}

          {/* Upload total */}
          {visibility.uploadTotal ? <div className="ds-sr">
            <Cloud className="w-3.5 h-3.5 ds-c-muted" />
            <span className="ds-sr-label">{t("nodeCard.uploadTotal", "上传流量")}</span>
            <span className="ds-sr-val">{formatBytes(totalUp)}</span>
          </div> : null}

          {/* Packet loss blocks */}
          {visibility.packetLoss ? <div className="ds-ping-mini">
            <div className="ds-sr">
              <Wifi className="w-3.5 h-3.5 ds-c-muted" />
              <span className="ds-sr-label">{t("chart.lossRate", { defaultValue: "丢包" })}</span>
              <span className="ds-sr-val">{pingBlocks.hasData ? formatPacketLoss(pingBlocks.avgLoss) : "--"}</span>
            </div>
            <PingBlocksStrip blocks={recentPingBlocks} mode="loss" />
          </div> : null}

          {/* Uptime */}
          {visibility.uptime ? <FootItem icon={<Clock className="w-3.5 h-3.5" />} label={t("nodeCard.uptime", "运行时间")} value={formatUptime(uptime, t)} /> : null}
        </div>
      </div>
    </div>
  );
};

export default Node;

// ── NodeGrid ──
type NodeGridProps = { nodes: NodeBasicInfo[]; liveData: LiveData };
export const NodeGrid = ({ nodes, liveData }: NodeGridProps) => {
  const onlineNodes = liveData?.online ?? [];
  const sorted = [...nodes].sort((a, b) => {
    const aOn = onlineNodes.includes(a.uuid);
    const bOn = onlineNodes.includes(b.uuid);
    if (aOn !== bOn) return aOn ? -1 : 1;
    return a.weight - b.weight;
  });
  return (
    <div className="ds-card-grid">
      {sorted.map((n) => (
        <Node key={n.uuid} basic={n} live={liveData?.data?.[n.uuid]} online={onlineNodes.includes(n.uuid)} />
      ))}
    </div>
  );
};