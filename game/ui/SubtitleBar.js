/**
 * SubtitleBar.js — Fairy-tale styled subtitle renderer for parents
 *
 * Dreamy gradient bar at bottom of screen with storybook-style text.
 * Uses a pixel-friendly font with soft glow effects.
 * Gentle fade in/out with sparkle accents.
 *
 * All rendering is canvas-only, no DOM.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';

// ---- Layout constants (logical pixels) --------------------------------------

const BAR_MARGIN_X = 8;
const BAR_HEIGHT = 28;
const BAR_Y = LOGICAL_HEIGHT - 32;
const BAR_X = BAR_MARGIN_X;
const BAR_W = LOGICAL_WIDTH - BAR_MARGIN_X * 2;
const CORNER_RADIUS = 8;

const TEXT_PAD_X = 16;
const MAX_TEXT_W = BAR_W - TEXT_PAD_X * 2;
const FONT_SIZE = 10;
const FONT = `${FONT_SIZE}px "Segoe UI", "Arial Rounded MT Bold", "Verdana", sans-serif`;
const LINE_HEIGHT = 12;
const MAX_LINES = 2;

// Fade timing
const FADE_MS = 350;

// Colors — dreamy purple/blue gradient with soft gold text
const BG_GRADIENT_TOP = 'rgba(30, 15, 60, 0.82)';
const BG_GRADIENT_BOT = 'rgba(20, 10, 45, 0.88)';
const BORDER_COLOR = 'rgba(180, 140, 255, 0.35)';
const TEXT_COLOR = '#fff8e7';           // warm cream white
const TEXT_SHADOW_COLOR = 'rgba(200, 160, 255, 0.6)'; // soft purple glow
const SPEAKER_COLOR = '#ffcc66';        // golden for speaker names

// Sparkle accents
const SPARKLE_COLOR = 'rgba(255, 220, 130, 0.7)';
const SPARKLE_COUNT = 3;

// ---- Easing -----------------------------------------------------------------

function easeOutQuad(t) {
  return t * (2 - t);
}

// ---- SubtitleBar ------------------------------------------------------------

export default class SubtitleBar {
  constructor() {
    this._visible = false;
    this._text = '';
    this._speaker = '';     // optional speaker name prefix
    this._lines = [];

    // Fade state
    this._fadeAlpha = 0;
    this._fading = 'none';
    this._fadeTimer = 0;

    // Sparkle animation
    this._sparkleTimer = 0;

    this._dirty = false;
  }

  // ---- Public API -----------------------------------------------------------

  /**
   * Show subtitle text with optional speaker name.
   * @param {string} text
   * @param {string} [speaker] - Optional speaker name (e.g. "Grandma Rose")
   */
  show(text, speaker) {
    this._text = text || '';
    this._speaker = speaker || '';
    this._dirty = true;
    this._visible = true;
    this._fading = 'in';
    this._fadeTimer = 0;
  }

  hide() {
    this._fading = 'out';
    this._fadeTimer = 0;
  }

  /**
   * @param {number} dt — seconds
   */
  update(dt) {
    if (!this._visible && this._fading === 'none') return;

    this._sparkleTimer += dt;

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
      }
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this._visible && this._fadeAlpha <= 0) return;

    if (this._dirty) {
      this._wrapText(ctx);
      this._dirty = false;
    }

    const alpha = easeOutQuad(this._fadeAlpha);

    ctx.save();
    ctx.globalAlpha = alpha;

    // ---- Background gradient bar -------------------------------------------
    const grad = ctx.createLinearGradient(BAR_X, BAR_Y, BAR_X, BAR_Y + BAR_HEIGHT);
    grad.addColorStop(0, BG_GRADIENT_TOP);
    grad.addColorStop(1, BG_GRADIENT_BOT);
    ctx.fillStyle = grad;
    this._roundRect(ctx, BAR_X, BAR_Y | 0, BAR_W, BAR_HEIGHT, CORNER_RADIUS);
    ctx.fill();

    // ---- Subtle border glow ------------------------------------------------
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    this._roundRect(ctx, BAR_X, BAR_Y | 0, BAR_W, BAR_HEIGHT, CORNER_RADIUS);
    ctx.stroke();

    // ---- Sparkle accents on corners ----------------------------------------
    this._drawSparkles(ctx, alpha);

    // ---- Text with soft glow -----------------------------------------------
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lineCount = this._lines.length;
    const totalTextH = lineCount * LINE_HEIGHT;
    const textStartY = BAR_Y + (BAR_HEIGHT - totalTextH) / 2 + LINE_HEIGHT / 2;
    const centerX = (BAR_X + BAR_W / 2) | 0;

    for (let i = 0; i < lineCount; i++) {
      const lineY = (textStartY + i * LINE_HEIGHT) | 0;
      const lineText = this._lines[i];

      // Soft glow behind text
      ctx.fillStyle = TEXT_SHADOW_COLOR;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillText(lineText, centerX, lineY + 1);
      ctx.globalAlpha = alpha;

      // Main text
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(lineText, centerX, lineY);
    }

    ctx.restore();
  }

  // ---- Private helpers ------------------------------------------------------

  _drawSparkles(ctx, alpha) {
    const t = this._sparkleTimer;

    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const phase = (t * 1.5 + i * 2.1) % 3.0;
      const sparkleAlpha = Math.sin(phase * Math.PI / 3.0) * 0.7;
      if (sparkleAlpha <= 0.05) continue;

      ctx.globalAlpha = alpha * sparkleAlpha;
      ctx.fillStyle = SPARKLE_COLOR;

      // Position sparkles along top edge of bar
      const sx = BAR_X + 12 + (i * (BAR_W - 24) / (SPARKLE_COUNT - 1));
      const sy = BAR_Y + 2 + Math.sin(t * 2 + i) * 1.5;
      const size = 1.5 + Math.sin(t * 3 + i * 1.7) * 0.5;

      // 4-point star
      ctx.beginPath();
      ctx.moveTo(sx, sy - size);
      ctx.lineTo(sx + size * 0.4, sy);
      ctx.lineTo(sx, sy + size);
      ctx.lineTo(sx - size * 0.4, sy);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sx - size, sy);
      ctx.lineTo(sx, sy + size * 0.4);
      ctx.lineTo(sx + size, sy);
      ctx.lineTo(sx, sy - size * 0.4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
  }

  /**
   * Word-wrap _text into _lines (max MAX_LINES).
   * If speaker is set, prepend it to the first line.
   */
  _wrapText(ctx) {
    ctx.save();
    ctx.font = FONT;

    let text = this._text;
    if (!text) {
      this._lines = [];
      ctx.restore();
      return;
    }

    // Prepend speaker name if provided
    if (this._speaker) {
      text = this._speaker + ': ' + text;
    }

    if (ctx.measureText(text).width <= MAX_TEXT_W) {
      this._lines = [text];
      ctx.restore();
      return;
    }

    const words = text.split(' ');
    const lines = [];
    let current = '';

    for (let i = 0; i < words.length; i++) {
      const test = current ? current + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > MAX_TEXT_W && current) {
        lines.push(current);
        current = words[i];
        if (lines.length >= MAX_LINES) break;
      } else {
        current = test;
      }
    }

    if (current && lines.length < MAX_LINES) {
      lines.push(current);
    }

    this._lines = lines;
    ctx.restore();
  }

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
