import {
  cp,
  mkdir,
  writeFile,
  readdir,
  readFile,
  unlink,
  rmdir,
} from "node:fs/promises";
import { resolve, join, sep, relative } from "node:path";
const root = process.cwd(),
  source = resolve("site/.vitepress/dist"),
  dest = resolve("theme/public");
if (
  !source.startsWith(root + sep) ||
  !dest.startsWith(root + sep) ||
  relative(root, dest) !== join("theme", "public")
)
  throw Error("Unexpected documentation output path");
await mkdir(dest, { recursive: true });
const keep = new Set();
async function copy(dir, prefix = "") {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + e.name;
    if (e.isDirectory()) await copy(join(dir, e.name), name + "/");
    else {
      keep.add(name);
      await mkdir(resolve(dest, name, ".."), { recursive: true });
      await cp(join(dir, e.name), join(dest, name));
    }
  }
}
await copy(source);
keep.add("vercel.json");
await writeFile(
  join(dest, "vercel.json"),
  JSON.stringify(
    {
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework: null,
      buildCommand: "",
      installCommand: "",
      outputDirectory: ".",
      cleanUrls: true,
    },
    null,
    2,
  ) + "\n",
);
// Remove only obsolete files in the verified generated output directory.
async function prune(dir, prefix = "") {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + e.name,
      path = join(dir, e.name);
    if (e.isDirectory()) {
      await prune(path, name + "/");
      if (!(await readdir(path)).length) await rmdir(path);
    } else if (!keep.has(name)) await unlink(path);
  }
}
await prune(dest);
await mkdir("theme", { recursive: true });
await writeFile(
  "theme/vercel.json",
  JSON.stringify(
    {
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework: null,
      buildCommand: "",
      installCommand: "",
      outputDirectory: "public",
      cleanUrls: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Documentation copied to legacy-compatible theme/public (${keep.size} files).`,
);
