export function summarize(nodes) {
  const total = nodes.length;
  const online = nodes.filter(n => n.online).length;
  const countries = new Set(nodes.map(n => n.region).filter(Boolean));
  const avgCpu = total ? nodes.reduce((s, n) => s + (n.cpu || 0), 0) / total : 0;
  const avgMem = total ? nodes.reduce((s, n) => s + (n.mem || 0), 0) / total : 0;
  const up = nodes.reduce((s, n) => s + (n.upload || 0), 0);
  const down = nodes.reduce((s, n) => s + (n.download || 0), 0);
  return { total, online, offline: Math.max(0, total - online), countries: countries.size, avgCpu, avgMem, up, down };
}

export function trafficHealth(nodes) {
  if (!nodes.length) return { text: '等待节点', tone: 'muted' };
  const busy = nodes.filter(n => (n.cpu || 0) > 80 || (n.mem || 0) > 85).length;
  if (busy) return { text: `${busy} 台繁忙`, tone: 'warn' };
  if (nodes.some(n => !n.online)) return { text: '存在离线', tone: 'danger' };
  return { text: '运行平稳', tone: 'good' };
}
