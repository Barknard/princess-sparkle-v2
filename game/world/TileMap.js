/**
 * TileMap.js — Level renderer for Princess Sparkle V2
 *
 * Reads level layers: ground, objects, collision, foreground.
 * Renders layers in correct order.
 * Handles animated tiles.
 * Camera-aware rendering (only draws visible tiles).
 */

const TILE = 16;

export default class TileMap {
  constructor() {
    // Map dimensions in tiles
    this.width = 0;
    this.height = 0;

    // Layers (each is a flat array, row-major, -1 = empty)
    /** @type {Int16Array|null} Ground/floor tiles */
    this.groundLayer = null;
    /** @type {Int16Array|null} Objects/decoration layer */
    this.objectLayer = null;
    /** @type {Uint8Array|null} Collision layer: 0=walk, 1=blocked */
    this.collisionLayer = null;
    /** @type {Int16Array|null} Foreground layer (drawn on top of entities) */
    this.foregroundLayer = null;

    /** @type {import('./TileSet.js').default|null} */
    this.tileset = null;

    // Pre-computed view bounds (updated each frame)
    this._viewStartX = 0;
    this._viewStartY = 0;
    this._viewEndX = 0;
    this._viewEndY = 0;
  }

  /**
   * Load level data into the tilemap.
   *
   * @param {object} levelData
   * @param {number} levelData.width - Map width in tiles
   * @param {number} levelData.height - Map height in tiles
   * @param {number[]|Int16Array} levelData.ground - Ground layer tile IDs
   * @param {number[]|Int16Array} [levelData.objects] - Object layer tile IDs
   * @param {number[]|Uint8Array} levelData.collision - Collision layer
   * @param {number[]|Int16Array} [levelData.foreground] - Foreground layer tile IDs
   * @param {import('./TileSet.js').default} tileset
   */
  loadLevel(levelData, tileset) {
    this.width = levelData.width;
    this.height = levelData.height;
    this.tileset = tileset;

    // Convert to typed arrays for performance
    this.groundLayer = levelData.ground instanceof Int16Array
      ? levelData.ground
      : new Int16Array(levelData.ground);

    if (levelData.objects) {
      this.objectLayer = levelData.objects instanceof Int16Array
        ? levelData.objects
        : new Int16Array(levelData.objects);
    } else {
      this.objectLayer = null;
    }

    this.collisionLayer = levelData.collision instanceof Uint8Array
      ? levelData.collision
      : new Uint8Array(levelData.collision);

    if (levelData.foreground) {
      this.foregroundLayer = levelData.foreground instanceof Int16Array
        ? levelData.foreground
        : new Int16Array(levelData.foreground);
    } else {
      this.foregroundLayer = null;
    }
  }

  /**
   * Update animated tiles.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (this.tileset) {
      this.tileset.update(dt);
    }
  }

  /**
   * Compute which tiles are visible based on camera position.
   * @param {object} camera - {x, y} in tile coordinates
   * @param {number} screenWidth - Logical screen width in pixels
   * @param {number} screenHeight - Logical screen height in pixels
   */
  _computeViewBounds(camera, screenWidth, screenHeight) {
    const tilesAcross = Math.ceil(screenWidth / TILE) + 1;
    const tilesDown = Math.ceil(screenHeight / TILE) + 1;

    // Camera position defines the top-left tile visible
    this._viewStartX = Math.max(0, (camera.x | 0) - 1);
    this._viewStartY = Math.max(0, (camera.y | 0) - 1);
    this._viewEndX = Math.min(this.width, this._viewStartX + tilesAcross + 2);
    this._viewEndY = Math.min(this.height, this._viewStartY + tilesDown + 2);
  }

  /**
   * Draw the ground and object layers (below entities).
   * @param {import('../engine/Renderer.js').default} renderer
   * @param {object} camera - {x, y} in tile coords
   */
  drawBelow(renderer, camera) {
    if (!this.tileset || !this.tileset.loaded) return;

    this._computeViewBounds(camera, 480, 320);
    const ctx = renderer.ctx;
    const ts = this.tileset;
    const w = this.width;
    const camPxX = camera.x * TILE;
    const camPxY = camera.y * TILE;

    // Ground layer
    if (this.groundLayer) {
      for (let ty = this._viewStartY; ty < this._viewEndY; ty++) {
        for (let tx = this._viewStartX; tx < this._viewEndX; tx++) {
          const tileId = this.groundLayer[ty * w + tx];
          if (tileId < 0) continue;
          const dx = (tx * TILE - camPxX) | 0;
          const dy = (ty * TILE - camPxY) | 0;
          ts.drawTile(ctx, tileId, dx, dy);
        }
      }
    }

    // Object layer
    if (this.objectLayer) {
      for (let ty = this._viewStartY; ty < this._viewEndY; ty++) {
        for (let tx = this._viewStartX; tx < this._viewEndX; tx++) {
          const tileId = this.objectLayer[ty * w + tx];
          if (tileId < 0) continue;
          const dx = (tx * TILE - camPxX) | 0;
          const dy = (ty * TILE - camPxY) | 0;
          ts.drawTile(ctx, tileId, dx, dy);
        }
      }
    }
  }

  /**
   * Draw the foreground layer (above entities — e.g., tree canopies).
   * @param {import('../engine/Renderer.js').default} renderer
   * @param {object} camera
   */
  drawAbove(renderer, camera) {
    if (!this.tileset || !this.tileset.loaded || !this.foregroundLayer) return;

    const ctx = renderer.ctx;
    const ts = this.tileset;
    const w = this.width;
    const camPxX = camera.x * TILE;
    const camPxY = camera.y * TILE;

    for (let ty = this._viewStartY; ty < this._viewEndY; ty++) {
      for (let tx = this._viewStartX; tx < this._viewEndX; tx++) {
        const tileId = this.foregroundLayer[ty * w + tx];
        if (tileId < 0) continue;
        const dx = (tx * TILE - camPxX) | 0;
        const dy = (ty * TILE - camPxY) | 0;
        ts.drawTile(ctx, tileId, dx, dy);
      }
    }
  }

  /**
   * Get the collision value at a tile position.
   * @param {number} tx
   * @param {number} ty
   * @returns {number} 0=walkable, 1=blocked
   */
  getCollision(tx, ty) {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return 1;
    if (!this.collisionLayer) return 0;
    return this.collisionLayer[ty * this.width + tx];
  }

  /**
   * Get the tile ID at a specific layer and position.
   * @param {string} layer - 'ground', 'objects', or 'foreground'
   * @param {number} tx
   * @param {number} ty
   * @returns {number} Tile ID or -1
   */
  getTileAt(layer, tx, ty) {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return -1;
    const idx = ty * this.width + tx;
    switch (layer) {
      case 'ground': return this.groundLayer ? this.groundLayer[idx] : -1;
      case 'objects': return this.objectLayer ? this.objectLayer[idx] : -1;
      case 'foreground': return this.foregroundLayer ? this.foregroundLayer[idx] : -1;
      default: return -1;
    }
  }
}
