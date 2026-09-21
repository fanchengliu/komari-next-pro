import { z } from "zod";
export const FX_URL = "https://api.frankfurter.dev/v2/rates?base=CNY";
export const fxSchema = z.object({
  base: z.literal("CNY"),
  provider: z.literal("Frankfurter"),
  fetchedAt: z.string().datetime(),
  rates: z.record(
    z.string().regex(/^[A-Z]{3}$/),
    z.number().positive().finite(),
  ),
  dates: z.record(
    z.string().regex(/^[A-Z]{3}$/),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ),
  stale: z.boolean().default(false),
});
export type ExchangeRates = z.infer<typeof fxSchema>;
export function normalizeExchangeRates(
  raw: unknown,
  now = Date.now(),
): ExchangeRates {
  if (!Array.isArray(raw)) throw Error("Invalid rates response");
  const rates: Record<string, number> = { CNY: 1 },
    dates: Record<string, string> = {};
  for (const row of raw) {
    if (
      !row ||
      row.base !== "CNY" ||
      typeof row.quote !== "string" ||
      !/^[A-Z]{3}$/.test(row.quote) ||
      typeof row.rate !== "number" ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0 ||
      typeof row.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !Number.isFinite(Date.parse(row.date)) ||
      Date.parse(row.date) > now + 86400000
    )
      continue;
    rates[row.quote] = 1 / row.rate;
    dates[row.quote] = row.date;
  }
  rates.CNY = 1;
  if (!rates.USD || !rates.EUR) throw Error("Incomplete rates response");
  return fxSchema.parse({
    base: "CNY",
    provider: "Frankfurter",
    fetchedAt: new Date(now).toISOString(),
    rates,
    dates,
    stale: false,
  });
}
export function currencyCode(value: string) {
  const aliases: Record<string, string> = {
    "¥": "CNY",
    "￥": "CNY",
    人民币: "CNY",
    RMB: "CNY",
    $: "USD",
    US$: "USD",
    "€": "EUR",
    "£": "GBP",
    HK$: "HKD",
    S$: "SGD",
    NT$: "TWD",
    "JP¥": "JPY",
    "₩": "KRW",
  };
  return Object.hasOwn(aliases, value)
    ? aliases[value]
    : value.trim().toUpperCase();
}
export function currencyRate(rates: Record<string, number>, currency: string) {
  const code = currencyCode(currency);
  if (code === "CNY") return 1;
  const value = Object.hasOwn(rates, code)
    ? rates[code]
    : Object.hasOwn(rates, currency)
      ? rates[currency]
      : undefined;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}
