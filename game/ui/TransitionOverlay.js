/**
 * TransitionOverlay.js — Scene transition effects for Princess Sparkle V2
 *
 * Three transition types:
 *   'fade'  — fade through soft pink (#ffe0ec), 800ms default
 *   'iris'  — circle close/open through dark purple (#1a0a2e)
 *   'white' — fade through white (for sparkle-burst moments)
 *
 * All use ease-in-out-cubic timing.
 * No DOM manipulation — canvas only.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';

// ---- Easing ----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- Constants --------------------------------------------------------------

const COLORS = {
  fade:  '#ffe0ec',
  iris:  '#1a0a2e',
  white: '#ffffff',
};

const DEFAULT_DURATION = 800; // ms

// ---- TransitionOverlay ------------------------------------------------------

export default class TransitionOverlay {
  constructor() {
    /** @type {'fade'|'iris'|'white'|null} */
    this._type = null;

    this._duration = DEFAULT_DURATION;
    this._elapsed = 0;
    this._active = false;
    this._halfFired = false;

    /**
     * Callback fired exactly once at the halfway point (scene swap moment).
     * @type {Function|null}
     */
    this._onHalf = null;

    /**
     * Callback fired when the transition completes.
     * @type {Function|null}
     */
    this._onDone = null;
  }

  /** @returns {boolean} Whether a transition is currently running. */
  get active() {
    return this._active;
  }

  /**
   * Start a transition.
   * @param {'fade'|'iris'|'white'} type
   * @param {object}  [opts]
   * @param {number}  [opts.duration=800]  Total duration in ms.
   * @param {Function} [opts.onHalf]       Called at the midpoint (swap scenes here).
   * @param {Function} [opts.onDone]       Called when complete.
   */
  start(type, opts = {}) {
    this._type = type;
    this._duration = opts.duration || DEFAULT_DURATION;
    this._elapsed = 0;
    this._active = true;
    this._halfFired = false;
    this._onHalf = opts.onHalf || null;
    this._onDone = opts.onDone || null;
  }

  /**
   * Update timer.  Call every frame.
   * @param {number} dt — delta time in seconds
   */
  update(dt) {
    if (!this._active) return;

    this._elapsed += dt * 1000; // convert to ms

    // Fire midpoint callback once
    if (!this._halfFired && this._elapsed >= this._duration * 0.5) {
      this._halfFired = true;
      if (this._onHalf) this._onHalf();
    }

    // Complete
    if (this._elapsed >= this._duration) {
      this._active = false;
      if (this._onDone) this._onDone();
    }
  }

  /**
   * Draw the overlay on top of whatever is below.
   * @param {import('../engine/Renderer.js').default} renderer
   */
  draw(renderer) {
    if (!this._active) return;

    const progress = Math.min(this._elapsed / this._duration, 1);
    const ctx = renderer.ctx;

    if (this._type === 'fade' || this._type === 'white') {
      // Alpha ramps up to 1.0 at midpoint then back down to 0
      const alpha = progress < 0.5
        ? easeInOutCubic(progress * 2)
        : 1 - easeInOutCubic((progress - 0.5) * 2);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS[this._type];
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.restore();
    } else if (this._type === 'iris') {
      const cx = (LOGICAL_WIDTH / 2) | 0;
      const cy = (LOGICAL_HEIGHT / 2) | 0;
      const maxR = Math.hypot(cx, cy);

      // Radius shrinks to 0 at midpoint, then grows back
      const r = progress < 0.5
        ? maxR * (1 - easeInOutCubic(progress * 2))
        : maxR * easeInOutCubic((progress - 0.5) * 2);

      ctx.save();
      ctx.fillStyle = COLORS.iris;
      ctx.beginPath();
      ctx.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      ctx.arc(cx, cy, Math.max(r, 0.5), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.restore();
    }
  }
}
