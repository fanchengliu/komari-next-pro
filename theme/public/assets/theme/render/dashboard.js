import { el, clear } from '../core/dom.js';
import { pct, speed, duration } from '../core/format.js';
import { getMood, getLevel } from '../modules/mood.js';
import { summarize, trafficHealth } from '../modules/insights.js';

export function renderStats(nodes, publicInfo = {}) {
  const s = summarize(nodes);
  const stats = [
    ['节点总数', s.total], ['在线节点', s.online], ['点亮地区', s.countries || '-'], ['当前主题', publicInfo.theme || 'komari-liu'],
  ];
  const box = clear(document.getElementById('kl-stats'));
  for (const [label, value] of stats) box.append(el('div', { class: 'kl-stat' }, [el('div', { class: 'kl-stat-label', text: label }), el('div', { class: 'kl-stat-value', text: value })]));
}

export function renderSidePanel(nodes = []) {
  const box = clear(document.getElementById('kl-side-panel'));
  const s = summarize(nodes);
  const health = trafficHealth(nodes);
  box.append(
    el('div', { class: 'kl-section-title', text: '控制中心' }),
    el('p', { class: 'kl-subtitle', text: '把 KomariNextPro 的背景、流量、资产、到期提醒重构成 komari-liu 原生模块。' }),
    el('div', { class: 'kl-insight-grid' }, [
      insight('综合状态', health.text, health.tone),
      insight('平均 CPU', `${s.avgCpu.toFixed(0)}%`, s.avgCpu > 80 ? 'warn' : 'good'),
      insight('平均内存', `${s.avgMem.toFixed(0)}%`, s.avgMem > 85 ? 'warn' : 'good'),
      insight('实时流量', `↑${speed(s.up)} ↓${speed(s.down)}`, 'info'),
    ]),
    el('div', { class: 'kl-feature-list' }, [
      feature('背景中心', '图片 / 视频 / 渐变，本地已可保存，后续接入服务端媒体库。', '已接入'),
      feature('心情养成', '按 CPU、内存、在线状态计算表情与 Lv1-Lv6 成长徽章。', '已接入'),
      feature('流量面板', '聚合上传/下载速率与繁忙节点，下一步补配额/周期统计。', '进行中'),
      feature('资产到期', '域名、服务器、订阅到期提醒模块，下一步做编辑与提醒。', '进行中'),
    ])
  );
}

function insight(label, value, tone) {
  return el('div', { class: `kl-insight kl-${tone}` }, [el('span', { text: label }), el('strong', { text: value })]);
}
function feature(title, desc, tag) {
  return el('div', { class: 'kl-feature' }, [el('div', {}, [el('strong', { text: title }), el('p', { text: desc })]), el('span', { class: 'kl-pill', text: tag })]);
}

export function renderNodes(nodes, options = {}) {
  const grid = clear(document.getElementById('kl-node-grid'));
  if (!nodes.length) { grid.append(el('div', { class: 'kl-card kl-empty', text: '暂无节点数据。添加 Komari Agent 后，这里会显示 komari-liu 原生卡片、心情、等级与流量概览。' })); return; }
  if (options.demo) grid.append(el('div', { class: 'kl-card kl-demo-banner' }, [el('strong', { text: '预览模式' }), el('span', { text: '当前没有真实 Agent，先展示 komari-liu 的完整卡片效果。' }), el('button', { class: 'kl-mini-btn', id: 'kl-hide-demo', text: '隐藏预览' })]));
  for (const node of nodes) {
    const cpu = pct(node.cpu);
    const mem = pct(node.mem);
    const mood = getMood(cpu, mem, node.online);
    const days = node.uptimeDays || Math.floor((node.uptimeSeconds || 0) / 86400);
    const lv = getLevel(days);
    grid.append(el('article', { class: `kl-card kl-node ${node.online ? '' : 'kl-node-offline'}` }, [
      el('div', { class: 'kl-node-head' }, [
        el('div', {}, [
          el('div', { class: 'kl-node-name', text: node.name }),
          el('div', { class: 'kl-subtitle', text: [node.region, node.os, node.arch].filter(Boolean).join(' · ') || '未知地区' }),
          el('div', { class: 'kl-mood-line' }, [el('span', { text: `${mood.emoji} ${mood.text}` }), el('span', { class: `kl-lv ${lv.cls}`, title: lv.tip, text: lv.name }), el('span', { class: 'kl-xp' }, el('span', { style: `width:${lv.pct}%` }))]),
        ]),
        el('span', { class: `kl-pill ${node.online ? 'kl-online' : 'kl-offline'}`, text: node.online ? 'online' : 'offline' })
      ]),
      el('div', { class: 'kl-metrics' }, [
        metric('CPU', cpu), metric('MEM', mem), metric('上传', speed(node.upload)), metric('下载', speed(node.download)),
      ]),
      el('div', { class: 'kl-node-foot' }, [el('span', { text: `运行 ${days ? `${days}天` : duration(node.uptimeSeconds)}` }), el('span', { text: node.uuid })]),
    ]));
  }
}

function metric(label, value) {
  const isNum = typeof value === 'number';
  return el('div', { class: 'kl-metric' }, [
    el('div', { class: 'kl-stat-label', text: label }),
    el('div', { class: 'kl-stat-value', text: isNum ? `${value.toFixed(0)}%` : value }),
    isNum ? el('div', { class: 'kl-progress' }, el('span', { style: `width:${value}%` })) : '',
  ]);
}
