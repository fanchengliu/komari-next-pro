import { useEffect, useRef, useState } from "react";
import { MousePointer2, RotateCcw } from "lucide-react";
import { useModel } from "../../data/context";
import { useTranslate } from "../../data/i18n";
import { useSmallScreen } from "../../data/layout";
import {
  taskColor,
  type NetworkLine,
  type TimeWindow,
} from "../../domain/network";
import { formatWindow } from "./TimeControls";
import V from "../../ui/v2.module.css";
export default function NetworkChart({
  lines,
  window,
  onRange,
  smooth = false,
}: {
  lines: NetworkLine[];
  window: TimeWindow;
  onRange: (w: TimeWindow) => void;
  smooth?: boolean;
}) {
  const { nodes, settings } = useModel();
  const t = useTranslate();
  const small = useSmallScreen();
  const element = useRef<HTMLDivElement>(null),
    chart = useRef<import("echarts").ECharts | null>(null),
    callback = useRef(onRange);
  callback.current = onRange;
  const [ready, setReady] = useState(false),
    [selection, setSelection] = useState<TimeWindow | null>(null),
    [brush, setBrush] = useState(!small),
    [systemDark, setSystemDark] = useState(
      () => matchMedia("(prefers-color-scheme: dark)").matches,
    );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    let dead = false,
      observer: ResizeObserver | undefined;
    void import("../../ui/echarts").then((e) => {
      if (dead || !element.current) return;
      const instance = e.init(element.current, undefined, { renderer: "svg" });
      chart.current = instance;
      observer = new ResizeObserver(() => instance.resize());
      observer.observe(element.current);
      instance.on("brushEnd", (event: any) => {
        const range = event.areas?.[0]?.coordRange;
        if (
          Array.isArray(range) &&
          range.length === 2 &&
          range.every(Number.isFinite)
        ) {
          const start = Math.floor(Math.min(...range)),
            end = Math.ceil(Math.max(...range));
          setSelection(end - start >= 1000 ? { start, end } : null);
        }
      });
      setReady(true);
    });
    return () => {
      dead = true;
      observer?.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !chart.current) return;
    setSelection(null);
    const dark =
        settings.appearance === "dark" ||
        (settings.appearance === "system" && systemDark),
      color = dark ? "#b2c2d8" : "#74899f",
      nodeIds = [...new Set(lines.map((l) => l.nodeId))];
    const names = new Map(
      lines.map((l) => [
        l.id,
        `${nodes.find((n) => n.id === l.nodeId)?.name ?? l.nodeId} · ${l.name}`,
      ]),
    );
    chart.current.setOption(
      {
        animation: false,
        toolbox: { show: false },
        grid: {
          left: small ? 44 : 53,
          right: small ? 12 : 20,
          top: 26,
          bottom: 39,
        },
        tooltip: {
          trigger: "axis",
          triggerOn: "mousemove|click",
          renderMode: "richText",
          confine: true,
          backgroundColor: dark ? "#182a41" : "#203650",
          borderColor: "#b4c9e633",
          textStyle: { color: "#e9f2ff", fontSize: small ? 10 : 11 },
          formatter: (params: any[]) => {
            const visible = (Array.isArray(params) ? params : []).filter(
              (p) => Array.isArray(p.value) && p.value[1] !== null,
            );
            if (!visible.length) return t("无数据");
            const date = new Intl.DateTimeFormat(settings.locale, {
              timeZone: settings.timezone,
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            }).format(visible[0].value[0]);
            return [
              date,
              ...visible
                .slice(0, small ? 8 : 14)
                .map(
                  (p) =>
                    `${names.get(p.seriesName) ?? ""}  ${Number(p.value[1]).toFixed(1)} ms`,
                ),
              ...(visible.length > (small ? 8 : 14)
                ? [t("更多线路请查看下方汇总表")]
                : []),
            ].join("\n");
          },
        },
        xAxis: {
          type: "time",
          min: window.start,
          max: window.end,
          splitNumber: small ? 3 : 5,
          axisLine: { lineStyle: { color: "#829cb52d" } },
          axisTick: { show: false },
          axisLabel: {
            color,
            fontSize: small ? 10 : 11,
            hideOverlap: true,
            formatter: (v: number) =>
              new Intl.DateTimeFormat(settings.locale, {
                timeZone: settings.timezone,
                ...(window.end - window.start > 86400000
                  ? ({ month: "2-digit", day: "2-digit" } as const)
                  : {}),
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(v),
          },
        },
        yAxis: {
          type: "value",
          name: "ms",
          min: 0,
          nameTextStyle: { color, fontSize: 10 },
          axisLabel: { color, fontSize: 10 },
          splitLine: { lineStyle: { color: dark ? "#839abb21" : "#718ba41a" } },
        },
        brush: {
          xAxisIndex: 0,
          brushMode: "single",
          brushType: "lineX",
          transformable: false,
          removeOnClick: true,
          brushStyle: {
            color: "#4888e51b",
            borderColor: "#6396dd80",
            borderWidth: 1,
          },
        },
        dataZoom: [
          {
            type: "inside",
            xAxisIndex: 0,
            zoomOnMouseWheel: "ctrl",
            moveOnMouseMove: false,
            moveOnMouseWheel: false,
          },
        ],
        series: lines.map((l) => ({
          id: l.id,
          name: l.id,
          type: "line",
          data: l.latency.map((p) => [p.time, p.value]),
          connectNulls: false,
          smooth,
          showSymbol: false,
          symbolSize: 5,
          lineStyle: {
            color: taskColor(l.taskId),
            width: nodeIds.indexOf(l.nodeId) === 0 ? 2 : 1.6,
            type: ["solid", "dashed", "dotted", [9, 3, 2, 3]][
              nodeIds.indexOf(l.nodeId) % 4
            ],
          },
          itemStyle: { color: taskColor(l.taskId) },
          emphasis: { focus: "series" },
        })),
      },
      { notMerge: true },
    );
    chart.current.dispatchAction({
      type: "takeGlobalCursor",
      key: "brush",
      brushOption: { brushType: brush ? "lineX" : false, brushMode: "single" },
    });
  }, [
    ready,
    lines,
    window.start,
    window.end,
    settings.timezone,
    settings.locale,
    settings.appearance,
    systemDark,
    smooth,
    small,
    nodes,
  ]);
  useEffect(() => {
    if (ready)
      chart.current?.dispatchAction({
        type: "takeGlobalCursor",
        key: "brush",
        brushOption: {
          brushType: brush ? "lineX" : false,
          brushMode: "single",
        },
      });
  }, [ready, brush]);
  return (
    <div className={V.chartShell}>
      <div className={V.chartTop}>
        <div className={V.nodeLegend}>
          {[...new Set(lines.map((l) => l.nodeId))].map((id, i) => (
            <span key={id}>
              <i
                style={{
                  borderTopStyle: (
                    ["solid", "dashed", "dotted", "dashed"] as const
                  )[i % 4],
                }}
              />
              {nodes.find((n) => n.id === id)?.name ?? id}
            </span>
          ))}
        </div>
        <button
          className={V.smallButton}
          aria-pressed={brush}
          onClick={() => setBrush((v) => !v)}
        >
          <MousePointer2 size={12} />
          {t("框选时段")}
        </button>
      </div>
      <div
        ref={element}
        className={V.chart}
        role="img"
        aria-label={t("多线路延迟历史曲线")}
      />
      {!lines.some((l) => l.latency.some((p) => p.value !== null)) && (
        <p className={V.fieldNote}>
          {t("暂无有效延迟样本；失败探测仍计入下方丢包统计。")}
        </p>
      )}
      {selection && (
        <div className={V.brushNotice}>
          <span>
            {formatWindow(selection, settings.timezone, settings.locale)}
          </span>
          <button onClick={() => callback.current(selection)}>
            {t("查看此时段")}
          </button>
          <button
            aria-label={t("清除框选")}
            onClick={() => {
              setSelection(null);
              chart.current?.dispatchAction({ type: "brush", areas: [] });
            }}
          >
            <RotateCcw size={12} />
          </button>
        </div>
      )}
      <p className={V.chartHint}>
        {t("同色代表同一任务，线型区分节点。空白表示无有效样本。")}
        {lines.some((l) => l.summary.estimated) && ` · ${t("包含聚合数据")}`}
      </p>
    </div>
  );
}
