import { useExchangeRates } from "./exchange";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  API,
  defaultSettings,
  settingsSchema,
  resolveThemeSettings,
  type PublicInfo,
  type Viewer,
  type NodeInfo,
  type NodeStatus,
  type ThemeSettings,
  type MetricResponse,
  type TrafficRange,
  type TrafficReport,
  type ExtensionCapabilities,
  type Playlist,
} from "../../../../packages/contracts";
import { normalizeNodes, normalizeStatuses } from "../domain/model";
import { rpc, rest, json, ApiError } from "./rpc";
import { useUI } from "./store";
import { normalizeTasks, type PingTask } from "../domain/network";
import {
  trafficWindow,
  trafficItems,
} from "../../../../packages/contracts/traffic";
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      gcTime: 120000,
      retry: (n, e) =>
        n < 1 &&
        !(e instanceof ApiError && [401, 403, -32601].includes(e.code)),
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
    },
  },
});
type Model = {
  fx: ReturnType<typeof useExchangeRates>;
  viewer: Viewer;
  identity: string;
  nodes: NodeInfo[];
  statuses: Record<string, NodeStatus>;
  site: PublicInfo | undefined;
  settings: ThemeSettings;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
  tasks: PingTask[];
  tasksError: Error | null;
  extension: ExtensionCapabilities | undefined;
  refresh: () => void;
};
const Context = createContext<Model | null>(null);
export const useModel = () => useContext(Context)!;
function DataProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const me = useQuery({
    queryKey: ["identity"],
    queryFn: ({ signal }) => rest<Viewer>("/api/me", signal),
    staleTime: 5000,
    refetchInterval: 15000,
  });
  const viewer = me.data ?? { logged_in: false, username: "Guest" };
  const identity = me.data
    ? viewer.logged_in
      ? `user:${viewer.uuid ?? viewer.username}`
      : "guest"
    : "pending";
  useEffect(() => {
    rpc.reset();
    useUI.getState().set({ compareIds: [], pingTarget: null });
    client.removeQueries({
      predicate: (q) =>
        q.queryKey[0] === "session" && q.queryKey[1] !== identity,
    });
    return () => rpc.reset();
  }, [identity, client]);
  const enabled = !!me.data;
  const site = useQuery({
    queryKey: ["session", identity, "public"],
    queryFn: ({ signal }) => rest<PublicInfo>("/api/public", signal),
    enabled,
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const nodes = useQuery({
    queryKey: ["session", identity, "nodes"],
    queryFn: async ({ signal }) =>
      normalizeNodes(await rpc.call("common:getNodes", {}, signal)),
    enabled,
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const status = useQuery({
    queryKey: ["session", identity, "status"],
    queryFn: async ({ signal }) =>
      normalizeStatuses(
        await rpc.call("common:getNodesLatestStatus", {}, signal),
      ),
    enabled,
    staleTime: 4000,
    refetchInterval: 5000,
  });
  const extension = useQuery({
    queryKey: ["session", identity, "extension"],
    queryFn: ({ signal }) =>
      json<ExtensionCapabilities>(`${API}/capabilities`, { signal }),
    enabled,
    staleTime: 300000,
    retry: false,
  });
  const fx = useExchangeRates(extension.data, enabled && extension.isFetched);
  const taskQuery = useQuery({
    queryKey: ["session", identity, "ping-tasks"],
    queryFn: ({ signal }) =>
      rpc.call<unknown>("public:getPublicPingTasks", {}, signal),
    enabled,
    staleTime: 60000,
    refetchInterval: 60000,
    retry: false,
  });
  const tasks = useMemo(() => {
    if (Array.isArray(taskQuery.data))
      return normalizeTasks(
        taskQuery.data,
        (nodes.data ?? []).map((n) => n.id),
      );
    const fallback = new Map<
      string,
      { id: string; name: string; clients: string[] }
    >();
    for (const n of nodes.data ?? [])
      for (const p of status.data?.[n.id]?.ping ?? []) {
        const task = fallback.get(p.id) ?? {
          id: p.id,
          name: p.name,
          clients: [],
        };
        task.clients.push(n.id);
        fallback.set(p.id, task);
      }
    return normalizeTasks(
      [...fallback.values()],
      (nodes.data ?? []).map((n) => n.id),
    );
  }, [
    taskQuery.data,
    nodes.data,
    Array.isArray(taskQuery.data) ? null : status.data,
  ]);
  const preferences = useUI((s) => s.preferences);
  const settings = useMemo(() => {
    const source =
      site.data?.theme === "komari-ds" ? site.data.theme_settings : {};
    const base = {
      ...defaultSettings,
      logo: import.meta.env.BASE_URL + "media/logo.png",
      background: import.meta.env.BASE_URL + "media/background.mp4",
    };
    return resolveThemeSettings(source, preferences, base);
  }, [site.data, preferences]);
  useEffect(() => {
    document.title = site.data?.sitename || "Komari Next Pro";
    document.documentElement.lang = settings.locale;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      document.documentElement.dataset.appearance =
        settings.appearance === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.appearance;
    };
    update();
    media.addEventListener("change", update);
    document.documentElement.style.setProperty("--accent", settings.accent);
    if (settings.cardOpacity === null)
      document.documentElement.style.removeProperty("--card-opacity");
    else
      document.documentElement.style.setProperty(
        "--card-opacity",
        String(settings.cardOpacity / 100),
      );
    document.documentElement.style.setProperty(
      "--download",
      settings.downloadColor,
    );
    document.documentElement.style.setProperty(
      "--upload",
      settings.uploadColor,
    );
    return () => media.removeEventListener("change", update);
  }, [site.data, settings]);
  useEffect(() => {
    if (viewer.logged_in || !settings.visitorKeyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          ["I", "J", "C"].includes(e.key.toUpperCase()))
      )
        e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewer.logged_in, settings.visitorKeyboard]);
  useEffect(
    () => useUI.getState().set({ siteLocale: settings.locale }),
    [settings.locale],
  );
  const value: Model = {
    fx,
    viewer,
    identity,
    nodes: nodes.data ?? [],
    statuses: status.data ?? {},
    site: site.data,
    settings,
    loading: me.isPending || nodes.isPending || status.isPending,
    error: me.error ?? nodes.error ?? status.error,
    lastUpdate: status.dataUpdatedAt,
    tasks,
    tasksError: taskQuery.error,
    extension: extension.data,
    refresh: () => {
      void client.invalidateQueries({ queryKey: ["session", identity] });
      void client.invalidateQueries({ queryKey: ["identity"] });
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DataProvider>{children}</DataProvider>
    </QueryClientProvider>
  );
}
export function useHistory(
  id: string,
  hours: number,
  keys: string[],
  enabled = true,
) {
  const { identity } = useModel();
  return useQuery({
    queryKey: ["session", identity, "history", id, hours, ...keys],
    queryFn: ({ signal }) =>
      rpc.call<MetricResponse>(
        "public:queryMetrics",
        {
          entity_id: id,
          metric_keys: keys,
          hours,
          max_points: 240,
          aggregation: "avg",
          fill_empty: true,
        },
        signal,
      ),
    enabled: enabled && !!id,
    staleTime: hours <= 1 ? 15000 : 60000,
    refetchInterval: hours <= 1 ? 15000 : false,
  });
}
export function usePlaylist() {
  const { identity, extension } = useModel();
  return useQuery({
    queryKey: ["session", identity, "playlist"],
    queryFn: ({ signal }) => json<Playlist>(`${API}/playlist`, { signal }),
    enabled: !!extension?.media,
    staleTime: 60000,
  });
}
export function useTraffic(range: TrafficRange) {
  const { identity, nodes, viewer } = useModel();
  return useQuery({
    queryKey: [
      "session",
      identity,
      "traffic",
      range,
      nodes.map((n) => n.id).join(","),
    ],
    enabled: viewer.logged_in && !!nodes.length,
    staleTime: 60000,
    queryFn: async ({ signal }): Promise<TrafficReport> => {
      const w = trafficWindow(range);
      const start = new Date(w.start).toISOString(),
        end = new Date(w.end).toISOString();
      const data = await rpc.call<MetricResponse>(
        "public:queryMetrics",
        {
          entity_ids: nodes.map((n) => n.id),
          metric_keys: [
            "traffic.up",
            "traffic.down",
            "net.total.up",
            "net.total.down",
          ],
          start,
          end,
          max_points: 2048,
          aggregation_by_metric: {
            "traffic.up": "sum",
            "traffic.down": "sum",
            "net.total.up": "last",
            "net.total.down": "last",
          },
        },
        signal,
      );
      return {
        range,
        start,
        end,
        timezone: w.timezone,
        items: trafficItems(nodes, data.series ?? []),
      };
    },
  });
}
