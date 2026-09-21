import type { MetricResponse } from "../../packages/contracts";
export function demoNodes(count = 10) {
  return Array.from({ length: count }, (_, i) => ({
    uuid: `demo-${String(i + 1).padStart(3, "0")}`,
    name:
      [
        "Hong Kong · Edge",
        "Seoul · Compute",
        "Frankfurt · Core",
        "Virginia · Core",
        "Pacific · Premium",
        "Pacific · Value",
        "Virginia · Storage",
        "New Jersey · Edge",
        "Los Angeles · Edge",
        "Malaysia · Edge",
      ][i % 10] + (i >= 10 ? `-${i}` : ""),
    cpu_name: i % 3 ? "AMD EPYC 9654" : "Neoverse-N1",
    cpu_cores: i % 3 ? 1 : 2,
    arch: i % 3 ? "amd64" : "arm64",
    virtualization: "kvm",
    os: i % 2 ? "Debian GNU/Linux 12 (bookworm)" : "Ubuntu 24.04 LTS",
    region: ["🇭🇰", "🇰🇷", "🇩🇪", "🇺🇸", "🇺🇸", "🇺🇸", "🇺🇸", "🇺🇸", "🇺🇸", "🇲🇾"][
      i % 10
    ],
    group: ["主力", "大善人", "落地机"][i % 3],
    weight: i,
    mem_total: i % 3 ? 1024 ** 3 : 12 * 1024 ** 3,
    swap_total: 2 * 1024 ** 3,
    disk_total: 40 * 1024 ** 3,
    price: i % 3 ? 49.9 : -1,
    currency: "$",
    billing_cycle: 365,
    expired_at: i % 3 ? "2026-12-22T00:00:00Z" : "2226-02-11T00:00:00Z",
    created_at: "2026-02-06T00:00:00Z",
    hidden: false,
    traffic_limit: 2 * 1024 ** 4,
    traffic_limit_type: ["sum", "max", "up"][i % 3],
    ipv4: `192.0.2.${i + 1}`,
    ipv6: `2001:db8::${i + 1}`,
  }));
}
export function demoStatus(count = 10) {
  return Object.fromEntries(
    demoNodes(count).map((n, i) => [
      n.uuid,
      {
        client: n.uuid,
        time: new Date().toISOString(),
        online: i % 10 !== 9,
        cpu: [0.8, 1.3, 0.9, 20.6, 3, 0.8, 0.3, 0, 6.7, 0][i % 10],
        ram: n.mem_total * (0.09 + (i % 5) * 0.1),
        ram_total: n.mem_total,
        swap: 80 * 1024 ** 2,
        swap_total: n.swap_total,
        disk: n.disk_total * (0.13 + (i % 4) * 0.1),
        disk_total: n.disk_total,
        net_in: 217 + i * 258,
        net_out: 623 + i * 318,
        net_total_up: (4 + i * 36) * 1024 ** 3,
        net_total_down: (8 + i * 39) * 1024 ** 3,
        uptime: 86400 * (10 + i * 8),
        process: 120 + i,
        connections: 83,
        connections_udp: 2,
        load: 0.3,
        ping:
          i === 0
            ? {}
            : Object.fromEntries(
                [
                  "海外线路",
                  "黑龙江移动线路",
                  "黑龙江联通线路",
                  "黑龙江电信线路",
                  "海南移动线路",
                  "海南联通线路",
                  "海南电信线路",
                ].map((name, j) => [
                  String(j + 1),
                  {
                    name,
                    latest: j === 0 ? 1 : 65 + i * 17 + j * 3,
                    avg: j === 0 ? 1 : 65 + i * 17 + j * 3,
                    tail: 0.23,
                    loss: i % 4 === 0 ? 5 : 0,
                  },
                ]),
              ),
      },
    ]),
  );
}
export function demoMetrics(params: any, count = 10): MetricResponse {
  if (
    (params.metric_keys ?? [params.metric_key]).some((key: string) =>
      key?.startsWith("ping."),
    )
  )
    return demoNetworkMetrics(params, count);
  const end = params.end ? Date.parse(params.end) : Date.now(),
    start = params.start
      ? Date.parse(params.start)
      : end - (params.hours ?? 1) * 3600000;
  const ids = params.entity_ids ?? [params.entity_id ?? "demo-001"];
  const keys: string[] = params.metric_keys ?? [
    params.metric_key ?? "cpu.usage",
  ];
  const series = ids.flatMap((id: string) =>
    keys.flatMap((key) =>
      Array.from({ length: key === "ping.latency_ms" ? 7 : 1 }, (_, task) => ({
        entity_id: id,
        metric_key: key,
        tags:
          key === "ping.latency_ms" ? { task_id: String(task + 1) } : undefined,
        downsampled: true,
        interval_seconds: 60,
        downsample_algorithm:
          params.aggregation_by_metric?.[key] ?? params.aggregation ?? "avg",
        points: Array.from({ length: 40 }, (_, i) => ({
          time: new Date(start + ((end - start) * i) / 39).toISOString(),
          value: key.startsWith("net.total")
            ? i * 12000000
            : key.startsWith("traffic.")
              ? 12000000
              : key === "memory.used"
                ? 500 * 1024 ** 2
                : key === "swap.used"
                  ? 80 * 1024 ** 2
                  : key.startsWith("net.")
                    ? 1000 + Math.abs(Math.sin(i * 1.3)) * 8000
                    : key === "ping.latency_ms"
                      ? task === 0
                        ? 1
                        : 130 + task * 8 + Math.sin(i) * 10
                      : 3 + Math.sin(i) * 2,
          count: 1,
        })),
      })),
    ),
  );
  return {
    series,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}
export function demoTasks(count = 10) {
  return [
    "海外线路",
    "黑龙江移动线路",
    "黑龙江联通线路",
    "黑龙江电信线路",
    "海南移动线路",
    "海南联通线路",
    "海南电信线路",
  ].map((name, i) => ({
    id: i + 1,
    name,
    type: i === 0 ? "icmp" : "tcp",
    interval: i === 0 || i >= 4 ? 180 : 60,
    weight: i,
    clients: demoNodes(count)
      .slice(1)
      .map((n) => n.uuid),
  }));
}
export function demoNetworkMetrics(params: any, count = 10): MetricResponse {
  const end = params.end ? Date.parse(params.end) : Date.now(),
    start = params.start
      ? Date.parse(params.start)
      : end - (params.hours ?? 1) * 3600000;
  const ids: string[] = params.entity_ids ?? [params.entity_id ?? "demo-001"];
  const keys: string[] = params.metric_keys ?? ["ping.latency_ms", "ping.loss"];
  const interval = Math.max(
    60000,
    Math.ceil((end - start) / Math.min(params.max_points ?? 48, 120) / 60000) *
      60000,
  );
  const series = ids
    .filter((id) => id !== "demo-001")
    .flatMap((id) =>
      keys.flatMap((key) =>
        demoTasks(count).map((task) => {
          const total = Math.max(
              1,
              Math.round(interval / (task.interval * 1000)),
            ),
            points = [];
          let i = 0;
          for (
            let time = Math.floor(start / interval) * interval;
            time < end;
            time += interval, i++
          ) {
            const base =
              task.id === 1
                ? 1
                : 143 + task.id * 5 + (id === "demo-006" ? 18 : 0);
            const relative = (time - start) / (end - start);
            const spike =
              id === "demo-006" &&
              task.id === 2 &&
              relative > 0.42 &&
              relative < 0.61
                ? Math.sin(((relative - 0.42) / 0.19) * Math.PI) * 96
                : 0;
            const success = Math.round(
              base + Math.sin(i * 1.6 + task.id) * 5 + spike,
            );
            const failed = i % 17 === 7 && task.id === 2 ? 1 : 0;
            points.push({
              time: new Date(time).toISOString(),
              value:
                i === 3
                  ? null
                  : key === "ping.loss"
                    ? failed / total
                    : failed === total
                      ? null
                      : (success * (total - failed) - failed) / total,
              count: i === 3 ? 0 : total,
              tags: { task_id: String(task.id) },
            });
          }
          return {
            metric_key: key,
            entity_id: id,
            unit: key === "ping.loss" ? "ratio" : "ms",
            tags: { task_id: String(task.id) },
            downsampled: true,
            downsample_algorithm: "avg",
            interval_seconds: interval / 1000,
            points,
          };
        }),
      ),
    );
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    series,
  };
}
export function demoPingStats(params: any, count = 10) {
  const data = demoNetworkMetrics(
    { ...params, metric_keys: ["ping.latency_ms", "ping.loss"] },
    count,
  );
  return {
    start: data.start,
    end: data.end,
    stats: data.series
      .filter((s) => s.metric_key === "ping.loss")
      .map((s) => {
        const known = s.points.filter((p) => p.value !== null),
          total = known.reduce((sum, p) => sum + (p.count ?? 0), 0),
          fail = known.reduce((sum, p) => sum + p.value! * (p.count ?? 0), 0);
        return {
          entity_id: s.entity_id,
          task_id: s.tags!.task_id,
          name: demoTasks(count).find((t) => String(t.id) === s.tags!.task_id)
            ?.name,
          total,
          valid: Math.round(total - fail),
          loss: total ? (fail / total) * 100 : 0,
          loss_approximate: false,
        };
      }),
  };
}
