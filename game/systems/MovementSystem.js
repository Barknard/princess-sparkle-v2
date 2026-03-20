/**
 * MovementSystem.js — BFS pathfinding for Princess Sparkle V2
 *
 * BFS pathfinder (not A* — simpler, sufficient for small maps).
 * Input: start tile, end tile, collision map (Uint8Array).
 * Output: array of tile coordinates.
 * Max path length: 60 tiles.
 * Runs once per tap, result stored on entity.
 * Reuses internal queue array (pre-allocated).
 */

const MAX_PATH_LENGTH = 60;

// Pre-allocated BFS capacity — enough for a 60x40 map
const BFS_CAPACITY = 2400;

// 4 cardinal directions
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export default class MovementSystem {
  /**
   * @param {number} mapWidth - Width of the collision map in tiles
   * @param {number} mapHeight - Height of the collision map in tiles
   */
  constructor(mapWidth, mapHeight) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    // Pre-allocated BFS queue (circular buffer indices)
    // Each entry stores: tile index (y * width + x)
    this._queue = new Int32Array(BFS_CAPACITY);
    this._queueHead = 0;
    this._queueTail = 0;

    // Visited / parent map — reused each pathfind call
    // -1 = unvisited, otherwise stores the parent tile index
    this._parent = new Int32Array(mapWidth * mapHeight);

    // Reusable path output array
    /** @type {Array<{x: number, y: number}>} */
    this._pathOut = [];
    for (let i = 0; i < MAX_PATH_LENGTH; i++) {
      this._pathOut.push({ x: 0, y: 0 });
    }
  }

  /**
   * Resize internal buffers for a new map size.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.mapWidth = width;
    this.mapHeight = height;
    if (width * height > this._parent.length) {
      this._parent = new Int32Array(width * height);
    }
  }

  /**
   * Find a path from start to end using BFS.
   *
   * @param {number} startX - Start tile X (integer)
   * @param {number} startY - Start tile Y (integer)
   * @param {number} endX - End tile X (integer)
   * @param {number} endY - End tile Y (integer)
   * @param {Uint8Array} collisionMap - 0=walkable, 1=blocked, row-major
   * @returns {Array<{x: number, y: number}>|null} Path array or null if no path
   */
  findPath(startX, startY, endX, endY, collisionMap) {
    const w = this.mapWidth;
    const h = this.mapHeight;

    // Clamp to map bounds
    startX = startX | 0;
    startY = startY | 0;
    endX = endX | 0;
    endY = endY | 0;

    // Quick checks
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return null;
    if (endX < 0 || endX >= w || endY < 0 || endY >= h) return null;

    const endIdx = endY * w + endX;
    const startIdx = startY * w + startX;

    // If end tile is blocked, find nearest walkable tile
    if (collisionMap[endIdx] === 1) {
      const nearest = this._findNearestWalkable(endX, endY, collisionMap);
      if (!nearest) return null;
      endX = nearest.x;
      endY = nearest.y;
    }

    // Same tile
    if (startX === endX && startY === endY) return null;

    // Reset parent map
    const mapSize = w * h;
    for (let i = 0; i < mapSize; i++) {
      this._parent[i] = -1;
    }

    // BFS
    this._queueHead = 0;
    this._queueTail = 0;

    this._parent[startIdx] = startIdx; // mark start as visited (self-parent)
    this._queue[this._queueTail++] = startIdx;

    let found = false;
    const finalEndIdx = endY * w + endX;

    while (this._queueHead < this._queueTail) {
      const curIdx = this._queue[this._queueHead++];
      const curX = curIdx % w;
      const curY = (curIdx / w) | 0;

      if (curIdx === finalEndIdx) {
        found = true;
        break;
      }

      // Explore 4 neighbors
      for (let d = 0; d < 4; d++) {
        const nx = curX + DX[d];
        const ny = curY + DY[d];

        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;

        const nIdx = ny * w + nx;
        if (this._parent[nIdx] !== -1) continue; // already visited
        if (collisionMap[nIdx] === 1) continue;   // blocked

        this._parent[nIdx] = curIdx;
        this._queue[this._queueTail++] = nIdx;

        // Safety: don't overflow queue
        if (this._queueTail >= BFS_CAPACITY) {
          found = false;
          break;
        }
      }

      if (this._queueTail >= BFS_CAPACITY) break;
    }

    if (!found) return null;

    // Reconstruct path (reverse trace from end to start)
    return this._reconstructPath(startIdx, finalEndIdx);
  }

  /**
   * Reconstruct path from parent map.
   * @param {number} startIdx
   * @param {number} endIdx
   * @returns {Array<{x: number, y: number}>|null}
   */
  _reconstructPath(startIdx, endIdx) {
    const w = this.mapWidth;

    // First pass: count length (trace backwards)
    let count = 0;
    let idx = endIdx;
    while (idx !== startIdx && count < MAX_PATH_LENGTH) {
      count++;
      idx = this._parent[idx];
      if (idx === -1) return null; // broken chain
    }

    if (count === 0) return null;
    if (count > MAX_PATH_LENGTH) count = MAX_PATH_LENGTH;

    // Second pass: fill path array (backwards, then we have it in reverse)
    // We reuse pre-allocated path objects
    const path = [];
    idx = endIdx;
    for (let i = count - 1; i >= 0; i--) {
      const x = idx % w;
      const y = (idx / w) | 0;
      // Reuse pooled objects up to MAX_PATH_LENGTH, allocate beyond (rare)
      if (i < this._pathOut.length) {
        this._pathOut[i].x = x;
        this._pathOut[i].y = y;
      }
      idx = this._parent[idx];
    }

    // Copy references to output (avoid allocating new array objects)
    for (let i = 0; i < count; i++) {
      path.push(this._pathOut[i]);
    }

    return path;
  }

  /**
   * Find the nearest walkable tile to a blocked target.
   * Searches in expanding rings up to 3 tiles away.
   * @param {number} tx
   * @param {number} ty
   * @param {Uint8Array} collisionMap
   * @returns {{x: number, y: number}|null}
   */
  _findNearestWalkable(tx, ty, collisionMap) {
    const w = this.mapWidth;
    const h = this.mapHeight;

    for (let radius = 1; radius <= 3; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          if (collisionMap[ny * w + nx] === 0) {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return null;
  }
}
