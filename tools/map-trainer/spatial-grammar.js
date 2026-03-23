/**
 * spatial-grammar.js — Spatial rules that govern HOW composites relate to each other
 *
 * This is the missing "Level 2.5" between tile adjacency and map layout.
 * It encodes rules like:
 *   - Buildings face paths (door toward nearest path)
 *   - Fences define yard boundaries around buildings
 *   - Paths form a connected network
 *   - Decorations radiate from building doors
 *   - Trees border the village but don't intersect structures
 *   - Open spaces between structures are proportional
 *
 * The generator calls these rules to VALIDATE and CORRECT placement decisions.
 */

const fs = require('fs');
const path = require('path');

// ── Tile IDs ────────────────────────────────────────────────────────────
const DOOR_TILES = new Set([74, 86]);
const PATH_TILES = new Set([39, 40, 41, 42, 44, 45]);
const ROOF_TILES = new Set([51, 52, 53, 55, 63, 64, 65, 67]);
const WALL_TILES = new Set();
for (let i = 72; i <= 87; i++) WALL_TILES.add(i);
const FENCE_TILES = new Set([96, 97, 98, 99, 100, 101, 108]);
const TREE_CANOPY = new Set([4, 5, 7, 8, 10, 11]);
const TREE_TRUNK = new Set([12, 13, 22, 23, 24, 25]);
const DECO_TILES = new Set([15, 18, 19, 28, 29, 92, 93, 104, 107]);
const WATER_TILES = new Set();
for (let i = 109; i <= 127; i++) WATER_TILES.add(i);

class SpatialGrammar {
  constructor(width, height) {
    this.W = width;
    this.H = height;

    // Zone map: what purpose each cell serves
    // 'open' | 'path' | 'building' | 'yard' | 'forest' | 'water' | 'square'
    this.zoneMap = new Array(width * height).fill('open');

    // Tracked structures
    this.buildings = [];
    this.pathCells = new Set();
    this.pathNetwork = null; // connected component IDs
  }

  idx(x, y) { return y * this.W + x; }
  inBounds(x, y) { return x >= 0 && x < this.W && y >= 0 && y < this.H; }

