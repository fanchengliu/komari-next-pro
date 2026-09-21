import { test, expect, type Page } from "@playwright/test";
import {
  demoNodes,
  demoStatus,
  demoMetrics,
  demoTasks,
  demoPingStats,
} from "../fixtures/komari";
async function home(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-node="demo-005"]')).toBeVisible();
}
async function network(page: Page) {
  await page.goto("/network?nodes=demo-005,demo-006&tasks=2,3,4");
  await expect(
    page.getByRole("heading", { name: "所选时段汇总" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(6);
}

test("history cells show real buckets, open a recalculated interval, and restore focus", async ({
  page,
}) => {
  await home(page);
  const strip = page.locator('[data-ping-node="demo-005"]');
  const cell = strip.locator("[data-index]").first();
  await expect(cell).toBeVisible();
  await cell.hover();
  await expect(page.getByRole("tooltip")).toContainText("有效延迟样本");
  await cell.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Pacific · Premium");
  await expect(
    dialog.getByRole("heading", { name: "所选时段汇总" }),
  ).toBeVisible();
  await dialog.getByRole("link", { name: "放到网络总览比较" }).click();
  await expect(page).toHaveURL(/from=.*to=/);
  const params = new URL(page.url()).searchParams;
  expect(
    Date.parse(params.get("to")!) - Date.parse(params.get("from")!),
  ).toBeLessThan(3600000);
  await expect(
    page.getByRole("heading", { name: "所选时段汇总" }),
  ).toBeVisible();
});

test("network uses identical explicit windows for both nodes, tasks, brush and custom dates", async ({
  page,
}) => {
  const requests: any[] = [];
  page.on("websocket", (ws) =>
    ws.on("framesent", (event) => {
      try {
        const b = JSON.parse(String(event.payload));
        if (
          b.method === "public:queryMetrics" ||
          b.method === "public:getPingMetricStats"
        )
          requests.push(b);
      } catch {}
    }),
  );
  await network(page);
  await page.getByRole("button", { name: "自定义时段", exact: true }).click();
  const start = new Date(Date.now() - 86400000);
  start.setHours(19, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23);
  const local = (d: Date) =>
    new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 16);
  // The fixture timezone is Asia/Shanghai; explicit browser inputs exercise civil-time conversion.
  await page.getByLabel("开始时间", { exact: true }).fill(local(start));
  await page.getByLabel("结束时间", { exact: true }).fill(local(end));
  await page.getByRole("button", { name: "应用时间范围", exact: true }).click();
  await expect(page).toHaveURL(/from=/);
  await expect(page.locator("tbody tr")).toHaveCount(6);
  const url = new URL(page.url()),
    from = url.searchParams.get("from"),
    to = url.searchParams.get("to");
  await expect
    .poll(
      () =>
        requests.filter((r) => r.params.start === from && r.params.end === to)
          .length,
    )
    .toBeGreaterThanOrEqual(2);
  const query = requests.find(
    (r) => r.method === "public:queryMetrics" && r.params.start === from,
  );
  expect(query.params.entity_ids).toEqual(["demo-005", "demo-006"]);
  expect(query.params.metric_keys).toEqual(["ping.latency_ms", "ping.loss"]);
  await page
    .getByRole("checkbox", { name: "黑龙江移动线路", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "黑龙江移动线路", exact: true }),
  ).not.toBeChecked();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "黑龙江移动线路", exact: true }),
  ).not.toBeChecked();
  const chart = page.getByRole("img", { name: "多线路延迟历史曲线" });
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.25, box!.y + 100);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.65, box!.y + 130, { steps: 8 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "查看此时段", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看此时段", exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("from"))
    .not.toBe(from);
});

test("comparison caps selection at four and respects visible fields", async ({
  page,
}) => {
  await page.goto("/compare?nodes=demo-005,demo-006,not-visible");
  await expect(
    page.getByRole("heading", { name: "节点对比", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /选择节点/ })
    .first()
    .click();
  await page.getByRole("checkbox", { name: "Hong Kong · Edge", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Hong Kong · Edge", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: "Seoul · Compute", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Seoul · Compute", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: "Frankfurt · Core", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("最多同时对比四台节点");
  await page.keyboard.press("Escape");
  await expect(page.locator("thead th")).toHaveCount(5);
  await page.getByRole("checkbox", { name: "仅看差异", exact: true }).check();
  await expect(
    page.getByRole("link", { name: "去网络总览比较" }),
  ).toHaveAttribute("href", /demo-005/);
  expect(await page.locator("main").innerText()).not.toContain("not-visible");
  expect(await page.locator("main").innerText()).not.toContain("192.0.2.");
});

test("v1 preferences migrate without overwriting the v1 key; desktop/mobile choices are independent", async ({
  page,
}) => {
  const old = JSON.stringify({
    state: {
      view: "grid",
      preferences: { appearance: "dark", accent: "#336699" },
    },
    version: 1,
  });
  await page.addInitScript((value) => {
    if (!localStorage.getItem("komari-ds:ui:v1"))
      localStorage.setItem("komari-ds:ui:v1", value);
  }, old);
  await home(page);
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await page
    .getByLabel("当前屏幕布局", { exact: true })
    .selectOption("compact");
  await expect(page.locator("main[data-layout]")).toHaveAttribute(
    "data-layout",
    "compact",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("main[data-layout]")).toHaveAttribute(
    "data-layout",
    "daily",
  );
  await page.getByLabel("当前屏幕布局", { exact: true }).selectOption("mobile");
  await page.reload();
  await expect(page.locator("main[data-layout]")).toHaveAttribute(
    "data-layout",
    "mobile",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("komari-ds:ui:v1")),
  ).toBe(old);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator("main[data-layout]")).toHaveAttribute(
    "data-layout",
    "compact",
  );
});

test("mobile pages and drawer fit the viewport and navigation remains usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await home(page);
  await page.locator('[data-ping-node="demo-005"]').scrollIntoViewIfNeeded();
  await page
    .locator('[data-ping-node="demo-005"]')
    .getByRole("button", { name: "延迟 · 打开监测详情", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "所选时段汇总" }),
  ).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  for (const route of [
    "network?nodes=demo-005,demo-006",
    "compare?nodes=demo-005,demo-006",
    "layouts",
    "globe",
  ]) {
    await page.goto("/" + route);
    await expect(page.locator("main h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("navigation", { name: "手机导航" }),
    ).toBeVisible();
  }
});

