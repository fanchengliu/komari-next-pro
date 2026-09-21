import { it, expect } from "vitest";
import { estimateIPReference } from "../../apps/theme/src/domain/ip-reference";
import { resolveThemeSettings, settingsSchema } from "../../packages/contracts";
const meta = {
  ip: "192.0.2.1",
  country: "US",
  city: "Example",
  timezone: "UTC",
  org: "AS64500 Example Cloud",
};
it("produces deterministic estimates without IP hash offsets and exposes every adjustment", () => {
  const a = estimateIPReference(meta),
    b = estimateIPReference({ ...meta, ip: "192.0.2.99" });
  expect(a).toEqual(b);
  expect(a.adjustments[0].matched).toBe("Cloud");
  expect(a.category).toBe("hosting");
  expect(a.risk).toBe(50 + a.adjustments.reduce((s, r) => s + r.risk, 0));
  expect(a.pollution).toBe(
    50 + a.adjustments.reduce((s, r) => s + r.pollution, 0),
  );
});
it("never substitutes estimates for provider facts, and unknown data remains visibly neutral", () => {
  expect(estimateIPReference(null).risk).toBeNull();
  const unknown = estimateIPReference({ ip: "192.0.2.1" });
  expect(unknown.category).toBe("unknown");
  expect(unknown.adjustments).toEqual([]);
  expect(unknown.risk).toBe(50);
  expect(unknown.completeness).toBeLessThan(100);
  const provider = { is_datacenter: false, is_abuser: false };
  const r = estimateIPReference(meta, provider);
  expect(r.category).toBe("unknown");
  expect(provider).toEqual({ is_datacenter: false, is_abuser: false });
  expect(estimateIPReference(meta, { is_vpn: true }).risk).toBeGreaterThan(
    estimateIPReference(meta).risk!,
  );
});
it("migrates appearance without erasing other preferences or accepting invalid opacity", () => {
  expect(
    resolveThemeSettings({ appearance: "dark" }, {}).cardOpacity,
  ).toBeNull();
  const s = resolveThemeSettings(
    { appearance: "dark", cardOpacity: 55 },
    { cardOpacity: 999, ipQualityView: "reference" },
  );
  expect(s.cardOpacity).toBe(55);
  expect(s.appearance).toBe("dark");
  expect(settingsSchema.shape.cardOpacity.safeParse(-1).success).toBe(false);
  expect(resolveThemeSettings({}, { cardOpacity: 0 }).cardOpacity).toBe(0);
});
