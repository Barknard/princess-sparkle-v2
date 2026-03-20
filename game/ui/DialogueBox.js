/**
 * DialogueBox.js — Voice-driven speech bubble renderer
 *
 * Rounded rectangle with soft gradient background.
 * Portrait area on the left side.
 * Pulsing glow while voice is playing.
 * No text (or minimal decorative) — voice does the work.
 * Gentle fade in (400ms) and fade out (400ms).
 *
 * All rendering is canvas-only, no DOM.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';

// ---- Layout constants (logical pixels) --------------------------------------

const BOX_MARGIN_X = 16;
const BOX_MARGIN_BOTTOM = 12;
const BOX_HEIGHT = 72;
const BOX_Y = LOGICAL_HEIGHT - BOX_HEIGHT - BOX_MARGIN_BOTTOM;
const BOX_X = BOX_MARGIN_X;
const BOX_W = LOGICAL_WIDTH - BOX_MARGIN_X * 2;
const CORNER_RADIUS = 10;

const PORTRAIT_SIZE = 40;
const PORTRAIT_PAD = 8;
const PORTRAIT_X = BOX_X + PORTRAIT_PAD;
const PORTRAIT_Y = BOX_Y + (BOX_HEIGHT - PORTRAIT_SIZE) / 2;

// Glow pulse parameters
const GLOW_MIN_ALPHA = 0.15;
const GLOW_MAX_ALPHA = 0.45;
const GLOW_CYCLE_S = 1.2; // seconds per full pulse cycle

// Fade timing
const FADE_MS = 400;

// Colors
const BG_TOP = 'rgba(255, 240, 250, 0.92)';
const BG_BOTTOM = 'rgba(245, 220, 240, 0.92)';
const BORDER_COLOR = 'rgba(200, 150, 180, 0.6)';
const GLOW_COLOR_R = 255;
const GLOW_COLOR_G = 200;
const GLOW_COLOR_B = 230;

// ---- Easing -----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- DialogueBox ------------------------------------------------------------

export default class DialogueBox {
  constructor() {
    /** Whether the box is visible (fading in / shown / fading out). */
    this._visible = false;

    /** Whether voice audio is currently playing. */
    this._voicePlaying = false;

    /** Portrait sprite image (or null for narrator sparkle). */
    this._portrait = null;

    /** Source rect for portrait on spritesheet {sx, sy, sw, sh}. */
    this._portraitSrc = null;

    // Fade state
    this._fadeAlpha = 0;   // 0 = hidden, 1 = fully visible
    this._fading = 'none'; // 'in' | 'out' | 'none'
    this._fadeTimer = 0;

    // Glow pulse timer
    this._glowTimer = 0;

    // Choice buttons (icon-based, 80px min touch target)
    /** @type {Array<{id: string, icon: HTMLImageElement|null, iconSrc: object|null, x: number, y: number, w: number, h: number}>} */
    this._choices = [];

    // Callback when a choice is tapped
    /** @type {Function|null} */
    this.onChoice = null;

    // Callback when box fade-out completes
    /** @type {Function|null} */
    this.onHidden = null;
  }

  // ---- Public API -----------------------------------------------------------

  /**
   * Show the dialogue box with an optional portrait.
   * @param {HTMLImageElement|null} portraitImage
   * @param {object|null} portraitSrc — {sx, sy, sw, sh} on spritesheet
   */
  show(portraitImage, portraitSrc) {
    this._portrait = portraitImage || null;
    this._portraitSrc = portraitSrc || null;
    this._visible = true;
    this._fading = 'in';
    this._fadeTimer = 0;
    this._choices = [];
  }

  /** Begin fade-out.  When complete, onHidden fires. */
  hide() {
    this._fading = 'out';
    this._fadeTimer = 0;
  }

  /** Immediately remove without animation. */
  hideImmediate() {
    this._visible = false;
    this._fadeAlpha = 0;
    this._fading = 'none';
    this._choices = [];
  }

  /** Set whether voice is currently playing (controls glow pulse). */
  setVoicePlaying(playing) {
    this._voicePlaying = !!playing;
  }

  /**
   * Display choice buttons (large icon buttons).
   * @param {Array<{id: string, icon: HTMLImageElement|null, iconSrc: object|null, label: string}>} choices
   */
  setChoices(choices) {
    const count = choices.length;
    const btnW = 80;
    const btnH = 80;
    const gap = 16;
    const totalW = count * btnW + (count - 1) * gap;
    const startX = ((LOGICAL_WIDTH - totalW) / 2) | 0;
    const btnY = (BOX_Y - btnH - 12) | 0;

    this._choices = choices.map((c, i) => ({
      id: c.id,
      icon: c.icon || null,
      iconSrc: c.iconSrc || null,
      label: c.label || '',
      x: (startX + i * (btnW + gap)) | 0,
      y: btnY,
      w: btnW,
      h: btnH,
    }));
  }

  /** Clear choices (after one is selected). */
  clearChoices() {
    this._choices = [];
  }

  /**
   * Test if a tap hit a choice button.  Returns choice id or null.
   * @param {number} tx — logical x
   * @param {number} ty — logical y
   * @returns {string|null}
   */
  hitTestChoice(tx, ty) {
    for (let i = 0; i < this._choices.length; i++) {
      const c = this._choices[i];
      if (tx >= c.x && tx <= c.x + c.w && ty >= c.y && ty <= c.y + c.h) {
        return c.id;
      }
    }
    return null;
  }

  /** @returns {boolean} */
  get visible() {
    return this._visible;
  }

  // ---- Update / Draw --------------------------------------------------------

  /**
   * @param {number} dt — seconds
   */
  update(dt) {
    if (!this._visible && this._fading === 'none') return;

    // Glow timer
    this._glowTimer += dt;

    // Fade
    if (this._fading === 'in') {
      this._fadeTimer += dt * 1000;
      this._fadeAlpha = Math.min(this._fadeTimer / FADE_MS, 1);
      if (this._fadeAlpha >= 1) {
        this._fadeAlpha = 1;
        this._fading = 'none';
      }
    } else if (this._fading === 'out') {
      this._fadeTimer += dt * 1000;
      this._fadeAlpha = 1 - Math.min(this._fadeTimer / FADE_MS, 1);
      if (this._fadeAlpha <= 0) {
        this._fadeAlpha = 0;
        this._fading = 'none';
        this._visible = false;
        if (this.onHidden) this.onHidden();
      }
    }
  }

  /**
   * @param {import('../engine/Renderer.js').default} renderer
   */
  draw(renderer) {
    if (!this._visible && this._fadeAlpha <= 0) return;

    const ctx = renderer.ctx;
    const alpha = easeInOutCubic(this._fadeAlpha);

    ctx.save();
    ctx.globalAlpha = alpha;

    // ---- Glow effect (behind the box) while voice plays -----------------
    if (this._voicePlaying) {
      const pulse = Math.sin(this._glowTimer * Math.PI * 2 / GLOW_CYCLE_S);
      const glowA = GLOW_MIN_ALPHA + (GLOW_MAX_ALPHA - GLOW_MIN_ALPHA) * (pulse * 0.5 + 0.5);
      ctx.save();
      ctx.globalAlpha = alpha * glowA;
      ctx.shadowColor = `rgb(${GLOW_COLOR_R}, ${GLOW_COLOR_G}, ${GLOW_COLOR_B})`;
      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgb(${GLOW_COLOR_R}, ${GLOW_COLOR_G}, ${GLOW_COLOR_B})`;
      this._roundRect(ctx, BOX_X - 4, BOX_Y - 4, BOX_W + 8, BOX_HEIGHT + 8, CORNER_RADIUS + 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = alpha; // reset after glow
    }

    // ---- Box background (gradient) --------------------------------------
    const grad = ctx.createLinearGradient(BOX_X, BOX_Y, BOX_X, BOX_Y + BOX_HEIGHT);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(1, BG_BOTTOM);

    ctx.fillStyle = grad;
    this._roundRect(ctx, BOX_X, BOX_Y, BOX_W, BOX_HEIGHT, CORNER_RADIUS);
    ctx.fill();

    // Border
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    this._roundRect(ctx, BOX_X, BOX_Y, BOX_W, BOX_HEIGHT, CORNER_RADIUS);
    ctx.stroke();

    // ---- Portrait -------------------------------------------------------
    if (this._portrait && this._portraitSrc) {
      const ps = this._portraitSrc;
      ctx.drawImage(
        this._portrait,
        ps.sx, ps.sy, ps.sw, ps.sh,
        PORTRAIT_X | 0, PORTRAIT_Y | 0, PORTRAIT_SIZE, PORTRAIT_SIZE
      );
    } else {
      // Narrator sparkle placeholder — small diamond
      const cx = (PORTRAIT_X + PORTRAIT_SIZE / 2) | 0;
      const cy = (PORTRAIT_Y + PORTRAIT_SIZE / 2) | 0;
      const s = 8;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.lineTo(cx + s, cy);
      ctx.lineTo(cx, cy + s);
      ctx.lineTo(cx - s, cy);
      ctx.closePath();
      ctx.fill();
    }

    // ---- Choice buttons -------------------------------------------------
    for (let i = 0; i < this._choices.length; i++) {
      const c = this._choices[i];
      // Button background
      ctx.fillStyle = 'rgba(255, 245, 250, 0.95)';
      this._roundRect(ctx, c.x, c.y, c.w, c.h, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 150, 180, 0.7)';
      ctx.lineWidth = 1;
      this._roundRect(ctx, c.x, c.y, c.w, c.h, 8);
      ctx.stroke();

      // Icon inside button
      if (c.icon && c.iconSrc) {
        const is = c.iconSrc;
        const iconSize = 48;
        const ix = (c.x + (c.w - iconSize) / 2) | 0;
        const iy = (c.y + (c.h - iconSize) / 2) | 0;
        ctx.drawImage(c.icon, is.sx, is.sy, is.sw, is.sh, ix, iy, iconSize, iconSize);
      }
    }

    ctx.restore();
  }

  // ---- Helpers --------------------------------------------------------------

  /**
   * Trace a rounded rectangle path (does NOT fill or stroke).
   * @param {CanvasRenderingContext2D} ctx
   */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
