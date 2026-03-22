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

const BOX_MARGIN_X = 12;
const BOX_MARGIN_BOTTOM = 6;
const BOX_HEIGHT = 52;              // max ~16% of 320px screen (was 72 = 22%)
const BOX_Y = LOGICAL_HEIGHT - BOX_HEIGHT - BOX_MARGIN_BOTTOM;
const BOX_X = BOX_MARGIN_X;
const BOX_W = LOGICAL_WIDTH - BOX_MARGIN_X * 2;
const CORNER_RADIUS = 8;

const PORTRAIT_SIZE = 36;           // smaller portrait to fit reduced box
const PORTRAIT_PAD = 6;
const PORTRAIT_X = BOX_X + PORTRAIT_PAD;
const PORTRAIT_Y = BOX_Y + (BOX_HEIGHT - PORTRAIT_SIZE) / 2;

// Bounce animation when voice finishes (tells child "tap to continue")
const BOUNCE_DURATION_S = 0.4;
const BOUNCE_HEIGHT = 4;

// Glow pulse parameters
const GLOW_MIN_ALPHA = 0.15;
const GLOW_MAX_ALPHA = 0.45;
const GLOW_CYCLE_S = 1.2; // seconds per full pulse cycle

// Fade timing
const FADE_MS = 400;

