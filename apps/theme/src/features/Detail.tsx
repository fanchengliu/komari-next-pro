import T from "../ui/tools.module.css";
import { Modal } from "../ui/primitives";
import { useUI } from "../data/store";
import { ExtensionNotice } from "./tools/ExtensionCenter";
import { SingleNodeNetwork } from "./network/SingleNodeNetwork";
import { useTranslate } from "../data/i18n";
import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  Globe,
  ShieldCheck,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  ArrowLeft,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Job,
  JobKind,
  NodeInfo,
  MetricSeries,
} from "../../../../packages/contracts";
import { API } from "../../../../packages/contracts";
import { ipResultState } from "../../../../packages/contracts/ip-result";
import { useModel, useHistory } from "../data/context";
import { json } from "../data/rpc";
import { bytes, pct, percent, selectedPing } from "../domain/model";
import { S, Ring, State, DataTable } from "../ui/primitives";
import type { Line } from "../ui/Chart";
import { extensionWrite } from "../data/extension";
import { Metadata, ProbeResult } from "./ProbeResult";
import { useVisible } from "../data/visibility";
const Chart = lazy(() => import("../ui/Chart"));
const periods = [
  ["实时", 0.1],
  ["1h", 1],
  ["24h", 24],
  ["7天", 168],
  ["30天", 720],
] as const;
export function Ranges({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTranslate();
  return (
    <div className={S.ranges}>
      {periods.map(([name, h]) => (
        <button
          key={name}
          className={value === h ? S.active : ""}
          onClick={() => onChange(h)}
        >
          {t(name)}
        </button>
      ))}
    </div>
  );
}
export function Detail() {
  const t = useTranslate();
  const { id = "" } = useParams();
  const { nodes, statuses, loading, identity } = useModel();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "status";
  const node = nodes.find((n) => n.id === id);
  const status = statuses[id];
  if (!node)
    return (
      <main className={S.detail}>
        <State busy={loading} empty={t("节点不存在或当前账号无权查看")} />
        <Link to="/">{t("返回首页")}</Link>
      </main>
    );
  return (
    <main className={S.detail}>
      <section className={`${S.glass} ${S.detailHeader}`}>
        <h1 aria-label={node.name}>
          <Link to="/" aria-label={t("返回首页")}>
            <ArrowLeft size={21} />
          </Link>
          <span style={{ color: "#dc426b" }}>◌</span>
          {node.name}
        </h1>
        <div className={S.badges}>
          <span>{node.region}</span>
          <span className={status?.online ? S.onlineBadge : ""}>
            {status?.online ? t("在线") : t("离线")}
          </span>
          <span>{node.id}</span>
        </div>
      </section>
      <nav className={`${S.glass} ${S.tabs}`}>
        {[
          ["status", t("状态"), Activity],
          ["ip", t("IP信息"), Globe],
          ["network", t("网络质量"), ShieldCheck],
          ["services", t("本地服务"), Server],
        ].map(([key, name, Icon]) => {
          const I = Icon as typeof Activity;
          return (
            <button
              key={key as string}
              className={tab === key ? S.active : ""}
              onClick={() => setParams({ tab: key as string })}
            >
              <I size={15} />
              {t(name as string)}
            </button>
          );
        })}
      </nav>
      <section className={`${S.glass} ${S.detailPanel}`}>
        {tab === "status" ? (
          <Status node={node} />
        ) : tab === "network" ? (
          <SingleNodeNetwork id={node.id} />
        ) : tab === "ip" ? (
          <IPInfo key={`${identity}:${node.id}`} node={node} />
        ) : tab === "services" ? (
          <Jobs
            key={`${identity}:${node.id}:services`}
            node={node}
            kind="services"
          />
        ) : (
          <State empty={t("未知页面")} />
        )}
      </section>
    </main>
  );
}
function Status({ node }: { node: NodeInfo }) {
  const t = useTranslate();
  const { statuses, settings } = useModel();
  const s = statuses[node.id];
  const [resource, setResource] = useState<
    "cpu" | "memory" | "disk" | "network" | null
  >(null);
  const openPing = useUI((state) => state.set);
  const memory = percent(s?.memory, node.memory),
    disk = percent(s?.disk, node.disk);
  return (
    <>
      <div className={S.resourceGrid}>
        <button
          type="button"
          className={`${S.resourceCard} ${T.detailButton}`}
          onClick={() => setResource("cpu")}
          aria-label={t("查看处理器详情")}
        >
          <h3>
            <Cpu />
            {t("处理器")}
          </h3>
          <div>
            <strong>{pct(s?.cpu, 2)}</strong>
            <p>{t("利用率")}</p>
          </div>
          <Ring value={s?.cpu ?? 0} label="CPU" />
        </button>
        <button
          type="button"
          className={`${S.resourceCard} ${T.detailButton}`}
          onClick={() => setResource("memory")}
          aria-label={t("查看内存详情")}
        >
          <h3>
            <MemoryStick />
            {t("内存")}
          </h3>
          <div>
            <strong>{pct(memory)}</strong>
            <p>
              RAM: {bytes(s?.memory)} / {bytes(node.memory)}
            </p>
            <p>
              Swap: {bytes(s?.swap)} / {bytes(node.swap)}
            </p>
          </div>
          <Ring value={memory ?? 0} label="RAM" color="#a651ff" />
        </button>
        <button
          type="button"
          className={`${S.resourceCard} ${T.detailButton}`}
          onClick={() => setResource("disk")}
          aria-label={t("查看磁盘详情")}
        >
          <h3>
            <HardDrive />
            {t("硬盘")}
          </h3>
          <div>
            <strong>{pct(disk, 2)}</strong>
            <p>
              {bytes(s?.disk)} / {bytes(node.disk)}
            </p>
          </div>
          <Ring value={disk ?? 0} label="DISK" color="#f59e0b" />
        </button>
        <button
          type="button"
          className={`${S.resourceCard} ${T.detailButton}`}
          onClick={() => setResource("network")}
          aria-label={t("查看网络详情")}
        >
          <h3>
            <Wifi />
            {t("网络")}
          </h3>
          <div>
            <strong>
              {((((s?.downRate ?? 0) + (s?.upRate ?? 0)) * 8) / 1e6).toFixed(2)}{" "}
              Mbps
            </strong>
            <p>↑ {bytes(s?.upRate)}/s</p>
            <p>↓ {bytes(s?.downRate)}/s</p>
          </div>
          <Ring value={s?.online ? 100 : 0} label="NET" color="#22c58c" />
        </button>
      </div>
      <div className={T.bar}>
        <span className={T.muted}>{t("点击指标卡片展开完整详情")}</span>
        <button
          className={T.action}
          onClick={() => openPing({ pingTarget: { id: node.id } })}
        >
          {t("延迟 / 丢包")}
        </button>
      </div>
      <Modal
        title={`${node.name} · ${t(resource === "cpu" ? "处理器" : resource === "memory" ? "内存" : resource === "disk" ? "磁盘" : "网络")}`}
        open={!!resource}
        onClose={() => setResource(null)}
        wide
        className={T.window}
      >
        <div className={T.body}>
          {resource && <ResourceDetails node={node} kind={resource} />}
        </div>
      </Modal>
      <div className={S.chartGrid}>
        <HistoryPanel
          node={node}
          title={t("负载详情")}
          specs={[
            ["cpu.usage", "CPU", "#ff7b7b", 1],
            ["memory.used", t("内存"), "#8982cf", node.memory / 100],
            ["swap.used", "SWAP", "#00aa99", node.swap / 100],
          ]}
          unit="%"
        />
        <HistoryPanel
          node={node}
          title={t("带宽监控")}
          specs={[
            ["net.in.rate", t("下行"), settings.downloadColor, 1],
            ["net.out.rate", t("上行"), settings.uploadColor, 1],
          ]}
          unit=" B/s"
        />
      </div>
      <div className={S.section}>
        <h3>{t("系统信息")}</h3>
        <div className={S.chips}>
          <span>{node.os}</span>
          <span>
            {node.cpuName} · {node.cores}
            {t("核")}
          </span>
          <span>{node.arch}</span>
          <span>
            {t("进程")}
            {s?.processes ?? "--"} · TCP {s?.tcp ?? "--"} · UDP {s?.udp ?? "--"}
          </span>
        </div>
      </div>
    </>
  );
}
function HistoryPanel({
  node,
  title,
  specs,
  unit,
}: {
  node: NodeInfo;
  title: string;
  specs: [string, string, string, number][];
  unit: string;
}) {
  const t = useTranslate();
  const [hours, setHours] = useState(0.1);
  const { ref, visible } = useVisible<HTMLElement>();
  const query = useHistory(
    node.id,
    hours,
    specs.map((x) => x[0]),
    visible,
  );
  const lines = useMemo(
    () =>
      specs.map(([key, name, color, scale]): Line => ({
        name,
        color,
        points: (
          query.data?.series.find((s) => s.metric_key === key)?.points ?? []
        ).map((p) => [
          Date.parse(p.time),
          p.value === null || scale <= 0 ? null : p.value / scale,
        ]),
      })),
    [query.data, JSON.stringify(specs)],
  );
  return (
    <section className={S.chartPanel} ref={ref}>
      <div className={S.chartHeader}>
        <span>{title}</span>
        <Ranges value={hours} onChange={setHours} />
      </div>
      {query.isPending ? (
        <State busy />
      ) : query.error ? (
        <State error={query.error} />
      ) : lines.every((l) => !l.points.length) ? (
        <State empty={t("所选时段没有保留数据")} />
      ) : (
        <Suspense fallback={<State busy />}>
          <Chart lines={lines} unit={unit} />
        </Suspense>
      )}
    </section>
  );
}
function IPInfo({ node }: { node: NodeInfo }) {
  const t = useTranslate();
  const { viewer } = useModel();
  return (
    <>
      <div className={S.infoGrid}>
        <section className={S.infoCard}>
          <h3>{t("IPv4 地址")}</h3>
          <strong>{viewer.logged_in ? node.ipv4 || "--" : "***"}</strong>
          <p className={S.note}>
            {viewer.logged_in ? t("当前节点地址") : t("掩码显示")}
          </p>
        </section>
        <section className={S.infoCard}>
          <h3>{t("IPv6 地址")}</h3>
          <strong>{viewer.logged_in ? node.ipv6 || "--" : "***"}</strong>
          <p className={S.note}>
            {viewer.logged_in ? t("当前节点地址") : t("掩码显示")}
          </p>
        </section>
      </div>
      <div className={S.section}>
        <Jobs node={node} kind="ip" />
      </div>
      <div className={S.section}>
        <Jobs node={node} kind="unlock" />
      </div>
    </>
  );
}
export function Jobs({ node, kind }: { node: NodeInfo; kind: JobKind }) {
  const t = useTranslate();
  const { viewer, identity, extension } = useModel();
  const client = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const title = {
    ip: t("基础信息与 IP 质量"),
    unlock: t("流媒体解锁"),
    services: t("节点本地服务"),
  }[kind];
  const query = useQuery({
    queryKey: ["session", identity, "job", node.id, kind, jobId],
    enabled: viewer.logged_in && !!extension?.[kind],
    queryFn: ({ signal }) =>
      json<Job | null>(
        `${API}/jobs/${jobId ?? `latest?node=${encodeURIComponent(node.id)}&kind=${kind}`}`,
        { signal },
      ),
    refetchInterval: (q) =>
      q.state.data && ["queued", "running"].includes(q.state.data.state)
        ? 1500
        : false,
    staleTime: 30000,
  });
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const job = await extensionWrite<Job>("/jobs", "POST", {
        nodeId: node.id,
        kind,
      });
      setJobId(job.id);
      await client.invalidateQueries({
        queryKey: ["session", identity, "job", node.id, kind],
      });
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={S.infoCard}>
      <div className={S.chartHeader}>
        <h3>{title}</h3>
        <button
          disabled={
            !viewer.logged_in ||
            !extension?.[kind] ||
            busy ||
            query.data?.state === "running" ||
            query.data?.state === "queued"
          }
          onClick={run}
        >
          {busy
            ? t("提交中…")
            : kind === "services"
              ? t("刷新状态")
              : t("重新测试")}
        </button>
      </div>
      <p className={S.note}>
        {node.name} · {node.os}
      </p>
      {!viewer.logged_in ? (
        <div className={S.notice}>
          {kind === "unlock" ? (
            <ProbeResult guest />
          ) : kind === "ip" ? (
            <Metadata guest region={node.region} />
          ) : (
            t("登录后点击“刷新状态”获取当前节点快照")
          )}
        </div>
      ) : !extension?.[kind] ? (
        <ExtensionNotice />
      ) : error || query.error ? (
        <State error={error ?? query.error} />
      ) : query.isPending ? (
        <State busy />
      ) : query.data ? (
        <>
          <p className={S.note}>
            {t("状态：")}
            {
              (
                {
                  queued: t("排队中"),
                  running: t("测试中"),
                  done: t("已完成"),
                  partial: t("部分完成"),
                  failed: t("失败"),
                } as const
              )[
                kind === "ip" &&
                query.data.result &&
                ["done", "partial", "failed"].includes(query.data.state)
                  ? ipResultState(query.data.result)
                  : query.data.state
              ]
            }{" "}
            · {new Date(query.data.updatedAt).toLocaleString()}
          </p>
          {query.data.state === "failed" &&
          !(kind === "ip" && query.data.result) ? (
            <State error={new Error(query.data.error || t("任务失败"))} />
          ) : query.data.result ? (
            kind === "ip" ? (
              <Metadata
                result={query.data.result}
                region={node.region}
                at={query.data.updatedAt}
              />
            ) : kind === "unlock" ? (
              <ProbeResult result={query.data.result} />
            ) : (
              <pre className={S.jobResult}>
                {typeof query.data.result === "string"
                  ? query.data.result
                  : JSON.stringify(query.data.result, null, 2)}
              </pre>
            )
          ) : (
            <State busy />
          )}
        </>
      ) : kind === "ip" ? (
        <Metadata region={node.region} />
      ) : kind === "unlock" ? (
        <ProbeResult />
      ) : (
        <State empty={t("等待手动刷新")} />
      )}
      {kind === "services" && (
        <p className={S.note}>
          {t(
            "页面不会自动执行命令；手动点击后，仅对当前节点执行固定的只读快照任务。",
          )}
        </p>
      )}
    </section>
  );
}

