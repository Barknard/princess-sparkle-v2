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
const MATERIALS = {
  red: {
    roof:  { L: 48, M: 49, R: 50 },
    mid:   { L: 60, M: 63, R: 62 },  // 63 = wall pattern
    base:  { L: 72, M: 85, R: 75 },
    door:  80,
  },
  gray: {
    roof:  { L: 52, M: 53, R: 54 },
    mid:   { L: 64, M: 65, R: 66 },
    base:  { L: 76, M: 88, R: 79 },
    door:  57,
  },
  blue: {
    roof:  { L: 51, M: 49, R: 55 },
    mid:   { L: 61, M: 63, R: 62 },
    base:  { L: 84, M: 85, R: 75 },
    door:  80,
  },
  castle: {
    roof:  { L: 96, M: -1, R: 98 },     // towers as bookends
    mid:   { L: 120, M: -1, R: 122 },
    base:  { L: 123, M: -1, R: 124 },
    gate:  { L: 111, R: 112 },
    tower: 102,
    door:  -1, // castles use gate instead
  },
  stone: {
    wall:  { L: 44, M: 45, R: 44 },      // fence/wall segments
    base:  { L: 56, M: 94, R: 68 },
    door:  82,
    post:  81,
  },
};
const MATERIAL_KEYS = ['red', 'gray', 'blue']; // house materials (castle/stone are special)

// ── Procedural Building Generators ──────────────────────────────────────────
// Every building is uniquely generated from rules. Painted templates are
// training data only — they teach the material system, never get copied.

// Generate a house: roof on top, mid detail above door only, base with door
function generateHouse(rng) {
  const mat = MATERIALS[MATERIAL_KEYS[Math.floor(rng() * MATERIAL_KEYS.length)]];
  const w = 3 + Math.floor(rng() * 4);   // 3-6 wide
  const rows = [];

  const makeRow = (lmr) => {
    const row = [lmr.L];
    for (let i = 0; i < w - 2; i++) row.push(lmr.M);
    row.push(lmr.R);
    return row;
  };

  // Pick door position first (drives the pitched roof placement)
  const doorPositions = [1, Math.floor(w / 2), w - 2];
  const doorX = Math.min(doorPositions[Math.floor(rng() * doorPositions.length)], w - 1);

  // Roof row
  rows.push(makeRow(mat.roof));

  // Mid row — pitched roof detail goes ONLY above the door column
  // The "mid" tiles (60/61/62/63 etc) are the under-roof overhang
  // They sit in one row, only above where the door is
  const hasMidDetail = rng() < 0.7; // 70% of houses have the overhang detail
  if (hasMidDetail) {
    const midRow = makeRow(mat.base); // default to base tiles
    // Place mid L-M-R centered on the door position (3-tile overhang)
    const overhangStart = Math.max(0, doorX - 1);
    const overhangEnd = Math.min(w - 1, doorX + 1);
    if (overhangStart < w) midRow[overhangStart] = mat.mid.L;
    midRow[doorX] = mat.mid.M;
    if (overhangEnd < w) midRow[overhangEnd] = mat.mid.R;
    rows.push(midRow);
  }

  // Extra wall rows for taller buildings (0-1 additional)
  const extraWalls = Math.floor(rng() * 2); // 0-1
  for (let i = 0; i < extraWalls; i++) rows.push(makeRow(mat.base));

  // Base row with door
  const baseRow = makeRow(mat.base);
  if (mat.door >= 0) {
    baseRow[doorX] = mat.door;
  }
  rows.push(baseRow);

  return { w, h: rows.length, rows, tileCount: rows.flat().filter(t => t >= 0).length };
}

