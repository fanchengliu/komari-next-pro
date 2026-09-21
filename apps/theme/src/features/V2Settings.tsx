import { HomeTaskSettings } from "./network/HomeTaskSettings";
import { Link } from "react-router-dom";
import { useModel } from "../data/context";
import { useUI } from "../data/store";
import { useTranslate } from "../data/i18n";
import { S, Toggle } from "../ui/primitives";
import { layoutNames } from "../ui/LayoutChoice";
export function V2Settings() {
  const { settings, tasks } = useModel();
  const configure = useUI((s) => s.configure),
    t = useTranslate();
  return (
    <>
      <section className={S.section}>
        <h3>{t("布局与地区展示")}</h3>
        <label className={S.settingRow}>
          {t("桌面默认")}
          <select
            aria-label={t("桌面默认")}
            value={settings.desktopLayout}
            onChange={(e) =>
              configure({
                desktopLayout: e.target.value as "daily" | "compact",
              })
            }
          >
            {(["daily", "compact"] as const).map((id) => (
              <option value={id} key={id}>
                {t(layoutNames[id])}
              </option>
            ))}
          </select>
        </label>
        <label className={S.settingRow}>
          {t("手机默认")}
          <select
            aria-label={t("手机默认")}
            value={settings.mobileLayout}
            onChange={(e) =>
              configure({
                mobileLayout: e.target.value as "daily" | "compact" | "mobile",
              })
            }
          >
            {(["daily", "compact", "mobile"] as const).map((id) => (
              <option value={id} key={id}>
                {t(layoutNames[id])}
              </option>
            ))}
          </select>
        </label>
        <Toggle
          label={t("启用三维地球")}
          checked={settings.globeEnabled}
          onChange={(globeEnabled) => configure({ globeEnabled })}
        />
        <Link to="/layouts" className={S.note}>
          {t("查看布局预设")}
        </Link>
        <Toggle
          label={t("自动旋转")}
          checked={settings.globeAutoRotate}
          onChange={(globeAutoRotate) => configure({ globeAutoRotate })}
        />
      </section>
      <section className={S.section}>
        <h3>{t("首页网络时间格")}</h3>
        <label className={S.settingRow}>
          {t("历史范围")}
          <select
            value={settings.pingHistoryHours}
            aria-label={t("首页网络历史范围")}
            onChange={(e) =>
              configure({ pingHistoryHours: Number(e.target.value) })
            }
          >
            {[1, 4, 6, 12, 24].map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
        <HomeTaskSettings />
      </section>
    </>
  );
}
