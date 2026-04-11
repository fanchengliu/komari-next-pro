"use client";

import { Globe, MapPinned, Copy, Radar, Building2, Sparkles, Wifi } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import StreamingUnlockPanel from "./StreamingUnlockPanel";

type IpMetaRecord = {
  ip: string;
  family: "ipv4" | "ipv6" | string;
  masked: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  org?: string;
  asn?: string;
  company?: string;
  network_type?: string;
  timezone?: string;
  risk_score?: number;
  pollution_score?: number;
  confidence_score?: number;
  quality_summary?: string;
  source?: string;
  fetched_at?: string;
  expires_at?: string;
  cached?: boolean;
  error?: string;
};

type IpMetaResponse = {
  ok: boolean;
  target?: string;
  records?: IpMetaRecord[];
  warning?: string;
  error?: string;
};

const API_BASE = "/ip-meta";

function maskIp(ip?: string) {
  const value = String(ip || "").trim();
  if (!value) return "***";
  if (value.includes(".")) {
    const parts = value.split(".");
    if (parts.length === 4) return `***.***.${parts[2] || "*"}.${parts[3] || "*"}`;
  }
  if (value.includes(":")) {
    const parts = value.split(":");
    if (parts.length >= 2) {
      const tail = parts.slice(-2).join(":") || "*:*";
      return `****:****:****:${tail}`;
    }
  }
  return "***";
}

function looksMasked(ip?: string) {
  const value = String(ip || "").trim();
  return !value || value.includes("*");
}

function scoreTone(score?: number) {
  const n = Number(score ?? NaN);
  if (!Number.isFinite(n)) return "neutral";
  if (n >= 70) return "good";
  if (n >= 35) return "warn";
  return "bad";
}

