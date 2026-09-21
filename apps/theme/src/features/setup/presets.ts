import {
  defaultSettings,
  settingsSchema,
  type ThemeSettings,
} from "../../../../../packages/contracts";
export const presetIds = ["current", "glass", "inspection", "night"] as const;
export type PresetId = (typeof presetIds)[number];
export function presetConfiguration(
  id: PresetId,
  current: ThemeSettings,
  assetBase: string,
): ThemeSettings {
  if (id === "current") return { ...current, presetId: "custom" };
  const base = {
    ...defaultSettings,
    locale: current.locale,
    timezone: current.timezone,
    logo: current.logo || assetBase + "media/logo.png",
    background: assetBase + "media/background.mp4",
    backgroundSource: "single" as const,
    backgroundKind: "video" as const,
    pingMode: "auto" as const,
    presetId: id,
  };
  return settingsSchema.parse(
    id === "inspection"
      ? {
          ...base,
          desktopLayout: "compact",
          mobileLayout: "compact",
          backgroundSource: "none",
          accent: "#208f87",
          mood: false,
          level: false,
        }
      : id === "night"
        ? {
            ...base,
            appearance: "dark",
            backgroundSource: "none",
            accent: "#9183ed",
            mobileLayout: "mobile",
          }
        : base,
  );
}
