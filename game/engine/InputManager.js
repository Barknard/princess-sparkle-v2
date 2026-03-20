/**
 * InputManager.js — Touch-first input for Princess Sparkle V2
 *
 * Converts touch/mouse coordinates to logical game coordinates (480x320).
 * Gesture detection: TAP, SWIPE, HOLD.
 * Touch targets enforced at min 48x48 logical pixels.
 * Single-touch only. Mouse fallback for desktop testing.
 * Prevents default on all touch events (no scroll/zoom).
 */

// Gesture thresholds
const TAP_MAX_TIME = 300;       // ms — finger down+up within this = tap
const TAP_MAX_DISTANCE = 10;    // logical pixels — must stay within this
const SWIPE_MIN_DISTANCE = 40;  // logical pixels — minimum swipe length
const HOLD_MIN_TIME = 300;      // ms — finger held for this long = hold

// Event types
export const InputEvent = {
  TAP: 'TAP',
  SWIPE_UP: 'SWIPE_UP',
  SWIPE_DOWN: 'SWIPE_DOWN',
  SWIPE_LEFT: 'SWIPE_LEFT',
  SWIPE_RIGHT: 'SWIPE_RIGHT',
  HOLD: 'HOLD',
  TOUCH_START: 'TOUCH_START',
  TOUCH_END: 'TOUCH_END'
};

