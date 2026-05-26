async function getJson(url) {
  const res = await fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } });
  const type = res.headers.get('content-type') || '';
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  if (!type.includes('application/json')) throw new Error(`${url} -> non-json`);
  return res.json();
}

async function tryGet(url) {
  try { return await getJson(url); } catch (err) { return { status: 'error', error: String(err), data: null }; }
}

export async function fetchOverview() {
  const [publicInfo, nodes] = await Promise.all([
    tryGet('/api/public'),
    tryGet('/api/nodes'),
  ]);
  return { publicInfo, nodes };
}

export function unwrap(payload, fallback = null) {
  if (payload == null) return fallback;
  if (payload.data != null) return payload.data;
  return payload;
}

function pick(obj, keys, fallback = null) {
  for (const key of keys) if (obj && obj[key] != null && obj[key] !== '') return obj[key];
  return fallback;
}

function percentFromUsedTotal(used, total) {
  const u = Number(used || 0), t = Number(total || 0);
  return t > 0 ? (u / t) * 100 : 0;
}

export function normalizeNodes(payload) {
  const data = unwrap(payload.nodes, []);
  const list = Array.isArray(data) ? data : (Array.isArray(data?.nodes) ? data.nodes : []);
  return list.map((node, idx) => {
    const uuid = pick(node, ['uuid', 'id', 'client_id', 'clientId'], `node-${idx}`);
    const statusRaw = String(pick(node, ['status', 'state'], '') || '').toLowerCase();
    const online = pick(node, ['online', 'is_online', 'isOnline'], null);
    const cpu = pick(node, ['cpu', 'cpu_usage', 'cpuUsage'], pick(node?.stat, ['cpu'], 0));
    const mem = pick(node, ['mem', 'memory', 'memory_usage', 'memoryUsage'], percentFromUsedTotal(pick(node?.ram, ['used'], 0), pick(node?.ram, ['total'], 0)));
    const up = pick(node, ['upload', 'net_out', 'network_out', 'up', 'up_speed'], pick(node?.network, ['up', 'upload'], 0));
    const down = pick(node, ['download', 'net_in', 'network_in', 'down', 'down_speed'], pick(node?.network, ['down', 'download'], 0));
    return {
      raw: node,
      uuid,
      name: pick(node, ['name', 'client_name', 'clientName', 'hostname'], `Node ${idx + 1}`),
      region: pick(node, ['region', 'country', 'location', 'area'], '未知地区'),
      os: pick(node, ['os', 'platform', 'system'], ''),
      arch: pick(node, ['arch', 'architecture'], ''),
      cpu: Number(cpu || 0),
      mem: Number(mem || 0),
      upload: Number(up || 0),
      download: Number(down || 0),
      uptimeSeconds: Number(pick(node, ['uptime', 'uptime_seconds', 'uptimeSeconds'], 0) || 0),
      uptimeDays: Number(pick(node, ['uptime_days', 'uptimeDays', 'days'], 0) || 0),
      online: online == null ? statusRaw !== 'offline' && statusRaw !== 'down' : Boolean(online),
    };
  });
}

export function normalizePublic(payload) {
  const data = unwrap(payload.publicInfo, {}) || {};
  return {
    siteName: data.sitename || data.siteName || 'Komari',
    description: data.description || '',
    theme: data.theme || '',
    themeSettings: data.theme_settings || data.themeSettings || {},
    recordEnabled: Boolean(data.record_enabled ?? data.recordEnabled),
  };
}
