import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  API,
  type ExtensionCapabilities,
} from "../../../../packages/contracts";
import {
  FX_URL,
  fxSchema,
  normalizeExchangeRates,
  type ExchangeRates,
} from "../../../../packages/contracts/exchange";
import { json } from "./rpc";
const cacheKey = "komari-ds:exchange:v1";
function readCache() {
  try {
    const result = fxSchema.safeParse(
      JSON.parse(localStorage.getItem(cacheKey) ?? "null"),
    );
    return result.success ? { ...result.data, stale: true } : undefined;
  } catch {
    return undefined;
  }
}
export function useExchangeRates(
  extension: ExtensionCapabilities | undefined,
  ready: boolean,
) {
  const force = useRef(false);
  const query = useQuery({
    queryKey: ["public", "exchange-rates", !!extension?.exchangeRates],
    enabled: ready,
    queryFn: async ({ signal }) => {
      const fresh = force.current;
      force.current = false;
      let value: ExchangeRates;
      if (extension?.exchangeRates)
        value = fxSchema.parse(
          await json(API + "/exchange-rates" + (fresh ? "?fresh=1" : ""), {
            signal,
          }),
        );
      else {
        const r = await fetch(FX_URL, {
          signal,
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (!r.ok) throw Error("汇率服务暂不可用");
        value = normalizeExchangeRates(await r.json());
      }
      try {
        localStorage.setItem(cacheKey, JSON.stringify(value));
      } catch {}
      return value;
    },
    initialData: readCache,
    initialDataUpdatedAt: 0,
    staleTime: 3600000,
    refetchInterval: 3600000,
    retry: 1,
  });
  return {
    data: query.data
      ? {
          ...query.data,
          stale:
            query.data.stale ||
            !!query.error ||
            Date.now() - Date.parse(query.data.fetchedAt) > 6 * 3600000,
        }
      : undefined,
    error: query.error,
    loading: query.isFetching,
    refresh: () => {
      force.current = true;
      return query.refetch();
    },
    rates: query.data?.rates ?? { CNY: 1 },
  };
}
