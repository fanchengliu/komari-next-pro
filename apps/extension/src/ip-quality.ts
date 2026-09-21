import { isIP } from "node:net";
import {
  abuseFraction,
  qualityFlags,
} from "../../../packages/contracts/ip-result";
export async function enrichQuality(
  metadata: { ipv4: any; ipv6: any; quality: unknown; provider: string },
  apiKey?: string,
  request: typeof fetch = fetch,
) {
  if (!apiKey) return { ...metadata, quality: { state: "not_configured" } };
  const quality: Record<string, unknown> = {
    provider: "ipapi.is",
    at: new Date().toISOString(),
  };
  for (const family of ["ipv4", "ipv6"] as const) {
    const ip = metadata[family]?.ip;
    if (typeof ip !== "string" || !isIP(ip)) {
      quality[family] = { state: "unavailable" };
      continue;
    }
    try {
      const response = await request("https://api.ipapi.is", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: ip, key: apiKey }),
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!response.ok) {
        quality[family] = {
          state: response.status === 429 ? "rate_limited" : "failed",
          reason: [401, 403].includes(response.status) ? "auth" : "provider",
          httpStatus: response.status,
          error: `Provider HTTP ${response.status}`,
        };
        continue;
      }
      const raw = await response.text();
      if (raw.length > 262144) throw new Error("Provider response too large");
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || data.error || data.error_code)
        throw new Error("Invalid quality response");
      const flags = Object.fromEntries(
        qualityFlags
          .filter((k) => typeof data[k] === "boolean")
          .map((k) => [k, data[k]]),
      );
      const fraction = abuseFraction(data.company?.abuser_score);
      // Copy only known public result fields; never persist request credentials or provider echoes.
      quality[family] = {
        ...flags,
        state:
          Object.keys(flags).length || fraction !== null
            ? "success"
            : "unavailable",
        network_abuser_score: fraction,
        type:
          typeof data.company?.type === "string"
            ? data.company.type.slice(0, 80)
            : null,
      };
    } catch {
      quality[family] = {
        state: "failed",
        reason: "provider",
        error: "Quality provider unavailable",
      };
    }
  }
  return { ...metadata, quality };
}
