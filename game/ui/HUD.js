/**
 * HUD.js — Minimal heads-up display for Princess Sparkle V2
 *
 * Top-left: Companion portrait (24x24)
 * Top-left below portrait: Heart counter (visual hearts, not numbers)
 * Top-right: Flower growth meter (level progress)
 *
 * All elements are small and unobtrusive.
 * Fades in after first quest — not shown during cinematics.
 * No DOM — canvas only.
 */

import { LOGICAL_WIDTH } from '../engine/Renderer.js';

// ---- Layout -----------------------------------------------------------------

const PAD = 6;
const PORTRAIT_SIZE = 24;
const PORTRAIT_X = PAD;
const PORTRAIT_Y = PAD;

const HEART_SIZE = 10;    // each heart sprite size
const HEART_GAP = 2;
const HEART_Y = PORTRAIT_Y + PORTRAIT_SIZE + 4;
const HEART_X = PAD;
const MAX_DISPLAY_HEARTS = 20; // max hearts shown before compact display

// Flower meter (top-right)
const FLOWER_SIZE = 20;
const FLOWER_X = LOGICAL_WIDTH - FLOWER_SIZE - PAD;
const FLOWER_Y = PAD;
const METER_W = 4;
const METER_H = 48;
const METER_X = FLOWER_X + (FLOWER_SIZE - METER_W) / 2;
const METER_Y = FLOWER_Y + FLOWER_SIZE + 4;

// Fade timing
const FADE_DURATION_MS = 600;

// Heart color
const HEART_COLOR = '#ff6b8a';
const HEART_SHADOW = '#d94f6b';

// Flower growth stages — colors get richer as level increases
const FLOWER_STAGES = [
  { color: '#8B4513', label: 'seed' },    // seed (brown)
  { color: '#228B22', label: 'sprout' },   // sprout (green)
  { color: '#90EE90', label: 'bud' },      // bud (light green)
  { color: '#FF69B4', label: 'bloom' },    // bloom (pink)
  { color: '#FFD700', label: 'garden' },   // full garden (gold)
];

// ---- HUD --------------------------------------------------------------------

export default class HUD {
  constructor() {
    /** Total hearts the player has collected. */
    this.hearts = 0;

    /** Player level (0-based, maps to flower stages). */
    this.level = 0;

    /** Progress within current level (0..1). */
    this.levelProgress = 0;

    /** Companion portrait sprite sheet. */
    this._portraitImage = null;
    /** Portrait source rect {sx, sy, sw, sh}. */
    this._portraitSrc = null;

    // Visibility
    this._shown = false;
    this._fadeAlpha = 0;
    this._fadingIn = false;
    this._fadeTimer = 0;

    // Pre-allocated array for heart positions (avoids GC in draw loop)
    /** @type {Array<{x: number, y: number}>} */
    this._heartPositions = new Array(MAX_DISPLAY_HEARTS);
    for (let i = 0; i < MAX_DISPLAY_HEARTS; i++) {
      this._heartPositions[i] = { x: 0, y: 0 };
    }
    this._recalcHeartPositions();
  }

  // ---- Public API -----------------------------------------------------------

  /**
   * Set the companion portrait to display.
   * @param {HTMLImageElement} image
   * @param {{sx: number, sy: number, sw: number, sh: number}} src
   */
  setPortrait(image, src) {
    this._portraitImage = image;
    this._portraitSrc = src;
  }

  /** Fade in the HUD (called after first quest). */
  show() {
    if (this._shown) return;
    this._shown = true;
    this._fadingIn = true;
    this._fadeTimer = 0;
  }

  /** Immediately hide (for cinematics). */
  hide() {
    this._shown = false;
    this._fadeAlpha = 0;
    this._fadingIn = false;
  }

  /**
   * Add hearts (quest reward).
   * @param {number} count
   */
  addHearts(count) {
    this.hearts += count;
    this._recalcHeartPositions();
  }

  /**
   * Set level and progress.
   * @param {number} level
   * @param {number} progress — 0..1
   */
  setLevel(level, progress) {
    this.level = Math.min(level, FLOWER_STAGES.length - 1);
    this.levelProgress = Math.max(0, Math.min(progress, 1));
  }

