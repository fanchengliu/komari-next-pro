import { expiryText } from "../domain/model";
import { Check, Plus } from "lucide-react";
import {
  PingSummaryProvider,
  PingSummaryBars,
} from "./network/PingSummaryBars";
import { CompactNodes } from "./CompactNodes";
import { LayoutChoice } from "../ui/LayoutChoice";
import { useLayoutPreset } from "../data/layout";
import { Freshness } from "../ui/Freshness";
import V from "../ui/v2.module.css";
import { useTranslate } from "../data/i18n";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Clock,
  Activity,
  Globe,
  ArrowUpRight,
  Zap,
  Calculator,
  Search,
  Grid2X2,
  Table2,
  Cpu,
  MemoryStick,
  HardDrive,
  ArrowDown,
  ArrowUp,
  Cloud,
  Wifi,
  CalendarClock,
  ChartPie,
  Power,
} from "lucide-react";
import type { NodeInfo, NodeStatus } from "../../../../packages/contracts";
import { useModel } from "../data/context";
import { useUI } from "../data/store";
import {
  bytes,
  pct,
  percent,
  quotaUsage,
  daysLeft,
  assetTotals,
  mood,
  level,
  selectedPing,
  safeMediaUrl,
} from "../domain/model";
import { S, Meter, Ring, State, DataTable, Modal } from "../ui/primitives";
import { Flag } from "../ui/Flag";
import { OSIcon } from "../ui/OSIcon";
import { SpeedDial } from "../ui/SpeedDial";
export const statNames = {
  clock: "当前时间",
  online: "当前在线",
  regions: "点亮地区",
  traffic: "流量概览",
  speed: "网络速率",
  assets: "资产统计",
};
const statIcons = {
  clock: Clock,
  online: Activity,
  regions: Globe,
  traffic: ArrowUpRight,
  speed: Zap,
  assets: Calculator,
};
export function Dashboard() {
  const { settings } = useModel();
  const pingOpen = useUI((s) => !!s.pingTarget);
  return (
    <PingSummaryProvider
      enabled={settings.fields.includes("ping") && !pingOpen}
    >
      <DashboardContent />
    </PingSummaryProvider>
  );
}
function DashboardContent() {
  const layout = useLayoutPreset();
  const t = useTranslate();
  const { nodes, statuses, settings, loading, error, refresh } = useModel();
  const ui = useUI();
  const online = nodes.filter((n) => statuses[n.id]?.online).length;
  const filtered = nodes.filter(
    (n) =>
      (!ui.group || n.group === ui.group) &&
      (!ui.search ||
        [n.name, n.os, n.region, n.group]
          .join(" ")
          .toLowerCase()
          .includes(ui.search.toLowerCase())) &&
      (ui.online === "all" ||
        (ui.online === "online") === !!statuses[n.id]?.online),
  );
  const sorted = [...filtered].sort(
    (a, b) =>
      Number(statuses[b.id]?.online ?? false) -
      Number(statuses[a.id]?.online ?? false),
  );
  if (loading)
    return (
      <main
        className={`${S.dashboard} ${V.home} ${layout === "compact" ? V.compact : layout === "mobile" ? V.mobilePreset : ""}`}
        data-layout={layout}
      >
        <State busy />
      </main>
    );
  return (
    <main
      className={`${S.dashboard} ${V.home} ${layout === "compact" ? V.compact : layout === "mobile" ? V.mobilePreset : ""}`}
      data-layout={layout}
    >
      <div className={V.homeTools}>
        <h2>{t("节点概览")}</h2>
        <div className={V.actions}>
          <Freshness />
          <LayoutChoice />
          <Link
            to={`/compare?nodes=${encodeURIComponent(ui.compareIds.join(","))}`}
          >
            {t("节点对比")}{" "}
            {ui.compareIds.length ? `(${ui.compareIds.length})` : ""}
          </Link>
        </div>
      </div>
      <Stats />
      <div className={`${S.glass} ${S.filterPanel}`} data-filter-panel>
        <label className={S.search}>
          <Search size={18} />
          <input
            aria-label={t("搜索节点")}
            placeholder={t("搜索节点名称、地区、系统…")}
            value={ui.search}
            onChange={(e) => ui.set({ search: e.target.value })}
          />
        </label>
        <button
          className={S.count}
          onClick={() =>
            ui.set({ online: ui.online === "online" ? "all" : "online" })
          }
          title={t("切换在线筛选")}
        >
          <i />
          {t("共")}
          {nodes.length}
          {t("个服务器，")}
          {online}
          {t("个在线")}
        </button>
        <div className={S.groups}>
          <span>{t("分组")}</span>
          <div>
            <button
              className={!ui.group ? S.active : ""}
              onClick={() => ui.set({ group: "" })}
            >
              {t("全部")}
            </button>
            {[...new Set(nodes.map((n) => n.group).filter(Boolean))].map(
              (g) => (
                <button
                  key={g}
                  className={ui.group === g ? S.active : ""}
                  onClick={() => ui.set({ group: g })}
                >
                  {g}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
      {error && (
        <div className={S.error}>
          <span>
            {error.message}
            {t("· 保留上次数据")}
          </span>
          <button onClick={refresh}>{t("重试")}</button>
        </div>
      )}
      {loading ? (
        <State busy />
      ) : !sorted.length ? (
        <State empty={t("没有符合条件的节点")} />
      ) : layout === "compact" ? (
        <CompactNodes nodes={sorted} />
      ) : (
        <div className={S.nodeGrid} data-node-grid>
          {sorted.map((n) => (
            <NodeCard key={n.id} node={n} status={statuses[n.id]} />
          ))}
        </div>
      )}
    </main>
  );
}
export function Stats() {
  const navigate = useNavigate();
  const t = useTranslate();
  const { nodes, statuses, settings, fx } = useModel();
  const [now, setNow] = useState(Date.now());
  const set = useUI((state) => state.set);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const online = nodes.filter((n) => statuses[n.id]?.online).length;
  const regions = [
    ...new Set(
      nodes.filter((n) => statuses[n.id]?.online).map((n) => n.region),
    ),
  ];
  const sum = (key: "downRate" | "upRate" | "downTotal" | "upTotal") =>
    nodes.reduce((total, n) => total + (statuses[n.id]?.[key] ?? 0), 0);
  const assets = assetTotals(nodes, fx.rates);
  const date = new Intl.DateTimeFormat(settings.locale, {
    timeZone: settings.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const content = {
    clock: (
      <>
        <b className={S.clock}>{date}</b>
        <div className={S.clockTicks}>
          {[1, 2, 3, 4, 5].map((x) => (
            <i key={x} />
          ))}
        </div>
      </>
    ),
    online: (
      <>
        <b>
          {online} / {nodes.length}
        </b>
        <Meter value={percent(online, nodes.length)} color="#20c997" />
      </>
    ),
    regions: (
      <>
        <b>{regions.length}</b>
        <div className={S.regionDots}>
          {regions.map((r) => (
            <i key={r} title={r} />
          ))}
        </div>
      </>
    ),
    traffic: (
      <div className={S.trafficPills}>
        <span>
          {t("上行")}
          <strong>{bytes(sum("upTotal"))}</strong>
        </span>
        <span>
          {t("下行")}
          <strong>{bytes(sum("downTotal"))}</strong>
        </span>
      </div>
    ),
    speed: <SpeedDial down={sum("downRate")} up={sum("upRate")} />,
    assets: (
      <b className={S.assetValue}>
        <small>¥</small>
        {assets.unknown > 0 && assets.value === 0
          ? "--"
          : assets.value.toFixed(2)}
      </b>
    ),
  };
  return (
    <>
      <div className={S.stats} data-overview-cards>
        {settings.cards.map((key) => {
          const Icon = statIcons[key];
          return (
            <button
              key={key}
              className={`${S.glass} ${S.stat}`}
              onClick={() =>
                set({
                  dialog: {
                    clock: "clock",
                    online: "online",
                    regions: "globe",
                    traffic: "totals",
                    speed: "speed",
                    assets: "assets",
                  }[key],
                })
              }
              title={t("点击查看详情")}
            >
              <span className={S.statTitle}>
                <Icon size={17} />
                {t(statNames[key])}
              </span>
              <div className={S.statValue}>{content[key]}</div>
            </button>
          );
        })}
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
  bar,
  color,
  children,
}: {
  label: string;
  value: string;
  icon: typeof Cpu;
  bar?: number | null;
  color?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslate();
  return (
    <div className={S.metric}>
      <div>
        <span title={t(label)}>
          <Icon size={13} />
          {t(label)}
        </span>
        <b>{value}</b>
      </div>
      {bar !== undefined ? <Meter value={bar} color={color} /> : children}
    </div>
  );
}
export function NodeCard({
  node: n,
  status: s,
}: {
  node: NodeInfo;
  status?: NodeStatus;
}) {
  const t = useTranslate();
  const { settings } = useModel();
  const ids = useUI((state) => state.compareIds),
    set = useUI((state) => state.set);
  const [selectError, setSelectError] = useState("");
  const quota = quotaUsage(
      s?.upTotal ?? null,
      s?.downTotal ?? null,
      n.quotaMode,
    ),
    remaining = daysLeft(n),
    lv = level(s),
    fields = settings.fields;
  const toggle = () => {
    setSelectError("");
    if (ids.includes(n.id))
      set({ compareIds: ids.filter((id) => id !== n.id) });
    else if (ids.length < 4) set({ compareIds: [...ids, n.id] });
    else setSelectError(t("最多同时对比四台节点"));
  };
  return (
    <article
      className={`${S.nodeCard} ${S.glass} ${s?.online ? "" : S.offline}`}
      data-node={n.id}
    >
      {!s?.online && (
        <span className={S.offlineLabel}>
          <Power size={13} />
          {s ? t("离线") : t("等待数据")}
        </span>
      )}
      <Link
        className={V.cardLink}
        to={`/instance/${encodeURIComponent(n.id)}`}
        aria-label={`查看 ${n.name}`}
      >
        <div className={S.nodeHeading}>
          <Flag region={n.region} />
          <div className={S.nodeName}>
            <strong title={n.name}>{n.name}</strong>
            <div>
              {settings.mood && <span>{mood(n, s)}</span>}
              {settings.level && (
                <>
                  <b
                    className={S.level}
                    style={{
                      background: lv.level >= 4 ? "#8270ff" : "#18c5b2",
                    }}
                  >
                    Lv{lv.level}
                  </b>
                  <Meter value={lv.progress} color="#22c5a3" />
                </>
              )}
            </div>
          </div>
          <span className={S.os} title={n.os}>
            <OSIcon os={n.os} />
          </span>
          {s?.online && (n.ipv4 || n.ipv6) && (
            <div className={S.ipTags}>
              {n.ipv4 && <span>IPv4</span>}
              {n.ipv6 && <span>IPv6</span>}
            </div>
          )}
          <i className={S.statusDot} />
        </div>
        <div className={S.metricsGrid}>
          {fields.includes("cpu") && (
            <Metric
              label="CPU"
              icon={Cpu}
              value={pct(s?.cpu)}
              bar={s?.cpu ?? null}
              color="#5195fc"
            />
          )}
          {fields.includes("memory") && (
            <Metric
              label={t("内存")}
              icon={MemoryStick}
              value={pct(percent(s?.memory, n.memory))}
              bar={percent(s?.memory, n.memory)}
              color="#ad59ff"
            />
          )}
          {fields.includes("disk") && (
            <Metric
              label={t("磁盘")}
              icon={HardDrive}
              value={pct(percent(s?.disk, n.disk))}
              bar={percent(s?.disk, n.disk)}
              color="#ffb60b"
            />
          )}
          {fields.includes("monthly") && (
            <Metric
              label={t("月度")}
              icon={ChartPie}
              value={n.quota ? `${bytes(quota, 1)}/${bytes(n.quota, 1)}` : "--"}
              bar={percent(quota, n.quota)}
              color="#21c99a"
            />
          )}
          {fields.includes("rates") && (
            <>
              <Metric
                label={t("下行")}
                icon={ArrowDown}
                value={`${bytes(s?.downRate, 1)}${s?.downRate == null ? "" : "/s"}`}
              />
              <Metric
                label={t("上行")}
                icon={ArrowUp}
                value={`${bytes(s?.upRate, 1)}${s?.upRate == null ? "" : "/s"}`}
              />
            </>
          )}
          {fields.includes("totals") && (
            <>
              <Metric
                label={t("下载流量")}
                icon={Cloud}
                value={bytes(s?.downTotal)}
              />
              <Metric
                label={t("上传流量")}
                icon={Cloud}
                value={bytes(s?.upTotal)}
              />
            </>
          )}
        </div>
      </Link>
      {fields.includes("ping") && <PingSummaryBars nodeId={n.id} />}
      {fields.includes("expiry") && (
        <div className={S.cardBottom}>
          <span>
            <CalendarClock size={13} />
            {t("到期")}
            <b>{t(expiryText(n))}</b>
          </span>
          <span>
            <Clock size={13} />
            {t("运行时间")}
            <b>
              {s?.uptime == null
                ? "--"
                : s.uptime < 86400
                  ? `${Math.floor(s.uptime / 3600)}h`
                  : t(`${Math.floor(s.uptime / 86400)}天`)}
            </b>
          </span>
        </div>
      )}
      <button
        className={V.compareAction}
        aria-label={`${t("对比")} ${n.name}`}
        aria-pressed={ids.includes(n.id)}
        onClick={toggle}
      >
        {ids.includes(n.id) ? <Check size={12} /> : <Plus size={12} />}{" "}
        {t(ids.includes(n.id) ? "已选对比" : "加入对比")}
      </button>
      {selectError && (
        <p className={V.fieldNote} role="status">
          {selectError}
        </p>
      )}
    </article>
  );
}
