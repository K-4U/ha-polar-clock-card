// Regenerates the Linux screenshot baselines (the ones CI compares against) inside the
// official Playwright image. Works from any OS with Docker:  npm run test:visual:update:linux
// The repo is copied inside the container so the host's node_modules are left alone.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
const version = lock.packages["node_modules/@playwright/test"].version;
const shots = "tests/visual/__screenshots__";

const script = [
  "set -e",
  "mkdir -p /work && cd /src",
  "tar --exclude=node_modules --exclude=dist --exclude=dev/config -cf - . | tar -xf - -C /work",
  "cd /work && npm ci --no-audit --no-fund",
  "CI=1 npx playwright test --update-snapshots",
  `cp ${shots}/*/*-linux.png /src/${shots}/card.spec.ts/`,
].join(" && ");

const res = spawnSync(
  "docker",
  ["run", "--rm", "--ipc=host", "-v", `${root}:/src`, `mcr.microsoft.com/playwright:v${version}-noble`, "bash", "-c", script],
  { stdio: "inherit" },
);
process.exit(res.status ?? 1);
