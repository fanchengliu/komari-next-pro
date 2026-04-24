import { useEffect, useState, useRef, useCallback } from 'react';
import { useRPC2Call } from '@/contexts/RPC2Context';

export interface PingBlock {
  latency: number; // ms, -1 = timeout/loss
  time: string;
  loss: boolean;
}

export interface PingBlocksResult {
  blocks: PingBlock[];
  avgLatency: number;
  avgLoss: number;
  hasData: boolean;
}

const BLOCK_COUNT = 20;
const REFRESH_MS = 30_000; // 30 seconds

export function usePingBlocks(uuid: string): PingBlocksResult {
  const { call } = useRPC2Call();
  const [result, setResult] = useState<PingBlocksResult>({
    blocks: [],
    avgLatency: 0,
    avgLoss: 0,
    hasData: false,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPing = useCallback(async () => {
    if (!uuid) return;
    try {
      const resp = await call<any, any>('common:getRecords', {
        uuid,
        type: 'ping',
        hours: 24, // fetch enough history, then use the latest 20 samples
      });

      const records: { value: number; time: string }[] = resp?.records || [];
      const tasks: any[] = resp?.tasks || [];

      // Take the last BLOCK_COUNT records
      const recent = records.slice(-BLOCK_COUNT);

      const blocks: PingBlock[] = recent.map((r) => ({
        latency: r.value >= 0 ? r.value : -1,
        time: r.time,
        loss: !(r.value >= 0),
      }));

      // Pad left if less than BLOCK_COUNT
      while (blocks.length < BLOCK_COUNT) {
        blocks.unshift({ latency: -1, time: '', loss: true });
      }

      // Stats
      const valid = blocks.filter((b) => b.latency >= 0);
      const avgLatency = valid.length > 0
        ? valid.reduce((s, b) => s + b.latency, 0) / valid.length
        : 0;

      // Loss from blocks (last 20 samples)
      const total = blocks.filter((b) => b.time !== '').length;
      const lost = blocks.filter((b) => b.time !== '' && b.loss).length;
      const avgLoss = total > 0 ? (lost / total) * 100 : 0;

      setResult({ blocks, avgLatency, avgLoss, hasData: recent.length > 0 });
    } catch {
      // keep previous state on error
    }
  }, [uuid, call]);

  useEffect(() => {
    fetchPing();
    timerRef.current = setInterval(fetchPing, REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchPing]);

  return result;
}