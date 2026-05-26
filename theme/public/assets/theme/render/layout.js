import { el } from '../core/dom.js';

export function renderShell() {
  document.body.classList.add('kl-native-body');
  const root = el('div', { id: 'kl-root', class: 'kl-page' }, [
    el('header', { class: 'kl-topbar' }, el('div', { class: 'kl-container kl-topbar-inner' }, [
      el('div', { class: 'kl-brand' }, [el('div', { class: 'kl-logo', text: 'K' }), el('span', { text: 'Komari Liu' })]),
      el('div', { class: 'kl-actions' }, [
        el('button', { class: 'kl-btn', id: 'kl-refresh', text: '刷新' }),
        el('button', { class: 'kl-btn', id: 'kl-settings', text: '主题设置' }),
      el('button', { class: 'kl-btn', id: 'kl-bg-random', text: '背景' }),
      ]),
    ])),
    el('main', { class: 'kl-container' }, [
      el('section', { class: 'kl-hero' }, el('div', { class: 'kl-hero-grid' }, [
        el('div', { class: 'kl-card kl-card-pad' }, [
          el('h1', { class: 'kl-title', text: '你的服务器舰队，一眼看清。' }),
          el('p', { class: 'kl-subtitle', text: 'Komari Liu 是基于官方 Komari 本体重构的原生主题，保留 KomariNextPro 的完整内容方向，但重新设计视觉、结构与交互。' }),
          el('div', { class: 'kl-stats', id: 'kl-stats' }),
        ]),
        el('div', { class: 'kl-card kl-card-pad', id: 'kl-side-panel' }),
      ])),

      el('section', { class: 'kl-section kl-panel-grid' }, [
        el('div', { class: 'kl-card kl-card-pad', id: 'kl-traffic-panel' }),
        el('div', { class: 'kl-card kl-card-pad', id: 'kl-assets-panel' }),
      ]),
      el('section', { class: 'kl-section' }, [
        el('div', { class: 'kl-section-head' }, [
          el('div', {}, [el('h2', { class: 'kl-section-title', text: '服务器状态' }), el('p', { class: 'kl-subtitle', text: '实时状态、负载、网络与资源概览。' })]),
          el('span', { class: 'kl-pill', id: 'kl-updated', text: '等待数据' }),
        ]),
        el('div', { class: 'kl-grid', id: 'kl-node-grid' }),
      ]),
    ]),
  ]);
  document.body.innerHTML = '';
  document.body.append(root);
  document.body.append(el('aside', { class: 'kl-card kl-settings-panel', id: 'kl-settings-panel' }, [
    el('div', { class: 'kl-section-head' }, [el('h3', { class: 'kl-section-title', text: '背景中心' }), el('span', { class: 'kl-pill', id: 'kl-bg-source', text: '本地' })]),
    el('div', { class: 'kl-field' }, [el('label', { text: '背景模式' }), el('select', { id: 'kl-bg-mode' }, [el('option', { value: 'gradient', text: '渐变' }), el('option', { value: 'image', text: '图片' }), el('option', { value: 'video', text: '视频' })])]),
    el('div', { class: 'kl-field' }, [el('label', { text: '图片 URL / 服务端媒体 URL' }), el('input', { id: 'kl-bg-image', placeholder: 'https://...' })]),
    el('div', { class: 'kl-field' }, [el('label', { text: '视频 URL / 服务端媒体 URL' }), el('input', { id: 'kl-bg-video', placeholder: 'https://...' })]),
    el('div', { class: 'kl-field' }, [el('label', { text: '模糊强度' }), el('input', { id: 'kl-bg-blur', type: 'range', min: '0', max: '24' })]),
    el('div', { class: 'kl-field' }, [el('label', { text: '遮罩强度' }), el('input', { id: 'kl-bg-dim', type: 'range', min: '0', max: '80' })]),
    el('div', { class: 'kl-field kl-switches' }, [
      el('label', {}, [el('input', { id: 'kl-pref-mood', type: 'checkbox' }), '显示心情']),
      el('label', {}, [el('input', { id: 'kl-pref-level', type: 'checkbox' }), '显示等级']),
      el('label', {}, [el('input', { id: 'kl-pref-traffic', type: 'checkbox' }), '显示流量']),
      el('label', {}, [el('input', { id: 'kl-pref-assets', type: 'checkbox' }), '显示资产']),
      el('label', {}, [el('input', { id: 'kl-pref-compact', type: 'checkbox' }), '紧凑卡片']),
    ]),
    el('button', { class: 'kl-btn', id: 'kl-bg-save', text: '保存设置' }),
  ]));
  return root;
}