test("globe selects real regions, filters offline, rotates by keyboard and has no remote geography requests", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/globe");
  await expect(page.locator("[data-globe-row]")).toHaveCount(10);
  await page.locator('[data-globe-row="demo-005"]').click();
  await expect(page).toHaveURL(/node=demo-005/);
  await expect(page.locator('[data-selected-node="demo-005"]')).toBeVisible();
  const globe = page.getByRole("img", { name: /可拖动旋转的三维地球/ });
  await globe.focus();
  const before = await globe.screenshot();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(80);
  expect(Buffer.compare(before, await globe.screenshot())).not.toBe(0);
  await page.getByRole("button", { name: "仅在线", exact: true }).click();
  await expect(page.locator('[data-region="MY"]')).toHaveCount(0);
  expect(
    requests.filter((url) =>
      /world-atlas|naturalearth|restcountries/i.test(url),
    ),
  ).toEqual([]);
});

test("unsupported network API shows a recoverable error and never fills synthetic metrics", async ({
  page,
}) => {
  await page.routeWebSocket("**/api/rpc2", (ws) =>
    ws.onMessage((message) => {
      const b = JSON.parse(message.toString());
      const result =
        b.method === "common:getNodes"
          ? Object.fromEntries(demoNodes().map((n) => [n.uuid, n]))
          : b.method === "common:getNodesLatestStatus"
            ? demoStatus()
            : b.method === "public:getPublicPingTasks"
              ? demoTasks()
              : null;
      ws.send(
        JSON.stringify(
          result === null
            ? {
                jsonrpc: "2.0",
                id: b.id,
                error: { code: -32601, message: "Metrics unavailable" },
              }
            : { jsonrpc: "2.0", id: b.id, result },
        ),
      );
    }),
  );
  await page.goto("/network?nodes=demo-005,demo-006");
  await expect(page.getByRole("alert")).toContainText("Metrics unavailable");
  await expect(page.getByRole("heading", { name: "所选时段汇总" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "重试", exact: true }),
  ).toBeVisible();
});

test("new pages switch language including controls, errors and region labels", async ({
  page,
}) => {
  await network(page);
  await page.getByRole("button", { name: "切换语言", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Network overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Custom range", exact: true }),
  ).toBeVisible();
  await page.goto("/globe");
  await expect(
    page.getByRole("heading", { name: "Global nodes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "United States", exact: true }),
  ).toHaveCount(1);
});

test("session downgrade removes private comparison history and excludes hidden regions", async ({
  page,
}) => {
  let member = true;
  const queried: string[][] = [];
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        status: "success",
        data: {
          logged_in: member,
          username: member ? "Member" : "Guest",
          uuid: member ? "member-id" : undefined,
        },
      },
    }),
  );
  await page.routeWebSocket("**/api/rpc2", (ws) =>
    ws.onMessage((message) => {
      const b = JSON.parse(message.toString());
      const nodes = demoNodes()
        .filter((n) =>
          member
            ? ["demo-005", "demo-006"].includes(n.uuid)
            : n.uuid === "demo-006",
        )
        .map((n) => ({
          ...n,
          region: n.uuid === "demo-005" ? "🇺🇸" : "unmapped",
        }));
      if (b.method === "public:queryMetrics")
        queried.push(b.params.entity_ids ?? []);
      const result =
        b.method === "common:getNodes"
          ? Object.fromEntries(nodes.map((n) => [n.uuid, n]))
          : b.method === "common:getNodesLatestStatus"
            ? demoStatus()
            : b.method === "public:getPublicPingTasks"
              ? demoTasks()
              : b.method === "public:getPingMetricStats"
                ? demoPingStats(b.params)
                : demoMetrics(b.params);
      ws.send(JSON.stringify({ jsonrpc: "2.0", id: b.id, result }));
    }),
  );
  await network(page);
  member = false;
  await page.getByRole("button", { name: "点击刷新数据", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  expect(await page.locator("main").innerText()).not.toContain(
    "Pacific · Premium",
  );
  queried.length = 0;
  await page.getByRole("button", { name: "刷新网络数据", exact: true }).click();
  await expect.poll(() => queried.length).toBeGreaterThan(0);
  expect(queried.every((ids) => ids.every((id) => id === "demo-006"))).toBe(
    true,
  );
  await page.goto("/globe");
  await expect(page.getByText(/尚未定位/)).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-map-node-count",
    "0",
  );
  expect(await page.locator("main").innerText()).not.toContain(
    "Pacific · Premium",
  );
  const storage = await page.evaluate(() =>
    localStorage.getItem("komari-ds:ui:v2"),
  );
  expect(storage).not.toContain("demo-005");
});
