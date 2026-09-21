import { afterEach, describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildExtension } from "../../apps/extension/src/server";
import { API, emptyPlaylist } from "../../packages/contracts";
import { Store } from "../../apps/extension/src/store";
import { parseProbe, parseIP } from "../../apps/extension/src/komari";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0).reverse()) await fn();
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "komari-ds-test-"));
  let calls = 0;
  const app = await buildExtension({
    directory,
    publicOrigin: "http://localhost:5173",
    enableJobs: true,
    backend: {
      viewer: async (cookie) => ({
        logged_in: cookie === "session=admin" || cookie === "session=other",
        username: cookie,
      }),
      nodes: async () => ({ a: { uuid: "a", name: "Visible" } }),
      run: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 10));
        return "fixed snapshot";
      },
    },
  });
  await app.ready();
  cleanups.push(
    () => rm(directory, { recursive: true, force: true }),
    () => app.close(),
  );
  const session = await app.inject({
    url: API + "/session",
    headers: { cookie: "session=admin" },
  });
  const headers = {
    cookie: "session=admin",
    origin: "http://localhost:5173",
    "x-ds-csrf": session.json().csrf,
  };
  return { app, headers, directory, getCalls: () => calls };
}
describe("extension permission and storage boundaries", () => {
  it("parses independent IP families without inventing IP quality scores", () => {
    const result = parseIP(
      '=== IPV4 ===\n{"ip":"192.0.2.1","country":"US"}\n=== IPV6 ===\ncurl: network unreachable',
    );
    expect(result.ipv4.country).toBe("US");
    expect(result.ipv6).toBeNull();
    expect(result.quality).toBeNull();
  });
  it("rejects guests, cross-site writes, absent CSRF, arbitrary commands, and hidden node jobs", async () => {
    const { app, headers, getCalls } = await setup();
    expect((await app.inject({ url: API + "/session" })).statusCode).toBe(401);
    for (const h of [
      { cookie: "session=admin" },
      { ...headers, origin: "https://evil.example" },
    ])
      expect(
        (
          await app.inject({
            method: "PUT",
            url: API + "/playlist",
            headers: h,
            payload: emptyPlaylist,
          })
        ).statusCode,
      ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: API + "/jobs",
          headers,
          payload: { nodeId: "a", kind: "services", command: "rm" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: API + "/jobs",
          headers,
          payload: { nodeId: "hidden", kind: "services" },
        })
      ).statusCode,
    ).toBe(404);
    expect(getCalls()).toBe(0);
  });
  it("executes only on explicit POST, keeps owner-scoped results, and deduplicates jobs", async () => {
    const { app, headers, getCalls } = await setup();
    await app.inject({
      url: API + "/jobs/latest?node=a&kind=services",
      headers,
    });
    expect(getCalls()).toBe(0);
    const submitted = await app.inject({
      method: "POST",
      url: API + "/jobs",
      headers,
      payload: { nodeId: "a", kind: "services" },
    });
    expect(submitted.statusCode).toBe(202);
    const id = submitted.json().id;
    expect(
      (
        await app.inject({
          method: "POST",
          url: API + "/jobs",
          headers,
          payload: { nodeId: "a", kind: "services" },
        })
      ).statusCode,
    ).toBe(409);
    await new Promise((r) => setTimeout(r, 40));
    expect(
      (await app.inject({ url: API + "/jobs/" + id, headers })).json().state,
    ).toBe("done");
    expect(getCalls()).toBe(1);
    expect(
      (
        await app.inject({
          url: API + "/jobs/" + id,
          headers: { cookie: "session=other" },
        })
      ).statusCode,
    ).toBe(404);
  });
  it("validates media content independently of filename, and serves byte ranges", async () => {
    const { app, headers } = await setup();
    const boundary = "dsBoundary";
    const upload = (name: string, type: string, data: Buffer) =>
      Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`,
        ),
        data,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
    const h = {
      ...headers,
      "content-type": `multipart/form-data; boundary=${boundary}`,
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: API + "/media",
          headers: h,
          payload: upload(
            "pretend.png",
            "image/png",
            Buffer.from("<svg onload=alert(1)>"),
          ),
        })
      ).statusCode,
    ).toBe(415);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a01kAAAAASUVORK5CYII=",
      "base64",
    );
    const res = await app.inject({
      method: "POST",
      url: API + "/media",
      headers: h,
      payload: upload("../../outside.png", "image/png", png),
    });
    expect(res.statusCode).toBe(200);
    const item = res.json();
    const media = await app.inject({
      url: item.url,
      headers: { range: "bytes=0-7" },
    });
    expect(media.statusCode).toBe(206);
    expect(media.rawPayload).toEqual(png.subarray(0, 8));
    expect(media.headers["content-type"]).toContain("image/png");
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: API + "/media/" + item.id,
          headers,
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject({ url: item.url })).statusCode).toBe(404);
  });
  it("persists separate versioned playlists and never auto-restarts interrupted commands", async () => {
    const directory = await mkdtemp(join(tmpdir(), "komari-ds-store-"));
    cleanups.push(() => rm(directory, { recursive: true, force: true }));
    const store = new Store(directory);
    store.savePlaylist({ ...emptyPlaylist, interval: 25 });
    store.putJob(
      {
        id: "j",
        nodeId: "a",
        kind: "services",
        state: "running",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      "owner",
    );
    store.close();
    const reopened = new Store(directory);
    expect(reopened.playlist().interval).toBe(25);
    expect(reopened.getJob("j", "owner")?.state).toBe("failed");
    reopened.close();
  });
  it("never calls an HTTP 200 a confirmed streaming unlock", () => {
    const r = parseProbe("Netflix|IPv4|200\nClaude|IPv6|403\n");
    expect(r.services[0].status).toContain("待确认");
    expect(r.services[1].status).toContain("验证");
  });
});
