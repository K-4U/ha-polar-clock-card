// Renders the README GIFs from the test harness with a fake clock, so every frame is
// exactly 1/FPS s apart regardless of how fast screenshots are taken.
//   npm run docs:gifs        (builds the card first)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const FPS = 25;
const FRAME_MS = 1000 / FPS;
const root = resolve(import.meta.dirname, "..");
const outDir = resolve(root, "docs");
const PORT = 4174;

const DARK = { page: "#111114", vars: { "--card-background-color": "#1c1c21" } };
const LIGHT = { page: "#f0f0f3", vars: { "--card-background-color": "#ffffff" } };

/** One GIF: a card config, a page theme, a start time and a duration. */
const scenes = [
  {
    file: "hero.gif",
    theme: DARK,
    config: {},
    // the top of the hour: seconds and minutes both wind back
    start: "2026-10-10T14:59:57.6Z",
    seconds: 4,
  },
  {
    file: "step.gif",
    theme: DARK,
    config: { motion: "step", background: "#0b0b0f" },
    start: "2026-10-10T09:41:27.8Z",
    seconds: 3,
  },
  {
    file: "theme.gif",
    theme: LIGHT,
    config: {
      color_mode: "theme",
      caps: "round",
      center: "time_date",
      inner_radius: 0.42,
      rings: ["seconds", "minutes", "hours", "day"],
    },
    start: "2026-10-10T20:15:56.5Z",
    seconds: 4,
  },
  {
    file: "rounded.gif",
    theme: DARK,
    config: { caps: "round" },
    start: "2026-10-10T18:22:57.6Z",
    seconds: 4,
  },
];

function startServer() {
  const server = spawn(process.execPath, [resolve(root, "tests/visual/server.mjs")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  return new Promise((res) => server.stdout.once("data", () => res(server)));
}

function encode(frames, width, height) {
  // One palette for the whole GIF (sampled across frames) avoids color flicker between frames.
  const step = Math.max(1, Math.floor(frames.length / 12));
  const sample = Buffer.concat(frames.filter((_, i) => i % step === 0));
  const palette = quantize(sample, 256);
  const gif = GIFEncoder();
  for (const data of frames) {
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: FRAME_MS });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}

async function record(browser, scene) {
  const page = await browser.newPage({ viewport: { width: 460, height: 460 }, deviceScaleFactor: 1 });
  const start = new Date(scene.start).getTime();
  // The fake clock keeps flowing while the page loads, so start early and pause just before `start`.
  await page.clock.install({ time: start - 10_000 });
  await page.goto(`http://127.0.0.1:${PORT}/tests/visual/harness.html`);
  await page.waitForFunction(() => customElements.get("polar-clock-card"));
  await page.evaluate(
    ({ theme, config }) => {
      document.body.style.background = theme.page;
      document.body.style.padding = "20px";
      window.mountCard("scene", config, { width: "380px", ...theme.vars }, null);
    },
    { theme: scene.theme, config: scene.config },
  );
  const target = page.locator("#scene polar-clock-card");
  await target.waitFor();
  // Run one second before recording so the first frame shows a settled clock.
  await page.clock.pauseAt(start - 1000);
  await page.clock.runFor(1000 - FRAME_MS);

  const frames = [];
  const total = Math.round(scene.seconds * FPS);
  let size;
  for (let i = 0; i < total; i++) {
    await page.clock.runFor(FRAME_MS);
    const png = PNG.sync.read(await target.screenshot());
    size ??= { width: png.width, height: png.height };
    frames.push(new Uint8Array(png.data));
  }
  await page.close();
  const gif = encode(frames, size.width, size.height);
  writeFileSync(resolve(outDir, scene.file), gif);
  console.log(`${scene.file}: ${frames.length} frames, ${(gif.length / 1024).toFixed(0)} KiB`);
}

mkdirSync(outDir, { recursive: true });
const server = await startServer();
const browser = await chromium.launch();
try {
  const only = process.argv.slice(2);
  for (const scene of scenes) if (!only.length || only.includes(scene.file)) await record(browser, scene);
} finally {
  await browser.close();
  server.kill();
}
