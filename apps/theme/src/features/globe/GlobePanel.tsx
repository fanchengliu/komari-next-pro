import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Globe,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { useModel } from "../../data/context";
import { useTranslate } from "../../data/i18n";
import { groupRegions, regionCode } from "../../domain/regions";
import {
  advanceReportClock,
  reportNow,
  type ReportClock,
} from "../../domain/report-clock";
import { bytes } from "../../domain/model";
import { PageHeader } from "../../ui/PageHeader";
import { Flag } from "../../ui/Flag";
import { Freshness } from "../../ui/Freshness";
import { State } from "../../ui/primitives";
import { createEarth, type EarthController } from "./earth-renderer";
import V from "../../ui/v2.module.css";
import T from "../../ui/tools.module.css";
export function GlobePage() {
  const [params, setParams] = useSearchParams();
  return (
    <main>
      <GlobePanel
        initialNode={params.get("node")}
        onSelection={(id) => setParams(id ? { node: id } : {})}
      />
    </main>
  );
}
export function GlobePanel({
  embedded = false,
  initialNode = null,
  onSelection,
  onNavigate,
}: {
  embedded?: boolean;
  initialNode?: string | null;
  onSelection?: (id: string | null) => void;
  onNavigate?: () => void;
}) {
  const { nodes, statuses, settings, loading, error } = useModel(),
    t = useTranslate();
  const [now, setNow] = useState(Date.now()),
    [selection, setSelection] = useState<string | null>(initialNode),
    [filter, setFilter] = useState(""),
    [regionFilter, setRegionFilter] = useState(""),
    [onlineOnly, setOnlineOnly] = useState(false),
    [rotate, setRotate] = useState(
      () =>
        settings.globeAutoRotate &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [unsupported, setUnsupported] = useState(false),
    [ready, setReady] = useState(false),
    [announcement, setAnnouncement] = useState("");
  const reportClock = useRef<ReportClock | null>(null);
  reportClock.current = advanceReportClock(
    reportClock.current,
    nodes.map((n) => statuses[n.id]?.at ?? 0),
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => setSelection(initialNode), [initialNode]);
  useEffect(
    () =>
      setRotate(
        settings.globeAutoRotate &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    [settings.globeAutoRotate],
  );
  const { regions, unmapped, lit } = useMemo(
    () =>
      groupRegions(
        nodes,
        statuses,
        settings.locale,
        reportNow(reportClock.current, now),
      ),
    [nodes, statuses, settings.locale, now],
  );
  const selected = nodes.find((n) => n.id === selection),
    canvas = useRef<HTMLCanvasElement>(null),
    layer = useRef<HTMLDivElement>(null),
    list = useRef<HTMLDivElement>(null),
    controller = useRef<EarthController | null>(null);
  const mapped = regions.flatMap((r) =>
    r.nodes.map((n) => ({ node: n, region: r.id, state: r.nodeStates[n.id] })),
  );
  const nodeStates = Object.assign(
    {},
    ...regions.map((r) => r.nodeStates),
  ) as Record<string, "online" | "offline" | "unknown" | "stale">;
  const select = (id: string) => {
    if (!nodes.some((n) => n.id === id)) return;
    setSelection(id);
    setFilter("");
    setRegionFilter("");
    setRotate(false);
    onSelection?.(id);
    setAnnouncement(nodes.find((n) => n.id === id)!.name);
  };
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => {
    if (!canvas.current || !layer.current || !settings.globeEnabled) return;
    const earth = createEarth(
      canvas.current,
      layer.current,
      (id) => selectRef.current(id),
      regions,
      selected?.id ?? "",
      setAnnouncement,
    );
    controller.current = earth;
    setUnsupported(!earth);
    if (!earth) return;
    earth.setAuto(rotate);
    earth.setFilter(onlineOnly);
    if (selected) earth.focus(selected.id);
    setReady(true);
    return () => {
      earth.destroy();
      controller.current = null;
    };
  }, [settings.globeEnabled, loading]);
  useEffect(
    () => controller.current?.update(regions, selected?.id ?? ""),
    [regions, selected?.id, ready],
  );
  useEffect(() => {
    if (ready && selected) {
      controller.current?.focus(selected.id);
      const row = list.current?.querySelector<HTMLElement>(
        `[data-globe-row="${CSS.escape(selected.id)}"]`,
      );
      if (row && list.current) {
        const root = list.current;
        root.scrollTo({
          top: Math.max(
            0,
            row.offsetTop - root.clientHeight / 2 + row.clientHeight / 2,
          ),
          behavior: "smooth",
        });
      }
    }
  }, [selected?.id, ready]);
  useEffect(() => controller.current?.setAuto(rotate), [rotate, ready]);
  useEffect(
    () => controller.current?.setFilter(onlineOnly),
    [onlineOnly, ready],
  );
  const visible = nodes.filter(
    (n) =>
      (!onlineOnly || statuses[n.id]?.online) &&
      (!regionFilter || regionCode(n.region) === regionFilter) &&
      [n.name, n.region, n.group]
        .join(" ")
        .toLowerCase()
        .includes(filter.toLowerCase()),
  );
  if (!settings.globeEnabled)
    return <State empty={t("地球展示已关闭，可在主题设置中启用。")} />;
  return (
    <div
      className={`${V.page} ${embedded ? V.globeEmbedded : ""}`}
      data-globe-panel
    >
      {!embedded && (
        <PageHeader
          title={t("全球节点")}
          eyebrow="ATLAS / KOMARI NEXT PRO"
          description={t("点击地球上的国旗，在右侧选中对应节点。")}
        >
          <Freshness />
        </PageHeader>
      )}
      {error && (
        <p className={V.notice}>
          {t("状态更新异常，点亮状态使用最近一次上报。")}
        </p>
      )}
      {loading ? (
        <State busy />
      ) : (
        <div className={V.globeLayout}>
          <section className={`${V.panel} ${V.globeStage}`}>
            <div className={V.globeStageHead}>
              <div>
                <h3>
                  <Globe size={15} />
                  {t("我的全球节点")}
                </h3>
                <p>
                  {nodes.length} {t("台节点")} / {regions.length}{" "}
                  {t("个已部署地区")}
                </p>
              </div>
              <div className={V.ranges}>
                <button
                  aria-pressed={!onlineOnly}
                  onClick={() => setOnlineOnly(false)}
                >
                  {t("全部")}
                </button>
                <button
                  aria-pressed={onlineOnly}
                  onClick={() => setOnlineOnly(true)}
                >
                  {t("仅在线")}
                </button>
              </div>
            </div>
            <canvas
              ref={canvas}
              tabIndex={0}
              role="img"
              aria-label={t("可拖动旋转的三维地球，方向键旋转，加减键缩放")}
              data-map-node-count={mapped.length}
              data-rotating={rotate}
            />
            <div ref={layer} className={V.flagLayer}>
              {mapped.map(({ node, region, state }) => (
                <button
                  key={node.id}
                  type="button"
                  className={V.flagPin}
                  data-map-node={node.id}
                  data-status={state}
                  hidden
                  aria-label={`${t("选择节点")} ${node.name}`}
                  aria-pressed={selected?.id === node.id}
                  onClick={() => select(node.id)}
                >
                  <Flag region={region} />
                </button>
              ))}
            </div>
            {unsupported && (
              <p className={V.globeHint}>
                {t("当前浏览器无法绘制地球，请使用地区列表。")}
              </p>
            )}
            <p className={V.globeHint}>
              {t("国旗表示节点所属地区，位置仅作示意。")}
            </p>
            <div className={V.globeControls}>
              <button
                aria-pressed={rotate}
                disabled={unsupported}
                onClick={() => setRotate((v) => !v)}
              >
                {rotate ? <Pause size={13} /> : <Play size={13} />}{" "}
                {t(rotate ? "暂停旋转" : "自动旋转")}
              </button>
              <button
                aria-label={t("放大地球")}
                disabled={unsupported}
                onClick={() => controller.current?.zoom(1.1)}
              >
                <Plus size={14} />
              </button>
              <button
                aria-label={t("缩小地球")}
                disabled={unsupported}
                onClick={() => controller.current?.zoom(0.9)}
              >
                <Minus size={14} />
              </button>
              <button
                aria-label={t("重置地球视角")}
                disabled={unsupported}
                onClick={() => {
                  setSelection(null);
                  setFilter("");
                  setRegionFilter("");
                  onSelection?.(null);
                  controller.current?.reset();
                  setRotate(
                    settings.globeAutoRotate &&
                      !matchMedia("(prefers-reduced-motion: reduce)").matches,
                  );
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <div className={V.globeLegend}>
              <span>
                <i style={{ background: "#45b798" }} />
                {t("在线")}
              </span>
              <span>
                <i style={{ background: "#a4b6ca" }} />
                {t("离线")}
              </span>
              <span>
                <i style={{ background: "#d6ad6c" }} />
                {t("待更新")}
              </span>
            </div>
            <span
              aria-live="polite"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                clipPath: "inset(50%)",
                overflow: "hidden",
              }}
            >
              {announcement}
            </span>
          </section>
          <aside className={V.globeSidebar}>
            <section className={V.panel}>
              <h3>{t("我的点亮进度")}</h3>
              <div className={V.regionCount}>
                <strong>{lit}</strong>
                <span>
                  / {regions.length} {t("个已部署地区")}
                </span>
              </div>
            </section>
            <section className={V.panel}>
              <h3>{t("节点分布")}</h3>
              <div className={T.actions} style={{ marginTop: 12 }}>
                <input
                  style={{ minWidth: 0, flex: 1, width: 120, fontSize: 11 }}
                  aria-label={t("筛选地球节点")}
                  placeholder={t("搜索节点")}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <select
                  style={{ maxWidth: 135, fontSize: 11 }}
                  aria-label={t("筛选地区")}
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                >
                  <option value="">{t("全部地区")}</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div
                ref={list}
                className={V.regionList}
                style={{ position: "relative", maxHeight: 290, padding: 5 }}
              >
                {visible.map((n) => (
                  <button
                    key={n.id}
                    data-globe-row={n.id}
                    data-region={regionCode(n.region) ?? "unknown"}
                    aria-pressed={selected?.id === n.id}
                    className={`${V.regionOption} ${selected?.id === n.id ? V.nodeSelected : ""}`}
                    onClick={() => select(n.id)}
                  >
                    <Flag region={n.region} />
                    <span className={V.regionName}>
                      {n.name}
                      <small>
                        {n.cores} vCPU · {bytes(n.memory)}
                      </small>
                    </span>
                    <i
                      className={V.dot}
                      data-status={
                        nodeStates[n.id] ??
                        (!statuses[n.id]
                          ? "unknown"
                          : statuses[n.id]?.online
                            ? "online"
                            : "offline")
                      }
                    />
                  </button>
                ))}
                {!visible.length && <State empty={t("没有符合条件的节点")} />}
              </div>
            </section>
            {selected ? (
              <section className={V.panel} data-selected-node={selected.id}>
                <h3>
                  <Flag region={selected.region} /> {selected.name}
                </h3>
                <p className={V.fieldNote}>
                  {selected.os} · {selected.arch}
                </p>
                <Link
                  className={V.nodeChip}
                  to={"/instance/" + encodeURIComponent(selected.id)}
                  onClick={onNavigate}
                >
                  {t("查看详情")}
                  <ArrowRight size={13} />
                </Link>
              </section>
            ) : (
              <p className={V.fieldNote}>
                {t("点击任意国旗或列表中的节点查看详情。")}
              </p>
            )}
            {unmapped.length > 0 && (
              <p className={V.fieldNote}>
                {t("尚未定位")} · {unmapped.length} {t("台节点")}
              </p>
            )}
          </aside>
        </div>
      )}
      <p className={V.fieldNote}>
        <a
          href={import.meta.env.BASE_URL + "geodata/ATTRIBUTION.txt"}
          target="_blank"
          rel="noreferrer"
        >
          {t("地图数据与许可")}
        </a>
      </p>
    </div>
  );
}
