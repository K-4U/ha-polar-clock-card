# Polar Clock Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![CI](https://github.com/K-4U/ha-polar-clock-card/actions/workflows/ci.yml/badge.svg)](https://github.com/K-4U/ha-polar-clock-card/actions/workflows/ci.yml)

A polar clock for Home Assistant dashboards. Concentric rings fill up as seconds, minutes, hours, days, months and the year go by. Inspired by the classic pixelbreaker polar clock.

- Seven rings to choose from (seconds, minutes, hours, day of week, day of month, month, year), each optional and in any order
- Smooth or stepped motion
- Rainbow, theme-aware, or fixed-palette colours, plus a colour override for each ring
- Labels on the arcs and an optional time/date readout in the centre
- **Sizes itself automatically**: stays square in masonry views, fills its cell in sections views, and fits the screen height in panel views. Labels hide when the card gets too small
- Sharp on high-DPI screens. Uses your Home Assistant time zone, language, 12/24h setting and first day of the week
- Respects *prefers-reduced-motion* and stops animating when off screen or in a background tab
- Visual editor and YAML. Supports tap, hold and double-tap actions

Requires Home Assistant **2024.8** or newer.

## Installation

### HACS (recommended)

1. In HACS, open the ⋮ menu → **Custom repositories**.
2. Add `https://github.com/K-4U/ha-polar-clock-card`, category **Dashboard**.
3. Search for **Polar Clock Card** and download it. HACS registers the dashboard resource for you.
4. Reload your browser.

### Manual

1. Download `polar-clock-card.js` from the [latest release](https://github.com/K-4U/ha-polar-clock-card/releases/latest) into `<config>/www/`.
2. Go to **Settings → Dashboards → ⋮ → Resources** and add `/local/polar-clock-card.js` as a *JavaScript module*.

## Usage

```yaml
type: custom:polar-clock-card
```

That gives you the classic look. Here is a busier example:

```yaml
type: custom:polar-clock-card
rings: [seconds, minutes, hours, day, month, year]
color_mode: theme
center: time_date
inner_radius: 0.4
caps: round
background: card
ring_colors:
  seconds: var(--accent-color)
tap_action:
  action: navigate
  navigation_path: /lovelace/clock
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `rings` | `[seconds, minutes, hours, weekday, day, month]` | Rings to show, outermost first. Also: `year`. |
| `motion` | `smooth` | `smooth` sweeps continuously; `step` jumps once per unit. Reduced-motion users always get `step`. |
| `color_mode` | `rainbow` | `rainbow` (hue follows progress), `theme` (blend of `--primary-color` → `--accent-color`), `palette`. |
| `palette` | 7 bright colours | List of colours for `palette` mode, outermost ring first. |
| `ring_colors` | – | Colour for individual rings, e.g. `{ hours: "#ff4d6d" }`. Takes priority over `color_mode`. Accepts any CSS colour, including `var(--…)`. |
| `show_labels` | `true` | Text on each arc. |
| `uppercase_labels` | `true` | Classic all-caps labels. |
| `label_min_ring_px` | `9` | Labels hide when rings are thinner than this (px). |
| `center` | `none` | `none`, `time`, `date`, `time_date`. The text scales with `inner_radius`. |
| `ring_width` | `0.8` | Fraction of each ring's slot taken by the arc (`1` leaves no gap). |
| `inner_radius` | `0.2` | Size of the empty centre as a fraction of the radius. |
| `start_angle` | `0` | Degrees; `0` is 12 o'clock. |
| `direction` | `clockwise` | or `counterclockwise`. |
| `caps` | `butt` | Arc ends: `butt` (square) or `round`. |
| `show_track` | `true` | Faint full circle behind each arc. |
| `track_opacity` | `0.12` | Opacity of the track. |
| `background` | `#0b0b0f` | CSS colour, `card` (theme card background), or `transparent`. |
| `text_color` | `auto` | Colour of labels drawn off the arc and of the centre readout. `auto` picks by contrast. |
| `time_zone` | HA profile | `server`, `local`, or an IANA zone such as `Europe/Amsterdam`. |
| `locale` | HA language | BCP 47 tag, e.g. `nl`, `en-GB`. |
| `hour_format` | `auto` | `auto` (from your HA profile), `12`, `24`. In 12h mode the hours ring covers 12 hours. |
| `first_weekday` | `auto` | `auto` (HA profile / locale) or `monday` … `sunday`. |
| `tap_action` / `hold_action` / `double_tap_action` | `none` | Standard [Home Assistant actions](https://www.home-assistant.io/dashboards/actions/). |

### Sizing

The card has no fixed size. The clock is always a circle that fits the shorter side of the space it gets:

- **Masonry view**: as wide as the column, and square.
- **Sections view**: defaults to 6 columns × 4 rows (minimum 3 × 2). Resize it freely and the clock fits the cell.
- **Panel view**: fills the width, but never gets taller than the visible screen.

Use the CSS variable `--polar-clock-padding` (default `8px`) to change the inner padding, for example with card-mod.

## Development

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

### Tests

```bash
npm test
```

```bash
npm run test:visual
```

- `npm test` runs Vitest unit tests for the time math, labels, config validation and geometry.
- `npm run test:visual` runs Playwright against a standalone harness ([tests/visual/harness.html](tests/visual/harness.html)) with a fixed clock. It covers screenshots of each look, sizing in masonry/grid/small/high-DPI layouts, pausing the render loop (off screen, reduced motion, step mode), and actions. Screenshot baselines are per platform. CI compares against the `-linux` ones; regenerate those with `npm run test:visual:update:linux` (runs in the Playwright Docker image), and your local ones with `npm run test:visual:update`.

### Checks and releases

Every pull request and push to `main` runs [CI](.github/workflows/ci.yml):

- **Tests**: typecheck, unit tests and Playwright visual tests. Results are published as a *Test Results* check and a comment on the pull request.
- **Build**: bundles the card and uploads `polar-clock-card.js` as a workflow artifact, so you can try a pull request without building it yourself.
- **HACS validation**: the HACS repository checks.

`main` is protected by [.github/rulesets/protect-main.json](.github/rulesets/protect-main.json): changes need a pull request with all three checks passing. Import it under **Settings → Rules → Rulesets → New ruleset → Import a ruleset**.

To release, publish a GitHub release with a tag like `v1.2.3`. The [release workflow](.github/workflows/release.yml) then:

1. runs the CI checks
2. builds the card with that version
3. attaches `polar-clock-card.js` to the release, which is the file HACS installs. The default branch is hidden in HACS because it contains no build.
4. for non-prerelease versions, commits the new version to `package.json` on `main`. This needs a deploy key with write access, stored as the repository secret `VERSION_DEPLOY_KEY`. The ruleset lets deploy keys bypass the pull request rule. Without the key, the step is skipped with a warning.

## License

MIT
