import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const root = resolve(".local", "source-verification-" + Date.now());
await mkdir(root, { recursive: true });
const files = unzipSync(
  await readFile(`releases/komari-next-pro-${version}-source.zip`),
);
for (const [name, bytes] of Object.entries(files)) {
  const path = resolve(root, name);
  if (!path.startsWith(root + sep)) throw Error("Unsafe archive entry");
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, bytes);
}
const npm = process.env.npm_execpath;
if (!npm) throw Error("Use npm run verify:source");
async function run(args) {
  const env = { ...process.env };
  for (const k of Object.keys(env))
    if (k.toLowerCase() === "npm_config_allow_scripts") delete env[k];
  const child = spawn(process.execPath, [npm, ...args], {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (b) => (log += b));
  child.stderr.on("data", (b) => (log += b));
  const code = await new Promise((r, j) => {
    child.on("exit", r);
    child.on("error", j);
  });
  await writeFile(join(root, args[0] + ".log"), log);
  if (code !== 0)
    throw Error(
      "Clean " +
        args.join(" ") +
        " failed; inspect the local verification logs.",
    );
  console.log(args.join(" ") + " passed");
}
await run(["ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
await run(["run", "build"]);
await run(["run", "docs:build"]);
const theme = unzipSync(
  await readFile(`releases/komari-next-pro-${version}-theme.zip`),
);
let count = 0;
for (const [path, expected] of Object.entries(theme)) {
  if (!path.startsWith("dist/")) continue;
  const actual = await readFile(join(root, path));
  const hash = (b) => createHash("sha256").update(b).digest("hex");
  if (hash(actual) !== hash(expected)) throw Error("Output differs: " + path);
  count++;
}
await writeFile(
  ".local/source-verification.json",
  JSON.stringify(
    { version, install: true, build: true, matchedOutputFiles: count },
    null,
    2,
  ),
);
console.log(
  "Source ZIP rebuild matches " + count + " packaged production files.",
);
