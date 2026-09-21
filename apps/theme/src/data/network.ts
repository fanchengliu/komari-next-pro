import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MetricResponse } from "../../../../packages/contracts";
import {
  normalizeNetwork,
  type NetworkPayload,
  type PingStatsResponse,
  type TimeWindow,
} from "../domain/network";
import { useModel } from "./context";
import { ApiError, rpc } from "./rpc";
export function useClockWindow(hours: number, enabled = true) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 30000) * 30000);
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      if (!document.hidden) setNow(Math.floor(Date.now() / 30000) * 30000);
    };
    update();
    const timer = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [enabled]);
  return useMemo(
    () => ({ start: now - hours * 3600000, end: now }),
    [hours, now],
  );
}
export function usePingTasks() {
  const { tasks, tasksError } = useModel();
  return { tasks, error: tasksError };
}
/** Same start/end, resolution and selected entity set for both directions and every node. */
export async function fetchNetwork(
  ids: string[],
  window: TimeWindow,
  maxPoints: number,
  withStats: boolean,
  signal: AbortSignal,
): Promise<{
  metrics: MetricResponse;
  stats?: PingStatsResponse;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const series: MetricResponse["series"] = [],
    stats: PingStatsResponse["stats"] = [];
  const start = new Date(window.start).toISOString(),
    end = new Date(window.end).toISOString();
  for (let offset = 0; offset < ids.length; offset += 24) {
    signal.throwIfAborted();
    const entity_ids = ids.slice(offset, offset + 24);
    const result = await rpc.call<MetricResponse>(
      "public:queryMetrics",
      {
        entity_ids,
        metric_keys: ["ping.latency_ms", "ping.loss"],
        start,
        end,
        max_points: maxPoints,
        aggregation: "avg",
        fill_empty: true,
      },
      signal,
    );
    if (!result || !Array.isArray(result.series))
      throw new Error("网络指标响应格式无效");
    series.push(...result.series);
    if (withStats) {
      try {
        const result = await rpc.call<PingStatsResponse>(
          "public:getPingMetricStats",
          { entity_ids, start, end, max_points: Math.max(maxPoints, 500) },
          signal,
        );
        if (Array.isArray(result?.stats)) stats.push(...result.stats);
      } catch (error) {
        if (signal.aborted) throw error;
        if (error instanceof ApiError && [401, 403].includes(error.code))
          throw error;
        warnings.push("汇总接口不可用，当前统计由已返回样本计算");
      }
    }
  }
  return {
    metrics: { series, start, end },
    stats: withStats ? { start, end, stats } : undefined,
    warnings,
  };
}
export function useNetworkData(
  requestedIds: string[],
  window: TimeWindow,
  {
    enabled = true,
    maxPoints = 240,
    withStats = true,
    retainPrevious = false,
  }: {
    enabled?: boolean;
    maxPoints?: number;
    withStats?: boolean;
    retainPrevious?: boolean;
  } = {},
) {
  const { identity, nodes } = useModel();
  const tasksQuery = usePingTasks();
  const idKey = requestedIds
    .filter((id) => nodes.some((n) => n.id === id))
    .sort()
    .join("\u0000");
  const ids = useMemo(() => (idKey ? idKey.split("\u0000") : []), [idKey]);
  const query = useQuery({
    queryKey: [
      "session",
      identity,
      "network",
      idKey,
      window.start,
      window.end,
      maxPoints,
      withStats,
    ],
    queryFn: ({ signal }) =>
      fetchNetwork(ids, window, maxPoints, withStats, signal),
    enabled: enabled && ids.length > 0 && identity !== "pending",
    staleTime: 60000,
    gcTime: 120000,
    refetchOnWindowFocus: false,
    placeholderData: (previous, previousQuery) =>
      retainPrevious && previousQuery?.queryKey[1] === identity
        ? previous
        : undefined,
  });
  const data = useMemo<NetworkPayload | undefined>(() => {
    if (!query.data) return undefined;
    const payload = normalizeNetwork(
      query.data.metrics,
      query.isPlaceholderData
        ? {
            start: Date.parse(query.data.metrics.start),
            end: Date.parse(query.data.metrics.end),
          }
        : window,
      tasksQuery.tasks,
      ids,
      query.data.stats,
    );
    return {
      ...payload,
      warnings: [...new Set([...payload.warnings, ...query.data.warnings])],
    };
  }, [
    query.data,
    query.isPlaceholderData,
    window.start,
    window.end,
    tasksQuery.tasks,
    ids,
  ]);
  return {
    ...query,
    data,
    tasks: tasksQuery.tasks,
    tasksError: tasksQuery.error,
  };
}
