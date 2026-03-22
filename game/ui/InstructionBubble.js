/**
 * InstructionBubble.js — Screen-space tutorial instruction bubble
 *
 * Shows procedural icons (star, eye, tap, heart, walk, arrow) in a
 * semi-transparent rounded bubble at the top-center of screen.
 * Guides a 4.5-year-old through her first RPG experience.
 *
 * Fade in/out 400ms with easeInOutCubic. Gentle 2px bob, 2s cycle.
 * No DOM — canvas only. Single instance, reused.
 */

import { LOGICAL_WIDTH } from '../engine/Renderer.js';

// ---- Constants --------------------------------------------------------------

const BUBBLE_W = 120;
const BUBBLE_H = 40;
const BUBBLE_Y = 16;
const BUBBLE_RADIUS = 8;

const FADE_DURATION = 0.4;             // seconds
const BOB_AMPLITUDE = 2;               // pixels
const BOB_CYCLE_S = 2.0;               // seconds

const ICON_SIZE = 24;                  // approximate icon bounding box

const BG_COLOR = 'rgba(255,255,255,0.85)';
const BORDER_COLOR = 'rgba(200,180,220,0.6)';

const TWO_PI = Math.PI * 2;

// ---- Easing -----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- InstructionBubble ------------------------------------------------------

export default class InstructionBubble {
  constructor() {
    /** @type {string|null} */
    this._iconType = null;

    // Fade state: 0 = hidden, 1 = fully visible
    this._alpha = 0;
    this._targetAlpha = 0;           // 0 or 1
    this._fadeTimer = 0;
    this._fadeFrom = 0;

    // Bob timer (continuous)
    this._bobTimer = 0;

    // Tap ripple timer (continuous, used only for 'tap' icon)
    this._rippleTimer = 0;

    // Pre-computed bubble X (centered horizontally)
    this._bubbleX = ((LOGICAL_WIDTH - BUBBLE_W) / 2) | 0;
  }

  // ---- Public API -----------------------------------------------------------

  /**
   * Show the bubble with a specific icon.
   * @param {'star'|'eye'|'tap'|'heart'|'walk'|'arrow'} iconType
   */
  show(iconType) {
    this._iconType = iconType;
    if (this._targetAlpha === 1) return; // already showing
    this._targetAlpha = 1;
    this._fadeFrom = this._alpha;
    this._fadeTimer = 0;
  }

  /** Hide the bubble with a fade-out. */
  hide() {
    if (this._targetAlpha === 0) return;
    this._targetAlpha = 0;
    this._fadeFrom = this._alpha;
    this._fadeTimer = 0;
  }

  /**
   * Update animations.
   * @param {number} dt — seconds
   */
  update(dt) {
    // Fade
    if (this._alpha !== this._targetAlpha) {
      this._fadeTimer += dt;
      const t = this._fadeTimer / FADE_DURATION;
      if (t >= 1) {
        this._alpha = this._targetAlpha;
      } else {
        const eased = easeInOutCubic(t);
        if (this._targetAlpha > this._fadeFrom) {
          this._alpha = this._fadeFrom + (this._targetAlpha - this._fadeFrom) * eased;
        } else {
          this._alpha = this._fadeFrom - (this._fadeFrom - this._targetAlpha) * eased;
        }
      }
    }

    // Bob (always ticks so phase is continuous)
    this._bobTimer += dt;

    // Ripple timer for tap icon
    this._rippleTimer += dt;
  }

  /**
   * Draw to screen space (no camera offset).
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (this._alpha <= 0.001) return;

    const bobY = (Math.sin(this._bobTimer * TWO_PI / BOB_CYCLE_S) * BOB_AMPLITUDE) | 0;
    const bx = this._bubbleX;
    const by = (BUBBLE_Y + bobY) | 0;

    ctx.save();
    ctx.globalAlpha = this._alpha;

    // ---- Bubble background --------------------------------------------------
    this._roundRect(ctx, bx, by, BUBBLE_W, BUBBLE_H, BUBBLE_RADIUS);
    ctx.fillStyle = BG_COLOR;
    ctx.fill();
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ---- Icon (centered in bubble) ------------------------------------------
    const cx = (bx + BUBBLE_W / 2) | 0;
    const cy = (by + BUBBLE_H / 2) | 0;

    switch (this._iconType) {
      case 'star':  this._drawStar(ctx, cx, cy);  break;
      case 'eye':   this._drawEye(ctx, cx, cy);   break;
      case 'tap':   this._drawTap(ctx, cx, cy);   break;
      case 'heart': this._drawHeart(ctx, cx, cy); break;
      case 'walk':  this._drawWalk(ctx, cx, cy);  break;
      case 'arrow': this._drawArrow(ctx, cx, cy); break;
    }

    ctx.restore();
  }

  // ---- Bubble shape ---------------------------------------------------------

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} r
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

  // ---- Icon drawing ---------------------------------------------------------

  /**
   * 4-point star — matches QuestIndicator._starPath style, golden.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   */
  _drawStar(ctx, cx, cy) {
    const outerR = (ICON_SIZE / 2) | 0;
    const innerR = (outerR * 0.4) | 0;
    const points = 4;
    const step = Math.PI / points;
    let angle = -Math.PI / 2;

    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(
      (cx + Math.cos(angle) * outerR) | 0,
      (cy + Math.sin(angle) * outerR) | 0
    );
    for (let i = 0; i < points * 2; i++) {
      angle += step;
      const r = (i % 2 === 0) ? innerR : outerR;
      ctx.lineTo(
        (cx + Math.cos(angle) * r) | 0,
        (cy + Math.sin(angle) * r) | 0
      );
    }
    ctx.closePath();
    ctx.fill();

    // Bright center dot
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.arc(cx, cy, (outerR * 0.25) | 0 || 1, 0, TWO_PI);
    ctx.fill();
  }

