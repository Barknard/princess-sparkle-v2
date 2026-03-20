/**
 * Camera.js — Smooth-follow camera for Princess Sparkle V2
 *
 * Follows a target entity with lerp factor 0.08 for smooth movement.
 * Clamped to world bounds (never shows void beyond the map).
 * Exposes x, y offset for world-space rendering.
 * worldToScreen() and screenToWorld() transform methods.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from './Renderer.js';

const DEFAULT_LERP = 0.08;

export default class Camera {
  constructor() {
    // Camera position (top-left corner of the viewport in world space)
    this.x = 0;
    this.y = 0;

    // World bounds (set via setWorldBounds)
    this._worldWidth = LOGICAL_WIDTH;
    this._worldHeight = LOGICAL_HEIGHT;

    // Target entity to follow (must have x, y properties)
    /** @type {{x: number, y: number}|null} */
    this._target = null;

    // Lerp factor per frame (0 = no follow, 1 = instant snap)
    this._lerp = DEFAULT_LERP;

    // Pre-computed max camera positions (updated on setWorldBounds)
    this._maxX = 0;
    this._maxY = 0;
  }

  /**
   * Set the world bounds. Camera will never scroll beyond these.
   * @param {number} worldWidth - Total world width in logical pixels
   * @param {number} worldHeight - Total world height in logical pixels
   */
  setWorldBounds(worldWidth, worldHeight) {
    this._worldWidth = worldWidth;
    this._worldHeight = worldHeight;
    this._maxX = Math.max(0, worldWidth - LOGICAL_WIDTH);
    this._maxY = Math.max(0, worldHeight - LOGICAL_HEIGHT);
  }

  /**
   * Set the target entity for the camera to follow.
   * The entity must have x, y properties (center position).
   * @param {{x: number, y: number}} target
   */
  setTarget(target) {
    this._target = target;
  }

  /**
   * Set the lerp factor.
   * @param {number} lerp - 0 to 1 (0.08 is default smooth follow)
   */
  setLerp(lerp) {
    this._lerp = lerp;
  }

  /**
   * Instantly snap the camera to center on a position.
   * Useful for scene initialization.
   * @param {number} x - World x to center on
   * @param {number} y - World y to center on
   */
  snapTo(x, y) {
    this.x = x - LOGICAL_WIDTH / 2;
    this.y = y - LOGICAL_HEIGHT / 2;
    this._clamp();
  }

  /**
   * Update camera position. Call once per frame.
   * Lerps toward the target entity's position, clamped to world bounds.
   * @param {number} _dt - Delta time in seconds (unused, lerp is per-frame)
   */
  update(_dt) {
    if (!this._target) return;

    // Desired camera position: center the target on screen
    const desiredX = this._target.x - LOGICAL_WIDTH / 2;
    const desiredY = this._target.y - LOGICAL_HEIGHT / 2;

    // Lerp toward desired position
    this.x += (desiredX - this.x) * this._lerp;
    this.y += (desiredY - this.y) * this._lerp;

    // Clamp to world bounds
    this._clamp();

    // Snap to integer for pixel-perfect rendering
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
  }

  /**
   * Clamp camera to world bounds.
   */
  _clamp() {
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;
    if (this.x > this._maxX) this.x = this._maxX;
    if (this.y > this._maxY) this.y = this._maxY;
  }

  /**
   * Convert a world-space coordinate to screen-space (logical).
   * @param {number} worldX
   * @param {number} worldY
   * @returns {{x: number, y: number}}
   */
  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x) | 0,
      y: (worldY - this.y) | 0
    };
  }

  /**
   * Convert a screen-space coordinate (logical) to world-space.
   * @param {number} screenX
   * @param {number} screenY
   * @returns {{x: number, y: number}}
   */
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX + this.x) | 0,
      y: (screenY + this.y) | 0
    };
  }
}
