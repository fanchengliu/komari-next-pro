import type { NetworkLine, PingTask } from "./network";
export function selectHomeNetwork(
  all: NetworkLine[],
  nodeId: string,
  tasks: PingTask[],
  mode: "auto" | "all" | "custom",
  ids: string[],
) {
  const assigned = tasks.filter((t) => t.clients.includes(nodeId));
  const tcp = assigned
    .filter((t) => t.type.toLowerCase() === "tcp")
    .map((t) => t.id);
  const available = all.filter((l) => l.nodeId === nodeId);
  const selected =
    mode === "custom"
      ? new Set(ids)
      : mode === "auto" && tcp.length
        ? new Set(tcp)
        : null;
  const lines = available.filter(
    (l) => selected === null || selected.has(l.taskId),
  );
  return {
    lines,
    taskIds: [...new Set(lines.map((l) => l.taskId))],
    names: [...new Set(lines.map((l) => l.name))],
    scope: mode === "auto" ? (tcp.length ? "tcp" : "all") : mode,
  };
}
