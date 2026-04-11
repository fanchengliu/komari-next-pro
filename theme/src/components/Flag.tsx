import * as React from "react";
import { Box } from "@/components/ui/box";

interface FlagProps {
  flag: string; // 地区代码 (例如 "SG", "US") 或旗帜 emoji (例如 "🇸🇬", "🇺🇳")
  size?: string; // 可选的尺寸 prop，用于未来扩展
}

/**
 * 算法：将由两个区域指示符符号组成的 emoji 转换为对应的两字母国家代码。
 * 例如：🇸🇬 (由两个区域指示符组成) -> SG
 * @param emoji 输入的 emoji 字符串
 * @returns 转换后的两字母国家代码（例如 "SG"），如果不是有效的旗帜 emoji 则返回 null。
 */
const getCountryCodeFromFlagEmoji = (emoji: string): string | null => {
  // 使用 Array.from() 来正确处理 Unicode 代理对，将 emoji 字符串拆分为逻辑上的字符数组。
  // 对于一个国家旗帜 emoji，chars 数组的长度将是 2 (每个元素是一个区域指示符字符)。
  const chars = Array.from(emoji);

  // 国家旗帜 emoji 应该由且仅由两个区域指示符字符组成
  if (chars.length !== 2) {
    return null;
  }

  // 获取两个区域指示符字符的 Unicode 码点
  const codePoint1 = chars[0].codePointAt(0)!;
  const codePoint2 = chars[1].codePointAt(0)!;

  // 区域指示符符号的 Unicode 范围是从 U+1F1E6 (🇦) 到 U+1F1FF (🇿)
  const REGIONAL_INDICATOR_START = 0x1F1E6; // 🇦 的 Unicode 码点
  const ASCII_ALPHA_START = 0x41; // A 的 ASCII 码点

  // 检查两个码点是否都在区域指示符范围内
  if (
    codePoint1 >= REGIONAL_INDICATOR_START && codePoint1 <= 0x1F1FF &&
    codePoint2 >= REGIONAL_INDICATOR_START && codePoint2 <= 0x1F1FF
  ) {
    // 算法转换：通过计算与 'A' 对应的区域指示符的偏移量，将区域指示符码点转换回对应的 ASCII 字母码点
    const letter1 = String.fromCodePoint(codePoint1 - REGIONAL_INDICATOR_START + ASCII_ALPHA_START);
    const letter2 = String.fromCodePoint(codePoint2 - REGIONAL_INDICATOR_START + ASCII_ALPHA_START);
    return `${letter1}${letter2}`;
  }

  return null;
};

const Flag = React.memo(({ flag, size }: FlagProps) => {
  let imgSrc: string;
  let altText: string;
  let resolvedFlagFileName: string; // 最终用于构建文件名的字符串 (例如 "SG", "UN")

  // 1. **算法处理：** 尝试将输入作为由区域指示符组成的旗帜 emoji 进行转换
  const countryCodeFromEmoji = getCountryCodeFromFlagEmoji(flag);

  if (countryCodeFromEmoji) {
    resolvedFlagFileName = countryCodeFromEmoji; // 例如，如果输入是 "🇸🇬"，则这里得到 "SG"
  }
  // 2. **直接识别：** 如果不是区域指示符 emoji，检查是否是两字母的字母组合（ISO 国家代码）
  else if (flag && flag.length === 2 && /^[a-zA-Z]{2}$/.test(flag)) {
    resolvedFlagFileName = flag.toUpperCase(); // 例如，如果输入是 "us"，则这里得到 "US"
  }
  // 3. **硬编码处理特殊 Emoji：** 对于无法通过算法转换的特殊 emoji（例如 🇺🇳, 🌐），
  //    因为它们不符合区域指示符模式，且不使用映射表，只能通过硬编码来识别。
  else if (flag === "🇺🇳" || flag === "🌐") {
    resolvedFlagFileName = "UN"; // 例如，如果输入是 "🇺🇳"，则这里得到 "UN"
  }
  // 4. **回退：** 对于任何其他无法识别的输入（包括不符合上述规则的 emoji 或非两字母代码），
  //    使用默认的 "UN" 旗帜作为回退。
  else {
    resolvedFlagFileName = "UN";
  }

  // 构建本地图片路径
  imgSrc = `/assets/flags/${resolvedFlagFileName}.svg`;
  // 构建 alt 文本和 aria-label
  altText = `地区旗帜: ${resolvedFlagFileName}`;

  return (
    <Box
      as="span"
      className={`m-2 self-center ${size ? `w-${size} h-${size}` : "w-6 h-6"}`}
      style={{ display: "inline-flex", alignItems: "center" }}
      aria-label={altText}
    >
      <img
        src={imgSrc}
        alt={altText}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Box>
  );
});

// 确保 displayName 以便在 React DevTools 中识别
Flag.displayName = "Flag";

export default Flag;