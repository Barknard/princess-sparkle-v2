/**
 * GameLoop.js — Core game loop for Princess Sparkle V2
 *
 * requestAnimationFrame-based loop targeting 30fps.
 * Delta time clamped to 100ms to prevent spiral-of-death.
 * Pauses automatically on visibilitychange (tab hidden).
 * Tracks total elapsed play time for SessionGuard.
 */

// Target frame interval: 30fps = ~33.33ms per frame
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const MAX_DELTA = 100; // clamp delta to prevent spiral-of-death

export default class GameLoop {
  constructor() {
    /** @type {Function|null} */
    this._updateFn = null;
    /** @type {Function|null} */
    this._drawFn = null;

    this._rafId = 0;
    this._running = false;
    this._paused = false;
    this._lastTimestamp = 0;
    this._accumulator = 0;

    // Total elapsed play time in ms (only counts while unpaused)
    this.totalElapsedMs = 0;

    // Pre-bind methods so we never allocate closures per frame
    this._tick = this._tick.bind(this);
    this._onVisibilityChange = this._onVisibilityChange.bind(this);
  }

  /**
   * Start the game loop.
   * @param {Function} updateFn - Called with (dt) in seconds, at 30fps
   * @param {Function} drawFn  - Called once per RAF after update
   */
  start(updateFn, drawFn) {
    this._updateFn = updateFn;
    this._drawFn = drawFn;
    this._running = true;
    this._paused = false;
    this._lastTimestamp = 0;
    this._accumulator = 0;

    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Stop the loop entirely. */
  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }

  /** Pause (keeps RAF alive but skips update/draw). */
  pause() {
    this._paused = true;
  }

  /** Resume from pause. */
  resume() {
    if (this._paused) {
      this._paused = false;
      // Reset timestamp so we don't get a huge delta spike
      this._lastTimestamp = 0;
      this._accumulator = 0;
    }
  }

  /** @returns {boolean} */
  get isPaused() {
    return this._paused;
  }

  /** @returns {boolean} */
  get isRunning() {
    return this._running;
  }

  /**
   * Main tick — called by requestAnimationFrame.
   * Uses a fixed-timestep accumulator so updates are deterministic at 30fps.
   * @param {number} timestamp - DOMHighResTimestamp from rAF
   */
  _tick(timestamp) {
    if (!this._running) return;

    this._rafId = requestAnimationFrame(this._tick);

    if (this._paused) {
      // Keep RAF running but don't update or draw
      return;
    }

    // First frame: just record timestamp
    if (this._lastTimestamp === 0) {
      this._lastTimestamp = timestamp;
      return;
    }

    let rawDelta = timestamp - this._lastTimestamp;
    this._lastTimestamp = timestamp;

    // Clamp delta to prevent spiral-of-death
    if (rawDelta > MAX_DELTA) {
      rawDelta = MAX_DELTA;
    }

    this._accumulator += rawDelta;

    // Fixed timestep updates at 30fps
    while (this._accumulator >= FRAME_INTERVAL) {
      const dt = FRAME_INTERVAL / 1000; // convert to seconds
      this._updateFn(dt);
      this.totalElapsedMs += FRAME_INTERVAL;
      this._accumulator -= FRAME_INTERVAL;
    }

    // Draw once per RAF
    this._drawFn();
  }

  /**
   * Automatically pause/resume when the browser tab is hidden/shown.
   */
  _onVisibilityChange() {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  }
}
