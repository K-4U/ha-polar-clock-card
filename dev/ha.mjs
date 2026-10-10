// Shared helpers for talking to the local dev Home Assistant.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const base = process.env.HA_URL ?? "http://localhost:8123";
export const RESOURCE_PATH = "/local/polar-clock-card/polar-clock-card.js";
const envFile = resolve(import.meta.dirname, ".dev-credentials");
const bundle = resolve(import.meta.dirname, "../dist/polar-clock-card.js");
const clientId = `${base}/`;

/** Read dev credentials from dev/.dev-credentials, generating them on first use. */
export function loadEnv() {
  const env = {};
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) env[m[1]] = m[2];
    }
  }
  if (!env.DEV_HA_USER || !env.DEV_HA_PASSWORD) {
    env.DEV_HA_USER ??= "dev";
    env.DEV_HA_PASSWORD ??= randomBytes(12).toString("base64url");
    writeFileSync(envFile, `DEV_HA_USER=${env.DEV_HA_USER}\nDEV_HA_PASSWORD=${env.DEV_HA_PASSWORD}\n`);
  }
  return env;
}

/** Resolves with the onboarding steps, or a "done" marker once onboarding is finished (the endpoint then 404s). */
export async function waitForHa() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${base}/api/onboarding`);
      if (res.ok) return res.json();
      if (res.status === 404) return [{ step: "user", done: true }];
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Home Assistant did not come up at ${base}`);
}

export async function post(path, body, token) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

export async function exchange(code) {
  const res = await fetch(`${base}/auth/token`, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId }),
  });
  if (!res.ok) throw new Error(`/auth/token → ${res.status}`);
  return (await res.json()).access_token;
}

export async function onboard(env) {
  const { auth_code } = await post("/api/onboarding/users", {
    client_id: clientId,
    name: "Dev",
    username: env.DEV_HA_USER,
    password: env.DEV_HA_PASSWORD,
    language: "en",
  });
  const token = await exchange(auth_code);
  await post("/api/onboarding/core_config", {}, token);
  await post("/api/onboarding/analytics", {}, token);
  await post("/api/onboarding/integration", { client_id: clientId, redirect_uri: `${base}/?auth_callback=1` }, token);
  console.log(`Onboarded user "${env.DEV_HA_USER}" (password in dev/.dev-credentials).`);
  return token;
}

export async function login(env) {
  const flow = await post("/auth/login_flow", {
    client_id: clientId,
    handler: ["homeassistant", null],
    redirect_uri: `${base}/?auth_callback=1`,
  });
  const step = await post(`/auth/login_flow/${flow.flow_id}`, {
    client_id: clientId,
    username: env.DEV_HA_USER,
    password: env.DEV_HA_PASSWORD,
  });
  if (step.type !== "create_entry") throw new Error("Login failed; check dev/.dev-credentials");
  return exchange(step.result);
}

/** Minimal websocket API client. */
export async function connect(token) {
  const sock = new WebSocket(`${base.replace(/^http/, "ws")}/api/websocket`);
  const pending = new Map();
  let id = 0;
  await new Promise((res, rej) => {
    sock.onerror = rej;
    sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "auth_required") sock.send(JSON.stringify({ type: "auth", access_token: token }));
      else if (msg.type === "auth_ok") res();
      else if (msg.type === "auth_invalid") rej(new Error("websocket auth failed"));
      else if (msg.type === "result") {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.success ? p.res(msg.result) : p.rej(new Error(JSON.stringify(msg.error)));
      }
    };
  });
  return {
    call: (payload) =>
      new Promise((res, rej) => {
        pending.set(++id, { res, rej });
        sock.send(JSON.stringify({ id, ...payload }));
      }),
    close: () => sock.close(),
  };
}

/**
 * Point the card's Lovelace resource at `?v=<hash of the current bundle>`, creating it if needed.
 * HA serves /local with a 31-day cache, so a changing query string is what makes reloads pick up new builds.
 */
export async function syncResource(api) {
  const hash = existsSync(bundle)
    ? createHash("sha1").update(readFileSync(bundle)).digest("hex").slice(0, 10)
    : "none";
  const url = `${RESOURCE_PATH}?v=${hash}`;
  const resources = await api.call({ type: "lovelace/resources" });
  const existing = resources.find((r) => r.url.split("?")[0] === RESOURCE_PATH);
  if (!existing) {
    await api.call({ type: "lovelace/resources/create", res_type: "module", url });
  } else if (existing.url !== url) {
    await api.call({ type: "lovelace/resources/update", resource_id: existing.id, res_type: "module", url });
  }
  return url;
}
