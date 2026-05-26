import { getStore, setStore } from '../core/storage.js';
const DEFAULTS = { showMood: true, showLevel: true, showTraffic: true, showAssets: true, compactCards: false };
export function getPrefs() { return { ...DEFAULTS, ...getStore('prefs', {}) }; }
export function savePrefs(next) { setStore('prefs', { ...getPrefs(), ...next }); }
export function applyPrefs() {
  const p = getPrefs();
  document.body.classList.toggle('kl-compact', !!p.compactCards);
  document.body.classList.toggle('kl-hide-mood', !p.showMood);
  document.body.classList.toggle('kl-hide-level', !p.showLevel);
  document.getElementById('kl-traffic-panel')?.classList.toggle('kl-hidden', !p.showTraffic);
  document.getElementById('kl-assets-panel')?.classList.toggle('kl-hidden', !p.showAssets);
}
