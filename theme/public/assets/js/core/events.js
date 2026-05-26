(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  const bus = new EventTarget();
  root.events = {
    on(type, handler){ bus.addEventListener(type, handler); return () => bus.removeEventListener(type, handler); },
    once(type, handler){ bus.addEventListener(type, handler, { once: true }); return () => bus.removeEventListener(type, handler); },
    emit(type, detail){ bus.dispatchEvent(new CustomEvent(type, { detail })); },
    listen(target, type, handler, options){
      target.addEventListener(type, handler, options);
      return () => target.removeEventListener(type, handler, options);
    }
  };
})();
