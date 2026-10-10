import { describe, expect, it } from "vitest";
import {
  dayOfYear,
  daysInMonth,
  localeFirstWeekday,
  localeUses12h,
  ringLabel,
  ringProgress,
  zonedParts,
  type ZonedParts,
} from "../../src/time";

const opts = { firstWeekday: 1, hours12: false };
// Saturday 2026-10-10 14:30:15.500 UTC
const now = new Date(Date.UTC(2026, 9, 10, 14, 30, 15, 500));
const utc = zonedParts(now, "UTC");

describe("zonedParts", () => {
  it("reads wall clock in the given zone", () => {
    expect(utc).toMatchObject({ year: 2026, month: 10, day: 10, hour: 14, minute: 30, second: 15, weekday: 6 });
    const ams = zonedParts(now, "Europe/Amsterdam");
    expect(ams.hour).toBe(16);
    const tokyo = zonedParts(new Date(Date.UTC(2026, 9, 10, 20)), "Asia/Tokyo");
    expect(tokyo).toMatchObject({ day: 11, hour: 5, weekday: 0 });
  });

  it("reports midnight as hour 0", () => {
    expect(zonedParts(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)), "UTC").hour).toBe(0);
  });
});

describe("calendar helpers", () => {
  it("knows month lengths and leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(dayOfYear(utc)).toBe(283);
  });
});

describe("ringProgress", () => {
  it("computes smooth progress", () => {
    expect(ringProgress("seconds", utc, "smooth", opts)).toBeCloseTo(15.5 / 60);
    expect(ringProgress("minutes", utc, "smooth", opts)).toBeCloseTo((30 + 15.5 / 60) / 60);
    expect(ringProgress("hours", utc, "smooth", opts)).toBeCloseTo((14 + 30.258 / 60) / 24, 3);
    expect(ringProgress("month", utc, "smooth", opts)).toBeGreaterThan(9 / 12);
    expect(ringProgress("month", utc, "smooth", opts)).toBeLessThan(10 / 12);
  });

  it("steps per unit", () => {
    expect(ringProgress("seconds", utc, "step", opts)).toBe(15 / 60);
    expect(ringProgress("minutes", utc, "step", opts)).toBe(30 / 60);
    expect(ringProgress("day", utc, "step", opts)).toBe(10 / 31);
    expect(ringProgress("month", utc, "step", opts)).toBe(10 / 12);
    expect(ringProgress("year", utc, "step", opts)).toBe(283 / 365);
  });

  it("uses a 12-hour span when asked", () => {
    expect(ringProgress("hours", utc, "step", { ...opts, hours12: true })).toBe(2 / 12);
  });

  it("respects first weekday", () => {
    // Saturday: 6th day from Monday, 7th... index 5 → step fills 6/7
    expect(ringProgress("weekday", utc, "step", { ...opts, firstWeekday: 1 })).toBe(6 / 7);
    // From Sunday, Saturday is the last day
    expect(ringProgress("weekday", utc, "step", { ...opts, firstWeekday: 0 })).toBe(1);
    // From Saturday, it's the first day
    expect(ringProgress("weekday", utc, "step", { ...opts, firstWeekday: 6 })).toBe(1 / 7);
  });

  it("is full on the last day of the month in step mode", () => {
    const p: ZonedParts = { ...utc, day: 31 };
    expect(ringProgress("day", p, "step", opts)).toBe(1);
  });

  it("stays within 0..1", () => {
    const end: ZonedParts = { year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 59, millisecond: 999, weekday: 4 };
    for (const ring of ["seconds", "minutes", "hours", "weekday", "day", "month", "year"] as const) {
      const v = ringProgress(ring, end, "smooth", opts);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("ringLabel", () => {
  const ctx = { locale: "en-US", timeZone: "UTC", hours12: false, uppercase: true };
  it("formats english labels", () => {
    expect(ringLabel("seconds", now, utc, ctx)).toBe("15 SECONDS");
    expect(ringLabel("minutes", now, utc, ctx)).toBe("30 MINUTES");
    expect(ringLabel("hours", now, utc, ctx)).toBe("14 HOURS");
    expect(ringLabel("weekday", now, utc, ctx)).toBe("SATURDAY");
    expect(ringLabel("day", now, utc, ctx)).toBe("10TH");
    expect(ringLabel("month", now, utc, ctx)).toBe("OCTOBER");
    expect(ringLabel("year", now, utc, ctx)).toBe("2026");
  });

  it("uses ordinals correctly", () => {
    const l = (day: number) => ringLabel("day", now, { ...utc, day }, { ...ctx, uppercase: false });
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(l)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd",
    ]);
  });

  it("localizes", () => {
    const nl = { ...ctx, locale: "nl", uppercase: false };
    expect(ringLabel("weekday", now, utc, nl)).toBe("zaterdag");
    expect(ringLabel("month", now, utc, nl)).toBe("oktober");
    expect(ringLabel("seconds", now, utc, nl)).toBe("15 seconden");
  });

  it("shows am/pm hours in 12h mode", () => {
    expect(ringLabel("hours", now, utc, { ...ctx, hours12: true })).toMatch(/^2\s?PM$/);
  });
});

describe("locale defaults", () => {
  it("detects 12h locales", () => {
    expect(localeUses12h("en-US")).toBe(true);
    expect(localeUses12h("nl-NL")).toBe(false);
  });
  it("detects week start", () => {
    expect(localeFirstWeekday("nl-NL")).toBe(1);
    expect(localeFirstWeekday("en-US")).toBe(0);
  });
});
