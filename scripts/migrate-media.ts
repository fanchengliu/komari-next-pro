import {
  readFile,
  copyFile,
  mkdir,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve, relative, basename, sep, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { Store } from "../apps/extension/src/store";
import { API, playlistSchema, type MediaItem } from "../packages/contracts";
const args = Object.fromEntries(
  process.argv.slice(2).map((v) => {
    const index = v.indexOf("=");
    return index === -1
      ? [v.replace(/^--/, ""), "true"]
      : [v.slice(0, index).replace(/^--/, ""), v.slice(index + 1)];
  }),
);
if (!args.config || !args["source-dir"] || !args["data-dir"])
  throw new Error(
    "Usage: tsx scripts/migrate-media.ts --config=export.json --source-dir=old-media --data-dir=new-ds-data [--apply]",
  );
const source = await realpath(args["source-dir"]);
const destination = resolve(args["data-dir"]);
const rel = relative(source, destination);
if (
  rel === "" ||
  (!rel.startsWith(".." + sep) && rel !== ".." && !isAbsolute(rel))
)
  throw new Error("Destination must be outside source directory");
const exported = JSON.parse(await readFile(args.config, "utf8"));
const config = exported.config ?? exported;
const items: MediaItem[] = [];
const copies: { from: string; to: string; sha256: string; bytes: number }[] =
  [];
for (const [kind, urls] of [
  ["image", config.images ?? []],
  ["video", config.videos ?? []],
] as const) {
  for (const url of urls) {
    const name = basename(String(url));
    if (!/\.(jpg|jpeg|png|webp|mp4|webm)$/i.test(name))
      throw new Error("Unsupported media: " + name);
    const from = await realpath(
      resolve(source, kind === "image" ? "images" : "videos", name),
    );
    if (!from.startsWith(source + sep))
      throw new Error("Source escapes directory");
    const buffer = await readFile(from);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const id = `${sha256.slice(0, 8)}-${sha256.slice(8, 12)}-${sha256.slice(12, 16)}-${sha256.slice(16, 20)}-${sha256.slice(20, 32)}`;
    const extension = name
      .split(".")
      .pop()!
      .toLowerCase()
      .replace("jpeg", "jpg");
    const target = `${id}.${extension}`;
    const to = resolve(destination, "media", target);
    if (items.some((i) => i.id === id)) continue;
    items.push({ id, url: `${API}/media/${target}`, kind, name, duration: 10 });
    copies.push({ from, to, sha256, bytes: buffer.length });
  }
}
const playlist = playlistSchema.parse({
  version: 1,
  mode: config.mode ?? "video",
  order: config.videoOrderMode ?? "rotation",
  videoTiming: config.videoTimingMode ?? "full",
  interval: config.intervalSeconds ?? 10,
  items,
});
if (args.apply === "true") {
  await mkdir(destination, { recursive: true });
  const actual = await realpath(destination);
  if (actual === source || actual.startsWith(source + sep))
    throw new Error("Resolved destination aliases source");
  const store = new Store(actual);
  try {
    if (store.media().length || store.playlist().items.length)
      throw new Error(
        "Destination already contains media; use a fresh data directory",
      );
    await mkdir(resolve(actual, "media"), { recursive: true });
    for (let i = 0; i < copies.length; i++) {
      await copyFile(copies[i].from, copies[i].to, 1);
      store.putMedia(items[i]);
    }
    store.savePlaylist(playlist);
    await writeFile(
      resolve(actual, "migration-report.json"),
      JSON.stringify(
        { createdAt: new Date().toISOString(), source, copies },
        null,
        2,
      ),
    );
  } finally {
    store.close();
  }
}
console.log(
  JSON.stringify(
    {
      mode: args.apply === "true" ? "copied" : "dry-run",
      source,
      destination,
      items: items.length,
      totalBytes: copies.reduce((s, x) => s + x.bytes, 0),
    },
    null,
    2,
  ),
);
