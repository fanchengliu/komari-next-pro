import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const packages = [];
async function scan(root) {
  for (const e of await readdir(root, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const dir = join(root, e.name);
    if (e.name.startsWith("@")) {
      await scan(dir);
      continue;
    }
    let p;
    try {
      p = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    } catch {
      continue;
    }
    const names = await readdir(dir);
    const licenses = names.filter((n) =>
      /^(license|copying|notice)(\.|$)/i.test(n),
    );
    let texts = [];
    for (const name of licenses) {
      try {
        const text = await readFile(join(dir, name), "utf8");
        if (text.length < 100000) texts.push(`### ${name}\n\n${text}`);
      } catch {}
    }
    packages.push({
      name: p.name,
      version: p.version,
      license: p.license ?? "See package metadata",
      text: texts.join("\n\n"),
    });
  }
}
await scan("node_modules");
packages.sort((a, b) => a.name.localeCompare(b.name));
let text =
  "# Third-party notices\n\nIncludes build/test tooling as well as shipped dependencies. User-provided media is described separately in PROVENANCE.md.\n\n";
for (const p of packages)
  text += `## ${p.name} ${p.version}\n\nLicense: ${typeof p.license === "string" ? p.license : JSON.stringify(p.license)}\n\n${p.text}\n\n`;
text +=
  "\n## Offline geographic databases (V2)\n\nSee GEODATA.md, docs/licenses, and dist/geodata for World Atlas / Natural Earth and the derived ODbL mledoze/countries database. Their separate licenses remain in force.\n";
await writeFile(
  "docs/THIRD_PARTY_NOTICES.md",
  text.replace(/\r\n/g, "\n").replace(/[\t ]+$/gm, ""),
);
console.log(`Recorded ${packages.length} dependency notices`);
