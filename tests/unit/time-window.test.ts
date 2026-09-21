import { describe, it, expect } from "vitest";
import {
  fromLocalInput,
  toLocalInput,
  presetWindow,
  validateWindow,
  parseRangeParams,
} from "../../apps/theme/src/domain/time-window";
describe("shared network time window", () => {
  it("maps an explicitly selected evening in the display timezone to exact UTC boundaries", () => {
    const now = Date.parse("2026-09-21T03:00:00Z");
    expect(presetWindow("peak", "Asia/Shanghai", now, "2026-09-20")).toEqual({
      start: Date.parse("2026-09-20T11:00:00Z"),
      end: Date.parse("2026-09-20T15:00:00Z"),
    });
  });
  it("uses the last evening before today begins, and bounds ongoing evenings to now", () => {
    const morning = Date.parse("2026-09-20T02:00:00Z");
    expect(
      toLocalInput(
        presetWindow("peak", "Asia/Shanghai", morning).start,
        "Asia/Shanghai",
      ),
    ).toBe("2026-09-19T19:00");
    const evening = Date.parse("2026-09-20T13:00:00Z");
    expect(presetWindow("peak", "Asia/Shanghai", evening).end).toBe(evening);
  });
  it("rejects DST gaps and malformed civil dates instead of silently shifting time", () => {
    expect(() =>
      fromLocalInput("2026-03-08T02:30", "America/New_York"),
    ).toThrow();
    expect(() => fromLocalInput("2026-02-30T20:00", "UTC")).toThrow();
    expect(() => fromLocalInput("bad", "UTC")).toThrow();
  });
  it("chooses the earlier occurrence of a repeated fall-back civil time", () => {
    expect(fromLocalInput("2026-11-01T01:30", "America/New_York")).toBe(
      Date.parse("2026-11-01T05:30:00Z"),
    );
  });
  it("round-trips non-whole-hour timezones and respects absolute custom URLs", () => {
    const instant = fromLocalInput("2026-09-20T19:15", "Asia/Kathmandu");
    expect(toLocalInput(instant, "Asia/Kathmandu")).toBe("2026-09-20T19:15");
    const p = new URLSearchParams({
      from: "2026-09-20T11:00:00Z",
      to: "2026-09-20T15:00:00Z",
    });
    expect(
      parseRangeParams(p, "UTC", Date.parse("2026-09-21T00:00:00Z")).window
        .start,
    ).toBe(Date.parse("2026-09-20T11:00:00Z"));
  });
  it("blocks reversed, future, oversized and invalid URL windows", () => {
    const now = Date.now();
    expect(validateWindow({ start: now, end: now - 1 }, now)).not.toBeNull();
    expect(
      validateWindow({ start: now - 60000, end: now + 999999 }, now),
    ).not.toBeNull();
    expect(
      validateWindow({ start: now - 40 * 86400000, end: now }, now),
    ).not.toBeNull();
    expect(
      parseRangeParams(new URLSearchParams("from=no&to=no"), "UTC", now).error,
    ).not.toBeNull();
  });
});
