(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  let ctx, observer, scheduled = false, enhanced = 0, timer = null;
  const CARD_HINTS = ['cpu', 'ram', 'load', 'network', 'traffic', '在线', '离线', '上传', '下载'];
  function looksLikeCard(el){
    if (!el || el.dataset.komariLiuCard === '1') return false;
    const text = (el.textContent || '').toLowerCase();
    if (text.length < 12 || text.length > 1200) return false;
    const hit = CARD_HINTS.some(h => text.includes(h));
    const box = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    return hit && box.width >= 160 && box.height >= 80;
  }
  function candidates(){
    const scope = document.querySelector('main') || document.body;
    return Array.from(scope.querySelectorAll('article, [role="article"], a[href*="instance"], .card, [class*="card"], section'));
  }
  function enhance(){
    timer = null;
    if (!ctx) return;
    scheduled = false;
    candidates().filter(looksLikeCard).slice(0, 80).forEach(card => {
      card.dataset.komariLiuCard = '1';
      card.classList.add('komari-liu-card', 'komari-liu-server-card');
      if (!card.querySelector(':scope > .komari-liu-card-glow')) {
        card.appendChild(ctx.dom.el('span', { class: 'komari-liu-card-glow', 'aria-hidden': 'true' }));
      }
      enhanced += 1;
    });
    ctx.state && ctx.state.set('server-cards', { enhanced });
  }
  function schedule(){ if (!scheduled) { scheduled = true; timer = setTimeout(enhance, 150); } }
  const mod = {
    init(context){
      if (ctx) return;
      ctx = context;
      schedule();
      observer = new MutationObserver(schedule);
      observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    },
    destroy(){ if (observer) observer.disconnect(); if (timer) clearTimeout(timer); observer = null; timer = null; ctx = null; },
    health(){ return { name: 'server-cards', status: 'ready', phase: 'C', enhanced }; }
  };
  if (root.register) root.register('server-cards', mod);
  else (root._pendingModules = root._pendingModules || []).push({ name: 'server-cards', mod });
})();
