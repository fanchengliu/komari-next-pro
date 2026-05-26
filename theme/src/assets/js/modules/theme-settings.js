(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  const KEY = 'theme-settings';
  let ctx, settings;
  function apply(){
    document.documentElement.dataset.komariLiuTheme = settings.palette || 'macaron';
    document.documentElement.style.setProperty('--komari-liu-bg-opacity', String(settings.opacity || .72));
  }
  const mod = {
    init(context){
      if (ctx) return;
      ctx = context;
      settings = ctx.storage.get(KEY, { palette: 'macaron', opacity: .72 });
      apply();
      ctx.state && ctx.state.set('theme-settings', settings);
    },
    health(){ return { name: 'theme-settings', status: 'ready', phase: 'C', settings }; }
  };
  if (root.register) root.register('theme-settings', mod);
  else (root._pendingModules = root._pendingModules || []).push({ name: 'theme-settings', mod });
})();
