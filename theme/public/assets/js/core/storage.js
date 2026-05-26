(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  const prefix = 'komari-liu:';
  root.storage = {
    key(name){ return prefix + name; },
    get(name, fallback=null){
      try {
        const raw = localStorage.getItem(prefix + name);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (err) { root.logger && root.logger.warn('storage get failed', name, err); return fallback; }
    },
    set(name, value){
      try { localStorage.setItem(prefix + name, JSON.stringify(value)); return true; }
      catch (err) { root.logger && root.logger.warn('storage set failed', name, err); return false; }
    },
    remove(name){ try { localStorage.removeItem(prefix + name); } catch (_) {} }
  };
})();
