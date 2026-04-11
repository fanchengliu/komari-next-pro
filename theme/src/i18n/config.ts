import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import zh_CN from "./locales/zh_CN.json";
import zh_TW from "./locales/zh_TW.json";
import ja_JP from "./locales/ja_JP.json"; 
import id_ID from "./locales/id_ID.json";

// 不添加 name 字段的语言将不会在语言切换菜单中显示
// not adding the name field will hide the language from the language switcher menu
const resources = {
  "en-US": {
    translation: en,
    name: "English",
  },
  "zh-CN": {
    translation: zh_CN,
    name: "简体中文",
  },
  "zh-SG": {
    translation: zh_CN,  // Singapore uses Simplified Chinese
  },
  "zh-TW": {
    translation: zh_TW,
    name: "繁體中文",
  },
  "zh-HK": {
    translation: zh_TW,  // Hong Kong uses Traditional Chinese
  },
  "zh-MO": {
    translation: zh_TW,  // Macau uses Traditional Chinese
  },
  "ja-JP": {
    translation: ja_JP,
    name: "日本語",
  },
  "id-ID": {
    translation: id_ID,
    name: "Bahasa Indonesia",
  },
};

const i18n = i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh-CN",
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    detection: {
      order: ["querystring", "cookie", "localStorage", "navigator", "htmlTag"],
      caches: ["localStorage", "cookie"],
    },
  });

export default i18n;
export { resources };