// Colors
const BG_TOP = 'rgba(255, 240, 250, 0.78)';
const BG_BOTTOM = 'rgba(245, 220, 240, 0.78)';
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

    // Bounce state (triggers when voice stops to invite tap-to-continue)
    this._bouncing = false;
    this._bounceTimer = 0;
    this._bounceY = 0;
    this._prevVoicePlaying = false;

    // Choice buttons (icon-based, 64x64 minimum touch target for 4yo)
    /** @type {Array<{id: string, icon: HTMLImageElement|null, iconSrc: object|null, x: number, y: number, w: number, h: number}>} */
    this._choices = [];

    // Nudge level: 0=none, 1=pulse, 2=sparkles, 3=companion hint
    this._nudgeLevel = 0;
    this._nudgeTimer = 0;

    // Pre-allocated sparkle particle state (3 particles per button, max 4 buttons = 12)
    this._sparkles = new Array(12);
    for (let i = 0; i < 12; i++) {
      this._sparkles[i] = { phase: i * 0.83, radius: 6 + (i % 3) * 4, size: 2 + (i % 3) };
    }

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
    this._nudgeLevel = 0;
    this._nudgeTimer = 0;
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
    const btnW = 80;    // touch target size (generous for small fingers)
    const btnH = 80;
    const gap = 16;
    const totalW = count * btnW + (count - 1) * gap;
    const startX = ((LOGICAL_WIDTH - totalW) / 2) | 0;
    const btnY = (BOX_Y - btnH - 12) | 0;

    this._choices = choices.map((c, i) => ({
      id: c.id,
      icon: c.icon || null,
      iconSrc: c.iconSrc || null,
      x: (startX + i * (btnW + gap)) | 0,
      y: btnY,
      w: btnW,
      h: btnH,
    }));
  }

  /** Clear choices (after one is selected). */
  clearChoices() {
    this._choices = [];
    this._nudgeLevel = 0;
  }

  /**
   * Set the visual nudge escalation level.
   * @param {number} level — 0=none, 1=pulse, 2=sparkles, 3=companion hint
   */
  setNudgeLevel(level) {
    this._nudgeLevel = level;
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

    // Nudge animation timer
    if (this._nudgeLevel > 0) {
      this._nudgeTimer += dt;
    }

    // Detect voice-stop transition: trigger bounce to say "tap to continue"
    if (this._prevVoicePlaying && !this._voicePlaying) {
      this._bouncing = true;
      this._bounceTimer = 0;
    }
    this._prevVoicePlaying = this._voicePlaying;

    // Bounce animation
    if (this._bouncing) {
      this._bounceTimer += dt;
      if (this._bounceTimer < BOUNCE_DURATION_S) {
        const t = this._bounceTimer / BOUNCE_DURATION_S;
        this._bounceY = -Math.abs(Math.sin(t * Math.PI)) * BOUNCE_HEIGHT;
      } else {
        this._bouncing = false;
        this._bounceY = 0;
      }
    }

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

    // Apply bounce offset to the entire box
    const boxOffsetY = this._bounceY | 0;

    // ---- Pulsing wave/glow while voice plays (shows "someone is talking") --
    if (this._voicePlaying) {
      const pulse = Math.sin(this._glowTimer * Math.PI * 2 / GLOW_CYCLE_S);
      const glowA = GLOW_MIN_ALPHA + (GLOW_MAX_ALPHA - GLOW_MIN_ALPHA) * (pulse * 0.5 + 0.5);
      ctx.save();
      ctx.globalAlpha = alpha * glowA;
      ctx.shadowColor = `rgb(${GLOW_COLOR_R}, ${GLOW_COLOR_G}, ${GLOW_COLOR_B})`;
      ctx.shadowBlur = 14;
      ctx.fillStyle = `rgb(${GLOW_COLOR_R}, ${GLOW_COLOR_G}, ${GLOW_COLOR_B})`;
      this._roundRect(ctx, BOX_X - 4, BOX_Y - 4 + boxOffsetY, BOX_W + 8, BOX_HEIGHT + 8, CORNER_RADIUS + 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = alpha;

      // Animated wave bar inside box (visual indicator voice is active)
      ctx.save();
      ctx.globalAlpha = alpha * 0.3;
      const waveBarW = BOX_W - PORTRAIT_SIZE - PORTRAIT_PAD * 3;
      const waveBarX = PORTRAIT_X + PORTRAIT_SIZE + PORTRAIT_PAD;
      const waveBarY = BOX_Y + BOX_HEIGHT / 2 + boxOffsetY;
      ctx.fillStyle = `rgb(${GLOW_COLOR_R}, ${GLOW_COLOR_G}, ${GLOW_COLOR_B})`;
      for (let wi = 0; wi < 8; wi++) {
        const wh = 4 + Math.sin(this._glowTimer * 6 + wi * 0.8) * 6;
        const wx = (waveBarX + wi * (waveBarW / 8)) | 0;
        ctx.fillRect(wx, (waveBarY - wh / 2) | 0, (waveBarW / 10) | 0, wh | 0);
      }
      ctx.restore();
      ctx.globalAlpha = alpha;
    }

    // ---- Box background (gradient) with bounce offset -------------------
    const grad = ctx.createLinearGradient(BOX_X, BOX_Y + boxOffsetY, BOX_X, BOX_Y + BOX_HEIGHT + boxOffsetY);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(1, BG_BOTTOM);

    ctx.fillStyle = grad;
    this._roundRect(ctx, BOX_X, BOX_Y + boxOffsetY, BOX_W, BOX_HEIGHT, CORNER_RADIUS);
    ctx.fill();

    // Border
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    this._roundRect(ctx, BOX_X, BOX_Y + boxOffsetY, BOX_W, BOX_HEIGHT, CORNER_RADIUS);
    ctx.stroke();

    // ---- Portrait (48x48 prominent speaker face) ------------------------
    const portraitDrawY = (PORTRAIT_Y + boxOffsetY) | 0;
    if (this._portrait && this._portraitSrc) {
      const ps = this._portraitSrc;
      ctx.drawImage(
        this._portrait,
        ps.sx, ps.sy, ps.sw, ps.sh,
        PORTRAIT_X | 0, portraitDrawY, PORTRAIT_SIZE, PORTRAIT_SIZE
      );
    } else {
      // Narrator sparkle placeholder — golden diamond
      const pcx = (PORTRAIT_X + PORTRAIT_SIZE / 2) | 0;
      const pcy = (portraitDrawY + PORTRAIT_SIZE / 2) | 0;
      const s = 10;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.moveTo(pcx, pcy - s);
      ctx.lineTo(pcx + s, pcy);
      ctx.lineTo(pcx, pcy + s);
      ctx.lineTo(pcx - s, pcy);
      ctx.closePath();
      ctx.fill();
      // Inner glow
      ctx.fillStyle = '#fffacd';
      ctx.beginPath();
      ctx.arc(pcx, pcy, (s * 0.4) | 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Choice buttons (LARGE 64x64 icons, no text) --------------------
    for (let i = 0; i < this._choices.length; i++) {
      const c = this._choices[i];
      const pulse = Math.sin(this._glowTimer * 2.5 + i * 1.3) * 0.5 + 0.5;
      const cx = (c.x + c.w / 2) | 0;
      const cy = (c.y + c.h / 2) | 0;

      // Animated glow behind choice (shows it is tappable)
      ctx.save();
      ctx.globalAlpha = alpha * (0.15 + pulse * 0.15);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(cx, cy, (c.w * 0.6) | 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = alpha;

      // Nudge pulse: scale button with gentle breathing effect
      if (this._nudgeLevel >= 1) {
        const nudgeScale = 1.0 + 0.08 * Math.sin(this._nudgeTimer * 4);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(nudgeScale, nudgeScale);
        ctx.translate(-cx, -cy);
      }

      // Button background
      ctx.fillStyle = 'rgba(255, 245, 250, 0.95)';
      this._roundRect(ctx, c.x, c.y, c.w, c.h, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 150, 180, 0.7)';
      ctx.lineWidth = 2;
      this._roundRect(ctx, c.x, c.y, c.w, c.h, 10);
      ctx.stroke();

      // Icon inside button (64x64 rendered size)
      if (c.icon && c.iconSrc) {
        const is = c.iconSrc;
        const iconSize = 64;
        const ix = (c.x + (c.w - iconSize) / 2) | 0;
        const iy = (c.y + (c.h - iconSize) / 2) | 0;
        ctx.drawImage(c.icon, is.sx, is.sy, is.sw, is.sh, ix, iy, iconSize, iconSize);
      }

      // Restore nudge pulse transform
      if (this._nudgeLevel >= 1) {
        ctx.restore();
      }

      // Nudge sparkles: draw 3 small sparkle particles orbiting each button
      if (this._nudgeLevel >= 2) {
        ctx.save();
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = '#ffd700';
        for (let si = 0; si < 3; si++) {
          const sp = this._sparkles[i * 3 + si];
          const angle = this._nudgeTimer * 2.2 + sp.phase;
          const sx = (cx + Math.cos(angle) * sp.radius * (c.w / 80)) | 0;
          const sy = (cy + Math.sin(angle) * sp.radius * (c.h / 80)) | 0;
          const sparkSize = sp.size;
          // 4-point star sparkle
          ctx.beginPath();
          ctx.moveTo(sx, sy - sparkSize);
          ctx.lineTo(sx + 1, sy);
          ctx.lineTo(sx, sy + sparkSize);
          ctx.lineTo(sx - 1, sy);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(sx - sparkSize, sy);
          ctx.lineTo(sx, sy + 1);
          ctx.lineTo(sx + sparkSize, sy);
          ctx.lineTo(sx, sy - 1);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = alpha;
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
