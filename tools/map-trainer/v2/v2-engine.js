/**
 * v2-engine.js — V2 Map Generator Engine
 *
 * Consolidates spatial grammar, WFC, composite stamping, and adjacency validation
 * into a single coherent pipeline. Replaces 19 separate files from V1.
 *
 * Pipeline: Zone Planning → Ground Fill → Buildings → Trees → Decorations → Collision
 */

const fs = require('fs');
const path = require('path');

// ── Tile Constants ──────────────────────────────────────────────────────────
const T = {
  EMPTY: -1, GRASS: 1, GRASS_FLOWERS: 2, GRASS_WHITE: 43,
  PATH_EDGE: 39, PATH_CENTER: 40, PATH_EDGE_R: 41,
  COBBLE_A: 44, COBBLE_B: 45,
  ROOF_L: 63, ROOF_M: 64, ROOF_R: 65, CHIMNEY: 67,
  WOOD_L: 72, WOOD_PLAIN: 73, WOOD_DOOR: 74, WOOD_WINDOW: 75,
  STONE_L: 84, STONE_PLAIN: 85, STONE_DOOR: 86, STONE_WINDOW: 87,
  FENCE_L: 96, FENCE_M: 97, FENCE_R: 98,
  GREEN_CANOPY_L: 4, GREEN_CANOPY_R: 5, GREEN_TRUNK_L: 12, GREEN_TRUNK_R: 13,
  AUTUMN_CANOPY_L: 7, AUTUMN_CANOPY_R: 8, AUTUMN_TRUNK_L: 24, AUTUMN_TRUNK_R: 25,
  PINE_TOP: 10, PINE_TRUNK: 22, DENSE_TOP: 11, DENSE_TRUNK: 23,
  SMALL_TREE: 6, SMALL_AUTUMN: 9, SMALL_COMPLETE: 16, SMALL_FRUIT: 17,
  BUSH: 28, BERRY: 29, TULIP: 15, FERN: 18, FLOWER_BUSH: 19,
  WELL_TOP: 92, WELL_BASE: 104, LANTERN: 93, BARREL: 107,
  WATER_NW: 109, WATER_N: 110, WATER_NE: 111,
  WATER_W: 121, WATER_CENTER: 122, WATER_E: 123,
  WATER_SW: 120, WATER_S: 112, WATER_SE: 113,
};

// ── Building Templates ──────────────────────────────────────────────────────
const BUILDINGS = {
  small_house:  { w: 3, roof: [T.ROOF_L, T.CHIMNEY, T.ROOF_R],       wall: [T.WOOD_L, T.WOOD_DOOR, T.WOOD_PLAIN] },
  medium_house: { w: 4, roof: [T.ROOF_L, T.ROOF_M, T.CHIMNEY, T.ROOF_R], wall: [T.WOOD_L, T.WOOD_WINDOW, T.WOOD_DOOR, T.WOOD_PLAIN] },
  large_house:  { w: 5, roof: [T.ROOF_L, T.ROOF_M, T.ROOF_M, T.ROOF_M, T.ROOF_R], wall: [T.WOOD_L, T.WOOD_WINDOW, T.WOOD_DOOR, T.WOOD_WINDOW, T.WOOD_PLAIN] },
  stone_shop:   { w: 3, roof: [T.ROOF_L, T.CHIMNEY, T.ROOF_R],       wall: [T.STONE_L, T.STONE_DOOR, T.STONE_PLAIN] },
};
const BUILDING_KEYS = Object.keys(BUILDINGS);

// ── Tree Pairs (canopyL, canopyR, trunkL, trunkR) ──────────────────────────
const TREE_TYPES = [
  { canopy: [T.GREEN_CANOPY_L, T.GREEN_CANOPY_R], trunk: [T.GREEN_TRUNK_L, T.GREEN_TRUNK_R], name: 'green' },
  { canopy: [T.AUTUMN_CANOPY_L, T.AUTUMN_CANOPY_R], trunk: [T.AUTUMN_TRUNK_L, T.AUTUMN_TRUNK_R], name: 'autumn' },
  { canopy: [T.PINE_TOP, T.PINE_TOP], trunk: [T.PINE_TRUNK, T.PINE_TRUNK], name: 'pine', single: true },
];

