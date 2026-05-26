(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  root.config = Object.assign({}, window.KOMARI_LIU_CONFIG || {}, root.config || {});
  root.modules = root.modules || {};
  root.started = false;
  root.register = function(name, mod){
    if (!name || !mod) return;
    this.modules[name] = Object.assign({ name }, mod);
  };
  (root._pendingModules || []).forEach(item => root.register(item.name, item.mod));
  root._pendingModules = [];
  root.context = function(){
    return {
      config: root.config,
      logger: root.logger || console,
      api: root.api,
      dom: root.dom,
      events: root.events,
      storage: root.storage,
      state: root.state
    };
  };
  root.start = function(){
    if (root.started) return;
    root.started = true;
    const ctx = root.context();
    Object.values(root.modules).forEach(mod => {
      try { if (mod && typeof mod.init === 'function') mod.init(ctx); }
      catch (err) { (ctx.logger || console).warn('[komari-liu] module init failed', mod.name, err); }
    });
    root.events && root.events.emit('app:start', { modules: Object.keys(root.modules) });
  };
  const start = () => root.start();
  if (root.dom && root.dom.ready) root.dom.ready(start);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
