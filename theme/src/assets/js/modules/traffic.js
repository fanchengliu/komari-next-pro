(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  let ctx, rootEl, modal, lastGood = null, range = 'month', cleanup = [];
  function fmt(n){
    n = Number(n || 0);
    const units = ['B','KB','MB','GB','TB']; let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return (i ? n.toFixed(1) : n.toFixed(0)) + ' ' + units[i];
  }
  function endpoint(){ return (ctx.api && ctx.api.endpoint('traffic')) || '/komari-traffic-api'; }
  function rangeUrl(){
    try { const url = new URL(endpoint(), window.location.origin); url.searchParams.set('range', range); return url.pathname + url.search; }
    catch (_) { return endpoint() + (endpoint().includes('?') ? '&' : '?') + 'range=' + encodeURIComponent(range); }
  }
  function ensure(){
    rootEl = ctx.dom.ensureRoot('komari-liu-traffic-root', 'komari-liu-traffic-root');
    if (!rootEl.dataset.ready) {
      const btn = ctx.dom.el('button', { class: 'komari-liu-traffic-button', type: 'button', text: '流量' });
      modal = ctx.dom.el('section', { class: 'komari-liu-modal komari-liu-traffic-modal', hidden: true });
      rootEl.append(btn, modal);
      cleanup.push(ctx.events.listen(btn, 'click', () => open()));
      rootEl.dataset.ready = '1';
    } else modal = rootEl.querySelector('.komari-liu-traffic-modal');
  }
  function render(data, error){
    if (!modal) return;
    const summary = data && (data.summary || data.data || data);
    modal.innerHTML = `<div class="komari-liu-modal-card"><header><strong>流量统计</strong><button type="button" data-close>×</button></header>
      <div class="komari-liu-traffic-ranges"><button data-range="day" class="${range==='day'?'active':''}">日</button><button data-range="month" class="${range==='month'?'active':''}">月</button><button data-range="year" class="${range==='year'?'active':''}">年</button></div>
      ${error ? `<p class="komari-liu-bg-alert">${error}</p>` : ''}
      <div class="komari-liu-traffic-total"><span>上传 ${fmt(summary && (summary.upload || summary.up))}</span><span>下载 ${fmt(summary && (summary.download || summary.down))}</span></div>
      <p class="komari-liu-traffic-note">没有可用 API 时会保留最后一次成功数据。</p></div>`;
  }
  async function load(){
    render(lastGood, '加载中…');
    try {
      const data = await ctx.api.get(rangeUrl(), { timeoutMs: 7000 });
      lastGood = data;
      ctx.storage.set('traffic:last', data);
      render(data, '');
    } catch (err) {
      lastGood = lastGood || ctx.storage.get('traffic:last', null);
      render(lastGood, '流量 API 暂不可用');
      ctx.logger.warn('traffic load failed', err);
    }
  }
  function open(){ modal.hidden = false; load(); }
  const mod = {
    init(context){ if (ctx) return; ctx = context; ensure(); cleanup.push(ctx.events.listen(rootEl, 'click', ev => { if (ev.target.matches('[data-close]')) modal.hidden = true; if (ev.target.dataset.range) { range = ev.target.dataset.range; load(); } })); },
    destroy(){ cleanup.forEach(fn => { try { fn(); } catch (_) {} }); cleanup = []; ctx = null; },
    health(){ return { name: 'traffic', status: 'ready', phase: 'D', hasCache: !!lastGood }; }
  };
  if (root.register) root.register('traffic', mod);
  else (root._pendingModules = root._pendingModules || []).push({ name: 'traffic', mod });
})();
