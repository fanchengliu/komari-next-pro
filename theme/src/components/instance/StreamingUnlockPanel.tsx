"use client";

import { useEffect, useMemo, useState } from "react";
import { Film, Tv, Music2, MessageSquare, Sparkles, Bot, PlaySquare, Globe2, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type CardStatus = "idle" | "loading" | "ok" | "partial" | "fail" | "error" | "unsupported" | "pending";

type UnlockResult = {
  key: string;
  name?: string;
  status: CardStatus;
  statusText?: string;
  region?: string;
  type?: string;
  typeText?: string;
  detail?: string;
};

type UnlockApiResponse = {
  ok: boolean;
  uuid?: string;
  cached?: boolean;
  updatedAt?: string | null;
  results?: UnlockResult[];
  error?: string;
};

type UnlockProbeConfig = { enabledAll: boolean; disabledNodeUuids: string[]; autoRunDays: number; showIPv6: boolean };
type UnlockNodeOption = { uuid: string; name: string; hasIPv4?: boolean; hasIPv6?: boolean };

const CATALOG = [
  { key: "netflix", label: "Netflix", icon: Film, iconUrl: "/assets/unlock-icons/netflix.svg" },
  { key: "disney", label: "Disney+", icon: Tv, iconUrl: "/assets/unlock-icons/disneyplus.svg" },
  { key: "youtube", label: "YouTube Premium", icon: PlaySquare, iconUrl: "/assets/unlock-icons/youtube.svg" },
  { key: "spotify", label: "Spotify", icon: Music2, iconUrl: "/assets/unlock-icons/spotify.svg" },
  { key: "tiktok", label: "TikTok", icon: Music2, iconUrl: "/assets/unlock-icons/tiktok.svg" },
  { key: "chatgpt", label: "ChatGPT", icon: MessageSquare, iconUrl: "/assets/unlock-icons/openai.svg" },
  { key: "claude", label: "Claude", icon: Bot, iconUrl: "/assets/unlock-icons/anthropic.svg" },
  { key: "gemini", label: "Gemini", icon: Sparkles, iconUrl: "/assets/unlock-icons/googlegemini.svg" },
] as const;

function apiBase() {
  return process.env.NEXT_PUBLIC_UNLOCK_PROBE_API || "/unlock-probe";
}

function formatChinaTime(value?: string | null) {
  if (!value) return "暂无记录";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d).replace(/\//g, "-");
}

function cloneCards(status: CardStatus, detail: string): UnlockResult[] {
  return CATALOG.map((item) => ({ key: item.key, status, detail }));
}

function UnlockBadge({ status, masked = false }: { status: CardStatus; masked?: boolean }) {
  const cls = {
    idle: "ds-unlock-badge pending",
    loading: "ds-unlock-badge pending",
    ok: "ds-unlock-badge ok",
    partial: "ds-unlock-badge partial",
    fail: "ds-unlock-badge fail",
    error: "ds-unlock-badge fail",
    unsupported: "ds-unlock-badge fail",
    pending: "ds-unlock-badge pending",
  } as const;
  const text = {
    idle: "未测试",
    loading: "测试中",
    ok: "可用",
    partial: "部分",
    fail: "不可用",
    error: "错误",
    unsupported: "不支持",
    pending: "待定",
  } as const;
  return <span className={cls[status]}>{masked ? "***" : text[status]}</span>;
}

function ResultGrid({ cards, masked = false }: { cards: UnlockResult[]; masked?: boolean }) {
  const map = new Map(cards.map((item) => [item.key, item]));
  return (
    <div className="ds-unlock-grid">
      {CATALOG.map((base) => {
        const item = map.get(base.key) || { key: base.key, status: "idle" as CardStatus, detail: "等待开始测试" };
        const Icon = base.icon;
        return (
          <div key={base.key} className="ds-unlock-item">
            <div className="ds-unlock-item-top">
              <div className={`ds-unlock-item-icon ds-unlock-brand-${base.key}`}>{item.status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <img className="ds-unlock-brand-img" src={base.iconUrl} alt={base.label} />}</div>
              <div className="ds-unlock-item-title">{base.label}</div>
            </div>
            <div className="ds-unlock-item-body">
              <UnlockBadge status={item.status} masked={masked} />
              <div className="ds-unlock-item-detail">
                {masked ? "***" : item.status === "idle" || item.status === "loading" ? (item.detail || "") : (
                  <>
                    {item.region ? <span>地区：{item.region}</span> : null}
                    {item.typeText ? <span>类型：{item.typeText}</span> : null}
                    {item.status !== "ok" && item.detail ? <span>原因：{item.detail}</span> : null}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StreamingUnlockPanel({ nodeUuid, nodeName, ipv4, ipv6, isOnline = true }: { nodeUuid?: string; nodeName?: string; ipv4?: string; ipv6?: string; isOnline?: boolean }) {
  const [v4Data, setV4Data] = useState<UnlockApiResponse | null>(null);
  const [v6Data, setV6Data] = useState<UnlockApiResponse | null>(null);
  const [loading4, setLoading4] = useState(false);
  const [loading6, setLoading6] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [capability, setCapability] = useState<{ hasIPv4?: boolean; hasIPv6?: boolean } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [probeConfig, setProbeConfig] = useState<UnlockProbeConfig | null>(null);
  const [nodeOptions, setNodeOptions] = useState<UnlockNodeOption[]>([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const { streamUnlockConfig } = useTheme();
  const [directStreamSettings, setDirectStreamSettings] = useState<{ mode?: string; nodeMatchList?: string; enabled?: boolean; showIPv6?: boolean } | null>(null);

  const effectiveStreamEnabled = directStreamSettings?.enabled ?? streamUnlockConfig.enabled;
  const effectiveStreamMode = directStreamSettings?.mode || streamUnlockConfig.mode;
  const effectiveNodeMatchList = directStreamSettings?.nodeMatchList ?? (streamUnlockConfig.nodeMatchList || streamUnlockConfig.includeNodes || "");
  const effectiveShowIPv6 = directStreamSettings?.showIPv6 ?? streamUnlockConfig.showIPv6;
  const propHasIPv4 = !!String(ipv4 || "").trim();
  const propHasIPv6 = !!String(ipv6 || "").trim();
  const includeTokens = effectiveNodeMatchList.split(new RegExp("[\\n,，;；、]+")) .map(x => x.trim().toLowerCase()).filter(Boolean);
  const nodeMatchesStreamList = includeTokens.some(token => String(nodeUuid || "").toLowerCase().includes(token) || String(nodeName || "").toLowerCase().includes(token));
  const themeEnabledForNode = effectiveStreamMode === "off" ? false : effectiveStreamMode === "all" ? true : effectiveStreamMode === "include" ? nodeMatchesStreamList : effectiveStreamMode === "exclude" ? !nodeMatchesStreamList : true;
  const enabledForNode = themeEnabledForNode && !(probeConfig?.disabledNodeUuids || []).includes(String(nodeUuid || ""));
  const hasIPv4 = loggedIn ? (capability?.hasIPv4 ?? propHasIPv4) : true;
  const hasIPv6 = effectiveShowIPv6 && (loggedIn ? (capability?.hasIPv6 ?? propHasIPv6) : true);

  const cardsFor = (data: UnlockApiResponse | null, loading: boolean) => {
    if (loading) return cloneCards("loading", "测试中…");
    return (data?.results || []).filter((item) => item.key !== "trace");
  };

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.ok ? res.json() : null)
      .then((me) => setLoggedIn(!!me?.logged_in))
      .catch(() => setLoggedIn(false));
  }, []);

  useEffect(() => {
    fetch("/api/public", { cache: "no-cache" })
      .then((res) => res.ok ? res.json() : null)
      .then((resp) => {
        const ts = resp?.data?.theme_settings || {};
        setDirectStreamSettings({
          enabled: ts["streamUnlock.enabled"],
          mode: ts["streamUnlock.mode"],
          nodeMatchList: ts["streamUnlock.nodeMatchList"] || ts["streamUnlock.includeNodes"],
          showIPv6: ts["streamUnlock.showIPv6"],
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!nodeUuid || !loggedIn) return;
    fetch(`${apiBase()}/unlock/capability?uuid=${encodeURIComponent(nodeUuid)}`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((json) => json?.ok && setCapability({ hasIPv4: !!json.hasIPv4, hasIPv6: !!json.hasIPv6 }))
      .catch(() => {});
  }, [nodeUuid, loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    fetch(`${apiBase()}/config`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((json) => json?.ok && setProbeConfig(json.config))
      .catch(() => {});
  }, [loggedIn]);

  const openSettings = async () => {
    setSettingsOpen(true);
    try {
      const [cfgRes, nodesRes] = await Promise.all([
        fetch(`${apiBase()}/config`, { credentials: "include" }),
        fetch(`${apiBase()}/nodes`, { credentials: "include" }),
      ]);
      const cfg = await cfgRes.json();
      const nodes = await nodesRes.json();
      if (cfg?.ok) setProbeConfig(cfg.config);
      if (nodes?.ok) setNodeOptions(nodes.nodes || []);
    } catch {}
  };

  const toggleDisabledNode = (uuid: string, checked: boolean) => {
    setProbeConfig((prev) => {
      const base = prev || { enabledAll: true, disabledNodeUuids: [], autoRunDays: 5, showIPv6: true };
      const set = new Set(base.disabledNodeUuids || []);
      checked ? set.add(uuid) : set.delete(uuid);
      return { ...base, disabledNodeUuids: Array.from(set) };
    });
  };

  const saveSettings = async () => {
    if (!probeConfig) return;
    setSettingsSaving(true);
    try {
      const resp = await fetch(`${apiBase()}/config`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(probeConfig),
      });
      const json = await resp.json();
      if (json?.ok) { setProbeConfig(json.config); setSettingsOpen(false); }
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (!nodeUuid) return;
    fetch(`${apiBase()}/unlock/latest?uuid=${encodeURIComponent(nodeUuid)}&family=4`, { credentials: "include" }).then(r=>r.json()).then(j=>j?.ok&&setV4Data(j)).catch(()=>{});
    fetch(`${apiBase()}/unlock/latest?uuid=${encodeURIComponent(nodeUuid)}&family=6`, { credentials: "include" }).then(r=>r.json()).then(j=>j?.ok&&setV6Data(j)).catch(()=>{});
  }, [nodeUuid, hasIPv4, hasIPv6]);

  const runFamily = async (family: "4" | "6") => {
    if (!nodeUuid || !enabledForNode || !effectiveStreamEnabled || effectiveStreamMode === "off" || !isOnline) return;
    family === "4" ? setLoading4(true) : setLoading6(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBase()}/unlock/run`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ uuid: nodeUuid, family, useCache: false }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
      family === "4" ? setV4Data(json as UnlockApiResponse) : setV6Data(json as UnlockApiResponse);
    } catch (err: any) {
      setError(err?.message || "测试失败");
    } finally {
      family === "4" ? setLoading4(false) : setLoading6(false);
    }
  };

  const runAll = async () => {
    if (hasIPv4) await runFamily("4");
    if (hasIPv6) await runFamily("6");
  };

  const busy = loading4 || loading6;

  if (!effectiveStreamEnabled || effectiveStreamMode === "off" || !enabledForNode) return null;

  return (
    <div className="ds-unlock-panel ds-ip-detail-card">
      <div className="ds-ip-score-head" style={{ justifyContent: "space-between" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Film size={16} /> 流媒体解锁</span>{loggedIn ? <button className="ds-home-toolbar-viewbtn" onClick={openSettings} type="button">设备选择</button> : null}</div>
      <div className="ds-ip-note-list" style={{ marginBottom: 12 }}>
        <div>最近测试：{formatChinaTime(v4Data?.updatedAt || v6Data?.updatedAt)}</div>
      </div>
      {settingsOpen && loggedIn ? (
        <div className="ds-ip-detail-card ds-unlock-settings-card" style={{ marginBottom: 12 }}>
          <div className="ds-ip-score-head">不检测以下设备</div>
          <div className="ds-ip-note-list" style={{ marginBottom: 10 }}>勾选后，这些设备不会显示/执行流媒体解锁检测。</div>
          <div className="ds-unlock-node-list">
            {nodeOptions.map((node) => (
              <label key={node.uuid} className="ds-unlock-node-option">
                <input type="checkbox" checked={(probeConfig?.disabledNodeUuids || []).includes(node.uuid)} onChange={(e) => toggleDisabledNode(node.uuid, e.target.checked)} />
                <span>{node.name}</span>
                <em>{node.hasIPv4 ? "IPv4" : ""}{node.hasIPv6 ? " / IPv6" : ""}</em>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button className="ds-home-toolbar-viewbtn" onClick={() => setSettingsOpen(false)} type="button">取消</button>
            <button className="ds-home-toolbar-viewbtn is-active" onClick={saveSettings} disabled={settingsSaving} type="button">{settingsSaving ? "保存中…" : "保存"}</button>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <button className="ds-home-toolbar-viewbtn is-active" onClick={runAll} disabled={busy || !nodeUuid || !loggedIn || !isOnline}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span>{!isOnline ? "节点离线" : busy ? "测试中…" : loggedIn ? "开始测试" : "登录后可测试"}</span>
        </button>
      </div>
      {!isOnline ? <div className="ds-ip-notice ds-ip-notice-warn"><AlertTriangle size={14} /> 节点离线，暂不支持检测</div> : null}
      {error ? <div className="ds-ip-notice ds-ip-notice-warn"><AlertTriangle size={14} /> 接口请求失败：{error}</div> : null}
      {hasIPv4 ? (
        <div className="ds-ip-detail-card" style={{ marginTop: 14 }}>
          <div className="ds-ip-score-head"><Globe2 size={16} /> IPv4 解锁结果</div>
          <ResultGrid masked={!loggedIn} cards={cardsFor(v4Data, loading4).length ? cardsFor(v4Data, loading4) : cloneCards("idle", "等待开始测试")} />
        </div>
      ) : null}
      {hasIPv6 ? (
        <div className="ds-ip-detail-card" style={{ marginTop: 14 }}>
          <div className="ds-ip-score-head"><Globe2 size={16} /> IPv6 解锁结果</div>
          <ResultGrid masked={!loggedIn} cards={cardsFor(v6Data, loading6).length ? cardsFor(v6Data, loading6) : cloneCards("idle", "等待开始测试")} />
        </div>
      ) : null}
    </div>
  );
}
