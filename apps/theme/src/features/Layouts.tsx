import { useState } from "react";
import { Grid2X2, Rows3, Smartphone, ArrowRight } from "lucide-react";
import { useModel } from "../data/context";
import { useSmallScreen, type LayoutPreset } from "../data/layout";
import { useUI } from "../data/store";
import { useTranslate } from "../data/i18n";
import { NodeCard } from "./Dashboard";
import { CompactNodes } from "./CompactNodes";
import { PingSummaryProvider } from "./network/PingSummaryBars";
import { PageHeader } from "../ui/PageHeader";
import { State } from "../ui/primitives";
import V from "../ui/v2.module.css";
import { layoutNames } from "../ui/LayoutChoice";
function Thumb({ type }: { type: LayoutPreset }) {
  return (
    <div className={V.thumb} aria-hidden="true">
      {type === "mobile" ? (
        <div className={V.phoneThumb}>
          <div className={V.thumbStats}>
            <i />
            <i />
          </div>
          {[0, 1].map((n) => (
            <div className={V.thumbCard} key={n}>
              <i />
              <i />
              <i />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className={V.thumbStats}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <i key={n} />
            ))}
          </div>
          <div className={V.thumbSearch} />
          {type === "compact" ? (
            <div className={V.thumbRows}>
              {[0, 1, 2, 3, 4].map((n) => (
                <i key={n} />
              ))}
            </div>
          ) : (
            <div className={V.thumbGrid}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <div className={V.thumbCard} key={n}>
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
export function Layouts() {
  const { nodes, statuses, settings, viewer } = useModel();
  const small = useSmallScreen();
  const t = useTranslate();
  const configure = useUI((s) => s.configure);
  const [preset, setPreset] = useState<LayoutPreset>(
      small ? settings.mobileLayout : settings.desktopLayout,
    ),
    [scope, setScope] = useState<"desktop" | "mobile">(
      small ? "mobile" : "desktop",
    ),
    [message, setMessage] = useState("");
  const sample = nodes.slice(0, 3);
  return (
    <main className={V.page}>
      <PageHeader
        title={t("布局预设")}
        eyebrow="LAYOUT / KOMARI NEXT PRO"
        description={t("保留现在的默认风格，为桌面与手机分别选择使用密度。")}
      />
      <div className={V.presets}>
        {(["daily", "compact", "mobile"] as LayoutPreset[]).map((id, i) => {
          const Icon = [Grid2X2, Rows3, Smartphone][i];
          return (
            <button
              key={id}
              className={V.presetCard}
              aria-pressed={id === preset}
              onClick={() => {
                setPreset(id);
                setMessage("");
                if (id === "mobile") setScope("mobile");
              }}
            >
              <header>
                <strong>
                  <Icon size={18} />
                  {t(layoutNames[id])}
                </strong>
                <span className={V.softBadge}>
                  {t(
                    id === preset
                      ? "预览中"
                      : id === "daily"
                        ? "原有默认"
                        : "可选",
                  )}
                </span>
              </header>
              <Thumb type={id} />
              <p>
                {
                  [
                    t("延续玻璃背景、原有卡片与统计布局。"),
                    t("用表格集中查看更多节点，减少纵向滚动。"),
                    t("横向概览与底部导航，详情以抽屉打开。"),
                  ][i]
                }
              </p>
            </button>
          );
        })}
      </div>
      <section className={V.panel}>
        <div className={V.panelHeader}>
          <div>
            <h2>
              {t(layoutNames[preset])} · {t("真实节点预览")}
            </h2>
            <p>{t("这里使用当前账号可见的节点，不填充演示数据。")}</p>
          </div>
          <div className={V.actions}>
            <select
              aria-label={t("保存布局到")}
              value={scope}
              onChange={(e) => setScope(e.target.value as "desktop" | "mobile")}
            >
              <option value="desktop" disabled={preset === "mobile"}>
                {t("桌面默认")}
              </option>
              <option value="mobile">{t("手机默认")}</option>
            </select>
            <button
              className={`${V.smallButton} ${V.primary}`}
              onClick={() => {
                configure(
                  scope === "desktop"
                    ? { desktopLayout: preset as "daily" | "compact" }
                    : { mobileLayout: preset },
                );
                setMessage(t("已保存到本机偏好"));
              }}
            >
              {t("应用布局")}
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
        <PingSummaryProvider enabled={settings.fields.includes("ping")}>
          <div className={V.previewShell}>
            {!sample.length ? (
              <State empty={t("暂无可见节点")} />
            ) : preset === "compact" ? (
              <CompactNodes nodes={nodes.slice(0, 6)} />
            ) : preset === "mobile" ? (
              <div className={V.previewPhone}>
                <NodeCard node={sample[0]} status={statuses[sample[0].id]} />
              </div>
            ) : (
              <div className={V.previewGrid}>
                {sample.map((n) => (
                  <NodeCard key={n.id} node={n} status={statuses[n.id]} />
                ))}
              </div>
            )}
          </div>
        </PingSummaryProvider>
        <p className={V.fieldNote}>
          {t("布局偏好仅保存在本浏览器，管理员可在主题设置中保存为站点默认。")}
        </p>
        {message && (
          <p role="status" className={V.notice}>
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
