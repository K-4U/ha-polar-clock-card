import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, normalizeConfig } from "../../src/config";
import { contrastText, isBottomHalf, luminance, mixColors, ringGeometry } from "../../src/render";

describe("normalizeConfig", () => {
  it("fills defaults", () => {
    const cfg = normalizeConfig({ type: "custom:polar-clock-card" });
    expect(cfg.rings).toEqual(DEFAULT_CONFIG.rings);
    expect(cfg.color_mode).toBe("rainbow");
    expect(cfg.motion).toBe("smooth");
    expect(cfg.readable_labels).toBe(true);
    expect(cfg.background).toBe("card");
  });

  it("only knows rainbow, theme and custom color modes", () => {
    expect(normalizeConfig({ color_mode: "custom" }).color_mode).toBe("custom");
    expect(() => normalizeConfig({ color_mode: "palette" as never })).toThrow(/color_mode/);
  });

  it("rejects unknown rings and duplicates", () => {
    expect(() => normalizeConfig({ rings: ["seconds", "decades" as never] })).toThrow(/ring/);
    expect(() => normalizeConfig({ rings: ["seconds", "seconds"] })).toThrow(/duplicates/);
    expect(() => normalizeConfig({ rings: [] })).toThrow(/non-empty/);
  });

  it("validates enums and ranges", () => {
    expect(() => normalizeConfig({ color_mode: "neon" as never })).toThrow(/color_mode/);
    expect(() => normalizeConfig({ ring_width: 2 })).toThrow(/ring_width/);
    expect(normalizeConfig({ hour_format: 12 as never }).hour_format).toBe("12");
  });

  it("drops empty colors from the visual editor", () => {
    const cfg = normalizeConfig({ ring_colors: { seconds: "", minutes: " red " } });
    expect(cfg.ring_colors).toEqual({ minutes: "red" });
    expect(() => normalizeConfig({ ring_colors: { nope: "red" } as never })).toThrow(/ring_colors/);
  });

  it("treats blank time zone and locale as unset", () => {
    const cfg = normalizeConfig({ time_zone: "", locale: " " });
    expect(cfg.time_zone).toBeUndefined();
    expect(cfg.locale).toBeUndefined();
  });
});

describe("stripDefaults", () => {
  it("keeps only non-default, non-empty values", async () => {
    // editor.ts defines a custom element, so stub the registry for node
    (globalThis as any).customElements ??= { get: () => true, define: () => {} };
    const { stripDefaults } = await import("../../src/editor");
    expect(
      stripDefaults({
        ...DEFAULT_CONFIG,
        type: "custom:polar-clock-card",
        motion: "step",
        locale: "",
        color_mode: "custom",
        ring_colors: { seconds: "", minutes: "#ff9f1c", hours: "red" },
      }),
    ).toEqual({ type: "custom:polar-clock-card", motion: "step", color_mode: "custom", ring_colors: { hours: "red" } });
  });

  it("drops ring colors outside custom mode", async () => {
    const { stripDefaults } = await import("../../src/editor");
    expect(stripDefaults({ color_mode: "theme", ring_colors: { hours: "red" } })).toEqual({ color_mode: "theme" });
  });

  it("shows the colors section only in custom mode, for enabled rings", async () => {
    const { buildSchema } = await import("../../src/editor");
    const names = (schema: { name: string }[]) => schema.map((s) => s.name);
    expect(names(buildSchema({ color_mode: "rainbow" }))).not.toContain("ring_colors");
    expect(names(buildSchema({ color_mode: "theme" }))).not.toContain("ring_colors");
    const custom = buildSchema({ color_mode: "custom", rings: ["hours", "minutes"] }) as any[];
    const colors = custom.find((s) => s.name === "ring_colors");
    expect(colors.schema[0].schema.map((f: { name: string }) => f.name)).toEqual(["hours", "minutes"]);
  });
});

describe("render helpers", () => {
  it("lays out rings inside the square", () => {
    const g = ringGeometry(202, 4, 0.5, 0.2);
    expect(g.outer).toBe(100);
    expect(g.inner).toBe(20);
    expect(g.slot).toBe(20);
    expect(g.width).toBe(10);
    expect(g.radii).toEqual([90, 70, 50, 30]);
  });

  it("scales ring thickness linearly with size", () => {
    // outer radius is size/2 - 1 (1px edge inset): 50 vs 200
    const small = ringGeometry(102, 6, 0.8, 0.2).width;
    const big = ringGeometry(402, 6, 0.8, 0.2).width;
    expect(big / small).toBeCloseTo(4);
  });

  it("computes luminance and contrast", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(luminance("rgb(0, 0, 0)")).toBe(0);
    expect(contrastText("#ffd23f")).toBe("#111111");
    expect(contrastText("#0b0b0f")).toBe("#f5f5f5");
    expect(mixColors("#000000", "#ffffff", 0.5)).toBe("rgb(128, 128, 128)");
  });

  it("flips labels only on the bottom half", () => {
    const deg = (d: number) => (d * Math.PI) / 180; // canvas angles: 0 = 3 o'clock, 90 = 6 o'clock
    expect(isBottomHalf(deg(90))).toBe(true);
    expect(isBottomHalf(deg(-90))).toBe(false);
    expect(isBottomHalf(deg(45))).toBe(true);
    expect(isBottomHalf(deg(200))).toBe(false);
  });
});
