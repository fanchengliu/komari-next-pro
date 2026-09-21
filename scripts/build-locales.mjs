import fs from "node:fs/promises";
import OpenCC from "opencc-js";
import { enV22, jaV22, koV22 } from "../apps/theme/src/data/i18n-v22.ts";
import { jaCommon, koCommon } from "../apps/theme/src/data/locales/common.ts";
const root = "apps/theme/src/data/";
let en = {};
for (const path of ["i18n.ts", "i18n-v2.ts", "i18n-v21.ts"]) {
  const text = await fs.readFile(root + path, "utf8"),
    start = text.indexOf("= {") + 2,
    end = text.indexOf("\n};", start) + 2;
  if (start < 2 || end < 2)
    throw Error("Locale dictionary marker missing: " + path);
  en = { ...en, ...Function("return (" + text.slice(start, end) + ")")() };
}
en = { ...en, ...enV22 };
const convert = OpenCC.Converter({ from: "cn", to: "twp" }),
  tw = {},
  ja = {},
  ko = {},
  missing = [];
for (const [key, english] of Object.entries(en)) {
  tw[key] = convert(key);
  ja[key] = jaV22[key] ?? jaCommon[english.trim()];
  ko[key] = koV22[key] ?? koCommon[english.trim()];
  if (!ja[key] || !ko[key]) missing.push({ key, english });
  if (!ja[key]) ja[key] = english;
  if (!ko[key]) ko[key] = english;
}
for (const [name, data] of [
  ["zh-TW", tw],
  ["ja", ja],
  ["ko", ko],
])
  await fs.writeFile(
    root + "locales/" + name + ".json",
    JSON.stringify(data, null, 2) + "\n",
  );
console.log(
  JSON.stringify(
    { keys: Object.keys(en).length, englishFallbacks: missing },
    null,
    2,
  ),
);
