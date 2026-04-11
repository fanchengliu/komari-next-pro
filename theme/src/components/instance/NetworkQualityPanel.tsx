"use client";

import { useEffect, useMemo, useState } from "react";
import { Radar, Activity, Wifi, ShieldCheck, Route } from "lucide-react";
import { useRPC2Call } from "@/contexts/RPC2Context";
import PingChart from "./PingChart";

type PingRecord = {
  client: string;
  task_id: number;
  time: string;
  value: number;
};

type TaskInfo = {
  id: number;
  name: string;
  interval: number;
  loss: number;
  p99?: number;
  p50?: number;
  p99_p50_ratio?: number;
  min?: number;
  max?: number;
  avg?: number;
  latest?: number;
  total?: number;
  type?: string;
};

const colors = ["#F38181", "#347433", "#898AC4", "#03A6A1", "#7AD6F0", "#B388FF", "#FF8A65", "#FFD600"];

function fmtMs(v?: number) { return typeof v === "number" && Number.isFinite(v) ? `${Math.round(v)} ms` : "--"; }
function fmtPct(v?: number) { return typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(1)} %` : "--"; }
function fmtNum(v?: number, digits = 2) { return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "--"; }
function toneByLatency(v?: number) { if (typeof v !== "number" || !Number.isFinite(v)) return "neutral"; if (v < 100) return "good"; if (v < 220) return "warn"; return "bad"; }
function toneByLoss(v?: number) { if (typeof v !== "number" || !Number.isFinite(v)) return "neutral"; if (v < 2) return "good"; if (v < 8) return "warn"; return "bad"; }
function toneByVol(v?: number) { if (typeof v !== "number" || !Number.isFinite(v)) return "neutral"; if (v < 1.8) return "good"; if (v < 3.2) return "warn"; return "bad"; }

export default function NetworkQualityPanel({ uuid }: { uuid: string }) {
  const { call } = useRPC2Call();
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenLines, setHiddenLines] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!uuid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        type RpcResp = { count: number; records: PingRecord[]; tasks?: TaskInfo[]; from?: string; to?: string; };
        const result = await call<any, RpcResp>("common:getRecords", { uuid, type: "ping", hours: 24 });
        if (cancelled) return;
        const nextTasks = result?.tasks || [];
        setTasks(nextTasks);
        setHiddenLines((prev) => {
          const next = { ...prev };
          for (const t of nextTasks) {
            if (!(String(t.id) in next)) next[String(t.id)] = false;
          }
          return next;
        });
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uuid, call]);

  const stats = useMemo(() => {
    const valid = tasks.filter((t) => typeof t.avg === "number" || typeof t.latest === "number");
    const latestLatency = valid.length ? valid.reduce((s, t) => s + (typeof t.latest === "number" ? t.latest : (t.avg || 0)), 0) / valid.length : undefined;
    const avgLoss = tasks.length ? tasks.reduce((s, t) => s + (typeof t.loss === "number" ? t.loss : 0), 0) / tasks.length : undefined;
    const volTasks = tasks.filter((t) => typeof t.p99_p50_ratio === "number");
    const avgVol = volTasks.length ? volTasks.reduce((s, t) => s + (t.p99_p50_ratio || 0), 0) / volTasks.length : undefined;
    const successRate = typeof avgLoss === 'number' ? Math.max(0, 100 - avgLoss) : undefined;
    return { latestLatency, avgLoss, avgVol, successRate };
  }, [tasks]);

  const toggleTask = (id: number) => {
    const key = String(id);
    setHiddenLines((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="ds-nq-page ds-nq-page-redesign">
      <div className="ds-nq-overview-grid ds-nq-overview-grid-4">
        <div className={`ds-nq-kpi ds-nq-kpi-${toneByLatency(stats.latestLatency)}`}>
          <div className="ds-nq-kpi-head"><span className="ds-nq-kpi-ico"><Radar size={16} /></span><span>平均延迟</span></div>
          <div className="ds-nq-kpi-value ds-nq-kpi-value-center">{fmtMs(stats.latestLatency)}</div>
        </div>
        <div className={`ds-nq-kpi ds-nq-kpi-${toneByVol(stats.avgVol)}`}>
          <div className="ds-nq-kpi-head"><span className="ds-nq-kpi-ico"><Activity size={16} /></span><span>抖动（波动）</span></div>
          <div className="ds-nq-kpi-value ds-nq-kpi-value-center">{fmtNum(stats.avgVol, 2)}</div>
        </div>
        <div className={`ds-nq-kpi ds-nq-kpi-${toneByLoss(stats.avgLoss)}`}>
          <div className="ds-nq-kpi-head"><span className="ds-nq-kpi-ico"><Wifi size={16} /></span><span>丢包率</span></div>
          <div className="ds-nq-kpi-value ds-nq-kpi-value-center">{fmtPct(stats.avgLoss)}</div>
        </div>
        <div className={`ds-nq-kpi ds-nq-kpi-${toneByLoss(stats.avgLoss)}`}>
          <div className="ds-nq-kpi-head"><span className="ds-nq-kpi-ico"><ShieldCheck size={16} /></span><span>成功率</span></div>
          <div className="ds-nq-kpi-value ds-nq-kpi-value-center">{fmtPct(stats.successRate)}</div>
        </div>
      </div>

      <div className="ds-nq-monitor-shell ds-nq-monitor-shell-v2">
        <section className="ds-nq-side-card">
          <header className="ds-nq-side-card-head">
            <div className="ds-nq-side-card-title"><Route size={16} /> 延迟监控</div>
          </header>
          <div className="ds-nq-side-card-body">
            <div className="ds-nq-side-scroll">
              {tasks.map((task, idx) => {
                const hidden = !!hiddenLines[String(task.id)];
                const tone = toneByLatency(task.latest ?? task.avg);
                return (
                  <button
                    key={task.id}
                    className={`ds-nq-route-block ds-nq-route-block-${tone} ${hidden ? 'is-hidden' : 'is-active'}`}
                    onClick={() => toggleTask(task.id)}
                    type="button"
                    title={hidden ? '点击显示该线路' : '点击隐藏该线路'}
                  >
                    <div className="ds-nq-route-block-top">
                      <span className="ds-nq-route-dot" style={{ background: colors[idx % colors.length] }} />
                      <span className="ds-nq-route-name">{task.name}</span>
                    </div>
                    <div className="ds-nq-route-pill-group">
                      <div className="ds-nq-route-pill-row">
                        {task.type ? <span className="ds-nq-route-pill">{String(task.type).toUpperCase()}</span> : null}
                        {typeof task.interval === 'number' ? <span className="ds-nq-route-pill">{task.interval}s</span> : null}
                      </div>
                      <div className="ds-nq-route-pill-row">
                        <span className="ds-nq-route-pill">{fmtMs(task.latest ?? task.avg)}</span>
                        <span className="ds-nq-route-pill">{fmtPct(task.loss)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {loading ? <div className="ds-nq-monitor-note">正在加载线路数据…</div> : null}
              {error ? <div className="ds-nq-monitor-note ds-nq-monitor-note-warn">{error}</div> : null}
            </div>
          </div>
        </section>

        <section className="ds-nq-trend-card">
          <header className="ds-nq-side-card-head ds-nq-trend-card-head">
            <div className="ds-nq-side-card-title"><Activity size={16} /> 延迟趋势</div>
          </header>
          <div className="ds-nq-trend-card-body">
            <PingChart uuid={uuid} externalHiddenLines={hiddenLines} onHiddenLinesChange={setHiddenLines} />
          </div>
        </section>
      </div>
    </div>
  );
}
