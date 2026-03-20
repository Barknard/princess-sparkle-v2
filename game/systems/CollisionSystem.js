/**
 * CollisionSystem.js — Walkability and interaction zones for Princess Sparkle V2
 *
 * Reads level collision layer (Uint8Array, 0=walk, 1=blocked).
 * isWalkable(tileX, tileY).
 * Interaction zone map: list of {tileX, tileY, radius, entityId}.
 * getInteractableAt(gameX, gameY) — checks NPCs, objects, animals.
 * Spatial grid for O(1) lookups instead of O(n) iteration.
 */

// Grid cell size in tiles for spatial hashing
const CELL_SIZE = 4;

/** Entity categories for interaction lookups */
export const EntityCategory = {
  NPC: 'NPC',
  OBJECT: 'OBJECT',
  ANIMAL: 'ANIMAL'
};

/**
 * Spatial grid entry (pre-allocated struct).
 */
class GridEntry {
  constructor() {
    this.entityId = '';
    this.category = '';
    this.x = 0;
    this.y = 0;
    this.radius = 0;
    this.entity = null;
  }
}

export default class CollisionSystem {
  /**
   * @param {number} mapWidth - Map width in tiles
   * @param {number} mapHeight - Map height in tiles
   */
  constructor(mapWidth, mapHeight) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    /** @type {Uint8Array|null} Collision layer: 0=walkable, 1=blocked */
    this.collisionMap = null;

    // Spatial grid dimensions
    this.gridCols = Math.ceil(mapWidth / CELL_SIZE);
    this.gridRows = Math.ceil(mapHeight / CELL_SIZE);

