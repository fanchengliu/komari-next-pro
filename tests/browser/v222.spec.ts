import { test, expect } from "@playwright/test";
test("card transparency persists, keeps text opaque, and restores original appearance defaults", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  const slider = page.getByRole("slider", { name: "卡片透明度", exact: true });
  await slider.fill("65");
  await expect(slider).toHaveValue("65");
  await page.keyboard.press("Escape");
  const card = page.locator("[data-node]").first();
  expect(
    await card.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toMatch(/0\.35\)/);
  expect(await card.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  await page.reload();
  await expect(card).toBeVisible();
  expect(
    await card.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toMatch(/0\.35\)/);
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  await page
    .getByRole("button", { name: "恢复默认透明度", exact: true })
    .click();
  await expect(slider).toHaveValue("26");
  await page.getByLabel("外观", { exact: true }).selectOption("dark");
  await expect(slider).toHaveValue("22");
  await page.keyboard.press("Escape");
  expect(
    await card.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toMatch(/0\.78\)/);
});
test("admin link and toolbar buttons share hover feedback while native admin navigation remains intact", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "ds_demo", value: "authenticated", domain: "127.0.0.1", path: "/" },
  ]);
  await page.goto("/");
  const admin = page.getByRole("link", { name: "管理后台", exact: true });
  const before = await admin.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  await admin.hover();
  const hover = await admin.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  expect(hover).not.toBe(before);
  const button = page.getByRole("button", { name: "资产计算器", exact: true });
  await button.hover();
  expect(
    await button.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe(hover);
  await expect(admin).toHaveAttribute("title", "管理后台");
  await expect(admin).toHaveAttribute("href", "/admin");
  await admin.focus();
  expect(await admin.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    hover,
  );
});
test("cached IP metadata produces labeled no-key estimates; provider results remain separate", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "ds_demo", value: "authenticated", domain: "127.0.0.1", path: "/" },
  ]);
  await page.route("**/komari-ds-api/v1/jobs/latest?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("kind") !== "ip")
      return route.continue();
    await route.fulfill({
      json: {
        id: "reference-fixture",
        nodeId: "demo-008",
        kind: "ip",
        state: "partial",
        updatedAt: new Date().toISOString(),
        result: {
          ipv4: {
            ip: "192.0.2.8",
            country: "US",
            city: "Newark",
            timezone: "America/New_York",
            org: "AS64500 Example Cloud",
          },
          ipv6: null,
          provider: "Fixture",
          quality: { state: "not_configured" },
        },
      },
    });
  });
  let writes = 0;
  page.on("request", (r) => {
    if (r.url().includes("/jobs") && r.method() === "POST") writes++;
  });
  await page.goto("/instance/demo-008");
  await page.getByRole("button", { name: "IP信息", exact: true }).click();
  await expect(page.locator("[data-reference-score] strong")).toHaveText([
    "100",
    "60",
    "55",
  ]);
  await expect(
    page.getByText("免 Key 规则估算，不是实际信誉检测或风险概率。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByText("查看估算依据", { exact: true }).click();
  await expect(page.getByText(/组织名称关键字推断机房类型/)).toBeVisible();
  await page.getByRole("button", { name: "数据源指标", exact: true }).click();
  await expect(page.locator("[data-quality-state]")).toHaveText(
    "质量数据源未配置",
  );
  await page.reload();
  await expect(page.locator("[data-quality-state]")).toBeVisible();
  expect(writes).toBe(0);
});
