import { useState } from "react";
import {
  Grid2X2,
  Rows3,
  Smartphone,
  Monitor,
  Check,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useModel } from "../data/context";
import { useSmallScreen, type LayoutPreset } from "../data/layout";
import { useUI } from "../data/store";
import { useTranslate } from "../data/i18n";
import { NodeCard } from "./Dashboard";
import { CompactNodes } from "./CompactNodes";
import { PingSummaryProvider } from "./network/PingSummaryBars";
import { PageHeader } from "../ui/PageHeader";
import { State } from "../ui/primitives";
import { layoutNames } from "../ui/LayoutChoice";
import V from "../ui/v2.module.css";
import L from "../ui/layouts.module.css";

type Scope = "desktop" | "mobile";
const icons = { daily: Grid2X2, compact: Rows3, mobile: Smartphone };
const descriptions = {
  daily: "卡片展示，适合日常查看。",
  compact: "表格展示，适合集中巡检。",
  mobile: "单列卡片，概览可横向滑动。",
};

function Miniature({ preset }: { preset: LayoutPreset }) {
  return (
    <span className={L.miniature} data-kind={preset} aria-hidden="true">
      {Array.from({ length: preset === "mobile" ? 3 : 6 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export function Layouts() {
  const { nodes, statuses, settings, loading } = useModel();
  const small = useSmallScreen();
  const t = useTranslate();
  const configure = useUI((s) => s.configure);
  const [scope, setScope] = useState<Scope>(() =>
    small ? "mobile" : "desktop",
  );
  const [drafts, setDrafts] = useState<Partial<Record<Scope, LayoutPreset>>>(
    {},
  );
  const [message, setMessage] = useState("");
  const current =
    scope === "desktop" ? settings.desktopLayout : settings.mobileLayout;
  const preset = drafts[scope] ?? current;
  const changed = preset !== current;
  const options: LayoutPreset[] =
    scope === "desktop" ? ["daily", "compact"] : ["daily", "compact", "mobile"];
  const sample = nodes.slice(0, scope === "mobile" ? 2 : 3);

  function apply() {
    if (scope === "desktop") {
      if (preset === "mobile") return;
      configure({ desktopLayout: preset });
    } else configure({ mobileLayout: preset });
    setMessage(t("已保存到本机偏好"));
  }

  return (
    <main className={V.page} data-layout-settings>
      <PageHeader
        title={t("布局预设")}
        eyebrow="LAYOUT / KOMARI NEXT PRO"
        description={t("为桌面和手机分别选择布局，先预览，再应用。")}
      />
      <section
        className={`${V.panel} ${L.settingsPanel}`}
        aria-label={t("布局选择")}
      >
        <div className={L.deviceBar}>
          <div
            className={L.deviceSwitch}
            role="group"
            aria-label={t("应用设备")}
          >
            {(["desktop", "mobile"] as const).map((id) => {
              const Icon = id === "desktop" ? Monitor : Smartphone;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={scope === id}
                  onClick={() => {
                    setScope(id);
                    setMessage("");
                  }}
                >
                  <Icon size={16} />
                  {t(id === "desktop" ? "桌面" : "手机")}
                </button>
              );
            })}
          </div>
          <span className={L.current}>
            {t("当前使用")}
            <strong>{t(layoutNames[current])}</strong>
          </span>
        </div>
        <div
          className={L.options}
          data-count={options.length}
          role="group"
          aria-label={t("布局选择")}
        >
          {options.map((id) => {
            const Icon = icons[id];
            return (
              <button
                key={id}
                type="button"
                className={L.option}
                aria-label={t(layoutNames[id])}
                aria-pressed={preset === id}
                onClick={() => {
                  setDrafts((old) => ({ ...old, [scope]: id }));
                  setMessage("");
                }}
              >
                <Miniature preset={id} />
                <span className={L.optionCopy}>
                  <strong>
                    <Icon size={15} />
                    {t(layoutNames[id])}
                  </strong>
                  <span>{t(descriptions[id])}</span>
                </span>
                <span className={L.selectionMark} aria-hidden="true">
                  {preset === id && <Check size={13} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className={L.applyBar}>
          <p className={L.hint} role="status">
            {message ||
              t(changed ? "预览中的布局尚未应用。" : "当前布局已生效。")}
          </p>
          <button
            type="button"
            className={`${V.primary} ${L.applyButton}`}
            disabled={!changed}
            onClick={apply}
          >
            <Check size={15} />
            {t(
              changed
                ? scope === "desktop"
                  ? "应用到桌面"
                  : "应用到手机"
                : "已应用",
            )}
          </button>
        </div>
      </section>

      <section className={`${V.panel} ${L.previewPanel}`}>
        <div className={L.previewHeader}>
          <div>
            <h2>{t("效果预览")}</h2>
            <p>
              {t(layoutNames[preset])} ·{" "}
              {t(scope === "desktop" ? "桌面" : "手机")} · {t("真实节点预览")}
            </p>
          </div>
          <Link to="/" className={L.overviewLink}>
            {t("返回概览")}
            <ArrowRight size={14} />
          </Link>
        </div>
        <PingSummaryProvider enabled={settings.fields.includes("ping")}>
          <div
            className={L.previewViewport}
            data-preview-device={scope}
            data-preview-layout={preset}
          >
            {loading ? (
              <State busy />
            ) : !sample.length ? (
              <State empty={t("暂无可见节点")} />
            ) : preset === "compact" ? (
              <CompactNodes nodes={nodes.slice(0, 5)} />
            ) : (
              <div className={L.previewGrid}>
                {sample.map((n) => (
                  <NodeCard key={n.id} node={n} status={statuses[n.id]} />
                ))}
              </div>
            )}
          </div>
        </PingSummaryProvider>
        <p className={L.footnote}>
          {t("布局偏好仅保存在本浏览器，管理员可在主题设置中保存为站点默认。")}
        </p>
      </section>
    </main>
  );
}
