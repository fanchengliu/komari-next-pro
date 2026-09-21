export type IPFamily = "ipv4" | "ipv6";
export type ProbeState =
  "success" | "failed" | "not_configured" | "unavailable" | "rate_limited";
export interface IPDiagnostic {
  state: ProbeState;
  reason?: string;
  httpStatus?: number;
  exitCode?: number;
}
export const qualityFlags = [
  "is_datacenter",
  "is_vpn",
  "is_proxy",
  "is_tor",
  "is_abuser",
] as const;
export function abuseFraction(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
  if (
    typeof value !== "string" ||
    !/^\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*(\([^\r\n]*\))?\s*$/.test(value)
  )
    return null;
  return Number.parseFloat(value);
}
export function ipFamilyDiagnostic(
  result: any,
  family: IPFamily,
): IPDiagnostic {
  if (!result || typeof result !== "object")
    return { state: "unavailable", reason: "missing" };
  const record = result?.diagnostics?.[family];
  if (record?.state) return record;
  const data =
    result && ("ipv4" in result || "ipv6" in result)
      ? result[family]
      : result?.ip && String(result.ip).includes(":") === (family === "ipv6")
        ? result
        : null;
  return data?.ip
    ? { state: "success" }
    : { state: "unavailable", reason: "missing" };
}
export function qualityDiagnostic(result: any, family: IPFamily): IPDiagnostic {
  if (result?.quality?.state === "not_configured")
    return { state: "not_configured" };
  const q = result?.quality?.[family];
  if (q?.state) return q;
  if (q?.error) return { state: "failed", reason: "provider" };
  return q &&
    (qualityFlags.some((k) => typeof q[k] === "boolean") ||
      abuseFraction(q.network_abuser_score) !== null)
    ? { state: "success" }
    : { state: "unavailable", reason: "missing" };
}
export function ipResultState(result: unknown): "done" | "partial" | "failed" {
  const families: IPFamily[] = ["ipv4", "ipv6"];
  const good = families.filter(
    (f) => ipFamilyDiagnostic(result, f).state === "success",
  );
  if (!good.length) return "failed";
  return good.length === 2 &&
    good.every((f) => qualityDiagnostic(result, f).state === "success")
    ? "done"
    : "partial";
}
export function probeLabel(record: IPDiagnostic): string {
  if (record.state === "success") return "查询成功";
  if (record.state === "not_configured") return "质量数据源未配置";
  if (record.state === "rate_limited") return "数据源请求限流";
  if (record.state === "unavailable") return "暂无检测数据";
  return (
    (
      {
        dns: "域名解析失败",
        timeout: "查询超时",
        connect: "连接失败",
        tls: "TLS 连接失败",
        http: "数据源响应异常",
        invalid: "返回数据无效",
        auth: "数据源密钥无效",
        provider: "质量数据源暂不可用",
      } as Record<string, string>
    )[record.reason ?? ""] ?? "查询失败"
  );
}
