import { getStore, setStore } from '../core/storage.js';
const DEFAULTS = { mode: 'gradient', image: '', video: '', images: [], videos: [], blur: 0, dim: 18, intervalSeconds: 20, source: 'local' };
const API = '/komari-liu-api/background/config';
let current = null;

export function getBackgroundConfig() { return current || { ...DEFAULTS, ...getStore('background', {}) }; }
export function saveBackgroundConfig(cfg) { current = normalize({ ...getBackgroundConfig(), ...cfg, source: 'local' }); setStore('background', current); applyBackground(); }

export async function loadBackgroundConfig() {
  const local = { ...DEFAULTS, ...getStore('background', {}) };
  try {
    const res = await fetch(API, { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    current = normalize({ ...local, ...(data.config || {}), source: 'api' });
  } catch {
    current = normalize(local);
  }
  applyBackground();
  return current;
}

function normalize(cfg) {
  const images = Array.isArray(cfg.images) ? cfg.images : (cfg.image ? [cfg.image] : []);
  const videos = Array.isArray(cfg.videos) ? cfg.videos : (cfg.video ? [cfg.video] : []);
  return { ...DEFAULTS, ...cfg, image: cfg.image || images[0] || '', video: cfg.video || videos[0] || '', images, videos };
}

export function applyBackground() {
  const cfg = getBackgroundConfig();
  let layer = document.getElementById('kl-bg-layer');
  if (!layer) { layer = document.createElement('div'); layer.id = 'kl-bg-layer'; document.body.prepend(layer); }
  layer.innerHTML = '';
  layer.className = 'kl-bg-layer';
  layer.dataset.source = cfg.source || 'local';
  layer.style.setProperty('--kl-bg-dim', `${Number(cfg.dim || 18) / 100}`);
  layer.style.setProperty('--kl-bg-blur', `${Number(cfg.blur || 0)}px`);
  if (cfg.mode === 'image' && cfg.image) layer.style.backgroundImage = `url("${cfg.image}")`;
  else if (cfg.mode === 'video' && cfg.video) {
    const v = document.createElement('video'); v.src = cfg.video; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true; layer.append(v);
  } else layer.style.backgroundImage = '';
  document.getElementById('kl-bg-source')?.replaceChildren(document.createTextNode(cfg.source === 'api' ? '服务端' : '本地'));
}