// Generate a castle: towers (optional), walls, gate
function generateCastle(rng) {
  const mat = MATERIALS.castle;
  const hasTowers = rng() < 0.7;         // 70% chance of towers
  const gateWidth = 2;                     // gate is always 2 wide (L+R)
  const wallsPerSide = 1 + Math.floor(rng() * 2); // 1-2 wall columns per side
  const towerH = hasTowers ? (2 + Math.floor(rng() * 2)) : 0; // 2-3 tall towers
  const bodyH = 2 + Math.floor(rng() * 2); // 2-3 tall body

  // Width: tower(1) + walls + gate(2) + walls + tower(1)
  const sideW = hasTowers ? 1 + wallsPerSide : wallsPerSide;
  const totalW = sideW + gateWidth + sideW;
  const totalH = Math.max(towerH, bodyH);
  const rows = [];

  for (let dy = 0; dy < totalH; dy++) {
    const row = [];
    for (let dx = 0; dx < totalW; dx++) {
      const isLeftTower = hasTowers && dx === 0;
      const isRightTower = hasTowers && dx === totalW - 1;
      const isGateL = dx === sideW;
      const isGateR = dx === sideW + 1;
      const isWall = !isLeftTower && !isRightTower && !isGateL && !isGateR;

      if (isLeftTower || isRightTower) {
        if (dy === 0) row.push(mat.tower);           // tower cap
        else if (dy < totalH - 1) row.push(isLeftTower ? mat.mid.L : mat.mid.R);
        else row.push(isLeftTower ? mat.base.L : mat.base.R);
      } else if (isGateL || isGateR) {
        if (dy < totalH - 2) row.push(-1);           // empty above gate
        else if (dy === totalH - 2) row.push(isGateL ? mat.gate.L : mat.gate.R);
        else row.push(isGateL ? mat.base.L : mat.base.R);
      } else if (isWall) {
        if (dy === 0) row.push(dx < sideW ? mat.roof.L : mat.roof.R);
        else if (dy < totalH - 1) row.push(dx < sideW ? mat.mid.L : mat.mid.R);
        else row.push(dx < sideW ? mat.base.L : mat.base.R);
      }
    }
    rows.push(row);
  }

  return { w: totalW, h: totalH, rows, tileCount: rows.flat().filter(t => t >= 0).length };
}

