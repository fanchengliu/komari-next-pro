import { it, expect } from "vitest";
import {
  advanceReportClock,
  reportNow,
} from "../../apps/theme/src/domain/report-clock";
it("uses report timing despite client/server clock skew and does not refresh frozen samples", () => {
  const clock = advanceReportClock(null, [90000, 88000, 0], 180000);
  expect(reportNow(clock, 185000)).toBe(95000);
  expect(advanceReportClock(clock, [90000, 88000], 240000)).toBe(clock);
  expect(reportNow(clock, 245000) - 90000).toBe(65000);
  const next = advanceReportClock(clock, [95000, 88000], 185000);
  expect(reportNow(next, 185000) - 88000).toBe(7000);
  expect(advanceReportClock(null, [0, NaN], 180000)).toBeNull();
});
