import { it, expect } from "vitest";
import { enrichQuality } from "../../apps/extension/src/ip-quality";
it("keeps quality lookup credentials server-side and projects only provider fields", async () => {
  let requestBody = "";
  const fake = (async (_url: any, init: any) => {
    requestBody = init.body;
    return new Response(
      JSON.stringify({
        is_vpn: true,
        is_abuser: false,
        company: { abuser_score: "0.01 (Low)", type: "hosting" },
        key: "must-not-be-stored",
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const result = await enrichQuality(
    {
      ipv4: { ip: "192.0.2.1" },
      ipv6: null,
      quality: null,
      provider: "ipinfo.io",
    },
    "unit-test-key",
    fake,
  );
  expect(requestBody).toContain("unit-test-key");
  expect(JSON.stringify(result)).not.toContain("unit-test-key");
  expect(JSON.stringify(result)).not.toContain("must-not-be-stored");
  expect((result.quality as any).ipv4.is_vpn).toBe(true);
});
it("does not retry provider rate limits or invent missing scores", async () => {
  let calls = 0;
  const fake = (async () => {
    calls++;
    return new Response("", { status: 429 });
  }) as typeof fetch;
  const result = await enrichQuality(
    {
      ipv4: { ip: "192.0.2.1" },
      ipv6: null,
      quality: null,
      provider: "ipinfo.io",
    },
    "test",
    fake,
  );
  expect(calls).toBe(1);
  expect((result.quality as any).ipv4.error).toBe("Provider HTTP 429");
});
