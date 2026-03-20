/**
 * Renderer.js — Canvas rendering wrapper for Princess Sparkle V2
 *
 * Fixed logical resolution: 480x320 (16x16 tile grid = 30x20 tiles).
 * Scales to fill any screen with integer scaling where possible,
 * falling back to fractional scaling with imageSmoothingEnabled=false.
 * Centers canvas with letterboxing. Handles devicePixelRatio for retina.
 * All coordinates are integer-snapped for crisp pixel art.
 */

export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 320;

export default class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Current scale and offset (set by resize)
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // Pre-bind resize handler
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);

    // Initial sizing
    this._onResize();
  }

  /**
   * Recalculate canvas size to fill the screen.
   * Uses integer scaling when possible for crisp pixel art.
   */
  _onResize() {
    const dpr = window.devicePixelRatio || 1;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Calculate the largest scale factor that fits
    const scaleX = screenW / LOGICAL_WIDTH;
    const scaleY = screenH / LOGICAL_HEIGHT;
    const fitScale = Math.min(scaleX, scaleY);

    // Prefer integer scaling for pixel-perfect rendering
    const intScale = Math.floor(fitScale);
    if (intScale >= 1 && (intScale / fitScale) > 0.85) {
      // Integer scale is within 85% of max fit — use it for crispness
      this.scale = intScale;
    } else {
      // Fractional scale — still better than black bars
      this.scale = fitScale;
    }

    // Display size in CSS pixels
    const displayW = Math.floor(LOGICAL_WIDTH * this.scale);
    const displayH = Math.floor(LOGICAL_HEIGHT * this.scale);

    // Center with letterboxing
    this.offsetX = Math.floor((screenW - displayW) / 2);
    this.offsetY = Math.floor((screenH - displayH) / 2);

    // Set CSS size
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = this.offsetX + 'px';
    this.canvas.style.top = this.offsetY + 'px';
    this.canvas.style.width = displayW + 'px';
    this.canvas.style.height = displayH + 'px';

    // Set backing store size (retina-aware)
    this.canvas.width = Math.floor(LOGICAL_WIDTH * this.scale * dpr);
    this.canvas.height = Math.floor(LOGICAL_HEIGHT * this.scale * dpr);

    // Scale context so we can draw in logical coordinates
    this.ctx.setTransform(this.scale * dpr, 0, 0, this.scale * dpr, 0, 0);
    this._disableSmoothing();
  }

  /**
   * Disable image smoothing for crisp pixel art.
   * Must be called after any context state change that resets it.
   */
  _disableSmoothing() {
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Clear the entire logical canvas. */
  clear() {
    this.ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /**
   * Fill the entire logical canvas with a color.
   * @param {string} color
   */
  fillBackground(color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /**
   * Draw a sprite from a spritesheet.
   * @param {HTMLImageElement} image - Spritesheet image
   * @param {number} sx - Source x
   * @param {number} sy - Source y
   * @param {number} sw - Source width
   * @param {number} sh - Source height
   * @param {number} dx - Dest x (logical)
   * @param {number} dy - Dest y (logical)
   * @param {number} dw - Dest width (logical)
   * @param {number} dh - Dest height (logical)
   */
  drawSprite(image, sx, sy, sw, sh, dx, dy, dw, dh) {
    this.ctx.drawImage(
      image,
      sx, sy, sw, sh,
      (dx | 0), (dy | 0), (dw | 0), (dh | 0)
    );
  }

  /**
   * Draw a single tile (shorthand for 16x16 source tiles).
   * @param {HTMLImageElement} tileset - Tileset image
   * @param {number} tileX - Tile column in tileset
   * @param {number} tileY - Tile row in tileset
   * @param {number} dx - Dest x (logical, world coords)
   * @param {number} dy - Dest y (logical, world coords)
   * @param {number} [tileSize=16] - Tile size in pixels
   */
  drawTile(tileset, tileX, tileY, dx, dy, tileSize = 16) {
    this.ctx.drawImage(
      tileset,
      tileX * tileSize, tileY * tileSize, tileSize, tileSize,
      (dx | 0), (dy | 0), tileSize, tileSize
    );
  }

  /**
   * Fill a rectangle.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} color
   */
  fillRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect((x | 0), (y | 0), (w | 0), (h | 0));
  }

  /**
   * Draw text on the canvas.
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {object} [options]
   * @param {string} [options.font='8px monospace']
   * @param {string} [options.color='#ffffff']
   * @param {string} [options.align='left']
   * @param {string} [options.baseline='top']
   * @param {string} [options.stroke] - Optional stroke color for outline
   * @param {number} [options.strokeWidth=2] - Stroke width
   */
  drawText(text, x, y, options = {}) {
    const font = options.font || '8px monospace';
    const color = options.color || '#ffffff';
    const align = options.align || 'left';
    const baseline = options.baseline || 'top';

    this.ctx.font = font;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;

    if (options.stroke) {
      this.ctx.strokeStyle = options.stroke;
      this.ctx.lineWidth = options.strokeWidth || 2;
      this.ctx.strokeText(text, (x | 0), (y | 0));
    }

    this.ctx.fillStyle = color;
    this.ctx.fillText(text, (x | 0), (y | 0));
  }

  /**
   * Save canvas state. Re-disables smoothing on restore.
   */
  save() {
    this.ctx.save();
  }

  /**
   * Restore canvas state and re-disable smoothing.
   */
  restore() {
    this.ctx.restore();
    this._disableSmoothing();
  }

  /**
   * Set a global alpha for subsequent draws.
   * @param {number} alpha - 0 to 1
   */
  setAlpha(alpha) {
    this.ctx.globalAlpha = alpha;
  }

  /**
   * Reset global alpha to 1.
   */
  resetAlpha() {
    this.ctx.globalAlpha = 1;
  }

  /**
   * Convert screen coordinates (CSS pixels relative to page) to logical coords.
   * Used by InputManager to convert touch/mouse positions.
   * @param {number} screenX
   * @param {number} screenY
   * @returns {{x: number, y: number}}
   */
  screenToLogical(screenX, screenY) {
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale
    };
  }

  /** Destroy and clean up. */
  destroy() {
    window.removeEventListener('resize', this._onResize);
  }
}
