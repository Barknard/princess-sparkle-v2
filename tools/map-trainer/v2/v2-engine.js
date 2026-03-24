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

// Generate a building of specified width and height from a material
function generateBuilding(rng, width, height, material) {
  if (!material) material = MATERIALS[MATERIAL_KEYS[Math.floor(rng() * MATERIAL_KEYS.length)]];
  const rows = [];
  const w = Math.max(3, width);  // minimum 3 wide (L-M-R)
  const h = Math.max(2, height); // minimum 2 tall (roof + base)

  // Build each row: L, then M repeated, then R
  const makeRow = (lmr) => {
    const row = [lmr.L];
    for (let i = 0; i < w - 2; i++) row.push(lmr.M);
    row.push(lmr.R);
    return row;
  };

  if (h >= 3) {
    // roof row
    rows.push(makeRow(material.roof));
    // mid rows (repeat for taller buildings)
    for (let i = 0; i < h - 2; i++) rows.push(makeRow(material.mid));
    // base row with door in center
    const baseRow = makeRow(material.base);
    if (material.door >= 0) {
      const doorX = Math.floor(w / 2);
      baseRow[doorX] = material.door;
    }
    rows.push(baseRow);
  } else {
    // 2-tall: roof + base with door
    rows.push(makeRow(material.roof));
    const baseRow = makeRow(material.base);
    if (material.door >= 0) baseRow[Math.floor(w / 2)] = material.door;
    rows.push(baseRow);
  }
  return { w, h: rows.length, rows, tileCount: rows.flat().filter(t => t >= 0).length };
}

// Generate a fence/wall of specified width
function generateFence(rng, width) {
  const mat = MATERIALS.stone;
  const row = [mat.door]; // start with gate
  for (let i = 1; i < width - 1; i++) {
    row.push(i % 2 === 0 ? mat.wall.M : mat.post);
  }
  row.push(mat.base.M); // end with gate piece
  return { w: width, h: 1, rows: [row], tileCount: width };
}

