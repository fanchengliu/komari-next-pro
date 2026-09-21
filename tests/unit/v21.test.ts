import { it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { isLongTerm, expiryText } from "../../apps/theme/src/domain/model";
import {
  isPublicAddress,
  resolvePublicMediaUrl,
} from "../../apps/extension/src/media-import";
import { buildExtension } from "../../apps/extension/src/server";
import { API, emptyPlaylist, type NodeInfo } from "../../packages/contracts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
it("uses a strict calendar ten-year boundary consistently, including leap years", () => {
  const now = Date.parse("2024-02-29T12:00:00Z");
  const boundary = new Date(now);
  boundary.setUTCFullYear(2034);
  const node = (time: number) =>
    ({ expires: new Date(time).toISOString() }) as NodeInfo;
  expect(isLongTerm(node(+boundary), now)).toBe(false);
  expect(isLongTerm(node(+boundary + 1), now)).toBe(true);
  expect(expiryText(node(+boundary + 86400000), now)).toBe("长期");
  expect(expiryText({ expires: null } as NodeInfo, now)).toBe("--");
  expect(expiryText(node(now - 86400000), now)).toBe("已过期");
});
it("rejects local, metadata, mapped IPv4 and mixed DNS destinations while allowing public hosts", async () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "172.31.0.1",
    "192.168.0.1",
    "100.64.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:a9fe:a9fe",
    "fc00::1",
    "fe80::1",
    "64:ff9b::7f00:1",
  ])
    expect(isPublicAddress(address), address).toBe(false);
  expect(isPublicAddress("1.1.1.1")).toBe(true);
  expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  for (const url of [
    "http://2130706433/a.jpg",
    "http://localhost/a.jpg",
    "http://[::1]/a.jpg",
    "https://user:secret@example.com/a.jpg",
    "file:///etc/passwd",
    "http://example.com:5175/a.jpg",
  ])
    await expect(
      resolvePublicMediaUrl(url, async () => [
        { address: "127.0.0.1", family: 4 },
      ]),
    ).rejects.toThrow();
  await expect(
    resolvePublicMediaUrl("https://example.com/a", async () => [
      { address: "1.1.1.1", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]),
  ).rejects.toThrow();
  expect(
    (
      await resolvePublicMediaUrl("https://example.com/a", async () => [
        { address: "1.1.1.1", family: 4 },
      ])
    ).address.address,
  ).toBe("1.1.1.1");
});
it("imports authenticated media to a local URL, persists hold selection, rejects wrong signatures and unauthenticated imports", async () => {
  const directory = await mkdtemp(join(tmpdir(), "komari-ds-v21-"));
  if (
    !resolve(directory).startsWith(resolve(tmpdir()) + sep + "komari-ds-v21-")
  )
    throw Error("Unsafe temp path");
  let downloads = 0;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a01kAAAAASUVORK5CYII=",
    "base64",
  );
  const app = await buildExtension({
    directory,
    publicOrigin: "http://localhost",
    downloadMedia: async (url) => {
      downloads++;
      return url.includes("bad")
        ? Buffer.from("<html>not an image</html>")
        : png;
    },
    backend: {
      viewer: async (cookie) => ({
        logged_in: cookie === "session=admin",
        username: "admin",
      }),
      nodes: async () => ({}),
      run: async () => null,
    },
  });
  await app.ready();
  cleanup.push(
    () => rm(directory, { recursive: true, force: true }),
    () => app.close(),
  );
  const session = await app.inject({
    url: API + "/session",
    headers: { cookie: "session=admin" },
  });
  const headers = {
    cookie: "session=admin",
    origin: "http://localhost",
    "x-ds-csrf": session.json().csrf,
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: API + "/media/import",
        payload: { url: "https://example.com/a.png" },
      })
    ).statusCode,
  ).toBe(401);
  expect(downloads).toBe(0);
  const imported = await app.inject({
    method: "POST",
    url: API + "/media/import",
    headers,
    payload: { url: "https://example.com/photo.png" },
  });
  expect(imported.statusCode).toBe(200);
  const item = imported.json();
  expect(item.url).toMatch(/^\/komari-ds-api\/v1\/media\/[\w-]+\.png$/);
  expect(item.url).not.toContain("example.com");
  expect((await app.inject({ url: item.url })).rawPayload).toEqual(png);
  const playlist = {
    ...emptyPlaylist,
    mode: "image",
    order: "hold",
    selectedId: item.id,
    items: [item],
  };
  expect(
    (
      await app.inject({
        method: "PUT",
        url: API + "/playlist",
        headers,
        payload: playlist,
      })
    ).statusCode,
  ).toBe(200);
  expect((await app.inject({ url: API + "/playlist" })).json()).toEqual(
    playlist,
  );
  expect(
    (
      await app.inject({
        method: "POST",
        url: API + "/media/import",
        headers,
        payload: { url: "https://example.com/bad.html" },
      })
    ).statusCode,
  ).toBe(415);
  expect(
    (await app.inject({ url: API + "/media", headers })).json(),
  ).toHaveLength(1);
});