// Generate a fence: posts + rails, variable length
// Fences do NOT have doors — they're just walls/barriers
function generateFence(rng, width) {
  const mat = MATERIALS.stone;
  const w = width || (3 + Math.floor(rng() * 6)); // 3-8 wide
  const row = [];

  for (let i = 0; i < w; i++) {
    if (i % 2 === 0) row.push(mat.post); // 81 = fence post
    else row.push(mat.wall.M);            // 45 = fence rail
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
    const gFreq = {};
    painted.ground.forEach(t => { if (t >= 0) gFreq[t] = (gFreq[t] || 0) + 1; });
    this._groundFreq = [];
    for (const [tile, count] of Object.entries(gFreq)) {
      for (let i = 0; i < Math.ceil(count / 10); i++) this._groundFreq.push(parseInt(tile));
    }

    // Learn foreground tile frequency distribution
    const fFreq = {};
    painted.foreground.forEach(t => { if (t >= 0) fFreq[t] = (fFreq[t] || 0) + 1; });
    this._fgFreq = [];
    for (const [tile, count] of Object.entries(fFreq)) {
      for (let i = 0; i < Math.ceil(count / 3); i++) this._fgFreq.push(parseInt(tile));
    }
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
    // STEP 1: Ground — noise with adjacency-aware tile selection
    // ═══════════════════════════════════════════════════════════════════
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const i = this.idx(x, y);
        const n = valueNoise(x + (seed || 0) * 7, y + (seed || 0) * 13, 4);
        let tile = groundTiles[Math.floor(n * groundTiles.length)];
        // Check adjacency: if left neighbor exists, prefer tiles that go next to it
        if (x > 0 && layerAdj.ground) {
          const leftTile = String(ground[this.idx(x - 1, y)]);
          const allowed = layerAdj.ground[leftTile]?.east;
          if (allowed) {
            const keys = Object.keys(allowed);
            if (keys.length > 0 && rng() < 0.7) { // 70% follow adjacency
              tile = parseInt(keys[Math.floor(rng() * keys.length)]);
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
    const ROCK_PATH = 25;
    const DIRT_PATH = 43;
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
      const baseCount = this._paintedBuildings?.length || 4;
      const numBuildings = Math.max(3, baseCount + Math.floor((rng() - 0.5) * 4)); // ±2 from base
      // Find building rows from layout
      const buildingRows = rowLayout.filter(r => r.type === 'building').map(r => r.row);

      for (let bi = 0; bi < numBuildings; bi++) {
        // ALL buildings are procedurally generated from rules — never copied
        let bldg;
        const roll = rng();
        if (roll < 0.10) {
          bldg = generateCastle(rng);       // 10% castle
        } else if (roll < 0.20) {
          bldg = generateFence(rng);         // 10% fence
        } else {
          bldg = generateHouse(rng);         // 80% house (varied materials + sizes)
        }

        for (let attempt = 0; attempt < 80; attempt++) {
          // Place in a building row (learned from layout)
          const by = buildingRows.length > 0
            ? buildingRows[Math.floor(rng() * buildingRows.length)]
            : Math.floor(rng() * (this.H - bldg.h));
          const bx = Math.floor(rng() * Math.max(1, this.W - bldg.w));

          // Check bounds
          if (by + bldg.h > this.H || bx + bldg.w > this.W) continue;

          // Check spacing
          let tooClose = false;
          for (const p of placed) {
            if (Math.abs(bx - p.x) < (d.buildingSpacing || 5) && Math.abs(by - p.y) < 3) { tooClose = true; break; }
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
          const REAL_DOORS = new Set([80, 57]); // wood door, stone door
          for (let dy = 0; dy < bldg.h; dy++) {
            for (let dx = 0; dx < bldg.w; dx++) {
              if (!this.inBounds(bx + dx, by + dy)) continue;
              const tile = bldg.rows[dy][dx];
              if (tile >= 0) {
                objects[this.idx(bx + dx, by + dy)] = tile;
                collision[this.idx(bx + dx, by + dy)] = REAL_DOORS.has(tile) ? 0 : 1;
                // Only track actual doors (bottom row of building, not fences)
                if (REAL_DOORS.has(tile) && !bldg.isFence && dy === bldg.h - 1) {
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
    // STEP 3b: Path network — connect all doors with paths
    // Strategy: every door gets a clear exit, then doors connect to a
    // shared backbone path that runs through the village.
    // ═══════════════════════════════════════════════════════════════════
    const doorClearZone = new Set();

    // Helper: lay a path tile at (x,y)
    const layPath = (x, y) => {
      if (!this.inBounds(x, y)) return;
      const ci = this.idx(x, y);
      ground[ci] = pathMaterial;
      pathCells.add(ci);
      doorClearZone.add(ci);
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

    // 2. Find the backbone Y — the row where most doors exit to
    //    (typically the middle-ish row between building clusters)
    const doorExitYs = doorPositions.map(d => Math.min(d.y + 2, this.H - 1));
    const backboneY = doorExitYs.length > 0
      ? Math.round(doorExitYs.reduce((a, b) => a + b, 0) / doorExitYs.length)
      : Math.round(this.H * 0.5);

    // 3. Lay horizontal backbone path
    for (let x = 0; x < this.W; x++) {
      layPath(x, backboneY);
    }

    // 4. Connect each door down to the backbone via vertical path segments
    for (const door of doorPositions) {
      const startY = door.y + 1;
      const endY = backboneY;
      const dir = endY >= startY ? 1 : -1;
      for (let y = startY; y !== endY + dir; y += dir) {
        layPath(door.x, y);
      }
    }

    // 5. If buildings are spread wide, add a secondary vertical connector
    if (placed.length > 0) {
      const avgX = Math.round(placed.reduce((s, p) => s + p.x + p.w / 2, 0) / placed.length);
      for (let y = 0; y < this.H; y++) {
        // Only lay vertical path in open areas (not through buildings)
        if (objects[this.idx(avgX, y)] === T.EMPTY) {
          layPath(avgX, y);
        }
      }
    }

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

    // Helper: can place foreground at (x,y)?
    const canPlaceFg = (x, y) => {
      if (!this.inBounds(x, y)) return false;
      const i = this.idx(x, y);
      return foreground[i] === T.EMPTY && objects[i] === T.EMPTY
        && !pathCells.has(i) && !doorClearZone.has(i);
    };

    // Place a complete tree (canopy + trunk, both cells guaranteed)
    const placeTreePair = (x, y, canopyTile, trunkTile) => {
      if (!canPlaceFg(x, y) || !canPlaceFg(x, y + 1)) return false;
      foreground[this.idx(x, y)] = canopyTile;
      foreground[this.idx(x, y + 1)] = trunkTile;
      return true;
    };

    // Place a dense pine cluster with proper edges
    // Core: 7(top) + 19(body). Edges that don't touch the map boundary
    // get rounded with edge tiles (single canopy, bush, trunk).
    const placePineCluster = (cx, cy, w, h) => {
      let count = 0;
      // Lay the core block
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          const x = cx + dx, y = cy + dy;
          if (!canPlaceFg(x, y)) continue;
          if (dy === 0) foreground[this.idx(x, y)] = 7;  // top row = pine tops
          else foreground[this.idx(x, y)] = 19;           // body = dense
          count++;
        }
      }

      // Round exposed edges (not touching map boundary)
      const edgeTiles = [20, 32, 17, 28]; // small bushes/shrubs
      // Bottom edge
      if (cy + h < this.H - 1) {
        for (let dx = 0; dx < w; dx++) {
          const x = cx + dx, y = cy + h;
          if (canPlaceFg(x, y)) { foreground[this.idx(x, y)] = edgeTiles[Math.floor(rng() * edgeTiles.length)]; count++; }
        }
      }
      // Left edge
      if (cx > 0) {
        for (let dy = 0; dy < h; dy++) {
          const x = cx - 1, y = cy + dy;
          if (canPlaceFg(x, y)) { foreground[this.idx(x, y)] = edgeTiles[Math.floor(rng() * edgeTiles.length)]; count++; }
        }
      }
      // Right edge
      if (cx + w < this.W - 1) {
        for (let dy = 0; dy < h; dy++) {
          const x = cx + w, y = cy + dy;
          if (canPlaceFg(x, y)) { foreground[this.idx(x, y)] = edgeTiles[Math.floor(rng() * edgeTiles.length)]; count++; }
        }
      }
      // Top edge (above the pine tops)
      if (cy > 0) {
        for (let dx = 0; dx < w; dx++) {
          const x = cx + dx, y = cy - 1;
          if (canPlaceFg(x, y)) { foreground[this.idx(x, y)] = edgeTiles[Math.floor(rng() * edgeTiles.length)]; count++; }
        }
      }
      return count;
    };

    // Tree types for single trees (always placed as vertical pairs)
    const SINGLE_TREES = [
      { canopy: 4, trunk: 16, weight: 7 },   // green
      { canopy: 3, trunk: 15, weight: 4 },   // autumn
      { canopy: 6, trunk: 18, weight: 1 },   // dark pine
    ];
    const singlePool = [];
    for (const tt of SINGLE_TREES) {
      for (let i = 0; i < tt.weight; i++) singlePool.push(tt);
    }

    // PHASE A: Dense pine clusters in corners/edges (like painted map)
    const numClusters = 2 + Math.floor(rng() * 3); // 2-4 clusters
    const clusterZones = [];
    for (let ci = 0; ci < numClusters; ci++) {
      let cx, cy;
      if (rng() < 0.7) {
        // Corner/edge bias
        cx = rng() < 0.5 ? Math.floor(rng() * 3) : this.W - 1 - Math.floor(rng() * 4);
        cy = rng() < 0.5 ? Math.floor(rng() * 2) : this.H - 1 - Math.floor(rng() * 3);
      } else {
        cx = Math.floor(rng() * this.W);
        cy = Math.floor(rng() * this.H);
      }
      // Check not inside a building
      let blocked = false;
      for (const p of placed) {
        if (cx >= p.x - 2 && cx <= p.x + p.w + 1 && cy >= p.y - 1 && cy <= p.y + p.h) { blocked = true; break; }
      }
      if (blocked) continue;

      const cw = 2 + Math.floor(rng() * 3); // 2-4 wide
      const ch = 2 + Math.floor(rng() * 2); // 2-3 tall
      placePineCluster(cx, cy, cw, ch);
      clusterZones.push({ x: cx, y: cy, w: cw, h: ch });
    }

    // PHASE B: Single trees scattered (always as complete canopy+trunk pairs)
    const singleCount = 4 + Math.floor(rng() * 6); // 4-9 single trees
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
      if (placeTreePair(x, y, tt.canopy, tt.trunk)) singlesPlaced++;
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
    // STEP 5: Collision
    // ═══════════════════════════════════════════════════════════════════
    for (let i = 0; i < this.size; i++) {
      if (objects[i] !== T.EMPTY && objects[i] !== 80 && objects[i] !== 57) {
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
