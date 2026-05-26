import { el } from '../core/dom.js';
let timer = null;
export function toast(text, tone = 'info') {
  let box = document.getElementById('kl-toast');
  if (!box) { box = el('div', { id: 'kl-toast', class: 'kl-toast' }); document.body.append(box); }
  box.className = `kl-toast kl-toast-${tone} kl-open`;
  box.textContent = text;
  clearTimeout(timer);
  timer = setTimeout(() => box.classList.remove('kl-open'), 2200);
}
