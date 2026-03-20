/**
 * SceneManager.js — Stack-based scene manager for Princess Sparkle V2
 *
 * Supports push, pop, replace, clearAndPush.
 * Scenes implement: init(), enter(), exit(), update(dt), draw(renderer).
 * Supports transparent overlay scenes (e.g. dialogue on top of overworld).
 * Handles transitions between scenes via TransitionOverlay.
 */

export default class SceneManager {
  /**
   * @param {import('./TransitionOverlay.js').default} transitionOverlay
   */
  constructor(transitionOverlay) {
    /** @type {Array<{scene: object, transparent: boolean}>} */
    this._stack = [];

    /** @type {import('./TransitionOverlay.js').default} */
    this._transition = transitionOverlay;

    // Pending scene operation during transition
    this._pendingOp = null;
  }

  /** @returns {object|null} The top scene on the stack */
  get current() {
    if (this._stack.length === 0) return null;
    return this._stack[this._stack.length - 1].scene;
  }

  /** @returns {number} Number of scenes on the stack */
  get depth() {
    return this._stack.length;
  }

  /**
   * Push a scene onto the stack.
   * @param {object} scene - Scene object with lifecycle methods
   * @param {object} [options]
   * @param {boolean} [options.transparent=false] - If true, scenes below are still drawn
   * @param {string} [options.transition] - Transition type: 'fade', 'iris', or null
   * @param {number} [options.duration] - Transition duration in ms
   */
  push(scene, options = {}) {
    const transparent = options.transparent || false;
    const transition = options.transition || null;
    const duration = options.duration || undefined;

    if (transition) {
      this._executeWithTransition(transition, duration, () => {
        this._doPush(scene, transparent);
      });
    } else {
      this._doPush(scene, transparent);
    }
  }

  /**
   * Pop the top scene off the stack.
   * @param {object} [options]
   * @param {string} [options.transition]
   * @param {number} [options.duration]
   */
  pop(options = {}) {
    const transition = options.transition || null;
    const duration = options.duration || undefined;

    if (transition) {
      this._executeWithTransition(transition, duration, () => {
        this._doPop();
      });
    } else {
      this._doPop();
    }
  }

  /**
   * Replace the top scene with a new one.
   * @param {object} scene
   * @param {object} [options]
   * @param {boolean} [options.transparent=false]
   * @param {string} [options.transition]
   * @param {number} [options.duration]
   */
  replace(scene, options = {}) {
    const transparent = options.transparent || false;
    const transition = options.transition || null;
    const duration = options.duration || undefined;

    if (transition) {
      this._executeWithTransition(transition, duration, () => {
        this._doPop();
        this._doPush(scene, transparent);
      });
    } else {
      this._doPop();
      this._doPush(scene, transparent);
    }
  }

  /**
   * Clear the entire stack and push a new scene.
   * @param {object} scene
   * @param {object} [options]
   * @param {boolean} [options.transparent=false]
   * @param {string} [options.transition]
   * @param {number} [options.duration]
   */
  clearAndPush(scene, options = {}) {
    const transparent = options.transparent || false;
    const transition = options.transition || null;
    const duration = options.duration || undefined;

    if (transition) {
      this._executeWithTransition(transition, duration, () => {
        this._doClearAll();
        this._doPush(scene, transparent);
      });
    } else {
      this._doClearAll();
      this._doPush(scene, transparent);
    }
  }

  /**
   * Update all active scenes. Only the topmost non-transparent scene
   * and all transparent scenes above it receive updates.
   * Also updates the transition overlay.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    // Update the transition overlay
    this._transition.update(dt);

    // Find the lowest visible scene (first non-transparent from top)
    const startIdx = this._findVisibleBase();

    for (let i = startIdx; i < this._stack.length; i++) {
      const entry = this._stack[i];
      if (entry.scene.update) {
        entry.scene.update(dt);
      }
    }
  }

  /**
   * Draw all visible scenes from bottom to top.
   * Non-transparent scenes occlude everything below them.
   * @param {import('./Renderer.js').default} renderer
   */
  draw(renderer) {
    const startIdx = this._findVisibleBase();

    for (let i = startIdx; i < this._stack.length; i++) {
      const entry = this._stack[i];
      if (entry.scene.draw) {
        entry.scene.draw(renderer);
      }
    }

    // Draw transition overlay on top of everything
    this._transition.draw(renderer);
  }

  // --- Internal methods ---

  /** Push without transition. */
  _doPush(scene, transparent) {
    if (scene.init) scene.init();
    this._stack.push({ scene, transparent });
    if (scene.enter) scene.enter();
  }

  /** Pop without transition. */
  _doPop() {
    if (this._stack.length === 0) return;
    const entry = this._stack.pop();
    if (entry.scene.exit) entry.scene.exit();
  }

  /** Clear all scenes from stack. */
  _doClearAll() {
    while (this._stack.length > 0) {
      const entry = this._stack.pop();
      if (entry.scene.exit) entry.scene.exit();
    }
  }

  /**
   * Execute a scene operation wrapped in a transition.
   * Transition closes, operation runs at midpoint, transition opens.
   * @param {string} type - 'fade' or 'iris'
   * @param {number} [duration] - Total transition duration in ms
   * @param {Function} operation - Scene manipulation to run at midpoint
   */
  _executeWithTransition(type, duration, operation) {
    this._transition.start(type, duration, () => {
      // This callback fires at the midpoint (fully closed)
      operation();
    });
  }

  /**
   * Find the index of the lowest scene that needs to be drawn.
   * Walk backwards from top; stop at the first non-transparent scene.
   * @returns {number}
   */
  _findVisibleBase() {
    for (let i = this._stack.length - 1; i >= 0; i--) {
      if (!this._stack[i].transparent) {
        return i;
      }
    }
    return 0;
  }
}
