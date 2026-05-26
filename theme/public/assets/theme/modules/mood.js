export const LEVELS = [
  { min: 0, name: 'Lv1', title: '新生', cls: 'kl-lv-1' },
  { min: 7, name: 'Lv2', title: '幼苗', cls: 'kl-lv-2' },
  { min: 30, name: 'Lv3', title: '成长', cls: 'kl-lv-3' },
  { min: 90, name: 'Lv4', title: '茁壮', cls: 'kl-lv-4' },
  { min: 180, name: 'Lv5', title: '老将', cls: 'kl-lv-5' },
  { min: 365, name: 'Lv6', title: '传说', cls: 'kl-lv-6' },
];
export function getMood(cpu = 0, mem = 0, online = true) {
  if (!online) return { emoji: '💀', text: '离线' };
  if (cpu > 90 || mem > 95) return { emoji: '😰', text: '危险' };
  if (cpu > 80 || mem > 85) return { emoji: '😰', text: '紧张' };
  if (cpu > 50 || mem > 70) return { emoji: '😤', text: '忙碌' };
  if (cpu > 15 || mem > 40) return { emoji: '😊', text: '正常' };
  if (cpu > 3 || mem > 20) return { emoji: '😌', text: '悠闲' };
  return { emoji: '😴', text: '睡觉' };
}
export function getLevel(days = 0) {
  let lv = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) if (days >= LEVELS[i].min) { lv = LEVELS[i]; break; }
  const next = LEVELS[LEVELS.indexOf(lv) + 1];
  const pct = next ? Math.min(100, ((days - lv.min) / (next.min - lv.min)) * 100) : 100;
  return { ...lv, pct, tip: next ? `${lv.name} ${lv.title} · 下一等级 ${next.title}` : `${lv.name} ${lv.title}` };
}
