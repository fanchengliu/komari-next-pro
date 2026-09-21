import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ThemeSettings,
  Playlist,
  Locale,
} from "../../../../packages/contracts";
function previousPreferences() {
  try {
    const state = JSON.parse(
      localStorage.getItem("komari-ds:ui:v1") ?? "null",
    )?.state;
    return {
      view: state?.view === "table" ? ("table" as const) : ("grid" as const),
      preferences:
        state?.preferences &&
        typeof state.preferences === "object" &&
        !Array.isArray(state.preferences)
          ? state.preferences
          : {},
    };
  } catch {
    return { view: "grid" as const, preferences: {} };
  }
}
type UI = {
  siteLocale: Locale;
  view: "grid" | "table";
  group: string;
  search: string;
  online: "all" | "online" | "offline";
  dialog: string | null;
  setupSeen: boolean;
  compareIds: string[];
  pingTarget: {
    id: string;
    start?: number;
    end?: number;
    tasks?: string[];
  } | null;
  preferences: Partial<ThemeSettings>;
  playlistOverride: Playlist | null;
  set: (update: Partial<Omit<UI, "set">>) => void;
  configure: (v: Partial<ThemeSettings>) => void;
};
export const useUI = create<UI>()(
  persist(
    (set) => ({
      siteLocale: "zh-CN",
      view: previousPreferences().view,
      group: "",
      search: "",
      online: "all",
      dialog: null,
      setupSeen: false,
      compareIds: [],
      pingTarget: null,
      preferences: previousPreferences().preferences,
      playlistOverride: null,
      set,
      configure: (p) =>
        set((state) => ({ preferences: { ...state.preferences, ...p } })),
    }),
    {
      name: "komari-ds:ui:v2",
      version: 2,
      migrate: (value) => {
        const old = value as Partial<UI> | null;
        return {
          view: old?.view === "table" ? "table" : "grid",
          preferences:
            old?.preferences && typeof old.preferences === "object"
              ? old.preferences
              : {},
        };
      },
      partialize: (s) => ({
        view: s.view,
        preferences: s.preferences,
        playlistOverride: s.playlistOverride,
        setupSeen: s.setupSeen,
      }),
    },
  ),
);
