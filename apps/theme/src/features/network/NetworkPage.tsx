import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Columns3 } from "lucide-react";
import { useModel } from "../../data/context";
import { useClockWindow } from "../../data/network";
import { useTranslate } from "../../data/i18n";
import { useUI } from "../../data/store";
import {
  selectVisibleIds,
  type NetworkPreset,
  type TimeWindow,
} from "../../domain/network";
import { presetWindow, validateWindow } from "../../domain/time-window";
import { PageHeader } from "../../ui/PageHeader";
import { State } from "../../ui/primitives";
import { Freshness } from "../../ui/Freshness";
import { SelectedNodes } from "./NodePicker";
import { TimeControls, type TimeChoice } from "./TimeControls";
import { NetworkMonitor } from "./NetworkMonitor";
import V from "../../ui/v2.module.css";
export function NetworkPage() {
  const { nodes, statuses, loading, settings, site, identity } = useModel();
  const t = useTranslate();
  const [params, setParams] = useSearchParams();
  const compareIds = useUI((s) => s.compareIds);
  const nowWindow = useClockWindow(1, !params.has("from"));
  const rawIds = params.get("nodes") ?? "";
  const ids = useMemo(
    () => selectVisibleIds(rawIds.split(",").filter(Boolean), nodes),
    [rawIds, nodes],
  );
  useEffect(() => {
    if (loading || !nodes.length || params.has("nodes")) return;
    const preferred = compareIds.length
      ? compareIds
      : nodes
          .filter((n) => statuses[n.id]?.ping.length)
          .slice(0, 2)
          .map((n) => n.id);
    const initial = selectVisibleIds(
      preferred.length ? preferred : nodes.slice(0, 2).map((n) => n.id),
      nodes,
    );
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set("nodes", initial.join(","));
        return next;
      },
      { replace: true },
    );
  }, [loading, nodes, params, compareIds, statuses, setParams]);
  const hasFixed = params.has("from") || params.has("to");
  const preset: NetworkPreset = hasFixed
    ? "custom"
    : ((["1h", "6h", "24h", "7d", "peak"].includes(params.get("range") ?? "")
        ? params.get("range")
        : "6h") as NetworkPreset);
  const range = useMemo(() => {
    try {
      return {
        window: hasFixed
          ? {
              start: Date.parse(params.get("from") ?? ""),
              end: Date.parse(params.get("to") ?? ""),
            }
          : presetWindow(
              preset as Exclude<NetworkPreset, "custom">,
              settings.timezone,
              nowWindow.end,
              params.get("day") ?? undefined,
            ),
        error: null as string | null,
      };
    } catch (e) {
      return { window: nowWindow, error: (e as Error).message };
    }
  }, [hasFixed, params.toString(), preset, settings.timezone, nowWindow.end]);
  const error =
    range.error ??
    validateWindow(
      range.window,
      Date.now(),
      site?.ping_record_preserve_time ?? 744,
    );
  const taskString = params.get("tasks");
  const selectedTasks = useMemo(
    () => (taskString === null ? null : taskString.split(",").filter(Boolean)),
    [taskString],
  );
  const common = params.get("common") !== "0";
  const update = (key: string, value: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (value === null) next.delete(key);
      else next.set(key, value);
      return next;
    });
  const choose = (choice: TimeChoice) =>
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.delete("from");
      next.delete("to");
      next.delete("day");
      if (choice.preset === "custom") {
        next.set("from", new Date(choice.window.start).toISOString());
        next.set("to", new Date(choice.window.end).toISOString());
        next.delete("range");
      } else {
        next.set("range", choice.preset);
        if (choice.day) next.set("day", choice.day);
      }
      return next;
    });
  const viewRange = (window: TimeWindow) =>
    choose({ preset: "custom", window });
  return (
    <main className={V.page}>
      <PageHeader
        title={t("网络总览")}
        eyebrow="NETWORK / KOMARI NEXT PRO"
        description={t("同一时间范围，比较多台节点的监测线路。")}
      >
        <Freshness />
        <Link
          to={`/compare?nodes=${encodeURIComponent(ids.join(","))}`}
          className={V.nodeChip}
        >
          <Columns3 size={14} />
          {t("基础信息对比")}
        </Link>
      </PageHeader>
      <section className={`${V.panel} ${V.selectionPanel}`}>
        <div className={V.selectionRow}>
          <span className={V.sectionLabel}>{t("对比节点")}</span>
          <SelectedNodes
            ids={ids}
            onChange={(selected) => update("nodes", selected.join(","))}
          />
        </div>
        <TimeControls
          window={error ? nowWindow : range.window}
          preset={preset}
          onChange={choose}
        />
      </section>
      {error ? (
        <div className={V.error} role="alert">
          {t(error)}
        </div>
      ) : loading ? (
        <State busy />
      ) : (
        <NetworkMonitor
          key={identity}
          ids={ids}
          window={range.window}
          selectedTasks={selectedTasks}
          onTasksChange={(tasks) =>
            update("tasks", tasks === null ? null : tasks.join(","))
          }
          commonOnly={common}
          onCommonChange={(v) => update("common", v ? "1" : "0")}
          onRange={viewRange}
        />
      )}
    </main>
  );
}
