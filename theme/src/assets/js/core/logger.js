(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  function enabled(){ return !!(root.config && root.config.debug); }
  function line(level, args){
    const fn = console[level] || console.log;
    fn.call(console, '[komari-liu]', ...args);
  }
  root.logger = {
    debug(){ if(enabled()) line('debug', arguments); },
    info(){ line('info', arguments); },
    warn(){ line('warn', arguments); },
    error(){ line('error', arguments); }
  };
})();