    // Spatial grid: array of arrays
    // Each cell holds a list of entity references
    /** @type {Array<Array<GridEntry>>} */
    this.grid = new Array(this.gridCols * this.gridRows);
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = [];
    }

    // Pre-allocated pool of grid entries
    /** @type {GridEntry[]} */
    this._entryPool = [];
    for (let i = 0; i < 256; i++) {
      this._entryPool.push(new GridEntry());
    }
    this._entryPoolIndex = 0;
  }

  /**
   * Set the collision map for the current level.
   * @param {Uint8Array} map - Row-major, 0=walk, 1=blocked
   * @param {number} width
   * @param {number} height
   */
  setCollisionMap(map, width, height) {
    this.collisionMap = map;
    this.mapWidth = width;
    this.mapHeight = height;
    this.gridCols = Math.ceil(width / CELL_SIZE);
    this.gridRows = Math.ceil(height / CELL_SIZE);

    // Resize grid if needed
    const gridSize = this.gridCols * this.gridRows;
    if (this.grid.length < gridSize) {
      this.grid.length = gridSize;
      for (let i = 0; i < gridSize; i++) {
        if (!this.grid[i]) this.grid[i] = [];
      }
    }
  }

  /**
   * Check if a tile is walkable.
   * @param {number} tileX
   * @param {number} tileY
   * @returns {boolean}
   */
  isWalkable(tileX, tileY) {
    const tx = tileX | 0;
    const ty = tileY | 0;
    if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) {
      return false;
    }
    if (!this.collisionMap) return true;
    return this.collisionMap[ty * this.mapWidth + tx] === 0;
  }

  /**
   * Clear all entities from the spatial grid.
   * Call this at the start of each frame before re-registering.
   */
  clearGrid() {
    for (let i = 0; i < this.gridCols * this.gridRows; i++) {
      if (this.grid[i]) this.grid[i].length = 0;
    }
    this._entryPoolIndex = 0;
  }

  /**
   * Register an interactable entity in the spatial grid.
   * @param {string} entityId
   * @param {string} category - EntityCategory value
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @param {number} radius - Interaction radius in tiles
   * @param {object} entity - Reference to the entity object
   */
  registerEntity(entityId, category, x, y, radius, entity) {
    const cellX = (x / CELL_SIZE) | 0;
    const cellY = (y / CELL_SIZE) | 0;

    // Register in current cell and adjacent cells that overlap the radius
    const cellRadius = Math.ceil(radius / CELL_SIZE);

    for (let cy = cellY - cellRadius; cy <= cellY + cellRadius; cy++) {
      for (let cx = cellX - cellRadius; cx <= cellX + cellRadius; cx++) {
        if (cx < 0 || cx >= this.gridCols || cy < 0 || cy >= this.gridRows) continue;

        const cellIdx = cy * this.gridCols + cx;
        const entry = this._getPooledEntry();
        entry.entityId = entityId;
        entry.category = category;
        entry.x = x;
        entry.y = y;
        entry.radius = radius;
        entry.entity = entity;
        this.grid[cellIdx].push(entry);
      }
    }
  }

  /**
   * Get the closest interactable entity at a given position.
   * @param {number} gameX - Tile X coordinate
   * @param {number} gameY - Tile Y coordinate
   * @param {string} [category] - Optional: filter by category
   * @returns {{entityId: string, category: string, entity: object, distance: number}|null}
   */
  getInteractableAt(gameX, gameY, category) {
    const cellX = (gameX / CELL_SIZE) | 0;
    const cellY = (gameY / CELL_SIZE) | 0;

    let closest = null;
    let closestDist = Infinity;

    // Check current cell and immediate neighbors
    for (let cy = cellY - 1; cy <= cellY + 1; cy++) {
      for (let cx = cellX - 1; cx <= cellX + 1; cx++) {
        if (cx < 0 || cx >= this.gridCols || cy < 0 || cy >= this.gridRows) continue;

        const cellIdx = cy * this.gridCols + cx;
        const cell = this.grid[cellIdx];

        for (let i = 0; i < cell.length; i++) {
          const entry = cell[i];

          // Category filter
          if (category && entry.category !== category) continue;

          // Distance check
          const dx = gameX - entry.x;
          const dy = gameY - entry.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= entry.radius && dist < closestDist) {
            closestDist = dist;
            closest = entry;
          }
        }
      }
    }

    if (!closest) return null;

    return {
      entityId: closest.entityId,
      category: closest.category,
      entity: closest.entity,
      distance: closestDist
    };
  }

  /**
   * Get all interactable entities within a radius of a point.
   * @param {number} gameX
   * @param {number} gameY
   * @param {number} searchRadius
   * @param {Array} resultsOut - Pre-allocated results array (cleared and filled)
   * @returns {number} Number of results found
   */
  getInteractablesInRadius(gameX, gameY, searchRadius, resultsOut) {
    resultsOut.length = 0;
    const cellX = (gameX / CELL_SIZE) | 0;
    const cellY = (gameY / CELL_SIZE) | 0;
    const cellRadius = Math.ceil(searchRadius / CELL_SIZE) + 1;

    // Track seen entity IDs to avoid duplicates (entity may be in multiple cells)
    const seen = this._seenSet;
    seen.clear();

    for (let cy = cellY - cellRadius; cy <= cellY + cellRadius; cy++) {
      for (let cx = cellX - cellRadius; cx <= cellX + cellRadius; cx++) {
        if (cx < 0 || cx >= this.gridCols || cy < 0 || cy >= this.gridRows) continue;

        const cellIdx = cy * this.gridCols + cx;
        const cell = this.grid[cellIdx];

        for (let i = 0; i < cell.length; i++) {
          const entry = cell[i];
          if (seen.has(entry.entityId)) continue;

          const dx = gameX - entry.x;
          const dy = gameY - entry.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= searchRadius + entry.radius) {
            seen.add(entry.entityId);
            resultsOut.push(entry);
          }
        }
      }
    }

    return resultsOut.length;
  }

  /**
   * Get a pooled grid entry.
   * @returns {GridEntry}
   */
  _getPooledEntry() {
    if (this._entryPoolIndex < this._entryPool.length) {
      return this._entryPool[this._entryPoolIndex++];
    }
    // Grow pool if needed (rare)
    const entry = new GridEntry();
    this._entryPool.push(entry);
    this._entryPoolIndex++;
    return entry;
  }

  // Set for deduplication in getInteractablesInRadius
  /** @type {Set<string>} */
  _seenSet = new Set();
}
