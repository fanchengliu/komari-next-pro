import { test, expect, type Page } from "@playwright/test";
import {
  demoNodes,
  demoStatus,
  demoTasks,
  demoMetrics,
  demoPingStats,
} from "../fixtures/komari";
async function login(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByLabel("用户名", { exact: true }).fill("demo");
  await page.getByLabel("密码", { exact: true }).fill("demo");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "登录", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "退出登录", exact: true }),
  ).toBeVisible();
}
test("refresh opens nodes directly, ten-year expiry is consistent, and one layout control replaces the duplicate grid/table bar", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("article[data-node]")).toHaveCount(10);
  await expect(
    page.getByRole("button", { name: "查看服务器", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "只看背景", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "网格", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('[data-node="demo-001"]')).toContainText("长期");
  await page
    .getByLabel("当前屏幕布局", { exact: true })
    .selectOption("compact");
  await expect(page.locator('tr[data-node="demo-001"]')).toContainText("长期");
  await page.reload();
  await expect(page.locator("main[data-layout]")).toHaveAttribute(
    "data-layout",
    "compact",
  );
  await expect(page.locator('tr[data-node="demo-001"]')).toContainText("长期");
  expect(await page.locator("main").innerText()).not.toMatch(/72\d{3}天/);
});
test("compact history keeps row geometry and loaded data while delayed visible-node batches change", async ({
  page,
}) => {
  let historyCalls = 0;
  await page.routeWebSocket("**/api/rpc2", (ws) =>
    ws.onMessage((raw) => {
      const b = JSON.parse(raw.toString());
      const result =
        b.method === "common:getNodes"
          ? Object.fromEntries(demoNodes(100).map((n) => [n.uuid, n]))
          : b.method === "common:getNodesLatestStatus"
            ? demoStatus(100)
            : b.method === "public:getPublicPingTasks"
              ? demoTasks(100)
              : b.method === "public:getPingMetricStats"
                ? demoPingStats(b.params, 100)
                : demoMetrics(b.params, 100);
      const send = () =>
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: b.id, result }));
      if (b.method === "public:queryMetrics") {
        historyCalls++;
        setTimeout(send, 350);
      } else send();
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("当前屏幕布局", { exact: true })
    .selectOption("compact");
  await page.locator('[data-ping-node="demo-005"]').scrollIntoViewIfNeeded();
  await expect(
    page.locator('[data-ping-node="demo-005"] [data-index]').first(),
  ).toBeVisible();
  const before = await page.locator('tr[data-node="demo-005"]').boundingBox();
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(1100);
  const after = await page.locator('tr[data-node="demo-005"]').boundingBox();
  expect(Math.abs(before!.height - after!.height)).toBeLessThan(1);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(1300);
  await expect(page.locator('[data-ping-node="demo-005"]')).not.toContainText(
    "正在读取",
  );
  expect(historyCalls).toBeLessThan(10);
});
test("globe defaults to rotation and all mapped nodes, while selection keeps the full map layer", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/globe");
  const globe = page.locator("canvas");
  await expect(globe).toHaveAttribute("data-map-node-count", "10");
  await expect(globe).toHaveAttribute("data-rotating", "true");
  await expect(
    page.getByRole("button", { name: "暂停旋转", exact: true }),
  ).toBeVisible();
  expect(await page.locator("[data-region][aria-pressed=true]").count()).toBe(
    0,
  );
  const before = await globe.screenshot();
  await page.waitForTimeout(350);
  expect(Buffer.compare(before, await globe.screenshot())).not.toBe(0);
  await page.locator('[data-globe-row="demo-005"]').click();
  await expect(globe).toHaveAttribute("data-map-node-count", "10");
  await expect(page.locator('[data-selected-node="demo-005"]')).toBeVisible();
  await page.getByRole("button", { name: "重置地球视角", exact: true }).click();
  await expect(globe).toHaveAttribute("data-rotating", "true");
});
test("reports and categorized settings share a modal; free assets and long-term timeline are interactive; traffic precision is removed", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "资产计算器", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "免费节点", exact: true }).click();
  await expect(
    dialog.getByRole("cell", { name: "免费", exact: true }),
  ).toHaveCount(4);
  await expect(dialog).toContainText("Hong Kong · Edge");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "到期时间线", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "长期", exact: true }).click();
  await expect(dialog).toContainText("十年以上");
  expect(await dialog.innerText()).not.toMatch(/72\d{3}/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "流量统计", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("columnheader")).toHaveCount(
    5,
  );
  await expect(
    page.getByRole("columnheader", { name: "精度", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("tablist")).toBeVisible();
  await dialog.getByRole("tab", { name: "概览与字段", exact: true }).click();
  await expect(dialog.getByRole("switch", { name: "心情系统" })).toBeVisible();
  await dialog.getByRole("tab", { name: "扩展服务", exact: true }).click();
  await expect(dialog).toContainText("扩展已连接");
});
test("resource cards open real per-metric history dialogs and support keyboard dismissal", async ({
  page,
}) => {
  await page.goto("/instance/demo-005");
  for (const name of [
    "查看处理器详情",
    "查看内存详情",
    "查看磁盘详情",
    "查看网络详情",
  ]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("img", { name: /历史曲线/ })).toBeVisible();
    await dialog.getByRole("button", { name: "24h", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
  await page.getByRole("button", { name: "延迟 / 丢包", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "所选时段汇总" }),
  ).toBeVisible();
});
test("remote import creates a server file, image hold survives refresh, and video mode can be restored", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "背景设置", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("背景链接", { exact: true })
    .fill("https://media.test/background.png");
  await dialog
    .getByRole("button", { name: "下载到服务器", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "已下载到服务器媒体库",
  );
  await dialog.getByLabel("播放顺序", { exact: true }).selectOption("hold");
  await dialog
    .getByRole("button", { name: "保存播放列表", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText("播放列表已保存");
  await page.keyboard.press("Escape");
  await page.reload();
  const bg = page.locator("[data-phase]");
  await expect(bg.locator("img")).toHaveAttribute(
    "src",
    /\/komari-ds-api\/v1\/media\//,
  );
  await page.waitForTimeout(2200);
  await expect(bg).toHaveAttribute("data-phase", "playing");
  await page.getByRole("button", { name: "背景设置", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "加入默认背景", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "保存播放列表", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(bg.locator("video")).toBeVisible();
});
test("without an extension, links, image/video selection and local hold still work; installation is reachable", async ({
  page,
}) => {
  await page.route("**/komari-ds-api/v1/capabilities", (r) =>
    r.fulfill({ status: 404, json: { error: "Not installed" } }),
  );
  await login(page);
  await page.getByRole("button", { name: "背景设置", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("背景类型", { exact: true })).toBeVisible();
  await dialog
    .getByLabel("背景链接", { exact: true })
    .fill("/media/background-poster.png");
  await dialog
    .getByRole("button", { name: "加入播放列表", exact: true })
    .click();
  await dialog.getByLabel("播放顺序", { exact: true }).selectOption("hold");
  await dialog.getByRole("button", { name: "保存到本机", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator("[data-phase] img")).toHaveAttribute(
    "src",
    "/media/background-poster.png",
  );
  await page.getByRole("button", { name: "背景设置", exact: true }).click();
  await page
    .getByRole("button", { name: "查看扩展连接与安装", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("扩展尚未连接");
  await expect(
    dialog.getByRole("link", { name: "打开扩展部署说明", exact: true }),
  ).toBeVisible();
});

test("mobile tool windows fit the screen and extension guide is actually available", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  for (const name of [
    "资产计算器",
    "到期时间线",
    "流量统计",
    "背景设置",
    "主题设置",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.width).toBeLessThanOrEqual(390);
    expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await page.keyboard.press("Escape");
  }
  const guide = await page.request.get("/extension-guide.html");
  expect(guide.status()).toBe(200);
  expect(await guide.text()).toContain("扩展服务接入");
});

test("image rotation advances and keeping a selected image stops the timer across reload", async ({
  page,
}) => {
  const items = [1, 2].map((i) => ({
    id: "frame-" + i,
    url: "/media/logo.png?frame=" + i,
    kind: "image",
    name: "Frame " + i,
    duration: 2,
  }));
  await page.addInitScript(
    (playlist) => {
      if (!localStorage.getItem("komari-ds:ui:v2"))
        localStorage.setItem(
          "komari-ds:ui:v2",
          JSON.stringify({
            version: 2,
            state: {
              preferences: {},
              view: "grid",
              playlistOverride: playlist,
            },
          }),
        );
    },
    {
      version: 1,
      mode: "image",
      order: "rotation",
      videoTiming: "full",
      interval: 2,
      items,
    },
  );
  await page.goto("/");
  const image = page.locator("[data-phase] img");
  await expect(image).toHaveAttribute("src", /frame=1/);
  await expect(image).toHaveAttribute("src", /frame=2/, { timeout: 5000 });
  await login(page);
  await page.getByRole("button", { name: "背景设置", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "选用 2", exact: true }).click();
  await dialog.getByLabel("播放顺序", { exact: true }).selectOption("hold");
  await dialog.getByRole("button", { name: "保存到本机", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(image).toHaveAttribute("src", /frame=2/);
  await page.waitForTimeout(2300);
  await expect(image).toHaveAttribute("src", /frame=2/);
});
