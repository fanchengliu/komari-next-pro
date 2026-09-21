import { useEffect, useState } from "react";
import { useTranslate } from "../data/i18n";
import T from "./tools.module.css";
export function CardOpacity({
  value,
  appearance,
  onChange,
}: {
  value: number | null;
  appearance: "light" | "dark" | "system";
  onChange: (value: number | null) => void;
}) {
  const t = useTranslate();
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const transparency =
    100 -
    (value ??
      (appearance === "dark" || (appearance === "system" && systemDark)
        ? 78
        : 74));
  return (
    <div className={T.opacityControl}>
      <label>
        <span>
          {t("卡片透明度")} <output>{transparency}%</output>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          aria-label={t("卡片透明度")}
          aria-valuetext={`${transparency}%`}
          value={transparency}
          onChange={(e) => onChange(100 - Number(e.target.value))}
        />
      </label>
      <div>
        <small>{t("更实")}</small>
        <small>{t("更透")}</small>
      </div>
      <p>{t("只调整卡片底色，文字和图表保持清晰。")}</p>
      <button type="button" className={T.action} onClick={() => onChange(null)}>
        {t("恢复默认透明度")}
      </button>
    </div>
  );
}
