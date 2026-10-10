import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import { DEFAULT_CONFIG, RING_TYPES, normalizeConfig, type PolarClockConfig } from "./config";

const RING_LABELS: Record<(typeof RING_TYPES)[number], string> = {
  seconds: "Seconds",
  minutes: "Minutes",
  hours: "Hours",
  weekday: "Day of week",
  day: "Day of month",
  month: "Month",
  year: "Year",
};

const opts = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

const LABELS: Record<string, string> = {
  rings: "Rings (outermost first)",
  motion: "Motion",
  color_mode: "Color mode",
  palette: "Palette colors",
  ring_colors: "Per-ring colors",
  show_labels: "Ring labels",
  uppercase_labels: "Uppercase labels",
  label_min_ring_px: "Hide labels below ring thickness (px)",
  center: "Center readout",
  ring_width: "Ring thickness (fraction of slot)",
  inner_radius: "Center hole (fraction of radius)",
  start_angle: "Start angle (°)",
  direction: "Direction",
  caps: "Arc ends",
  show_track: "Background track",
  track_opacity: "Track opacity",
  background: "Background",
  text_color: "Text color",
  time_zone: "Time zone",
  locale: "Locale",
  hour_format: "Hour format",
  first_weekday: "First day of week",
  tap_action: "Tap action",
  hold_action: "Hold action",
  double_tap_action: "Double tap action",
  ...RING_LABELS,
};

const HELPERS: Record<string, string> = {
  rings: "Pick and drag to reorder. Defaults to seconds → month.",
  palette: "Used when color mode is Palette, outermost ring first.",
  ring_colors: "Any CSS color, including var(--...). Overrides the color mode.",
  background: "CSS color, 'card' for the theme card background, or 'transparent'. Default #0b0b0f.",
  text_color: "'auto' picks black or white by contrast.",
  time_zone: "Empty follows your HA profile; 'server', 'local', or an IANA zone like Europe/Amsterdam.",
  locale: "Empty follows the HA language, e.g. nl, en-GB.",
  ring_width: "1 = no gap between rings.",
};

