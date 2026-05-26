export function demoNodes() {
  return [
    { uuid: 'demo-seoul', name: 'Seoul Edge', region: 'KR · Seoul', os: 'Ubuntu', arch: 'arm64', cpu: 18, mem: 42, upload: 420000, download: 1800000, uptimeDays: 96, online: true },
    { uuid: 'demo-paris', name: 'Paris Origin', region: 'FR · Paris', os: 'Debian', arch: 'x64', cpu: 7, mem: 28, upload: 120000, download: 780000, uptimeDays: 365, online: true },
    { uuid: 'demo-tokyo', name: 'Tokyo Worker', region: 'JP · Tokyo', os: 'Alpine', arch: 'x64', cpu: 84, mem: 71, upload: 920000, download: 2200000, uptimeDays: 32, online: true },
  ];
}
export function shouldShowDemo(nodes) {
  try { return !nodes.length && localStorage.getItem('komari-liu:hide-demo') !== '1'; } catch { return !nodes.length; }
}
export function hideDemo() { try { localStorage.setItem('komari-liu:hide-demo', '1'); } catch {} }
