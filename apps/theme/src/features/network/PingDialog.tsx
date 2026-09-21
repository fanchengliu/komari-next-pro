import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useModel } from "../../data/context";
import { useUI } from "../../data/store";
import { useTranslate } from "../../data/i18n";
import { presetWindow } from "../../domain/time-window";
import type { NetworkPreset, TimeWindow } from "../../domain/network";
import { Modal, State } from "../../ui/primitives";
import { TimeControls, type TimeChoice } from "./TimeControls";
import { NetworkMonitor } from "./NetworkMonitor";
import V from "../../ui/v2.module.css";
export function PingDialog() {
  const { nodes, settings, identity } = useModel();
  const target = useUI((s) => s.pingTarget);
  const set = useUI((s) => s.set);
  const t = useTranslate();
  const node = nodes.find((n) => n.id === target?.id);
  const close = () => set({ pingTarget: null });
  if (!target) return null;
  return (
    <Modal
      title={`${node?.name ?? t("节点不可见")} · ${t("延迟 / 丢包")}`}
      open={!!target}
      onClose={close}
      wide
      className={V.drawer}
    >
      <PingDialogBody
        key={`${identity}:${target.id}:${target.start}:${target.end}:${target.tasks?.join(",")}`}
        nodeId={node?.id}
        initial={
          target.start !== undefined && target.end !== undefined
            ? { start: target.start, end: target.end }
            : undefined
        }
        initialTasks={target.tasks}
        close={close}
      />
    </Modal>
  );
}
function PingDialogBody({
  nodeId,
  initial,
  close,
  initialTasks,
}: {
  nodeId?: string;
  initial?: TimeWindow;
  close: () => void;
  initialTasks?: string[];
}) {
  const { settings } = useModel();
  const t = useTranslate();
  const ids = useMemo(() => (nodeId ? [nodeId] : []), [nodeId]);
  const [choice, setChoice] = useState<TimeChoice>(() => ({
    preset: initial ? "custom" : "1h",
    window: initial ?? presetWindow("1h", settings.timezone),
  }));
  const [tasks, setTasks] = useState<string[] | null>(initialTasks ?? null);
  const start = useRef<number | null>(null);
  return (
    <>
      <div
        className={V.drawerHandle}
        onPointerDown={(e) => {
          start.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={(e) => {
          if (start.current !== null && e.clientY - start.current > 60) close();
          start.current = null;
        }}
        aria-hidden="true"
      />
      {!nodeId ? (
        <State empty={t("节点不存在或当前账号无权查看")} />
      ) : (
        <>
          <TimeControls
            window={choice.window}
            preset={choice.preset}
            onChange={setChoice}
          />
          <NetworkMonitor
            ids={ids}
            window={choice.window}
            selectedTasks={tasks}
            onTasksChange={setTasks}
            onRange={(window) => setChoice({ preset: "custom", window })}
          />
          <div className={V.tableFooter}>
            <p>{t("选择时间格后可查询该时段，统计不会沿用整段平均值。")}</p>
            <Link
              className={V.nodeChip}
              to={`/network?nodes=${encodeURIComponent(nodeId)}&from=${encodeURIComponent(new Date(choice.window.start).toISOString())}&to=${encodeURIComponent(new Date(choice.window.end).toISOString())}${tasks !== null ? "&tasks=" + encodeURIComponent(tasks.join(",")) : ""}`}
              onClick={close}
            >
              {t("放到网络总览比较")}
              <ArrowRight size={13} />
            </Link>
          </div>
        </>
      )}
    </>
  );
}
