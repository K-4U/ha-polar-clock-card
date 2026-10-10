export const RING_TYPES = [
  "seconds",
  "minutes",
  "hours",
  "weekday",
  "day",
  "month",
  "year",
] as const;
export type RingType = (typeof RING_TYPES)[number];

export type ColorMode = "rainbow" | "theme" | "palette";
export type Motion = "smooth" | "step";
export type CenterMode = "none" | "time" | "date" | "time_date";
export type Direction = "clockwise" | "counterclockwise";
export type CapStyle = "round" | "butt";
export type HourFormat = "auto" | "12" | "24";
export type FirstWeekday =
  | "auto"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface ActionConfig {
  action: string;
  [key: string]: unknown;
}

export interface PolarClockConfig {
  type: string;
  /** Rings to show, outermost first. */
  rings: RingType[];
  motion: Motion;
  color_mode: ColorMode;
  /** Colors used by `palette` mode, cycled outermost first. */
  palette: string[];
  /** Per-ring color override; wins over any color mode. */
  ring_colors: Partial<Record<RingType, string>>;
  show_labels: boolean;
  uppercase_labels: boolean;
  /** Labels are hidden when a ring is thinner than this many CSS px. */
  label_min_ring_px: number;
  center: CenterMode;
  /** Fraction (0.1–1) of each ring's slot filled by the arc; the rest is the gap. */
  ring_width: number;
  /** Radius of the empty center as fraction (0–0.9) of the outer radius. */
  inner_radius: number;
  /** Degrees; 0 is 12 o'clock. */
  start_angle: number;
  direction: Direction;
  caps: CapStyle;
  show_track: boolean;
  track_opacity: number;
  /** CSS color, `card` for the theme card background, or `transparent`. */
  background: string;
  /** Color for labels outside arcs and the center readout; `auto` picks by contrast. */
  text_color: string;
  /** IANA zone, `server` (HA config), or `local` (browser). Unset follows the HA user profile. */
  time_zone?: string;
  /** BCP 47 tag; unset follows HA language. */
  locale?: string;
  hour_format: HourFormat;
  first_weekday: FirstWeekday;
  tap_action: ActionConfig;
  hold_action: ActionConfig;
  double_tap_action: ActionConfig;
}

export const DEFAULT_PALETTE = [
  "#ff4d6d",
  "#ff9f1c",
  "#ffd23f",
  "#3bceac",
  "#0ead69",
  "#4cc9f0",
  "#7b2ff7",
];

export const DEFAULT_CONFIG: Omit<PolarClockConfig, "type"> = {
  rings: ["seconds", "minutes", "hours", "weekday", "day", "month"],
  motion: "smooth",
  color_mode: "rainbow",
  palette: DEFAULT_PALETTE,
  ring_colors: {},
  show_labels: true,
  uppercase_labels: true,
  label_min_ring_px: 9,
  center: "none",
  ring_width: 0.8,
  inner_radius: 0.2,
  start_angle: 0,
  direction: "clockwise",
  caps: "butt",
  show_track: true,
  track_opacity: 0.12,
  background: "#0b0b0f",
  text_color: "auto",
  hour_format: "auto",
  first_weekday: "auto",
  tap_action: { action: "none" },
  hold_action: { action: "none" },
  double_tap_action: { action: "none" },
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], key: string): T => {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${key} "${String(value)}"; expected one of: ${allowed.join(", ")}`);
  }
  return value as T;
};

const num = (value: unknown, key: string, min: number, max: number): number => {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) {
    throw new Error(`Invalid ${key} "${String(value)}"; expected a number between ${min} and ${max}`);
  }
  return n;
};

/** Merge user config over defaults and validate. Throws with a readable message on bad input. */
export function normalizeConfig(input: Partial<PolarClockConfig> & { type?: string }): PolarClockConfig {
  if (!input || typeof input !== "object") throw new Error("Invalid configuration");
  const cfg: PolarClockConfig = { ...DEFAULT_CONFIG, type: input.type ?? "custom:polar-clock-card" };
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined && v !== null) (cfg as unknown as Record<string, unknown>)[k] = v;
  }

  if (!Array.isArray(cfg.rings) || cfg.rings.length === 0) {
    throw new Error("`rings` must be a non-empty list");
  }
  cfg.rings = cfg.rings.map((r) => oneOf(r, RING_TYPES, "ring"));
  if (new Set(cfg.rings).size !== cfg.rings.length) throw new Error("`rings` contains duplicates");

  cfg.motion = oneOf(cfg.motion, ["smooth", "step"] as const, "motion");
  cfg.color_mode = oneOf(cfg.color_mode, ["rainbow", "theme", "palette"] as const, "color_mode");
  cfg.center = oneOf(cfg.center, ["none", "time", "date", "time_date"] as const, "center");
  cfg.direction = oneOf(cfg.direction, ["clockwise", "counterclockwise"] as const, "direction");
  cfg.caps = oneOf(cfg.caps, ["round", "butt"] as const, "caps");
  cfg.hour_format = oneOf(String(cfg.hour_format), ["auto", "12", "24"] as const, "hour_format");
  cfg.first_weekday = oneOf(
    cfg.first_weekday,
    ["auto", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const,
    "first_weekday",
  );

  cfg.ring_width = num(cfg.ring_width, "ring_width", 0.1, 1);
  cfg.inner_radius = num(cfg.inner_radius, "inner_radius", 0, 0.9);
  cfg.start_angle = num(cfg.start_angle, "start_angle", -360, 360);
  cfg.track_opacity = num(cfg.track_opacity, "track_opacity", 0, 1);
  cfg.label_min_ring_px = num(cfg.label_min_ring_px, "label_min_ring_px", 0, 200);

  if (!Array.isArray(cfg.palette)) throw new Error("`palette` must be a list of colors");
  cfg.palette = cfg.palette.map(String).filter((c) => c.trim());
  if (cfg.palette.length === 0) cfg.palette = DEFAULT_PALETTE;
  if (typeof cfg.ring_colors !== "object" || Array.isArray(cfg.ring_colors)) {
    throw new Error("`ring_colors` must be a mapping of ring name to color");
  }
  const ringColors: PolarClockConfig["ring_colors"] = {};
  for (const [key, color] of Object.entries(cfg.ring_colors)) {
    const ring = oneOf(key, RING_TYPES, "ring_colors key");
    if (typeof color === "string" && color.trim()) ringColors[ring] = color.trim();
  }
  cfg.ring_colors = ringColors;
  if (typeof cfg.time_zone === "string" && !cfg.time_zone.trim()) delete cfg.time_zone;
  if (typeof cfg.locale === "string" && !cfg.locale.trim()) delete cfg.locale;

  return cfg;
}
