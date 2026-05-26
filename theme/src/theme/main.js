import { fetchOverview, normalizeNodes, normalizePublic } from './core/api.js';
import { applyBackground, getBackgroundConfig, loadBackgroundConfig, saveBackgroundConfig } from './modules/background.js';
import { renderShell } from './render/layout.js';
import { renderNodes, renderSidePanel, renderStats } from './render/dashboard.js';
import { renderAssetsPanel } from './render/assets.js';
import { applyPrefs, getPrefs, savePrefs } from './modules/preferences.js';
import { renderTrafficPanel } from './render/traffic.js';
import { demoNodes, hideDemo, shouldShowDemo } from './modules/demo.js';
import { toast } from './render/toast.js';

async function load() {
  const updated = document.getElementById('kl-updated');
  try {
    const payload = await fetchOverview();
    let nodes = normalizeNodes(payload);
    const demo = shouldShowDemo(nodes);
    if (demo) nodes = demoNodes();
    const publicInfo = normalizePublic(payload);
    renderStats(nodes, publicInfo);
    renderSidePanel(nodes);
    renderNodes(nodes, { demo });
    renderTrafficPanel(nodes);
    renderAssetsPanel();
    applyPrefs();
    if (updated) updated.textContent = `更新于 ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    renderStats([]); renderSidePanel([]); renderNodes([]); renderTrafficPanel([]); renderAssetsPanel();
    if (updated) updated.textContent = `读取失败`;
    console.error('[komari-liu]', err);
  }
}

renderShell();
applyBackground();
applyPrefs();
document.getElementById('kl-refresh')?.addEventListener('click', load);
document.getElementById('kl-settings')?.addEventListener('click', () => document.getElementById('kl-settings-panel')?.classList.toggle('kl-open'));
document.getElementById('kl-bg-random')?.addEventListener('click', () => document.getElementById('kl-settings-panel')?.classList.toggle('kl-open'));
const mode = document.getElementById('kl-bg-mode');
const img = document.getElementById('kl-bg-image');
const vid = document.getElementById('kl-bg-video');
const blur = document.getElementById('kl-bg-blur');
const dim = document.getElementById('kl-bg-dim');
function syncBackgroundForm() { const bg = getBackgroundConfig(); if (mode) mode.value = bg.mode; if (img) img.value = bg.image || ''; if (vid) vid.value = bg.video || ''; if (blur) blur.value = bg.blur ?? 0; if (dim) dim.value = bg.dim ?? 18; }
syncBackgroundForm();
loadBackgroundConfig().then(syncBackgroundForm);
const prefs = getPrefs();
[['kl-pref-mood','showMood'],['kl-pref-level','showLevel'],['kl-pref-traffic','showTraffic'],['kl-pref-assets','showAssets'],['kl-pref-compact','compactCards']].forEach(([id,key]) => { const input = document.getElementById(id); if (input) input.checked = !!prefs[key]; });
document.getElementById('kl-bg-save')?.addEventListener('click', () => {
  saveBackgroundConfig({ mode: mode?.value, image: img?.value, video: vid?.value, blur: Number(blur?.value || 0), dim: Number(dim?.value || 18) });
  savePrefs({ showMood: document.getElementById('kl-pref-mood')?.checked, showLevel: document.getElementById('kl-pref-level')?.checked, showTraffic: document.getElementById('kl-pref-traffic')?.checked, showAssets: document.getElementById('kl-pref-assets')?.checked, compactCards: document.getElementById('kl-pref-compact')?.checked });
  applyPrefs();
  toast('设置已保存', 'good');
});
renderAssetsPanel();
load();
setInterval(load, 30000);

document.addEventListener('click', (event) => {
  const target = event.target;
  if (target?.id === 'kl-hide-demo') { hideDemo(); load(); toast('已隐藏预览节点', 'info'); }
});
