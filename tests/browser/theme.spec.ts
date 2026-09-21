import { test, expect, type Page } from "@playwright/test";
import {
  demoNodes,
  demoStatus,
  demoMetrics,
  demoTasks,
  demoPingStats,
} from "../fixtures/komari";
async function dashboard(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "查看 Hong Kong · Edge", exact: true }),
  ).toBeVisible();
}
async function login(page: Page) {
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByLabel("用户名", { exact: true }).fill("demo");
  await page.getByLabel("密码", { exact: true }).fill("demo");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "登录", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "管理后台", exact: true }),
  ).toBeVisible();
}
test("search, group, grid/table, detail history, navigation, guest gates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await dashboard(page);
  await page.getByLabel("搜索节点", { exact: true }).fill("Pacific");
  await expect(page.locator('a[aria-label^="查看 "]')).toHaveCount(2);
  await page.getByLabel("搜索节点", { exact: true }).fill("");
  await page
    .getByLabel("当前屏幕布局", { exact: true })
    .selectOption("compact");
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("当前屏幕布局", { exact: true }).selectOption("daily");
  await page.getByRole("button", { name: "主力", exact: true }).click();
  await expect(page.locator('a[aria-label^="查看 "]')).toHaveCount(4);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("button", { name: "流量统计", exact: true }).click();
  await expect(page.getByText("访客模式不显示流量数据")).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .getByRole("link", { name: "查看 Pacific · Premium", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pacific · Premium", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "CPU、内存、SWAP 历史曲线" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "24h", exact: true }).first().click();
  await page.getByRole("button", { name: "IP信息", exact: true }).click();
  await expect(page.getByText("掩码显示")).toHaveCount(2);
  await page.getByRole("button", { name: "网络质量", exact: true }).click();
  await page.getByRole("button", { name: "隐藏全部", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "显示全部", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("平均延迟", { exact: true }).first(),
  ).toBeVisible();
  await page.goBack();
  expect(errors).toEqual([]);
});
test("login, admin document navigation, reports, explicit jobs, settings save, logout isolation", async ({
  page,
}) => {
  await dashboard(page);
  await login(page);
  await page.getByRole("button", { name: "流量统计", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("cell", { name: "Pacific · Premium", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "近 30 天", exact: true }).click();
  await expect(page.getByRole("dialog").getByText(/统计时区/)).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .getByRole("link", { name: "查看 Pacific · Premium", exact: true })
    .click();
  await page.getByRole("button", { name: "本地服务", exact: true }).click();
  await page.getByRole("button", { name: "刷新状态", exact: true }).click();
  await expect(page.getByText(/nginx.service running/)).toBeVisible();
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  await page.getByRole("tab", { name: "概览与字段", exact: true }).click();
  await page.getByRole("switch", { name: "心情系统", exact: true }).uncheck();
  await page
    .getByRole("button", { name: "保存为站点默认", exact: true })
    .click();
  await expect(page.getByText("已保存站点默认设置")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "管理后台", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Komari native route fixture" }),
  ).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "流量统计", exact: true }).click();
  await expect(page.getByText("访客模式不显示流量数据")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("table")).toHaveCount(0);
});
test("media uploads, ordered playlist, byte-serving, removal, and background-only toggle", async ({
  page,
}) => {
  await dashboard(page);
  await login(page);
  await page.getByRole("button", { name: "背景设置", exact: true }).click();
  await page.getByLabel("上传媒体", { exact: true }).setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a01kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("上传完成，请保存播放列表")).toBeVisible();
  await page.getByRole("button", { name: "保存播放列表", exact: true }).click();
  await expect(page.getByText("播放列表已保存")).toBeVisible();
  await page.getByRole("button", { name: "删除 1", exact: true }).click();
  await page.getByRole("button", { name: "保存播放列表", exact: true }).click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "只看背景", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "工具栏" })).toBeVisible();
});
test("mobile layout and latency/loss alignment under long quota values", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await dashboard(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  const strip = page.locator('[data-ping-node="demo-005"]');
  await strip.scrollIntoViewIfNeeded();
  await expect(
    strip.getByRole("button", { name: "延迟 · 打开监测详情", exact: true }),
  ).toBeVisible();
  const rects = await strip.evaluate((el) => {
    const find = (text: string) =>
      [...el.querySelectorAll("span")]
        .find((s) => s.textContent?.trim() === text)
        ?.getBoundingClientRect().top;
    return [find("延迟"), find("丢包")];
  });
  expect(typeof rects[0]).toBe("number");
  expect(rects[0]).toBe(rects[1]);
  await page
    .getByRole("link", { name: "查看 Pacific · Premium", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Pacific · Premium", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
for (const count of [10, 50, 100])
  test(`${count} nodes share one RPC connection and fixed refresh workload`, async ({
    page,
  }) => {
    let connections = 0,
      statusRequests = 0;
    const networkBatches: number[] = [];
    await page.routeWebSocket("**/api/rpc2", (ws) => {
      connections++;
      ws.onMessage((message) => {
        const b = JSON.parse(message.toString());
        if (b.method === "common:getNodesLatestStatus") statusRequests++;
        if (
          b.method === "public:queryMetrics" &&
          b.params.metric_keys?.includes("ping.loss")
        )
          networkBatches.push(b.params.entity_ids.length);
        const result =
          b.method === "common:getNodes"
            ? Object.fromEntries(demoNodes(count).map((n) => [n.uuid, n]))
            : b.method === "common:getNodesLatestStatus"
              ? demoStatus(count)
              : b.method === "public:getPublicPingTasks"
                ? demoTasks(count)
                : b.method === "public:getPingMetricStats"
                  ? demoPingStats(b.params, count)
                  : demoMetrics(b.params, count);
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: b.id, result }));
      });
    });
    await dashboard(page);
    await expect(page.locator('a[aria-label^="查看 "]')).toHaveCount(count);
    await page.waitForTimeout(5600);
    expect(connections).toBe(1);
    expect(statusRequests).toBeLessThanOrEqual(3);
    expect(networkBatches.length).toBeGreaterThan(0);
    expect(networkBatches.length).toBeLessThanOrEqual(4);
    expect(Math.max(...networkBatches)).toBeLessThanOrEqual(24);
    await page.getByRole("button", { name: "资产计算器", exact: true }).click();
    expect(connections).toBe(1);
  });
test("blocked websocket falls back to HTTP without breaking core monitoring", async ({
  page,
}) => {
  let httpCalls = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/rpc2") && r.method() === "POST") httpCalls++;
  });
  await page.routeWebSocket("**/api/rpc2", (ws) => ws.close());
  await dashboard(page);
  expect(httpCalls).toBeGreaterThan(0);
});

test("language preference changes UI labels and survives reload", async ({
  page,
}) => {
  await dashboard(page);
  await page.getByRole("button", { name: "切换语言", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Search nodes", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Layout for this screen", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Switch language", exact: true })
    .click();
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeVisible();
});
test("legacy root worker cannot trap the new theme on admin navigation", async ({
  page,
}) => {
  await dashboard(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((r) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => r(),
          { once: true },
        ),
      );
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Komari native route fixture" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      navigator.serviceWorker.getRegistrations().then((r) => r.length),
    ),
  ).toBe(0);
});
