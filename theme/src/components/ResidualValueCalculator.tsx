"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNodeList } from "@/contexts/NodeListContext";
import { useLiveData } from "@/contexts/LiveDataContext";
import { computeAssetTotalCNY, normalizeCurrency } from "@/utils/assetSummary";
import { useAssetSummary } from "@/contexts/AssetSummaryContext";

type Row = {
  uuid: string;
  name: string;
  priceCNY: number;
  monthlyCNY: number;
  remainingCNY: number;
  free: boolean;
  remainDays: number;
  expiredAt?: string;
};

type Summary = {
  totalValueCNY: number;
  totalMonthlyCNY: number;
  totalRemainingCNY: number;
  count: number;
  rows: Row[];
};

function fmtMoney(v: number) {
  return `¥ ${v.toFixed(2)}`;
}

function useAnimatedNumber(target: number, duration = 220) {
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(target);
  const valueRef = useRef(target);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      valueRef.current = target;
      fromRef.current = target;
      setValue(target);
      return;
    }
    fromRef.current = valueRef.current;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / duration);
      const eased = progress < 1 ? (1 - Math.pow(1 - progress, 2.2)) : 1;
      const next = fromRef.current + (target - fromRef.current) * eased;
      valueRef.current = next;
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        valueRef.current = target;
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}


