import type { CapStyle, Direction } from "./config";

export interface RenderRing {
  progress: number;
  /** Resolved canvas-compatible color. */
  color: string;
  label: string;
}

export interface RenderModel {
  rings: RenderRing[];
  centerLines: string[];
  ringWidth: number;
  innerRadius: number;
  startAngle: number;
  direction: Direction;
  caps: CapStyle;
  showTrack: boolean;
  trackOpacity: number;
  showLabels: boolean;
  readableLabels: boolean;
  labelMinRingPx: number;
  /** Color for text that is not on top of an arc. */
  textColor: string;
  fontFamily: string;
}

export interface RenderResult {
  labelsVisible: boolean;
  ringPx: number;
}

const TAU = Math.PI * 2;

/** Ring geometry in CSS px for a square of `size`. Exported for tests. */
export function ringGeometry(size: number, count: number, ringWidth: number, innerRadius: number) {
  const outer = Math.max(0, size / 2 - 1);
  const inner = outer * innerRadius;
  const slot = count > 0 ? (outer - inner) / count : 0;
  const width = slot * ringWidth;
  const radii = Array.from({ length: count }, (_, i) => outer - slot * (i + 0.5));
  return { outer, inner, slot, width, radii };
}

/** Parse `#rrggbb` or `rgb()/rgba()` into channels, or null. */
export function parseRgb(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const v = parseInt(hex[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Linear mix of two colors; `t` = 0 gives `a`. */
export function mixColors(a: string, b: string, t: number): string {
  const ca = parseRgb(a);
  const cb = parseRgb(b);
  if (!ca || !cb) return a;
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Relative luminance (0–1) of an `rgb()`/`#rrggbb` string. */
export function luminance(color: string): number {
  const rgb = parseRgb(color);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export const contrastText = (bg: string): string => (luminance(bg) > 0.4 ? "#111111" : "#f5f5f5");

/** Normalize any color canvas understands to `#rrggbb` / `rgba(...)` via the 2D context. */
export function canonicalColor(ctx: CanvasRenderingContext2D, color: string): string {
  ctx.fillStyle = "#000";
  ctx.fillStyle = color;
  return String(ctx.fillStyle);
}

/** Whether text centred at canvas angle `a` would be upside down when read clockwise. */
export const isBottomHalf = (a: number): boolean => Math.sin(a) > 0;

/**
 * Draw `text` along the circle of radius `r`, occupying the angles [startAngle, startAngle + span].
 * Normally it reads clockwise with letters pointing outward; with `flip` it reads
 * counterclockwise with letters pointing inward, which is upright on the bottom half.
 */
function drawArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  span: number,
  flip: boolean,
) {
  let a = flip ? startAngle + span : startAngle;
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    const half = w / 2 / r;
    ctx.save();
    ctx.translate(cx, cy);
    if (flip) {
      ctx.rotate(a - half - Math.PI / 2);
      ctx.fillText(ch, 0, r);
      a -= w / r;
    } else {
      ctx.rotate(a + half + Math.PI / 2);
      ctx.fillText(ch, 0, -r);
      a += w / r;
    }
    ctx.restore();
  }
}

/**
 * Draw the clock into `ctx`, sized `width`×`height` CSS px. The context is expected to be
 * pre-scaled for devicePixelRatio. The clock is a circle of min(width, height), centered.
 */
export function drawClock(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  m: RenderModel,
): RenderResult {
  ctx.clearRect(0, 0, width, height);
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const geo = ringGeometry(size, m.rings.length, m.ringWidth, m.innerRadius);
  const dir = m.direction === "clockwise" ? 1 : -1;
  const start = -Math.PI / 2 + (m.startAngle * Math.PI) / 180;
  const labelsVisible = m.showLabels && geo.width >= m.labelMinRingPx;

  ctx.lineWidth = geo.width;
  ctx.lineCap = m.caps;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${geo.width * 0.6}px ${m.fontFamily}`;

  m.rings.forEach((ring, i) => {
    const r = geo.radii[i];
    if (r <= 0 || geo.width <= 0) return;
    const progress = Math.min(1, Math.max(0, ring.progress));

    if (m.showTrack && m.trackOpacity > 0) {
      ctx.globalAlpha = m.trackOpacity;
      ctx.strokeStyle = ring.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const sweep = progress * TAU;
    const end = start + dir * sweep;
    if (progress > 0) {
      ctx.strokeStyle = ring.color;
      ctx.beginPath();
      if (progress >= 1) ctx.arc(cx, cy, r, 0, TAU);
      else ctx.arc(cx, cy, r, start, end, dir < 0);
      ctx.stroke();
    }

    if (!labelsVisible || !ring.label) return;
    const textAngle = ctx.measureText(ring.label).width / r;
    const pad = (geo.width * (m.caps === "round" ? 0.6 : 0.35)) / r;
    const fitsInside = sweep >= textAngle + pad * 2;
    // Text always reads clockwise; place it just behind the tip (on the arc) or just past it (on the track).
    let from: number;
    if (fitsInside) {
      from = dir > 0 ? end - pad - textAngle : end + pad;
      ctx.fillStyle = contrastText(ring.color);
    } else {
      from = dir > 0 ? end + pad : end - pad - textAngle;
      ctx.fillStyle = m.textColor;
    }
    const flip = m.readableLabels && isBottomHalf(from + textAngle / 2);
    drawArcText(ctx, ring.label, cx, cy, r, from, textAngle, flip);
  });

  // Center readout scales with the empty middle; skipped when there is no room.
  const lines = m.centerLines.filter(Boolean);
  const room = geo.inner * 2 * 0.82;
  if (lines.length && room >= 24) {
    ctx.fillStyle = m.textColor;
    const sizes = lines.map((_, i) => (i === 0 ? 1 : 0.55));
    let base = room / (lines.length === 1 ? 2.4 : 3);
    ctx.font = `600 ${base}px ${m.fontFamily}`;
    const widest = Math.max(...lines.map((l, i) => ctx.measureText(l).width * sizes[i]));
    if (widest > room) base *= room / widest;
    const total = sizes.reduce((s, k) => s + k * base * 1.15, 0);
    let y = cy - total / 2;
    lines.forEach((line, i) => {
      const fs = base * sizes[i];
      ctx.font = `${i === 0 ? 600 : 400} ${fs}px ${m.fontFamily}`;
      y += (fs * 1.15) / 2;
      ctx.fillText(line, cx, y);
      y += (fs * 1.15) / 2;
    });
  }

  return { labelsVisible, ringPx: geo.width };
}
