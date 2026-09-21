import { test, expect } from "@playwright/test";
test("IP partial failure and quality configuration are explicit, including old done caches", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "ds_demo", value: "authenticated", domain: "127.0.0.1", path: "/" },
  ]);
  await page.route("**/komari-ds-api/v1/jobs/latest?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("kind") !== "ip")
      return route.continue();
    return route.fulfill({
      json: {
        id: "partial-fixture",
        nodeId: "demo-008",
        kind: "ip",
        state: "done",
        updatedAt: new Date().toISOString(),
        result: {
          ipv4: { ip: "192.0.2.8", country: "US", city: "Newark" },
          ipv6: null,
          provider: "ipinfo.io",
          diagnostics: {
            ipv4: { state: "success" },
            ipv6: { state: "failed", reason: "dns", exitCode: 6 },
          },
          quality: { state: "not_configured" },
        },
      },
    });
  });
  await page.goto("/instance/demo-008");
  await page.getByRole("button", { name: "IP信息", exact: true }).click();
  await page.getByRole("button", { name: "数据源指标", exact: true }).click();
  await expect(page.getByText(/状态：部分完成/)).toBeVisible();
  await expect(page.locator("[data-ip-diagnostics]")).toContainText(
    "IPv6 · 域名解析失败",
  );
  await expect(page.locator("[data-quality-state]")).toHaveText(
    "质量数据源未配置",
  );
  await expect(
    page.getByRole("link", { name: "查看配置说明" }),
  ).toHaveAttribute("href", /extension-guide.html#ip-quality$/);
  await expect(page.getByText("置信度", { exact: true })).toHaveCount(0);
});
test("globe respects rotation preference and agrees with sidebar freshness state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() =>
    localStorage.setItem(
      "komari-ds:ui:v2",
      JSON.stringify({
        state: { preferences: { globeAutoRotate: false } },
        version: 2,
      }),
    ),
  );
  await page.routeWebSocket("**/api/rpc2", (ws) => {
    const server = ws.connectToServer();
    server.onMessage((raw) => {
      const data = JSON.parse(String(raw));
      if (data.result?.["demo-001"]?.time) {
        data.result["demo-001"].time = new Date(
          Date.now() - 120000,
        ).toISOString();
        data.result["demo-001"].online = true;
      }
      ws.send(JSON.stringify(data));
    });
  });
  await page.goto("/globe");
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-rotating",
    "false",
  );
  await expect(page.locator('[data-map-node="demo-001"]')).toHaveAttribute(
    "data-status",
    "stale",
  );
  await expect(
    page.locator('[data-globe-row="demo-001"] i[data-status]'),
  ).toHaveAttribute("data-status", "stale");
  await page.getByRole("button", { name: "重置地球视角", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-rotating",
    "false",
  );
  await page.getByRole("button", { name: "自动旋转", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute("data-rotating", "true");
  await page.getByRole("button", { name: "暂停旋转", exact: true }).click();
  const flag = page.locator('[data-map-node="demo-001"]');
  await flag.click();
  await expect(page.locator('[data-selected-node="demo-001"]')).toBeVisible();
});
