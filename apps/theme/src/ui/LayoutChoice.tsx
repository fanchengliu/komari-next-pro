import { useModel } from "../data/context";
import { useSmallScreen, type LayoutPreset } from "../data/layout";
import { useUI } from "../data/store";
import { useTranslate } from "../data/i18n";
export const layoutNames = {
  daily: "日常展示",
  compact: "紧凑巡检",
  mobile: "手机布局",
};
export function LayoutChoice() {
  const { settings } = useModel();
  const small = useSmallScreen();
  const configure = useUI((s) => s.configure);
  const t = useTranslate();
  return (
    <select
      aria-label={t("当前屏幕布局")}
      value={small ? settings.mobileLayout : settings.desktopLayout}
      onChange={(e) =>
        configure(
          small
            ? { mobileLayout: e.target.value as LayoutPreset }
            : { desktopLayout: e.target.value as "daily" | "compact" },
        )
      }
    >
      {(
        ["daily", "compact", ...(small ? ["mobile"] : [])] as LayoutPreset[]
      ).map((id) => (
        <option key={id} value={id}>
          {t(layoutNames[id])}
        </option>
      ))}
    </select>
  );
}
