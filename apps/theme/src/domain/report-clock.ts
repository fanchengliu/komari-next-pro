/** Age reports against their own clock and elapsed observation time, not the viewer's wall clock. */
export interface ReportClock {
  latest: number;
  received: number;
}
export function advanceReportClock(
  previous: ReportClock | null,
  timestamps: number[],
  received = Date.now(),
): ReportClock | null {
  const valid = timestamps.filter(
    (value) => Number.isFinite(value) && value > 0,
  );
  if (!valid.length) return previous;
  const latest = Math.max(...valid);
  return !previous || latest !== previous.latest
    ? { latest, received }
    : previous;
}
export function reportNow(clock: ReportClock | null, localNow = Date.now()) {
  return clock
    ? clock.latest + Math.max(0, localNow - clock.received)
    : localNow;
}
