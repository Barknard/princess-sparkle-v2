/**
 * TileSet.js — Spritesheet manager for Princess Sparkle V2
 *
 * Loads tileset PNG (16x16 tiles in a grid).
 * drawTile(ctx, tileId, dx, dy) — draws one tile.
 * Supports animated tiles (cycle through animation table at 300ms).
 */

const DEFAULT_TILE_SIZE = 16;
const ANIM_FRAME_MS = 300;

export default class TileSet {
  /**
   * @param {number} [tileSize=16] - Size of each tile in pixels
   */
  constructor(tileSize) {
    this.tileSize = tileSize || DEFAULT_TILE_SIZE;

    /** @type {HTMLImageElement|null} */
    this.image = null;

    // Tileset dimensions (in tiles)
    this.cols = 0;
    this.rows = 0;

    // Animated tile definitions
    // Map of tileId -> array of tileIds forming the animation
    /** @type {Map<number, number[]>} */
    this.animatedTiles = new Map();

    // Animation timer
    this.animTimer = 0;
    this.animFrame = 0;

    // Loaded flag
    this.loaded = false;
  }

  /**
   * Load a tileset image.
   * @param {string} src - URL/path to tileset PNG
   * @returns {Promise<void>}
   */
  load(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.cols = (img.width / this.tileSize) | 0;
        this.rows = (img.height / this.tileSize) | 0;
        this.loaded = true;
        resolve();
      };
      img.onerror = () => {
        reject(new Error(`Failed to load tileset: ${src}`));
      };
      img.src = src;
    });
  }

  /**
   * Set an existing image as the tileset (avoids re-loading).
   * @param {HTMLImageElement} image
   */
  setImage(image) {
    this.image = image;
    this.cols = (image.width / this.tileSize) | 0;
    this.rows = (image.height / this.tileSize) | 0;
    this.loaded = true;
  }

  /**
   * Define an animated tile.
   * @param {number} tileId - Base tile ID that triggers the animation
   * @param {number[]} frameIds - Array of tile IDs forming the animation sequence
   */
  defineAnimation(tileId, frameIds) {
    this.animatedTiles.set(tileId, frameIds);
  }

  /**
   * Update animation timer.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.animTimer += dt * 1000;
    if (this.animTimer >= ANIM_FRAME_MS) {
      this.animTimer -= ANIM_FRAME_MS;
      this.animFrame++;
    }
  }

  /**
   * Draw a single tile by tile ID.
   * Tile ID is calculated as: row * cols + col (row-major).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} tileId - Tile index in the tileset
   * @param {number} dx - Destination X in screen pixels
   * @param {number} dy - Destination Y in screen pixels
   */
  drawTile(ctx, tileId, dx, dy) {
    if (!this.image || tileId < 0) return;

    // Check for animated tile
    let actualId = tileId;
    const animFrames = this.animatedTiles.get(tileId);
    if (animFrames && animFrames.length > 0) {
      actualId = animFrames[this.animFrame % animFrames.length];
    }

    const sx = (actualId % this.cols) * this.tileSize;
    const sy = ((actualId / this.cols) | 0) * this.tileSize;

    ctx.drawImage(
      this.image,
      sx, sy, this.tileSize, this.tileSize,
      dx | 0, dy | 0, this.tileSize, this.tileSize
    );
  }

  /**
   * Draw a tile by grid column and row in the tileset.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} tileCol - Column in tileset
   * @param {number} tileRow - Row in tileset
   * @param {number} dx - Destination X
   * @param {number} dy - Destination Y
   */
  drawTileByGrid(ctx, tileCol, tileRow, dx, dy) {
    this.drawTile(ctx, tileRow * this.cols + tileCol, dx, dy);
  }

  /**
   * Get total number of tiles in the tileset.
   * @returns {number}
   */
  getTileCount() {
    return this.cols * this.rows;
  }
}
