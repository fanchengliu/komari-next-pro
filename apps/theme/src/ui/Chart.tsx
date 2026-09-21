import { useEffect, useRef } from "react";
import { S } from "./primitives";
import { useModel } from "../data/context";
import { bytes } from "../domain/model";
export interface Line {
  name: string;
  color: string;
  points: [number, number | null][];
}
export default function Chart({
  lines,
  unit = "",
  smooth = false,
}: {
  lines: Line[];
  unit?: string;
  smooth?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { settings } = useModel();
  useEffect(() => {
    let cancelled = false;
    let chart: import("echarts").ECharts | undefined;
    let observer: ResizeObserver | undefined;
    void import("./echarts").then((e) => {
      if (cancelled || !ref.current) return;
      chart = e.init(ref.current, undefined, { renderer: "svg" });
      const textColor = settings.appearance === "dark" ? "#a7b5c9" : "#69727e";
      const times = lines
        .flatMap((l) => l.points.map((p) => p[0]))
        .filter(Number.isFinite);
      const multiDay =
        times.length > 0 && Math.max(...times) - Math.min(...times) > 86400000;
      chart.setOption({
        animation: false,
        color: lines.map((l) => l.color),
        tooltip: {
          trigger: "axis",
          renderMode: "richText",
          valueFormatter: (v: unknown) =>
            typeof v === "number" ? `${v.toFixed(2)}${unit}` : "--",
        },
        grid: { left: 58, right: 18, top: 20, bottom: 64 },
        legend: { bottom: 0, textStyle: { fontSize: 11, color: textColor } },
        xAxis: {
          type: "time",
          splitNumber: 5,
          axisLabel: {
            color: textColor,
            fontSize: 11,
            hideOverlap: true,
            formatter: (v: number) =>
              new Intl.DateTimeFormat(settings.locale, {
                timeZone: settings.timezone,
                ...(multiDay
                  ? ({ month: "2-digit", day: "2-digit" } as const)
                  : {}),
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(v),
          },
          axisLine: { lineStyle: { color: "#8796a433" } },
          splitLine: { show: false },
        },
        yAxis: {
          type: "value",
          min: 0,
          max: unit === "%" ? 100 : undefined,
          axisLabel: {
            color: textColor,
            fontSize: 11,
            formatter: (v: number) =>
              unit === " B/s" ? bytes(v) : String(v) + unit,
          },
          splitLine: { lineStyle: { color: "#8796a419" } },
        },
        series: lines.map((l) => ({
          type: "line",
          name: l.name,
          data: l.points,
          showSymbol: false,
          smooth,
          connectNulls: false,
          lineStyle: { width: 1.5 },
          areaStyle: unit === " B/s" ? { opacity: 0.1 } : undefined,
        })),
      });
      observer = new ResizeObserver(() => chart?.resize());
      observer.observe(ref.current);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      chart?.dispose();
    };
  }, [
    lines,
    unit,
    smooth,
    settings.appearance,
    settings.locale,
    settings.timezone,
  ]);
  return (
    <div
      className={S.chart}
      ref={ref}
      role="img"
      aria-label={lines.map((l) => l.name).join("、") + " 历史曲线"}
    />
  );
}
