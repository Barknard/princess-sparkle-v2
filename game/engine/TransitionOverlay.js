/**
 * TransitionOverlay.js — Scene transition effects for Princess Sparkle V2
 *
 * Types:
 *   'fade'  — Fade through soft pink (#ffe0ec), 800ms total
 *   'iris'  — Circle close/open through dark purple (#1a0a2e), 800ms total
 *
 * Used by SceneManager during scene switches.
 * Lifecycle: close (half duration) → midpoint callback → open (half duration)
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './Renderer.js';

// Default colors and durations per transition type
const TRANSITION_CONFIGS = {
  fade: { color: '#ffe0ec', duration: 800 },
  iris: { color: '#1a0a2e', duration: 800 }
};

// Pre-compute center and max radius for iris transition
const CENTER_X = LOGICAL_WIDTH / 2;
const CENTER_Y = LOGICAL_HEIGHT / 2;
const MAX_RADIUS = Math.sqrt(CENTER_X * CENTER_X + CENTER_Y * CENTER_Y);

export default class TransitionOverlay {
  constructor() {
    /** @type {string|null} Current transition type */
    this._type = null;

    /** @type {string} Fill color */
    this._color = '#000000';

    /** Total duration in seconds */
    this._duration = 0;

    /** Elapsed time in seconds */
    this._elapsed = 0;

    /** Whether we've fired the midpoint callback */
    this._midpointFired = false;

    /** @type {Function|null} Callback at midpoint */
    this._onMidpoint = null;

    /** Whether a transition is currently active */
    this._active = false;

    /**
     * Current progress: 0 = not started, 0.5 = fully closed (midpoint), 1 = done.
     * During close phase (0-0.5): alpha goes 0→1 (fade) or radius goes max→0 (iris).
     * During open phase (0.5-1): alpha goes 1→0 (fade) or radius goes 0→max (iris).
     */
    this._progress = 0;
  }

  /** @returns {boolean} Whether a transition is active */
  get isActive() {
    return this._active;
  }

  /**
   * Start a transition.
   * @param {string} type - 'fade' or 'iris'
   * @param {number} [duration] - Total duration in ms (overrides default)
   * @param {Function} [onMidpoint] - Called when transition is fully closed
   */
  start(type, duration, onMidpoint) {
    const config = TRANSITION_CONFIGS[type] || TRANSITION_CONFIGS.fade;
    this._type = type;
    this._color = config.color;
    this._duration = (duration || config.duration) / 1000; // convert to seconds
    this._elapsed = 0;
    this._progress = 0;
    this._midpointFired = false;
    this._onMidpoint = onMidpoint || null;
    this._active = true;
  }

  /**
   * Update the transition timer.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this._active) return;

    this._elapsed += dt;
    this._progress = Math.min(this._elapsed / this._duration, 1);

    // Fire midpoint callback once when we reach the halfway point
    if (!this._midpointFired && this._progress >= 0.5) {
      this._midpointFired = true;
      if (this._onMidpoint) {
        this._onMidpoint();
      }
    }

    // Transition complete
    if (this._progress >= 1) {
      this._active = false;
      this._type = null;
    }
  }

  /**
   * Draw the transition overlay.
   * @param {import('./Renderer.js').default} renderer
   */
  draw(renderer) {
    if (!this._active) return;

    const ctx = renderer.ctx;

    if (this._type === 'fade') {
      this._drawFade(ctx);
    } else if (this._type === 'iris') {
      this._drawIris(ctx);
    }
  }

  /**
   * Draw fade transition: solid color with varying alpha.
   * Close phase: alpha 0→1. Open phase: alpha 1→0.
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawFade(ctx) {
    let alpha;
    if (this._progress <= 0.5) {
      // Closing: alpha ramps from 0 to 1
      alpha = this._progress * 2;
    } else {
      // Opening: alpha ramps from 1 to 0
      alpha = (1 - this._progress) * 2;
    }

    if (alpha <= 0) return;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = this._color;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.globalAlpha = 1;
  }

  /**
   * Draw iris transition: circular wipe through a solid color.
   * Close phase: circle shrinks from full screen to center.
   * Open phase: circle grows from center to full screen.
   * The area OUTSIDE the circle is filled with color.
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawIris(ctx) {
    let radius;
    if (this._progress <= 0.5) {
      // Closing: radius goes from MAX_RADIUS to 0
      const t = this._progress * 2; // 0→1
      radius = MAX_RADIUS * (1 - t);
    } else {
      // Opening: radius goes from 0 to MAX_RADIUS
      const t = (this._progress - 0.5) * 2; // 0→1
      radius = MAX_RADIUS * t;
    }

    // Fill entire screen with color, then cut out the circle
    ctx.save();
    ctx.fillStyle = this._color;

    // Use a clipping path: fill everything except the circle
    ctx.beginPath();
    // Outer rectangle (full screen)
    ctx.rect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Inner circle (cut out) — draw counter-clockwise to create a hole
    ctx.arc(CENTER_X | 0, CENTER_Y | 0, Math.max(0, radius), 0, Math.PI * 2, true);
    ctx.fill('evenodd');

    ctx.restore();
    // Re-disable smoothing after restore
    ctx.imageSmoothingEnabled = false;
  }
}
