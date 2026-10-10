// Dev loop: rollup in watch mode + bump the Lovelace resource's ?v= after every build,
// so a plain browser reload of the dev HA picks up the new card.
import { spawn } from "node:child_process";
import { connect, loadEnv, login, syncResource, waitForHa } from "./ha.mjs";

await waitForHa();
const api = await connect(await login(loadEnv()));

const rollup = spawn("npx", ["rollup", "-c", "--watch"], {
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, ROLLUP_WATCH: "true" },
});

// Rollup reports progress on stderr.
const onOutput = (out) => async (chunk) => {
  out.write(chunk);
  if (/created dist[\\/]polar-clock-card\.js/.test(String(chunk))) {
    try {
      console.log(`→ resource ${await syncResource(api)} (reload the browser)`);
    } catch (e) {
      console.error("Could not update resource:", e.message);
    }
  }
};
rollup.stdout.on("data", onOutput(process.stdout));
rollup.stderr.on("data", onOutput(process.stderr));

rollup.on("exit", (code) => {
  api.close();
  process.exit(code ?? 0);
});
