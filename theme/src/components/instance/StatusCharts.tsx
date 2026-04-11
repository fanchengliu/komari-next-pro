"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ChartNoAxesCombined } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { formatBytes } from "@/utils/unitHelper";
import type { RecordFormat } from "@/utils/RecordHelper";
import fillMissingTimePoints from "@/utils/RecordHelper";
import Loading from "@/components/loading";

type Props = {
  uuid: string;
  realtimeData: RecordFormat[];
  memTotal: number;
  swapTotal: number;
};

type ViewKey = "real-time" | "1h" | "24h" | "168h" | "720h";

const lineColors = {
  cpu: "#f38181",
  ram: "#898ac4",
  swap: "#03a6a1",
  down: "#60a5fa",
  up: "#f59e0b",
};

export default function StatusCharts({ uuid, realtimeData, memTotal, swapTotal }: Props) {
  const { t } = useTranslation();
  const [loadView, setLoadView] = useState<ViewKey>("real-time");
  const [netView, setNetView] = useState<ViewKey>("real-time");
  const [loadRemoteData, setLoadRemoteData] = useState<RecordFormat[] | null>(null);
  const [netRemoteData, setNetRemoteData] = useState<RecordFormat[] | null>(null);
  const [loadLoading, setLoadLoading] = useState(false);
  const [netLoading, setNetLoading] = useState(false);
  const [loadInitialized, setLoadInitialized] = useState(false);
  const [netInitialized, setNetInitialized] = useState(false);
  const [hiddenLoad, setHiddenLoad] = useState<Record<string, boolean>>({});
  const [hiddenNet, setHiddenNet] = useState<Record<string, boolean>>({});

  const getHours = (view: ViewKey) => view === "1h" ? 1 : view === "24h" ? 24 : view === "168h" ? 168 : view === "720h" ? 720 : null;

  useEffect(() => {
    const hours = getHours(loadView);
    if (!uuid) return;
    if (!hours) {
      setLoadRemoteData(null);
      setLoadLoading(false);
      return;
    }
    setLoadLoading(true);
    fetch(`/api/records/load?uuid=${uuid}&hours=${hours}`)
      .then((res) => res.json())
      .then((resp) => {
        const records = (resp.data?.records || []) as RecordFormat[];
        records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        setLoadRemoteData(records);
        setLoadLoading(false);
        setLoadInitialized(true);
      })
      .catch(() => {
        setLoadRemoteData([]);
        setLoadLoading(false);
        setLoadInitialized(true);
      });
  }, [uuid, loadView]);

  useEffect(() => {
    const hours = getHours(netView);
    if (!uuid) return;
    if (!hours) {
      setNetRemoteData(null);
      setNetLoading(false);
      return;
    }
    setNetLoading(true);
    fetch(`/api/records/load?uuid=${uuid}&hours=${hours}`)
      .then((res) => res.json())
      .then((resp) => {
        const records = (resp.data?.records || []) as RecordFormat[];
        records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        setNetRemoteData(records);
        setNetLoading(false);
        setNetInitialized(true);
      })
      .catch(() => {
        setNetRemoteData([]);
        setNetLoading(false);
        setNetInitialized(true);
      });
  }, [uuid, netView]);

  const loadBaseData = useMemo(() => {
    if (loadView === "real-time") return realtimeData.slice(-150);
    const data = loadRemoteData ?? [];
    if (loadView === "1h") return fillMissingTimePoints(data, 60, 3600, 120);
    if (loadView === "24h") return fillMissingTimePoints(data, 900, 86400, 1800);
    if (loadView === "168h") return fillMissingTimePoints(data, 3600, 168 * 3600, 7200);
    if (loadView === "720h") return fillMissingTimePoints(data, 3600, 720 * 3600, 7200);
    return data;
  }, [loadView, realtimeData, loadRemoteData]);

  const netBaseData = useMemo(() => {
    if (netView === "real-time") return realtimeData.slice(-150);
    const data = netRemoteData ?? [];
    if (netView === "1h") return fillMissingTimePoints(data, 60, 3600, 120);
    if (netView === "24h") return fillMissingTimePoints(data, 900, 86400, 1800);
    if (netView === "168h") return fillMissingTimePoints(data, 3600, 168 * 3600, 7200);
    if (netView === "720h") return fillMissingTimePoints(data, 3600, 720 * 3600, 7200);
    return data;
  }, [netView, realtimeData, netRemoteData]);

  const loadData = useMemo(() => loadBaseData.map((item) => ({
    time: item.time,
    cpu: item.cpu ?? 0,
    ram: memTotal > 0 ? ((item.ram ?? 0) / memTotal) * 100 : 0,
    swap: swapTotal > 0 ? ((item.swap ?? 0) / swapTotal) * 100 : 0,
  })), [loadBaseData, memTotal, swapTotal]);

  const netData = useMemo(() => netBaseData.map((item) => ({
    time: item.time,
    up: item.net_out ?? 0,
    down: item.net_in ?? 0,
  })), [netBaseData]);

  const timeFormatter = (value: any, index: number, data: any[], view: ViewKey) => {
    if (index !== 0 && index !== data.length - 1) return "";
    const d = new Date(value);
    if (view === "real-time" || view === "1h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
  };

  const btns = [
    { key: "real-time" as ViewKey, label: "实时" },
    { key: "1h" as ViewKey, label: "1h" },
    { key: "24h" as ViewKey, label: "24h" },
    { key: "168h" as ViewKey, label: "7天" },
    { key: "720h" as ViewKey, label: "30天" },
  ];

  return (
    <div className="ds-chart-grid">
      <div className="ds-chart-card">
        <div className="ds-chart-head">
          <div className="ds-chart-title-wrap">
            <div className="ds-chart-title ds-chart-title-icon"><Activity size={16} /><span>负载详情</span></div>
          </div>
          <div className="ds-chart-tabs">
            {btns.map((b) => <button key={b.key} className={`ds-chart-tab ${loadView === b.key ? 'is-active' : ''}`} onClick={() => setLoadView(b.key)}>{b.label}</button>)}
          </div>
        </div>
        {loadLoading && !loadInitialized ? <div className="ds-chart-loading"><Loading /></div> : (<>
          <div className="ds-status-chart-viewport">
          <ChartContainer className="ds-status-chart-frame" config={{ cpu: { label: 'CPU', color: lineColors.cpu }, ram: { label: 'RAM', color: lineColors.ram }, swap: { label: 'SWAP', color: lineColors.swap } }}>
            <LineChart data={loadData} margin={{ top: 10, right: 16, bottom: 6, left: 10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} tickFormatter={(v, i) => timeFormatter(v, i, loadData, loadView)} interval={0} />
              <YAxis tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => new Date(String(value)).toLocaleString()} indicator="dot" />} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
              {!hiddenLoad.cpu && <Line dataKey="cpu" stroke={lineColors.cpu} dot={false} strokeWidth={2} isAnimationActive />} 
              {!hiddenLoad.ram && <Line dataKey="ram" stroke={lineColors.ram} dot={false} strokeWidth={2} isAnimationActive />} 
              {!hiddenLoad.swap && <Line dataKey="swap" stroke={lineColors.swap} dot={false} strokeWidth={2} isAnimationActive />} 
            </LineChart>
          </ChartContainer>
          </div>
          <div className="ds-chart-legend ds-chart-legend-bottom">{[["cpu","CPU"],["ram","内存"],["swap","SWAP"]].map(([key,label]) => (<button key={key} className={`ds-chart-legend-item ${hiddenLoad[key] ? "is-off" : ""}`} onClick={() => setHiddenLoad((p) => ({ ...p, [key]: !p[key] }))}><span className="ds-chart-dot" style={{ backgroundColor: lineColors[key as keyof typeof lineColors] }} />{label}</button>))}</div></>
        )}
      </div>

      <div className="ds-chart-card">
        <div className="ds-chart-head">
          <div className="ds-chart-title-wrap">
            <div className="ds-chart-title ds-chart-title-icon"><ChartNoAxesCombined size={16} /><span>带宽监控</span></div>
          </div>
          <div className="ds-chart-tabs">
            {btns.map((b) => <button key={b.key} className={`ds-chart-tab ${netView === b.key ? 'is-active' : ''}`} onClick={() => setNetView(b.key)}>{b.label}</button>)}
          </div>
        </div>
        {netLoading && !netInitialized ? <div className="ds-chart-loading"><Loading /></div> : (<>
          <div className="ds-status-chart-viewport">
          <ChartContainer className="ds-status-chart-frame" config={{ up: { label: '上行', color: lineColors.up }, down: { label: '下行', color: lineColors.down } }}>
            <AreaChart data={netData} margin={{ top: 10, right: 16, bottom: 6, left: 10 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="time" tickLine={false} tickFormatter={(v, i) => timeFormatter(v, i, netData, netView)} interval={0} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatBytes(Number(v))} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => new Date(String(value)).toLocaleString()} indicator="dot" />} formatter={(v: any) => formatBytes(Number(v)) + '/s'} />
              {!hiddenNet.down && <Area dataKey="down" stroke={lineColors.down} fill={lineColors.down} fillOpacity={0.18} dot={false} isAnimationActive />} 
              {!hiddenNet.up && <Area dataKey="up" stroke={lineColors.up} fill={lineColors.up} fillOpacity={0.12} dot={false} isAnimationActive />} 
            </AreaChart>
          </ChartContainer>
          </div>
          <div className="ds-chart-legend ds-chart-legend-bottom">{[["down","下行"],["up","上行"]].map(([key,label]) => (<button key={key} className={`ds-chart-legend-item ${hiddenNet[key] ? "is-off" : ""}`} onClick={() => setHiddenNet((p) => ({ ...p, [key]: !p[key] }))}><span className="ds-chart-dot" style={{ backgroundColor: lineColors[key as keyof typeof lineColors] }} />{label}</button>))}</div></>
        )}
      </div>
    </div>
  );
}
