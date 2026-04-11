import { useEffect, useState } from 'react';
import { useRPC2Call } from '@/contexts/RPC2Context';

interface PingRecord {
  client: string;
  task_id: number;
  time: string;
  value: number;
}

interface TaskInfo {
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
}

interface PingStats {
  avgLoss: number;
  avgLatency: number;
  avgVolatility: number;
  hasData: boolean;
}

export function usePingStats(uuid: string, hours: number = 24): PingStats {
  const { call } = useRPC2Call();
  const [stats, setStats] = useState<PingStats>({
    avgLoss: 0,
    avgLatency: 0,
    avgVolatility: 0,
    hasData: false,
  });

  useEffect(() => {
    if (!uuid) return;

    const controller = new AbortController();

    (async () => {
      try {
        type RpcResp = {
          count: number;
          records: PingRecord[];
          tasks?: TaskInfo[];
          from?: string;
          to?: string;
        };

        const result = await call<any, RpcResp>('common:getRecords', {
          uuid,
          type: 'ping',
          hours,
        });

        const records = result?.records || [];
        const tasks = result?.tasks || [];

        if (records.length === 0 || tasks.length === 0) {
          setStats({ avgLoss: 0, avgLatency: 0, avgVolatility: 0, hasData: false });
          return;
        }

        // Calculate average loss from tasks
        const totalLoss = tasks.reduce((sum, task) => sum + (task.loss || 0), 0);
        const avgLoss = tasks.length > 0 ? totalLoss / tasks.length : 0;

        // Calculate volatility (p99/p50 ratio average)
        const volatilityValues = tasks
          .filter(task => task.p99_p50_ratio !== undefined && task.p99_p50_ratio > 0)
          .map(task => task.p99_p50_ratio!);

        const avgVolatility = volatilityValues.length > 0
          ? volatilityValues.reduce((sum, val) => sum + val, 0) / volatilityValues.length
          : 0;

        // Calculate average latency (prefer tasks.avg/latest, fallback to records.value)
        const taskVals = tasks
          .map((t: any) => (typeof t.avg === "number" ? t.avg : (typeof t.latest === "number" ? t.latest : undefined)))
          .filter((v: any) => typeof v === "number" && v >= 0) as number[];
        const recVals = records
          .map((r: any) => r.value)
          .filter((v: any) => typeof v === "number" && v >= 0) as number[];
        const latVals = taskVals.length ? taskVals : recVals;
        const avgLatency = latVals.length ? (latVals.reduce((a,b)=>a+b,0)/latVals.length) : 0;

        setStats({
          avgLoss,
          avgLatency,
          avgVolatility,
          hasData: true,
        });
      } catch (err) {
        setStats({ avgLoss: 0, avgLatency: 0, avgVolatility: 0, hasData: false });
      }
    })();

    return () => controller.abort();
  }, [uuid, hours, call]);

  return stats;
}
