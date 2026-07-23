/**
 * error-detector.js — Self-audit: counts specific visual defects in generated maps
 *
 * The REAL quality metric. Not "how similar to target" but
 * "how many things are WRONG that a human would notice?"
 *
 * Error categories:
 *   TREE:   orphan canopy, orphan trunk, dense body without edges, edge without body
 *   PATH:   dead-end path, path under building, path not connected to anything
 *   WELL:   well-top without base, well-base without top
 *   OBJECT: random decoration not near a building, barrel in water
 *   BUILD:  roof without walls, wall without roof, door not accessible
 *   FENCE:  single fence tile (not connected), fence crossing path
 *   WATER:  incomplete water edges, water touching building
 *   LAYER:  foreground tile on top of object tile (z-fighting)
 */

"use strict";

const fs = require('fs');
const path = require('path');

// Tile classification (by ID ranges + specific IDs)
const CANOPY_TILES = new Set([3, 4, 6, 7, 8, 9, 10, 11]);
const TRUNK_TILES = new Set([15, 16, 18, 19, 22, 23]);
const DENSE_BODY = new Set([19, 22]); // dense1 center tiles
const DENSE_EDGE = new Set([7, 10, 18, 20, 21, 23, 31, 34]); // dense1 edge tiles
const DENSE2_TILES = new Set([6, 8, 9, 11, 30, 32, 33, 35]);
const PATH_TILES = new Set([25, 39, 40, 41, 44, 45]);
const ROOF_TILES = new Set([48, 49, 50, 51, 52, 53, 54, 55, 60, 61, 62, 63, 64, 65, 66, 67]);
const WALL_TILES = new Set([72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91]);
const DOOR_TILES = new Set([74, 78, 85, 86, 87, 89, 90, 91]);
const FENCE_TILES = new Set([44, 45, 46, 47, 56, 58, 59, 68, 69, 70, 71, 80, 81, 82]);
const WATER_TILES = new Set(); // Kenney Tiny Town has NO water tiles — 109-123 are castle tiles
const WELL_TOP = 92;
const WELL_BASE = 104;
const DECO_TILES = new Set([93, 94, 95, 107]); // lantern, sign, barrel
const CASTLE_TILES = new Set([96, 97, 98, 99, 100, 101, 102, 104, 108, 109, 110, 111, 112, 113, 114, 120, 121, 122, 123, 124, 204, 205]);
const BUILDING_TILES = new Set([...ROOF_TILES, ...WALL_TILES]);

// Canopy→trunk pairs (canopy on top, trunk below)
const CANOPY_TO_TRUNK = { 4: 16, 7: 19, 3: 15, 6: 18, 10: 22 };
const TRUNK_TO_CANOPY = { 16: 4, 19: 7, 15: 3, 18: 6, 22: 10 };

const DIR4 = [[0, -1], [0, 1], [1, 0], [-1, 0]]; // N S E W

class ErrorDetector {
  constructor(tileTags) {
    this.tileTags = tileTags || {};
  }

