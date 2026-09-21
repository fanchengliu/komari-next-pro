import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Languages, Check } from "lucide-react";
import { locales, type Locale } from "../../../../packages/contracts";
import { useModel } from "../data/context";
import { useUI } from "../data/store";
import { useTranslate, translate } from "../data/i18n";
import { S } from "./primitives";
import V from "./v2.module.css";
export const localeNames: Record<Locale, string> = {
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
};
export function LanguageSelect({
  value,
  onChange,
}: {
  value?: Locale;
  onChange?: (value: Locale) => void;
}) {
  const { settings } = useModel(),
    configure = useUI((s) => s.configure),
    t = useTranslate();
  return (
    <select
      aria-label={translate("语言", value ?? settings.locale)}
      value={value ?? settings.locale}
      onChange={(e) =>
        (onChange ?? ((locale) => configure({ locale })))(
          e.target.value as Locale,
        )
      }
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeNames[locale]}
        </option>
      ))}
    </select>
  );
}
export function LanguageMenu() {
  const [open, setOpen] = useState(false);
  const { settings } = useModel(),
    configure = useUI((s) => s.configure),
    t = useTranslate();
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        data-language-menu
        className={S.icon}
        aria-label={t("切换语言")}
        title={t("切换语言")}
      >
        <Languages />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={V.popover} sideOffset={10} align="end">
          <div role="group" aria-label={t("语言")}>
            {locales.map((locale) => (
              <button
                key={locale}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  margin: "4px 0",
                  fontSize: 13,
                }}
                aria-pressed={settings.locale === locale}
                onClick={() => {
                  configure({ locale });
                  setOpen(false);
                }}
              >
                {localeNames[locale]}
                {settings.locale === locale && <Check size={14} />}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
