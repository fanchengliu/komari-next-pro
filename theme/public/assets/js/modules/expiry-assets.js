(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  const KEY = 'expiry-assets:metadata';
  let ctx, applied = 0, cleanup = [], timer = null;
  function loadMeta(){ return ctx.storage.get(KEY, {}); }
  function enhance(){
    timer = null;
    if (!ctx) return;
    const meta = loadMeta();
    document.querySelectorAll('[data-komari-liu-card="1"]').forEach(card => {
      if (card.querySelector(':scope > .komari-liu-expiry-strip')) return;
      const name = (card.textContent || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
      const item = meta[name];
      if (!item) return;
      const strip = ctx.dom.el('div', { class: 'komari-liu-expiry-strip' }, [
        item.expiry ? ctx.dom.el('span', { text: '到期 ' + item.expiry }) : null,
        item.price ? ctx.dom.el('span', { text: '资产 ¥' + item.price }) : null
      ].filter(Boolean));
      card.appendChild(strip);
      applied += 1;
    });
    ctx.state && ctx.state.set('expiry-assets', { applied });
  }
  const mod = {
    init(context){ if (ctx) return; ctx = context; timer = setTimeout(enhance, 500); cleanup.push(ctx.events.on('state:change', ev => { if (ev.detail && ev.detail.key === 'server-cards') enhance(); })); },
    destroy(){ cleanup.forEach(fn => { try { fn(); } catch (_) {} }); if (timer) clearTimeout(timer); timer = null; cleanup = []; ctx = null; },
    health(){ return { name: 'expiry-assets', status: 'ready', phase: 'D', applied }; }
  };
  if (root.register) root.register('expiry-assets', mod);
  else (root._pendingModules = root._pendingModules || []).push({ name: 'expiry-assets', mod });
})();
