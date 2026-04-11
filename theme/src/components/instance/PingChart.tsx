"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Loading from "@/components/loading";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { cutPeakValues, interpolateNullsLinear } from "@/utils/RecordHelper";
import Tips from "@/components/ui/tips";
import { Eye, EyeOff } from "lucide-react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface PingRecord {
  client: string;
  task_id: number;
  time: string;
  value: number;
}
interface TaskInfo {
  id: number;
  name: string;
  interval: number;
  loss: number;
  p99?: number;
  p50?: number;
  p99_p50_ratio?: number;
  min?: number;
  max?: number;
  avg?: number;
  latest?: number;
  total?: number;
  type?: string;
}

const colors = ["#F38181", "#347433", "#898AC4", "#03A6A1", "#7AD6F0", "#B388FF", "#FF8A65", "#FFD600"];
const viewOptions = [
  { label: "实时", key: "realtime", hours: 1 },
  { label: "1h", key: "1h", hours: 1 },
  { label: "24h", key: "24h", hours: 24 },
  { label: "7天", key: "7d", hours: 24 * 7 },
  { label: "30天", key: "30d", hours: 24 * 30 },
];

const PingChart = ({
  uuid,
  externalHiddenLines,
  onHiddenLinesChange,
}: {
  uuid: string;
  externalHiddenLines?: Record<string, boolean>;
  onHiddenLinesChange?: (next: Record<string, boolean>) => void;
}) => {
  const { t } = useTranslation();
  const { call } = useRPC2Call();
  const [view, setView] = useState<string>("realtime");
  const [hours, setHours] = useState<number>(1);
  const [remoteData, setRemoteData] = useState<PingRecord[] | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cutPeak, setCutPeak] = useState(false);
  const [internalHiddenLines, setInternalHiddenLines] = useState<Record<string, boolean>>({});
  const hiddenLines = externalHiddenLines ?? internalHiddenLines;
  const setHiddenLines = onHiddenLinesChange ?? setInternalHiddenLines;

  useEffect(() => {
    const selected = viewOptions.find((v) => v.key === view);
    if (selected) setHours(selected.hours);
  }, [view]);

  useEffect(() => {
    if (!uuid) return;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    (async () => {
      try {
        type RpcResp = { count: number; records: PingRecord[]; tasks?: TaskInfo[]; from?: string; to?: string; };
        const result = await call<any, RpcResp>("common:getRecords", { uuid, type: "ping", hours });
        const records = result?.records || [];
        records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        setRemoteData(records);
        setTasks(result?.tasks || []);
      } catch (err: any) {
        setError(err?.message || "Error");
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [hours, uuid, call]);

  const midData = useMemo(() => {
    const data = remoteData || [];
    if (!data.length) return [];
    const taskIntervals = tasks.map((t) => t.interval).filter((v): v is number => typeof v === "number" && v > 0);
    const fallbackIntervalSec = taskIntervals.length ? Math.min(...taskIntervals) : 60;
    const toleranceMs = Math.min(6000, Math.max(800, Math.floor(fallbackIntervalSec * 1000 * 0.25)));
    const grouped: Record<number, any> = {};
    const anchors: number[] = [];
    for (const rec of data) {
      const ts = new Date(rec.time).getTime();
      let anchor: number | null = null;
      for (const a of anchors) {
        if (Math.abs(a - ts) <= toleranceMs) {
          anchor = a;
          break;
        }
      }
      const use = anchor ?? ts;
      if (!grouped[use]) {
        grouped[use] = { time: new Date(use).toISOString() };
        if (anchor === null) anchors.push(use);
      }
      grouped[use][rec.task_id] = rec.value < 0 ? null : rec.value;
    }
    return Object.values(grouped).sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()) as any[];
  }, [remoteData, tasks]);

  const chartData = useMemo(() => {
    let full = midData;
    if (cutPeak && tasks.length > 0) {
      full = cutPeakValues(midData, tasks.map((task) => String(task.id)));
    }
    if (tasks.length > 0 && full.length > 0) {
      full = interpolateNullsLinear(full, tasks.map((t) => String(t.id)), {
        maxGapMultiplier: 6,
        minCapMs: 2 * 60_000,
        maxCapMs: 30 * 60_000,
      });
    }
    return full;
  }, [midData, cutPeak, tasks]);

  const timeFormatter = (value: any, index: number) => {
    if (!chartData.length) return "";
    if (index === 0 || index === chartData.length - 1) {
      if (hours < 24) return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return new Date(value).toLocaleDateString([], { month: "2-digit", day: "2-digit" });
    }
    return "";
  };

  const labelFormatter = (value: any) => {
    const date = new Date(value);
    if (hours < 24) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const chartConfig = useMemo(() => {
    const config: Record<string, any> = {};
    tasks.forEach((task, idx) => {
      config[task.id] = { label: task.name, color: colors[idx % colors.length] };
    });
    return config;
  }, [tasks]);

  const toggleAllLines = () => {
    const allHidden = tasks.every((task) => hiddenLines[String(task.id)]);
    const next: Record<string, boolean> = {};
    tasks.forEach((task) => { next[String(task.id)] = !allHidden; });
    setHiddenLines(next);
  };

  return (
    <div className="ds-ping-panel">
      <div className="ds-ping-topbar ds-ping-topbar-embedded">
        <div className="ds-ping-view-tabs">
          {viewOptions.map((v) => (
            <button
              key={v.key}
              type="button"
              className={`ds-ping-view-tab ${view === v.key ? 'is-active' : ''}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="ds-ping-state"><Loading /></div>}
      {error && <div className="ds-ping-state ds-ping-state-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="ds-ping-chart-viewport">
            {chartData.length === 0 ? (
              <div className="ds-ping-empty">{t("common.none")}</div>
            ) : (
              <ChartContainer config={chartConfig} className="ds-ping-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 24, bottom: 12, left: 28 }}>
                    <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.18)" />
                    <XAxis
                      dataKey="time"
                      tickLine={true}
                      axisLine={true}
                      tickMargin={10}
                      tickFormatter={timeFormatter}
                      interval="preserveStartEnd"
                      minTickGap={30}
                      allowDuplicatedCategory={false}
                      stroke="rgba(148,163,184,0.58)"
                      tick={{ fill: "rgba(100,116,139,0.95)", fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={true}
                      axisLine={true}
                      unit="ms"
                      allowDecimals={false}
                      orientation="left"
                      type="number"
                      tickMargin={10}
                      width={52}
                      tick={{ fill: "rgba(100,116,139,0.95)", fontSize: 11 }}
                      stroke="rgba(148,163,184,0.58)"
                    />
                    <ChartTooltip
                      cursor={false}
                      formatter={(v: any) => `${Math.round(v)} ms`}
                      content={<ChartTooltipContent labelFormatter={labelFormatter} indicator="dot" />}
                    />
                    {tasks.map((task, idx) => (
                      <Line
                        key={task.id}
                        dataKey={String(task.id)}
                        name={task.name}
                        stroke={colors[idx % colors.length]}
                        dot={false}
                        isAnimationActive={false}
                        strokeWidth={2}
                        connectNulls={false}
                        type={cutPeak ? "basis" : "linear"}
                        hide={!!hiddenLines[String(task.id)]}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </div>

          <div className="ds-ping-bottom-bar">
            <div className="ds-ping-bottom-left">
              <Switch id="cut-peak" checked={cutPeak} onCheckedChange={setCutPeak} />
              <label htmlFor="cut-peak" className="text-sm font-medium flex items-center gap-1 flex-row cursor-pointer">
                {t("chart.cutPeak")}
                <Tips>
                  <span dangerouslySetInnerHTML={{ __html: t("chart.cutPeak_tips") }} />
                </Tips>
              </label>
            </div>
            <Button variant="outline" size="sm" onClick={toggleAllLines} className="flex items-center gap-2">
              {tasks.every((task) => hiddenLines[String(task.id)]) ? (
                <><Eye size={16} />{t("chart.showAll")}</>
              ) : (
                <><EyeOff size={16} />{t("chart.hideAll")}</>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default PingChart;
