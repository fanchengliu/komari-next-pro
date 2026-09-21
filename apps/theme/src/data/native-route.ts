/** Runs only when a legacy root worker incorrectly serves theme HTML on a server-owned route. */
export async function recoverNativeRoute(): Promise<boolean> {
  if (!/^\/(admin|terminal)(\/|$)/.test(location.pathname)) return false;
  const target = new URL(location.href);
  if (!target.searchParams.has("_ds_native") && "serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const root = registrations.filter(
      (r) =>
        new URL(r.scope).pathname === "/" &&
        [r.active, r.waiting, r.installing].some(
          (w) =>
            w &&
            new URL(w.scriptURL).origin === location.origin &&
            new URL(w.scriptURL).pathname === "/sw.js",
        ),
    );
    if (root.length) {
      await Promise.all(root.map((r) => r.unregister()));
      target.searchParams.set("_ds_native", Date.now().toString());
      location.replace(target.href);
      return true;
    }
  }
  const panel = document.createElement("p");
  panel.textContent =
    "后台路由未返回 Komari 内置页面，请检查反向代理的 /admin 和 /terminal 配置。";
  document.getElementById("root")?.append(panel);
  return true;
}