export default class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('./Renderer.js').default} renderer
   */
  constructor(canvas, renderer) {
    this._canvas = canvas;
    this._renderer = renderer;

    // Event listener queue — drained each frame (no allocations in game loop)
    /** @type {Array<{type: string, x: number, y: number, direction?: string}>} */
    this._eventQueue = [];
    // Pre-allocate pool of event objects to avoid GC
    /** @type {Array<{type: string, x: number, y: number, direction?: string}>} */
    this._eventPool = [];
    for (let i = 0; i < 32; i++) {
      this._eventPool.push({ type: '', x: 0, y: 0, direction: '' });
    }
    this._poolIndex = 0;

    // Touch tracking state
    this._touchActive = false;
    this._startX = 0;
    this._startY = 0;
    this._startTime = 0;
    this._holdFired = false;
    this._holdTimerId = 0;

    // Registered event handlers (listeners registered by game code)
    /** @type {Map<string, Array<Function>>} */
    this._listeners = new Map();

    // Pre-bind all handlers
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    // Register event listeners
    // Touch events — passive:false so we can preventDefault
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchcancel', this._onTouchEnd, { passive: false });

    // Mouse fallback for desktop testing
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mouseup', this._onMouseUp);

    // Prevent context menu on long press
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Register an event listener.
   * @param {string} eventType - One of InputEvent values
   * @param {Function} callback - Called with (x, y, eventType)
   */
  on(eventType, callback) {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, []);
    }
    this._listeners.get(eventType).push(callback);
  }

  /**
   * Remove an event listener.
   * @param {string} eventType
   * @param {Function} callback
   */
  off(eventType, callback) {
    const list = this._listeners.get(eventType);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx !== -1) list.splice(idx, 1);
  }

  /**
   * Process and dispatch all queued events.
   * Call this once per frame from the game loop update.
   * Also sets polling state (tapped, x, y) for scenes that poll input.
   */
  processEvents() {
    // Reset per-frame polling state
    this.tapped = false;
    this.x = 0;
    this.y = 0;

    for (let i = 0; i < this._eventQueue.length; i++) {
      const evt = this._eventQueue[i];

      // Set polling state for TAP events (scenes can check this._inputManager.tapped)
      if (evt.type === InputEvent.TAP) {
        this.tapped = true;
        this.x = evt.x;
        this.y = evt.y;
      }

      const listeners = this._listeners.get(evt.type);
      if (listeners) {
        for (let j = 0; j < listeners.length; j++) {
          listeners[j](evt.x, evt.y, evt.type);
        }
      }
    }
    // Reset queue without allocating new array
    this._eventQueue.length = 0;
    this._poolIndex = 0;
  }

  /**
   * Get an event object from the pool (zero-allocation).
   * @returns {{type: string, x: number, y: number, direction: string}}
   */
  _getPooledEvent() {
    if (this._poolIndex < this._eventPool.length) {
      return this._eventPool[this._poolIndex++];
    }
    // Fallback: expand pool if needed (rare)
    const evt = { type: '', x: 0, y: 0, direction: '' };
    this._eventPool.push(evt);
    this._poolIndex++;
    return evt;
  }

  /**
   * Enqueue an event.
   * @param {string} type
   * @param {number} x - Logical x
   * @param {number} y - Logical y
   */
  _enqueue(type, x, y) {
    const evt = this._getPooledEvent();
    evt.type = type;
    evt.x = x;
    evt.y = y;
    evt.direction = '';
    this._eventQueue.push(evt);
  }

  /**
   * Convert a screen-space coordinate (from touch/mouse event) to logical coords.
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{x: number, y: number}}
   */
  _toLogical(clientX, clientY) {
    return this._renderer.screenToLogical(clientX, clientY);
  }

  // --- Touch handlers ---

  _onTouchStart(e) {
    e.preventDefault();
    if (this._touchActive) return; // single-touch only

    const touch = e.changedTouches[0];
    const logical = this._toLogical(touch.clientX, touch.clientY);

    this._touchActive = true;
    this._startX = logical.x;
    this._startY = logical.y;
    this._startTime = performance.now();
    this._holdFired = false;

    // Enqueue touch start
    this._enqueue(InputEvent.TOUCH_START, logical.x, logical.y);

    // Start hold timer
    this._holdTimerId = setTimeout(() => {
      if (this._touchActive && !this._holdFired) {
        this._holdFired = true;
        this._enqueue(InputEvent.HOLD, this._startX, this._startY);
      }
    }, HOLD_MIN_TIME);
  }

  _onTouchMove(e) {
    e.preventDefault();
    // Cancel hold if finger moves too far
    if (this._touchActive) {
      const touch = e.changedTouches[0];
      const logical = this._toLogical(touch.clientX, touch.clientY);
      const dx = logical.x - this._startX;
      const dy = logical.y - this._startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > TAP_MAX_DISTANCE) {
        clearTimeout(this._holdTimerId);
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();
    if (!this._touchActive) return;

    clearTimeout(this._holdTimerId);
    this._touchActive = false;

    const touch = e.changedTouches[0];
    const logical = this._toLogical(touch.clientX, touch.clientY);
    const elapsed = performance.now() - this._startTime;
    const dx = logical.x - this._startX;
    const dy = logical.y - this._startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Enqueue touch end
    this._enqueue(InputEvent.TOUCH_END, logical.x, logical.y);

    if (this._holdFired) {
      // Hold already fired, don't also fire tap/swipe
      return;
    }

    // Check for swipe
    if (dist >= SWIPE_MIN_DISTANCE) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      let direction;
      if (absDx > absDy) {
        direction = dx > 0 ? InputEvent.SWIPE_RIGHT : InputEvent.SWIPE_LEFT;
      } else {
        direction = dy > 0 ? InputEvent.SWIPE_DOWN : InputEvent.SWIPE_UP;
      }
      this._enqueue(direction, this._startX, this._startY);
      return;
    }

    // Check for tap
    if (elapsed <= TAP_MAX_TIME && dist <= TAP_MAX_DISTANCE) {
      this._enqueue(InputEvent.TAP, this._startX, this._startY);
    }
  }

  // --- Mouse handlers (desktop fallback) ---

  _onMouseDown(e) {
    // Treat as touch start
    const logical = this._toLogical(e.clientX, e.clientY);
    this._touchActive = true;
    this._startX = logical.x;
    this._startY = logical.y;
    this._startTime = performance.now();
    this._holdFired = false;

    this._enqueue(InputEvent.TOUCH_START, logical.x, logical.y);

    this._holdTimerId = setTimeout(() => {
      if (this._touchActive && !this._holdFired) {
        this._holdFired = true;
        this._enqueue(InputEvent.HOLD, this._startX, this._startY);
      }
    }, HOLD_MIN_TIME);
  }

  _onMouseUp(e) {
    if (!this._touchActive) return;

    clearTimeout(this._holdTimerId);
    this._touchActive = false;

    const logical = this._toLogical(e.clientX, e.clientY);
    const elapsed = performance.now() - this._startTime;
    const dx = logical.x - this._startX;
    const dy = logical.y - this._startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this._enqueue(InputEvent.TOUCH_END, logical.x, logical.y);

    if (this._holdFired) return;

    if (dist >= SWIPE_MIN_DISTANCE) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      let direction;
      if (absDx > absDy) {
        direction = dx > 0 ? InputEvent.SWIPE_RIGHT : InputEvent.SWIPE_LEFT;
      } else {
        direction = dy > 0 ? InputEvent.SWIPE_DOWN : InputEvent.SWIPE_UP;
      }
      this._enqueue(direction, this._startX, this._startY);
      return;
    }

    if (elapsed <= TAP_MAX_TIME && dist <= TAP_MAX_DISTANCE) {
      this._enqueue(InputEvent.TAP, this._startX, this._startY);
    }
  }

  /** Clean up all event listeners. */
  destroy() {
    this._canvas.removeEventListener('touchstart', this._onTouchStart);
    this._canvas.removeEventListener('touchend', this._onTouchEnd);
    this._canvas.removeEventListener('touchmove', this._onTouchMove);
    this._canvas.removeEventListener('touchcancel', this._onTouchEnd);
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    this._canvas.removeEventListener('mouseup', this._onMouseUp);
  }
}