function useIpMeta(node?: NodeBasicInfo) {
  const [data, setData] = useState<IpMetaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ips = [node?.ipv4, node?.ipv6].filter(Boolean) as string[];
    if (!ips.length) {
      setData(null);
      return;
    }
    if (ips.every(looksMasked)) {
      setData({ ok: true, records: ips.map((ip) => ({ ip, family: ip.includes(':') ? 'ipv6' : 'ipv4', masked: maskIp(ip), cached: false })) });
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/ip-meta?ips=${encodeURIComponent(ips.join(","))}`, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
        return json as IpMetaResponse;
      })
      .then((json) => setData(json))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err?.message || "获取 IP 信息失败");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [node?.ipv4, node?.ipv6]);

  return { data, loading, error };
}

function useLoginState() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/client/list', { credentials: 'include' })
      .then((res) => {
        if (cancelled) return;
        setIsLoggedIn(res.ok);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoggedIn(false);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => { cancelled = true; };
  }, []);

  return { isLoggedIn, checked };
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="ds-ip-detail-row">
      <span>{label}</span>
      <strong>{value === undefined || value === null || value === "" ? "--" : String(value)}</strong>
    </div>
  );
}

function OverviewCard({ label, value, icon: Icon, onCopy, hint }: { label: string; value?: string; icon: any; onCopy?: () => void; hint?: string; }) {
  return (
    <div className="ds-ip-card ds-ip-overview-card">
      <div className="ds-ip-card-topline">
        <div className="ds-ip-card-icon"><Icon size={18} /></div>
        <div className="ds-ip-card-label">{label}</div>
      </div>
      <div className="ds-ip-card-value">{value || "--"}</div>
      {hint ? <div className="ds-ip-card-sub">{hint}</div> : null}
      {onCopy && value && value !== "***" ? (
        <button className="ds-ip-copy" onClick={onCopy} title="复制">
          <Copy size={14} />
        </button>
      ) : null}
    </div>
  );
}

function ScoreCard({ label, value, tone, percent }: { label: string; value?: number; tone: string; percent?: number }) {
  const pct = Math.max(0, Math.min(100, Number(percent ?? value ?? 0)));
  return (
    <div className={`ds-score-row ds-score-${tone}`}>
      <div className="ds-score-row-head">
        <span className="ds-score-row-label">{label}</span>
        <strong className="ds-score-row-value">{value ?? '--'}</strong>
      </div>
      <div className="ds-score-bar ds-score-bar-lg">
        <div className={`ds-score-bar-fill ds-score-bar-fill-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function IpInfoSkeleton() {
  return (
    <div className="ds-ip-page ds-ip-page-nsq ds-ip-skeleton-page">
      <div className="ds-ip-hero-grid ds-ip-hero-grid-2">
        <div className="ds-ip-card ds-ip-overview-card ds-skeleton-card"><div className="ds-skeleton ds-skeleton-line w-24" /><div className="ds-skeleton ds-skeleton-block h-10 mt-4" /></div>
        <div className="ds-ip-card ds-ip-overview-card ds-skeleton-card"><div className="ds-skeleton ds-skeleton-line w-24" /><div className="ds-skeleton ds-skeleton-block h-10 mt-4" /></div>
      </div>
      <div className="ds-ip-top-shell">
        <div className="ds-ip-top-grid">
          <div className="ds-ip-detail-card ds-ip-panel-main ds-skeleton-card">
            <div className="ds-skeleton ds-skeleton-line w-24 mb-4" />
            <div className="ds-ip-skeleton-grid">
              <div className="ds-skeleton ds-skeleton-row" /><div className="ds-skeleton ds-skeleton-row" />
              <div className="ds-skeleton ds-skeleton-row" /><div className="ds-skeleton ds-skeleton-row" />
              <div className="ds-skeleton ds-skeleton-row" /><div className="ds-skeleton ds-skeleton-row" />
            </div>
          </div>
          <div className="ds-ip-top-side">
            <div className="ds-ip-detail-card ds-ip-score-card ds-skeleton-card">
              <div className="ds-skeleton ds-skeleton-line w-24 mb-4" />
              <div className="ds-skeleton ds-skeleton-row" /><div className="ds-skeleton ds-skeleton-row mt-3" /><div className="ds-skeleton ds-skeleton-row mt-3" />
            </div>
            <div className="ds-ip-detail-card ds-ip-side-card ds-skeleton-card">
              <div className="ds-skeleton ds-skeleton-line w-24 mb-4" />
              <div className="ds-skeleton ds-skeleton-row" /><div className="ds-skeleton ds-skeleton-row mt-3" /><div className="ds-skeleton ds-skeleton-row mt-3" />
            </div>
          </div>
        </div>
      </div>
      <div className="ds-ip-detail-card ds-skeleton-card">
        <div className="ds-skeleton ds-skeleton-line w-24 mb-4" />
        <div className="ds-ip-skeleton-grid">
          <div className="ds-skeleton ds-skeleton-row" /><div className="ds-skeleton ds-skeleton-row" />
          <div className="ds-skeleton ds-skeleton-row" /><div className="ds-skeleton ds-skeleton-row" />
        </div>
      </div>
    </div>
  );
}

export default function IpInfoPanel({ node, isOnline = true }: { node?: NodeBasicInfo; isOnline?: boolean }) {
  const { data, loading, error } = useIpMeta(node);
  const { isLoggedIn, checked } = useLoginState();

  const records: IpMetaRecord[] = useMemo(() => {
    if (data?.records?.length) return data.records;
    return [node?.ipv4, node?.ipv6].filter(Boolean).map((ip) => ({
      ip: ip!,
      family: ip!.includes(":") ? "ipv6" : "ipv4",
      masked: maskIp(ip),
      region: node?.region,
    }));
  }, [data, node]);

  const ipv4 = records.find((r) => r.family === "ipv4");
  const ipv6 = records.find((r) => r.family === "ipv6");
  const main = ipv4 || ipv6 || records[0];

  const ready = checked && (!loading || !!data || !!error);

  const copyText = async (text?: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  if (!ready) return <IpInfoSkeleton />;

  return (
    <div className="ds-ip-page ds-ip-page-nsq">
      <div className="ds-ip-hero-grid ds-ip-hero-grid-2">
        <OverviewCard
          label="IPv4 地址"
          value={isLoggedIn ? (ipv4?.ip || node?.ipv4 || '--') : (ipv4?.masked || maskIp(node?.ipv4))}
          icon={Globe}
          onCopy={isLoggedIn && node?.ipv4 ? () => copyText(node.ipv4) : undefined}
          hint={!isLoggedIn && looksMasked(node?.ipv4) ? "掩码显示" : undefined}
        />
        <OverviewCard
          label="IPv6 地址"
          value={isLoggedIn ? (ipv6?.ip || node?.ipv6 || '--') : (ipv6?.masked || maskIp(node?.ipv6))}
          icon={MapPinned}
          onCopy={isLoggedIn && node?.ipv6 ? () => copyText(node.ipv6) : undefined}
          hint={!isLoggedIn && looksMasked(node?.ipv6) ? "掩码显示" : undefined}
        />
      </div>

      {error ? <div className="ds-ip-notice ds-ip-notice-warn">接口请求失败：{error}</div> : null}

      <div className="ds-ip-top-shell">
        <div className="ds-ip-top-grid">
          <div className="ds-ip-detail-card ds-ip-panel-main">
            <div className="ds-ip-score-head"><Wifi size={16} /> 基础信息</div>
            <div className="ds-ip-detail-grid ds-ip-detail-grid-2col">
              <InfoRow label="国家 / 地区" value={main?.country || main?.region || node?.region || '--'} />
              <InfoRow label="城市" value={main?.city || '--'} />
              <InfoRow label="IP 版本" value={main?.family ? String(main.family).toUpperCase() : '--'} />
              <InfoRow label="国家代码" value={main?.country_code || '--'} />
              <InfoRow label="时区" value={main?.timezone || '--'} />
              <InfoRow label="显示目标" value={ipv4 ? 'IPv4 优先' : (ipv6 ? 'IPv6 优先' : '--')} />
              {isLoggedIn ? <InfoRow label="数据来源" value={main?.source || '--'} /> : null}
              {isLoggedIn ? <InfoRow label="缓存到期" value={main?.expires_at || '--'} /> : null}
              {isLoggedIn ? <InfoRow label="状态" value={loading ? '查询中' : (main?.cached ? '已缓存' : '正常')} /> : null}
            </div>
          </div>

          <div className="ds-ip-top-side">
            <div className="ds-ip-detail-card ds-ip-score-card">
              <div className="ds-ip-score-head"><Radar size={16} /> <span>IP质量</span><em className="ds-ip-score-head-note">仅供参考</em></div>
              <div className="ds-ip-score-grid ds-ip-score-grid-3">
                <ScoreCard label="置信度" value={isLoggedIn ? main?.confidence_score : undefined} percent={isLoggedIn ? main?.confidence_score : 0} tone={isLoggedIn ? scoreTone(main?.confidence_score) : 'neutral'} />
                <ScoreCard label="风险观感" value={isLoggedIn ? main?.risk_score : undefined} percent={isLoggedIn ? (main?.risk_score !== undefined ? 100 - main.risk_score : undefined) : 0} tone={isLoggedIn ? scoreTone(main?.risk_score ? 100 - main.risk_score : undefined) : 'neutral'} />
                <ScoreCard label="污染度" value={isLoggedIn ? main?.pollution_score : undefined} percent={isLoggedIn ? (main?.pollution_score !== undefined ? 100 - main.pollution_score : undefined) : 0} tone={isLoggedIn ? scoreTone(main?.pollution_score ? 100 - main.pollution_score : undefined) : 'neutral'} />
              </div>
            </div>

            <div className="ds-ip-detail-card ds-ip-side-card">
              <div className="ds-ip-score-head"><Building2 size={16} /> 网络归属</div>
              <div className="ds-ip-side-list">
                <InfoRow label="ASN" value={isLoggedIn ? (main?.asn || '--') : '登录后可见'} />
                <InfoRow label="组织 / 运营商" value={isLoggedIn ? (main?.org || main?.company || '--') : '登录后可见'} />
                <InfoRow label="网络类型" value={isLoggedIn ? (main?.network_type || '--') : '登录后可见'} />
                <InfoRow label="节点地区" value={isLoggedIn ? (node?.region || '--') : '登录后可见'} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <StreamingUnlockPanel nodeUuid={node?.uuid} nodeName={node?.name} ipv4={node?.ipv4} ipv6={node?.ipv6} isOnline={isOnline} />
    </div>
  );
}
