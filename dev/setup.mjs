// Prepares the local dev Home Assistant (http://localhost:8123). Safe to re-run.
//  1. Completes onboarding with a local test user (credentials in dev/.dev-credentials, gitignored).
//  2. Registers the locally built card as a Lovelace resource, like HACS does.
//  3. Creates a UI-editable dashboard for testing the visual editor.
import { base, connect, loadEnv, login, onboard, syncResource, waitForHa } from "./ha.mjs";

const steps = await waitForHa();
const env = loadEnv();
const onboarded = steps.find((s) => s.step === "user")?.done;
const token = onboarded ? await login(env) : await onboard(env);
const api = await connect(token);

console.log(`Lovelace resource: ${await syncResource(api)}`);

const dashboards = await api.call({ type: "lovelace/dashboards/list" });
if (!dashboards.some((d) => d.url_path === "polar-edit")) {
  await api.call({
    type: "lovelace/dashboards/create",
    url_path: "polar-edit",
    title: "Polar Clock Editor",
    icon: "mdi:pencil-circle-outline",
    mode: "storage",
    show_in_sidebar: true,
    require_admin: false,
  });
  await api.call({
    type: "lovelace/config/save",
    url_path: "polar-edit",
    config: { views: [{ title: "Edit", cards: [{ type: "custom:polar-clock-card" }] }] },
  });
  console.log("Created storage dashboard /polar-edit for visual editor testing.");
}

api.close();
console.log(`Ready: ${base}/polar-dev/masonry (YAML views) and ${base}/polar-edit (UI editor)`);
