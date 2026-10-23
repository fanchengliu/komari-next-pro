import { test, expect } from "@playwright/test";

test("network scope stays available without an extra card row", async ({
  page,
}) => {
  await page.goto("/");
  const strip = page.locator('[data-ping-node="demo-005"]');
  const latency = strip.getByRole("button", {
    name: "延迟 · 打开监测详情",
    exact: true,
  });
  await expect(latency).toContainText("ms");
  await expect(latency).toHaveAttribute(
    "title",
    /统计范围：1 小时 · 监测任务：6/,
  );
  const description = await latency.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${description}"]`)).toContainText(
    "黑龙江移动线路",
  );
  const box = await strip.boundingBox();
  expect(box!.height).toBeLessThan(50);
  await latency.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "所选时段汇总" }),
  ).toBeVisible();
});

test("layout previews never apply to the wrong device and survive reload", async ({
  page,
}) => {
  await page.goto("/layouts");
  await expect(
    page.locator('[data-preview-device="desktop"] [data-node]'),
  ).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "手机布局", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "紧凑巡检", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "应用到桌面", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "手机", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "日常展示", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "手机布局", exact: true }).click();
  await page.getByRole("button", { name: "应用到手机", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "已应用", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "桌面", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "紧凑巡检", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // Previewing compact must not change the desktop default before Apply.
  await page.getByRole("link", { name: "返回概览", exact: true }).click();
  await expect(page.locator("main[data-layout]")).toHaveAttribute(
    "data-layout",
    "daily",
  );
  await page.goto("/layouts");
  await page.getByRole("button", { name: "紧凑巡检", exact: true }).click();
  await page.getByRole("button", { name: "应用到桌面", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "紧凑巡检", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/");
  await expect(page.locator("main[data-layout]")).toHaveAttribute(
    "data-layout",
    "compact",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("main[data-layout]")).toHaveAttribute(
    "data-layout",
    "mobile",
  );
});

test("layout choices fit desktop and narrow screens in light and dark", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/layouts");
  await expect(
    page.locator("[data-layout-settings] [data-node]").first(),
  ).toBeVisible();
  for (const width of [1440, 1100, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    for (const name of ["桌面", "手机"]) {
      await page.getByRole("button", { name, exact: true }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const button of await page
        .getByRole("group", { name: "布局选择", exact: true })
        .getByRole("button")
        .all()) {
        const box = await button.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        await button.focus();
        await page.keyboard.press("Enter");
        await expect(button).toHaveAttribute("aria-pressed", "true");
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.getByRole("button", { name: "切换明暗", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await page.getByRole("button", { name: "桌面", exact: true }).click();
  await expect(page.locator('[data-preview-device="desktop"]')).toBeVisible();
  expect(errors).toEqual([]);
});
