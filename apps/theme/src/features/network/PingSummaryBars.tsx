import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Activity, Wifi } from "lucide-react";
import { useModel } from "../../data/context";
import { useClockWindow, useNetworkData } from "../../data/network";
import { useVisible } from "../../data/visibility";
import { useTranslate } from "../../data/i18n";
import { useUI } from "../../data/store";
import {
  combineSummary,
  timeBuckets,
  type NetworkPayload,
  type TimeBucket,
  type TimeWindow,
} from "../../domain/network";
import { BucketTooltip } from "./BucketTooltip";
import { latencyColor, lossColor } from "./NetworkMonitor";
import V from "../../ui/v2.module.css";
import { selectHomeNetwork } from "../../domain/home-network";
import type { PingTask } from "../../domain/network";
type Batch = {
  register: (key: string, id: string, visible: boolean) => void;
  payload?: NetworkPayload;
  window: TimeWindow;
  loading: boolean;
  error: Error | null;
  zone: string;
  locale: string;
  taskIds: string[];
  mode: "auto" | "all" | "custom";
  tasks: PingTask[];
  refresh: () => void;
};
const Context = createContext<Batch | null>(null);
export function PingSummaryProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const { settings, identity, nodes, tasks } = useModel();
  const [registry, setRegistry] = useState<Map<string, string>>(new Map());
  const register = useCallback(
    (key: string, id: string, visible: boolean) =>
      setRegistry((old) => {
        if ((visible && old.get(key) === id) || (!visible && !old.has(key)))
          return old;
        const next = new Map(old);
        if (visible) next.set(key, id);
        else next.delete(key);
        return next;
      }),
    [],
  );
  const [ids, setIds] = useState<string[]>([]);
  const visibleKey = [...new Set(registry.values())]
    .filter((id) => nodes.some((n) => n.id === id))
    .sort()
    .join("\u0000");
  useEffect(() => {
    const timer = setTimeout(
      () => setIds(visibleKey ? visibleKey.split("\u0000") : []),
      120,
    );
    return () => clearTimeout(timer);
  }, [visibleKey]);
  const window = useClockWindow(
    settings.pingHistoryHours,
    enabled && ids.length > 0,
  );
  const query = useNetworkData(ids, window, {
    enabled: enabled && ids.length > 0,
    maxPoints: 48,
    withStats: false,
    retainPrevious: true,
  });
  const value = useMemo<Batch>(
    () => ({
      register,
      payload: query.data,
      window: query.data?.window ?? window,
      loading: query.isPending || visibleKey !== ids.join("\u0000"),
      error: query.error,
      zone: settings.timezone,
      locale: settings.locale,
      taskIds: settings.pingTaskIds,
      mode: settings.pingMode,
      tasks,
      refresh: () => void query.refetch(),
    }),
    [
      register,
      query.data,
      query.error,
      query.isPending,
      window,
      settings.timezone,
      settings.locale,
      settings.pingTaskIds,
      settings.pingMode,
      tasks,
      visibleKey,
      ids,
      enabled,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const PingSummaryBars = memo(function PingSummaryBars({
  nodeId,
}: {
  nodeId: string;
}) {
  const batch = useContext(Context);
  const key = useId(),
    t = useTranslate();
  const { ref, visible } = useVisible<HTMLDivElement>();
  const open = useUI((s) => s.set);
  const [tip, setTip] = useState<{
    bucket: TimeBucket;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    batch?.register(key, nodeId, visible);
    return () => batch?.register(key, nodeId, false);
  }, [batch?.register, key, nodeId, visible]);
  const selection = useMemo(
    () =>
      selectHomeNetwork(
        batch?.payload?.lines ?? [],
        nodeId,
        batch?.tasks ?? [],
        batch?.mode ?? "auto",
        batch?.taskIds ?? [],
      ),
    [batch?.payload, nodeId, batch?.tasks, batch?.mode, batch?.taskIds],
  );
  const lines = selection.lines;
  const buckets = useMemo(
    () => (batch ? timeBuckets(lines, batch.window, 24) : []),
    [lines, batch?.window],
  );
  const summary = useMemo(() => combineSummary(lines), [lines]);
  const openBucket = (bucket?: TimeBucket) => {
    setTip(null);
    open({
      pingTarget: {
        id: nodeId,
        tasks: selection.taskIds,
        ...(bucket ? { start: bucket.start, end: bucket.end } : {}),
      },
    });
  };
  return (
    <div ref={ref} className={V.strip} data-ping-node={nodeId}>
      <div className={V.stripScope}>
        <span title={selection.names.join(" / ")}>
          {selection.names.length === 1
            ? selection.names[0]
            : `${t(selection.scope === "tcp" ? "TCP 线路" : selection.scope === "custom" ? "自选线路" : "全部线路")} · ${selection.names.length}`}
        </span>
        <span>
          {batch ? (batch.window.end - batch.window.start) / 3600000 : 1} h
        </span>
      </div>
      {batch?.error ? (
        <div className={V.stripError}>
          <span>{t("网络历史暂不可用")}</span>
          <button onClick={() => openBucket()}>{t("查看详情")}</button>
          <button onClick={batch.refresh}>{t("重试")}</button>
        </div>
      ) : batch?.loading && !batch.payload ? (
        <div className={V.stripLoading}>
          {visible ? t("正在读取网络历史…") : t("网络历史")}
        </div>
      ) : (
        (["latency", "loss"] as const).map((kind, i) => {
          const value = kind === "latency" ? summary.average : summary.loss;
          return (
            <button
              className={V.stripButton}
              key={kind}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const raw = (e.target as HTMLElement).closest<HTMLElement>(
                  "[data-index]",
                )?.dataset.index;
                openBucket(
                  raw === undefined ? undefined : buckets[Number(raw)],
                );
              }}
              aria-label={`${t(kind === "latency" ? "延迟" : "丢包")} · ${t("打开监测详情")}`}
            >
              <div className={V.stripHead}>
                <span>
                  {i === 0 ? <Activity size={12} /> : <Wifi size={12} />}{" "}
                  {t(kind === "latency" ? "延迟" : "丢包")}
                </span>
                <b>
                  {value === null
                    ? "--"
                    : `${value.toFixed(i === 0 ? 0 : 1)} ${i === 0 ? "ms" : "%"}`}
                </b>
              </div>
              <div
                className={V.stripCells}
                style={{ "--cells": buckets.length || 24 } as CSSProperties}
              >
                {buckets.map((b, index) => (
                  <span
                    key={index}
                    data-index={index}
                    data-empty={b[kind] === null}
                    style={{
                      background:
                        kind === "latency"
                          ? latencyColor(b.latency)
                          : lossColor(b.loss),
                      height:
                        kind === "latency" && b.latency !== null
                          ? `${Math.max(35, Math.min(100, (b.latency / 300) * 100))}%`
                          : "100%",
                    }}
                    onMouseEnter={(e) =>
                      setTip({ bucket: b, x: e.clientX, y: e.clientY })
                    }
                    onMouseMove={(e) =>
                      setTip({ bucket: b, x: e.clientX, y: e.clientY })
                    }
                    onMouseLeave={() => setTip(null)}
                    title={`${new Date(b.start).toLocaleTimeString(batch?.locale, { timeZone: batch?.zone })} ${b[kind] === null ? t("无样本") : b[kind]!.toFixed(1) + (kind === "latency" ? " ms" : "%")}`}
                  />
                ))}
              </div>
            </button>
          );
        })
      )}
      {tip && batch && (
        <BucketTooltip {...tip} zone={batch.zone} locale={batch.locale} />
      )}
    </div>
  );
});
