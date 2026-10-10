import { describe, expect, it } from "vitest";
import { BOUNCE_MS, ROLLOVER_MS, RingAnimator, easeOutBack } from "../../src/motion";

describe("easeOutBack", () => {
  it("starts at 0, overshoots, ends at 1", () => {
    expect(easeOutBack(0)).toBeCloseTo(0);
    expect(easeOutBack(1)).toBeCloseTo(1);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)));
    expect(peak).toBeGreaterThan(1.05);
  });
});

describe("RingAnimator", () => {
  it("passes values through when nothing changes", () => {
    const a = new RingAnimator();
    expect(a.value("s", 0.5, 0, "step", true)).toBe(0.5);
    expect(a.value("s", 0.5, 100, "step", true)).toBe(0.5);
    expect(a.animating).toBe(false);
  });

  it("bounces past the new value in step mode, then settles", () => {
    const a = new RingAnimator();
    a.value("s", 10 / 60, 0, "step", true);
    const samples = Array.from({ length: 20 }, (_, i) => a.value("s", 11 / 60, 1000 + (i * BOUNCE_MS) / 19, "step", true));
    expect(Math.max(...samples)).toBeGreaterThan(11 / 60);
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

  it("jumps straight to the value when animation is off (reduced motion)", () => {
    const a = new RingAnimator();
    a.value("s", 0.999, 0, "smooth", false);
    expect(a.value("s", 0.001, 16, "smooth", false)).toBe(0.001);
    a.value("m", 0.1, 0, "step", false);
    expect(a.value("m", 0.2, 16, "step", false)).toBe(0.2);
    expect(a.animating).toBe(false);
  });
});
