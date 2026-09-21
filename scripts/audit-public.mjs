import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { unzipSync } from "fflate";
const skip = new Set([
  ".git",
  "node_modules",
  ".local",
  "dist",
  "releases",
  "test-results",
  "playwright-report",
]);
let inspected = 0;
const forbidden = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /C:[\\/]Users[\\/](?!Public[\\/])/,
];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else {
      if (/\.sqlite(?:-|$)|\.db(?:-|$)|\.env$|\.pem$/.test(e.name))
        throw Error("Runtime or private file: " + p);
      if (/\.(md|ts|tsx|json|yml|yaml|html|mjs|css|txt)$/.test(e.name)) {
        const text = await readFile(p, "utf8");
        if (forbidden.some((r) => r.test(text)))
          throw Error("Private material pattern: " + p);
        inspected++;
      }
    }
  }
}
await walk(".");
if (process.argv.includes("--packages")) {
  const manifest = JSON.parse(await readFile("releases/manifest.json", "utf8"));
  for (const item of manifest.files) {
    const files = unzipSync(await readFile("releases/" + item.name));
    for (const path of Object.keys(files))
      if (
        /(^|\/)(?:\.git|\.local|node_modules)(\/|$)|\.(?:sqlite|db)$/.test(path)
      )
        throw Error("Private archive entry " + path);
    if (!files.LICENSE) throw Error("Missing license: " + item.name);
  }
}
console.log(
  "Public-tree audit passed: " +
    inspected +
    " text files; no runtime/private-file patterns.",
);
