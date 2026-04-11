import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import Loading from "@/components/loading";
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { useTranslation } from "react-i18next";
import { cutPeakValues, interpolateNullsLinear } from "@/utils/RecordHelper";
import Tips from "./ui/tips";
import { useRPC2Call } from "@/contexts/RPC2Context";

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
}
// 移除旧 REST 类型，改用 RPC2 返回结构

//const MAX_POINTS = 1000;
const colors = [
  "#F38181",
  "#347433",
  "#898AC4",
  "#03A6A1",
  "#7AD6F0",
  "#B388FF",
  "#FF8A65",
  "#FFD600",
];

interface MiniPingChartProps {
  uuid: string;
  width?: string | number;
  height?: string | number;
  hours?: number; // Add hours as an optional prop
}

const MiniPingChart = ({
  uuid,
  width = "100%",
  height = 300,
  hours = 12,
}: MiniPingChartProps) => {
  const [remoteData, setRemoteData] = useState<PingRecord[] | null>(null);
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({});
  const [t] = useTranslation();
  const [cutPeak, setCutPeak] = useState(false);
  const { call } = useRPC2Call();
  useEffect(() => {
    if (!uuid) return;

    setLoading(true);
    setError(null);
    (async () => {
      try {
        type RpcResp = { count: number; records: PingRecord[]; tasks?: TaskInfo[] };
        const result = await call<any, RpcResp>("common:getRecords", { uuid, type: "ping", hours });
        const records = result?.records || [];
        records.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        setRemoteData(records);
        setTasks(result?.tasks || []);
        setLoading(false);
      } catch (err: any) {
        setError(err?.message || "Error");
        setLoading(false);
      }
    })();
  }, [uuid, hours]);

  const chartData = useMemo(() => {
    // 思路：仅保留真实采样时间点（各任务原始时间点的并集），
    // 不再用最小间隔对整段时间做补点，否则长间隔任务会被大量 null 分割成若干段。
    const data = remoteData || [];
    if (!data.length) return [];

    // 动态匹配容差：取各任务最小 interval * 0.4（秒）转换为 ms，范围 [800ms, 1500ms]
    const validIntervals = tasks
      .map((t) => t.interval)
      .filter((v): v is number => typeof v === "number" && v > 0);
    const minTaskInterval = validIntervals.length
      ? Math.min(...validIntervals)
      : 60;
    const toleranceMs = Math.min(
      1500,
      Math.max(800, (minTaskInterval * 1000 * 0.4) | 0)
    );

    const grouped: Record<string, any> = {}; // key: anchor timestamp(ms)
    const anchors: number[] = [];

    for (const rec of data) {
      const ts = new Date(rec.time).getTime();
      let anchor: number | null = null;
      // 线性扫描量通常较小（点数有限），后续如需优化可改为二分。
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
      grouped[use][rec.task_id] = rec.value < 0 ? null : rec.value; // 负值隐藏
    }

    let rows = Object.values(grouped).sort(
      (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    if (cutPeak && tasks.length > 0) {
      const taskKeys = tasks.map((t) => String(t.id));
      rows = cutPeakValues(rows, taskKeys);
    }

    // 真实感插值（数据驱动）：
    // 每条线以“中位采样间隔 * 倍数(默认6)”作为最大插值跨度，并钳制在 [2min, 30min]。
    if (tasks.length > 0 && rows.length > 0) {
      const keys = tasks.map((t) => String(t.id));
      rows = interpolateNullsLinear(rows as any[], keys, { maxGapMultiplier: 6, minCapMs: 2 * 60_000, maxCapMs: 30 * 60_000 }) as any[];
    }

    return rows;
  }, [remoteData, cutPeak, tasks]);

  const timeFormatter = (value: any, index: number) => {
    if (!chartData.length) return "";
    if (index === 0 || index === chartData.length - 1) {
      return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "";
  };

  const chartConfig = useMemo(() => {
    const config: Record<string, any> = {};
    tasks.forEach((task, idx) => {
      config[task.id] = {
        label: task.name,
        color: colors[idx % colors.length],
      };
    });
    return config;
  }, [tasks]);

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const date = new Date(label);
    const formattedDate = date.toLocaleString([], {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="text-xs text-muted-foreground mb-2">{formattedDate}</div>
        <div className="grid gap-1">
          {payload.map((entry: any, index: number) => {
            if (entry.value === null) return null;
            const task = tasks.find(t => String(t.id) === entry.dataKey);
            if (!task) return null;

            const lossText = typeof task.loss === 'number' ? `${task.loss.toFixed(1)}%` : 'N/A';
            const volText = typeof task.p99_p50_ratio === 'number' ? task.p99_p50_ratio.toFixed(1) : 'N/A';

            return (
              <div key={index} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="font-medium text-sm">{task.name}</span>
                </div>
                <div className="ml-4 text-xs">
                  <div>{Math.round(entry.value)} ms</div>
                  <div className="text-muted-foreground">
                    {lossText} {t('chart.lossRate')} / {volText} {t('chart.volatility')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [tasks, t]);

  const handleLegendClick = useCallback((e: any) => {
    const key = e.dataKey;
    setHiddenLines((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <Card
      style={{ width, maxWidth: "100%", height: 'auto', minHeight: height }}
      className="flex w-full min-w-0 max-w-full flex-col gap-2 overflow-hidden p-3"
    >
      {loading && (
        <div
          className="w-full flex-grow flex items-center justify-center"
          style={{ minHeight: typeof height === 'number' ? `${height - 100}px` : '200px' }}
        >
          <Loading />
        </div>
      )}
      {error && (
        <div
          className="w-full flex-grow flex items-center justify-center text-destructive"
          style={{ minHeight: typeof height === 'number' ? `${height - 100}px` : '200px' }}
        >
          {error}
        </div>
      )}
      {!loading && !error && chartData.length === 0 ? (
        <div className="w-full flex items-center justify-center text-muted-foreground" style={{ minHeight: typeof height === 'number' ? `${height - 100}px` : '200px' }}>
          {t("nodeCard.noPingData")}
        </div>
      ) : (
        !loading &&
        !error && (
          <ChartContainer
            config={chartConfig}
            className="w-full min-w-0 max-w-full overflow-hidden"
            style={{ height: typeof height === 'number' ? `${height - 80}px` : '220px' }}
          >
            <LineChart
              data={chartData}
              accessibilityLayer
              margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickFormatter={timeFormatter}
                interval="preserveStartEnd" // Preserve start and end ticks
                minTickGap={30} // Minimum gap between ticks to prevent overlap
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                unit="ms"
                allowDecimals={false}
                orientation="left"
                type="number"
                tick={{ dx: -10 }}
                mirror={true}
              />
              <ChartTooltip
                cursor={false}
                content={<CustomTooltip />}
              />
              <ChartLegend
                onClick={handleLegendClick}
                content={
                  <ChartLegendContent className="flex-wrap justify-start gap-x-3 gap-y-2 text-xs" />
                }
              />
              {(() => {
                const minInterval = Math.min(
                  ...tasks
                    .map((t) => t.interval || Infinity)
                    .filter((v) => v !== undefined)
                );
                return tasks.map((task, idx) => {
                  const interval = task.interval || minInterval;
                  // 对于 interval 大于最小 interval 的任务，开启 connectNulls，
                  // 这样它们不会因为其他任务的额外时间点被打断。
                  const connect = interval > minInterval;
                  return (
                    <Line
                      key={task.id}
                      dataKey={String(task.id)}
                      name={task.name}
                      stroke={colors[idx % colors.length]}
                      dot={false}
                      isAnimationActive={false}
                      strokeWidth={2}
                      connectNulls={connect}
                      type={cutPeak ? "basisOpen" : "linear"}
                      hide={!!hiddenLines[task.id]}
                    />
                  );
                });
              })()}
            </LineChart>
          </ChartContainer>
        )
      )}
      <div className="flex items-center gap-2 pt-1" style={{ display: loading ? "none" : "flex" }}>
        <Switch id="cut-peak" checked={cutPeak} onCheckedChange={setCutPeak} />
        <label htmlFor="cut-peak" className="text-sm font-medium flex items-center gap-1 flex-row cursor-pointer">
          {t("chart.cutPeak")}
          <Tips mode="popup" side="top"><span dangerouslySetInnerHTML={{ __html: t("chart.cutPeak_tips") }} /></Tips>
        </label>

      </div>
    </Card>
  );
};

export default MiniPingChart;
