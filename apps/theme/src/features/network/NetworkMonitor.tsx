import { lazy, Suspense, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useModel } from "../../data/context";
import { useNetworkData } from "../../data/network";
import { useTranslate } from "../../data/i18n";
import { useSmallScreen } from "../../data/layout";
import {
  combineSummary,
  taskColor,
  timeBuckets,
  type TimeBucket,
  type TimeWindow,
} from "../../domain/network";
import { State } from "../../ui/primitives";
import { Flag } from "../../ui/Flag";
import { BucketTooltip } from "./BucketTooltip";
import V from "../../ui/v2.module.css";
const Plot = lazy(() => import("./NetworkChart"));
export const lossColor = (value: number | null) =>
  value === null
    ? "#a7b7c332"
    : value === 0
      ? "#79b6aa"
      : value < 1
        ? "#bdc591"
        : value < 5
          ? "#d8b46c"
          : "#d58f83";
export const latencyColor = (value: number | null) =>
  value === null
    ? "#a7b7c332"
    : value < 100
      ? "#53b5a6"
      : value < 180
        ? "#80adad"
        : value < 230
          ? "#d7b671"
          : "#d89678";
export function NetworkMonitor({
  ids,
  window,
  selectedTasks,
  onTasksChange,
  onRange,
  commonOnly = false,
  onCommonChange,
  enabled = true,
}: {
  ids: string[];
  window: TimeWindow;
  selectedTasks: string[] | null;
  onTasksChange: (tasks: string[] | null) => void;
  onRange: (w: TimeWindow) => void;
  commonOnly?: boolean;
  onCommonChange?: (v: boolean) => void;
  enabled?: boolean;
}) {
  const { nodes, settings } = useModel();
  const t = useTranslate(),
    small = useSmallScreen();
  const query = useNetworkData(ids, window, {
    enabled,
    maxPoints: small ? 180 : 360,
  });
  const [smooth, setSmooth] = useState(false),
    [tooltip, setTooltip] = useState<{
      bucket: TimeBucket;
      x: number;
      y: number;
      name?: string;
    } | null>(null);
  const available = useMemo(() => {
    const map = new Map(
      query.tasks
        .filter((task) => task.clients.some((id) => ids.includes(id)))
        .map((task) => [task.id, task.name]),
    );
    for (const line of query.data?.lines ?? []) map.set(line.taskId, line.name);
    return [...map]
      .map(([id, name]) => ({ id, name }))
      .filter(
        (task) =>
          !commonOnly ||
          ids.every(
            (nodeId) =>
              query.tasks.some(
                (t) => t.id === task.id && t.clients.includes(nodeId),
              ) ||
              query.data?.lines.some(
                (l) =>
                  l.nodeId === nodeId &&
                  l.taskId === task.id &&
                  (l.latency.length || l.loss.length),
              ),
          ),
      );
  }, [query.tasks, query.data, ids, commonOnly]);
  const actualSelected = useMemo(
    () =>
      selectedTasks === null
        ? available.map((t) => t.id)
        : selectedTasks.filter((id) => available.some((t) => t.id === id)),
    [selectedTasks, available],
  );
  const lines = useMemo(
    () =>
      query.data?.lines.filter(
        (l) => ids.includes(l.nodeId) && actualSelected.includes(l.taskId),
      ) ?? [],
    [query.data, ids, actualSelected],
  );
  const summary = useMemo(() => combineSummary(lines), [lines]);
  const rows = useMemo(
    () =>
      lines.map((line) => ({
        line,
        buckets: timeBuckets([line], window, small ? 24 : 48),
      })),
    [lines, window.start, window.end, small],
  );
  const toggle = (id: string, value: boolean) =>
    onTasksChange(
      value ? [...actualSelected, id] : actualSelected.filter((x) => x !== id),
    );
  if (!ids.length)
    return (
      <div className={V.panel}>
        <State empty={t("请选择需要比较的节点")} />
      </div>
    );
  return (
    <>
      <section className={`${V.panel} ${V.selectionPanel}`}>
        <div className={V.selectionRow}>
          <div className={V.chips}>
            <span className={V.sectionLabel}>{t("监测任务")}</span>
            {available.map((task) => (
              <label
                className={V.routeChip}
                data-hidden={!actualSelected.includes(task.id)}
                key={task.id}
              >
                <input
                  type="checkbox"
                  aria-label={task.name}
                  checked={actualSelected.includes(task.id)}
                  onChange={(e) => toggle(task.id, e.target.checked)}
                />
                <i style={{ background: taskColor(task.id) }} />
                {task.name}
              </label>
            ))}
            {!available.length && (
              <span className={V.fieldNote}>
                {t("所选节点暂无可用监测任务")}
              </span>
            )}
          </div>
          <div className={V.actions}>
            {onCommonChange && (
              <label className={V.check}>
                <input
                  type="checkbox"
                  checked={commonOnly}
                  onChange={(e) => onCommonChange(e.target.checked)}
                />
                {t("仅共同任务")}
              </label>
            )}
            <button
              className={V.smallButton}
              onClick={() => onTasksChange(actualSelected.length ? [] : null)}
            >
              {actualSelected.length ? t("隐藏全部") : t("显示全部")}
            </button>
            <button
              className={V.smallButton}
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              aria-label={t("刷新网络数据")}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
        {query.tasksError && (
          <p className={V.fieldNote}>
            {t("任务元信息未就绪，使用已返回的任务标识。")}
          </p>
        )}
      </section>
      {query.isPending && enabled ? (
        <State busy />
      ) : query.error ? (
        <div className={V.error} role="alert">
          {query.error.message}
          <button
            className={V.smallButton}
            onClick={() => void query.refetch()}
          >
            {t("重试")}
          </button>
        </div>
      ) : query.data ? (
        <>
          <div className={V.kpis}>
            {[
              [
                t("平均延迟"),
                summary.average?.toFixed(1) ?? "--",
                "ms",
                t("按有效样本加权"),
              ],
              [
                t("P95 延迟"),
                summary.p95?.toFixed(1) ?? "--",
                "ms",
                summary.estimated ? t("聚合样本估算") : t("按当前样本计算"),
              ],
              [
                t("平均丢包"),
                summary.loss?.toFixed(2) ?? "--",
                "%",
                `${Math.round(summary.total)} ${t("个统计样本")}`,
              ],
              [
                t("监测任务"),
                String(actualSelected.length),
                t("条"),
                `${ids.length} ${t("台节点")}`,
              ],
            ].map(([label, value, unit, note]) => (
              <div key={label} className={V.kpi}>
                <small>{label}</small>
                <strong>
                  {value}
                  <small>{unit}</small>
                </strong>
                <p>{note}</p>
              </div>
            ))}
          </div>
          <section className={V.panel}>
            <div className={V.panelHeader}>
              <div>
                <h2>{t("线路延迟对比")}</h2>
                <p>{t("相同时间窗口，按任务与节点区分曲线")}</p>
              </div>
              <label className={V.check}>
                <input
                  type="checkbox"
                  checked={smooth}
                  onChange={(e) => setSmooth(e.target.checked)}
                />
                {t("平滑显示")}
              </label>
            </div>
            {actualSelected.length ? (
              <Suspense fallback={<State busy />}>
                <Plot
                  lines={lines}
                  window={window}
                  onRange={onRange}
                  smooth={smooth}
                />
              </Suspense>
            ) : (
              <State empty={t("已隐藏全部线路，请选择任务")} />
            )}
            <div className={V.lossPanel}>
              <div className={V.lossTitle}>
                <strong>{t("丢包时间分布")}</strong>
                <span>{t("每格对应一个时间桶；悬停查看样本")}</span>
              </div>
              {rows.map(({ line, buckets }) => (
                <div className={V.lossRow} key={line.id}>
                  <span
                    title={`${nodes.find((n) => n.id === line.nodeId)?.name} · ${line.name}`}
                  >
                    {ids.length > 1
                      ? `${nodes.find((n) => n.id === line.nodeId)?.name} · `
                      : ""}
                    {line.name}
                  </span>
                  <div
                    className={V.lossCells}
                    style={{ "--cells": buckets.length } as React.CSSProperties}
                  >
                    {buckets.map((bucket, i) => (
                      <button
                        key={i}
                        data-empty={bucket.loss === null}
                        style={{ background: lossColor(bucket.loss) }}
                        aria-label={`${line.name} ${new Date(bucket.start).toLocaleTimeString(settings.locale, { timeZone: settings.timezone })} ${t("丢包")} ${bucket.loss === null ? t("无样本") : bucket.loss.toFixed(1) + "%"}`}
                        onMouseEnter={(e) =>
                          setTooltip({
                            bucket,
                            x: e.clientX,
                            y: e.clientY,
                            name: line.name,
                          })
                        }
                        onMouseMove={(e) =>
                          setTooltip({
                            bucket,
                            x: e.clientX,
                            y: e.clientY,
                            name: line.name,
                          })
                        }
                        onFocus={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setTooltip({
                            bucket,
                            x: r.left,
                            y: r.top,
                            name: line.name,
                          });
                        }}
                        onBlur={() => setTooltip(null)}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => {
                          setTooltip(null);
                          onRange({ start: bucket.start, end: bucket.end });
                        }}
                      />
                    ))}
                  </div>
                  <b>
                    {line.summary.loss === null
                      ? "--"
                      : `${line.summary.loss.toFixed(1)}%`}
                  </b>
                </div>
              ))}
              <div className={V.chartFoot}>
                <span>
                  {new Date(window.start).toLocaleString(settings.locale, {
                    timeZone: settings.timezone,
                  })}
                </span>
                <span>{t("无样本")} ▧　0% ▪　5% ▪</span>
                <span>
                  {new Date(window.end).toLocaleString(settings.locale, {
                    timeZone: settings.timezone,
                  })}
                </span>
              </div>
            </div>
            {query.data.warnings.map((note) => (
              <p key={note} className={V.notice}>
                {t(note)}
              </p>
            ))}
          </section>
          <section className={V.panel}>
            <div className={V.panelHeader}>
              <div>
                <h2>{t("所选时段汇总")}</h2>
                <p>{t("覆盖时段与样本量不同的线路不能直接推断优劣")}</p>
              </div>
              {summary.estimated && (
                <span className={V.softBadge}>{t("包含聚合数据")}</span>
              )}
            </div>
            <div className={V.tableWrap}>
              <table className={V.table}>
                <thead>
                  <tr>
                    {[
                      "节点",
                      "监测任务",
                      "平均延迟",
                      "P95 延迟",
                      "最高延迟",
                      "丢包率",
                      "有效 / 总样本",
                      "覆盖时段",
                    ].map((h) => (
                      <th key={h}>{t(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className={V.name}>
                          <Flag
                            region={
                              nodes.find((n) => n.id === l.nodeId)?.region ?? ""
                            }
                          />
                          {nodes.find((n) => n.id === l.nodeId)?.name ?? ""}
                        </span>
                      </td>
                      <td>{l.name}</td>
                      <td>{l.summary.average?.toFixed(1) ?? "--"} ms</td>
                      <td
                        title={
                          l.summary.estimated
                            ? t("基于聚合桶的分位数估算")
                            : t("按当前样本计算")
                        }
                      >
                        {l.summary.p95?.toFixed(1) ?? "--"} ms{" "}
                        {l.summary.estimated ? "≈" : ""}
                      </td>
                      <td>{l.summary.max?.toFixed(1) ?? "--"} ms</td>
                      <td>
                        {l.summary.loss === null
                          ? "--"
                          : `${l.summary.loss.toFixed(2)}%`}
                      </td>
                      <td>
                        {Math.round(l.summary.valid)} /{" "}
                        {Math.round(l.summary.total)}
                      </td>
                      <td>
                        {l.summary.coverageStart !== null &&
                        l.summary.coverageEnd !== null
                          ? `${new Date(Math.max(window.start, l.summary.coverageStart)).toLocaleTimeString(settings.locale, { timeZone: settings.timezone })} — ${new Date(Math.min(window.end, l.summary.coverageEnd)).toLocaleTimeString(settings.locale, { timeZone: settings.timezone })}`
                          : t("无样本")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!lines.length && <State empty={t("所选时段没有保留数据")} />}
          </section>
        </>
      ) : null}
      {tooltip && (
        <BucketTooltip
          {...tooltip}
          zone={settings.timezone}
          locale={settings.locale}
        />
      )}
    </>
  );
}