// ── Value Noise ─────────────────────────────────────────────────────────────
function valueNoise(x, y, scale) {
  const ix = Math.floor(x / scale), iy = Math.floor(y / scale);
  const fx = (x / scale) - ix, fy = (y / scale) - iy;
  const s = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hash = (a, b) => {
    let h = (a * 374761393 + b * 668265263 + 1013904223) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h & 0x7fffffff) / 0x7fffffff;
  };
  return lerp(
    lerp(hash(ix, iy), hash(ix + 1, iy), s(fx)),
    lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), s(fx)),
    s(fy)
  );
}

// ── Seeded random ───────────────────────────────────────────────────────────
function makeRng(seed) {
  let s = seed | 0 || (Date.now() ^ 0xDEADBEEF);
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// ── Distance helper ─────────────────────────────────────────────────────────
function dist(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2); // Manhattan
}

class V2Engine {
  constructor(opts = {}) {
    this.W = opts.width || 60;
    this.H = opts.height || 40;
    this.size = this.W * this.H;
    this.knowledge = null;

    if (opts.knowledgePath && fs.existsSync(opts.knowledgePath)) {
      this.knowledge = JSON.parse(fs.readFileSync(opts.knowledgePath, 'utf8'));
    }
  }

  idx(x, y) { return y * this.W + x; }
  inBounds(x, y) { return x >= 0 && x < this.W && y >= 0 && y < this.H; }

