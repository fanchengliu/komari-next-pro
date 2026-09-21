import { estimateIPReference } from "../domain/ip-reference";
import { useTranslate } from "../data/i18n";
import P from "../ui/probes.module.css";
export function IPReference({
  metadata,
  quality,
  guest = false,
}: {
  metadata: any;
  quality: any;
  guest?: boolean;
}) {
  const t = useTranslate(),
    r = estimateIPReference(guest ? null : metadata, quality);
  const values = [
    ["资料完整度", r.completeness, true],
    ["风险观感（估算）", r.risk, false],
    ["污染度（估算）", r.pollution, false],
  ] as const;
  return (
    <div data-ip-reference>
      <p className={P.note}>
        {t(
          guest
            ? "登录后可见"
            : "免 Key 规则估算，不是实际信誉检测或风险概率。",
        )}
      </p>
      {values.map(([label, value, positive]) => {
        const health = value === null ? 0 : positive ? value : 100 - value;
        const color =
          value === null
            ? "#aab9c9"
            : health >= 70
              ? "#27b59c"
              : health >= 40
                ? "#edb43a"
                : "#ee747a";
        return (
          <div key={label} className={P.score} data-reference-score>
            <div>
              <span>{t(label)}</span>
              <strong>{value ?? "--"}</strong>
            </div>
            <div className={P.track}>
              <i
                style={
                  {
                    width: (value ?? 0) + "%",
                    "--score": color,
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
        );
      })}
      {!guest && r.completeness !== null && (
        <details className={P.referenceDetails}>
          <summary>{t("查看估算依据")}</summary>
          <p>
            {t("规则版本")}：{r.version}
          </p>
          <p>
            {t("资料完整度按 IP、国家、城市、时区、组织、ASN 六项计算。")}{" "}
            {r.fields}/6 → {r.completeness}
          </p>
          <p>
            {t("风险与污染从中性值 50 起算；未知项不加减分，不加入随机扰动。")}
          </p>
          {r.adjustments.length ? (
            <ul>
              {r.adjustments.map((a, i) => (
                <li key={i}>
                  {t(a.reason)}
                  {a.matched ? ` (${a.matched})` : ""}：{t("风险观感")}{" "}
                  {a.risk >= 0 ? "+" : ""}
                  {a.risk} · {t("污染度")} {a.pollution >= 0 ? "+" : ""}
                  {a.pollution}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("未找到可用分类信号，保留中性估算。")}</p>
          )}
          <p>
            {t("组织名称推断可能有误，不能据此判断代理、滥用或流媒体解锁。")}
          </p>
        </details>
      )}
    </div>
  );
}
