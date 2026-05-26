const PREFIX = 'komari-liu:';
export function getStore(key, fallback) {
  try { const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
export function setStore(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
}
