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

// ── Layer Assignments: which layer each tile belongs on ─────────────────────
// 'g' = ground (always filled), 'o' = objects, 'f' = foreground
const TILE_LAYER = {};
// Ground tiles: grass, paths, cobblestone, water edges
[T.GRASS, T.GRASS_FLOWERS, T.GRASS_WHITE, T.PATH_EDGE, T.PATH_CENTER, T.PATH_EDGE_R, T.COBBLE_A, T.COBBLE_B].forEach(t => TILE_LAYER[t] = 'g');
// Foreground tiles: tree canopies (drawn OVER the player)
[T.GREEN_CANOPY_L, T.GREEN_CANOPY_R, T.AUTUMN_CANOPY_L, T.AUTUMN_CANOPY_R, T.PINE_TOP, T.DENSE_TOP].forEach(t => TILE_LAYER[t] = 'f');
// Everything else is objects layer
[T.ROOF_L, T.ROOF_M, T.ROOF_R, T.CHIMNEY,
 T.WOOD_L, T.WOOD_PLAIN, T.WOOD_DOOR, T.WOOD_WINDOW,
 T.STONE_L, T.STONE_PLAIN, T.STONE_DOOR, T.STONE_WINDOW,
 T.FENCE_L, T.FENCE_M, T.FENCE_R,
 T.GREEN_TRUNK_L, T.GREEN_TRUNK_R, T.AUTUMN_TRUNK_L, T.AUTUMN_TRUNK_R,
 T.PINE_TRUNK, T.DENSE_TRUNK,
 T.SMALL_TREE, T.SMALL_AUTUMN, T.SMALL_COMPLETE, T.SMALL_FRUIT,
 T.BUSH, T.BERRY, T.TULIP, T.FERN, T.FLOWER_BUSH,
 T.WELL_TOP, T.WELL_BASE, T.LANTERN, T.BARREL,
 T.WATER_NW, T.WATER_N, T.WATER_NE, T.WATER_W, T.WATER_CENTER, T.WATER_E,
 T.WATER_SW, T.WATER_S, T.WATER_SE].forEach(t => TILE_LAYER[t] = 'o');

// ── Building Material System ─────────────────────────────────────────────────
// Buildings are composed of material sets. Each set has L-M-R tiles for each layer.
// The middle tile can repeat to make wider buildings. Layers stack vertically.
// This allows generating buildings of ANY size from a small set of materials.
// ── Building Materials — derived from user's ACTUAL painted map ──────────────
// The painted map is the ground truth. Catalog names are often wrong.
// User's buildings mix roof colors with different wall types — this is intentional.
//
// From painted map analysis:
//   Building style A: roof=48,49,50 mid=60,62,63 base=72,85,75 (stone roof + brick mid + wood base)
//   Building style B: roof=52,53,54 mid=64,65,66 base=76,88,79 (blue roof + red mid + gray base)
//   Gatehouse: mixed with 44,45,56,68,80,82,84,94 (stone arch + fences + dark archway door)
//   Door tile: 80 (Dark Archway Opening) — THE actual door in this tileset
//
const MATERIALS = {
  style_a: {
    // Stone-topped house with brick detail and wood walls (buildings 2,3 in painted map)
    roof:  { L: 48, M: 49, R: 50 },   // stone wall row (looks like flat stone roof)
    mid:   { L: 60, M: 63, R: 62 },   // brick L + red roof L + brick R (overhang detail)
    base:  { L: 72, M: 85, R: 75 },   // wood L + dark stone center + wood window
    door:  80,                          // Dark Archway Opening (the REAL door)
  },
  style_b: {
    // Blue-roofed house with colored mid and gray walls (building 1 in painted map)
    roof:  { L: 52, M: 53, R: 54 },   // blue roof L/M/R
    mid:   { L: 64, M: 65, R: 66 },   // red roof tiles as wall detail
    base:  { L: 76, M: 85, R: 79 },   // gray panels (85=dark stone center, not 88=interior fill)
    door:  80,
  },
  style_c: {
    // Red-roofed house with stone walls
    roof:  { L: 63, M: 64, R: 65 },   // red roof L/M/R
    mid:   { L: 60, M: 61, R: 62 },   // brick mid
    base:  { L: 84, M: 85, R: 75 },   // dark stone + wood window
    door:  80,
  },
  castle: {
    // Castle from painted map (tiles 96,98,102,111,112,120,122,123,124)
    roof:  { L: 96, M: 96, R: 98 },
    mid:   { L: 120, M: 120, R: 122 },
    base:  { L: 123, M: 123, R: 124 },
    gate:  { L: 111, R: 112 },
    tower: 102,
    door:  -1,
  },
};
const MATERIAL_KEYS = ['style_a', 'style_b', 'style_c']; // house materials

// ── Procedural Building Generators ──────────────────────────────────────────
// Every building is uniquely generated from rules. Painted templates are
// training data only — they teach the material system, never get copied.

// Generate a house: roof on top, mid detail above door only, base with door
function generateHouse(rng) {
  const mat = MATERIALS[MATERIAL_KEYS[Math.floor(rng() * MATERIAL_KEYS.length)]];
  const w = 2 + Math.floor(rng() * 5);   // 2-6 wide (min 2 per user rule)
  const rows = [];

  const makeRow = (lmr) => {
    if (w === 2) return [lmr.L, lmr.R];
    const row = [lmr.L];
    for (let i = 0; i < w - 2; i++) row.push(lmr.M);
    row.push(lmr.R);
    return row;
  };

  // Pick door position (center-ish)
  const doorX = w === 2 ? Math.floor(rng() * 2) : Math.min(1 + Math.floor(rng() * (w - 2)), w - 1);

  // Roof row
  rows.push(makeRow(mat.roof));

  // Mid row — pitched roof detail ONLY above the door column
  // Always include at least 1 mid row (minimum 3 tall: roof + mid + base)
  const midRow = makeRow(mat.base); // default to base wall tiles
  // Place mid L-M-R overhang centered on door position
  if (w >= 3) {
    const overhangStart = Math.max(0, doorX - 1);
    const overhangEnd = Math.min(w - 1, doorX + 1);
    midRow[overhangStart] = mat.mid.L;
    midRow[doorX] = mat.mid.M;
    midRow[overhangEnd] = mat.mid.R;
  } else {
    // 2-wide: just use mid tiles
    midRow[0] = mat.mid.L;
    midRow[w - 1] = mat.mid.R;
  }
  rows.push(midRow);

  // Extra wall rows for taller buildings (0-1 additional)
  const extraWalls = 1 + Math.floor(rng() * 2); // 1-2 extra wall rows for taller buildings
  for (let i = 0; i < extraWalls; i++) rows.push(makeRow(mat.base));

  // Base row — door placement controlled by caller via wantDoor parameter
  const baseRow = makeRow(mat.base);
  rows.push(baseRow);

  // Return building with doorX info so caller can optionally add door
  return { w, h: rows.length, rows, doorX, doorTile: mat.door, tileCount: rows.flat().filter(t => t >= 0).length };
}

