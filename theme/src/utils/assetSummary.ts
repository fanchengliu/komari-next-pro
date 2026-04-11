export function normalizeCurrency(input?: string) {
  const raw = String(input || '').trim();
  if (!raw) return 'CNY';
  const upper = raw.toUpperCase();
  if (['$', 'US$', 'USD'].includes(upper)) return 'USD';
  if (['￥', '¥', 'CNY', 'RMB', 'CN¥'].includes(upper)) return 'CNY';
  if (['EUR', '€'].includes(upper)) return 'EUR';
  if (['GBP', '£'].includes(upper)) return 'GBP';
  if (['JPY', 'JP¥', 'JPY¥', '円', '¥JPY'].includes(upper)) return 'JPY';
  if (['AUD', 'A$', 'AU$'].includes(upper)) return 'AUD';
  if (['SGD', 'S$'].includes(upper)) return 'SGD';
  if (['MYR', 'RM'].includes(upper)) return 'MYR';
  return upper;
}

export const CNY_RATES: Record<string, number> = {
  CNY: 1, USD: 7.2, EUR: 7.8, GBP: 9.1, JPY: 0.048, AUD: 4.7, SGD: 5.35, MYR: 1.53,
};

export function computeAssetTotalCNY(nodes: any[] = [], onlineIds?: Iterable<string>) {
  const onlineSet = onlineIds ? new Set(onlineIds) : null;
  let total = 0;
  for (const n of nodes || []) {
    if (onlineSet && !onlineSet.has(n.uuid)) continue;
    const raw = Number(n.price);
    const price = raw === -1 ? 0 : (Number.isFinite(raw) && raw > 0 ? raw : 0);
    const curr = normalizeCurrency(n.currency);
    total += price * (CNY_RATES[curr] || 1);
  }
  return total;
}
