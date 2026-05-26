(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  const dom = {
    qs(sel, base=document){ return base.querySelector(sel); },
    qsa(sel, base=document){ return Array.from(base.querySelectorAll(sel)); },
    el(tag, attrs={}, children=[]){
      const node = document.createElement(tag);
      Object.entries(attrs || {}).forEach(([key, value]) => {
        if (value === false || value == null) return;
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'unsafeHtml') node.innerHTML = value;
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? '' : String(value));
      });
      (Array.isArray(children) ? children : [children]).filter(Boolean).forEach(child => {
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      });
      return node;
    },
    ensureRoot(id, className){
      let node = document.getElementById(id);
      if (!node) {
        node = dom.el('div', { id, class: className || '' });
        document.body.appendChild(node);
      }
      return node;
    },
    ready(fn){
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
      else fn();
    }
  };
  root.dom = dom;
})();
