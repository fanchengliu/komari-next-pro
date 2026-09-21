import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { createHash } from "node:crypto";
import { zipSync, unzipSync } from "fflate";
const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(join(root, "komari-theme.json"), "utf8"),
);
if (manifest.short !== "komari-ds")
  throw new Error("Unexpected theme namespace");
const html = await readFile(join(root, "dist/index.html"), "utf8");
for (const placeholder of [
  "<title>Komari Monitor</title>",
  "A simple server monitor tool.",
  "/themes/komari-ds/dist/assets/",
])
  if (!html.includes(placeholder))
    throw new Error("Missing build contract: " + placeholder);
const out = join(root, "releases");
await mkdir(out, { recursive: true });
const entries = {};
async function collect(path, prefix, target) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name.startsWith(".env")
    )
      continue;
    const source = join(path, entry.name),
      name = prefix + entry.name;
    if (entry.isDirectory()) await collect(source, name + "/", target);
    else target[name] = new Uint8Array(await readFile(source));
  }
}
await collect(join(root, "dist"), "dist/", entries);
entries["komari-theme.json"] = new Uint8Array(
  await readFile(join(root, "komari-theme.json")),
);
entries["THIRD_PARTY_NOTICES.md"] = new Uint8Array(
  await readFile(join(root, "docs/THIRD_PARTY_NOTICES.md")),
);
entries["GEODATA.md"] = new Uint8Array(
  await readFile(join(root, "docs/GEODATA.md")),
);
try {
  entries["preview.png"] = new Uint8Array(
    await readFile(join(root, "docs/images/overview.png")),
  );
} catch {}
const source = {};
for (const dir of [
  "apps",
  "packages",
  "scripts",
  "tests",
  "docs",
  "deploy",
  ".github",
])
  await collect(join(root, dir), dir + "/", source);
for (const file of [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
  "playwright.config.ts",
  "komari-theme.json",
  "README.md",
  "README.en.md",
  "LICENSE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".env.example",
  ".gitignore",
])
  source[file] = new Uint8Array(await readFile(join(root, file)));
const extension = {};
for (const dir of ["apps/extension", "packages", "deploy"])
  await collect(join(root, dir), dir + "/", extension);
for (const file of [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "README.md",
])
  extension[file] = new Uint8Array(await readFile(join(root, file)));
extension["README.md"] = new Uint8Array(
  await readFile(join(root, "docs/EXTENSION.md")),
);
extension["scripts/migrate-media.ts"] = source["scripts/migrate-media.ts"];
for (const file of [
  "EXTENSION.md",
  "MIGRATION.md",
  "PROVENANCE.md",
  "THIRD_PARTY_NOTICES.md",
])
  extension["docs/" + file] = new Uint8Array(
    await readFile(join(root, "docs", file)),
  );
const release = {
  name: manifest.name,
  version: manifest.version,
  createdAt: new Date().toISOString(),
  files: [],
};
for (const [kind, files] of [
  ["theme", entries],
  ["source", source],
  ["extension", extension],
]) {
  files["LICENSE"] = new Uint8Array(await readFile(join(root, "LICENSE")));
  const bytes = zipSync(files, { level: 6 });
  const name = `komari-next-pro-${manifest.version}-${kind}.zip`;
  await writeFile(join(out, name), bytes);
  if (kind === "theme") {
    const verify = unzipSync(bytes);
    if (!verify["dist/index.html"] || !verify["komari-theme.json"])
      throw new Error("Invalid archive layout");
  }
  release.files.push({
    name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
await writeFile(
  join(out, "manifest.json"),
  JSON.stringify(release, null, 2) + "\n",
);
console.log(JSON.stringify(release, null, 2));
await writeFile(
  join(out, "SHA256SUMS"),
  release.files.map((f) => `${f.sha256}  ${f.name}`).join("\n") + "\n",
);
