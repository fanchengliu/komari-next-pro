import { useState } from "react";
import {
  Wifi,
  Radar,
  Building2,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { useTranslate } from "../data/i18n";
import { useModel } from "../data/context";
import { regionName, regionCode } from "../domain/regions";
import T from "../ui/tools.module.css";
import P from "../ui/probes.module.css";
import { IPReference } from "./IPReference";
import { useUI } from "../data/store";
import {
  abuseFraction,
  ipFamilyDiagnostic,
  qualityDiagnostic,
  probeLabel,
} from "../../../../packages/contracts/ip-result";
const printable = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : typeof value === "string" && value
      ? value
      : "--";
export function Metadata({
  result,
  guest = false,
  region,
  at,
}: {
  result?: unknown;
  guest?: boolean;
  region: string;
  at?: string;
}) {
  const t = useTranslate(),
    { settings } = useModel();
  const data = result as any;
  const isSplit = !!data && ("ipv4" in data || "ipv6" in data);
  const v4 = isSplit
      ? data.ipv4
      : data?.ip && !String(data.ip).includes(":")
        ? data
        : null,
    v6 = isSplit
      ? data.ipv6
      : data?.ip && String(data.ip).includes(":")
        ? data
        : null;
  const [preferred, setPreferred] = useState<"ipv4" | "ipv6">("ipv4");
  const family = preferred === "ipv4" && v4 ? "ipv4" : v6 ? "ipv6" : "ipv4",
    main = (family === "ipv4" ? v4 : v6) ?? {};
  const quality = data?.quality?.[family] ?? {};
  const orgValue = main.org ?? main.company?.name ?? main.company;
  const org = typeof orgValue === "string" ? orgValue : "";
  const country =
    typeof main.country === "string" ? main.country : main.country_code;
  const code = regionCode(country ?? "");
  const source = [data?.provider, data?.quality?.provider]
    .filter((v): v is string => typeof v === "string" && !!v)
    .join(" + ");
  const fraction = abuseFraction(quality.network_abuser_score);
  const qualityStatus = qualityDiagnostic(result, family);
  function rows(items: [string, unknown][]) {
    return items.map(([label, value]) => (
      <div className={P.row} key={label}>
        <span>{t(label)}</span>
        <strong>{printable(value)}</strong>
      </div>
    ));
  }
  return (
    <div className={P.metadata}>
      {!guest && !!result && (
        <div className={P.diagnostics} data-ip-diagnostics>
          {(["ipv4", "ipv6"] as const).map((id) => {
            const status = ipFamilyDiagnostic(result, id);
            return (
              <span key={id} data-state={status.state}>
                {id === "ipv4" ? "IPv4" : "IPv6"} · {t(probeLabel(status))}
                {status.httpStatus ? ` (HTTP ${status.httpStatus})` : ""}
              </span>
            );
          })}
        </div>
      )}
      <section className={P.panel}>
        <h3>
          <Wifi size={16} />
          {t("基础信息")}
        </h3>
        {!guest && v4 && v6 && (
          <div className={T.segments} style={{ marginBottom: 9 }}>
            {(["ipv4", "ipv6"] as const).map((id) => (
              <button
                key={id}
                aria-pressed={family === id}
                onClick={() => setPreferred(id)}
              >
                {id === "ipv4" ? "IPv4" : "IPv6"}
              </button>
            ))}
          </div>
        )}
        {rows([
          [
            "国家 / 地区",
            guest
              ? regionName(regionCode(region) ?? region, settings.locale)
              : code
                ? regionName(code, settings.locale)
                : country,
          ],
          ["城市", guest ? "--" : main.city],
          [
            "IP 版本",
            guest
              ? "--"
              : main.ip
                ? family === "ipv4"
                  ? "IPv4"
                  : "IPv6"
                : "--",
          ],
          ["国家代码", guest ? regionCode(region) : code],
          ["时区", guest ? "--" : main.timezone],
          [
            "显示目标",
            guest
              ? "--"
              : main.ip
                ? family === "ipv4"
                  ? "IPv4"
                  : "IPv6"
                : "--",
          ],
          ["数据来源", guest ? "--" : source],
          [
            "检测时间",
            at
              ? new Date(at).toLocaleString(settings.locale, {
                  timeZone: settings.timezone,
                })
              : "--",
          ],
          [
            "状态",
            t(guest ? "登录后可见" : result ? "已缓存" : "等待手动刷新"),
          ],
        ])}
      </section>
      <div className={P.side}>
        <section className={P.panel}>
          <h3>
            <Radar size={16} />
            {t("IP质量")}
            <small>{t("仅供参考")}</small>
          </h3>
          {!guest && (
            <div
              className={T.segments}
              style={{ marginBottom: 14 }}
              aria-label={t("IP 质量显示方式")}
            >
              {(
                [
                  ["reference", "参考估算"],
                  ["provider", "数据源指标"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={settings.ipQualityView === value}
                  onClick={() =>
                    useUI.getState().configure({ ipQualityView: value })
                  }
                >
                  {t(label)}
                </button>
              ))}
            </div>
          )}
          {settings.ipQualityView === "reference" ? (
            <IPReference metadata={main} quality={quality} guest={guest} />
          ) : (
            <>
              <p
                className={P.note}
                data-quality-state={guest ? "guest" : qualityStatus.state}
              >
                {t(
                  guest
                    ? "登录后可见"
                    : result
                      ? probeLabel(qualityStatus)
                      : "等待手动刷新",
                )}
                {!guest && qualityStatus.httpStatus
                  ? ` (HTTP ${qualityStatus.httpStatus})`
                  : ""}
              </p>
              {!guest && qualityStatus.state === "not_configured" ? (
                <p className={P.note}>
                  {t("配置质量数据源后可查询 VPN、代理、Tor 与网段滥用记录。")}{" "}
                  <a
                    href={
                      import.meta.env.BASE_URL +
                      "extension-guide.html#ip-quality"
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("查看配置说明")}
                  </a>
                </p>
              ) : (
                <>
                  {rows(
                    (
                      [
                        ["is_datacenter", "机房网络"],
                        ["is_vpn", "VPN"],
                        ["is_proxy", "代理"],
                        ["is_tor", "Tor"],
                        ["is_abuser", "滥用记录"],
                      ] as const
                    ).map(([key, label]) => [
                      label,
                      guest || typeof quality[key] !== "boolean"
                        ? t("未知")
                        : t(quality[key] ? "是" : "否"),
                    ]),
                  )}
                  {!guest && fraction !== null && (
                    <div
                      className={P.score}
                      data-abuse-fraction
                      title={t(
                        "该值为数据源返回的网段滥用比例，不等同于单个 IP 的风险概率。",
                      )}
                    >
                      <div>
                        <span>{t("网段滥用比例")}</span>
                        <strong>{Number((fraction * 100).toFixed(2))}%</strong>
                      </div>
                      <div className={P.track}>
                        <i
                          style={
                            {
                              width: fraction * 100 + "%",
                              "--score": "var(--accent)",
                            } as React.CSSProperties
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
        <section className={P.panel}>
          <h3>
            <Building2 size={16} />
            {t("网络归属")}
          </h3>
          {rows([
            [
              "ASN",
              guest ? t("登录后可见") : (org.match(/^AS\d+/)?.[0] ?? main.asn),
            ],
            [
              "组织 / 运营商",
              guest ? t("登录后可见") : org.replace(/^AS\d+\s*/, ""),
            ],
            [
              "网络类型",
              guest ? t("登录后可见") : (quality.type ?? main.network_type),
            ],
            ["节点地区", guest ? t("登录后可见") : region],
          ])}
        </section>
      </div>
    </div>
  );
}
const platforms = [
  ["Netflix", "N", "#e50914"],
  ["Disney+", "D+", "#3185d5"],
  ["YouTube Premium", "▶", "#ed4b5a"],
  ["Spotify", "S", "#26aa70"],
  ["TikTok", "♪", "#688ba9"],
  ["ChatGPT", "G", "#2a9e8e"],
  ["Claude", "C", "#c18a67"],
  ["Gemini", "✦", "#6d92e1"],
] as const;
export function ProbeResult({
  result,
  guest = false,
  families = ["IPv4", "IPv6"],
}: {
  result?: unknown;
  guest?: boolean;
  families?: string[];
}) {
  const t = useTranslate(),
    data = result as any;
  const services = Array.isArray(data?.services) ? data.services : [];
  const available = services.length
    ? [
        ...new Set<string>(
          services
            .map((s: any) => String(s.family))
            .filter((f: string) => f === "IPv4" || f === "IPv6"),
        ),
      ]
    : families;
  return (
    <>
      {available.map((family) => (
        <section className={P.streamSection} key={family}>
          <div className={P.streamHead}>
            <h3>
              <Globe size={14} /> {family} · {t("流媒体检测")}
            </h3>
            <span className={T.badge}>
              {services.filter((s: any) => s.family === family).length} /{" "}
              {platforms.length}
            </span>
          </div>
          <div className={P.grid}>
            {platforms.map(([name, icon, color]) => {
              const r = services.find(
                  (s: any) => s.name === name && s.family === family,
                ),
                code = r?.httpStatus;
              const tone =
                guest || !r
                  ? "idle"
                  : code === 0 || code === 451
                    ? "bad"
                    : code === 403 || code === 401
                      ? "warn"
                      : "normal";
              const Icon = guest
                ? LockKeyhole
                : !r
                  ? Clock3
                  : tone === "bad" || tone === "warn"
                    ? AlertCircle
                    : CheckCircle2;
              return (
                <article className={P.service} key={name} data-tone={tone}>
                  <header>
                    <span
                      className={P.icon}
                      style={{ "--brand": color } as React.CSSProperties}
                    >
                      {icon}
                    </span>
                    <h4>{name}</h4>
                  </header>
                  <div className={P.result}>
                    <Icon size={13} />
                    {t(
                      guest
                        ? "登录后可测试"
                        : (r?.status ?? (result ? "无数据" : "等待开始测试")),
                    )}
                  </div>
                  <small>
                    {guest ? "--" : r ? `HTTP ${printable(code)}` : "—"}
                  </small>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {data?.notice && <p className={P.note}>{t(String(data.notice))}</p>}
    </>
  );
}
