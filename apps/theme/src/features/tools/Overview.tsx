import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useModel } from "../../data/context";
import { useUI } from "../../data/store";
import { useTranslate } from "../../data/i18n";
import { bytes } from "../../domain/model";
import { Flag } from "../../ui/Flag";
import { State, Meter } from "../../ui/primitives";
import T from "../../ui/tools.module.css";
export const timezones = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
];
export function TimezonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (zone: string) => void;
}) {
  const t = useTranslate();
  const zones = [
    ...new Set([...timezones, ...Intl.supportedValuesOf("timeZone")]),
  ];
  return (
    <select
      aria-label={t("显示时区")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {zones.map((zone) => (
        <option key={zone}>{zone}</option>
      ))}
    </select>
  );
}
export function ClockOverview() {
  const { settings } = useModel(),
    configure = useUI((s) => s.configure),
    t = useTranslate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const format = (zone: string, full = false) =>
    new Intl.DateTimeFormat(settings.locale, {
      timeZone: zone,
      ...(full
        ? ({ dateStyle: "full" } as const)
        : ({
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          } as const)),
    }).format(now);
  return (
    <>
      <div className={T.intro}>
        <p>
          <span className={T.eyebrow}>WORLD CLOCK / KOMARI NEXT PRO</span>
          {t("选择时区，首页与图表会同步使用该时区。")}
        </p>
        <TimezonePicker
          value={settings.timezone}
          onChange={(timezone) => configure({ timezone })}
        />
      </div>
      <section
        className={T.section}
        style={{ textAlign: "center", padding: "34px 20px" }}
      >
        <small className={T.muted}>{settings.timezone}</small>
        <div
          style={{
            fontSize: "clamp(40px,7vw,64px)",
            letterSpacing: 2,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 650,
            margin: "16px 0",
          }}
        >
          {format(settings.timezone)}
        </div>
        <p className={T.muted}>{format(settings.timezone, true)}</p>
      </section>
      <div className={T.mediaGrid}>
        {timezones.slice(0, 10).map((zone) => (
          <button
            className={T.stat}
            key={zone}
            aria-pressed={settings.timezone === zone}
            onClick={() => configure({ timezone: zone })}
          >
            {zone}
            <strong style={{ fontSize: 22 }}>{format(zone)}</strong>
          </button>
        ))}
      </div>
    </>
  );
}
export function OnlineOverview() {
  const { nodes, statuses } = useModel(),
    t = useTranslate(),
    set = useUI((s) => s.set);
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const state = (id: string) =>
    statuses[id] ? (statuses[id].online ? "online" : "offline") : "unknown";
  const rows = nodes.filter(
    (n) =>
      (filter === "all" || state(n.id) === filter) &&
      n.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className={T.intro}>
        <p>
          <span className={T.eyebrow}>AVAILABILITY / KOMARI NEXT PRO</span>
          {t("查看当前在线、离线与等待上报的节点。")}
        </p>
      </div>
      <div className={T.stats}>
        {[
          ["online", "在线节点"],
          ["offline", "离线节点"],
          ["unknown", "等待数据"],
        ].map(([id, label]) => (
          <button
            className={T.stat}
            aria-pressed={filter === id}
            key={id}
            onClick={() => setFilter(filter === id ? "all" : id)}
          >
            {t(label)}
            <strong>{nodes.filter((n) => state(n.id) === id).length}</strong>
            <small>{t("台节点")}</small>
          </button>
        ))}
      </div>
      <div className={T.bar}>
        <button className={T.action} onClick={() => setFilter("all")}>
          {t("全部节点")} · {nodes.length}
        </button>
        <input
          className={T.search}
          value={search}
          aria-label={t("筛选在线节点")}
          placeholder={t("搜索节点")}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className={T.scroll}>
        <table className={T.table}>
          <thead>
            <tr>
              {["节点", "状态", "CPU", "内存"].map((h) => (
                <th key={h}>{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id}>
                <td>
                  <Link
                    className={T.node}
                    to={"/instance/" + encodeURIComponent(n.id)}
                    onClick={() => set({ dialog: null })}
                  >
                    <Flag region={n.region} />
                    {n.name}
                  </Link>
                </td>
                <td>
                  <span className={T.badge}>
                    {t(
                      state(n.id) === "online"
                        ? "在线"
                        : state(n.id) === "offline"
                          ? "离线"
                          : "等待数据",
                    )}
                  </span>
                </td>
                <td>
                  {statuses[n.id]?.cpu == null
                    ? "--"
                    : statuses[n.id].cpu!.toFixed(1) + "%"}
                </td>
                <td>
                  {bytes(statuses[n.id]?.memory)} / {bytes(n.memory)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <State empty={t("没有符合条件的节点")} />}
    </>
  );
}
export function TransferOverview({ speed = false }: { speed?: boolean }) {
  const { nodes, statuses } = useModel(),
    t = useTranslate(),
    set = useUI((s) => s.set);
  const [search, setSearch] = useState("");
  const keys = speed
    ? (["downRate", "upRate"] as const)
    : (["downTotal", "upTotal"] as const);
  const totals = keys.map((key) => {
    const values = nodes
      .map((n) => statuses[n.id]?.[key])
      .filter((v): v is number => typeof v === "number");
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  });
  const combined = totals.every((v) => v !== null)
    ? totals[0]! + totals[1]!
    : null;
  const format = (value: number | null | undefined) =>
    bytes(value) + (speed ? "/s" : "");
  const rows = nodes
    .filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        (statuses[b.id]?.[keys[0]] ?? 0) +
        (statuses[b.id]?.[keys[1]] ?? 0) -
        (statuses[a.id]?.[keys[0]] ?? 0) -
        (statuses[a.id]?.[keys[1]] ?? 0),
    );
  return (
    <>
      <div className={T.intro}>
        <p>
          <span className={T.eyebrow}>
            {speed ? "BANDWIDTH" : "TRANSFER"} / KOMARI NEXT PRO
          </span>
          {t(
            speed
              ? "当前节点速率，每次上报自动更新。"
              : "节点累计计数总览，按下载与上传分别汇总。",
          )}
        </p>
        {!speed && (
          <button
            className={T.primary}
            onClick={() => set({ dialog: "traffic" })}
          >
            {t("查看历史流量统计")}
          </button>
        )}
      </div>
      <div className={T.stats}>
        {[
          ["下载", totals[0]],
          ["上传", totals[1]],
          ["合计", combined],
        ].map(([label, value]) => (
          <div className={T.stat} key={label as string}>
            {t(label as string)}
            <strong>{format(value as number | null)}</strong>
            <small>
              {nodes.length} {t("台节点")}
            </small>
          </div>
        ))}
      </div>
      <div className={T.bar}>
        <h3>{t("节点明细")}</h3>
        <input
          className={T.search}
          aria-label={t("筛选流量节点")}
          placeholder={t("搜索节点")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className={T.scroll}>
        <table className={T.table}>
          <thead>
            <tr>
              {["节点", "下载", "上传", "占比"].map((h) => (
                <th key={h}>{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const s = statuses[n.id],
                known =
                  typeof s?.[keys[0]] === "number" &&
                  typeof s?.[keys[1]] === "number",
                share =
                  known && combined
                    ? ((s[keys[0]]! + s[keys[1]]!) / combined) * 100
                    : null;
              return (
                <tr key={n.id}>
                  <td>
                    <Link
                      className={T.node}
                      to={"/instance/" + encodeURIComponent(n.id)}
                      onClick={() => set({ dialog: null })}
                    >
                      <Flag region={n.region} />
                      {n.name}
                    </Link>
                  </td>
                  <td style={{ color: "var(--download)" }}>
                    {format(s?.[keys[0]])}
                  </td>
                  <td style={{ color: "var(--upload)" }}>
                    {format(s?.[keys[1]])}
                  </td>
                  <td style={{ minWidth: 90 }}>
                    {share === null ? "--" : share.toFixed(1) + "%"}
                    <Meter value={share} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={T.muted}>
        {t(
          speed
            ? "占比是当前各节点速率在可见节点合计中的比例。"
            : "累计计数可能随系统或网卡重置；按日期用量请查看历史统计。",
        )}
      </p>
    </>
  );
}
