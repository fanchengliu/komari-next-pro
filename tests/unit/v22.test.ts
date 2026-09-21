import { describe, it, expect } from "vitest";
import {
  normalizeExchangeRates,
  currencyRate,
  currencyCode,
  type ExchangeRates,
} from "../../packages/contracts/exchange";
import { createExchangeService } from "../../apps/extension/src/exchange";
import { selectHomeNetwork } from "../../apps/theme/src/domain/home-network";
import {
  combineSummary,
  type NetworkLine,
  type PingTask,
} from "../../apps/theme/src/domain/network";
import {
  defaultSettings,
  resolveThemeSettings,
} from "../../packages/contracts";
import { presetConfiguration } from "../../apps/theme/src/features/setup/presets";
import { translate } from "../../apps/theme/src/data/i18n";
const now = Date.parse("2026-09-21T00:00:00Z");
const raw = [
  { base: "CNY", quote: "USD", date: "2026-09-18", rate: 0.125 },
  { base: "CNY", quote: "EUR", date: "2026-09-18", rate: 0.1 },
];
describe("automatic exchange rates", () => {
  it("inverts the CNY base once and retains publication dates without using configured guesses", () => {
    const data = normalizeExchangeRates(raw, now);
    expect(data.rates.USD).toBe(8);
    expect(data.rates.EUR).toBe(10);
    expect(data.rates.CNY).toBe(1);
    expect(data.dates.USD).toBe("2026-09-18");
    expect(currencyRate(data.rates, "$")).toBe(8);
    expect(currencyRate(data.rates, "€")).toBe(10);
    expect(currencyRate(data.rates, "JPY")).toBeUndefined();
    expect(currencyRate(data.rates, "constructor")).toBeUndefined();
    expect(currencyCode("__proto__")).toBe("__PROTO__");
    expect(() =>
      normalizeExchangeRates([{ ...raw[0], rate: 0 }], now),
    ).toThrow();
  });
  it("deduplicates concurrent fetches, persists the result and respects cache/cooldown", async () => {
    let saved: ExchangeRates | null = null,
      calls = 0,
      t = now;
    const service = createExchangeService(
      {
        get: () => saved,
        set: (v) => {
          saved = v;
        },
      },
      async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return new Response(JSON.stringify(raw));
      },
      () => t,
    );
    const [a, b] = await Promise.all([service.get(), service.get()]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
    expect(saved).toEqual(a);
    await service.get();
    expect(calls).toBe(1);
    await service.get(true);
    expect(calls).toBe(1);
    t += 61000;
    await service.get(true);
    expect(calls).toBe(2);
  });
  it("keeps and labels the last successful snapshot when refresh fails, and recovers without fabricated rates", async () => {
    let saved = normalizeExchangeRates(raw, now),
      t = now + 3600001,
      fail = true;
    const service = createExchangeService(
      {
        get: () => saved,
        set: (v) => {
          saved = v;
        },
      },
      async () => {
        if (fail) throw Error("offline");
        return new Response(
          JSON.stringify(raw.map((r) => ({ ...r, rate: r.rate * 2 }))),
        );
      },
      () => t,
    );
    expect((await service.get()).stale).toBe(true);
    expect((await service.get()).stale).toBe(true);
    expect(saved.rates.USD).toBe(8);
    fail = false;
    t += 61000;
    expect((await service.get()).rates.USD).toBe(4);
    expect((await service.get()).stale).toBe(false);
    const cold = createExchangeService(
      { get: () => null, set: () => {} },
      async () => {
        throw Error("offline");
      },
      () => t,
    );
    await expect(cold.get()).rejects.toThrow();
  });
});
describe("explicit homepage probe scope", () => {
  const tasks: PingTask[] = [
    {
      id: "1",
      name: "海外线路",
      type: "icmp",
      clients: ["a"],
      interval: 180,
      weight: 0,
    },
    {
      id: "2",
      name: "移动线路",
      type: "tcp",
      clients: ["a"],
      interval: 60,
      weight: 1,
    },
  ];
  const lines = tasks.map(
    (task, i) =>
      ({
        id: "a-" + task.id,
        nodeId: "a",
        taskId: task.id,
        name: task.name,
        latency: [
          {
            time: now,
            value: i ? 180 : 1,
            count: 20,
            interval: 60000,
            estimated: false,
          },
        ],
        loss: [
          { time: now, value: 0, count: 20, interval: 60000, estimated: false },
        ],
        interval: 60000,
        summary: {
          average: i ? 180 : 1,
          p95: i ? 180 : 1,
          min: i ? 180 : 1,
          max: i ? 180 : 1,
          loss: 0,
          total: 20,
          valid: 20,
          estimated: false,
          coverageStart: now,
          coverageEnd: now + 1000,
        },
      }) as NetworkLine,
  );
  it("uses TCP in automatic mode even when old hidden multiselect preferences contain only the 1ms ICMP task", () => {
    const selection = selectHomeNetwork(lines, "a", tasks, "auto", ["1"]);
    expect(selection.taskIds).toEqual(["2"]);
    expect(combineSummary(selection.lines).average).toBe(180);
    const explicit = selectHomeNetwork(lines, "a", tasks, "custom", ["1"]);
    expect(combineSummary(explicit.lines).average).toBe(1);
    expect(explicit.names).toEqual(["海外线路"]);
  });
  it("does not invent a value or silently widen an empty or unavailable custom selection", () => {
    expect(
      combineSummary(selectHomeNetwork(lines, "a", tasks, "custom", []).lines)
        .average,
    ).toBeNull();
    expect(selectHomeNetwork(lines, "private", tasks, "all", []).lines).toEqual(
      [],
    );
    expect(
      selectHomeNetwork(lines, "a", tasks, "custom", ["deleted"]).taskIds,
    ).toEqual([]);
    expect(
      selectHomeNetwork(
        lines,
        "a",
        tasks.map((t) => ({ ...t, type: "icmp" })),
        "auto",
        [],
      ).taskIds,
    ).toEqual(["1", "2"]);
  });
});
it("provides full presets while keeping language/timezone and ignoring unsupported branding configuration", () => {
  const current = {
    ...defaultSettings,
    locale: "ja" as const,
    timezone: "Asia/Tokyo",
  };
  for (const id of ["glass", "inspection", "night"] as const) {
    const config = presetConfiguration(id, current, "/themes/komari-ds/dist/");
    expect(config.locale).toBe("ja");
    expect(config.timezone).toBe("Asia/Tokyo");
    expect(config.pingMode).toBe("auto");
    expect(config.fields.length).toBeGreaterThan(0);
  }
  expect(presetConfiguration("inspection", current, "/").backgroundSource).toBe(
    "none",
  );
  expect(presetConfiguration("glass", current, "/").background).toBe(
    "/media/background.mp4",
  );
  expect(
    resolveThemeSettings({ footer: "replace branding" }),
  ).not.toHaveProperty("footer");
});
it("renders five languages and localizes dynamic day counts", () => {
  expect(translate("关闭", "zh-TW")).toBe("關閉");
  expect(translate("关闭", "en")).toBe("Close");
  expect(translate("关闭", "ja")).toBe("閉じる");
  expect(translate("关闭", "ko")).toBe("닫기");
  expect(translate("93天", "ja")).toBe("93日");
  expect(translate("首次设置", "ko")).toBe("초기 설정");
  expect(translate("自动汇率", "ja")).toBe("自動為替レート");
});

it("rejects credential-bearing or backslash media URLs before they can enter public configuration", async () => {
  const { validatedMediaUrl, mediaItemSchema } =
    await import("../../packages/contracts");
  for (const url of [
    "https://user:password@example.com/private.jpg",
    "/\\example.com/file.png",
    "https://example.com/\nfile.png",
    "//example.com/file.png",
  ])
    expect(validatedMediaUrl(url)).toBeUndefined();
  expect(validatedMediaUrl("/media/background.mp4")).toBe(
    "/media/background.mp4",
  );
  expect(
    mediaItemSchema.safeParse({
      id: "a",
      url: "https://user:secret@example.com/a.png",
      kind: "image",
    }).success,
  ).toBe(false);
});