  /**
   * Generate a map from DNA parameters.
   * @param {Object} dna - Generation parameters
   * @param {number} [seed] - Optional RNG seed for reproducibility
   * @returns {{ width, height, ground: number[], objects: number[], foreground: number[], collision: number[] }}
   */
  generate(dna = {}, seed) {
    const d = Object.assign({
      buildingCount: 4, buildingSpacing: 10, pathStyle: 'cross',
      pathCenter: [0.5, 0.5], treeBorderDepth: 3, treeDensity: 0.6,
      treeInteriorClusters: 4, grassMix: [0.6, 0.3, 0.1],
      waterEnabled: true, waterPosition: [0.7, 0.5], waterSize: [4, 3],
      squareSize: [6, 4], decoPerBuilding: 3, wellEnabled: true,
    }, dna);

    const rng = makeRng(seed || (Math.random() * 0x7fffffff));
    const ground = new Array(this.size).fill(T.EMPTY);
    const objects = new Array(this.size).fill(T.EMPTY);
    const foreground = new Array(this.size).fill(T.EMPTY);
    const collision = new Array(this.size).fill(0);

    // Zone map tracks purpose of each cell
    const zones = new Array(this.size).fill('open');

    // ── Step 1: Zone Planning ───────────────────────────────────────────
    this._planForestBorder(zones, d.treeBorderDepth);
    const pathCells = this._planPaths(zones, d.pathStyle, d.pathCenter);
    const squareRect = this._planSquare(zones, d.pathCenter, d.squareSize);
    const buildingPositions = this._planBuildings(zones, pathCells, d.buildingCount, d.buildingSpacing, rng);
    this._planYards(zones, buildingPositions);
    let waterRect = null;
    if (d.waterEnabled) {
      waterRect = this._planWater(zones, d.waterPosition, d.waterSize);
    }

    // ── Step 2: Fill Ground Layer ───────────────────────────────────────
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const i = this.idx(x, y);
        const zone = zones[i];
        if (zone === 'path') {
          ground[i] = this._pathTile(x, y, zones);
        } else if (zone === 'square') {
          ground[i] = ((x + y) % 2 === 0) ? T.COBBLE_A : T.COBBLE_B;
        } else {
          // Grass with value noise for organic variation (multi-octave for variety)
          const n1 = valueNoise(x, y, 4);   // large patches
          const n2 = valueNoise(x + 100, y + 100, 2); // fine detail
          const n = n1 * 0.6 + n2 * 0.4;    // blend octaves
          const [pPlain, pFlower] = d.grassMix;
          if (n < pPlain) ground[i] = T.GRASS;
          else if (n < pPlain + pFlower) ground[i] = T.GRASS_FLOWERS;
          else ground[i] = T.GRASS_WHITE;
        }
      }
    }

    // ── Step 3: Place Buildings ─────────────────────────────────────────
    const placedBuildings = [];
    for (const pos of buildingPositions) {
      const bType = BUILDING_KEYS[Math.floor(rng() * BUILDING_KEYS.length)];
      const b = BUILDINGS[bType];
      const bx = pos.x, by = pos.y;

      // Roof row (objects layer)
      for (let dx = 0; dx < b.w; dx++) {
        if (this.inBounds(bx + dx, by)) {
          objects[this.idx(bx + dx, by)] = b.roof[dx];
          collision[this.idx(bx + dx, by)] = 1;
        }
      }
      // Wall row (objects layer)
      for (let dx = 0; dx < b.w; dx++) {
        if (this.inBounds(bx + dx, by + 1)) {
          objects[this.idx(bx + dx, by + 1)] = b.wall[dx];
          const tile = b.wall[dx];
          collision[this.idx(bx + dx, by + 1)] = (tile === T.WOOD_DOOR || tile === T.STONE_DOOR) ? 0 : 1;
        }
      }

      // Find door x position
      let doorX = bx;
      for (let dx = 0; dx < b.w; dx++) {
        if (b.wall[dx] === T.WOOD_DOOR || b.wall[dx] === T.STONE_DOOR) { doorX = bx + dx; break; }
      }

      // Fence below building (row by+2)
      const fenceY = by + 2;
      if (this.inBounds(bx - 1, fenceY) && this.inBounds(bx + b.w, fenceY)) {
        const fenceLeft = bx - 1;
        const fenceRight = bx + b.w;
        for (let fx = fenceLeft; fx <= fenceRight; fx++) {
          if (!this.inBounds(fx, fenceY)) continue;
          const fi = this.idx(fx, fenceY);
          if (fx === fenceLeft) { objects[fi] = T.FENCE_L; collision[fi] = 1; }
          else if (fx === fenceRight) { objects[fi] = T.FENCE_R; collision[fi] = 1; }
          else if (fx === doorX) { /* gate opening — leave empty */ }
          else { objects[fi] = T.FENCE_M; collision[fi] = 1; }
        }
      }

      // Connect door to nearest path with 2-wide branch
      this._connectToPath(ground, zones, doorX, by + 2, pathCells);

      placedBuildings.push({ x: bx, y: by, w: b.w, h: 2, doorX, type: bType });
    }

    // ── Step 4: Place Trees ─────────────────────────────────────────────
    this._placeTrees(zones, objects, foreground, collision, d, rng);

    // ── Step 5: Place Decorations ───────────────────────────────────────
    this._placeDecorations(objects, zones, placedBuildings, squareRect, d, rng);

    // Water pond with 9-tile edges
    if (waterRect) {
      this._placeWater(objects, collision, waterRect);
    }

    // ── Step 6: Finalize Collision ──────────────────────────────────────
    // Water and tree trunks already marked. Ensure ground-only cells are walkable.
    for (let i = 0; i < this.size; i++) {
      if (collision[i] !== 1 && objects[i] === T.EMPTY && foreground[i] === T.EMPTY) {
        collision[i] = 0;
      }
    }

    return { width: this.W, height: this.H, ground, objects, foreground, collision };
  }

  /**
   * Generate multiple map variations from the same DNA.
   * @param {Object} dna
   * @param {number} count
   * @returns {Array}
   */
  generateBatch(dna, count = 5) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(this.generate(dna, (Date.now() + i * 7919)));
    }
    return results;
  }

  // ── Zone Planning ───────────────────────────────────────────────────────

  _planForestBorder(zones, depth) {
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const borderDist = Math.min(x, y, this.W - 1 - x, this.H - 1 - y);
        if (borderDist < depth) zones[this.idx(x, y)] = 'forest';
      }
    }
  }

  _planPaths(zones, style, center) {
    const cx = Math.floor(center[0] * this.W);
    const cy = Math.floor(center[1] * this.H);
    const cells = new Set();

    const markPath = (x, y) => {
      if (this.inBounds(x, y)) {
        zones[this.idx(x, y)] = 'path';
        cells.add(`${x},${y}`);
      }
    };
    // 2-wide paths
    const markPath2 = (x, y, horiz) => {
      markPath(x, y);
      if (horiz) markPath(x, y + 1);
      else markPath(x + 1, y);
    };

    const margin = 5;
    if (style === 'cross' || style === 'organic') {
      // Horizontal path through center
      for (let x = margin; x < this.W - margin; x++) { markPath2(x, cy, true); }
      // Vertical path through center
      for (let y = margin; y < this.H - margin; y++) { markPath2(cx, y, false); }
    }
    if (style === 'L-shape') {
      for (let x = margin; x < cx + 1; x++) { markPath2(x, cy, true); }
      for (let y = cy; y < this.H - margin; y++) { markPath2(cx, y, false); }
    }
    if (style === 'loop') {
      const lx = Math.floor(this.W * 0.25), rx = Math.floor(this.W * 0.75);
      const ty = Math.floor(this.H * 0.3), by = Math.floor(this.H * 0.7);
      for (let x = lx; x <= rx; x++) { markPath2(x, ty, true); markPath2(x, by, true); }
      for (let y = ty; y <= by; y++) { markPath2(lx, y, false); markPath2(rx, y, false); }
    }
    return cells;
  }

  _planSquare(zones, center, size) {
    const cx = Math.floor(center[0] * this.W);
    const cy = Math.floor(center[1] * this.H);
    const hw = Math.floor(size[0] / 2), hh = Math.floor(size[1] / 2);
    const rect = { x: cx - hw, y: cy - hh, w: size[0], h: size[1] };
    for (let dy = 0; dy < rect.h; dy++) {
      for (let dx = 0; dx < rect.w; dx++) {
        const x = rect.x + dx, y = rect.y + dy;
        if (this.inBounds(x, y)) zones[this.idx(x, y)] = 'square';
      }
    }
    return rect;
  }

  _planBuildings(zones, pathCells, count, spacing, rng) {
    const positions = [];
    const pathList = [];
    for (const key of pathCells) {
      const [px, py] = key.split(',').map(Number);
      pathList.push({ x: px, y: py });
    }

    let attempts = 0;
    while (positions.length < count && attempts < 500) {
      attempts++;
      // Pick a random path cell and offset from it
      if (pathList.length === 0) break;
      const base = pathList[Math.floor(rng() * pathList.length)];
      const offsetX = Math.floor(rng() * 10) - 5;
      const offsetY = (rng() < 0.5 ? -1 : 1) * (3 + Math.floor(rng() * 4));
      const bx = base.x + offsetX;
      const by = base.y + offsetY;

      // Check bounds (need 5xN clearance)
      if (bx < 5 || bx + 5 >= this.W - 5 || by < 5 || by + 3 >= this.H - 5) continue;

      // Check spacing from other buildings
      let tooClose = false;
      for (const p of positions) {
        if (dist(bx, by, p.x, p.y) < spacing) { tooClose = true; break; }
      }
      if (tooClose) continue;

      // Check zone isn't already occupied
      let blocked = false;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          const z = zones[this.idx(bx + dx, by + dy)];
          if (z === 'path' || z === 'water' || z === 'building') { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (blocked) continue;

      // Mark zone
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          if (this.inBounds(bx + dx, by + dy)) zones[this.idx(bx + dx, by + dy)] = 'building';
        }
      }
      positions.push({ x: bx, y: by });
    }
    return positions;
  }

  _planYards(zones, buildingPositions) {
    for (const pos of buildingPositions) {
      for (let dy = -2; dy <= 4; dy++) {
        for (let dx = -2; dx <= 7; dx++) {
          const x = pos.x + dx, y = pos.y + dy;
          if (this.inBounds(x, y)) {
            const i = this.idx(x, y);
            if (zones[i] === 'open') zones[i] = 'yard';
          }
        }
      }
    }
  }

  _planWater(zones, position, size) {
    const wx = Math.floor(position[0] * this.W);
    const wy = Math.floor(position[1] * this.H);
    const ww = size[0] + 2; // +2 for edges
    const wh = size[1] + 2;
    const rect = { x: wx, y: wy, w: ww, h: wh };
    for (let dy = 0; dy < wh; dy++) {
      for (let dx = 0; dx < ww; dx++) {
        const x = rect.x + dx, y = rect.y + dy;
        if (this.inBounds(x, y)) zones[this.idx(x, y)] = 'water';
      }
    }
    return rect;
  }

  // ── Tile Placement Helpers ────────────────────────────────────────────

  _pathTile(x, y, zones) {
    // Determine if this is a left edge, center, or right edge of a horizontal path
    const leftIsPath = this.inBounds(x - 1, y) && zones[this.idx(x - 1, y)] === 'path';
    const rightIsPath = this.inBounds(x + 1, y) && zones[this.idx(x + 1, y)] === 'path';
    if (!leftIsPath && rightIsPath) return T.PATH_EDGE;
    if (leftIsPath && !rightIsPath) return T.PATH_EDGE_R;
    return T.PATH_CENTER;
  }

  _connectToPath(ground, zones, doorX, startY, pathCells) {
    // Walk down from door until we hit a path cell, placing 2-wide path tiles
    for (let y = startY + 1; y < this.H - 2; y++) {
      const key = `${doorX},${y}`;
      if (pathCells.has(key) || pathCells.has(`${doorX + 1},${y}`)) break;
      for (let dx = 0; dx < 2; dx++) {
        const x = doorX + dx;
        if (this.inBounds(x, y)) {
          const i = this.idx(x, y);
          zones[i] = 'path';
          ground[i] = dx === 0 ? T.PATH_EDGE : T.PATH_EDGE_R;
          pathCells.add(`${x},${y}`);
        }
      }
    }
  }

  _placeTrees(zones, objects, foreground, collision, dna, rng) {
    for (let y = 0; y < this.H - 1; y++) {
      for (let x = 0; x < this.W - 1; x++) {
        const zone = zones[this.idx(x, y)];
        if (zone === 'forest') {
          // Staggered placement in forest border
          if ((x + y) % 2 !== 0) continue;
          if (rng() > dna.treeDensity) continue;
          this._stampTree(x, y, objects, foreground, collision, rng);
        }
      }
    }

    // Interior tree clusters
    for (let c = 0; c < dna.treeInteriorClusters; c++) {
      const cx = 8 + Math.floor(rng() * (this.W - 16));
      const cy = 8 + Math.floor(rng() * (this.H - 16));
      const clusterSize = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < clusterSize; i++) {
        const tx = cx + Math.floor(rng() * 6) - 3;
        const ty = cy + Math.floor(rng() * 4) - 2;
        if (!this.inBounds(tx + 1, ty + 1)) continue;
        const zone = zones[this.idx(tx, ty)];
        if (zone === 'building' || zone === 'path' || zone === 'water' || zone === 'square') continue;
        if (objects[this.idx(tx, ty)] !== T.EMPTY) continue;
        this._stampTree(tx, ty, objects, foreground, collision, rng);
      }
    }
  }

  _stampTree(x, y, objects, foreground, collision, rng) {
    const type = TREE_TYPES[Math.floor(rng() * TREE_TYPES.length)];
    if (type.single) {
      // Pine: 1-wide
      if (this.inBounds(x, y)) { foreground[this.idx(x, y)] = type.canopy[0]; }
      if (this.inBounds(x, y + 1)) { objects[this.idx(x, y + 1)] = type.trunk[0]; collision[this.idx(x, y + 1)] = 1; }
    } else {
      // 2-wide tree: canopy on foreground, trunk on objects
      if (this.inBounds(x, y)) foreground[this.idx(x, y)] = type.canopy[0];
      if (this.inBounds(x + 1, y)) foreground[this.idx(x + 1, y)] = type.canopy[1];
      if (this.inBounds(x, y + 1)) { objects[this.idx(x, y + 1)] = type.trunk[0]; collision[this.idx(x, y + 1)] = 1; }
      if (this.inBounds(x + 1, y + 1)) { objects[this.idx(x + 1, y + 1)] = type.trunk[1]; collision[this.idx(x + 1, y + 1)] = 1; }
    }
  }

  _placeDecorations(objects, zones, buildings, squareRect, dna, rng) {
    const DECOS = [T.TULIP, T.FERN, T.FLOWER_BUSH, T.BUSH, T.BERRY, T.BARREL, T.LANTERN];

    // Decorations near buildings (in yard zones)
    for (const b of buildings) {
      let placed = 0;
      let attempts = 0;
      while (placed < dna.decoPerBuilding && attempts < 30) {
        attempts++;
        const dx = Math.floor(rng() * (b.w + 4)) - 2;
        const dy = Math.floor(rng() * 5) - 1;
        const x = b.x + dx, y = b.y + dy;
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        if (objects[i] !== T.EMPTY) continue;
        if (zones[i] !== 'yard' && zones[i] !== 'open') continue;
        objects[i] = DECOS[Math.floor(rng() * DECOS.length)];
        placed++;
      }
    }

    // Well at village center
    if (dna.wellEnabled && squareRect) {
      const wx = squareRect.x + Math.floor(squareRect.w / 2);
      const wy = squareRect.y + Math.floor(squareRect.h / 2);
      if (this.inBounds(wx, wy) && this.inBounds(wx, wy + 1)) {
        objects[this.idx(wx, wy)] = T.WELL_TOP;
        objects[this.idx(wx, wy + 1)] = T.WELL_BASE;
      }
    }
  }

  _placeWater(objects, collision, rect) {
    // 9-tile edge system: top row, middle rows, bottom row
    const { x, y, w, h } = rect;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx, py = y + dy;
        if (!this.inBounds(px, py)) continue;
        const i = this.idx(px, py);
        let tile = T.WATER_CENTER;
        if (dy === 0) {
          if (dx === 0) tile = T.WATER_NW;
          else if (dx === w - 1) tile = T.WATER_NE;
          else tile = T.WATER_N;
        } else if (dy === h - 1) {
          if (dx === 0) tile = T.WATER_SW;
          else if (dx === w - 1) tile = T.WATER_SE;
          else tile = T.WATER_S;
        } else {
          if (dx === 0) tile = T.WATER_W;
          else if (dx === w - 1) tile = T.WATER_E;
          else tile = T.WATER_CENTER;
        }
        objects[i] = tile;
        collision[i] = 1;
      }
    }
  }
}

