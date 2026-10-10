import type { Motion } from "./config";

export const STEP_MS = 450;
export const ROLLOVER_MS = 700;
/** Largest real single step is one weekday (1/7); bigger forward jumps aren't animated. */
const MAX_STEP = 0.15;

/**
 * "Stretch & snap": creeps a quarter of the way as if held back, then snaps the rest.
 * Never passes the target.
 */
export function easeStretchSnap(t: number): number {
  const hold = 0.6;
  if (t < hold) return 0.25 * (t / hold) ** 2;
  return 0.25 + 0.75 * (1 - (1 - (t - hold) / (1 - hold)) ** 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

interface Tween {
  from: number;
  start: number;
  kind: "step" | "rollover";
  /** Step target; rollover follows the live target instead. */
  to: number;
}

/**
 * Turns each ring's true progress into the value to draw:
 * - `step`: every change stretches and snaps into place (easeStretchSnap).
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
      const wrapped = target < prev - 0.5;
      const jumped = !wrapped && Math.abs(target - prev) > MAX_STEP;
      if (jumped) {
        // e.g. the system clock changed: show the new time without a long stale animation
        this.tweens.delete(key);
        tween = undefined;
      } else if (motion === "step" && target !== prev) {
        tween = { kind: "step", from: current, to: target, start: now };
        this.tweens.set(key, tween);
      } else if (motion === "smooth" && wrapped) {
        tween = { kind: "rollover", from: current, to: target, start: now };
        this.tweens.set(key, tween);
      }
    } else if (!animate) {
      this.tweens.delete(key);
      tween = undefined;
    }

    let shown = target;
    if (tween) {
      const duration = tween.kind === "step" ? STEP_MS : ROLLOVER_MS;
      const t = Math.min(1, Math.max(0, (now - tween.start) / duration));
      if (t >= 1) {
        this.tweens.delete(key);
      } else if (tween.kind === "step") {
        shown = tween.from + (tween.to - tween.from) * easeStretchSnap(t);
      } else {
        shown = tween.from + (target - tween.from) * easeInOutCubic(t);
      }
    }
    this.shown.set(key, shown);
    return shown;
  }
}
