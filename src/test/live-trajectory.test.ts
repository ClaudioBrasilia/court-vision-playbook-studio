import { describe, expect, it } from "vitest";
import { recordSample, trajectoryPosition } from "@/lib/live-trajectory";

describe("Live player trajectory", () => {
  it("records cursor positions at video times without manual keyframes", () => {
    const samples = recordSample(recordSample([], { x: 0.2, y: 0.4 }, 2), { x: 0.8, y: 0.6 }, 4);
    expect(samples).toEqual([
      { x: 0.2, y: 0.4, time: 2 },
      { x: 0.8, y: 0.6, time: 4 },
    ]);
    expect(trajectoryPosition(samples, 3)).toEqual({ x: 0.5, y: 0.5 });
  });
  it("preserves stationary holds and replaces same-frame cursor updates", () => {
    let samples = recordSample([], { x: 0.2, y: 0.4 }, 2);
    samples = recordSample(samples, { x: 0.2, y: 0.4 }, 3);
    samples = recordSample(samples, { x: 0.6, y: 0.4 }, 3);
    expect(samples).toHaveLength(2);
    expect(trajectoryPosition(samples, 2.5)?.x).toBeCloseTo(0.4);
    expect(recordSample(samples, { x: 0, y: 0 }, 1)).toEqual(samples);
  });
});
