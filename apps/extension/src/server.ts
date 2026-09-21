import Fastify from "fastify";
import multipart from "@fastify/multipart";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, writeFile, unlink, rename, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { z } from "zod";
import {
  API,
  VERSION,
  playlistSchema,
  type Job,
  type JobKind,
  type MediaItem,
} from "../../../packages/contracts";
import { Store } from "./store";
import { HttpError, type Backend } from "./komari";
import type { Transcoder } from "./transcode";
import { downloadRemoteMedia } from "./media-import";
import { createExchangeService } from "./exchange";
import { ipResultState } from "../../../packages/contracts/ip-result";
export interface ExtensionOptions {
  directory: string;
  publicOrigin: string;
  backend: Backend;
  enableJobs?: boolean;
  maxUploadBytes?: number;
  transcoder?: Transcoder;
  downloadMedia?: (url: string, maxBytes: number) => Promise<Buffer>;
  rateRequest?: typeof fetch;
}
export function sniff(
  buffer: Buffer,
): { extension: string; type: string; kind: "image" | "video" } | null {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { extension: "png", type: "image/png", kind: "image" };
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return { extension: "jpg", type: "image/jpeg", kind: "image" };
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  )
    return { extension: "webp", type: "image/webp", kind: "image" };
  if (buffer.toString("ascii", 4, 8) === "ftyp")
    return { extension: "mp4", type: "video/mp4", kind: "video" };
  if (buffer.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])))
    return { extension: "webm", type: "video/webm", kind: "video" };
  return null;
}
export async function buildExtension(options: ExtensionOptions) {
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024 });
  const store = new Store(options.directory);
  const exchange = createExchangeService(
    {
      get: () => store.readConfig("exchange-rates"),
      set: (value) => store.writeConfig("exchange-rates", value),
    },
    options.rateRequest,
  );
  store.prune();
  const mediaDir = resolve(options.directory, "media");
  await mkdir(mediaDir, { recursive: true });
  const secret = randomBytes(32);
  const active = new Map<string, Promise<void>>();
  const cooldown = new Map<string, number>();
  const csrf = (cookie: string) =>
    createHmac("sha256", secret).update(cookie).digest("hex");
  const origin = new URL(options.publicOrigin).origin;
  await app.register(multipart, {
    limits: {
      fileSize: options.maxUploadBytes ?? 100 * 1024 ** 2,
      files: 1,
      fields: 0,
    },
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    if (!reply.hasHeader("Cache-Control"))
      reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.setErrorHandler((e: any, _req, reply) => {
    const status = e instanceof z.ZodError ? 400 : (e.statusCode ?? 500);
    reply.code(status).send({
      error: status >= 500 ? "服务请求失败，请检查扩展服务配置" : e.message,
    });
  });
  async function auth(req: any) {
    const cookie = req.headers.cookie ?? "";
    const viewer = await options.backend.viewer(cookie);
    if (!viewer.logged_in) throw new HttpError(401, "请先登录");
    return { cookie, owner: viewer.uuid ?? viewer.username };
  }
  async function writeAuth(req: any) {
    const session = await auth(req);
    if (req.headers.origin !== origin) throw new HttpError(403, "来源校验失败");
    const supplied = String(req.headers["x-ds-csrf"] ?? "");
    const expected = csrf(session.cookie);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
    )
      throw new HttpError(403, "请刷新页面后重试");
    return session;
  }
  async function nodeAuth(req: any, node: string) {
    const session = await auth(req);
    const nodes = await options.backend.nodes(session.cookie);
    if (!Object.values(nodes).some((n) => n.uuid === node))
      throw new HttpError(404, "节点不存在或不可见");
    return session;
  }
  app.get(`${API}/capabilities`, async () => ({
    version: VERSION,
    media: true,
    remoteImport: true,
    transcode: !!options.transcoder,
    ip: !!options.enableJobs,
    unlock: !!options.enableJobs,
    services: !!options.enableJobs,
    traffic: false,
    exchangeRates: true,
  }));
  app.get(`${API}/exchange-rates`, async (req, reply) => {
    try {
      return await exchange.get(
        (req.query as { fresh?: string }).fresh === "1",
      );
    } catch {
      throw new HttpError(503, "汇率服务暂不可用，请稍后重试");
    }
  });
  app.get(`${API}/session`, async (req) => {
    const { cookie } = await auth(req);
    return { csrf: csrf(cookie) };
  });
  app.get(`${API}/playlist`, async () => store.playlist());
  app.put(`${API}/playlist`, async (req) => {
    await writeAuth(req);
    const data = playlistSchema.parse(req.body);
    const ids = new Set<string>();
    for (const item of data.items) {
      if (ids.has(item.id)) throw new HttpError(400, "媒体 ID 重复");
      ids.add(item.id);
      if (
        item.url.startsWith(`${API}/media/`) &&
        !store.media().some((m) => m.id === item.id && m.url === item.url)
      )
        throw new HttpError(400, "媒体文件不存在");
    }
    store.savePlaylist(data);
    return data;
  });
  app.get(`${API}/media`, async (req) => {
    await auth(req);
    return store.media();
  });
  let importing = false;
  app.post(`${API}/media/import`, async (req) => {
    await writeAuth(req);
    const body = z
      .object({ url: z.string().url().max(2048) })
      .strict()
      .parse(req.body);
    if (importing) throw new HttpError(409, "已有背景正在下载");
    importing = true;
    try {
      const max = options.maxUploadBytes ?? 100 * 1024 ** 2;
      const buffer = await (options.downloadMedia ?? downloadRemoteMedia)(
        body.url,
        max,
      );
      if (buffer.length > max) throw new HttpError(413, "媒体文件超过大小限制");
      const format = sniff(buffer);
      if (!format) throw new HttpError(415, "链接不是受支持的图片或视频文件");
      const id = randomUUID(),
        filename = `${id}.${format.extension}`,
        path = resolve(mediaDir, filename),
        partial = path + ".partial";
      await writeFile(partial, buffer, { flag: "wx" });
      await rename(partial, path);
      let name = "背景";
      try {
        name = decodeURIComponent(
          new URL(body.url).pathname.split("/").pop() || name,
        ).slice(0, 160);
      } catch {}
      const item: MediaItem = {
        id,
        url: `${API}/media/${filename}`,
        kind: format.kind,
        name,
        duration: 10,
      };
      try {
        store.putMedia(item);
      } catch (error) {
        await unlink(path);
        throw error;
      }
      return item;
    } finally {
      importing = false;
    }
  });
  let transcoding = false;
  app.post(`${API}/media/:id/transcode`, async (req) => {
    await writeAuth(req);
    if (!options.transcoder) throw new HttpError(503, "未配置 FFmpeg");
    if (transcoding) throw new HttpError(409, "已有视频正在转码");
    const item = store.media().find((m) => m.id === (req.params as any).id);
    if (!item || item.kind !== "video") throw new HttpError(404, "视频不存在");
    const input = resolve(mediaDir, basename(item.url));
    const id = randomUUID();
    const output = resolve(mediaDir, `${id}.mp4`);
    transcoding = true;
    try {
      await options.transcoder(input, output);
      const converted: MediaItem = {
        ...item,
        id,
        url: `${API}/media/${id}.mp4`,
        name: item.name + " (H.264)",
      };
      store.putMedia(converted);
      return converted;
    } catch (e) {
      await unlink(output).catch(() => {});
      throw new HttpError(422, (e as Error).message);
    } finally {
      transcoding = false;
    }
  });
  app.post(`${API}/media`, async (req) => {
    await writeAuth(req);
    const file = await req.file();
    if (!file) throw new HttpError(400, "缺少媒体文件");
    const buffer = await file.toBuffer();
    const format = sniff(buffer);
    if (!format) throw new HttpError(415, "只支持 JPEG、PNG、WebP、MP4、WebM");
    const id = randomUUID();
    const filename = `${id}.${format.extension}`;
    const path = resolve(mediaDir, filename);
    const partial = path + ".partial";
    await writeFile(partial, buffer, { flag: "wx" });
    await rename(partial, path);
    const item: MediaItem = {
      id,
      url: `${API}/media/${filename}`,
      kind: format.kind,
      name: basename(file.filename).slice(0, 160),
      duration: 10,
    };
    try {
      store.putMedia(item);
    } catch (e) {
      await unlink(path);
      throw e;
    }
    return item;
  });
  app.get(`${API}/media/:filename`, async (req, reply) => {
    const filename = (req.params as any).filename;
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm)$/.test(filename))
      throw new HttpError(404, "媒体不存在");
    const item = store
      .media()
      .find((i) => i.url === `${API}/media/${filename}`);
    if (!item) throw new HttpError(404, "媒体不存在");
    const path = resolve(mediaDir, filename);
    if (!path.startsWith(mediaDir + sep)) throw new HttpError(400, "路径错误");
    const info = await stat(path);
    const types: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      webp: "image/webp",
      mp4: "video/mp4",
      webm: "video/webm",
    };
    reply.type(types[filename.split(".").pop()]);
    reply
      .header("Accept-Ranges", "bytes")
      .header("Cache-Control", "public, max-age=31536000, immutable");
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match)
        return reply
          .code(416)
          .header("Content-Range", `bytes */${info.size}`)
          .send();
      const start = Number(match[1]),
        end = match[2]
          ? Math.min(Number(match[2]), info.size - 1)
          : info.size - 1;
      if (start > end || start >= info.size)
        return reply
          .code(416)
          .header("Content-Range", `bytes */${info.size}`)
          .send();
      return reply
        .code(206)
        .header("Content-Range", `bytes ${start}-${end}/${info.size}`)
        .header("Content-Length", end - start + 1)
        .send(createReadStream(path, { start, end }));
    }
    return reply
      .header("Content-Length", info.size)
      .send(createReadStream(path));
  });
  app.delete(`${API}/media/:id`, async (req) => {
    await writeAuth(req);
    const id = (req.params as any).id;
    const item = store.media().find((m) => m.id === id);
    if (!item) throw new HttpError(404, "媒体不存在");
    const path = resolve(mediaDir, basename(item.url));
    if (!path.startsWith(mediaDir + sep)) throw new HttpError(400, "路径错误");
    await unlink(path).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
    store.removeMedia(id);
    return { ok: true };
  });
  app.get(`${API}/jobs/latest`, async (req) => {
    const query = z
      .object({
        node: z.string().min(1).max(128),
        kind: z.enum(["ip", "unlock", "services"]),
      })
      .parse(req.query);
    const { owner } = await nodeAuth(req, query.node);
    return store.latest(query.node, query.kind, owner);
  });
  app.get(`${API}/jobs/:id`, async (req) => {
    const { owner } = await auth(req);
    const job = store.getJob((req.params as any).id, owner);
    if (!job) throw new HttpError(404, "任务不存在");
    await nodeAuth(req, job.nodeId);
    return job;
  });
  app.post(`${API}/jobs`, async (req, reply) => {
    const session = await writeAuth(req);
    if (!options.enableJobs) throw new HttpError(503, "任务模块未启用");
    const body = z
      .object({
        nodeId: z.string().min(1).max(128),
        kind: z.enum(["ip", "unlock", "services"]),
      })
      .strict()
      .parse(req.body);
    await nodeAuth(req, body.nodeId);
    const key = `${session.owner}:${body.nodeId}:${body.kind}`;
    if (active.size >= 4 || active.has(key))
      throw new HttpError(409, "已有任务进行中");
    if (Date.now() - (cooldown.get(key) ?? 0) < 30000)
      throw new HttpError(429, "请稍后再试");
    cooldown.set(key, Date.now());
    const job: Job = {
      id: randomUUID(),
      nodeId: body.nodeId,
      kind: body.kind as JobKind,
      state: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.putJob(job, session.owner);
    const execute = async () => {
      await new Promise((r) => setTimeout(r, 5));
      job.state = "running";
      job.updatedAt = new Date().toISOString();
      store.putJob(job, session.owner);
      try {
        job.result = await options.backend.run(
          job.nodeId,
          job.kind,
          session.cookie,
        );
        job.state = job.kind === "ip" ? ipResultState(job.result) : "done";
      } catch (e) {
        job.state = "failed";
        job.error = (e as Error).message.slice(0, 500);
      } finally {
        job.updatedAt = new Date().toISOString();
        store.putJob(job, session.owner);
        active.delete(key);
      }
    };
    active.set(key, execute());
    return reply.code(202).send({ ...job });
  });
  app.addHook("onClose", async () => {
    await Promise.allSettled(active.values());
    store.close();
  });
  return app;
}
