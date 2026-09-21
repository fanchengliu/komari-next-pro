import { mkdir, readdir, copyFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const source = join(root, "node_modules/flag-icons/flags/4x3"),
  destination = join(root, "apps/theme/public/flags");
await mkdir(destination, { recursive: true });
const names = (await readdir(source)).filter((n) => /^[a-z-]+\.svg$/.test(n));
for (const name of names)
  await copyFile(join(source, name), join(destination, name));
await writeFile(
  join(root, "apps/theme/src/assets/flag-index.json"),
  JSON.stringify(names.map((n) => n.slice(0, -4))),
);

const geo = join(root, "apps/theme/public/geodata");
await mkdir(geo, { recursive: true });
for (const [from, to] of [
  ["apps/theme/src/assets/land.json", "land.json"],
  ["apps/theme/src/assets/region-centers.json", "region-centers.json"],
  ["docs/licenses/ODbL-country-centers.txt", "ODbL-country-centers.txt"],
  ["docs/licenses/ISC-world-atlas.txt", "ISC-world-atlas.txt"],
  ["docs/GEODATA.md", "ATTRIBUTION.txt"],
])
  await copyFile(join(root, from), join(geo, to));