  /**
   * Simple eye: oval outline + filled circle pupil, soft blue.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   */
  _drawEye(ctx, cx, cy) {
    const hw = (ICON_SIZE / 2) | 0;   // half width of eye
    const hh = (ICON_SIZE / 3) | 0;   // half height of eye

    // Eye outline (almond shape via ellipse)
    ctx.strokeStyle = '#88bbff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, hw, hh, 0, 0, TWO_PI);
    ctx.stroke();

    // Iris
    ctx.fillStyle = '#88bbff';
    ctx.beginPath();
    ctx.arc(cx, cy, (hh * 0.7) | 0 || 2, 0, TWO_PI);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#335577';
    ctx.beginPath();
    ctx.arc(cx, cy, (hh * 0.35) | 0 || 1, 0, TWO_PI);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((cx - 1) | 0, (cy - 1) | 0, 1, 0, TWO_PI);
    ctx.fill();
  }

  /**
   * Tap icon: finger pad circle with pulsing ripple rings, pink.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   */
  _drawTap(ctx, cx, cy) {
    const r = (ICON_SIZE / 4) | 0;    // finger pad radius

    // Pulsing ripple rings (two rings, offset phase)
    for (let i = 0; i < 2; i++) {
      const phase = ((this._rippleTimer + i * 0.5) % 1.0);
      const rippleR = (r + phase * r * 1.5) | 0;
      const rippleAlpha = 1.0 - phase;
      ctx.strokeStyle = 'rgba(255,136,170,' + (rippleAlpha * 0.6).toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, rippleR, 0, TWO_PI);
      ctx.stroke();
    }

    // Finger pad
    ctx.fillStyle = '#ff88aa';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc((cx - 1) | 0, (cy - 1) | 0, (r * 0.4) | 0 || 1, 0, TWO_PI);
    ctx.fill();
  }

  /**
   * Classic heart shape, pink-red.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   */
  _drawHeart(ctx, cx, cy) {
    const s = ICON_SIZE * 0.45;        // scale factor

    ctx.fillStyle = '#ff6b8a';
    ctx.beginPath();
    // Heart drawn with two bezier curves
    ctx.moveTo(cx, (cy + s * 0.6) | 0);
    // Left side
    ctx.bezierCurveTo(
      (cx - s * 1.0) | 0, (cy - s * 0.2) | 0,
      (cx - s * 0.6) | 0, (cy - s * 0.9) | 0,
      cx,                  (cy - s * 0.4) | 0
    );
    // Right side
    ctx.bezierCurveTo(
      (cx + s * 0.6) | 0, (cy - s * 0.9) | 0,
      (cx + s * 1.0) | 0, (cy - s * 0.2) | 0,
      cx,                  (cy + s * 0.6) | 0
    );
    ctx.closePath();
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc((cx - s * 0.25) | 0, (cy - s * 0.35) | 0, (s * 0.2) | 0 || 1, 0, TWO_PI);
    ctx.fill();
  }

  /**
   * Walking footprints — two dots in a stepping pattern, golden.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   */
  _drawWalk(ctx, cx, cy) {
    const dotR = 3;
    const gapX = 5;
    const gapY = 4;

    ctx.fillStyle = '#ffd700';

    // Left foot (back)
    ctx.beginPath();
    ctx.ellipse((cx - gapX) | 0, (cy + gapY) | 0, dotR, (dotR * 1.4) | 0, -0.2, 0, TWO_PI);
    ctx.fill();

    // Right foot (front)
    ctx.beginPath();
    ctx.ellipse((cx + gapX) | 0, (cy - gapY) | 0, dotR, (dotR * 1.4) | 0, 0.2, 0, TWO_PI);
    ctx.fill();

    // Toe dots
    ctx.fillStyle = '#fff0b0';
    ctx.beginPath();
    ctx.arc((cx - gapX) | 0, (cy + gapY - 4) | 0, 1, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((cx + gapX) | 0, (cy - gapY - 4) | 0, 1, 0, TWO_PI);
    ctx.fill();
  }

  /**
   * Large right-pointing arrow, golden.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   */
  _drawArrow(ctx, cx, cy) {
    const hw = (ICON_SIZE / 2) | 0;    // half width
    const hh = (ICON_SIZE / 2) | 0;    // half height
    const shaft = (hh * 0.35) | 0;     // shaft half-height
    const headStart = (hw * 0.2) | 0;  // where arrowhead begins

    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    // Shaft (left portion)
    ctx.moveTo((cx - hw) | 0, (cy - shaft) | 0);
    ctx.lineTo((cx + headStart) | 0, (cy - shaft) | 0);
    // Arrowhead top edge
    ctx.lineTo((cx + headStart) | 0, (cy - hh) | 0);
    // Arrow tip
    ctx.lineTo((cx + hw) | 0, cy);
    // Arrowhead bottom edge
    ctx.lineTo((cx + headStart) | 0, (cy + hh) | 0);
    ctx.lineTo((cx + headStart) | 0, (cy + shaft) | 0);
    // Shaft bottom
    ctx.lineTo((cx - hw) | 0, (cy + shaft) | 0);
    ctx.closePath();
    ctx.fill();

    // Bright edge highlight along top of shaft
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect((cx - hw) | 0, (cy - shaft) | 0, (hw + headStart) | 0, 1);
  }
}
