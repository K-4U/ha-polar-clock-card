import { LitElement, css, html, type PropertyValues } from "lit";
import { property, query, state } from "lit/decorators.js";
import { bindGestures, hasAnyAction } from "./actions";
import { DEFAULT_CONFIG, normalizeConfig, type PolarClockConfig } from "./config";
import { EDITOR_TAG } from "./editor";
import { canonicalColor, contrastText, drawClock, mixColors, type RenderModel } from "./render";
import {
  WEEKDAY_INDEX,
  centerText,
  localeFirstWeekday,
  localeUses12h,
  ringLabel,
  ringProgress,
  zonedParts,
  type LabelContext,
} from "./time";

declare const __VERSION__: string;
const CARD_TAG = "polar-clock-card";

/** The subset of the `hass` object this card reads. */
interface Hass {
  language?: string;
  locale?: { language?: string; time_format?: string; time_zone?: string; first_weekday?: string };
  config?: { time_zone?: string };
  themes?: { darkMode?: boolean; theme?: string };
}

interface TimeSettings {
  ctx: LabelContext;
  firstWeekday: number;
}

const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

function validZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export class PolarClockCard extends LitElement {
  @property({ attribute: false }) hass?: Hass;
  /** Set by Home Assistant to "grid" (sections) or "panel". */
  @property({ reflect: true }) layout?: string;
  @state() private _config?: PolarClockConfig;

  @query("canvas") private _canvas?: HTMLCanvasElement;
  @query(".wrap") private _wrap?: HTMLDivElement;
  @query("ha-card") private _card?: HTMLElement;
  @query(".probe") private _probe?: HTMLSpanElement;

  private _size = { w: 0, h: 0 };
  private _resizeObs?: ResizeObserver;
  private _intersectObs?: IntersectionObserver;
  private _onScreen = true;
  private _frame?: number;
  private _timer?: number;
  private _colorCache = new Map<string, string>();
  private _time?: TimeSettings;
  private _unbindGestures?: () => void;
  /** Fixed clock for tests/screenshots; set via `card.now = Date`. */
  public now?: Date;

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(): Partial<PolarClockConfig> {
    return {
      rings: DEFAULT_CONFIG.rings,
      color_mode: DEFAULT_CONFIG.color_mode,
      motion: DEFAULT_CONFIG.motion,
      center: DEFAULT_CONFIG.center,
      show_labels: true,
    };
  }

  setConfig(config: Partial<PolarClockConfig>) {
    this._config = normalizeConfig(config);
    this._colorCache.clear();
    this._time = undefined;
  }

  getCardSize(): number {
    return 7;
  }

  getGridOptions() {
    return { columns: 6, rows: 4, min_columns: 3, min_rows: 2 };
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
    ha-card {
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--polar-clock-padding, 8px);
    }
    ha-card.actionable {
      cursor: pointer;
    }
    .wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      max-height: 100%;
    }
    :host([layout="panel"]) .wrap,
    :host([in-panel]) .wrap {
      /* Panel views grow with content, so cap the clock at the visible viewport. */
      max-height: calc(100vh - var(--header-height, 56px) - 2 * var(--polar-clock-padding, 8px) - 16px);
    }
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    .probe {
      position: absolute;
      visibility: hidden;
      pointer-events: none;
    }
  `;

  protected render() {
    if (!this._config) return html``;
    const bg = this._config.background;
    const style = bg === "card" ? "" : `background: ${bg};`;
    const actionable = hasAnyAction(this._config);
    return html`
      <ha-card
        style=${style}
        class=${actionable ? "actionable" : ""}
        tabindex=${actionable ? "0" : "-1"}
        role=${actionable ? "button" : "img"}
        aria-label="Polar clock"
      >
        <div class="wrap"><canvas></canvas></div>
        <span class="probe"></span>
      </ha-card>
    `;
  }

  protected firstUpdated() {
    this._resizeObs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      this._size = { w: width, h: height };
      this._draw();
    });
    if (this._wrap) this._resizeObs.observe(this._wrap);

    this._intersectObs = new IntersectionObserver(([entry]) => {
      this._onScreen = entry.isIntersecting;
      this._schedule();
    });
    this._intersectObs.observe(this);

    if (this._card) this._unbindGestures = bindGestures(this._card, this, () => this._config);
    this.toggleAttribute("in-panel", this._isInPanelView());
    this._schedule();
  }

  protected updated(changed: PropertyValues) {
    if (changed.has("hass")) {
      const prev = changed.get("hass") as Hass | undefined;
      if (prev?.themes !== this.hass?.themes) this._colorCache.clear();
      if (prev?.locale !== this.hass?.locale || prev?.config !== this.hass?.config) this._time = undefined;
    }
    if (changed.has("_config")) this._colorCache.clear();
    this._draw();
  }

  /** Only re-render the DOM for config/layout changes; hass updates just redraw the canvas. */
  protected shouldUpdate(changed: PropertyValues) {
    if (changed.has("_config") || changed.has("layout")) return true;
    if (changed.has("hass")) {
      const prev = changed.get("hass") as Hass | undefined;
      return (
        !prev ||
        prev.themes !== this.hass?.themes ||
        prev.locale !== this.hass?.locale ||
        prev.config !== this.hass?.config
      );
    }
    return false;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this._schedule);
    reducedMotion?.addEventListener?.("change", this._schedule);
    if (this.hasUpdated) {
      if (this._card && !this._unbindGestures) {
        this._unbindGestures = bindGestures(this._card, this, () => this._config);
      }
      this._schedule();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this._schedule);
    reducedMotion?.removeEventListener?.("change", this._schedule);
    this._unbindGestures?.();
    this._unbindGestures = undefined;
    this._stop();
  }

  private _isInPanelView(): boolean {
    let node: Node | null = this;
    while (node) {
      if (node instanceof HTMLElement && node.tagName === "HUI-PANEL-VIEW") return true;
      node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
    }
    return false;
  }

  private get _motion() {
    return reducedMotion?.matches ? "step" : (this._config?.motion ?? "smooth");
  }

  private _stop() {
    if (this._frame !== undefined) cancelAnimationFrame(this._frame);
    if (this._timer !== undefined) clearTimeout(this._timer);
    this._frame = this._timer = undefined;
  }

  /** (Re)start the render loop if the card is visible; pause it otherwise. */
  private _schedule = () => {
    this._stop();
    if (!this.isConnected || !this._config || document.hidden || !this._onScreen) return;
    const loop = () => {
      this._draw();
      if (this._motion === "smooth") {
        this._frame = requestAnimationFrame(loop);
      } else {
        const now = this.now ?? new Date();
        this._timer = window.setTimeout(loop, 1000 - now.getMilliseconds() + 5);
      }
    };
    loop();
  };

  private _resolveColor(value: string): string {
    let out = this._colorCache.get(value);
    if (out !== undefined) return out;
    out = value;
    if (this._probe) {
      this._probe.style.color = "";
      this._probe.style.color = value;
      out = getComputedStyle(this._probe).color || value;
    }
    this._colorCache.set(value, out);
    return out;
  }

  private _timeSettings(): TimeSettings {
    if (this._time) return this._time;
    const cfg = this._config!;
    const hass = this.hass;
    const locale =
      cfg.locale ?? hass?.locale?.language ?? hass?.language ?? navigator.language ?? "en";

    let timeZone: string | undefined;
    const tz = cfg.time_zone;
    if (tz === "local") timeZone = undefined;
    else if (tz === "server") timeZone = hass?.config?.time_zone;
    else if (tz && validZone(tz)) timeZone = tz;
    else if (hass?.locale?.time_zone === "server") timeZone = hass?.config?.time_zone;
    if (timeZone && !validZone(timeZone)) timeZone = undefined;

    let hours12: boolean;
    if (cfg.hour_format !== "auto") hours12 = cfg.hour_format === "12";
    else {
      const f = hass?.locale?.time_format;
      if (f === "12" || f === "24") hours12 = f === "12";
      else if (f === "system") hours12 = localeUses12h(navigator.language);
      else hours12 = localeUses12h(locale);
    }

    let firstWeekday: number;
    if (cfg.first_weekday !== "auto") firstWeekday = WEEKDAY_INDEX[cfg.first_weekday];
    else {
      const fw = hass?.locale?.first_weekday as keyof typeof WEEKDAY_INDEX | "language" | undefined;
      firstWeekday = fw && fw !== "language" && fw in WEEKDAY_INDEX ? WEEKDAY_INDEX[fw] : localeFirstWeekday(locale);
    }

    this._time = {
      ctx: { locale, timeZone, hours12, uppercase: cfg.uppercase_labels },
      firstWeekday,
    };
    return this._time;
  }

  private _ringColor(index: number, count: number, progress: number, ctx2d: CanvasRenderingContext2D): string {
    const cfg = this._config!;
    const type = cfg.rings[index];
    const override = cfg.ring_colors[type];
    if (override) return canonicalColor(ctx2d, this._resolveColor(override));
    switch (cfg.color_mode) {
      case "rainbow":
        return canonicalColor(ctx2d, `hsl(${Math.round(progress * 360) % 360}, 85%, 58%)`);
      case "palette":
        return canonicalColor(ctx2d, this._resolveColor(cfg.palette[index % cfg.palette.length]));
      case "theme": {
        const a = canonicalColor(ctx2d, this._resolveColor("var(--primary-color, #03a9f4)"));
        const b = canonicalColor(ctx2d, this._resolveColor("var(--accent-color, #ff9800)"));
        return count > 1 ? mixColors(a, b, index / (count - 1)) : a;
      }
    }
  }

  private _draw() {
    const cfg = this._config;
    const canvas = this._canvas;
    const { w, h } = this._size;
    if (!cfg || !canvas || w <= 0 || h <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    const now = this.now ?? new Date();
    const time = this._timeSettings();
    const parts = zonedParts(now, time.ctx.timeZone);
    const motion = this._motion;

    const rings = cfg.rings.map((type, i) => {
      const progress = ringProgress(type, parts, motion, {
        firstWeekday: time.firstWeekday,
        hours12: time.ctx.hours12,
      });
      return {
        progress,
        color: this._ringColor(i, cfg.rings.length, progress, ctx2d),
        label: cfg.show_labels ? ringLabel(type, now, parts, time.ctx) : "",
      };
    });

    const bg =
      cfg.background === "card" || cfg.background === "transparent"
        ? this._resolveColor("var(--ha-card-background, var(--card-background-color, #fff))")
        : this._resolveColor(cfg.background);
    const textColor =
      cfg.text_color === "auto" ? contrastText(canonicalColor(ctx2d, bg)) : this._resolveColor(cfg.text_color);

    const centerLines =
      cfg.center === "none"
        ? []
        : cfg.center === "time_date"
          ? [centerText("time", now, time.ctx), centerText("date", now, time.ctx)]
          : [centerText(cfg.center, now, time.ctx)];

    const model: RenderModel = {
      rings,
      centerLines,
      ringWidth: cfg.ring_width,
      innerRadius: cfg.inner_radius,
      startAngle: cfg.start_angle,
      direction: cfg.direction,
      caps: cfg.caps,
      showTrack: cfg.show_track,
      trackOpacity: cfg.track_opacity,
      showLabels: cfg.show_labels,
      labelMinRingPx: cfg.label_min_ring_px,
      textColor,
      fontFamily: getComputedStyle(this).fontFamily || "sans-serif",
    };
    const result = drawClock(ctx2d, w, h, model);
    this.dataset.labels = result.labelsVisible ? "visible" : "hidden";
    this.dataset.size = String(Math.round(Math.min(w, h)));
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, PolarClockCard);

  const w = window as unknown as { customCards?: unknown[] };
  w.customCards = w.customCards || [];
  w.customCards.push({
    type: CARD_TAG,
    name: "Polar Clock",
    description: "A configurable polar clock with concentric time rings.",
    preview: true,
    documentationURL: "https://github.com/K-4U/ha-polar-clock-card",
  });

  console.info(
    `%c POLAR-CLOCK-CARD %c ${__VERSION__} `,
    "color: #fff; background: #7b2ff7; font-weight: 700;",
    "color: #7b2ff7; background: #fff;",
  );
}