/** Built-in HA form editor definition (ha-form schema). */
export const configForm = {
  schema: [
    {
      name: "rings",
      selector: {
        select: {
          multiple: true,
          reorder: true,
          mode: "list",
          options: RING_TYPES.map((r) => ({ value: r, label: RING_LABELS[r] })),
        },
      },
    },
    {
      type: "grid",
      name: "",
      schema: [
        {
          name: "color_mode",
          selector: {
            select: {
              mode: "dropdown",
              options: opts([
                ["rainbow", "Rainbow"],
                ["theme", "Theme"],
                ["palette", "Palette"],
              ]),
            },
          },
        },
        {
          name: "motion",
          selector: {
            select: {
              mode: "dropdown",
              options: opts([
                ["smooth", "Smooth"],
                ["step", "Step"],
              ]),
            },
          },
        },
        {
          name: "center",
          selector: {
            select: {
              mode: "dropdown",
              options: opts([
                ["none", "None"],
                ["time", "Time"],
                ["date", "Date"],
                ["time_date", "Time + date"],
              ]),
            },
          },
        },
        { name: "show_labels", selector: { boolean: {} } },
      ],
    },
    {
      type: "expandable",
      name: "",
      title: "Appearance",
      flatten: true,
      schema: [
        {
          type: "grid",
          name: "",
          schema: [
            { name: "ring_width", selector: { number: { min: 0.1, max: 1, step: 0.05, mode: "slider" } } },
            { name: "inner_radius", selector: { number: { min: 0, max: 0.9, step: 0.05, mode: "slider" } } },
            { name: "start_angle", selector: { number: { min: 0, max: 359, step: 1, mode: "slider" } } },
            { name: "track_opacity", selector: { number: { min: 0, max: 1, step: 0.02, mode: "slider" } } },
            {
              name: "direction",
              selector: {
                select: {
                  mode: "dropdown",
                  options: opts([
                    ["clockwise", "Clockwise"],
                    ["counterclockwise", "Counterclockwise"],
                  ]),
                },
              },
            },
            {
              name: "caps",
              selector: {
                select: {
                  mode: "dropdown",
                  options: opts([
                    ["butt", "Square"],
                    ["round", "Round"],
                  ]),
                },
              },
            },
            { name: "show_track", selector: { boolean: {} } },
            { name: "uppercase_labels", selector: { boolean: {} } },
          ],
        },
        { name: "label_min_ring_px", selector: { number: { min: 0, max: 60, step: 1, mode: "box" } } },
        { name: "background", selector: { text: {} } },
        { name: "text_color", selector: { text: {} } },
      ],
    },
    {
      type: "expandable",
      name: "",
      title: "Colors",
      flatten: true,
      schema: [
        { name: "palette", selector: { text: { multiple: true } } },
        {
          type: "expandable",
          name: "ring_colors",
          title: "Per-ring colors",
          schema: [
            {
              type: "grid",
              name: "",
              schema: RING_TYPES.map((r) => ({ name: r, selector: { text: {} } })),
            },
          ],
        },
      ],
    },
    {
      type: "expandable",
      name: "",
      title: "Time & locale",
      flatten: true,
      schema: [
        {
          type: "grid",
          name: "",
          schema: [
            { name: "time_zone", selector: { text: {} } },
            { name: "locale", selector: { text: {} } },
            {
              name: "hour_format",
              selector: {
                select: {
                  mode: "dropdown",
                  options: opts([
                    ["auto", "Auto (HA profile)"],
                    ["12", "12-hour"],
                    ["24", "24-hour"],
                  ]),
                },
              },
            },
            {
              name: "first_weekday",
              selector: {
                select: {
                  mode: "dropdown",
                  options: opts([
                    ["auto", "Auto (HA profile)"],
                    ["monday", "Monday"],
                    ["tuesday", "Tuesday"],
                    ["wednesday", "Wednesday"],
                    ["thursday", "Thursday"],
                    ["friday", "Friday"],
                    ["saturday", "Saturday"],
                    ["sunday", "Sunday"],
                  ]),
                },
              },
            },
          ],
        },
      ],
    },
    {
      type: "expandable",
      name: "",
      title: "Interactions",
      flatten: true,
      schema: [
        { name: "tap_action", selector: { ui_action: {} } },
        { name: "hold_action", selector: { ui_action: {} } },
        { name: "double_tap_action", selector: { ui_action: {} } },
      ],
    },
  ],
  computeLabel: (s: { name: string }) => LABELS[s.name],
  computeHelper: (s: { name: string }) => HELPERS[s.name],
  assertConfig: (config: Partial<PolarClockConfig>) => {
    normalizeConfig(config);
  },
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Drop keys that equal their default (and empty values) so saved YAML stays minimal. */
export function stripDefaults(config: Record<string, unknown>): Record<string, unknown> {
  const defaults = DEFAULT_CONFIG as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || value === "" || (key in defaults && same(value, defaults[key]))) continue;
    if (key === "ring_colors" && value && typeof value === "object") {
      const colors = Object.fromEntries(Object.entries(value).filter(([, c]) => c));
      if (Object.keys(colors).length) out[key] = colors;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Visual editor: HA's ha-form with our schema, showing defaults for unset options
 * (a bare getConfigForm would show them blank) while only saving changed keys.
 */
export class PolarClockCardEditor extends LitElement {
  @property({ attribute: false }) hass?: unknown;
  @state() private _config?: Record<string, unknown>;

  setConfig(config: Record<string, unknown>) {
    this._config = config;
  }

  protected render() {
    if (!this._config) return html``;
    let error: string | undefined;
    try {
      normalizeConfig(this._config);
    } catch (e) {
      error = (e as Error).message;
    }
    return html`
      ${error ? html`<ha-alert alert-type="error">${error}</ha-alert>` : ""}
      <ha-form
        .hass=${this.hass}
        .data=${{ ...DEFAULT_CONFIG, ...this._config }}
        .schema=${configForm.schema}
        .computeLabel=${configForm.computeLabel}
        .computeHelper=${configForm.computeHelper}
        @value-changed=${this._changed}
      ></ha-form>
    `;
  }

  private _changed(ev: CustomEvent<{ value: Record<string, unknown> }>) {
    ev.stopPropagation();
    const config = { type: this._config?.type ?? "custom:polar-clock-card", ...stripDefaults(ev.detail.value) };
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
}

export const EDITOR_TAG = "polar-clock-card-editor";
if (!customElements.get(EDITOR_TAG)) customElements.define(EDITOR_TAG, PolarClockCardEditor);
