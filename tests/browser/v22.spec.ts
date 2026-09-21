import { test, expect, type Page } from "@playwright/test";
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
async function site(page: Page) {
  return (await (await page.request.get("/api/public")).json()).data;
}
async function save(page: Page, settings: unknown) {
  const r = await page.request.post(
    "/api/admin/theme/settings?theme=komari-ds",
    { data: settings },
  );
  expect(r.ok()).toBe(true);
}

test("home globe is a modal; flag-only markers select the exact node and retain the homepage URL", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("[data-overview-cards]")
    .getByRole("button", { name: /点亮地区/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[data-map-node="demo-001"]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await dialog.locator('[data-map-node="demo-001"]').click();
  await expect(dialog.locator('[data-globe-row="demo-001"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.locator('[data-globe-row="demo-005"]').click();
  await expect(dialog.locator('[data-map-node="demo-006"]')).toBeVisible();
  await dialog.locator('[data-map-node="demo-006"]').click();
  await expect(dialog.locator('[data-selected-node="demo-006"]')).toContainText(
    "Pacific · Value",
  );
  await expect(dialog.locator('[data-globe-row="demo-006"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await dialog.locator('[data-map-node="demo-006"]').textContent()).toBe(
    "",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("article[data-node]")).toHaveCount(10);
});

test("all overview cards use usable tool dialogs and clock timezone changes persist", async ({
  page,
}) => {
  await login(page);
  await page
    .locator("[data-overview-cards]")
    .getByRole("button", { name: /当前时间/ })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("显示时区", { exact: true })
    .selectOption("UTC");
  await page.keyboard.press("Escape");
  for (const name of ["当前在线", "流量概览", "网络速率", "资产统计"]) {
    await page
      .locator("[data-overview-cards]")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await expect(page.getByRole("dialog").getByRole("table")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.reload();
  await page
    .locator("[data-overview-cards]")
    .getByRole("button", { name: /当前时间/ })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("显示时区", { exact: true }),
  ).toHaveValue("UTC");
});

test("legacy hidden task selection cannot make automatic home summaries show only the nearby ICMP result", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "komari-ds:ui:v2",
      JSON.stringify({
        version: 2,
        state: { preferences: { pingTaskIds: ["1"] }, view: "grid" },
      }),
    ),
  );
  await page.goto("/");
  const card = page.locator('[data-ping-node="demo-005"]');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText("TCP");
  await expect(
    card.getByRole("button", { name: "延迟 · 打开监测详情", exact: true }),
  ).not.toContainText("1 ms");
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("tab", { name: "布局与网络", exact: true })
    .click();
  await page.getByRole("button", { name: "自定义任务", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(card).toContainText("海外线路");
  await card
    .getByRole("button", { name: "延迟 · 打开监测详情", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "所选时段汇总" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", { name: "海外线路", exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "黑龙江移动线路", exact: true }),
  ).not.toBeChecked();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "点击刷新数据", exact: true }).click();
  await expect(card).toContainText("海外线路");
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  await page.getByRole("tab", { name: "布局与网络", exact: true }).click();
  await page
    .getByRole("button", { name: "恢复首页默认线路", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(card).toContainText("TCP");
});

test("IP and network values are centered, card hints are not repeated, IPv6-only data and zero abuse ratio render correctly", async ({
  page,
}) => {
  await login(page);
  await page.route("**/komari-ds-api/v1/jobs/latest?*", async (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get("kind") === "unlock") {
      return route.fulfill({
        json: {
          id: "stream-fixture",
          nodeId: "demo-005",
          kind: "unlock",
          state: "done",
          updatedAt: new Date().toISOString(),
          result: {
            services: [
              {
                name: "Netflix",
                family: "IPv4",
                httpStatus: 200,
                status: "可访问（解锁待确认）",
              },
              {
                name: "Netflix",
                family: "IPv6",
                httpStatus: 0,
                status: "连接失败",
              },
            ],
          },
        },
      });
    }
    if (u.searchParams.get("kind") !== "ip") return route.continue();
    await route.fulfill({
      json: {
        id: "v6-fixture",
        nodeId: "demo-005",
        kind: "ip",
        state: "done",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        result: {
          provider: "Fixture",
          ipv4: null,
          ipv6: {
            ip: "2001:db8::5",
            country: "JP",
            city: "Tokyo",
            timezone: "Asia/Tokyo",
            org: "AS64500 Fixture",
          },
          quality: {
            provider: "Fixture",
            ipv6: {
              network_abuser_score: 0,
              is_vpn: false,
              is_proxy: false,
              type: "hosting",
            },
          },
        },
      },
    });
  });
  await page.goto("/instance/demo-005");
  await expect(
    page.getByText("点击展开历史与详情", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("点击指标卡片展开完整详情", { exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "IP信息", exact: true }).click();
  await expect(page.getByText("Tokyo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "数据源指标", exact: true }).click();
  for (const name of ["IPv4 地址", "IPv6 地址"]) {
    const value = page
      .getByRole("heading", { name, exact: true })
      .locator("..")
      .locator(":scope > strong");
    expect(await value.evaluate((e) => getComputedStyle(e).textAlign)).toBe(
      "center",
    );
  }
  await expect(
    page.getByText("仅展示有来源的质量指标", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.locator("[data-abuse-fraction] strong").allTextContents(),
  ).toEqual(["0%"]);
  await expect(page.locator('[class*="_service_"]')).toHaveCount(16);
  await expect(
    page.locator('[class*="_service_"]').getByText("无数据", { exact: true }),
  ).toHaveCount(14);
  await expect(page.getByText("HTTP 200", { exact: true })).toBeVisible();
  await expect(page.getByText("HTTP 0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "网络质量", exact: true }).click();
  await expect(
    page.getByText("P95 延迟", { exact: true }).first(),
  ).toBeVisible();
  expect(
    await page
      .locator('[class*="_kpi_"] > strong')
      .evaluateAll((elements) =>
        elements.every((e) => getComputedStyle(e).textAlign === "center"),
      ),
  ).toBe(true);
});

test("first-use setup previews full presets, saves site settings atomically, and does not prompt another browser again", async ({
  page,
  browser,
}) => {
  await login(page);
  const original = (await site(page)).theme_settings;
  try {
    await save(page, { ...original, setupCompleted: false });
    await page.reload();
    let dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: /简洁巡检/ }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: /简洁巡检/ }).click();
    expect((await site(page)).theme_settings.desktopLayout).toBe(
      original.desktopLayout,
    );
    await dialog
      .getByRole("button", { name: "5 确认配置", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "保存为站点配置并开始", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("main[data-layout]")).toHaveAttribute(
      "data-layout",
      "compact",
    );
    await expect(page.locator("[data-phase]")).toHaveAttribute(
      "data-empty",
      "true",
    );
    expect(
      await page
        .locator("[data-phase]")
        .evaluate((e) => getComputedStyle(e).backgroundImage),
    ).toBe("none");
    const saved = (await site(page)).theme_settings;
    expect(saved.setupCompleted).toBe(true);
    expect(saved.backgroundSource).toBe("none");
    const context = await browser.newContext();
    await context.addCookies(await page.context().cookies());
    const other = await context.newPage();
    await other.goto("http://127.0.0.1:5173");
    await expect(other.locator("main[data-layout]")).toHaveAttribute(
      "data-layout",
      "compact",
    );
    await expect(other.getByRole("dialog")).toHaveCount(0);
    await context.close();
    await page.getByRole("button", { name: "背景设置", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "加入默认背景", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "保存播放列表", exact: true })
      .click();
    await expect(dialog.getByRole("status")).toHaveText("播放列表已保存");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-phase] video")).toBeVisible();
    expect((await site(page)).theme_settings.backgroundSource).toBe("playlist");
  } finally {
    await save(page, original);
  }
});

test("cancelling setup leaves site settings untouched and brand config cannot replace the footer", async ({
  page,
}) => {
  await login(page);
  const original = (await site(page)).theme_settings;
  await page.route("**/api/public", async (route) => {
    const r = await route.fetch(),
      b = await r.json();
    b.data.theme_settings = {
      ...b.data.theme_settings,
      footer: "FORGED BRAND",
      brand: { name: "FORGED BRAND" },
    };
    await route.fulfill({ json: b });
  });
  await page.reload();
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  await page.getByRole("button", { name: "重新配置主题", exact: true }).click();
  await page.getByRole("button", { name: /深色聚焦/ }).click();
  await page.getByRole("button", { name: "稍后设置", exact: true }).click();
  expect((await site(page)).theme_settings).toEqual(original);
  await expect(page.locator("footer")).toHaveText(
    "Komari Next Pro · Powered by Komari Monitor.",
  );
  const repositoryLink = page
    .locator("footer")
    .getByRole("link", { name: "Komari Next Pro GitHub", exact: true });
  await expect(repositoryLink).toHaveAttribute(
    "href",
    "https://github.com/fanchengliu/komari-next-pro",
  );
  await expect(repositoryLink).toHaveAttribute("target", "_blank");
  await expect(repositoryLink).toHaveAttribute("rel", /noopener/);
  expect(
    await page
      .locator("footer")
      .evaluate((e) => getComputedStyle(e).backdropFilter),
  ).toContain("blur");
});

test("five languages work through the menu and survive reload without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const [code, name] of [
    ["zh-TW", "繁體中文"],
    ["en", "English"],
    ["ja", "日本語"],
    ["ko", "한국어"],
    ["zh-CN", "简体中文"],
  ]) {
    await page.locator("[data-language-menu]").click();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", code);
    await expect(page.locator("article[data-node]")).toHaveCount(10);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("automatic rates override old manual numbers, show source dates and retain cached values on failure", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "komari-ds:ui:v2",
      JSON.stringify({
        version: 2,
        state: {
          view: "grid",
          preferences: { exchangeRates: { USD: 99999, $: 99999 } },
        },
      }),
    ),
  );
  await login(page);
  await page.getByRole("button", { name: "资产计算器", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "资产估值", exact: true }),
  ).toContainText("2155.68");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Frankfurter", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  await page.getByRole("tab", { name: "地区与资产", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("spinbutton")).toHaveCount(0);
  await expect(page.getByText("7.2000 CNY", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() =>
    localStorage.setItem(
      "komari-ds:exchange:v1",
      JSON.stringify({
        base: "CNY",
        provider: "Frankfurter",
        fetchedAt: new Date(Date.now() - 7200000).toISOString(),
        rates: { CNY: 1, USD: 8, EUR: 10 },
        dates: { USD: "2026-09-18", EUR: "2026-09-18" },
        stale: true,
      }),
    ),
  );
  await page.route("**/komari-ds-api/v1/exchange-rates*", (r) =>
    r.fulfill({ status: 503, json: { error: "Provider unavailable" } }),
  );
  await page.reload();
  await page.getByRole("button", { name: "资产计算器", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "资产估值", exact: true }),
  ).toContainText("2395.20");
  await expect(page.getByText(/使用上次缓存/)).toBeVisible();
});

test("switching nodes does not reuse the previous node task id or results", async ({
  page,
}) => {
  await login(page);
  await page.goto("/instance/demo-001?tab=services");
  await page.getByRole("button", { name: "刷新状态", exact: true }).click();
  await expect(page.getByText(/隔离测试快照 demo-001/)).toBeVisible();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/jobs/")) requests.push(r.url());
  });
  await page.evaluate(() => {
    history.pushState({}, "", "/instance/demo-006?tab=services");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", { name: "Pacific · Value", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/隔离测试快照 demo-001/)).toHaveCount(0);
  await expect
    .poll(() => requests.some((url) => url.includes("latest?node=demo-006")))
    .toBe(true);
});
