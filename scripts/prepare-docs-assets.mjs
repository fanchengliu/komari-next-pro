import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PanelsTopLeft,
  Activity,
  Globe2,
  SlidersHorizontal,
  ChartNoAxesCombined,
  Plug,
} from "lucide-react";
await mkdir("site/public/icons", { recursive: true });
await mkdir("site/public/screenshots", { recursive: true });
await copyFile("apps/theme/public/media/logo.svg", "site/public/logo.svg");
await copyFile(
  "docs/images/overview.png",
  "site/public/screenshots/overview.png",
);
for (const [name, icon] of Object.entries({
  dashboard: PanelsTopLeft,
  network: Activity,
  globe: Globe2,
  style: SlidersHorizontal,
  reports: ChartNoAxesCombined,
  extension: Plug,
}))
  await writeFile(
    `site/public/icons/${name}.svg`,
    renderToStaticMarkup(
      createElement(icon, {
        xmlns: "http://www.w3.org/2000/svg",
        size: 24,
        stroke: "#3976ed",
        strokeWidth: 1.8,
      }),
    ) + "\n",
  );