function ResourceDetails({
  node,
  kind,
}: {
  node: NodeInfo;
  kind: "cpu" | "memory" | "disk" | "network";
}) {
  const { statuses, settings } = useModel(),
    t = useTranslate();
  const s = statuses[node.id];
  const items =
    kind === "cpu"
      ? [
          [t("处理器"), node.cpuName],
          [t("核心数"), `${node.cores} vCPU`],
          [t("利用率"), pct(s?.cpu)],
        ]
      : kind === "memory"
        ? [
            ["RAM", `${bytes(s?.memory)} / ${bytes(node.memory)}`],
            ["SWAP", `${bytes(s?.swap)} / ${bytes(node.swap)}`],
            [t("利用率"), pct(percent(s?.memory, node.memory))],
          ]
        : kind === "disk"
          ? [
              [t("已用"), bytes(s?.disk)],
              [t("总容量"), bytes(node.disk)],
              [t("利用率"), pct(percent(s?.disk, node.disk))],
            ]
          : [
              [t("下行"), bytes(s?.downRate) + "/s"],
              [t("上行"), bytes(s?.upRate) + "/s"],
              [t("累计流量"), bytes((s?.downTotal ?? 0) + (s?.upTotal ?? 0))],
            ];
  const specs: [string, string, string, number][] =
    kind === "cpu"
      ? [["cpu.usage", "CPU", settings.accent, 1]]
      : kind === "memory"
        ? [
            ["memory.used", "RAM", "#a651ff", node.memory / 100],
            ["swap.used", "SWAP", "#22bfa2", node.swap / 100],
          ]
        : kind === "disk"
          ? [["disk.used", t("磁盘"), "#e5a52b", node.disk / 100]]
          : [
              ["net.in.rate", t("下行"), settings.downloadColor, 1],
              ["net.out.rate", t("上行"), settings.uploadColor, 1],
            ];
  return (
    <>
      <div className={T.details}>
        {items.map(([name, value]) => (
          <div className={T.detailValue} key={name}>
            <small>{name}</small>
            <strong>{value || "--"}</strong>
          </div>
        ))}
      </div>
      <HistoryPanel
        node={node}
        title={t("历史趋势")}
        specs={specs}
        unit={kind === "network" ? " B/s" : "%"}
      />
    </>
  );
}
