import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
const origin = process.env.DOCS_ORIGIN || "http://127.0.0.1:5178";
const browser = await chromium.launch({
  headless: true,
  ...(process.platform === "win32"
    ? {
        executablePath:
          process.env.DS_BROWSER ||
          "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      }
    : {}),
});
const checks = [],
  errors = [];
try {
  await mkdir(".local/docs-check", { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/guide/getting-started",
    "/guide/appearance",
    "/guide/network",
    "/guide/globe",
    "/guide/reports",
    "/guide/extension",
    "/guide/faq",
    "/development",
    "/community",
    "/en/",
    "/en/getting-started",
    "/en/features",
    "/en/extension",
    "/en/faq",
    "/en/community",
  ]) {
    const r = await page.goto(origin + path);
    await page.waitForLoadState("networkidle");
    if (r.status() !== 200 || (await page.locator("h1").count()) !== 1)
      throw Error("Page failed " + path);
    await page.locator("img").evaluateAll(async images=>{await Promise.all(images.map(image=>{image.loading="eager";return image.decode().catch(()=>{});}));});
    const broken = await page
      .locator("img")
      .evaluateAll((imgs) =>
        imgs
          .filter((i) => !i.complete || i.naturalWidth === 0)
          .map((i) => i.src),
      );
    if (broken.length)
      throw Error("Broken image " + path + ": " + broken.join(","));
    checks.push(path);
  }
  await page.goto(origin);
  await page.getByRole("button", { name: "搜索文档", exact: true }).click();
  const search = page.locator(".VPLocalSearchBox input");
  await search.fill("卡片透明度");
  await page.locator('.VPLocalSearchBox a[href^="/guide/appearance"]').first().waitFor();
  await page.locator('.VPLocalSearchBox a[href^="/guide/appearance"]').first().click();
  await page.waitForURL(/appearance/);
  checks.push("Local search navigates to card transparency");
  await page.goto(origin);
  await page.locator(".VPSwitchAppearance:visible").click();
  if (
    !(await page.locator("html").evaluate((e) => e.classList.contains("dark")))
  )
    throw Error("Theme switch failed");
  await page.reload();
  if (
    !(await page.locator("html").evaluate((e) => e.classList.contains("dark")))
  )
    throw Error("Theme preference lost");
  await page.locator(".VPSwitchAppearance:visible").click();
  checks.push("Appearance switch persists");
  await page.screenshot({ path: ".local/docs-check/home.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin);
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    )
  )
    throw Error("Mobile overflow");
  await page.screenshot({
    path: ".local/docs-check/mobile.png",
    fullPage: true,
  });
  checks.push("Mobile homepage fits");
  await page.goto(origin + "/guide/getting-started");
  await page.getByRole("button", { name: "目录", exact: true }).click();
  await page
    .getByRole("link", { name: "常见问题", exact: true })
    .first()
    .click();
  await page.waitForURL(/faq/);
  checks.push("Mobile document sidebar navigation");
  if (errors.length) throw Error(errors.join("\n"));
  await writeFile(
    ".local/docs-verification.json",
    JSON.stringify(
      { at: new Date().toISOString(), origin, checks, pageErrors: errors },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      pages: 16,
      interactionChecks: checks.length - 16,
      pageErrors: errors,
    }),
  );
} finally {
  await browser.close();
}
