import { expiryText } from "../domain/model";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Plus, X } from "lucide-react";
import type { NodeInfo, NodeStatus } from "../../../../packages/contracts";
import { useModel } from "../data/context";
import { useTranslate } from "../data/i18n";
import { useUI } from "../data/store";
import { bytes, daysLeft, pct, percent } from "../domain/model";
import { selectVisibleIds } from "../domain/network";
import { NodePicker } from "./network/NodePicker";
import { PageHeader } from "../ui/PageHeader";
import { Flag } from "../ui/Flag";
import { State } from "../ui/primitives";
import { Freshness } from "../ui/Freshness";
import V from "../ui/v2.module.css";
interface Row {
  label: string;
  value: (node: NodeInfo, status: NodeStatus | undefined) => string;
}
export function compareRows(
  privateDetails: boolean,
  t: (v: string) => string,
): { name: string; rows: Row[] }[] {
  const privateText = t("登录后可见");
  return [
    {
      name: t("基础信息"),
      rows: [
        { label: t("地区"), value: (n) => n.region },
        { label: t("处理器"), value: (n) => n.cpuName || "--" },
        {
          label: t("核心数"),
          value: (n) => (n.cores ? `${n.cores} vCPU` : "--"),
        },
        {
          label: t("内存 / 磁盘"),
          value: (n) => `${bytes(n.memory)} / ${bytes(n.disk)}`,
        },
        {
          label: t("系统 / 虚拟化"),
          value: (n) => `${n.os || "--"} · ${n.virtualization || "--"}`,
        },
        { label: t("架构"), value: (n) => n.arch || "--" },
        {
          label: "IPv4 / IPv6",
          value: (n) =>
            privateDetails
              ? `${n.ipv4 || "--"} / ${n.ipv6 || "--"}`
              : "*** / ***",
        },
      ],
    },
    {
      name: t("计费与配额"),
      rows: [
        {
          label: t("价格 / 周期"),
          value: (n) =>
            privateDetails
              ? n.price <= 0
                ? t("免费")
                : `${n.currency}${n.price} / ${n.billingDays} ${t("天")}`
              : privateText,
        },
        {
          label: t("流量额度"),
          value: (n) =>
            n.quota ? `${bytes(n.quota)} · ${n.quotaMode}` : t("不限量"),
        },
        {
          label: t("剩余时间"),
          value: (n) => {
            const days = daysLeft(n);
            return t(expiryText(n));
          },
        },
      ],
    },
    {
      name: t("当前状态"),
      rows: [
        {
          label: t("状态"),
          value: (_, s) =>
            s ? (s.online ? t("在线") : t("离线")) : t("等待数据"),
        },
        { label: t("CPU 使用率"), value: (_, s) => pct(s?.cpu) },
        {
          label: t("内存 / 磁盘使用"),
          value: (n, s) =>
            `${pct(percent(s?.memory, n.memory))} / ${pct(percent(s?.disk, n.disk))}`,
        },
        {
          label: t("下载 / 上传"),
          value: (_, s) => `${bytes(s?.downRate)}/s / ${bytes(s?.upRate)}/s`,
        },
        {
          label: t("持续运行"),
          value: (_, s) =>
            s?.uptime == null
              ? "--"
              : s.uptime >= 86400
                ? t(`${Math.floor(s.uptime / 86400)}天`)
                : `${Math.floor(s.uptime / 3600)} h`,
        },
      ],
    },
  ];
}
export function Compare() {
  const { nodes, statuses, viewer, loading } = useModel();
  const t = useTranslate();
  const ui = useUI();
  const [params, setParams] = useSearchParams(),
    [onlyDiff, setOnlyDiff] = useState(false);
  const raw = params.get("nodes");
  const selected = useMemo(
    () =>
      selectVisibleIds(raw === null ? ui.compareIds : raw.split(","), nodes),
    [raw, ui.compareIds, nodes],
  );
  const selectedNodes = useMemo(
    () => selected.map((id) => nodes.find((n) => n.id === id)!),
    [selected, nodes],
  );
  const update = (ids: string[]) => {
    setParams({ nodes: ids.join(",") });
  };
  useEffect(() => {
    if (
      !loading &&
      raw !== null &&
      selected.join(",") !== ui.compareIds.join(",")
    )
      ui.set({ compareIds: selected });
  }, [loading, raw, selected, ui.compareIds, ui.set]);
  const groups = useMemo(
    () =>
      compareRows(viewer.logged_in, t)
        .map((g) => ({
          ...g,
          rows: g.rows
            .map((r) => ({
              ...r,
              values: selectedNodes.map((n) => r.value(n, statuses[n.id])),
            }))
            .map((r) => ({ ...r, different: new Set(r.values).size > 1 }))
            .filter((r) => !onlyDiff || r.different),
        }))
        .filter((g) => g.rows.length),
    [selectedNodes, statuses, viewer.logged_in, onlyDiff, t],
  );
  return (
    <main className={V.page}>
      <PageHeader
        title={t("节点对比")}
        eyebrow="COMPARE / KOMARI NEXT PRO"
        description={t(
          "基础信息、配额和状态按相同字段排列，最多同时比较四台。",
        )}
      >
        <Freshness />
        <NodePicker selected={selected} onChange={update} />
      </PageHeader>
      <div className={V.compareCards}>
        {selectedNodes.map((n) => (
          <section className={`${V.panel} ${V.compareCard}`} key={n.id}>
            <button
              className={V.remove}
              aria-label={`${t("移除")} ${n.name}`}
              onClick={() => update(selected.filter((id) => id !== n.id))}
            >
              <X size={14} />
            </button>
            <h3>
              <Flag region={n.region} />
              {n.name}
            </h3>
            <div className={V.actions}>
              <span className={V.softBadge}>
                <i
                  className={V.dot}
                  data-status={statuses[n.id]?.online ? "online" : "offline"}
                />
                {statuses[n.id]?.online ? t("在线") : t("离线")}
              </span>
              <span className={V.softBadge}>
                {n.cores}C / {bytes(n.memory)}
              </span>
              {n.group && <span className={V.softBadge}>{n.group}</span>}
            </div>
            <p>
              {n.os} · {n.arch}
            </p>
          </section>
        ))}
        {selected.length < 4 && (
          <div className={V.compareAdd}>
            <Plus size={22} />
            <span>{t("加入另一台节点")}</span>
            <NodePicker selected={selected} onChange={update} />
          </div>
        )}
      </div>
      {loading ? (
        <State busy />
      ) : !selected.length ? (
        <section className={V.panel}>
          <State empty={t("请选择需要比较的节点")} />
        </section>
      ) : (
        <section className={V.panel}>
          <div className={V.panelHeader}>
            <h2>{t("基础信息对照")}</h2>
            <label className={V.check}>
              <input
                type="checkbox"
                checked={onlyDiff}
                onChange={(e) => setOnlyDiff(e.target.checked)}
              />
              {t("仅看差异")}
            </label>
          </div>
          <div className={V.tableWrap}>
            <table className={`${V.table} ${V.compareTable}`}>
              <thead>
                <tr>
                  <th>{t("对比项目")}</th>
                  {selectedNodes.map((n) => (
                    <th key={n.id}>{n.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Group key={g.name} group={g} count={selected.length} />
                ))}
              </tbody>
            </table>
          </div>
          {!groups.length && <State empty={t("当前可见字段没有差异")} />}
          <div className={V.tableFooter}>
            <p>{t("浅色标记不同项；敏感信息遵循当前账号权限。")}</p>
            <Link
              className={`${V.nodeChip} ${V.primary}`}
              to={`/network?nodes=${encodeURIComponent(selected.join(","))}`}
            >
              <Activity size={14} />
              {t("去网络总览比较")}
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
function Group({
  group,
  count,
}: {
  group: {
    name: string;
    rows: { label: string; values: string[]; different: boolean }[];
  };
  count: number;
}) {
  return (
    <>
      <tr className={V.compareGroup}>
        <td colSpan={count + 1}>{group.name}</td>
      </tr>
      {group.rows.map((r) => (
        <tr key={r.label} data-different={r.different}>
          <td>{r.label}</td>
          {r.values.map((value, i) => (
            <td key={i}>{value}</td>
          ))}
        </tr>
      ))}
    </>
  );
}