// Generate a castle: thick solid walls with towers and gate
// Modeled after user's painted castle: tower caps on corners, solid wall fill between,
// gate centered at bottom. Every cell is filled — no thin outlines.
function generateCastle(rng) {
  const mat = MATERIALS.castle;
  const hasTowers = rng() < 0.7;
  const wallsPerSide = 1 + Math.floor(rng() * 2); // 1-2 wall columns per side
  const totalH = 3 + Math.floor(rng() * 2);        // 3-4 tall minimum (thick!)

  // Width: tower(1) + walls + gate(2) + walls + tower(1)
  const sideW = hasTowers ? 1 + wallsPerSide : wallsPerSide;
  const totalW = Math.max(4, sideW + 2 + sideW); // min 4 wide
  const gateCol1 = sideW;
  const gateCol2 = sideW + 1;
  const rows = [];

  for (let dy = 0; dy < totalH; dy++) {
    const row = [];
    for (let dx = 0; dx < totalW; dx++) {
      const isLeftTower = hasTowers && dx === 0;
      const isRightTower = hasTowers && dx === totalW - 1;
      const isGate = dx === gateCol1 || dx === gateCol2;
      const isLeft = dx < gateCol1;
      const isRight = dx > gateCol2;

      if (isLeftTower || isRightTower) {
        // Tower column: cap on top, wall fill below
        if (dy === 0) row.push(mat.tower);
        else if (dy < totalH - 1) row.push(isLeftTower ? mat.mid.L : mat.mid.R);
        else row.push(isLeftTower ? mat.base.L : mat.base.R);
      } else if (isGate) {
        // Gate column: wall on top rows, gate near bottom, base at very bottom
        const gateL = dx === gateCol1;
        if (dy < totalH - 2) {
          // Solid wall above gate
          row.push(gateL ? mat.roof.L : mat.roof.R);
        } else if (dy === totalH - 2) {
          // Gate opening
          row.push(gateL ? mat.gate.L : mat.gate.R);
        } else {
          // Base
          row.push(gateL ? mat.base.L : mat.base.R);
        }
      } else {
        // Regular wall: solid fill throughout
        const wallSide = isLeft ? mat.roof.L : mat.roof.R;
        const wallMid = isLeft ? mat.mid.L : mat.mid.R;
        const wallBase = isLeft ? mat.base.L : mat.base.R;
        if (dy === 0) row.push(wallSide);
        else if (dy < totalH - 1) row.push(wallMid);
        else row.push(wallBase);
      }
    }
    rows.push(row);
  }

  return { w: totalW, h: totalH, rows, tileCount: rows.flat().filter(t => t >= 0).length };
}

