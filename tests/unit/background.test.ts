import { describe, it, expect } from "vitest";
import { mediaReducer } from "../../apps/theme/src/features/Background";
describe("background playback lifecycle", () => {
  const playing = {
    index: 0,
    phase: "playing" as const,
    hidden: false,
    failures: 0,
  };
  it("resumes a loaded image after returning to the tab without waiting for a second load event", () => {
    const paused = mediaReducer(playing, { type: "visibility", hidden: true });
    expect(paused.phase).toBe("paused");
    expect(
      mediaReducer(paused, { type: "visibility", hidden: false }).phase,
    ).toBe("playing");
  });
  it("does not turn pending loads or failures into playback on a visibility transition", () => {
    const loading = { ...playing, phase: "loading" as const };
    const hidden = mediaReducer(loading, { type: "visibility", hidden: true });
    expect(mediaReducer(hidden, { type: "reset" }).hidden).toBe(true);
    expect(
      mediaReducer(hidden, { type: "visibility", hidden: false }).phase,
    ).toBe("loading");
    expect(
      mediaReducer(
        { ...playing, phase: "error" },
        { type: "visibility", hidden: false },
      ).phase,
    ).toBe("error");
  });
  it("advances a cycle key even for a one-item fixed-duration playlist", () => {
    const next = mediaReducer(playing, { type: "next", count: 1 });
    expect(next.index).not.toBe(playing.index);
    expect(next.index % 1).toBe(0);
    expect(next.phase).toBe("loading");
  });
});
