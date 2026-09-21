import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
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
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
      reducedMotion: "reduce",
    }),
    errors = [];
  await page.addInitScript(() =>
    localStorage.setItem(
      "komari-ds:ui:v2",
      JSON.stringify({
        version: 2,
        state: {
          setupSeen: true,
          preferences: {
            appearance: "dark",
            cardOpacity: 78,
            background: "/media/background-poster.png",
            backgroundKind: "image",
            backgroundSource: "single",
            locale: "zh-CN",
          },
        },
      }),
    ),
  );
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .context()
    .addCookies([
      {
        name: "ds_demo",
        value: "authenticated",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
  await page.goto("http://127.0.0.1:5177");
  await page.locator("[data-node]").first().waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "docs/images/overview.png" });
  await page.goto("http://127.0.0.1:5177/globe");
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "docs/images/globe.png" });
  await page.goto(
    "http://127.0.0.1:5177/network?nodes=demo-005,demo-006&tasks=2,3,4",
  );
  await page
    .getByRole("heading", { name: "所选时段汇总", exact: true })
    .waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "docs/images/network.png", fullPage: true });
  await page.goto("http://127.0.0.1:5177");
  await page.getByRole("button", { name: "主题设置", exact: true }).click();
  await page
    .getByRole("dialog")
    .screenshot({ path: "docs/images/settings.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/images/mobile.png" });
  if (errors.length) throw Error(errors.join("\n"));
  console.log("Captured five actual-build views against local synthetic APIs.");
} finally {
  await browser.close();
}