// Generate a fence: L-M-R rail pattern, variable length
// Fences do NOT have doors — they're just walls/barriers
function generateFence(rng, width) {
  const fenceMat = rng() < 0.5 ? MATERIALS.fence_white : MATERIALS.fence_wood;
  const w = width || (3 + Math.floor(rng() * 6)); // 3-8 wide
  const row = [];

  // Proper L-M-R pattern: left end, middles, right end
  for (let i = 0; i < w; i++) {
    if (i === 0) row.push(fenceMat.rail.L);
    else if (i === w - 1) row.push(fenceMat.rail.R);
    else row.push(fenceMat.rail.M);
  }
  return { w, h: 1, rows: [row], tileCount: w, isFence: true };
}

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
   * Load painted map as template base.
   * @param {Object} painted - { width, height, ground[], objects[], foreground[] }
   */
  setPaintedTemplate(painted) {
    this._painted = painted;
    // Extract building structures from painted map
    this._paintedBuildings = [];
    this._paintedForeground = []; // {x, y, tile}
    const W = painted.width, H = painted.height;

    // Find connected object structures
    const visited = new Set();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const key = x + ',' + y;
        if (visited.has(key)) continue;
        const t = painted.objects[y * W + x];
        if (t < 0) continue;
        // Flood fill to find connected structure
        const tiles = [];
        const queue = [{x, y}];
        let minX = W, maxX = 0, minY = H, maxY = 0;
        while (queue.length) {
          const {x: cx, y: cy} = queue.shift();
          const k = cx + ',' + cy;
          if (visited.has(k) || cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
          const tt = painted.objects[cy * W + cx];
          if (tt < 0) continue;
          visited.add(k);
          tiles.push({x: cx, y: cy, tile: tt});
          minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
          queue.push({x:cx+1,y:cy},{x:cx-1,y:cy},{x:cx,y:cy+1},{x:cx,y:cy-1});
        }
        if (tiles.length >= 3) {
          // Store as relative positions from top-left
          const rows = [];
          for (let dy = 0; dy <= maxY - minY; dy++) {
            const row = [];
            for (let dx = 0; dx <= maxX - minX; dx++) {
              const found = tiles.find(t => t.x === minX + dx && t.y === minY + dy);
              row.push(found ? found.tile : -1);
            }
            rows.push(row);
          }
          this._paintedBuildings.push({
            origX: minX, origY: minY,
            w: maxX - minX + 1, h: maxY - minY + 1,
            rows, tileCount: tiles.length
          });
        }
      }
    }

    // Extract foreground tiles
    for (let i = 0; i < W * H; i++) {
      const t = painted.foreground[i];
      if (t >= 0) {
        this._paintedForeground.push({ x: i % W, y: Math.floor(i / W), tile: t });
      }
    }

    // Load full knowledge file if it exists
    const knowledgePath = require('path').join(__dirname, 'learned-knowledge-v2.json');
    if (require('fs').existsSync(knowledgePath)) {
      this._knowledge = JSON.parse(require('fs').readFileSync(knowledgePath, 'utf8'));
      console.log('V2Engine: loaded knowledge (adj:' + Object.keys(this._knowledge.adjacency || {}).length +
        ' patterns:' + Object.keys(this._knowledge.patterns?.vertical || {}).length + 'v/' +
        Object.keys(this._knowledge.patterns?.horizontal || {}).length + 'h' +
        ' cross-layer:' + Object.keys(this._knowledge.crossLayer?.groundToObjects || {}).length + ')');
    }

    // Learn ground tile frequency distribution (weighted)
    // CRITICAL: Exclude path tiles from ground pool - paths are laid deliberately, not randomly
    const PATH_TILES_EXCLUDE = new Set([39, 40, 41, 44, 45]); // path edges, path center, cobblestone
    const GRASS_ONLY = new Set([0, 1, 2, 43]); // sparkle grass, plain grass, flower grass, white grass
    const gFreq = {};
    painted.ground.forEach(t => { 
      // Only include grass tiles in the base ground pool
      if (t >= 0 && GRASS_ONLY.has(t)) gFreq[t] = (gFreq[t] || 0) + 1; 
    });
    this._groundFreq = [];
    for (const [tile, count] of Object.entries(gFreq)) {
      for (let i = 0; i < Math.ceil(count / 10); i++) this._groundFreq.push(parseInt(tile));
    }
    // Ensure we have at least some grass if the painted map was all paths
    if (this._groundFreq.length === 0) this._groundFreq = [1, 1, 1, 2, 43];

    // Learn foreground tile frequency distribution
    const fFreq = {};
    painted.foreground.forEach(t => { if (t >= 0) fFreq[t] = (fFreq[t] || 0) + 1; });
    this._fgFreq = [];
    for (const [tile, count] of Object.entries(fFreq)) {
      for (let i = 0; i < Math.ceil(count / 3); i++) this._fgFreq.push(parseInt(tile));
    }

    // ── Best Practice: Extract tile frequency targets per layer ─────────
    // Used for frequency-divergence scoring (JSD match)
    this._targetFreqs = { ground: {}, objects: {}, foreground: {} };
    const total = W * H;
    painted.ground.forEach(t => { if (t >= 0) this._targetFreqs.ground[t] = (this._targetFreqs.ground[t] || 0) + 1; });
    painted.objects.forEach(t => { if (t >= 0) this._targetFreqs.objects[t] = (this._targetFreqs.objects[t] || 0) + 1; });
    painted.foreground.forEach(t => { if (t >= 0) this._targetFreqs.foreground[t] = (this._targetFreqs.foreground[t] || 0) + 1; });
    // Normalize to probabilities
    for (const layer of ['ground', 'objects', 'foreground']) {
      const sum = Object.values(this._targetFreqs[layer]).reduce((a, b) => a + b, 0) || 1;
      for (const k of Object.keys(this._targetFreqs[layer])) {
        this._targetFreqs[layer][k] /= sum;
      }
    }

    // ── Best Practice: Extract cross-layer column patterns ──────────────
    // Each (x,y) → (ground, objects, foreground) triple
    this._columnPatterns = {};
    for (let i = 0; i < W * H; i++) {
      const g = painted.ground[i], o = painted.objects[i], f = painted.foreground[i];
      const key = g + ',' + o + ',' + f;
      this._columnPatterns[key] = (this._columnPatterns[key] || 0) + 1;
    }

    // ── Best Practice: Extract 2x2 patterns per layer ───────────────────
    // Used for pattern coverage scoring
    this._patterns2x2 = { ground: new Set(), objects: new Set(), foreground: new Set() };
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        for (const [layer, arr] of [['ground', painted.ground], ['objects', painted.objects], ['foreground', painted.foreground]]) {
          const p = [arr[y*W+x], arr[y*W+x+1], arr[(y+1)*W+x], arr[(y+1)*W+x+1]].join(',');
          this._patterns2x2[layer].add(p);
        }
      }
    }
    console.log('V2Engine: loaded ' + Object.keys(this._columnPatterns).length + ' column patterns, ' +
      this._patterns2x2.ground.size + '/' + this._patterns2x2.objects.size + '/' + this._patterns2x2.foreground.size + ' 2x2 patterns (g/o/f)');
  }

  /** Generate a map from DNA parameters. Returns { width, height, ground[], objects[], foreground[], collision[] } */
  generate(dna = {}, seed) {
    const d = Object.assign({
      // DNA controls WHERE buildings go (offsets from original positions)
      buildingOffsets: [], // [{dx, dy}] per building — evolved
      fgScatter: 0.3,     // how much to scatter foreground from original positions
      groundVariation: 0.1, // how much ground differs from template
    }, dna);

    const rng = makeRng(seed || (Math.random() * 0x7fffffff));
    const ground = new Array(this.size).fill(0);
    const objects = new Array(this.size).fill(T.EMPTY);
    const foreground = new Array(this.size).fill(T.EMPTY);
    const collision = new Array(this.size).fill(0);

    // Load knowledge
    const groundTiles = this._groundFreq || [0, 0, 0, 0, 1, 43];
    const fgTiles = this._fgFreq || [19, 28, 4, 16, 7, 3, 15, 17, 20];
    const knowledge = this._knowledge || {};
    const rowLayout = knowledge.layoutRules?.rowDensity || [];
    const adjRules = knowledge.adjacency || {};
    const layerAdj = knowledge.layerAdj || {};
    const crossLayer = knowledge.crossLayer || {};

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Ground — multi-octave noise for natural variation
    // Reference map has: ~60% plain grass(1), ~25% flower grass(2), ~15% sparkle(0)/white(43)
    // ═══════════════════════════════════════════════════════════════════
    // Build a weighted grass pool matching reference distribution
    const grassPool = [];
    for (let i = 0; i < 60; i++) grassPool.push(1);  // 60% plain grass
    for (let i = 0; i < 25; i++) grassPool.push(2);  // 25% flower grass
    for (let i = 0; i < 10; i++) grassPool.push(0);  // 10% sparkle grass
    for (let i = 0; i < 5; i++) grassPool.push(43);  // 5% white grass
    
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const i = this.idx(x, y);
        // Multi-octave noise for more natural variation
        const n1 = valueNoise(x + (seed || 0) * 7, y + (seed || 0) * 13, 8);  // large scale
        const n2 = valueNoise(x + (seed || 0) * 3, y + (seed || 0) * 5, 3);   // small scale
        const combined = n1 * 0.7 + n2 * 0.3;  // blend for organic look
        
        // Use combined noise to pick from grass pool
        let tile = grassPool[Math.floor(combined * grassPool.length)];
        
        // Add small chance of random variation for more organic feel
        if (rng() < 0.15) {
          tile = grassPool[Math.floor(rng() * grassPool.length)];
        }
        
        // Adjacency preference still applies
        if (x > 0 && layerAdj.ground) {
          const leftTile = String(ground[this.idx(x - 1, y)]);
          const allowed = layerAdj.ground[leftTile]?.east;
          if (allowed) {
            const keys = Object.keys(allowed);
            if (keys.length > 0 && rng() < 0.5) { // 50% follow adjacency (reduced from 70%)
              const adjTile = parseInt(keys[Math.floor(rng() * keys.length)]);
              // Only use adjacency suggestion if it's a grass tile
              if ([0, 1, 2, 43].includes(adjTile)) tile = adjTile;
            }
          }
        }
        ground[i] = tile;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Paths — learned from row layout (building rows get paths nearby)
    // ═══════════════════════════════════════════════════════════════════
    // Path material — each map picks rock or dirt majority
    const ROCK_PATH = 44;  // Light Cobblestone (was 25=autumn trunk - WRONG!)
    const DIRT_PATH = 40;  // Dirt Path Center (was 43=grass flowers - WRONG!)
    const pathMaterial = rng() < (d.rockPathChance || 0.6) ? ROCK_PATH : DIRT_PATH;
    const pathCells = new Set();

    // Paths are laid AFTER buildings, connecting doors.
    // For now, just store the material. Actual path routing happens in STEP 3b.

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Buildings — mix of painted templates + procedurally generated
    // Painted templates are used as-is. Additional buildings are generated
    // procedurally using the material system (variable sizes).
    // ═══════════════════════════════════════════════════════════════════
    const doorPositions = []; // tracked for clear-path and no-tree zones
    const placed = []; // building bounding boxes
    {
      // Building count learned from painted map, with some variation
      const baseCount = this._paintedBuildings?.length || 5;
      const numBuildings = Math.max(5, baseCount + Math.floor((rng() - 0.3) * 3)); // 5 minimum
      // Find building rows from layout
      let buildingRows = rowLayout.filter(r => r.type === 'building').map(r => r.row);
      
      // If no learned rows, use fixed distribution for proper village layout
      // Reference map has buildings at roughly: top third (rows 2-8), middle (rows 12-18), lower (rows 22-28)
      if (buildingRows.length === 0) {
        buildingRows = [
          2 + Math.floor(rng() * 4),   // top row: 2-5
          6 + Math.floor(rng() * 5),   // second row: 6-10
          12 + Math.floor(rng() * 5),  // middle row: 12-16
          20 + Math.floor(rng() * 6),  // lower row: 20-25
          28 + Math.floor(rng() * 5),  // bottom row: 28-32
        ];
      }

      for (let bi = 0; bi < numBuildings; bi++) {
        // ALL buildings are procedurally generated from rules — never copied
        let bldg;
        const roll = rng();
        if (false) { // fences disabled
          bldg = generateFence(rng);         // 12% fence
        } else if (false) { // fences disabled // castle DISABLED - tiles are wrong (fence/water tiles labeled as castle)
          bldg = generateFence(rng);  // was: castle (broken)
        } else {
          bldg = generateHouse(rng);         // 82% house
        }

        for (let attempt = 0; attempt < 120; attempt++) {
          // Place in a building row (learned from layout)
          const by = buildingRows.length > 0
            ? buildingRows[Math.floor(rng() * buildingRows.length)]
            : Math.floor(rng() * (this.H - bldg.h));
          const bx = Math.floor(rng() * Math.max(1, this.W - bldg.w));

          // Check bounds
          if (by + bldg.h > this.H || bx + bldg.w > this.W) continue;

          // Check spacing using Manhattan distance for better distribution
          // Buildings need at least 3 tiles of clear space between them
          let tooClose = false;
          const minSpacing = d.buildingSpacing || 5;
          for (const p of placed) {
            // Check bounding box overlap with buffer
            const leftOverlap = bx < p.x + p.w + minSpacing;
            const rightOverlap = bx + bldg.w + minSpacing > p.x;
            const topOverlap = by < p.y + p.h + 2;
            const bottomOverlap = by + bldg.h + 2 > p.y;
            if (leftOverlap && rightOverlap && topOverlap && bottomOverlap) {
              tooClose = true;
              break;
            }
          }
          if (tooClose) continue;

          // Check not overlapping existing objects (with 1-tile buffer)
          let overlap = false;
          for (let dy = -1; dy <= bldg.h && !overlap; dy++) {
            for (let dx = -1; dx <= bldg.w && !overlap; dx++) {
              const cx = bx + dx, cy = by + dy;
              if (!this.inBounds(cx, cy)) continue;
              if (objects[this.idx(cx, cy)] !== T.EMPTY) overlap = true;
            }
          }
          if (overlap) continue;

          // Place building + find doors (only real building doors, not fence pieces)
          // Decide if this building gets a door (max 2 per map, like painted map)
          const giveDoor = !bldg.isFence && doorPositions.length < 2 && bldg.doorTile >= 0 && rng() < 0.45;
          if (giveDoor) {
            // Place door in the bottom row at the building's doorX
            const doorRow = bldg.rows[bldg.h - 1];
            doorRow[bldg.doorX] = bldg.doorTile;
          }

          // Place all tiles
          for (let dy = 0; dy < bldg.h; dy++) {
            for (let dx = 0; dx < bldg.w; dx++) {
              if (!this.inBounds(bx + dx, by + dy)) continue;
              const tile = bldg.rows[dy][dx];
              if (tile >= 0) {
                objects[this.idx(bx + dx, by + dy)] = tile;
                const isDoor = tile === 80;
                collision[this.idx(bx + dx, by + dy)] = isDoor ? 0 : 1;
                if (isDoor && dy === bldg.h - 1) {
                  doorPositions.push({ x: bx + dx, y: by + dy });
                }
              }
            }
          }
          placed.push({ x: bx, y: by, w: bldg.w, h: bldg.h });
          break;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Build a buffer zone around buildings — nothing should be directly adjacent
    // This prevents fences, decorations, and trees from visually merging with buildings
    // ═══════════════════════════════════════════════════════════════════
    const buildingBuffer = new Set();
    for (const p of placed) {
      for (let dy = -1; dy <= p.h; dy++) {
        for (let dx = -1; dx <= p.w; dx++) {
          const bx = p.x + dx, by = p.y + dy;
          if (this.inBounds(bx, by)) buildingBuffer.add(this.idx(bx, by));
        }
      }
    }

    // Helper: is this cell safely away from buildings?
    const awayFromBuildings = (x, y) => {
      if (!this.inBounds(x, y)) return false;
      return !buildingBuffer.has(this.idx(x, y));
    };

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3a: Fences — horizontal runs with proper L-M-R, 2+ tiles from buildings
    // ═══════════════════════════════════════════════════════════════════
    const FENCE_STYLES = [
      { L: 96, M: 97, R: 98 },   // white fence
      { L: 99, M: 100, R: 101 }, // wood fence
    ];

    const numFences = 1 + Math.floor(rng() * 2); // 1-2 fence runs
    for (let fi = 0; fi < numFences; fi++) {
      const fenceType = FENCE_STYLES[Math.floor(rng() * FENCE_STYLES.length)];
      const fy = 2 + Math.floor(rng() * (this.H - 4));
      const startX = 1 + Math.floor(rng() * (this.W / 2));
      const fenceLen = 4 + Math.floor(rng() * 5); // 4-8 tiles

      let canPlace = true;
      for (let dx = 0; dx < fenceLen && canPlace; dx++) {
        const fx = startX + dx;
        if (!this.inBounds(fx, fy)) { canPlace = false; break; }
        if (objects[this.idx(fx, fy)] !== T.EMPTY) { canPlace = false; break; }
        if (buildingBuffer.has(this.idx(fx, fy))) { canPlace = false; break; }
      }
      if (!canPlace) continue;

      for (let dx = 0; dx < fenceLen; dx++) {
        const fx = startX + dx;
        const tile = dx === 0 ? fenceType.L : dx === fenceLen - 1 ? fenceType.R : fenceType.M;
        objects[this.idx(fx, fy)] = tile;
        collision[this.idx(fx, fy)] = 1;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3b: Path network — connect all doors with paths
    // Strategy: every door gets a clear exit, then doors connect to a
    // shared backbone path that runs through the village.
    // ═══════════════════════════════════════════════════════════════════
    const doorClearZone = new Set();

    // Helper: lay a path tile at (x,y)
    // Path tiles: 39=left edge, 40=center, 41=right edge, 44/45=cobblestone
    const layPath = (x, y) => {
      if (!this.inBounds(x, y)) return;
      const ci = this.idx(x, y);
      ground[ci] = pathMaterial;
      pathCells.add(ci);
      doorClearZone.add(ci);
    };
    
    // Post-process to add edge tiles (called after all paths are laid)
    const finalizePaths = () => {
      // For each path cell, determine if it's an edge
      for (const ci of pathCells) {
        const x = ci % this.W;
        const y = Math.floor(ci / this.W);
        const leftPath = x > 0 && pathCells.has(this.idx(x - 1, y));
        const rightPath = x < this.W - 1 && pathCells.has(this.idx(x + 1, y));
        
        // Only apply edge tiles to non-cobblestone paths
        if (pathMaterial === 40) { // dirt path
          if (!leftPath && rightPath) ground[ci] = 39;  // left edge
          else if (leftPath && !rightPath) ground[ci] = 41;  // right edge
          // center stays as 40
        }
        // Cobblestone stays as 44/45 variation
        else if (pathMaterial === 44) {
          ground[ci] = rng() < 0.7 ? 44 : 45;  // add some cobble variation
        }
      }
    };

    // 1. Clear 2 tiles below each door
    for (const door of doorPositions) {
      for (let dy = 1; dy <= 2; dy++) {
        if (this.inBounds(door.x, door.y + dy)) {
          const ci = this.idx(door.x, door.y + dy);
          objects[ci] = T.EMPTY;
          foreground[ci] = T.EMPTY;
          collision[ci] = 0;
          doorClearZone.add(ci);
        }
      }
    }

    // 2. Organic paths: connect doors to each other with wandering lines
    //    Like the painted map: imperfect, 1-wide, with random jogs
    //    NOT grid lines or full-width backbones
    if (doorPositions.length >= 2) {
      // Sort doors by position to create a logical route
      const sorted = [...doorPositions].sort((a, b) => a.x + a.y * 0.5 - b.x - b.y * 0.5);
      // Connect each door to the next with a wandering path
      for (let di = 0; di < sorted.length - 1; di++) {
        let cx = sorted[di].x, cy = sorted[di].y + 1; // start below door
        const tx = sorted[di + 1].x, ty = sorted[di + 1].y + 1;
        // Walk toward target with random jogs
        let steps = 0;
        while ((cx !== tx || cy !== ty) && steps < 80) {
          layPath(cx, cy);
          // 70% move toward target, 30% random jog (creates organic feel)
          if (rng() < 0.7) {
            if (cx !== tx) cx += cx < tx ? 1 : -1;
            else if (cy !== ty) cy += cy < ty ? 1 : -1;
          } else {
            // Random jog perpendicular to direction
            if (Math.abs(cx - tx) > Math.abs(cy - ty)) {
              cy += rng() < 0.5 ? 1 : -1;
            } else {
              cx += rng() < 0.5 ? 1 : -1;
            }
          }
          cx = Math.max(0, Math.min(this.W - 1, cx));
          cy = Math.max(0, Math.min(this.H - 1, cy));
          steps++;
        }
        layPath(cx, cy);
      }
    } else if (doorPositions.length === 1) {
      // Single door: short path downward
      const d = doorPositions[0];
      for (let dy = 1; dy <= 3; dy++) {
        layPath(d.x, d.y + dy);
        if (rng() < 0.3) layPath(d.x + (rng() < 0.5 ? 1 : -1), d.y + dy); // occasional width
      }
    }

    // 3. Finalize paths with proper edge tiles
    finalizePaths();

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Trees & Foreground
    // From painted map analysis:
    //   Green tree:  4(canopy) above 16(trunk) — always vertical pair
    //   Pine tree:   7(top) above 19(body) — always vertical pair
    //   Dense pine:  block of 19s (2x2, 3x2, etc) with 7s on top row
    //   Autumn tree: 3(canopy) above 15(trunk) — always vertical pair
    //   Dark pine:   6(top) above 18(trunk)
    //   Bushes:      28, 20, 32, 17, 27, 31, 34 — standalone singles
    // ALL on foreground layer. Every "tall" tile MUST have its partner.
    // ═══════════════════════════════════════════════════════════════════

    // Helper: can place foreground at (x,y)? Must be away from buildings.
    const canPlaceFg = (x, y) => {
      if (!this.inBounds(x, y)) return false;
      const i = this.idx(x, y);
      return foreground[i] === T.EMPTY && objects[i] === T.EMPTY
        && !pathCells.has(i) && !doorClearZone.has(i) && !buildingBuffer.has(i);
    };

    // Helper: can place on objects layer at (x,y)? Must be away from buildings.
    const canPlaceObj = (x, y) => {
      if (!this.inBounds(x, y)) return false;
      const i = this.idx(x, y);
      return objects[i] === T.EMPTY && !pathCells.has(i) && !doorClearZone.has(i) && !buildingBuffer.has(i);
    };

    // Place a tree: BOTH canopy and trunk on FOREGROUND layer
    // This matches the scorer expectations (v2-scorer.js lines 288, 303-307)
    // and the reference painted map's actual structure.
    const placeTree = (x, y, canopyTile, trunkTile) => {
      if (!canPlaceFg(x, y) || !canPlaceFg(x, y + 1)) return false;
      foreground[this.idx(x, y)] = canopyTile;
      foreground[this.idx(x, y + 1)] = trunkTile;
      collision[this.idx(x, y + 1)] = 1; // trunks block movement
      return true;
    };

    // Place a tree cluster — learned from painted map adjacency:
    //   Dense clusters: tile 19 fills body, tile 7 or 6 on top row
    //   Edge tiles: 32 (stone), 20 (bush), 31 (sand) — NOT random small trees
    //   Single trees: 4 above 16 (green), 3 above 15 (autumn) — standalone pairs
    //   Tile 19 groups with itself (19→19 horizontal=8x, vertical=6x in painted map)
    //
    // Structure (learned from painted map):
    //   Row 0: 7 7 7 7    (canopy tops, or 6 for variety)
    //   Row 1: 19 19 19 19 (dense body)
    //   Row 2: 19 19 19 19 (dense body)
    //   Edge:  32 20 31 32 (closed border of ground-level bushes/stones)

    const placeTreeCluster = (cx, cy, w, h) => {
      let count = 0;
      // Pick canopy top tile: mostly 7 (autumn, matches painted map), sometimes 6
      const topTile = rng() < 0.7 ? 7 : 6;
      const bodyTile = 19; // dense body (the primary cluster tile)
      // Edge tiles from painted map: 32, 20, 31 (stone, bush, sand)
      const edgeTiles = [32, 20, 31, 28];

      // TOP ROW: canopy tiles (7 or 6)
      for (let dx = 0; dx < w; dx++) {
        if (canPlaceFg(cx + dx, cy)) {
          foreground[this.idx(cx + dx, cy)] = topTile;
          count++;
        }
      }

      // BODY ROWS: tile 19 fills densely
      for (let dy = 1; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          if (canPlaceFg(cx + dx, cy + dy)) {
            foreground[this.idx(cx + dx, cy + dy)] = bodyTile;
            count++;
          }
        }
      }

      // CLOSED EDGE BORDER: ring of edge tiles (32, 20, 31, 28)
      // Every non-map-boundary side gets a complete border
      const placeEdge = (x, y) => {
        if (canPlaceFg(x, y)) {
          foreground[this.idx(x, y)] = edgeTiles[Math.floor(rng() * edgeTiles.length)];
          count++;
        }
      };
      // Bottom
      if (cy + h < this.H) for (let dx = -1; dx <= w; dx++) placeEdge(cx + dx, cy + h);
      // Top (above canopy row)
      if (cy > 0) for (let dx = -1; dx <= w; dx++) placeEdge(cx + dx, cy - 1);
      // Left
      if (cx > 0) for (let dy = 0; dy < h; dy++) placeEdge(cx - 1, cy + dy);
      // Right
      if (cx + w < this.W) for (let dy = 0; dy < h; dy++) placeEdge(cx + w, cy + dy);
      // Corners
      if (cy > 0 && cx > 0) placeEdge(cx - 1, cy - 1);
      if (cy > 0 && cx + w < this.W) placeEdge(cx + w, cy - 1);
      if (cy + h < this.H && cx > 0) placeEdge(cx - 1, cy + h);
      if (cy + h < this.H && cx + w < this.W) placeEdge(cx + w, cy + h);

      return count;
    };

    // Single tree types from painted map adjacency analysis:
    //   4→16 (7 occurrences, 100% match) — green canopy + trunk
    //   7→19 (5 occurrences, 100% match) — autumn canopy + dense body
    //   3→15 (3 occurrences, 100% match) — light autumn pair
    const SINGLE_TREES = [
      { canopy: 4, trunk: 16, weight: 7 },   // green (most common in painted map)
      { canopy: 7, trunk: 19, weight: 5 },   // autumn canopy + dense
      { canopy: 3, trunk: 15, weight: 3 },   // light autumn
    ];
    const singlePool = [];
    for (const tt of SINGLE_TREES) {
      for (let i = 0; i < tt.weight; i++) singlePool.push(tt);
    }

    // PHASE A: Dense tree clusters concentrated at edges (matching reference map's forest border)
    // Reference has 4 corner clusters + some edge clusters, creating a natural border
    const numClusters = 5 + Math.floor(rng() * 3);  // 5-7 clusters for dense forest border
    const clusterZones = [];
    
    // First 4 clusters are always in corners (matching reference)
    const cornerPositions = [
      { cx: 0, cy: 0 },                           // top-left
      { cx: this.W - 6, cy: 0 },                   // top-right
      { cx: 0, cy: this.H - 5 },                   // bottom-left
      { cx: this.W - 6, cy: this.H - 5 },          // bottom-right
    ];
    
    for (let ci = 0; ci < numClusters; ci++) {
      let cx, cy;
      if (ci < 4) {
        // First 4 clusters: always corners
        const corner = cornerPositions[ci];
        cx = corner.cx + Math.floor(rng() * 3);
        cy = corner.cy + Math.floor(rng() * 2);
      } else if (rng() < 0.75) {
        // 75% of remaining clusters: edge positions
        const edge = Math.floor(rng() * 4);
        if (edge === 0) { cx = Math.floor(rng() * 5); cy = Math.floor(rng() * this.H); }          // left edge
        else if (edge === 1) { cx = this.W - 5 + Math.floor(rng() * 4); cy = Math.floor(rng() * this.H); } // right edge
        else if (edge === 2) { cx = Math.floor(rng() * this.W); cy = Math.floor(rng() * 4); }      // top edge
        else { cx = Math.floor(rng() * this.W); cy = this.H - 4 + Math.floor(rng() * 3); }         // bottom edge
      } else {
        // 25% random interior (for scattered variety)
        cx = 5 + Math.floor(rng() * (this.W - 10));
        cy = 4 + Math.floor(rng() * (this.H - 8));
      }
      // Check not inside a building
      let blocked = false;
      for (const p of placed) {
        if (cx >= p.x - 2 && cx <= p.x + p.w + 1 && cy >= p.y - 1 && cy <= p.y + p.h) { blocked = true; break; }
      }
      if (blocked) continue;

      const cw = 3 + Math.floor(rng() * 4);  // 3-6 wide clusters
      const ch = 3 + Math.floor(rng() * 2);  // 3-4 tall clusters
      placeTreeCluster(cx, cy, cw, ch);
      clusterZones.push({ x: cx, y: cy, w: cw, h: ch });
    }

    // PHASE B: Single trees scattered (always as complete canopy+trunk pairs)
    const singleCount = 6 + Math.floor(rng() * 7); // 6-12 single trees // 4-9 single trees
    let singlesPlaced = 0;
    for (let attempt = 0; attempt < singleCount * 8 && singlesPlaced < singleCount; attempt++) {
      const x = Math.floor(rng() * this.W);
      const y = Math.floor(rng() * (this.H - 1)); // room for trunk below

      // Not inside a cluster zone
      let nearCluster = false;
      for (const cz of clusterZones) {
        if (x >= cz.x - 1 && x <= cz.x + cz.w && y >= cz.y - 1 && y <= cz.y + cz.h) { nearCluster = true; break; }
      }
      if (nearCluster) continue;

      const tt = singlePool[Math.floor(rng() * singlePool.length)];
      if (placeTree(x, y, tt.canopy, tt.trunk)) singlesPlaced++;
    }

    // PHASE C: Small bushes/decorations to fill remaining foreground budget
    const targetFg = Math.round(this.size * (d.fgDensity || 0.19));
    let currentFg = 0;
    for (let i = 0; i < this.size; i++) { if (foreground[i] !== T.EMPTY) currentFg++; }
    const bushTypes = [28, 20, 32, 17, 27, 31, 34]; // all standalone
    for (let attempt = 0; attempt < (targetFg - currentFg) * 4 && currentFg < targetFg; attempt++) {
      const x = Math.floor(rng() * this.W);
      const y = Math.floor(rng() * this.H);
      if (!canPlaceFg(x, y)) continue;
      foreground[this.idx(x, y)] = bushTypes[Math.floor(rng() * bushTypes.length)];
      currentFg++;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4b: Decorations — wells, barrels, lanterns near buildings
    // Reference map has decorations clustered near buildings, not random
    // ═══════════════════════════════════════════════════════════════════
    const DECORATION_TILES = {
      well_top: 92, well_base: 104,  // Well is 2-tall: top above base
      barrel: 107, lantern: 93, sign: 94
    };
    
    // Place 1-2 wells near buildings (2+ tiles away, not touching)
    const wellCount = 1 + Math.floor(rng() * 2);
    let wellsPlaced = 0;
    for (let attempt = 0; attempt < 60 && wellsPlaced < wellCount; attempt++) {
      if (placed.length === 0) break;
      const bldg = placed[Math.floor(rng() * placed.length)];
      // Place well 3-4 tiles from building edge
      const side = Math.floor(rng() * 2); // left or right only
      const wx = side === 0 ? bldg.x - 3 - Math.floor(rng() * 2) : bldg.x + bldg.w + 2 + Math.floor(rng() * 2);
      const wy = bldg.y + Math.floor(rng() * bldg.h);

      if (!this.inBounds(wx, wy) || !this.inBounds(wx, wy + 1)) continue;
      if (objects[this.idx(wx, wy)] !== T.EMPTY || objects[this.idx(wx, wy + 1)] !== T.EMPTY) continue;
      if (buildingBuffer.has(this.idx(wx, wy)) || buildingBuffer.has(this.idx(wx, wy + 1))) continue;

      objects[this.idx(wx, wy)] = DECORATION_TILES.well_top;
      objects[this.idx(wx, wy + 1)] = DECORATION_TILES.well_base;
      collision[this.idx(wx, wy)] = 1;
      collision[this.idx(wx, wy + 1)] = 1;
      wellsPlaced++;
    }

    // Place barrels and lanterns near doors (2 tiles below, not adjacent)
    for (const door of doorPositions) {
      if (rng() < 0.5) {
        const offsets = [[-2, 2], [2, 2], [-1, 3], [1, 3]]; // 2-3 tiles from door, not touching
        const offset = offsets[Math.floor(rng() * offsets.length)];
        const dx = door.x + offset[0], dy = door.y + offset[1];
        if (this.inBounds(dx, dy) && objects[this.idx(dx, dy)] === T.EMPTY && !buildingBuffer.has(this.idx(dx, dy))) {
          objects[this.idx(dx, dy)] = rng() < 0.7 ? DECORATION_TILES.barrel : DECORATION_TILES.lantern;
          collision[this.idx(dx, dy)] = 1;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Water feature (small pond, 30% chance)
    // Reference map style: 3x2 or 4x3 water area with proper edge tiles
    // ═══════════════════════════════════════════════════════════════════
    if (rng() < 0.3) {
      const ww = 2 + Math.floor(rng() * 3); // 2-4 wide
      const wh = 2 + Math.floor(rng() * 2); // 2-3 tall
      // Try to place in an open area
      for (let attempt = 0; attempt < 40; attempt++) {
        const wx = 3 + Math.floor(rng() * (this.W - ww - 6));
        const wy = 3 + Math.floor(rng() * (this.H - wh - 6));
        let canPlace = true;
        for (let dy = -1; dy <= wh && canPlace; dy++) {
          for (let dx = -1; dx <= ww && canPlace; dx++) {
            const cx = wx + dx, cy = wy + dy;
            if (!this.inBounds(cx, cy)) { canPlace = false; break; }
            const ci = this.idx(cx, cy);
            if (objects[ci] !== T.EMPTY || buildingBuffer.has(ci) || pathCells.has(ci)) canPlace = false;
          }
        }
        if (!canPlace) continue;
        // Place water with proper edge tiles (9-tile system)
        for (let dy = 0; dy < wh; dy++) {
          for (let dx = 0; dx < ww; dx++) {
            const ci = this.idx(wx + dx, wy + dy);
            const isTop = dy === 0, isBot = dy === wh - 1;
            const isLeft = dx === 0, isRight = dx === ww - 1;
            let tile;
            if (isTop && isLeft) tile = T.WATER_NW;
            else if (isTop && isRight) tile = T.WATER_NE;
            else if (isBot && isLeft) tile = T.WATER_SW;
            else if (isBot && isRight) tile = T.WATER_SE;
            else if (isTop) tile = T.WATER_N;
            else if (isBot) tile = T.WATER_S;
            else if (isLeft) tile = T.WATER_W;
            else if (isRight) tile = T.WATER_E;
            else tile = T.WATER_CENTER;
            objects[ci] = tile;
            collision[ci] = 1;
          }
        }
        break; // placed successfully
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Repair pass (best practice: fix structural defects)
    // ═══════════════════════════════════════════════════════════════════
    const CANOPY_TO_TRUNK = { 4: 12, 5: 13, 7: 24, 8: 25, 10: 22, 11: 23 };
    const TRUNK_TO_CANOPY = { 12: 4, 13: 5, 24: 7, 25: 8, 22: 10, 23: 11 };

    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const i = this.idx(x, y);
        const fg = foreground[i];
        const obj = objects[i];

        // Repair orphan canopy: add trunk below if space
        if (CANOPY_TO_TRUNK[fg] !== undefined && y + 1 < this.H) {
          const bi = this.idx(x, y + 1);
          if (objects[bi] === T.EMPTY && !pathCells.has(bi)) {
            objects[bi] = CANOPY_TO_TRUNK[fg];
          }
        }

        // Repair orphan trunk: add canopy above if space
        if (TRUNK_TO_CANOPY[obj] !== undefined && y > 0) {
          const ai = this.idx(x, y - 1);
          if (foreground[ai] === T.EMPTY) {
            foreground[ai] = TRUNK_TO_CANOPY[obj];
          }
        }

        // Fix stacked doors: if door(80) is directly above another door, replace top with wall
        if (obj === 80 && y + 1 < this.H) {
          if (objects[this.idx(x, y + 1)] === 80) {
            objects[i] = 85; // replace with dark stone wall
          }
        }

        // Ensure ground is always filled (never -1)
        if (ground[i] < 0) ground[i] = 1; // default to plain grass
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Collision
    // ═══════════════════════════════════════════════════════════════════
    const WALKABLE_DOORS = new Set([80]); // 80=Dark Archway Opening (the door)
    for (let i = 0; i < this.size; i++) {
      if (objects[i] !== T.EMPTY && !WALKABLE_DOORS.has(objects[i])) {
        collision[i] = 1;
      }
    }

    return { width: this.W, height: this.H, ground, objects, foreground, collision };
  }

  /** Generate multiple map variations from the same DNA. */
  generateBatch(dna, count = 5) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(this.generate(dna, (Date.now() + i * 7919)));
    }
    return results;
  }

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
      for (let x = margin; x < this.W - margin; x++) { markPath2(x, cy, true); }
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
      if (pathList.length === 0) break;
      const base = pathList[Math.floor(rng() * pathList.length)];
      const offsetX = Math.floor(rng() * 10) - 5;
      const offsetY = (rng() < 0.5 ? -1 : 1) * (3 + Math.floor(rng() * 4));
      const bx = base.x + offsetX;
      const by = base.y + offsetY;

      if (bx < 5 || bx + 5 >= this.W - 5 || by < 5 || by + 3 >= this.H - 5) continue;

      let tooClose = false;
      for (const p of positions) {
        if (dist(bx, by, p.x, p.y) < spacing) { tooClose = true; break; }
      }
      if (tooClose) continue;

      let blocked = false;
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 5; dx++) {
          const z = zones[this.idx(bx + dx, by + dy)];
          if (z === 'path' || z === 'water' || z === 'building') { blocked = true; break; }
        }
        if (blocked) break;
      }
      if (blocked) continue;

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

  _pathTile(x, y, zones) {
    const leftIsPath = this.inBounds(x - 1, y) && zones[this.idx(x - 1, y)] === 'path';
    const rightIsPath = this.inBounds(x + 1, y) && zones[this.idx(x + 1, y)] === 'path';
    if (!leftIsPath && rightIsPath) return T.PATH_EDGE;
    if (leftIsPath && !rightIsPath) return T.PATH_EDGE_R;
    return T.PATH_CENTER;
  }

  _connectToPath(ground, zones, doorX, startY, pathCells) {
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

    for (let c = 0; c < dna.treeInteriorClusters; c++) {
      const margin = Math.min(3, Math.floor(this.W / 6));
      const cx = margin + Math.floor(rng() * Math.max(1, this.W - margin * 2));
      const cy = margin + Math.floor(rng() * Math.max(1, this.H - margin * 2));
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

module.exports = { V2Engine, T, MATERIALS, MATERIAL_KEYS, generateHouse, generateCastle, generateFence, TREE_TYPES, valueNoise };
