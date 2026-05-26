import { getStore, setStore } from '../core/storage.js';
const DEFAULT_ASSETS = [
  { id: 'domain', name: '主域名', type: '域名', expires: '', cost: 0, note: '示例：shuaiqi.de' },
  { id: 'server', name: '监控面板机', type: 'VPS', expires: '', cost: 0, note: '示例：Komari 面板' },
];
export function getAssets() { return getStore('assets', DEFAULT_ASSETS); }
export function saveAssets(items) { setStore('assets', items); }
export function daysLeft(date) {
  if (!date) return null;
  const t = new Date(`${date}T00:00:00`).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}
export function assetTone(asset) {
  const d = daysLeft(asset.expires);
  if (d == null) return 'info';
  if (d < 0) return 'danger';
  if (d <= 14) return 'warn';
  return 'good';
}
export function assetSummary(items = getAssets()) {
  const totalCost = items.reduce((s, a) => s + Number(a.cost || 0), 0);
  const expiring = items.filter(a => { const d = daysLeft(a.expires); return d != null && d <= 30; }).length;
  return { count: items.length, totalCost, expiring };
}
