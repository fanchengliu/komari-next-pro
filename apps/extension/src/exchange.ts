import {
  FX_URL,
  fxSchema,
  normalizeExchangeRates,
  type ExchangeRates,
} from "../../../packages/contracts/exchange";
export interface RateStorage {
  get: () => unknown;
  set: (value: ExchangeRates) => void;
}
export function createExchangeService(
  storage: RateStorage,
  request: typeof fetch = fetch,
  clock = Date.now,
) {
  const initial = fxSchema.safeParse(storage.get());
  let cached = initial.success ? initial.data : null,
    pending: Promise<ExchangeRates> | null = null,
    lastAttempt = -Infinity,
    failed = false;
  async function refresh() {
    lastAttempt = clock();
    try {
      const response = await request(FX_URL, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!response.ok) throw Error("Rate provider unavailable");
      const text = await response.text();
      if (text.length > 262144) throw Error("Rate response too large");
      const next = normalizeExchangeRates(JSON.parse(text), clock());
      storage.set(next);
      cached = next;
      failed = false;
      return next;
    } catch (error) {
      failed = true;
      if (cached) return { ...cached, stale: true };
      throw error;
    }
  }
  return {
    async get(force = false) {
      const age = cached ? clock() - Date.parse(cached.fetchedAt) : Infinity;
      if (cached && age >= 0 && age < 3600000 && !force && !failed)
        return cached;
      if (pending) return pending;
      if (clock() - lastAttempt < 60000) {
        if (cached) return { ...cached, stale: failed || age >= 3600000 };
        throw Error("Rate provider cooling down");
      }
      pending = refresh();
      try {
        return await pending;
      } finally {
        pending = null;
      }
    },
  };
}
