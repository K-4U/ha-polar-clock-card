import type { Motion } from "./config";

export const BOUNCE_MS = 450;
export const ROLLOVER_MS = 700;

/** Overshoots ~10% past the target, then settles. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

interface Tween {
  from: number;
  start: number;
  kind: "bounce" | "rollover";
  /** Bounce target; rollover follows the live target instead. */
  to: number;
}

/**
 * Turns each ring's true progress into the value to draw:
 * - `step`: every change bounces into place (easeOutBack).
 * - `smooth`: when a ring wraps (e.g. 59s → 0s) it winds back to the live value
 *   instead of jumping to empty.
 */
export class RingAnimator {
  private last = new Map<string, number>();
  private shown = new Map<string, number>();
  private tweens = new Map<string, Tween>();

  /** True while any ring is mid-animation (the card keeps requesting frames). */
  get animating(): boolean {
    return this.tweens.size > 0;
  }

  reset() {
    this.last.clear();
    this.shown.clear();
    this.tweens.clear();
  }

  value(key: string, target: number, now: number, motion: Motion, animate: boolean): number {
    const prev = this.last.get(key);
    this.last.set(key, target);
    let tween = this.tweens.get(key);

    if (animate && prev !== undefined) {
      const current = this.shown.get(key) ?? prev;
      if (motion === "step" && target !== prev) {
        tween = { kind: "bounce", from: current, to: target, start: now };
        this.tweens.set(key, tween);
      } else if (motion === "smooth" && target < prev - 0.5) {
        tween = { kind: "rollover", from: current, to: target, start: now };
        this.tweens.set(key, tween);
      }
    } else if (!animate) {
      this.tweens.delete(key);
      tween = undefined;
    }

    let shown = target;
    if (tween) {
      const duration = tween.kind === "bounce" ? BOUNCE_MS : ROLLOVER_MS;
      const t = Math.min(1, Math.max(0, (now - tween.start) / duration));
      if (t >= 1) {
        this.tweens.delete(key);
      } else if (tween.kind === "bounce") {
        shown = tween.from + (tween.to - tween.from) * easeOutBack(t);
      } else {
        shown = tween.from + (target - tween.from) * easeInOutCubic(t);
      }
    }
    this.shown.set(key, shown);
    return shown;
  }
}
