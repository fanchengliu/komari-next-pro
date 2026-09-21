import { useModel } from "../../data/context";
import { useTranslate } from "../../data/i18n";
import { currencyCode } from "../../../../../packages/contracts/exchange";
import T from "../../ui/tools.module.css";
export function RateNote() {
  const { fx, settings } = useModel(),
    t = useTranslate();
  return (
    <p className={T.muted}>
      {t("自动汇率")} ·{" "}
      {fx.data ? (
        <>
          <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">
            Frankfurter
          </a>{" "}
          · {t(fx.data.stale ? "使用上次缓存" : "已同步")} ·{" "}
          {new Date(fx.data.fetchedAt).toLocaleString(settings.locale, {
            timeZone: settings.timezone,
          })}
        </>
      ) : (
        t(fx.loading ? "正在读取…" : "汇率暂不可用，外币金额不计入合计")
      )}
    </p>
  );
}
export function ExchangeRates() {
  const { fx, nodes, settings } = useModel(),
    t = useTranslate();
  const codes = [
    ...new Set([
      "CNY",
      "USD",
      "EUR",
      ...nodes.map((n) => currencyCode(n.currency)),
    ]),
  ].sort();
  return (
    <section className={T.section}>
      <div className={T.bar} style={{ marginTop: 0 }}>
        <h3>{t("自动资产换算")}</h3>
        <button
          className={T.action}
          disabled={fx.loading}
          onClick={() => void fx.refresh()}
        >
          {t("检查汇率更新")}
        </button>
      </div>
      <RateNote />
      <p className={T.muted}>
        {t(
          "采用最新公布的参考汇率，非秒级交易报价。每小时自动检查，失败时保留上次数据。",
        )}
      </p>
      {codes.map((code) => (
        <div className={T.field} key={code}>
          <span>1 {code}</span>
          <strong>
            {fx.rates[code] ? fx.rates[code].toFixed(4) + " CNY" : "--"}
          </strong>
          <small>{fx.data?.dates[code] ?? "—"}</small>
        </div>
      ))}
    </section>
  );
}
