import { RateNote } from "./ExchangeRates";
import { currencyRate } from "../../../../../packages/contracts/exchange";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useModel, useTraffic } from "../../data/context";
import { useUI } from "../../data/store";
import { useTranslate } from "../../data/i18n";
import {
  assetTotals,
  bytes,
  daysLeft,
  expiryText,
  isLongTerm,
  pct,
  percent,
  quotaUsage,
} from "../../domain/model";
import type { NodeInfo, TrafficRange } from "../../../../../packages/contracts";
import { Flag } from "../../ui/Flag";
import { State } from "../../ui/primitives";
import T from "../../ui/tools.module.css";
function NodeName({ node }: { node: NodeInfo }) {
  const set = useUI((s) => s.set);
  return (
    <Link
      className={T.node}
      to={"/instance/" + encodeURIComponent(node.id)}
      onClick={() => set({ dialog: null })}
    >
      <Flag region={node.region} />
      <span>
        {node.name}
        <small>{node.group || node.os}</small>
      </span>
    </Link>
  );
}
export function Assets() {
  const { nodes, viewer, settings, fx } = useModel(),
    t = useTranslate();
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const data = viewer.logged_in ? nodes : [],
    totals = assetTotals(data, fx.rates),
    paid = data.filter((n) => n.price > 0),
    free = data.filter((n) => n.price <= 0);
  const rows = (filter === "paid" ? paid : filter === "free" ? free : data)
    .filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
    .sort(
      (a, b) =>
        b.price / Math.max(1, b.billingDays) -
        a.price / Math.max(1, a.billingDays),
    );
  return (
    <>
      <div className={T.intro}>
        <p>
          <span className={T.eyebrow}>ASSETS / KOMARI NEXT PRO</span>
          {t("每一台节点，都有清楚的账目。点击卡片查看付费或免费节点。")}
        </p>
      </div>
      <div className={T.stats}>
        {[
          [
            "all",
            "资产估值",
            totals.unknown === paid.length && paid.length > 0
              ? "--"
              : "¥" + totals.value.toFixed(2),
            `${t("月均")} ¥${totals.monthly.toFixed(2)}`,
          ],
          ["paid", "付费节点", String(paid.length), t("查看付费节点")],
          ["free", "免费节点", String(free.length), t("查看免费节点")],
        ].map(([id, title, value, note]) => (
          <button
            key={id}
            className={T.stat}
            aria-label={t(title)}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {t(title)}
            <strong>{value}</strong>
            <small>{note}</small>
          </button>
        ))}
      </div>
      <div className={T.bar}>
        <h3>
          {t(
            filter === "free"
              ? "免费节点"
              : filter === "paid"
                ? "付费节点"
                : "全部节点",
          )}{" "}
          <span className={T.badge}>{rows.length}</span>
        </h3>
        <input
          className={T.search}
          aria-label={t("筛选资产节点")}
          placeholder={t("搜索节点")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className={T.scroll}>
        <table className={T.table}>
          <thead>
            <tr>
              {["节点", "价格", "周期", "年化 CNY", "到期"].map((h) => (
                <th key={h}>{t(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id}>
                <td>
                  <NodeName node={n} />
                </td>
                <td>
                  {n.price <= 0 ? (
                    <span className={T.badge}>{t("免费")}</span>
                  ) : (
                    `${n.currency} ${n.price}`
                  )}
                </td>
                <td>
                  {n.price <= 0
                    ? "—"
                    : n.billingDays > 0
                      ? `${n.billingDays} ${t("天")}`
                      : "—"}
                </td>
                <td>
                  {n.price <= 0
                    ? "—"
                    : n.billingDays > 0 && currencyRate(fx.rates, n.currency)
                      ? (
                          (n.price *
                            currencyRate(fx.rates, n.currency)! *
                            365) /
                          n.billingDays
                        ).toFixed(2)
                      : t("暂无该币种汇率")}
                </td>
                <td>{t(expiryText(n))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <State
            empty={t(viewer.logged_in ? "没有符合条件的节点" : "登录后可见")}
          />
        )}
      </div>
      <RateNote />
      {totals.unknown > 0 && (
        <p className={T.muted}>
          {totals.unknown} {t("台节点暂缺汇率，未计入合计")}
        </p>
      )}
    </>
  );
}
export function Expiry() {
  const { nodes, viewer, settings } = useModel(),
    t = useTranslate();
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  const data = viewer.logged_in ? nodes : [];
  const state = (n: NodeInfo) =>
    isLongTerm(n)
      ? "long"
      : daysLeft(n) === null
        ? "unset"
        : daysLeft(n)! < 0
          ? "expired"
          : daysLeft(n)! <= 30
            ? "soon"
            : "normal";
  const counts = {
    soon: data.filter((n) => state(n) === "soon").length,
    expired: data.filter((n) => state(n) === "expired").length,
    long: data.filter((n) => state(n) === "long").length,
  };
  const rows = data
    .filter(
      (n) =>
        (filter === "all" || state(n) === filter) &&
        n.name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (isLongTerm(a) ? Infinity : (daysLeft(a) ?? Infinity)) -
        (isLongTerm(b) ? Infinity : (daysLeft(b) ?? Infinity)),
    );
  const groups = new Map<string, NodeInfo[]>();
  for (const n of rows) {
    const group =
      state(n) === "long"
        ? t("长期")
        : state(n) === "unset"
          ? t("未设置到期")
          : new Intl.DateTimeFormat(settings.locale, {
              timeZone: settings.timezone,
              year: "numeric",
              month: "long",
            }).format(new Date(n.expires!));
    groups.set(group, [...(groups.get(group) ?? []), n]);
  }
  return (
    <>
      <div className={T.intro}>
        <p>
          <span className={T.eyebrow}>EXPIRY / KOMARI NEXT PRO</span>
          {t("按日期整理续费节奏，长期节点单独归档。")}
        </p>
      </div>
      <div className={T.stats}>
        {[
          ["soon", "30 天内到期"],
          ["expired", "已过期"],
          ["long", "长期"],
        ].map(([id, label]) => (
          <button
            className={T.stat}
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(filter === id ? "all" : id)}
          >
            {t(label)}
            <strong>{counts[id as keyof typeof counts]}</strong>
            <small>{t("台节点")}</small>
          </button>
        ))}
      </div>
      <div className={T.bar}>
        <div className={T.segments}>
          {[
            ["all", "全部"],
            ["soon", "即将到期"],
            ["expired", "已过期"],
            ["long", "长期"],
            ["unset", "未设置"],
          ].map(([id, name]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {t(name)}
            </button>
          ))}
        </div>
        <input
          className={T.search}
          aria-label={t("筛选到期节点")}
          placeholder={t("搜索节点")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {[...groups].map(([month, items]) => (
        <section className={T.timelineGroup} key={month}>
          <div className={T.month}>{month}</div>
          <div className={T.dueList}>
            {items.map((n) => (
              <div className={T.due} key={n.id}>
                <div className={T.dueInfo}>
                  <NodeName node={n} />
                </div>
                <div className={T.dueRight}>
                  <span className={T.badge} data-tone={state(n)}>
                    {t(expiryText(n))}
                  </span>
                  <small>
                    {isLongTerm(n)
                      ? t("十年以上，无需近期续费")
                      : n.expires && daysLeft(n) !== null
                        ? new Intl.DateTimeFormat(settings.locale, {
                            timeZone: settings.timezone,
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                          }).format(new Date(n.expires))
                        : t("未设置到期")}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      {!rows.length && (
        <State
          empty={t(viewer.logged_in ? "没有符合条件的节点" : "登录后可见")}
        />
      )}
    </>
  );
}
export function Traffic() {
  const { viewer, settings } = useModel(),
    t = useTranslate();
  const [range, setRange] = useState<TrafficRange>("today");
  const report = useTraffic(range);
  if (!viewer.logged_in) return <State empty={t("访客模式不显示流量数据")} />;
  const items = report.data?.items ?? [];
  const total = (key: "up" | "down") => {
    const values = items
      .map((i) => i[key])
      .filter((v): v is number => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  };
  const up = total("up"),
    down = total("down");
  const date = (value: string | undefined) =>
    value
      ? new Intl.DateTimeFormat(settings.locale, {
          timeZone: report.data?.timezone ?? settings.timezone,
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(value))
      : "";
  return (
    <>
      <div className={T.intro}>
        <p>
          <span className={T.eyebrow}>TRAFFIC / KOMARI NEXT PRO</span>
          {t("查看节点用量、总量与配额。")}
        </p>
        <button
          className={T.action}
          onClick={() => void report.refetch()}
          disabled={report.isFetching}
        >
          {t("刷新")}
        </button>
      </div>
      <div className={T.bar}>
        <div className={T.segments}>
          {(
            [
              ["today", "今日"],
              ["yesterday", "昨日"],
              ["7d", "近 7 天"],
              ["30d", "近 30 天"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={range === id}
              onClick={() => setRange(id)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <span className={T.muted}>
          {t("统计时区：")}
          {report.data?.timezone ?? settings.timezone}
        </span>
      </div>
      {report.isPending ? (
        <State busy />
      ) : report.error ? (
        <State error={report.error} />
      ) : (
        <>
          <div className={T.stats}>
            {[
              ["上传", up],
              ["下载", down],
              ["合计", up === null || down === null ? null : up + down],
            ].map(([name, value]) => (
              <div className={T.stat} key={name as string}>
                {t(name as string)}
                <strong>{bytes(value as number | null)}</strong>
                <small>
                  {date(report.data?.start)} — {date(report.data?.end)}
                </small>
              </div>
            ))}
          </div>
          <div className={T.scroll}>
            <table className={T.table}>
              <thead>
                <tr>
                  {["节点", "上传", "下载", "合计", "额度使用"].map((h) => (
                    <th key={h}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td>{bytes(i.up)}</td>
                    <td>{bytes(i.down)}</td>
                    <td>
                      {bytes(
                        i.up === null || i.down === null ? null : i.up + i.down,
                      )}
                    </td>
                    <td>
                      {pct(
                        percent(quotaUsage(i.up, i.down, i.quotaMode), i.quota),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.some((i) => i.precision === "estimated") && (
            <p className={T.muted}>
              {t("历史统计受后端保留粒度影响，部分用量为聚合估算。")}
            </p>
          )}
        </>
      )}
    </>
  );
}