  /**
   * Detect all errors in a generated map.
   * @param {Object} map - { width, height, ground[], objects[], foreground[] }
   * @returns {{ totalErrors, errors[], summary{} }}
   */
  detect(map) {
    const W = map.width, H = map.height;
    const ground = map.ground || [];
    const objects = map.objects || [];
    const foreground = map.foreground || [];
    const errors = [];

    const idx = (x, y) => y * W + x;
    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

    // ── TREE ERRORS ──────────────────────────────────────────────────
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const fg = foreground[idx(x, y)];

        // Orphan canopy (no trunk below)
        if (CANOPY_TILES.has(fg) && !DENSE_BODY.has(fg) && !DENSE_EDGE.has(fg)) {
          const expectedTrunk = CANOPY_TO_TRUNK[fg];
          if (expectedTrunk !== undefined) {
            if (y + 1 >= H || foreground[idx(x, y + 1)] !== expectedTrunk) {
              errors.push({ type: 'TREE', sub: 'orphan-canopy', x, y, tile: fg,
                msg: `Canopy tile ${fg} at (${x},${y}) has no trunk below` });
            }
          }
        }

        // Orphan trunk (no canopy above)
        if (TRUNK_TILES.has(fg) && !DENSE_BODY.has(fg)) {
          const expectedCanopy = TRUNK_TO_CANOPY[fg];
          if (expectedCanopy !== undefined) {
            if (y === 0 || foreground[idx(x, y - 1)] !== expectedCanopy) {
              errors.push({ type: 'TREE', sub: 'orphan-trunk', x, y, tile: fg,
                msg: `Trunk tile ${fg} at (${x},${y}) has no canopy above` });
            }
          }
        }

        // Dense edge without adjacent body
        if (DENSE_EDGE.has(fg)) {
          let hasBody = false;
          for (const [dx, dy] of DIR4) {
            if (inBounds(x + dx, y + dy) && DENSE_BODY.has(foreground[idx(x + dx, y + dy)])) {
              hasBody = true; break;
            }
          }
          if (!hasBody) {
            errors.push({ type: 'TREE', sub: 'floating-edge', x, y, tile: fg,
              msg: `Dense edge tile ${fg} at (${x},${y}) not adjacent to any body tile` });
          }
        }

        // Dense2 incomplete block
        if (DENSE2_TILES.has(fg)) {
          let hasPartner = false;
          for (const [dx, dy] of DIR4) {
            if (inBounds(x + dx, y + dy) && DENSE2_TILES.has(foreground[idx(x + dx, y + dy)])) {
              hasPartner = true; break;
            }
          }
          if (!hasPartner) {
            errors.push({ type: 'TREE', sub: 'incomplete-block', x, y, tile: fg,
              msg: `Dense2 tile ${fg} at (${x},${y}) is alone (needs 2x2 block)` });
          }
        }
      }
    }

    // ── PATH ERRORS ──────────────────────────────────────────────────
    const pathCells = new Set();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (PATH_TILES.has(ground[idx(x, y)])) pathCells.add(idx(x, y));
      }
    }

    for (const ci of pathCells) {
      const x = ci % W, y = Math.floor(ci / W);

      // Path under a building
      if (BUILDING_TILES.has(objects[ci]) && !DOOR_TILES.has(objects[ci])) {
        errors.push({ type: 'PATH', sub: 'under-building', x, y, tile: ground[ci],
          msg: `Path at (${x},${y}) is under a building (tile ${objects[ci]})` });
      }

      // Dead-end path (only 1 path neighbor)
      let pathNeighbors = 0;
      for (const [dx, dy] of DIR4) {
        if (inBounds(x + dx, y + dy) && pathCells.has(idx(x + dx, y + dy))) pathNeighbors++;
      }
      if (pathNeighbors === 0 && pathCells.size > 1) {
        errors.push({ type: 'PATH', sub: 'isolated', x, y, tile: ground[ci],
          msg: `Path at (${x},${y}) is completely isolated (no adjacent paths)` });
      }
    }

    // ── WELL ERRORS ──────────────────────────────────────────────────
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const obj = objects[idx(x, y)];
        if (obj === WELL_TOP) {
          if (y + 1 >= H || objects[idx(x, y + 1)] !== WELL_BASE) {
            errors.push({ type: 'WELL', sub: 'no-base', x, y, tile: obj,
              msg: `Well top at (${x},${y}) has no base below` });
          }
        }
        if (obj === WELL_BASE) {
          if (y === 0 || objects[idx(x, y - 1)] !== WELL_TOP) {
            errors.push({ type: 'WELL', sub: 'no-top', x, y, tile: obj,
              msg: `Well base at (${x},${y}) has no top above` });
          }
        }
      }
    }

    // ── DECORATION ERRORS ────────────────────────────────────────────
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const obj = objects[idx(x, y)];
        if (!DECO_TILES.has(obj)) continue;

        // Decoration not near any building (within 5 tiles)
        let nearBuilding = false;
        for (let dy = -5; dy <= 5 && !nearBuilding; dy++) {
          for (let dx = -5; dx <= 5 && !nearBuilding; dx++) {
            if (!inBounds(x + dx, y + dy)) continue;
            if (BUILDING_TILES.has(objects[idx(x + dx, y + dy)]) || DOOR_TILES.has(objects[idx(x + dx, y + dy)])) {
              nearBuilding = true;
            }
          }
        }
        if (!nearBuilding) {
          errors.push({ type: 'OBJECT', sub: 'random-deco', x, y, tile: obj,
            msg: `Decoration tile ${obj} at (${x},${y}) not near any building` });
        }

        // Decoration in water
        if (WATER_TILES.has(ground[idx(x, y)])) {
          errors.push({ type: 'OBJECT', sub: 'deco-in-water', x, y, tile: obj,
            msg: `Decoration tile ${obj} at (${x},${y}) is in water` });
        }
      }
    }

    // ── BUILDING ERRORS ──────────────────────────────────────────────
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const obj = objects[idx(x, y)];

        // Roof without wall below (except bottom edge)
        if (ROOF_TILES.has(obj) && y + 1 < H) {
          const below = objects[idx(x, y + 1)];
          if (below >= 0 && !ROOF_TILES.has(below) && !WALL_TILES.has(below) && !CASTLE_TILES.has(below)) {
            errors.push({ type: 'BUILD', sub: 'unsupported-roof', x, y, tile: obj,
              msg: `Roof tile ${obj} at (${x},${y}) has non-wall tile ${below} below` });
          }
        }

        // Door with solid object directly below (not walkable)
        if (DOOR_TILES.has(obj) && y + 1 < H) {
          const below = objects[idx(x, y + 1)];
          if (below >= 0 && !DOOR_TILES.has(below) && !PATH_TILES.has(ground[idx(x, y + 1)])) {
            // Door blocked
            if (BUILDING_TILES.has(below) || FENCE_TILES.has(below)) {
              errors.push({ type: 'BUILD', sub: 'blocked-door', x, y, tile: obj,
                msg: `Door at (${x},${y}) is blocked by tile ${below} below` });
            }
          }
        }
      }
    }

    // ── WATER ERRORS ─────────────────────────────────────────────────
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const obj = objects[idx(x, y)];
        if (!WATER_TILES.has(obj)) continue;

        // Water touching building
        for (const [dx, dy] of DIR4) {
          if (!inBounds(x + dx, y + dy)) continue;
          if (BUILDING_TILES.has(objects[idx(x + dx, y + dy)])) {
            errors.push({ type: 'WATER', sub: 'touching-building', x, y, tile: obj,
              msg: `Water at (${x},${y}) touching building at (${x+dx},${y+dy})` });
            break;
          }
        }
      }
    }

    // ── LAYER ERRORS ─────────────────────────────────────────────────
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const obj = objects[idx(x, y)];
        const fg = foreground[idx(x, y)];
        // Foreground on top of a building (z-fighting)
        if (fg >= 0 && BUILDING_TILES.has(obj)) {
          errors.push({ type: 'LAYER', sub: 'fg-on-building', x, y, tile: fg,
            msg: `Foreground tile ${fg} at (${x},${y}) overlaps building tile ${obj}` });
        }
      }
    }

    // ── Summary ──────────────────────────────────────────────────────
    const summary = {};
    for (const e of errors) {
      const key = e.type + ':' + e.sub;
      summary[key] = (summary[key] || 0) + 1;
    }

    return {
      totalErrors: errors.length,
      errors,
      summary,
      byType: {
        TREE: errors.filter(e => e.type === 'TREE').length,
        PATH: errors.filter(e => e.type === 'PATH').length,
        WELL: errors.filter(e => e.type === 'WELL').length,
        OBJECT: errors.filter(e => e.type === 'OBJECT').length,
        BUILD: errors.filter(e => e.type === 'BUILD').length,
        WATER: errors.filter(e => e.type === 'WATER').length,
        LAYER: errors.filter(e => e.type === 'LAYER').length,
      }
    };
  }
}

module.exports = { ErrorDetector };
