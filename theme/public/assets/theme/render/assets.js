import { el, clear } from '../core/dom.js';
import { toast } from './toast.js';
import { getAssets, saveAssets, daysLeft, assetTone, assetSummary } from '../modules/assets.js';

export function renderAssetsPanel() {
  const root = document.getElementById('kl-assets-panel');
  if (!root) return;
  const items = getAssets();
  const s = assetSummary(items);
  clear(root).append(
    el('div', { class: 'kl-section-head' }, [
      el('div', {}, [el('h2', { class: 'kl-section-title', text: '资产与到期' }), el('p', { class: 'kl-subtitle', text: '域名、VPS、订阅和证书的轻量资产清单。' })]),
      el('button', { class: 'kl-btn', id: 'kl-asset-add', text: '添加资产' }),
    ]),
    el('div', { class: 'kl-insight-grid kl-assets-summary' }, [
      box('资产数量', s.count), box('30天内到期', s.expiring), box('月成本', `¥${s.totalCost.toFixed(0)}`), box('存储', '本地'),
    ]),
    el('div', { class: 'kl-asset-list' }, items.map(renderAsset))
  );
  root.querySelector('#kl-asset-add')?.addEventListener('click', () => editAsset({ id: crypto.randomUUID?.() || String(Date.now()), name: '', type: 'VPS', expires: '', cost: 0, note: '' }));
  root.querySelectorAll('[data-edit-asset]').forEach(btn => btn.addEventListener('click', () => {
    const item = getAssets().find(a => a.id === btn.getAttribute('data-edit-asset'));
    if (item) editAsset(item);
  }));
  root.querySelectorAll('[data-delete-asset]').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-delete-asset');
    saveAssets(getAssets().filter(a => a.id !== id));
    renderAssetsPanel(); toast('资产已删除', 'info');
  }));
}
function box(label, value) { return el('div', { class: 'kl-insight kl-info' }, [el('span', { text: label }), el('strong', { text: value })]); }
function renderAsset(asset) {
  const d = daysLeft(asset.expires);
  const tone = assetTone(asset);
  const line = d == null ? '未设置到期' : d < 0 ? `已过期 ${Math.abs(d)} 天` : `${d} 天后到期`;
  return el('article', { class: `kl-asset kl-${tone}` }, [
    el('div', {}, [el('strong', { text: asset.name || '未命名资产' }), el('p', { text: `${asset.type || '资产'} · ${line} · ¥${Number(asset.cost || 0).toFixed(0)}/月` }), asset.note ? el('small', { text: asset.note }) : null]),
    el('div', { class: 'kl-asset-actions' }, [el('span', { class: 'kl-pill', text: tone === 'danger' ? '过期' : tone === 'warn' ? '临期' : '正常' }), el('button', { class: 'kl-mini-btn', 'data-edit-asset': asset.id, text: '编辑' }), el('button', { class: 'kl-mini-btn kl-danger-btn', 'data-delete-asset': asset.id, text: '删除' })]),
  ]);
}
function editAsset(asset) {
  const modal = document.getElementById('kl-modal') || document.body.appendChild(el('div', { id: 'kl-modal', class: 'kl-modal' }));
  modal.className = 'kl-modal kl-open';
  clear(modal).append(el('div', { class: 'kl-modal-card kl-card' }, [
    el('h3', { class: 'kl-section-title', text: asset.name ? '编辑资产' : '添加资产' }),
    field('名称', 'kl-edit-name', asset.name || ''), field('类型', 'kl-edit-type', asset.type || 'VPS'), field('到期日期', 'kl-edit-expires', asset.expires || '', 'date'), field('月成本', 'kl-edit-cost', asset.cost || 0, 'number'), field('备注', 'kl-edit-note', asset.note || ''),
    el('div', { class: 'kl-modal-actions' }, [el('button', { class: 'kl-btn', id: 'kl-edit-cancel', text: '取消' }), el('button', { class: 'kl-btn kl-primary-btn', id: 'kl-edit-save', text: '保存' })])
  ]));
  modal.querySelector('#kl-edit-cancel')?.addEventListener('click', () => modal.classList.remove('kl-open'));
  modal.querySelector('#kl-edit-save')?.addEventListener('click', () => {
    const next = { ...asset, name: val('kl-edit-name') || '未命名资产', type: val('kl-edit-type'), expires: val('kl-edit-expires'), cost: Number(val('kl-edit-cost') || 0), note: val('kl-edit-note') };
    const items = getAssets();
    const idx = items.findIndex(a => a.id === next.id);
    if (idx >= 0) items[idx] = next; else items.push(next);
    saveAssets(items); modal.classList.remove('kl-open'); renderAssetsPanel(); toast('资产已保存', 'good');
  });
}
function field(label, id, value, type = 'text') { return el('div', { class: 'kl-field' }, [el('label', { text: label }), el('input', { id, type, value })]); }
function val(id) { return document.getElementById(id)?.value || ''; }
