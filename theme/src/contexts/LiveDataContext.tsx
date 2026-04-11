"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { LiveDataResponse } from "../types/LiveData";
import { useRPC2Call } from "./RPC2Context";

// 创建Context
interface LiveDataContextType {
  live_data: LiveDataResponse | null;
  showCallout: boolean;
  onRefresh: (callback: (data: LiveDataResponse) => void) => void;
}

const LiveDataContext = createContext<LiveDataContextType>({
  live_data: null,
  showCallout: true,
  onRefresh: () => { },
});

// 创建Provider组件
export const LiveDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [live_data, setLiveData] = useState<LiveDataResponse | null>(null);
  const [showCallout, setShowCallout] = useState(false);
  const [refreshCallbacks] = useState<Set<(data: LiveDataResponse) => void>>(new Set());
  const { call } = useRPC2Call();

  // 注册刷新回调函数
  const onRefresh = (callback: (data: LiveDataResponse) => void) => {
    refreshCallbacks.add(callback);
  };

  // 当数据更新时通知所有回调函数
  const notifyRefreshCallbacks = (data: LiveDataResponse) => {
    refreshCallbacks.forEach(callback => callback(data));
  };

  // 采用 RPC2 轮询最新状态，替代 WebSocket
  useEffect(() => {
    // Skip during SSR/SSG
    if (typeof window === 'undefined') return;
    
    let timer: number | undefined;
    let stopped = false;
    let running = false; // 防抖：避免并发请求
    const intervalMs = 2000;

    const fetchLatest = async () => {
      if (running) return; // 如果上次请求还在，跳过
      running = true;
      try {
        // 策略由 RPC2Client 内部实现
        const result: Record<string, any> = await call("common:getNodesLatestStatus");
        // 将返回转换为 LiveDataResponse 结构
        const online = Object.values(result)
          .filter((v: any) => v?.online)
          .map((v: any) => v.client as string);

        const dataMap: Record<string, any> = {};
        for (const [uuid, v] of Object.entries(result)) {
          const rec = v as any;
          dataMap[uuid] = {
            cpu: { usage: typeof rec.cpu === "number" ? rec.cpu : 0 },
            ram: { used: rec.ram ?? 0 },
            swap: { used: rec.swap ?? 0 },
            load: {
              load1: rec.load ?? 0,
              load5: rec.load5 ?? 0,
              load15: rec.load15 ?? 0,
            },
            disk: { used: rec.disk ?? 0 },
            network: {
              up: rec.net_out ?? 0,
              down: rec.net_in ?? 0,
              totalUp: rec.net_total_out ?? rec.net_total_up ?? 0,
              totalDown: rec.net_total_in ?? rec.net_total_down ?? 0,
            },
            connections: {
              tcp: rec.connections ?? 0,
              udp: rec.connections_udp ?? 0,
            },
            gpu: rec.gpu !== undefined ? { count: 0, average_usage: rec.gpu, detailed_info: [] } : undefined,
            uptime: rec.uptime ?? 0,
            process: rec.process ?? 0,
            message: "",
            updated_at: rec.time ?? 0,
          };
        }

        const live: LiveDataResponse = {
          data: {
            online,
            data: dataMap,
          },
          status: "ok",
        };
        setLiveData(live);
        setShowCallout(true);
        notifyRefreshCallbacks(live);
      } catch (e) {
        console.error("RPC2 获取最新状态失败:", e);
        setShowCallout(false);
      } finally {
        running = false;
        if (!stopped) {
          timer = window.setTimeout(fetchLatest, intervalMs);
        }
      }
    };

    fetchLatest();

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [call]);

  return (
    <LiveDataContext.Provider value={{ live_data, showCallout, onRefresh }}>
      {children}
    </LiveDataContext.Provider>
  );
};

export const useLiveData = () => useContext(LiveDataContext);

export default LiveDataContext;
