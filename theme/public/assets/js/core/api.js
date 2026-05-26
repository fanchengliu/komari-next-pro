(function(){
  'use strict';
  const root = window.KomariLiu = window.KomariLiu || {};
  async function request(url, options={}){
    const timeoutMs = options.timeoutMs || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOptions = Object.assign({ credentials: 'same-origin', signal: controller.signal }, options);
    delete fetchOptions.timeoutMs;
    try {
      const res = await fetch(url, fetchOptions);
      const contentType = res.headers.get('content-type') || '';
      const body = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => '');
      if (!res.ok) {
        const err = new Error((body && body.error && (body.error.message || body.error)) || res.statusText || 'request failed');
        err.status = res.status; err.body = body; throw err;
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  }
  root.api = {
    request,
    get(url, options){ return request(url, options); },
    post(url, data, options={}){ return request(url, Object.assign({}, options, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, options.headers || {}), body: JSON.stringify(data || {}) })); },
    endpoint(name){ return root.config && root.config.api && root.config.api[name]; }
  };
})();
