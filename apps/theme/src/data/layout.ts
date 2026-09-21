import { useEffect, useState } from "react";
import { useModel } from "./context";
export type LayoutPreset = "daily" | "compact" | "mobile";
export function useSmallScreen() {
  const [small, setSmall] = useState(
    () => matchMedia("(max-width: 720px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(max-width: 720px)");
    const change = () => setSmall(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return small;
}
export function useLayoutPreset(): LayoutPreset {
  const { settings } = useModel();
  const small = useSmallScreen();
  return small ? settings.mobileLayout : settings.desktopLayout;
}
