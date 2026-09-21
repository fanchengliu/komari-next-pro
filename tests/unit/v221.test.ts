import { it, expect } from "vitest";
import { parseIP, fixedCommands } from "../../apps/extension/src/komari";
import { enrichQuality } from "../../apps/extension/src/ip-quality";
import {
  ipResultState,
  ipFamilyDiagnostic,
  qualityDiagnostic,
  abuseFraction,
} from "../../packages/contracts/ip-result";
import { createFlagLayout } from "../../apps/theme/src/features/globe/flag-layout";
import { buildExtension } from "../../apps/extension/src/server";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { API } from "../../packages/contracts";
const valid =
  '=== IPV4 ===\n{"ip":"192.0.2.1","country":"US"}\nDS_HTTP:200\nDS_EXIT:0\n=== IPV6 ===\n';
it("uses the IPv6 endpoint and records each curl exit/HTTP code", () => {
  expect(fixedCommands.ip).toContain("https://v6.ipinfo.io/json");
  expect(fixedCommands.ip.match(/DS_EXIT/g)).toHaveLength(2);
  const r = parseIP(
    valid + "curl: (6) Could not resolve host\nDS_HTTP:000\nDS_EXIT:6",
  );
  expect(r.ipv4.ip).toBe("192.0.2.1");
  expect(r.ipv6).toBeNull();
  expect(r.diagnostics.ipv6).toEqual({
    state: "failed",
    reason: "dns",
    exitCode: 6,
    httpStatus: 0,
  });
  expect(ipResultState(r)).toBe("partial");
});
it("rejects provider errors, malformed output and wrong IP families even if shell exits zero", () => {
  for (const output of [
    '=== IPV4 ===\n{"error":"quota"}\nDS_HTTP:429\nDS_EXIT:0\n=== IPV6 ===\n',
    '=== IPV4 ===\n{"ip":"2001:db8::1"}\n=== IPV6 ===\n<html>fail</html>',
    "garbage",
  ]) {
    const r = parseIP(output);
    expect(ipResultState(r)).toBe("failed");
    expect(r.ipv4).toBeNull();
    expect(r.ipv6).toBeNull();
  }
  expect(
    parseIP(valid + "curl: (28) timeout\nDS_EXIT:28").diagnostics.ipv6.reason,
  ).toBe("timeout");
  expect(ipResultState("invalid")).toBe("failed");
});
it("distinguishes missing credentials, rate limits and valid false/zero quality fields", async () => {
  const metadata = parseIP(
    valid + '{"ip":"2001:db8::1"}\nDS_HTTP:200\nDS_EXIT:0',
  );
  const unconfigured = await enrichQuality(metadata, undefined, () => {
    throw Error("must not fetch");
  });
  expect(qualityDiagnostic(unconfigured, "ipv4").state).toBe("not_configured");
  expect(ipResultState(unconfigured)).toBe("partial");
  const request = (async () =>
    new Response(
      JSON.stringify({
        is_vpn: false,
        is_proxy: false,
        is_tor: false,
        is_datacenter: true,
        is_abuser: false,
        company: { abuser_score: "0 (Very Low)" },
        key: "no-leak",
      }),
    )) as typeof fetch;
  const good = await enrichQuality(metadata, "secret", request);
  expect(ipResultState(good)).toBe("done");
  expect((good.quality as any).ipv4.network_abuser_score).toBe(0);
  expect(JSON.stringify(good)).not.toContain("secret");
  expect(JSON.stringify(good)).not.toContain("no-leak");
  const unavailable = await enrichQuality(
    metadata,
    "secret",
    (async () =>
      new Response(JSON.stringify({ country: "US" }))) as typeof fetch,
  );
  expect(qualityDiagnostic(unavailable, "ipv4").state).toBe("unavailable");
  const limited = await enrichQuality(
    metadata,
    "secret",
    (async () => new Response("", { status: 429 })) as typeof fetch,
  );
  expect(qualityDiagnostic(limited, "ipv4").state).toBe("rate_limited");
});
it("keeps old cached jobs readable without misreporting absent fields as completed", () => {
  const legacy = { ipv4: { ip: "192.0.2.1" }, ipv6: null, quality: null };
  expect(ipFamilyDiagnostic(legacy, "ipv4").state).toBe("success");
  expect(ipResultState(legacy)).toBe("partial");
  for (const v of [-1, 2, Infinity, "0.5 trailing", "1.5 (High)"])
    expect(abuseFraction(v)).toBeNull();
  expect(abuseFraction("0.01 (Low)")).toBe(0.01);
});
it("keeps crowded flag movement bounded and independent of input ordering", () => {
  const a = createFlagLayout(),
    b = createFlagLayout();
  let previous = new Map<string, { x: number; y: number }>();
  let max = 0;
  for (let frame = 0; frame < 500; frame++) {
    const anchors = Array.from({ length: 18 }, (_, i) => ({
      id: "n" + String(i).padStart(2, "0"),
      x: 450 + Math.sin(frame / 150 + i * 0.18) * 75,
      y: 300 + Math.cos(frame / 180 + i * 0.24) * 50,
    }));
    const ra = a.step(anchors, 1000, 780, 40),
      rb = b.step(anchors.reverse(), 1000, 780, 40);
    for (const [id, p] of ra.positions) {
      expect(p.x).toBeCloseTo(rb.positions.get(id)!.x, 9);
      expect(p.y).toBeCloseTo(rb.positions.get(id)!.y, 9);
      const old = previous.get(id);
      if (old) max = Math.max(max, Math.hypot(p.x - old.x, p.y - old.y));
    }
    previous = new Map([...ra.positions].map(([k, p]) => [k, { ...p }]));
  }
  expect(max).toBeLessThanOrEqual(7.50001);
});
it("persists IP jobs as partial, failed or done according to module results", async () => {
  const directory = await mkdtemp(join(tmpdir(), "komari-ds-ip-state-"));
  const complete = {
    ipv4: { ip: "192.0.2.1" },
    ipv6: { ip: "2001:db8::1" },
    quality: {
      ipv4: { state: "success", is_vpn: false },
      ipv6: { state: "success", is_vpn: false },
    },
  };
  const app = await buildExtension({
    directory,
    publicOrigin: "http://localhost",
    enableJobs: true,
    backend: {
      viewer: async () => ({ logged_in: true, username: "test" }),
      nodes: async () => ({
        a: { uuid: "a" },
        b: { uuid: "b" },
        c: { uuid: "c" },
      }),
      run: async (node) =>
        node === "a"
          ? {
              ipv4: { ip: "192.0.2.1" },
              ipv6: null,
              quality: { state: "not_configured" },
            }
          : node === "b"
            ? { ipv4: null, ipv6: null }
            : complete,
    },
  });
  try {
    const session = await app.inject({
      url: API + "/session",
      headers: { cookie: "test=1" },
    });
    const headers = {
      cookie: "test=1",
      origin: "http://localhost",
      "x-ds-csrf": session.json().csrf,
    };
    for (const [node, state] of [
      ["a", "partial"],
      ["b", "failed"],
      ["c", "done"],
    ]) {
      const res = await app.inject({
        method: "POST",
        url: API + "/jobs",
        headers,
        payload: { nodeId: node, kind: "ip" },
      });
      expect(res.statusCode).toBe(202);
      const id = res.json().id;
      await expect
        .poll(
          async () =>
            (await app.inject({ url: API + "/jobs/" + id, headers })).json()
              .state,
        )
        .toBe(state);
      expect(
        (await app.inject({ url: API + "/jobs/" + id, headers })).json().result,
      ).toBeTruthy();
    }
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
