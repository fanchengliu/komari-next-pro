(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  let ctx, observer, count = 0, scheduled = false, timer = null;
  function classify(text){
    const t = text.toLowerCase();
    if (/offline|离线|down|failed/.test(t)) return 'danger';
    if (/warning|warn|告警|高|异常/.test(t)) return 'warn';
    if (/online|在线|正常|healthy|up/.test(t)) return 'ok';
    return '';
  }
  function enhance(){
    timer = null;
    if (!ctx) return;
    scheduled = false;
    document.querySelectorAll('[data-komari-liu-card="1"]').forEach(card => {
      if (card.querySelector(':scope > .komari-liu-health-dot')) return;
      const kind = classify(card.textContent || '');
      if (!kind) return;
      card.appendChild(ctx.dom.el('span', { class: 'komari-liu-health-dot ' + kind, title: kind, 'aria-hidden': 'true' }));
      count += 1;
    });
    ctx.state && ctx.state.set('health-badges', { count });
  }
  function schedule(){ if (!scheduled) { scheduled = true; timer = setTimeout(enhance, 180); } }
  const mod = {
    init(context){ if (ctx) return; ctx = context; schedule(); observer = new MutationObserver(schedule); observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true }); },
    destroy(){ if (observer) observer.disconnect(); if (timer) clearTimeout(timer); observer = null; timer = null; ctx = null; },
    health(){ return { name: 'health-badges', status: 'ready', phase: 'C', count }; }
  };
  if (root.register) root.register('health-badges', mod);
  else (root._pendingModules = root._pendingModules || []).push({ name: 'health-badges', mod });
})();