  // ---- Update / Draw --------------------------------------------------------

  /** @param {number} dt — seconds */
  update(dt) {
    if (this._fadingIn) {
      this._fadeTimer += dt * 1000;
      this._fadeAlpha = Math.min(this._fadeTimer / FADE_DURATION_MS, 1);
      if (this._fadeAlpha >= 1) {
        this._fadeAlpha = 1;
        this._fadingIn = false;
      }
    }
  }

  /**
   * @param {import('../engine/Renderer.js').default} renderer
   */
  draw(renderer) {
    if (this._fadeAlpha <= 0) return;

    const ctx = renderer.ctx;
    ctx.save();
    ctx.globalAlpha = this._fadeAlpha;

    // ---- Companion portrait (top-left) ----------------------------------
    if (this._portraitImage && this._portraitSrc) {
      const ps = this._portraitSrc;
      ctx.drawImage(
        this._portraitImage,
        ps.sx, ps.sy, ps.sw, ps.sh,
        PORTRAIT_X | 0, PORTRAIT_Y | 0, PORTRAIT_SIZE, PORTRAIT_SIZE
      );
    } else {
      // Placeholder square
      ctx.fillStyle = 'rgba(255,200,220,0.6)';
      ctx.fillRect(PORTRAIT_X | 0, PORTRAIT_Y | 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
    }

    // ---- Hearts (below portrait) ----------------------------------------
    const displayCount = Math.min(this.hearts, MAX_DISPLAY_HEARTS);
    for (let i = 0; i < displayCount; i++) {
      const pos = this._heartPositions[i];
      this._drawHeart(ctx, pos.x, pos.y, HEART_SIZE);
    }

    // ---- Flower growth meter (top-right) --------------------------------
    const stage = FLOWER_STAGES[this.level] || FLOWER_STAGES[0];

    // Stem / meter background
    ctx.fillStyle = 'rgba(100, 80, 60, 0.3)';
    ctx.fillRect(METER_X | 0, METER_Y | 0, METER_W, METER_H);

    // Fill from bottom
    const fillH = (METER_H * this.levelProgress) | 0;
    ctx.fillStyle = stage.color;
    ctx.fillRect(METER_X | 0, (METER_Y + METER_H - fillH) | 0, METER_W, fillH);

    // Flower head at top
    this._drawFlower(ctx, FLOWER_X, FLOWER_Y, FLOWER_SIZE, stage.color);

    ctx.restore();
  }

  // ---- Private helpers ------------------------------------------------------

  _recalcHeartPositions() {
    const perRow = 5;
    for (let i = 0; i < MAX_DISPLAY_HEARTS; i++) {
      const col = i % perRow;
      const row = (i / perRow) | 0;
      this._heartPositions[i].x = HEART_X + col * (HEART_SIZE + HEART_GAP);
      this._heartPositions[i].y = HEART_Y + row * (HEART_SIZE + HEART_GAP);
    }
  }

  /**
   * Draw a simple pixel heart shape.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} size
   */
  _drawHeart(ctx, x, y, size) {
    const s = size;
    const cx = (x + s / 2) | 0;
    const cy = (y + s / 2) | 0;
    const r = s / 4;

    ctx.fillStyle = HEART_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 1.2);
    ctx.bezierCurveTo(cx + r * 2.2, cy - r * 0.5, cx + r * 1.2, cy - r * 2, cx, cy - r * 0.6);
    ctx.bezierCurveTo(cx - r * 1.2, cy - r * 2, cx - r * 2.2, cy - r * 0.5, cx, cy + r * 1.2);
    ctx.fill();
  }

  /**
   * Draw a simple flower icon.
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawFlower(ctx, x, y, size, color) {
    const cx = (x + size / 2) | 0;
    const cy = (y + size / 2) | 0;
    const petalR = (size / 4) | 0;

    // Petals (4 around center)
    ctx.fillStyle = color;
    const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let i = 0; i < offsets.length; i++) {
      const ox = offsets[i][0] * petalR;
      const oy = offsets[i][1] * petalR;
      ctx.beginPath();
      ctx.arc((cx + ox) | 0, (cy + oy) | 0, petalR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(cx, cy, (petalR * 0.6) | 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