// ── Self-test ────────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('=== V2 Engine Self-Test ===\n');
  const engine = new V2Engine({ width: 60, height: 40 });
  const t0 = Date.now();
  const map = engine.generate({}, 42);
  console.log(`Generated ${map.width}x${map.height} in ${Date.now() - t0}ms`);
  const TILE_SETS = { grass: new Set([1,2,43]), path: new Set([39,40,41]), cobble: new Set([44,45]),
    building: new Set([63,64,65,67,72,73,74,75,84,85,86,87]), tree: new Set([12,13,22,23,24,25]),
    water: new Set([109,110,111,112,113,120,121,122,123]) };
  const c = {};
  for (const [name, set] of Object.entries(TILE_SETS)) {
    c[name] = map.ground.filter(t => set.has(t)).length + map.objects.filter(t => set.has(t)).length;
  }
  console.log('Tile counts:', c);
  const blocked = map.collision.filter(v => v === 1).length;
  console.log(`Collision: ${blocked}/${map.collision.length} blocked`);
  const batch = engine.generateBatch({}, 3);
  console.log(`Batch: ${batch.length} maps, unique: ${batch[0].ground.join('') !== batch[1].ground.join('')}`);
  const err = [];
  if (c.grass < 1000) err.push('grass'); if (c.path < 50) err.push('path');
  if (c.building < 4) err.push('building'); if (c.tree < 10) err.push('tree');
  if (err.length) { console.log('FAILED:', err); process.exit(1); }
  console.log('\nAll self-tests PASSED');
}

module.exports = { V2Engine, T, BUILDINGS, TREE_TYPES, valueNoise };
