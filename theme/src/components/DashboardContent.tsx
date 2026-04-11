"use client";

import React, { Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Globe, Activity, ArrowUpRight, ArrowUp, ArrowDown, Zap, Calculator, Cloud } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import NodeDisplay from "@/components/NodeDisplay";
import { formatBytes } from "@/utils/unitHelper";
import { computeAssetTotalCNY, normalizeCurrency } from "@/utils/assetSummary";
import { useLiveData } from "@/contexts/LiveDataContext";
import { useNodeList } from "@/contexts/NodeListContext";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAssetSummary } from "@/contexts/AssetSummaryContext";
import Loading from "@/components/loading";
import { CurrentTimeCard } from "@/components/CurrentTimeCard";
import { usePingStats } from "@/hooks/usePingStats";
import { Callouts } from "@/components/DashboardCallouts";

// Intelligent speed formatting function
const formatSpeed = (bytes: number): string => {
  if (bytes === 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  // Adaptive decimal places
  let decimals = 2;
  if (i >= 3) decimals = 1; // GB and above: 1 decimal
  if (i <= 1) decimals = 0; // B and KB: no decimals
  if (size >= 100) decimals = 0; // 100+ of any unit: no decimals

  return `${size.toFixed(decimals)} ${units[i]}`;
};

export default function DashboardContent() {
  const [t] = useTranslation();
  const { live_data } = useLiveData();
  const { publicInfo } = usePublicInfo();
  const { themeConfig, statusCardsVisibility } = useTheme();
  const { summary: sharedAssetSummary } = useAssetSummary();
  
  // Sync document title with backend-set custom title

  useEffect(() => {
    if (publicInfo?.sitename) {
      document.title = publicInfo.sitename;
    }
  }, [publicInfo?.sitename]);
  
  //#region 节点数据
  const { nodeList, isLoading, error, refresh } = useNodeList();
  const [fallbackAssetTotalCNY, setFallbackAssetTotalCNY] = React.useState(0);
  useEffect(() => {
    let cancelled = false;
    async function run(){
      const nodes = nodeList || [];
      const online = new Set(live_data?.data?.online || []);
      if (!nodes.length || !online.size) { if(!cancelled) setFallbackAssetTotalCNY(0); return; }
      const rateCache = new Map<string, number>();
      async function rate(curr: string){
        if (curr === "CNY") return 1;
        if (rateCache.has(curr)) return rateCache.get(curr)!;
        try { const r = await fetch(`https://open.er-api.com/v6/latest/${curr}`); const j = await r.json(); const v = Number(j?.rates?.CNY) || 1; rateCache.set(curr, v); return v; } catch { rateCache.set(curr, 1); return 1; }
      }
      let total = 0;
      for (const n of nodes) {
        if (!online.has(n.uuid)) continue;
        const raw = Number(n.price);
        const price = raw === -1 ? 0 : (Number.isFinite(raw) && raw > 0 ? raw : 0);
        total += price * await rate(normalizeCurrency(n.currency || "CNY"));
      }
      if(!cancelled) setFallbackAssetTotalCNY(total);
    }
    run();
    return () => { cancelled = true; };
  }, [nodeList, live_data?.data?.online]);

  const pingStats = usePingStats(nodeList?.[0]?.uuid || "", 24);
  const activeContinents = React.useMemo(() => {
    const list = nodeList || [];
    const onlineSet = new Set(live_data?.data?.online || []);
    const mapRegionToContinent = (r: string) => {
      const x = String(r || '').toLowerCase();
      if (/hong kong|japan|singapore|korea|taiwan|india|asia|tokyo|osaka|seoul/.test(x)) return '亚洲';
      if (/germany|france|uk|europe|netherlands|eu|london|paris|frankfurt/.test(x)) return '欧洲';
      if (/usa|canada|america|los angeles|san jose|dallas|seattle|new york|na/.test(x)) return '北美';
      if (/australia|sydney|melbourne|oceania|au/.test(x)) return '大洋洲';
      if (/brazil|argentina|chile|south america|sa/.test(x)) return '南美';
      return '其他';
    };
    return Array.from(new Set(list.filter(n => onlineSet.has(n.uuid)).map(n => mapRegionToContinent(n.region))));
  }, [nodeList, live_data]);

  const renderTrafficPair = (up: string, down: string) => {
    if (themeConfig.cardLayout === "modern") {
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>↑ {up}</span>
          <span className="text-muted-foreground">/</span>
          <span>↓ {down}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <div>↑ {up}</div>
        <div>↓ {down}</div>
      </div>
    );
  };

  // Status cards configuration
  const statusCards = [
    {
      key: "currentTime",
      title: t("current_time"),
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
      renderValue: () => <CurrentTimeCard />,
      visible: statusCardsVisibility.currentTime,
    },
    {
      key: "currentOnline",
      title: t("current_online"),
      icon: <Activity className="h-4 w-4 text-muted-foreground" />,
      getValue: () =>
        `${live_data?.data?.online.length ?? 0} / ${nodeList?.length ?? 0}`,
      visible: statusCardsVisibility.currentOnline,
    },
    {
      key: "regionOverview",
      title: t("region_overview"),
      icon: <Globe className="h-4 w-4 text-muted-foreground" />,
      getValue: () => {
        const onlineSet = new Set(live_data?.data?.online || []);
        return nodeList ? new Set(nodeList.filter(n => onlineSet.has(n.uuid)).map(n => n.region)).size : 0;
      },

      visible: statusCardsVisibility.regionOverview,
    },
    {
      key: "trafficOverview",
      title: t("traffic_overview"),
      icon: <ArrowUpRight className="h-4 w-4 text-muted-foreground" />,
      renderValue: () => {
        const data = live_data?.data?.data;
        const online = live_data?.data?.online;
        if (!data || !online) return renderTrafficPair("0 B", "0 B");
        const onlineSet = new Set(online);
        const values = Object.entries(data)
          .filter(([uuid]) => onlineSet.has(uuid))
          .map(([, node]) => node);
        const up = values.reduce(
          (acc, node) => acc + (node.network.totalUp || 0),
          0
        );
        const down = values.reduce(
          (acc, node) => acc + (node.network.totalDown || 0),
          0
        );
        return `↑ ${formatBytes(up)}
↓ ${formatBytes(down)}`;
      },
      visible: statusCardsVisibility.trafficOverview,
    },
    {
      key: "networkSpeed",
      title: t("network_speed"),
      icon: <Zap className="h-4 w-4 text-muted-foreground" />,
      renderValue: () => {
        const data = live_data?.data?.data;
        const online = live_data?.data?.online;
        if (!data || !online) return renderTrafficPair("0 B/s", "0 B/s");
        const onlineSet = new Set(online);
        const values = Object.entries(data)
          .filter(([uuid]) => onlineSet.has(uuid))
          .map(([, node]) => node);
        const up = values.reduce(
          (acc, node) => acc + (node.network.up || 0),
          0
        );
        const down = values.reduce(
          (acc, node) => acc + (node.network.down || 0),
          0
        );
        return `↑ ${formatSpeed(up)}
↓ ${formatSpeed(down)}`;
      },
      visible: statusCardsVisibility.networkSpeed,
    },
    {
      key: "assetOverview",
      title: t('asset_overview', { defaultValue: '资产统计' }),
      icon: <Calculator className="h-4 w-4 text-muted-foreground" />,
      renderValue: () => `¥ ${Number(sharedAssetSummary.count > 0 ? sharedAssetSummary.totalValueCNY : (fallbackAssetTotalCNY || 0)).toFixed(2)}`,  
      visible: (statusCardsVisibility as any).assetOverview ?? true,
    },
  ];

  const visibleStatusCards = statusCards.filter((card) => card.visible);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [nodeList, refresh]);

  if (isLoading) {
    return <Loading />;
  }
  if (error) {
    return <div>Error: {error}</div>;
  }
  //#endregion

  return (
    <div className="container mx-auto px-4 space-y-4">
      <Callouts />

      <div className="flex flex-col gap-4">

        <div className={`grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${visibleStatusCards.length >= 6 ? 'xl:grid-cols-6' : visibleStatusCards.length === 5 ? 'xl:grid-cols-5' : visibleStatusCards.length === 4 ? 'xl:grid-cols-4' : visibleStatusCards.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
          {visibleStatusCards.map((card) => (
              <TopCard
                key={card.key}
                title={card.title}
                value={card.renderValue ? card.renderValue() : card.getValue?.()}
                icon={card.icon}
                layout={themeConfig.cardLayout}
              />
            ))}
        </div>
      </div>

      <Suspense fallback={<div className="p-4">Loading nodes...</div>}>
        <NodeDisplay
          nodes={nodeList ?? []}
          liveData={live_data?.data ?? { online: [], data: {} }}
        />
      </Suspense>
    </div>
  );
}

type TopCardProps = {
  title: string;
  value: string | number | React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  layout?: 'classic' | 'modern' | 'minimal' | 'detailed';
};

function DashboardGauge({ value, max = 100, label }: { value: number; max?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="ds-mini-gauge">
      <div className="ds-mini-gauge-arc">
        <div className="ds-mini-gauge-fill" style={{ ['--pct' as any]: `${pct}%` }} />
        <div className="ds-mini-gauge-center">
          <div className="ds-mini-gauge-value">{Math.round(value)}</div>
          {label ? <div className="ds-mini-gauge-label">{label}</div> : null}
        </div>
      </div>
    </div>
  );
}

const TopCard: React.FC<TopCardProps> = ({ title, value, description, icon }) => {
  const [t] = useTranslation();
  const titleText = String(title);

  let body: React.ReactNode = <div className="ds-dashboard-topcard-value">{value}</div>;

  if (titleText.includes('时间')) {
    body = (
      <div className="ds-metric-time-panel">
        <div className="ds-metric-time-main">{value}</div>
        <div className="ds-metric-time-rail">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  } else if (titleText.includes('在线')) {
    const raw = typeof value === 'string' ? value : String(value);
    const parts = raw.split('/').map(s => s.trim());
    const online = Number(parts[0] || 0);
    const total = Number(parts[1] || 0);
    const pct = total ? (online / total) * 100 : 0;
    body = (
      <div className="ds-metric-online-panel">
        <div className="ds-dashboard-topcard-value">{raw}</div>
        <div className="ds-metric-line"><div className="ds-metric-line-fill online" style={{ width: `${pct}%` }} /></div>
        
      </div>
    );
  } else if (titleText.includes('地区')) {
    body = (
      <div className="ds-metric-region-panel">
        <div className="ds-dashboard-topcard-value">{value}</div>
        <div className="ds-metric-region-dots"><span /><span /><span /><span /><span /></div>
      </div>
    );
  } else if (titleText.includes('流量')) {
    body = <div className="ds-metric-traffic-panel" title={typeof value === 'string' ? value.replace(/\n/g, ' | ') : undefined}><div className="ds-metric-traffic-stack"><div className="ds-metric-traffic-lane up"><span className="tag">{t("common.up", { defaultValue: "上行" })}</span><strong>{typeof value === 'string' ? (value.split('\n')[0] || '').replace(/^↑\s*/, '') : value}</strong></div><div className="ds-metric-traffic-lane down"><span className="tag">{t("common.down", { defaultValue: "下行" })}</span><strong>{typeof value === 'string' ? (value.split('\n')[1] || '').replace(/^↓\s*/, '') : ''}</strong></div></div></div>;
  } else if (titleText.includes('资产')) {
    const txt = typeof value === 'string' ? value : String(value);
    const m = txt.match(/([¥$€£])\s*([\d,]+)(?:\.(\d{2}))?/);
    const symbol = m ? m[1] : '¥';
    const integer = m ? m[2] : txt;
    const decimal = m && m[3] ? m[3] : '00';
    body = (
      <div className="ds-asset-topcard">
        <div className="ds-asset-topcard-money">
          <span className="ds-asset-topcard-symbol">¥</span>
          <span className="ds-asset-topcard-int">{integer}</span>
          <span className="ds-asset-topcard-dec">.{decimal}</span>
        </div>
      </div>
    );
  } else if (titleText.includes('速率')) {
    let up = 0, down = 0, unit = 'MB/s';
    const txt = typeof value === 'string' ? value.replace(/\n/g, ' ') : ''; 
    const m = txt.match(/↑\s*([\d.]+)\s*([A-Z/]+)[\s\S]*?↓\s*([\d.]+)\s*([A-Z/]+)/);
    if (m) {
      up = Number(m[1] || 0);
      down = Number(m[3] || 0);
      unit = m[2] || unit;
    }
    const gaugeVal = Math.max(up, down);
    body = (
      <div className="ds-metric-speed-panel" title={`实时上传 ${up || 0} ${unit} / 实时下载 ${down || 0} ${unit}`}>
        <DashboardGauge value={gaugeVal} max={Math.max(10, gaugeVal * 1.3)} label={unit.replace('/s','')} />
        <div className="ds-metric-speed-dual is-compact" title={`↑ ${up || 0} ${unit} / ↓ ${down || 0} ${unit}`}></div>
      </div>
    );
  }

  return (
    <Card className="ds-dashboard-topcard overflow-hidden border shadow-sm bg-card select-none">
      <CardContent className="ds-dashboard-topcard-content ds-dashboard-topcard-content-lefthead">
        <div className="ds-dashboard-topcard-head ds-dashboard-topcard-head-corner">
          <div className="ds-dashboard-topcard-icon">{icon}</div>
          <div className="ds-dashboard-topcard-title">{title}</div>
        </div>
        <div className="ds-dashboard-topcard-body">{body}</div>
        {description ? <div className="ds-dashboard-topcard-desc">{description}</div> : null}
      </CardContent>
    </Card>
  );
};