  // ══════════════════════════════════════════════════════════════════════
  // ZONE PLANNING — decide what goes where BEFORE placing tiles
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Plan zones based on DNA parameters.
   * This creates the high-level spatial structure of the village.
   */
  planZones(dna) {
    const W = this.W, H = this.H;

    // 1. Forest border
    const borderDepth = dna.treeBorderDepth || 3;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dist = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (dist < borderDepth) {
          this.zoneMap[this.idx(x, y)] = 'forest';
        }
      }
    }

    // 2. Path network
    const pcx = Math.round((dna.pathCenterX || 0.5) * W);
    const pcy = Math.round((dna.pathCenterY || 0.5) * H);
    const style = dna.pathStyle || 'cross';

    const markPath = (x, y) => {
      if (!this.inBounds(x, y)) return;
      // Paths override forest only at edges
      this.zoneMap[this.idx(x, y)] = 'path';
      this.pathCells.add(this.idx(x, y));
      // Also mark adjacent cell for 2-wide
      if (this.inBounds(x + 1, y)) {
        this.zoneMap[this.idx(x + 1, y)] = 'path';
        this.pathCells.add(this.idx(x + 1, y));
      }
    };

    switch (style) {
      case 'cross':
        for (let y = borderDepth; y < H - borderDepth; y++) markPath(pcx, y);
        for (let x = borderDepth; x < W - borderDepth; x++) markPath(x, pcy);
        break;
      case 'L-shape':
        for (let y = borderDepth; y <= pcy; y++) markPath(pcx, y);
        for (let x = pcx; x < W - borderDepth; x++) markPath(x, pcy);
        break;
      case 'loop':
        const lx1 = Math.round(W * 0.2), lx2 = Math.round(W * 0.8);
        const ly1 = Math.round(H * 0.2), ly2 = Math.round(H * 0.8);
        for (let x = lx1; x <= lx2; x++) { markPath(x, ly1); markPath(x, ly2); }
        for (let y = ly1; y <= ly2; y++) { markPath(lx1, y); markPath(lx2, y); }
        break;
      default: // organic/radial — same as cross with branches
        for (let y = borderDepth; y < H - borderDepth; y++) markPath(pcx, y);
        for (let x = borderDepth; x < W - borderDepth; x++) markPath(x, pcy);
        const qy1 = Math.round(H * 0.25), qy2 = Math.round(H * 0.75);
        for (let x = borderDepth; x < W - borderDepth; x++) { markPath(x, qy1); markPath(x, qy2); }
        break;
    }

    // 3. Village square
    if (dna.squareEnabled !== false) {
      const sw = (dna.squareSize || [6, 4])[0];
      const sh = (dna.squareSize || [6, 4])[1];
      const sx = Math.round((dna.squarePosition || [0.5, 0.5])[0] * W - sw / 2);
      const sy = Math.round((dna.squarePosition || [0.5, 0.5])[1] * H - sh / 2);
      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          if (this.inBounds(sx + dx, sy + dy)) {
            this.zoneMap[this.idx(sx + dx, sy + dy)] = 'square';
          }
        }
      }
    }

    // 4. Water zone
    if (dna.waterEnabled !== false) {
      const ww = (dna.waterSize || [4, 3])[0];
      const wh = (dna.waterSize || [4, 3])[1];
      const wx = Math.round((dna.waterPosition || [0.7, 0.5])[0] * W - ww / 2);
      const wy = Math.round((dna.waterPosition || [0.7, 0.5])[1] * H - wh / 2);
      for (let dy = -1; dy <= wh; dy++) {
        for (let dx = -1; dx <= ww; dx++) {
          if (this.inBounds(wx + dx, wy + dy)) {
            this.zoneMap[this.idx(wx + dx, wy + dy)] = 'water';
          }
        }
      }
    }

    // 5. Building zones — find valid positions along paths
    this._planBuildingZones(dna);

    return this;
  }

  /**
   * Find valid building positions: must be near a path, not in forest/water,
   * with enough yard space around them.
   */
  _planBuildingZones(dna) {
    const numBuildings = dna.buildingCount || 4;
    const minSpacing = dna.buildingMinSpacing || 10;
    const yMin = Math.round((dna.buildingYBand || [0.15, 0.7])[0] * this.H);
    const yMax = Math.round((dna.buildingYBand || [0.15, 0.7])[1] * this.H);

    for (let attempt = 0; attempt < numBuildings * 100 && this.buildings.length < numBuildings; attempt++) {
      const bw = 5 + Math.floor(Math.random() * 4); // building + yard width
      const bh = 4; // roof + wall + fence + path connection
      const bx = Math.floor(Math.random() * (this.W - bw - 4)) + 2;
      const by = yMin + Math.floor(Math.random() * Math.max(1, yMax - yMin - bh));

      // RULE: Building must be near a path (within 3 tiles of door row)
      let nearPath = false;
      for (let dx = 0; dx < bw; dx++) {
        for (let dy = bh; dy < bh + 4; dy++) {
          if (this.inBounds(bx + dx, by + dy) && this.pathCells.has(this.idx(bx + dx, by + dy))) {
            nearPath = true; break;
          }
        }
        if (nearPath) break;
      }
      if (!nearPath) continue;

      // RULE: Don't overlap other buildings or their yards
      let tooClose = false;
      for (const b of this.buildings) {
        if (Math.abs(bx - b.x) < minSpacing && Math.abs(by - b.y) < minSpacing) {
          tooClose = true; break;
        }
      }
      if (tooClose) continue;

      // RULE: Building zone must be on open/grass, not forest/water/path
      let valid = true;
      for (let dy = 0; dy < bh && valid; dy++) {
        for (let dx = 0; dx < bw && valid; dx++) {
          if (!this.inBounds(bx + dx, by + dy)) { valid = false; continue; }
          const zone = this.zoneMap[this.idx(bx + dx, by + dy)];
          if (zone === 'forest' || zone === 'water' || zone === 'building') valid = false;
        }
      }
      if (!valid) continue;

      // Mark building zone + yard
      for (let dy = -1; dy <= bh; dy++) {
        for (let dx = -1; dx <= bw; dx++) {
          if (this.inBounds(bx + dx, by + dy)) {
            const z = this.zoneMap[this.idx(bx + dx, by + dy)];
            if (z === 'open') {
              if (dy >= 0 && dy < 2 && dx >= 0 && dx < bw) {
                this.zoneMap[this.idx(bx + dx, by + dy)] = 'building';
              } else {
                this.zoneMap[this.idx(bx + dx, by + dy)] = 'yard';
              }
            }
          }
        }
      }

      this.buildings.push({ x: bx, y: by, w: bw, h: bh });
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // VALIDATION RULES — check if a placement decision is valid
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Can a building be placed at (x, y)?
   */
  canPlaceBuilding(x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.inBounds(x + dx, y + dy)) return false;
        const zone = this.zoneMap[this.idx(x + dx, y + dy)];
        if (zone !== 'open' && zone !== 'building' && zone !== 'yard') return false;
      }
    }
    // Must be near path
    for (let dx = 0; dx < w; dx++) {
      for (let below = h; below < h + 4; below++) {
        if (this.inBounds(x + dx, y + below) && this.pathCells.has(this.idx(x + dx, y + below))) return true;
      }
    }
    return false;
  }

  /**
   * Can a tree be placed at (x, y)?
   */
  canPlaceTree(x, y) {
    if (!this.inBounds(x, y) || !this.inBounds(x, y + 1)) return false;
    const z1 = this.zoneMap[this.idx(x, y)];
    const z2 = this.zoneMap[this.idx(x, y + 1)];
    // Trees go in forest, open, or yard — not on paths, buildings, water
    return (z1 === 'forest' || z1 === 'open' || z1 === 'yard') &&
           (z2 === 'forest' || z2 === 'open' || z2 === 'yard');
  }

  /**
   * Can a decoration be placed at (x, y)?
   */
  canPlaceDecoration(x, y) {
    if (!this.inBounds(x, y)) return false;
    const zone = this.zoneMap[this.idx(x, y)];
    // Decorations go in yards, near paths, or open space — not in forest or water
    return zone === 'yard' || zone === 'open' || zone === 'square';
  }

  /**
   * Should a fence be placed at (x, y)?
   * Fences go below buildings to define yard boundaries.
   */
  shouldPlaceFence(x, y) {
    if (!this.inBounds(x, y)) return false;
    // Check if there's a building above (within 2 rows)
    for (let dy = -2; dy <= 0; dy++) {
      if (this.inBounds(x, y + dy) && this.zoneMap[this.idx(x, y + dy)] === 'building') return true;
    }
    return false;
  }

  /**
   * Get the zone type at (x, y)
   */
  getZone(x, y) {
    if (!this.inBounds(x, y)) return 'out-of-bounds';
    return this.zoneMap[this.idx(x, y)];
  }

  /**
   * Get planned building positions
   */
  getPlannedBuildings() {
    return this.buildings;
  }

  /**
   * Check if (x,y) is near a path (within distance tiles)
   */
  isNearPath(x, y, distance) {
    distance = distance || 3;
    for (let dy = -distance; dy <= distance; dy++) {
      for (let dx = -distance; dx <= distance; dx++) {
        if (this.inBounds(x + dx, y + dy) && this.pathCells.has(this.idx(x + dx, y + dy))) return true;
      }
    }
    return false;
  }

  /**
   * Get the nearest path cell to (x, y)
   * Returns { x, y, distance } or null
   */
  nearestPath(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const pi of this.pathCells) {
      const px = pi % this.W;
      const py = Math.floor(pi / this.W);
      const dist = Math.abs(px - x) + Math.abs(py - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: px, y: py, distance: dist };
      }
    }
    return best;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PROPORTION RULES — ensure good village balance
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Get zone distribution percentages
   */
  getProportions() {
    const counts = {};
    for (const z of this.zoneMap) {
      counts[z] = (counts[z] || 0) + 1;
    }
    const total = this.W * this.H;
    const pcts = {};
    for (const [z, c] of Object.entries(counts)) {
      pcts[z] = (c / total * 100).toFixed(1) + '%';
    }
    return pcts;
  }

  /**
   * Validate proportions against ideal village layout
   * Returns { valid: boolean, issues: string[] }
   */
  validateProportions() {
    const total = this.W * this.H;
    const counts = {};
    for (const z of this.zoneMap) counts[z] = (counts[z] || 0) + 1;

    const issues = [];
    const pathPct = (counts.path || 0) / total;
    const buildPct = ((counts.building || 0) + (counts.yard || 0)) / total;
    const forestPct = (counts.forest || 0) / total;
    const openPct = (counts.open || 0) / total;

    // Ideal: 10-20% paths, 15-30% buildings+yards, 15-30% forest, 30-50% open
    if (pathPct < 0.05) issues.push('Not enough paths (' + (pathPct * 100).toFixed(1) + '%, need 5-20%)');
    if (pathPct > 0.25) issues.push('Too many paths (' + (pathPct * 100).toFixed(1) + '%, max 25%)');
    if (buildPct < 0.05) issues.push('Not enough buildings (' + (buildPct * 100).toFixed(1) + '%, need 5-30%)');
    if (forestPct < 0.10) issues.push('Not enough forest border (' + (forestPct * 100).toFixed(1) + '%, need 10-30%)');
    if (openPct > 0.60) issues.push('Too much empty space (' + (openPct * 100).toFixed(1) + '%, max 60%)');

    return { valid: issues.length === 0, issues };
  }

  /**
   * Debug: print zone map as ASCII
   */
  printZoneMap() {
    const chars = { open: '.', path: '#', building: 'B', yard: 'y', forest: 'T', water: '~', square: 'S', 'out-of-bounds': 'X' };
    for (let y = 0; y < this.H; y += 2) { // skip every other row for compact view
      let row = '';
      for (let x = 0; x < this.W; x++) {
        row += chars[this.zoneMap[this.idx(x, y)]] || '?';
      }
      console.log('  ' + row);
    }
  }
}

module.exports = { SpatialGrammar };

// ── Self-test ───────────────────────────────────────────────────────────
if (require.main === module) {
  const grammar = new SpatialGrammar(60, 40);
  const dna = {
    buildingCount: 4, buildingMinSpacing: 10, buildingYBand: [0.15, 0.7],
    pathStyle: 'cross', pathCenterX: 0.5, pathCenterY: 0.5,
    treeBorderDepth: 3, squareEnabled: true, squareSize: [6, 4], squarePosition: [0.5, 0.5],
    waterEnabled: true, waterSize: [4, 3], waterPosition: [0.7, 0.5]
  };

  grammar.planZones(dna);

  console.log('Zone proportions:', grammar.getProportions());
  console.log('Validation:', grammar.validateProportions());
  console.log('Planned buildings:', grammar.buildings.length);
  grammar.buildings.forEach(b => console.log('  Building at', b.x, b.y, b.w + 'x' + b.h));
  console.log('\nZone map:');
  grammar.printZoneMap();
}
