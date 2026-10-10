import { expect, test, type Page } from "@playwright/test";

type Box = Record<string, string>;

async function mount(page: Page, id: string, config: object = {}, box: Box = {}) {
  await page.evaluate(
    ([id, config, box]) => (window as any).mountCard(id, config, box),
    [id, config, box] as const,
  );
  const card = page.locator(`#${id} polar-clock-card`);
  await expect(card).toHaveAttribute("data-size", /\d+/);
  return card;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/visual/harness.html");
  await page.waitForFunction(() => customElements.get("polar-clock-card"));
});

test.describe("looks", () => {
  test("default look on a light theme", async ({ page }) => {
    const card = await mount(page, "classic");
    await expect(card).toHaveScreenshot("classic.png");
  });

  test("default look follows a dark theme", async ({ page }) => {
    const card = await mount(page, "dark", {}, { "--card-background-color": "#1c1c1c" });
    await expect(card).toHaveScreenshot("dark.png");
  });

  test("labels upside down when readable_labels is off", async ({ page }) => {
    const card = await mount(page, "unreadable", { readable_labels: false, background: "#0b0b0f" });
    await expect(card).toHaveScreenshot("not-readable.png");
  });

  test("theme colors, round caps, center readout", async ({ page }) => {
    const card = await mount(page, "theme", {
      color_mode: "theme",
      caps: "round",
      center: "time_date",
      inner_radius: 0.4,
      background: "card",
      rings: ["seconds", "minutes", "hours", "day"],
    });
    await expect(card).toHaveScreenshot("theme-center.png");
  });

  test("custom colors, counterclockwise, rotated, no track", async ({ page }) => {
    const card = await mount(page, "custom", {
      color_mode: "custom",
      background: "#0b0b0f",
      direction: "counterclockwise",
      start_angle: 90,
      show_track: false,
      ring_colors: { month: "var(--accent-color)" },
      rings: ["year", "month", "weekday", "hours", "minutes"],
    });
    await expect(card).toHaveScreenshot("custom-ccw.png");
  });

  test("step motion and 12h labels", async ({ page }) => {
    const card = await mount(page, "step", { motion: "step", hour_format: "12", uppercase_labels: false });
    await expect(card).toHaveScreenshot("step-12h.png");
  });
});

test.describe("auto sizing", () => {
  test("stays square and fills the width in a masonry column", async ({ page }) => {
    const card = await mount(page, "masonry", {}, { width: "320px" });
    const canvas = card.locator("canvas");
    const box = (await canvas.boundingBox())!;
    expect(Math.round(box.width)).toBe(Math.round(box.height));
    expect(box.width).toBeGreaterThan(290);
  });

  test("fits the shorter side of a fixed-size grid cell", async ({ page }) => {
    const card = await mount(page, "grid", {}, { width: "600px", height: "240px" });
    const size = Number(await card.getAttribute("data-size"));
    expect(size).toBeLessThanOrEqual(240);
    expect(size).toBeGreaterThan(200);
    const cardBox = (await card.boundingBox())!;
    expect(Math.round(cardBox.height)).toBe(240);
  });

  test("hides labels when small and shows them when big", async ({ page }) => {
    const small = await mount(page, "small", {}, { width: "140px" });
    const big = await mount(page, "big", {}, { width: "500px" });
    await expect(small).toHaveAttribute("data-labels", "hidden");
    await expect(big).toHaveAttribute("data-labels", "visible");
  });

  test("redraws on resize", async ({ page }) => {
    const card = await mount(page, "resize", {}, { width: "140px" });
    await expect(card).toHaveAttribute("data-labels", "hidden");
    await page.locator("#resize").evaluate((el) => (el.style.width = "500px"));
    await expect(card).toHaveAttribute("data-labels", "visible");
    await expect(card).toHaveAttribute("data-size", /^4[5-9]\d$/);
  });

  test("renders crisply on high-DPI screens", async ({ browser }) => {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.goto("/tests/visual/harness.html");
    await page.waitForFunction(() => customElements.get("polar-clock-card"));
    const card = await mount(page, "hidpi", {}, { width: "300px" });
    const { width, cssWidth } = await card
      .locator("canvas")
      .evaluate((c: HTMLCanvasElement) => ({ width: c.width, cssWidth: c.clientWidth }));
    expect(width).toBe(cssWidth * 2);
    await page.close();
  });
});

test.describe("render loop", () => {
  const rafDelta = async (page: Page, ms = 400) => {
    const before = await page.evaluate(() => (window as any).__raf);
    await page.waitForTimeout(ms);
    return (await page.evaluate(() => (window as any).__raf)) - before;
  };

  test("animates smoothly while visible", async ({ page }) => {
    await mount(page, "visible");
    expect(await rafDelta(page)).toBeGreaterThan(5);
  });

  test("pauses when scrolled off screen", async ({ page }) => {
    await mount(page, "offscreen", {}, { marginTop: "5000px" });
    await page.waitForTimeout(100);
    expect(await rafDelta(page)).toBe(0);
  });

  test("uses step mode when the user prefers reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mount(page, "reduced");
    expect(await rafDelta(page)).toBe(0);
  });

  test("does not animate in step mode", async ({ page }) => {
    await mount(page, "stepping", { motion: "step" });
    expect(await rafDelta(page)).toBe(0);
  });
});

test.describe("actions", () => {
  test("fires hass-action on tap", async ({ page }) => {
    const card = await mount(page, "tap", { tap_action: { action: "navigate", navigation_path: "/x" } });
    const detail = page.evaluate(
      () =>
        new Promise((resolve) =>
          document.addEventListener("hass-action", (e) => resolve((e as CustomEvent).detail), { once: true }),
        ),
    );
    await card.click();
    expect(await detail).toMatchObject({ action: "tap", config: { tap_action: { action: "navigate" } } });
  });

  test("rejects invalid config with a readable error", async ({ page }) => {
    const msg = await page.evaluate(() => {
      const el = document.createElement("polar-clock-card") as any;
      try {
        el.setConfig({ type: "custom:polar-clock-card", rings: ["seconds", "eons"] });
      } catch (e) {
        return (e as Error).message;
      }
      return "no error";
    });
    expect(msg).toMatch(/Invalid ring "eons"/);
  });
});
