(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  const data = Object.create(null);
  root.state = {
    get(key, fallback=null){ return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback; },
    set(key, value){ data[key] = value; root.events && root.events.emit('state:change', { key, value }); return value; },
    patch(key, value){ return this.set(key, Object.assign({}, this.get(key, {}), value || {})); },
    snapshot(){ return Object.assign({}, data); }
  };
})();