// Keep painted templates as-is (they're always valid)
// But ALSO allow procedural generation of new building sizes

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
    const pathCells = new Set();
    const pcx = Math.round((d.pathCenter || [0.5, 0.5])[0] * this.W);
    const pcy = Math.round((d.pathCenter || [0.5, 0.5])[1] * this.H);

    // Each map picks a primary path material: rock (cobblestone) or dirt
    const ROCK_PATH = 25;  // cobblestone
    const DIRT_PATH = 43;  // dirt
    const pathMaterial = rng() < (d.rockPathChance || 0.6) ? ROCK_PATH : DIRT_PATH;
    const altMaterial = pathMaterial === ROCK_PATH ? DIRT_PATH : ROCK_PATH;

    // Horizontal path — single row through center
    for (let x = 0; x < this.W; x++) {
      if (this.inBounds(x, pcy)) {
        ground[this.idx(x, pcy)] = rng() < 0.85 ? pathMaterial : altMaterial;
        pathCells.add(this.idx(x, pcy));
      }
    }
    // Vertical path — single column
    for (let y = 0; y < this.H; y++) {
      if (this.inBounds(pcx, y)) {
        ground[this.idx(pcx, y)] = rng() < 0.85 ? pathMaterial : altMaterial;
        pathCells.add(this.idx(pcx, y));
      }
    }
    // Path edge tiles (transitions between path and grass)
    const pathEdgeTiles = pathMaterial === ROCK_PATH
      ? [24, 36, 37, 38, 13, 14]   // rock edges
      : [1, 2, 43];                  // dirt edges
    for (const pi of pathCells) {
      const px = pi % this.W, py = Math.floor(pi / this.W);
      for (const [nx, ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]]) {
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (!pathCells.has(ni) && ground[ni] !== 25) {
          // 30% chance of a path edge tile
          if (rng() < 0.3) {
            ground[ni] = pathEdgeTiles[Math.floor(rng() * pathEdgeTiles.length)];
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Buildings — mix of painted templates + procedurally generated
    // Painted templates are used as-is. Additional buildings are generated
    // procedurally using the material system (variable sizes).
    // ═══════════════════════════════════════════════════════════════════
    const doorPositions = []; // tracked for clear-path and no-tree zones
    const placed = []; // building bounding boxes
    {
      const numBuildings = d.buildingCount || (this._paintedBuildings?.length || 4) + Math.floor(rng() * 3);
      // Find building rows from layout
      const buildingRows = rowLayout.filter(r => r.type === 'building').map(r => r.row);

      for (let bi = 0; bi < numBuildings; bi++) {
        // Use painted template if available, otherwise generate procedurally
        let bldg;
        if (this._paintedBuildings && bi < this._paintedBuildings.length && rng() < 0.6) {
          bldg = this._paintedBuildings[bi];
        } else {
          // Procedural: random size and material
          const bw = 3 + Math.floor(rng() * 4); // 3-6 wide
          const bh = 2 + Math.floor(rng() * 3); // 2-4 tall
          if (rng() < 0.15) {
            bldg = generateFence(rng, 3 + Math.floor(rng() * 5)); // occasional fence
          } else {
            bldg = generateBuilding(rng, bw, bh);
          }
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

          // Check not overlapping existing objects
          let overlap = false;
          for (let dy = 0; dy < bldg.h && !overlap; dy++) {
            for (let dx = 0; dx < bldg.w && !overlap; dx++) {
              if (objects[this.idx(bx + dx, by + dy)] !== T.EMPTY) overlap = true;
            }
          }
          if (overlap) continue;

          // Place building + find doors
          for (let dy = 0; dy < bldg.h; dy++) {
            for (let dx = 0; dx < bldg.w; dx++) {
              if (!this.inBounds(bx + dx, by + dy)) continue;
              const tile = bldg.rows[dy][dx];
              if (tile >= 0) {
                objects[this.idx(bx + dx, by + dy)] = tile;
                const isDoor = (tile === 80 || tile === 57 || tile === 82 || tile === 94);
                collision[this.idx(bx + dx, by + dy)] = isDoor ? 0 : 1;
                if (isDoor) {
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
    // STEP 3b: Door clearance — keep 2 tiles below each door clear, connect to nearest path
    // ═══════════════════════════════════════════════════════════════════
    const doorClearZone = new Set(); // cells that must stay clear of trees/objects
    for (const door of doorPositions) {
      // Clear 2 tiles directly below the door (exit space)
      for (let dy = 1; dy <= 2; dy++) {
        if (this.inBounds(door.x, door.y + dy)) {
          const ci = this.idx(door.x, door.y + dy);
          objects[ci] = T.EMPTY; // clear any accidental objects
          foreground[ci] = T.EMPTY;
          collision[ci] = 0;
          doorClearZone.add(ci);
        }
      }
      // Connect door to nearest path — walk down from door until hitting a path cell
      let py = door.y + 1;
      while (py < this.H && !pathCells.has(this.idx(door.x, py))) {
        const ci = this.idx(door.x, py);
        if (!pathCells.has(ci)) {
          ground[ci] = pathMaterial;
          pathCells.add(ci);
          doorClearZone.add(ci);
        }
        py++;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Trees & Foreground — proper canopy/trunk pairs + clusters
    // Learned from painted map: trees are 2-cell vertical pairs on foreground
    //   canopy (top): 4,7,3,6,19,28 | trunk (bottom): 16,19,15,18,20,32
    // Dense clusters: 3-8 trees packed together (corners, edges)
    // Single trees: scattered in open areas
    // ═══════════════════════════════════════════════════════════════════

    // Tree type definitions: [canopy, trunk] pairs (both foreground layer)
    const TREE_TYPES = [
      { canopy: 4, trunk: 16, weight: 7 },    // green tree (most common)
      { canopy: 7, trunk: 19, weight: 5 },     // pine tree
      { canopy: 3, trunk: 15, weight: 4 },     // autumn tree
      { canopy: 28, trunk: -1, weight: 3 },    // bush/shrub (no trunk)
      { canopy: 20, trunk: -1, weight: 2 },    // small bush
      { canopy: 6, trunk: 18, weight: 1 },     // dark pine
      { canopy: 27, trunk: -1, weight: 1 },    // flower bush
      { canopy: 17, trunk: -1, weight: 1 },    // autumn bush
    ];
    // Build weighted pool
    const treePool = [];
    for (const tt of TREE_TYPES) {
      for (let i = 0; i < tt.weight; i++) treePool.push(tt);
    }

    // Helper: can place foreground at (x,y)?
    const canPlaceFg = (x, y) => {
      if (!this.inBounds(x, y)) return false;
      const i = this.idx(x, y);
      return foreground[i] === T.EMPTY && objects[i] === T.EMPTY
        && !pathCells.has(i) && !doorClearZone.has(i);
    };

    // Helper: place a single tree (canopy at x,y — trunk at x,y+1)
    const placeTree = (x, y, treeType) => {
      const ci = this.idx(x, y);
      foreground[ci] = treeType.canopy;
      if (treeType.trunk >= 0 && this.inBounds(x, y + 1)) {
        const ti = this.idx(x, y + 1);
        if (foreground[ti] === T.EMPTY && objects[ti] === T.EMPTY && !pathCells.has(ti)) {
          foreground[ti] = treeType.trunk;
        }
      }
    };

    // PHASE A: Dense forest clusters (2-4 clusters in corners/edges)
    const numClusters = Math.max(2, Math.round((d.treeClusters || 3) + (rng() - 0.5) * 2));
    const clusterZones = []; // track for spacing
    for (let ci = 0; ci < numClusters; ci++) {
      // Prefer edges/corners for dense clusters (like the painted map)
      let cx, cy;
      if (rng() < 0.6) {
        // Corner bias
        cx = rng() < 0.5 ? Math.floor(rng() * 3) : this.W - 1 - Math.floor(rng() * 3);
        cy = rng() < 0.5 ? Math.floor(rng() * 3) : this.H - 1 - Math.floor(rng() * 3);
      } else {
        cx = Math.floor(rng() * this.W);
        cy = Math.floor(rng() * this.H);
      }

      // Check not overlapping buildings
      let blocked = false;
      for (const p of placed) {
        if (cx >= p.x - 1 && cx <= p.x + p.w && cy >= p.y - 1 && cy <= p.y + p.h) { blocked = true; break; }
      }
      if (blocked) continue;

      // Pick a primary tree type for this cluster (clusters tend to be same species)
      const primaryType = treePool[Math.floor(rng() * treePool.length)];
      const clusterSize = 3 + Math.floor(rng() * 5); // 3-7 trees per cluster

      for (let ti = 0; ti < clusterSize; ti++) {
        const tx = cx + Math.floor((rng() - 0.5) * 4);
        const ty = cy + Math.floor((rng() - 0.5) * 3);
        if (!canPlaceFg(tx, ty)) continue;
        // 70% primary type, 30% variety
        const ttype = rng() < 0.7 ? primaryType : treePool[Math.floor(rng() * treePool.length)];
        placeTree(tx, ty, ttype);
      }
      clusterZones.push({ x: cx, y: cy });
    }

    // PHASE B: Single scattered trees in open areas
    const singleCount = Math.round(this.size * (d.singleTreeDensity || 0.04));
    for (let attempt = 0; attempt < singleCount * 5; attempt++) {
      const x = Math.floor(rng() * this.W);
      const y = Math.floor(rng() * (this.H - 1)); // leave room for trunk below
      if (!canPlaceFg(x, y)) continue;

      // Not too close to a cluster
      let nearCluster = false;
      for (const cz of clusterZones) {
        if (Math.abs(x - cz.x) < 3 && Math.abs(y - cz.y) < 3) { nearCluster = true; break; }
      }
      if (nearCluster) continue;

      const ttype = treePool[Math.floor(rng() * treePool.length)];
      placeTree(x, y, ttype);
    }

    // PHASE C: Fill remaining foreground budget with small decorations
    const gToFg = crossLayer.groundToForeground || {};
    const targetFg = Math.round(this.size * (d.fgDensity || 0.19));
    let currentFg = 0;
    for (let i = 0; i < this.size; i++) { if (foreground[i] !== T.EMPTY) currentFg++; }
    const remaining = targetFg - currentFg;
    const smallDecor = [28, 31, 32, 34, 27, 17, 20]; // bushes, flowers, small plants
    for (let attempt = 0; attempt < remaining * 4 && currentFg < targetFg; attempt++) {
      const x = Math.floor(rng() * this.W);
      const y = Math.floor(rng() * this.H);
      if (!canPlaceFg(x, y)) continue;
      foreground[this.idx(x, y)] = smallDecor[Math.floor(rng() * smallDecor.length)];
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

module.exports = { V2Engine, T, MATERIALS, MATERIAL_KEYS, generateBuilding, generateFence, TREE_TYPES, valueNoise };