export default function ResidualValueCalculator() {
  const { nodeList } = useNodeList();
  const { setSummary: setSharedAssetSummary } = useAssetSummary();
  const { live_data } = useLiveData();
  const onlineSet = useMemo(() => new Set(live_data?.data?.online || []), [live_data]);
  const nodes = useMemo(() => nodeList || [], [nodeList]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<'CNY'|'USD'|'EUR'|'GBP'>('CNY');

  useEffect(() => {
    if (nodes.length && selectedIds.length === 0) {
      setSelectedIds(nodes.filter(n => onlineSet.has(n.uuid)).map(n => n.uuid));
    }
  }, [nodes, selectedIds.length, onlineSet]);

  async function fetchExchangeRate(fromCurrency: string, toCurrency: string) {
    if (!fromCurrency || fromCurrency === toCurrency) return 1;
    try {
      const response = await fetch(`https://open.er-api.com/v6/latest/${fromCurrency}`);
      if (!response.ok) return 1;
      const data = await response.json();
      const rate = data?.rates?.[toCurrency];
      return rate ? Number(rate) : 1;
    } catch {
      return 1;
    }
  }

  async function recalc(ids = selectedIds) {
    setLoading(true);
    const rateCache = new Map<string, number>();
    const today = new Date();
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const rows: Row[] = [];

    for (const n of nodes) {
      const rawPrice = Number(n.price);
      const free = rawPrice === -1;
      const price = free ? 0 : (Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0);
      const curr = normalizeCurrency(n.currency || 'CNY');
      const cycleDays = Number(n.billing_cycle) > 0 ? Number(n.billing_cycle) : 30;
      const exp = n.expired_at ? new Date(n.expired_at) : null;
      const remainDays = exp && !Number.isNaN(exp.getTime()) ? Math.max(0, Math.floor((exp.getTime() - base.getTime()) / 86400000)) : 0;

      let rate = rateCache.get(curr);
      if (!rate) {
        rate = await fetchExchangeRate(curr, 'CNY');
        rateCache.set(curr, rate);
      }

      const priceCNY = price * rate;
      const monthlyCNY = cycleDays > 0 ? priceCNY / cycleDays * 30 : 0;
      const remainingCNY = cycleDays > 0 && remainDays > 0 ? priceCNY * (remainDays / cycleDays) : 0;

      rows.push({ uuid: n.uuid, name: n.name, priceCNY, monthlyCNY, remainingCNY, free, remainDays, expiredAt: n.expired_at });
    }

    const selected = rows.filter(r => ids.includes(r.uuid));
    const nextSummary = {
      totalValueCNY: selected.reduce((s, r) => s + r.priceCNY, 0),
      totalMonthlyCNY: selected.reduce((s, r) => s + r.monthlyCNY, 0),
      totalRemainingCNY: selected.reduce((s, r) => s + r.remainingCNY, 0),
      count: selected.length,
      rows,
    };
    setSummary(nextSummary);
    setSharedAssetSummary(nextSummary);
    setLoading(false);
  }

  useEffect(() => {
    if (!nodes.length) return;
    const defaultIds = nodes.filter(n => onlineSet.has(n.uuid)).map(n => n.uuid);
    if (selectedIds.length === 0 && defaultIds.length > 0) {
      setSelectedIds(defaultIds);
      return;
    }
    if (summary == null) {
      recalc(selectedIds.length ? selectedIds : defaultIds);
    }
  }, [nodes.length, live_data, summary]);

  useEffect(() => {
    if (open && nodes.length) recalc(selectedIds);
  }, [open, nodes.length]);

  useEffect(() => {
    if (open && nodes.length) recalc(selectedIds);
  }, [selectedIds.join('|')]);

  const filteredRows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    const rows = summary?.rows || [];
    if (!kw) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(kw));
  }, [search, summary?.rows]);

  const visibleIds = filteredRows.map(r => r.uuid);
  const animatedCount = useAnimatedNumber(summary?.count ?? 0, 220);
  const animatedTotalValue = useAnimatedNumber(summary?.totalValueCNY ?? 0, 280);
  const animatedMonthly = useAnimatedNumber(summary?.totalMonthlyCNY ?? 0, 280);
  const animatedRemaining = useAnimatedNumber(summary?.totalRemainingCNY ?? 0, 280);
  const displayRate = displayCurrency === 'CNY' ? 1 : (displayCurrency === 'USD' ? 1/7.2 : displayCurrency === 'EUR' ? 1/7.8 : 1/9.1);
  const moneyParts = (cny: number) => {
    const v = displayCurrency === 'CNY' ? cny : cny * displayRate;
    const symbol = displayCurrency === 'USD' ? '$' : displayCurrency === 'EUR' ? '€' : displayCurrency === 'GBP' ? '£' : '¥';
    const fixed = Math.max(0, v).toFixed(2);
    const [integer, decimal] = fixed.split('.');
    return { symbol, integer, decimal };
  };
  const showMoney = (cny: number) => { const m = moneyParts(cny); return `${m.symbol} ${m.integer}.${m.decimal}`; };

  const MoneyDisplay = ({ value, primary = true }: { value: number; primary?: boolean }) => {
    const m = moneyParts(value);
    return (
      <div className={`inline-flex items-baseline justify-center min-w-[104px] tabular-nums ${primary ? 'text-primary' : ''}`}>
        <span className="mr-1 text-[13px] opacity-85">{m.symbol}</span>
        <span className="text-lg font-semibold leading-none">{m.integer}</span>
        <span className="text-[12px] font-semibold leading-none opacity-90">.{m.decimal}</span>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
          <Calculator className="h-4 w-4" />
          <span className="sr-only">资产计算器</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[344px] max-h-[85vh] overflow-y-auto p-0" align="end" sideOffset={8}>
        <div className="rounded-2xl border border-border/60 bg-background shadow-xl overflow-hidden">
          <div className="px-3.5 py-3.5 border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Calculator className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-primary">资产统计</div>
                  
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <select className="h-8 rounded-md border border-border bg-background text-foreground px-2 text-xs shadow-sm dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700" value={displayCurrency} onChange={(e) => setDisplayCurrency(e.target.value as any)}>
                  <option value="CNY">人民币 CNY</option>
                  <option value="USD">美元 USD</option>
                  <option value="EUR">欧元 EUR</option>
                  <option value="GBP">英镑 GBP</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-3.5 py-2.5 grid grid-cols-2 gap-1.5">
            <div className="rounded-2xl bg-muted/45 border border-border/50 px-3 py-3 text-center flex flex-col items-center justify-center min-h-[72px]"><div className="text-[11px] text-muted-foreground mb-1">服务器数量</div><div className="text-lg font-semibold">{Math.round(animatedCount)}</div></div>
            <div className="rounded-2xl bg-muted/45 border border-border/50 px-3 py-3 text-center flex flex-col items-center justify-center min-h-[72px]"><div className="text-[11px] text-muted-foreground mb-1">总价值</div><div className="text-lg font-semibold text-primary">{loading ? '...' : <MoneyDisplay value={animatedTotalValue} />}</div></div>
            <div className="rounded-2xl bg-muted/45 border border-border/50 px-3 py-3 text-center flex flex-col items-center justify-center min-h-[72px]"><div className="text-[11px] text-muted-foreground mb-1">月均支出</div><div className="text-lg font-semibold text-primary">{loading ? '...' : <MoneyDisplay value={animatedMonthly} />}</div></div>
            <div className="rounded-2xl bg-muted/45 border border-border/50 px-3 py-3 text-center flex flex-col items-center justify-center min-h-[72px]"><div className="text-[11px] text-muted-foreground mb-1">剩余总价值</div><div className="text-lg font-semibold text-primary">{loading ? '...' : <MoneyDisplay value={animatedRemaining} />}</div></div>
          </div>

          <div className="px-3.5 pb-2.5 space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索机器名" className="pl-8 h-8.5" />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" className="h-7.5 text-[11px] px-2.5 transition-all active:scale-[0.98] font-medium" onClick={() => setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])))}>全选</Button>
              <Button size="sm" variant="outline" className="h-7.5 text-[11px] px-2.5 transition-all active:scale-[0.98]" onClick={() => setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)))}>取消</Button>
              <Button size="sm" variant="outline" className="h-7.5 text-[11px] px-2.5 transition-all active:scale-[0.98]" onClick={() => setSelectedIds(prev => Array.from(new Set([...prev.filter(id => !visibleIds.includes(id)), ...visibleIds.filter(id => !prev.includes(id))])))}>反选</Button>
              <div className="ml-auto text-[11px] text-muted-foreground">已选 {selectedIds.length} / {nodes.length}</div>
            </div>
          </div>

          <div className="px-1.5 pb-1.5 max-h-[360px] overflow-y-auto space-y-1">
            {filteredRows
              .sort((a, b) => b.remainingCNY - a.remainingCNY)
              .map((r) => {
                const checked = selectedIds.includes(r.uuid);
                return (
                  <button
                    key={r.uuid}
                    type="button"
                    className={`w-full grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl px-2.5 py-2 text-left transition-all border shadow-sm ${checked ? 'bg-primary/8 border-primary/20' : 'bg-card border-border/50 hover:bg-muted/35'}`}
                    onClick={() => setSelectedIds(prev => checked ? prev.filter(id => id !== r.uuid) : [...prev, r.uuid])}
                  >
                    <Checkbox checked={checked} className="shrink-0" />
                    <div className="min-w-0 truncate text-[13px] font-medium leading-tight">{r.name}</div>
                    <div className="shrink-0 text-[13px] font-semibold text-primary tabular-nums">{showMoney(r.remainingCNY)}</div>
                  </button>
                );
              })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
