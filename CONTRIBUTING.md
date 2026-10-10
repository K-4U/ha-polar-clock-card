# Contributing

## Development setup

You need Node 22+ and Docker.

```bash
npm install
```

```bash
docker compose -f dev/docker-compose.yml up -d
```

```bash
npm run dev:setup
```

```bash
npm run dev
```

- `docker compose -f dev/docker-compose.yml up -d` (or `npm run dev:up`) starts Home Assistant (stable) on http://localhost:8123. On first start it also downloads [HACS](https://hacs.xyz) into the config folder. `dist/` is mounted at `/local/polar-clock-card/`.
- `npm run dev:setup` is safe to re-run. It completes onboarding with a local `dev` user (the generated password is in `dev/.dev-credentials`, gitignored), registers the card as a Lovelace resource, and creates a dashboard you can edit in the UI.
- `npm run dev` rebuilds on every change and updates the resource's `?v=` hash, so a normal browser reload picks up the new build. HA caches `/local` for 31 days, so without the hash you'd keep seeing an old build.

Dashboards for testing:

- `/polar-dev`: a YAML dashboard with masonry, sections and panel views covering the different sizing cases ([dev/config/dashboards/polar-dev.yaml](dev/config/dashboards/polar-dev.yaml)).
- `/polar-edit`: a UI-managed dashboard for trying out the visual editor.

To test a real HACS install: complete the GitHub sign-in in **Settings → Devices & services → Add integration → HACS**, add this repository as a custom repository, then delete the dev resource under **Settings → Dashboards → Resources** so only the HACS copy loads.

> Note: `frontend.extra_module_url` doesn't work for loading this card on HA 2026.10 and newer. It runs before the scoped custom element registry polyfill, so the element definition gets lost. Register the card as a Lovelace resource instead.

## README GIFs

```bash
npm run docs:gifs
```

This renders the GIFs in [docs/](docs/) from the test harness using Playwright's fake clock, so every frame is exactly 1/25 s apart. Pass file names to render only some of them, e.g. `node docs/make-gifs.mjs hero.gif`. The scenes are defined at the top of [docs/make-gifs.mjs](docs/make-gifs.mjs).

## Tests

```bash
npm test
```

```bash
npm run test:visual
```

- `npm test` runs Vitest unit tests for the time math, labels, config validation and geometry.
- `npm run test:visual` runs Playwright against a standalone harness ([tests/visual/harness.html](tests/visual/harness.html)) with a fixed clock. It covers screenshots of each look, sizing in masonry/grid/small/high-DPI layouts, pausing the render loop (off screen, reduced motion, step mode), and actions. Screenshot baselines are per platform. CI compares against the `-linux` ones; regenerate those with `npm run test:visual:update:linux` (runs in the Playwright Docker image), and your local ones with `npm run test:visual:update`.

## Checks and releases

Every pull request and push to `main` runs [CI](.github/workflows/ci.yml):

- **Tests**: typecheck, unit tests and Playwright visual tests. Results are published as a *Test Results* check and a comment on the pull request.
- **Build**: bundles the card and uploads `polar-clock-card.js` as a workflow artifact, so you can try a pull request without building it yourself.
- **HACS validation**: the HACS repository checks. Since the built card is only published on releases, this check needs at least one release with `polar-clock-card.js` attached before it can pass.

`main` is protected by [.github/rulesets/protect-main.json](.github/rulesets/protect-main.json): changes need a pull request with all three checks passing. Import it under **Settings → Rules → Rulesets → New ruleset → Import a ruleset**.

To release, publish a GitHub release with a tag like `v1.2.3`. The [release workflow](.github/workflows/release.yml) then:

1. runs the CI checks (except HACS validation, which can only pass once the file is attached)
2. builds the card with that version
3. attaches `polar-clock-card.js` to the release, which is the file HACS installs. The default branch is hidden in HACS because it contains no build.
   HACS validation then runs against the release.
4. for non-prerelease versions, commits the new version to `package.json` on `main`. This needs a deploy key with write access, stored as the repository secret `VERSION_DEPLOY_KEY`. The ruleset lets deploy keys bypass the pull request rule. Without the key, the step is skipped with a warning.
