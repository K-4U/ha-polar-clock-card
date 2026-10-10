import type { FirstWeekday, Motion, RingType } from "./config";

export interface ZonedParts {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** 0–23 */
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? "";
  let fmt = partsFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    partsFormatters.set(key, fmt);
  }
  return fmt;
}

/** Wall-clock parts of `date` in `timeZone` (undefined = browser zone). */
export function zonedParts(date: Date, timeZone?: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    millisecond: date.getUTCMilliseconds(),
    weekday: WEEKDAYS.indexOf(out.weekday),
  };
}

export const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const dayOfYear = (p: ZonedParts): number =>
  (Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(p.year, 0, 1)) / 86_400_000 + 1;

/** 0 = Sunday … 6 = Saturday */
export const WEEKDAY_INDEX: Record<Exclude<FirstWeekday, "auto">, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Progress (0–1) of a ring. In `smooth` motion every ring includes the fraction of
 * its sub-unit; in `step` motion it advances once per unit and shows that unit as filled
 * (so the last day of the month is a full ring).
 */
export function ringProgress(
  ring: RingType,
  p: ZonedParts,
  motion: Motion,
  opts: { firstWeekday: number; hours12: boolean },
): number {
  const smooth = motion === "smooth";
  const sec = p.second + (smooth ? p.millisecond / 1000 : 0);
  const min = p.minute + (smooth ? sec / 60 : 0);
  const hourFrac = smooth ? min / 60 : 0;
  const dayFrac = smooth ? (p.hour + p.minute / 60 + sec / 3600) / 24 : 0;
  const dim = daysInMonth(p.year, p.month);

  switch (ring) {
    case "seconds":
      return sec / 60;
    case "minutes":
      return min / 60;
    case "hours": {
      const span = opts.hours12 ? 12 : 24;
      return ((p.hour % span) + hourFrac) / span;
    }
    case "weekday": {
      const idx = (p.weekday - opts.firstWeekday + 7) % 7;
      return (idx + (smooth ? dayFrac : 1)) / 7;
    }
    case "day":
      return (p.day - 1 + (smooth ? dayFrac : 1)) / dim;
    case "month":
      return (p.month - 1 + (smooth ? (p.day - 1 + dayFrac) / dim : 1)) / 12;
    case "year": {
      const diy = isLeapYear(p.year) ? 366 : 365;
      return (dayOfYear(p) - 1 + (smooth ? dayFrac : 1)) / diy;
    }
  }
}

export interface LabelContext {
  locale: string;
  timeZone?: string;
  hours12: boolean;
  uppercase: boolean;
}

const fmtCache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat | Intl.PluralRules>();
function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat | Intl.PluralRules>(
  key: string,
  make: () => T,
): T {
  let f = fmtCache.get(key) as T | undefined;
  if (!f) {
    f = make();
    fmtCache.set(key, f);
  }
  return f;
}

const unit = (ctx: LabelContext, u: "second" | "minute" | "hour", n: number): string =>
  cached(`u|${ctx.locale}|${u}`, () =>
    new Intl.NumberFormat(ctx.locale, { style: "unit", unit: u, unitDisplay: "long" }),
  ).format(n);

const date = (ctx: LabelContext, opts: Intl.DateTimeFormatOptions, d: Date): string =>
  cached(`d|${ctx.locale}|${ctx.timeZone}|${ctx.hours12}|${JSON.stringify(opts)}`, () =>
    new Intl.DateTimeFormat(ctx.locale, { timeZone: ctx.timeZone, ...opts }),
  ).format(d);

const EN_ORDINAL: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

/** Human label for a ring at `now`, e.g. "42 SECONDS", "TUESDAY", "10TH". */
export function ringLabel(ring: RingType, now: Date, p: ZonedParts, ctx: LabelContext): string {
  let text: string;
  switch (ring) {
    case "seconds":
      text = unit(ctx, "second", p.second);
      break;
    case "minutes":
      text = unit(ctx, "minute", p.minute);
      break;
    case "hours":
      text = ctx.hours12
        ? date(ctx, { hour: "numeric", hour12: true }, now)
        : unit(ctx, "hour", p.hour);
      break;
    case "weekday":
      text = date(ctx, { weekday: "long" }, now);
      break;
    case "day":
      if (ctx.locale.toLowerCase().startsWith("en")) {
        const rule = cached(`o|${ctx.locale}`, () => new Intl.PluralRules("en", { type: "ordinal" }));
        text = `${p.day}${EN_ORDINAL[rule.select(p.day)] ?? "th"}`;
      } else {
        text = date(ctx, { day: "numeric" }, now);
      }
      break;
    case "month":
      text = date(ctx, { month: "long" }, now);
      break;
    case "year":
      text = String(p.year);
      break;
  }
  return ctx.uppercase ? text.toLocaleUpperCase(ctx.locale) : text;
}

export function centerText(
  mode: "time" | "date",
  now: Date,
  ctx: LabelContext,
): string {
  return mode === "time"
    ? date(ctx, { hour: "numeric", minute: "2-digit", hour12: ctx.hours12 }, now)
    : date(ctx, { weekday: "short", day: "numeric", month: "short" }, now);
}

/** Whether `locale` uses a 12-hour clock by default. */
export function localeUses12h(locale: string): boolean {
  try {
    const opts = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions();
    return opts.hour12 ?? (opts.hourCycle === "h11" || opts.hourCycle === "h12");
  } catch {
    return false;
  }
}

/** First day of the week for `locale` (0 = Sunday), Monday when unknown. */
export function localeFirstWeekday(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info) return info.firstDay % 7;
  } catch {
    /* fall through */
  }
  return 1;
}
