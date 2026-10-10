# Polar Clock Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![CI](https://github.com/K-4U/ha-polar-clock-card/actions/workflows/ci.yml/badge.svg)](https://github.com/K-4U/ha-polar-clock-card/actions/workflows/ci.yml)

A polar clock for Home Assistant dashboards. Concentric rings fill up as seconds, minutes, hours, days, months and the year go by. Inspired by the classic pixelbreaker polar clock.

<p align="center">
  <img src="https://raw.githubusercontent.com/K-4U/ha-polar-clock-card/main/docs/hero.gif" width="380" alt="Polar clock at the top of the hour: the seconds and minutes rings wind back down together">
</p>

- Seven rings to choose from (seconds, minutes, hours, day of week, day of month, month, year), each optional and in any order
- Smooth motion that winds full rings back down instead of jumping to empty, or stepped motion where each step stretches and then snaps into place
- Rainbow, theme-aware, or custom colours (one per ring)
- Labels on the arcs that stay upright all the way round, and an optional time/date readout in the centre
- **Sizes itself automatically**: stays square in masonry views, fills its cell in sections views, and fits the screen height in panel views. Labels hide when the card gets too small
- Sharp on high-DPI screens. Uses your Home Assistant time zone, language, 12/24h setting and first day of the week
- Respects *prefers-reduced-motion* and stops animating when off screen or in a background tab
- Visual editor and YAML. Supports tap, hold and double-tap actions

Requires Home Assistant **2024.8** or newer.

<table>
  <tr>
    <td align="center"><img src="https://raw.githubusercontent.com/K-4U/ha-polar-clock-card/main/docs/step.gif" width="240" alt="Step motion"><br><code>motion: step</code></td>
    <td align="center"><img src="https://raw.githubusercontent.com/K-4U/ha-polar-clock-card/main/docs/theme.gif" width="240" alt="Theme colours with a centre readout"><br><code>color_mode: theme</code> + <code>center</code></td>
    <td align="center"><img src="https://raw.githubusercontent.com/K-4U/ha-polar-clock-card/main/docs/rounded.gif" width="240" alt="Rainbow rings with rounded ends"><br><code>caps: round</code></td>
  </tr>
</table>

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

That gives you the classic rainbow rings on your theme's card background. Here is a busier example:

```yaml
type: custom:polar-clock-card
rings: [seconds, minutes, hours, day, month, year]
color_mode: custom
ring_colors:
  seconds: var(--accent-color)
  hours: "#ff4d6d"
center: time_date
inner_radius: 0.4
caps: round
tap_action:
  action: navigate
  navigation_path: /lovelace/clock
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `rings` | `[seconds, minutes, hours, weekday, day, month]` | Rings to show, outermost first. Also: `year`. |
| `motion` | `smooth` | `smooth` sweeps continuously, and a full ring winds back down to its new value. `step` moves once per unit: the arc creeps forward, then snaps into place. Reduced-motion users always get `step`, without the snap animation or the wind-back. |
| `color_mode` | `rainbow` | `rainbow` (hue follows progress), `theme` (blend of `--primary-color` → `--accent-color`), or `custom` (set by `ring_colors`). |
| `ring_colors` | a bright colour per ring | Only used with `color_mode: custom`, e.g. `{ hours: "#ff4d6d" }`. Rings you leave out keep their default colour. Accepts any CSS colour, including `var(--…)`. |
| `show_labels` | `true` | Text on each arc. |
| `uppercase_labels` | `true` | Classic all-caps labels. |
| `readable_labels` | `true` | Flips labels on the bottom half so they read left to right instead of upside down. |
| `label_min_ring_px` | `9` | Labels hide when rings are thinner than this (px). |
| `center` | `none` | `none`, `time`, `date`, `time_date`. The text scales with `inner_radius`. |
| `ring_width` | `0.8` | Fraction of each ring's slot taken by the arc (`1` leaves no gap). |
| `inner_radius` | `0.2` | Size of the empty centre as a fraction of the radius. |
| `start_angle` | `0` | Degrees; `0` is 12 o'clock. |
| `direction` | `clockwise` | or `counterclockwise`. |
| `caps` | `butt` | Arc ends: `butt` (square) or `round`. |
| `show_track` | `true` | Faint full circle behind each arc. |
| `track_opacity` | `0.12` | Opacity of the track. |
| `background` | `card` | `card` follows your theme's card background (light or dark). Can also be any CSS colour (e.g. `#0b0b0f` for the classic black) or `transparent`. |
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

## Contributing

Development setup, tests, CI and releases are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
