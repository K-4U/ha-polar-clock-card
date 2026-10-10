import type { PolarClockConfig } from "./config";

type Gesture = "tap" | "hold" | "double_tap";

const HOLD_MS = 500;
const DOUBLE_TAP_MS = 250;

const hasAction = (cfg: PolarClockConfig, g: Gesture): boolean => {
  const a = cfg[`${g}_action`];
  return !!a && a.action !== "none";
};

export const hasAnyAction = (cfg: PolarClockConfig): boolean =>
  hasAction(cfg, "tap") || hasAction(cfg, "hold") || hasAction(cfg, "double_tap");

/** Hand the gesture to Home Assistant, which runs the configured action. */
function fire(el: HTMLElement, cfg: PolarClockConfig, action: Gesture) {
  if (!hasAction(cfg, action)) return;
  el.dispatchEvent(
    new CustomEvent("hass-action", {
      bubbles: true,
      composed: true,
      detail: {
        config: {
          tap_action: cfg.tap_action,
          hold_action: cfg.hold_action,
          double_tap_action: cfg.double_tap_action,
        },
        action,
      },
    }),
  );
}

/** Attach tap / hold / double-tap detection to `target`. Returns a cleanup function. */
export function bindGestures(
  target: HTMLElement,
  host: HTMLElement,
  getConfig: () => PolarClockConfig | undefined,
): () => void {
  let holdTimer: number | undefined;
  let tapTimer: number | undefined;
  let held = false;

  const clearHold = () => {
    if (holdTimer !== undefined) window.clearTimeout(holdTimer);
    holdTimer = undefined;
  };

  const down = (ev: PointerEvent) => {
    const cfg = getConfig();
    if (!cfg || ev.button !== 0) return;
    held = false;
    clearHold();
    if (hasAction(cfg, "hold")) {
      holdTimer = window.setTimeout(() => {
        held = true;
        fire(host, cfg, "hold");
      }, HOLD_MS);
    }
  };

  const up = () => {
    const cfg = getConfig();
    clearHold();
    if (!cfg || held) return;
    if (!hasAction(cfg, "double_tap")) {
      fire(host, cfg, "tap");
      return;
    }
    if (tapTimer !== undefined) {
      window.clearTimeout(tapTimer);
      tapTimer = undefined;
      fire(host, cfg, "double_tap");
      return;
    }
    tapTimer = window.setTimeout(() => {
      tapTimer = undefined;
      fire(host, cfg, "tap");
    }, DOUBLE_TAP_MS);
  };

  const keydown = (ev: KeyboardEvent) => {
    const cfg = getConfig();
    if (cfg && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      fire(host, cfg, "tap");
    }
  };

  target.addEventListener("pointerdown", down);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", clearHold);
  target.addEventListener("pointerleave", clearHold);
  target.addEventListener("keydown", keydown);
  target.addEventListener("contextmenu", (e) => held && e.preventDefault());
  return () => {
    clearHold();
    if (tapTimer !== undefined) window.clearTimeout(tapTimer);
    target.removeEventListener("pointerdown", down);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", clearHold);
    target.removeEventListener("pointerleave", clearHold);
    target.removeEventListener("keydown", keydown);
  };
}
