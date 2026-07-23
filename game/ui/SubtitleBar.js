/**
 * SubtitleBar.js — Fairy-tale styled subtitle renderer for parents
 *
 * Dreamy gradient bar at bottom of screen with storybook-style text.
 * Uses a pixel-friendly font with soft glow effects.
 * Gentle fade in/out with sparkle accents.
 *
 * Karaoke word highlighting:
 *   Call showWithTiming(text, speaker, duration) to enable word-by-word
 *   golden highlighting synced to voice playback duration. Words advance
 *   evenly across the total duration. The active word glows golden (#ffcc66)
 *   at 1.15x scale. Call advanceVoice(elapsed) each frame with the current
 *   playback position in seconds.
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
const TEXT_COLOR_DONE = '#fffdf5';      // slightly brighter for completed words
const TEXT_ACTIVE_COLOR = '#ffcc66';    // golden for active (karaoke) word
const TEXT_SHADOW_COLOR = 'rgba(200, 160, 255, 0.6)'; // soft purple glow
const SPEAKER_COLOR = '#ffcc66';        // golden for speaker names

// Karaoke word transition
const KARAOKE_TRANSITION_MS = 200; // ease duration between word highlights

// Sparkle accents
const SPARKLE_COLOR = 'rgba(255, 220, 130, 0.7)';
const SPARKLE_COUNT = 3;

// ---- Easing -----------------------------------------------------------------

function easeOutQuad(t) {
  return t * (2 - t);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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

    // Karaoke state
    this._karaokeEnabled = false;
    this._karaokeDuration = 0;  // total voice duration in seconds
    this._karaokeElapsed = 0;   // current playback position in seconds
    this._karaokeWords = [];    // flat word array for the full text
    this._karaokeWordIndex = -1;         // currently active word index
    this._karaokePrevWordIndex = -1;
    this._karaokeTransitionTimer = 0;    // ms into transition animation
    // Per-line word layout: array of lines, each line is array of {word, x, width}
    this._karaokeLayout = [];
    this._layoutValid = false;
  }

  // ---- Public API -----------------------------------------------------------

  /**
   * Show subtitle text with optional speaker name.
   * Karaoke word highlighting is disabled.
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

    // Disable karaoke for plain show()
    this._karaokeEnabled = false;
    this._karaokeWordIndex = -1;
    this._layoutValid = false;
  }

  /**
   * Show subtitle with karaoke word-by-word highlighting synced to voice.
   * Words advance evenly across the voice duration.
   * @param {string} text
   * @param {string} speaker
   * @param {number} duration  Voice line duration in seconds
   */
  showWithTiming(text, speaker, duration) {
    this.show(text, speaker);
    this._karaokeEnabled = true;
    this._karaokeDuration = duration || 0;
    this._karaokeElapsed = 0;
    this._karaokeWordIndex = 0;
    this._karaokePrevWordIndex = -1;
    this._karaokeTransitionTimer = 0;

    // Build flat word list (strip speaker prefix — it renders separately)
    this._karaokeWords = (text || '').split(' ').filter(w => w.length > 0);
    this._layoutValid = false;
  }

  /**
   * Advance the karaoke playback position.
   * Call each frame with the current voice elapsed time in seconds.
   * @param {number} elapsed  Seconds since voice line started
   */
  advanceVoice(elapsed) {
    if (!this._karaokeEnabled || !this._karaokeWords.length) return;

    this._karaokeElapsed = elapsed;

    const wordCount = this._karaokeWords.length;
    if (wordCount === 0 || this._karaokeDuration <= 0) return;

    const newIndex = Math.min(
      Math.floor(elapsed / (this._karaokeDuration / wordCount)),
      wordCount - 1
    );

    if (newIndex !== this._karaokeWordIndex) {
      this._karaokePrevWordIndex = this._karaokeWordIndex;
      this._karaokeWordIndex = newIndex;
      this._karaokeTransitionTimer = 0;
    }
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
        this._karaokeEnabled = false;
      }
    }

    // Advance karaoke transition timer
    if (this._karaokeEnabled && this._karaokeTransitionTimer < KARAOKE_TRANSITION_MS) {
      this._karaokeTransitionTimer += dt * 1000;
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
      this._layoutValid = false;
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

    if (this._karaokeEnabled && this._karaokeWords.length > 0) {
      // Build word layout if needed
      if (!this._layoutValid) {
        this._buildKaraokeLayout(ctx, centerX, textStartY);
        this._layoutValid = true;
      }
      this._drawKaraokeText(ctx, alpha);
    } else {
      // Plain subtitle rendering
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
    }

    ctx.restore();
  }

  // ---- Karaoke helpers ------------------------------------------------------

  /**
   * Build the per-word layout for karaoke rendering.
   * Assigns each word a screen X position on its line.
   */
  _buildKaraokeLayout(ctx, centerX, textStartY) {
    ctx.save();
    ctx.font = FONT;

    this._karaokeLayout = [];

    // We need to know which words map to which lines.
    // _lines already contains the wrapped lines (with speaker prefix on line 0).
    // We walk the lines and split each into words, matching against _karaokeWords.

    // Re-derive lines without speaker prefix for word mapping
    let textOnly = this._text || '';
    const allWords = textOnly.split(' ').filter(w => w.length > 0);

    // Build same word-wrapped lines but tracking word indices
    const lineWords = []; // array of arrays of {word, globalIdx}
    let current = [];
    let lineText = '';
    let globalIdx = 0;

    // Account for speaker prefix on line 0
    let speakerPrefix = '';
    if (this._speaker) {
      speakerPrefix = this._speaker + ': ';
    }

    for (let i = 0; i < allWords.length; i++) {
      const w = allWords[i];
      const testText = (lineText ? lineText + ' ' + w : (speakerPrefix + w));
      const testMeasure = lineText ? lineText + ' ' + w : (speakerPrefix + w);

      if (ctx.measureText(testMeasure).width > MAX_TEXT_W && lineText) {
        lineWords.push(current);
        current = [{ word: w, globalIdx: globalIdx++ }];
        lineText = w;
        speakerPrefix = ''; // only first line has speaker prefix
      } else {
        current.push({ word: w, globalIdx: globalIdx++ });
        lineText = testMeasure;
        speakerPrefix = ''; // consumed
      }

      if (lineWords.length >= MAX_LINES - 1 && i < allWords.length - 1) {
        // Force remaining words onto last slot
        for (let j = i + 1; j < allWords.length; j++) {
          current.push({ word: allWords[j], globalIdx: globalIdx++ });
        }
        break;
      }
    }
    if (current.length) lineWords.push(current);

    // For each line, compute per-word x positions by measuring substrings
    for (let li = 0; li < lineWords.length; li++) {
      const lineY = (textStartY + li * LINE_HEIGHT) | 0;
      const words = lineWords[li];

      // Build the full line string (with speaker on line 0)
      let prefix = (li === 0 && this._speaker) ? this._speaker + ': ' : '';
      const fullLine = prefix + words.map(e => e.word).join(' ');
      const lineW = ctx.measureText(fullLine).width;
      const lineStartX = centerX - lineW / 2;

      // Measure prefix
      let cursorX = lineStartX;
      if (prefix) {
        cursorX += ctx.measureText(prefix).width;
      }

      const wordEntries = [];
      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi].word;
        const ww = ctx.measureText(w).width;
        wordEntries.push({
          word: w,
          globalIdx: words[wi].globalIdx,
          x: cursorX + ww / 2,  // center of word
          width: ww,
          y: lineY,
          prefix: wi === 0 ? prefix : ''
        });
        cursorX += ww;
        if (wi < words.length - 1) cursorX += ctx.measureText(' ').width;
      }

      this._karaokeLayout.push({
        lineY,
        fullLine,
        prefix,
        wordEntries,
        lineStartX,
      });
    }

    ctx.restore();
  }

  /**
   * Draw subtitle text with karaoke word highlighting.
   */
  _drawKaraokeText(ctx, alpha) {
    const transitionT = Math.min(this._karaokeTransitionTimer / KARAOKE_TRANSITION_MS, 1.0);
    const easedT = easeInOut(transitionT);

    for (let li = 0; li < this._karaokeLayout.length; li++) {
      const layout = this._karaokeLayout[li];

      // Draw speaker prefix on line 0 in gold
      if (li === 0 && this._speaker) {
        ctx.save();
        ctx.font = FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = TEXT_SHADOW_COLOR;
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillText(this._speaker + ': ', layout.lineStartX, layout.lineY + 1);
        ctx.fillStyle = SPEAKER_COLOR;
        ctx.globalAlpha = alpha;
        ctx.fillText(this._speaker + ': ', layout.lineStartX, layout.lineY);
        ctx.restore();
      }

      // Draw each word
      for (let wi = 0; wi < layout.wordEntries.length; wi++) {
        const entry = layout.wordEntries[wi];
        const gi = entry.globalIdx;

        const isActive = gi === this._karaokeWordIndex;
        const wasPrev = gi === this._karaokePrevWordIndex;
        const isDone = gi < this._karaokeWordIndex;

        let wordColor;
        let wordScale = 1.0;

        if (isActive) {
          wordColor = TEXT_ACTIVE_COLOR;
          wordScale = 1.0 + 0.15 * easedT;  // grow from 1.0 to 1.15
        } else if (wasPrev) {
          // Fade from active golden back to done color
          wordColor = TEXT_ACTIVE_COLOR;
          wordScale = 1.0 + 0.15 * (1.0 - easedT);
        } else if (isDone) {
          wordColor = TEXT_COLOR_DONE;
          wordScale = 1.0;
        } else {
          wordColor = TEXT_COLOR;
          wordScale = 1.0;
        }

        ctx.save();
        ctx.font = FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Glow for active/prev word
        if (isActive || wasPrev) {
          const glowAlpha = isActive ? easedT : (1.0 - easedT);
          ctx.fillStyle = `rgba(255, 200, 80, ${glowAlpha * 0.4 * alpha})`;
          ctx.globalAlpha = 1;
          ctx.translate(entry.x, entry.y + 1);
          ctx.scale(wordScale, wordScale);
          ctx.fillText(entry.word, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        // Main word
        ctx.globalAlpha = alpha;
        ctx.fillStyle = wordColor;
        ctx.translate(entry.x, entry.y);
        ctx.scale(wordScale, wordScale);
        ctx.fillText(entry.word, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        ctx.restore();
      }
    }
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
