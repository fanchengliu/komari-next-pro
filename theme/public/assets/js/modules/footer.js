(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  let ctx, node;
  const mod = {
    init(context){
      if (ctx) return;
      ctx = context;
      node = document.getElementById('komari-liu-footer');
      if (!node) {
        node = ctx.dom.el('footer', { id: 'komari-liu-footer', class: 'komari-liu-footer' }, [
          ctx.dom.el('span', { text: 'komari-liu' }),
          ctx.dom.el('span', { text: ' · soft dashboard rebuild' })
        ]);
        document.body.appendChild(node);
      }
      ctx.state && ctx.state.set('footer', { ready: true });
    },
    health(){ return { name: 'footer', status: 'ready', phase: 'D' }; }
  };
  if (root.register) root.register('footer', mod);
  else (root._pendingModules = root._pendingModules || []).push({ name: 'footer', mod });
})();
