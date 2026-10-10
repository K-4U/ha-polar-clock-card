import { describe, expect, it } from "vitest";
import { ROLLOVER_MS, RingAnimator, STEP_MS, easeStretchSnap } from "../../src/motion";

describe("easeStretchSnap", () => {
  const samples = Array.from({ length: 101 }, (_, i) => easeStretchSnap(i / 100));

  it("runs from 0 to 1 without ever overshooting or going back", () => {
    expect(samples[0]).toBe(0);
    expect(samples[100]).toBeCloseTo(1);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    samples.slice(1).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(samples[i]));
  });

  it("creeps first, then snaps", () => {
    expect(easeStretchSnap(0.6)).toBeCloseTo(0.25);
    // the last 40% of the time covers 75% of the distance
    expect(easeStretchSnap(0.75) - easeStretchSnap(0.6)).toBeGreaterThan(easeStretchSnap(0.6));
  });
});

describe("RingAnimator", () => {
  it("passes values through when nothing changes", () => {
    const a = new RingAnimator();
    expect(a.value("s", 0.5, 0, "step", true)).toBe(0.5);
    expect(a.value("s", 0.5, 100, "step", true)).toBe(0.5);
    expect(a.animating).toBe(false);
  });

  it("snaps to the new value in step mode without passing it", () => {
    const a = new RingAnimator();
    a.value("s", 10 / 60, 0, "step", true);
    const samples = Array.from({ length: 20 }, (_, i) => a.value("s", 11 / 60, 1000 + (i * STEP_MS) / 19, "step", true));
    expect(Math.max(...samples)).toBeLessThanOrEqual(11 / 60);
    expect(samples[1]).toBeGreaterThan(10 / 60);
    expect(samples[samples.length - 1]).toBeCloseTo(11 / 60);
    expect(a.animating).toBe(false);
  });

  it("winds back down on rollover in smooth mode instead of jumping", () => {
    const a = new RingAnimator();
    a.value("s", 0.999, 0, "smooth", true);
    const first = a.value("s", 0.001, 16, "smooth", true);
    expect(first).toBeGreaterThan(0.9);
    expect(a.animating).toBe(true);
    const mid = a.value("s", 0.01, 16 + ROLLOVER_MS / 2, "smooth", true);
    expect(mid).toBeLessThan(0.9);
    expect(mid).toBeGreaterThan(0.01);
    expect(a.value("s", 0.012, 16 + ROLLOVER_MS, "smooth", true)).toBe(0.012);
    expect(a.animating).toBe(false);
  });

  it("does not animate small forward movement in smooth mode", () => {
    const a = new RingAnimator();
    a.value("s", 0.2, 0, "smooth", true);
    expect(a.value("s", 0.21, 16, "smooth", true)).toBe(0.21);
    expect(a.animating).toBe(false);
  });

  it("does not animate big jumps (clock changed), in either mode", () => {
    const a = new RingAnimator();
    a.value("s", 17 / 60, 0, "step", true);
    expect(a.value("s", 27 / 60, 16, "step", true)).toBe(27 / 60);
    a.value("m", 0.1, 0, "smooth", true);
    expect(a.value("m", 0.4, 16, "smooth", true)).toBe(0.4);
    expect(a.animating).toBe(false);
  });

  it("still animates the largest real step (one weekday)", () => {
    const a = new RingAnimator();
    a.value("w", 3 / 7, 0, "step", true);
    a.value("w", 4 / 7, 16, "step", true);
    expect(a.animating).toBe(true);
  });

  it("starts fresh after reset (loop resumed)", () => {
    const a = new RingAnimator();
    a.value("s", 0.1, 0, "step", true);
    a.reset();
    expect(a.value("s", 0.12, 16, "step", true)).toBe(0.12);
    expect(a.animating).toBe(false);
  });

  it("jumps straight to the value when animation is off (reduced motion)", () => {
    const a = new RingAnimator();
    a.value("s", 0.999, 0, "smooth", false);
    expect(a.value("s", 0.001, 16, "smooth", false)).toBe(0.001);
    a.value("m", 0.1, 0, "step", false);
    expect(a.value("m", 0.2, 16, "step", false)).toBe(0.2);
    expect(a.animating).toBe(false);
  });
});
