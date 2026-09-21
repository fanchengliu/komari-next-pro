import { defineConfig } from "@playwright/test";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    locale: "zh-CN",
    timezoneId: "Asia/Hong_Kong",
    reducedMotion: "reduce",
    launchOptions: {
      executablePath:
        process.env.DS_BROWSER ??
        (process.platform === "win32"
          ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
          : undefined),
      args: ["--proxy-server=direct://"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `${npmCommand} run demo`,
      url: "http://127.0.0.1:5174/api/me",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `${npmCommand} run dev`,
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
