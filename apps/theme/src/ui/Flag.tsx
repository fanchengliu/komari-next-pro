import { S } from "./primitives";
import codes from "../assets/flag-index.json";
const flags = new Set(codes);
export function countryCode(region: string) {
  if (/^[a-z]{2}(?:$|[\s,/-])/i.test(region.trim()))
    return region.trim().slice(0, 2).toLowerCase() === "uk"
      ? "gb"
      : region.trim().slice(0, 2).toLowerCase();
  const chars = [...region.trim()].slice(0, 2);
  if (
    chars.length === 2 &&
    chars.every(
      (c) => c.codePointAt(0)! >= 0x1f1e6 && c.codePointAt(0)! <= 0x1f1ff,
    )
  )
    return chars
      .map((c) => String.fromCharCode(c.codePointAt(0)! - 0x1f1e6 + 97))
      .join("");
  return "";
}
export function Flag({ region }: { region: string }) {
  const code = countryCode(region);
  const src = flags.has(code)
    ? `${import.meta.env.BASE_URL}flags/${code}.svg`
    : undefined;
  return src ? (
    <img className={S.flagImage} src={src} alt={code.toUpperCase()} />
  ) : (
    <span className={S.flag}>{region || "🌐"}</span>
  );
}
