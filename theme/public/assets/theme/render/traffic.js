import { el, clear } from '../core/dom.js';
import { speed, bytes } from '../core/format.js';
import { summarize } from '../modules/insights.js';

export function renderTrafficPanel(nodes = []) {
  const root = document.getElementById('kl-traffic-panel');
  if (!root) return;
  const s = summarize(nodes);
  const sorted = [...nodes].sort((a, b) => (b.upload + b.download) - (a.upload + a.download)).slice(0, 5);
  clear(root).append(
    el('div', { class: 'kl-section-head' }, [
      el('div', {}, [el('h2', { class: 'kl-section-title', text: '流量雷达' }), el('p', { class: 'kl-subtitle', text: '聚合实时上传/下载速率，后续接入周期流量与配额。' })]),
      el('span', { class: 'kl-pill', text: 'native' }),
    ]),
    el('div', { class: 'kl-traffic-grid' }, [
      trafficBox('总上传', speed(s.up)), trafficBox('总下载', speed(s.down)), trafficBox('估算日流量', bytes((s.up + s.down) * 86400)), trafficBox('活跃节点', sorted.length),
    ]),
    el('div', { class: 'kl-traffic-list' }, sorted.length ? sorted.map(n => el('div', { class: 'kl-traffic-row' }, [el('span', { text: n.name }), el('strong', { text: `↑${speed(n.upload)} ↓${speed(n.download)}` })])) : [el('div', { class: 'kl-empty', text: '暂无流量数据。' })])
  );
}
function trafficBox(label, value) { return el('div', { class: 'kl-stat' }, [el('div', { class: 'kl-stat-label', text: label }), el('div', { class: 'kl-stat-value', text: value })]); }
