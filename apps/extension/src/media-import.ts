import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import { HttpError } from "./komari";
const blocked = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, prefix, "ipv4");
for (const [ip, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["2001::", 32],
  ["2002::", 16],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
] as const)
  blocked.addSubnet(ip, prefix, "ipv6");
export const isPublicAddress = (address: string) => {
  const family = isIP(address);
  return !!family && !blocked.check(address, family === 6 ? "ipv6" : "ipv4");
};
type Address = { address: string; family: number };
export async function resolvePublicMediaUrl(
  raw: string,
  resolveHost: (host: string) => Promise<Address[]> = (host) =>
    lookup(host, { all: true, verbatim: true }),
) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "请输入有效的 HTTP(S) 链接");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new HttpError(400, "仅支持不含账号密码的 HTTP(S) 链接");
  if (url.port && !["80", "443"].includes(url.port))
    throw new HttpError(400, "背景下载仅支持标准 HTTP(S) 端口");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await resolveHost(host);
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new HttpError(400, "背景下载仅允许公开互联网地址");
  return { url, address: addresses[0] };
}
/** Resolves and pins the destination on every hop; never forwards site cookies or credentials. */
export async function downloadRemoteMedia(
  raw: string,
  maxBytes = 100 * 1024 ** 2,
): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const aborted = new Promise<never>((_, reject) =>
    controller.signal.addEventListener(
      "abort",
      () => reject(new HttpError(408, "下载超时，请使用较小文件或直接上传")),
      { once: true },
    ),
  );
  async function step(target: string, redirects = 0): Promise<Buffer> {
    const { url, address } = await resolvePublicMediaUrl(target);
    controller.signal.throwIfAborted();
    return new Promise<Buffer>((resolve, reject) => {
      const requester = url.protocol === "https:" ? https : http;
      const request = requester.request(
        url,
        {
          method: "GET",
          agent: false,
          signal: controller.signal,
          headers: {
            Accept: "image/*,video/*",
            "User-Agent": "komari-ds-media/2.1",
            "Accept-Encoding": "identity",
          },
          lookup: (_host, options, callback) => {
            if ((options as { all?: boolean }).all)
              callback(null, [address] as any);
            else callback(null, address.address, address.family);
          },
        },
        (response) => {
          const status = response.statusCode ?? 0;
          if ([301, 302, 303, 307, 308].includes(status)) {
            response.destroy();
            if (redirects >= 4 || !response.headers.location) {
              reject(new HttpError(400, "下载重定向次数过多"));
              return;
            }
            let next: string;
            try {
              next = new URL(response.headers.location, url).href;
            } catch {
              reject(new HttpError(400, "下载重定向地址无效"));
              return;
            }
            void step(next, redirects + 1).then(resolve, reject);
            return;
          }
          if (status < 200 || status >= 300) {
            response.destroy();
            reject(new HttpError(422, `链接返回 HTTP ${status}`));
            return;
          }
          if (Number(response.headers["content-length"] ?? 0) > maxBytes) {
            response.destroy();
            reject(new HttpError(413, "媒体文件超过大小限制"));
            return;
          }
          if (
            response.headers["content-encoding"] &&
            response.headers["content-encoding"] !== "identity"
          ) {
            response.destroy();
            reject(new HttpError(415, "请使用直接媒体文件链接"));
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          response.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              response.destroy();
              reject(new HttpError(413, "媒体文件超过大小限制"));
            } else chunks.push(chunk);
          });
          response.on("end", () => resolve(Buffer.concat(chunks, size)));
          response.on("error", reject);
          response.on("aborted", () =>
            reject(new HttpError(422, "下载连接中断")),
          );
        },
      );
      request.setTimeout(15000, () =>
        request.destroy(new HttpError(408, "下载连接超时")),
      );
      request.on("error", reject);
      request.end();
    });
  }
  try {
    return await Promise.race([step(raw), aborted]);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(422, "无法下载该链接，请检查链接是否公开可访问");
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
