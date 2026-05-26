(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  const STORAGE_KEY = 'background:config';
  const DEFAULT_STATE = {
    mode: 'image',
    images: [],
    videos: [],
    intervalSeconds: 10,
    videoPlayMode: 'full',
    resources: [],
    saving: false,
    loggedIn: false,
    runToken: 0,
    error: ''
  };
  let ctx;
  let state = Object.assign({}, DEFAULT_STATE);
  let rootEl, panelEl, backdropEl, imageLayer, videoLayer, timer;
  let cleanup = [];

  function normalize(raw){
    const cfg = (raw && raw.config) ? raw.config : (raw || {});
    const maxImages = (ctx.config.background && ctx.config.background.maxImages) || 3;
    const maxVideos = (ctx.config.background && ctx.config.background.maxVideos) || 3;
    return Object.assign({}, DEFAULT_STATE, {
      mode: cfg.mode === 'video' ? 'video' : 'image',
      images: Array.isArray(cfg.images) ? cfg.images.filter(Boolean).slice(0, maxImages) : [],
      videos: Array.isArray(cfg.videos) ? cfg.videos.filter(Boolean).slice(0, maxVideos) : [],
      intervalSeconds: Math.max(3, Number(cfg.intervalSeconds || cfg.interval || DEFAULT_STATE.intervalSeconds)),
      videoPlayMode: cfg.videoPlayMode === 'fixed' ? 'fixed' : 'full',
      resources: Array.isArray(cfg.resources) ? cfg.resources : [],
      updatedAt: cfg.updatedAt || raw.updatedAt || null,
      loggedIn: !!cfg.loggedIn || !!raw.loggedIn
    });
  }

  function endpoint(){ return (ctx.api && ctx.api.endpoint('background')) || '/knp-bg-api/config'; }
  function bump(){ state.runToken += 1; return state.runToken; }
  function setState(next){ state = Object.assign({}, state, next || {}); ctx.state && ctx.state.set('background', state); renderPanel(); }
  function clearTimer(){ if (timer) clearTimeout(timer); timer = null; }

  function ensureDom(){
    backdropEl = ctx.dom.ensureRoot('komari-liu-background', 'komari-liu-background');
    if (!imageLayer) {
      imageLayer = ctx.dom.el('img', { class: 'komari-liu-bg-image', alt: '' });
      backdropEl.appendChild(imageLayer);
    }
    if (!videoLayer) {
      videoLayer = ctx.dom.el('video', { class: 'komari-liu-bg-video', muted: true, playsinline: true, loop: true });
      videoLayer.muted = true;
      videoLayer.playsInline = true;
      backdropEl.appendChild(videoLayer);
    }
    rootEl = ctx.dom.ensureRoot('komari-liu-background-center', 'komari-liu-background-center');
    if (!rootEl.dataset.ready) {
      const btn = ctx.dom.el('button', { class: 'komari-liu-bg-toggle', type: 'button', text: '背景' });
      panelEl = ctx.dom.el('section', { class: 'komari-liu-bg-panel', hidden: true, 'aria-label': '背景中心' });
      rootEl.append(btn, panelEl);
      cleanup.push(ctx.events.listen(btn, 'click', () => { panelEl.hidden = !panelEl.hidden; renderPanel(); }));
      rootEl.dataset.ready = '1';
    } else {
      panelEl = rootEl.querySelector('.komari-liu-bg-panel');
    }
  }

  function applyBackground(){
    ensureDom();
    clearTimer();
    const token = bump();
    imageLayer.hidden = true;
    videoLayer.hidden = true;
    videoLayer.pause();
    videoLayer.removeAttribute('src');
    videoLayer.load();
    if (state.mode === 'video' && state.videos.length) return applyVideo(token, 0);
    if (state.images.length) return applyImage(token, 0);
  }

  function applyImage(token, index){
    if (token !== state.runToken || !state.images.length) return;
    const src = state.images[index % state.images.length];
    imageLayer.onload = () => {
      if (token !== state.runToken) return;
      videoLayer.hidden = true;
      imageLayer.hidden = false;
      setState({ error: '' });
    };
    imageLayer.onerror = () => {
      if (token !== state.runToken) return;
      setState({ error: '图片背景加载失败' });
    };
    imageLayer.src = src;
    if (state.images.length > 1) {
      timer = setTimeout(() => applyImage(token, index + 1), state.intervalSeconds * 1000);
    }
  }

  function applyVideo(token, index){
    if (token !== state.runToken || !state.videos.length) return;
    const src = state.videos[index % state.videos.length];
    videoLayer.oncanplay = () => {
      if (token !== state.runToken) return;
      imageLayer.hidden = true;
      videoLayer.hidden = false;
      setState({ error: '' });
      videoLayer.play().catch(() => {});
    };
    videoLayer.onerror = () => {
      if (token !== state.runToken) return;
      setState({ error: '视频背景加载失败' });
    };
    videoLayer.onended = () => {
      if (token === state.runToken && state.videoPlayMode === 'full' && state.videos.length > 1) applyVideo(token, index + 1);
    };
    videoLayer.loop = !(state.videoPlayMode === 'full' && state.videos.length > 1);
    videoLayer.src = src;
    videoLayer.load();
  }

  function textareaValue(name){ const el = panelEl.querySelector(`[data-field="${name}"]`); return el ? el.value.split('\n').map(v => v.trim()).filter(Boolean) : []; }
  function setBusy(busy){ setState({ saving: !!busy }); }

  async function loadConfig(){
    const cached = ctx.storage && ctx.storage.get(STORAGE_KEY, null);
    if (cached) state = normalize(cached);
    try {
      const remote = await ctx.api.get(endpoint(), { timeoutMs: 5000 });
      state = normalize(remote);
      ctx.storage && ctx.storage.set(STORAGE_KEY, state);
      setState({ error: '' });
    } catch (err) {
      const fallback = cached ? '使用本地缓存；背景 API 暂不可用' : '背景 API 暂不可用';
      setState({ error: fallback });
      ctx.logger && ctx.logger.warn('background config load failed', err);
    }
    applyBackground();
    renderPanel();
  }

  async function saveConfig(partial, heavy){
    const next = Object.assign({}, state, partial || {});
    setState(next);
    applyBackground();
    ctx.storage && ctx.storage.set(STORAGE_KEY, next);
    if (heavy) setBusy(true);
    try {
      const saved = await ctx.api.post(endpoint(), {
        mode: next.mode,
        images: next.images,
        videos: next.videos,
        intervalSeconds: next.intervalSeconds,
        videoPlayMode: next.videoPlayMode
      }, { timeoutMs: 20000 });
      const resultErrors = saved && Array.isArray(saved.results) ? saved.results.filter(r => r && r.status === 'error') : [];
      const normalized = normalize(saved || next);
      const changed = JSON.stringify(normalized.images) !== JSON.stringify(state.images) || JSON.stringify(normalized.videos) !== JSON.stringify(state.videos) || normalized.mode !== state.mode;
      state = normalized;
      ctx.storage && ctx.storage.set(STORAGE_KEY, state);
      setState({ error: resultErrors.length ? ('部分资源保存失败，已保留上一份可用配置：' + resultErrors.map(r => r.error).join('; ')) : '' });
      if (changed || resultErrors.length) applyBackground();
    } catch (err) {
      setState({ error: '保存失败：' + (err.message || 'unknown error') });
      ctx.logger && ctx.logger.warn('background save failed', err);
    } finally {
      if (heavy) setBusy(false);
      renderPanel();
    }
  }

  function renderPanel(){
    if (!panelEl) return;
    panelEl.innerHTML = `
      <header class="komari-liu-bg-panel-head">
        <strong>背景中心</strong>
        <button type="button" data-action="close" aria-label="关闭">×</button>
      </header>
      ${state.error ? `<p class="komari-liu-bg-alert">${escapeHtml(state.error)}</p>` : ''}
      <div class="komari-liu-bg-row">
        <button type="button" data-mode="image" class="${state.mode === 'image' ? 'active' : ''}">图片</button>
        <button type="button" data-mode="video" class="${state.mode === 'video' ? 'active' : ''}">视频</button>
      </div>
      <label>图片 URL（最多 3 行）<textarea data-field="images" rows="3">${escapeHtml(state.images.join('\n'))}</textarea></label>
      <label>视频 URL（最多 3 行）<textarea data-field="videos" rows="3">${escapeHtml(state.videos.join('\n'))}</textarea></label>
      <div class="komari-liu-bg-grid">
        <label>图片轮换秒数<input data-field="interval" type="number" min="3" max="3600" value="${state.intervalSeconds}"></label>
        <label>视频模式<select data-field="videoPlayMode"><option value="full" ${state.videoPlayMode === 'full' ? 'selected' : ''}>完整播放</option><option value="fixed" ${state.videoPlayMode === 'fixed' ? 'selected' : ''}>固定当前</option></select></label>
      </div>
      <div class="komari-liu-bg-actions">
        <button type="button" data-action="save" ${state.saving ? 'disabled' : ''}>${state.saving ? '保存中…' : '保存 URL'}</button>
        <button type="button" data-action="refresh">刷新配置</button>
      </div>
    `;
  }

  function escapeHtml(str){ return String(str == null ? '' : str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

  function bindPanel(){
    cleanup.push(ctx.events.listen(rootEl, 'click', ev => {
      const target = ev.target.closest('button');
      if (!target || !rootEl.contains(target)) return;
      if (target.dataset.action === 'close') panelEl.hidden = true;
      if (target.dataset.action === 'refresh') loadConfig();
      if (target.dataset.mode) saveConfig({ mode: target.dataset.mode }, false);
      if (target.dataset.action === 'save') {
        const intervalEl = panelEl.querySelector('[data-field="interval"]');
        const modeEl = panelEl.querySelector('[data-field="videoPlayMode"]');
        saveConfig({
          images: textareaValue('images').slice(0, (ctx.config.background && ctx.config.background.maxImages) || 3),
          videos: textareaValue('videos').slice(0, (ctx.config.background && ctx.config.background.maxVideos) || 3),
          intervalSeconds: Math.max(3, Number(intervalEl && intervalEl.value || state.intervalSeconds)),
          videoPlayMode: modeEl && modeEl.value === 'fixed' ? 'fixed' : 'full'
        }, true);
      }
    }));
  }

  const mod = {
    init(context){
      if (ctx) return;
      ctx = context;
      state = normalize(ctx.storage && ctx.storage.get(STORAGE_KEY, DEFAULT_STATE));
      ensureDom();
      bindPanel();
      renderPanel();
      applyBackground();
      loadConfig();
    },
    destroy(){ cleanup.forEach(fn => { try { fn(); } catch (_) {} }); cleanup = []; clearTimer(); if (videoLayer) { videoLayer.pause(); videoLayer.removeAttribute('src'); } ctx = null; },
    health(){ return { name: 'background', status: 'ready', phase: 'B', mode: state.mode, images: state.images.length, videos: state.videos.length }; }
  };
  if (root.register) root.register('background', mod);
  else (root._pendingModules = root._pendingModules || []).push({ name: 'background', mod });
})();
