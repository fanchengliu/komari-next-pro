export interface ReferenceAdjustment {
  reason: string;
  risk: number;
  pollution: number;
  matched?: string;
}
/** An explicit display heuristic, never an IP reputation measurement or a probability. */
export function estimateIPReference(metadata: any, quality: any = {}) {
  const version = "ds-reference-1";
  if (!metadata || typeof metadata.ip !== "string" || !metadata.ip.trim())
    return {
      version,
      completeness: null,
      risk: null,
      pollution: null,
      category: "unknown",
      fields: 0,
      adjustments: [] as ReferenceAdjustment[],
    };
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const org = text(metadata.org) || text(metadata.company?.name);
  const asn = text(metadata.asn) || org.match(/^AS\d+/i)?.[0] || "";
  const fields = [
    metadata.ip,
    metadata.country || metadata.country_code,
    metadata.city,
    metadata.timezone,
    org.replace(/^AS\d+\s*/i, ""),
    asn,
  ].filter((v) => text(v)).length;
  const type = text(quality.type || metadata.network_type).toLowerCase();
  let category = "unknown";
  const adjustments: ReferenceAdjustment[] = [];
  if (
    quality.is_vpn === true ||
    quality.is_proxy === true ||
    quality.is_tor === true ||
    /^(vpn|proxy|tor)$/.test(type)
  ) {
    category = "proxy";
    adjustments.push({
      reason: "数据源返回代理类标记",
      risk: 35,
      pollution: 25,
    });
  } else if (
    quality.is_datacenter === true ||
    /^(hosting|datacenter|data center|cloud)$/.test(type)
  ) {
    category = "hosting";
    adjustments.push({ reason: "数据源返回机房类型", risk: 10, pollution: 5 });
  } else if (/^(isp|mobile|cellular|telecom|residential)$/.test(type)) {
    category = "access";
    adjustments.push({
      reason: "数据源返回接入网络类型",
      risk: -20,
      pollution: -15,
    });
  } else if (quality.is_datacenter !== false) {
    const hosting = org.match(
      /oracle|amazon|aws|azure|microsoft|google|cloud|hosting|datacenter|data center|servers?|vps|ovh|hetzner|dmit|oneman/i,
    );
    const access = org.match(
      /telecom|telekom|broadband|comcast|verizon|vodafone|mobile|softbank/i,
    );
    if (hosting) {
      category = "hosting";
      adjustments.push({
        reason: "组织名称关键字推断机房类型",
        risk: 10,
        pollution: 5,
        matched: hosting[0],
      });
    } else if (access) {
      category = "access";
      adjustments.push({
        reason: "组织名称关键字推断接入类型",
        risk: -20,
        pollution: -15,
        matched: access[0],
      });
    }
  }
  if (quality.is_abuser === true)
    adjustments.push({ reason: "数据源返回滥用标记", risk: 15, pollution: 20 });
  else if (quality.is_abuser === false)
    adjustments.push({ reason: "数据源未标记滥用", risk: -10, pollution: -10 });
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return {
    version,
    fields,
    completeness: Math.round((fields / 6) * 100),
    category,
    adjustments,
    risk: clamp(50 + adjustments.reduce((n, a) => n + a.risk, 0)),
    pollution: clamp(50 + adjustments.reduce((n, a) => n + a.pollution, 0)),
  };
}
