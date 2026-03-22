#!/usr/bin/env node
/**
 * generate-level.js — Sparkle Village Level Generator v2
 *
 * Complete rewrite: organic village layout with value noise grass,
 * proper path edges, mixed tree types with jittered placement,
 * and auto-generated foreground/collision layers.
 *
 * Reads tile-catalog.json and user-tile-groups.json.
 *
 * Usage:  node tools/generate-level.js [--seed=<number>]
 */

const fs = require('fs');
const path = require('path');

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let SEED = 42;
for (const arg of args) {
  const m = arg.match(/^--seed=(\d+)$/);
  if (m) SEED = parseInt(m[1], 10);
}
console.log(`[generate-level] seed=${SEED}`);

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Value noise with smoothstep interpolation ───────────────────────────────
function createNoiseGrid(w, h, scale) {
  const gw = Math.ceil(w / scale) + 2;
  const gh = Math.ceil(h / scale) + 2;
  const lattice = [];
  for (let i = 0; i < gh; i++) {
    lattice[i] = [];
    for (let j = 0; j < gw; j++) {
      lattice[i][j] = rand();
    }
  }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  const grid = [];
  for (let y = 0; y < h; y++) {
    grid[y] = [];
    for (let x = 0; x < w; x++) {
      const fx = x / scale;
      const fy = y / scale;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = smoothstep(fx - ix);
      const ty = smoothstep(fy - iy);
      const v00 = lattice[iy][ix];
      const v10 = lattice[iy][ix + 1];
      const v01 = lattice[iy + 1][ix];
      const v11 = lattice[iy + 1][ix + 1];
      grid[y][x] = lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
    }
  }
  return grid;
}

// ── Load data ───────────────────────────────────────────────────────────────
const toolsDir = path.dirname(__filename);
const catalog = JSON.parse(fs.readFileSync(path.join(toolsDir, 'tile-catalog.json'), 'utf8'));
const userGroups = JSON.parse(fs.readFileSync(path.join(toolsDir, 'user-tile-groups.json'), 'utf8'));

const tiles = catalog.tiles;
const tileMap = {};
for (const t of tiles) tileMap[t.id] = t;

// ── Constants ───────────────────────────────────────────────────────────────
const W = 60, H = 40;
const E = -1; // empty

// Ground tiles
const GR = 1;   // plain grass (70%)
const GR2 = 2;  // grass variant (~8%, subtle patches)
const GF = 43;  // flower grass (5% — ONLY in tiny clusters near buildings)

// Path tiles
const DP = 40;   // dirt path center
const DPL = 39;  // dirt path left/top edge
const DPR = 41;  // dirt path right/bottom edge

// 2x2 green tree composites
const CAN_GL = 4, CAN_GR_T = 5;  // green canopy L/R
const TB1 = 12, TB2 = 13;        // green tree trunk L/R

// 2x2 autumn tree composites
const CAN_AL = 7, CAN_AR = 8;    // autumn canopy L/R
const ATB1 = 24, ATB2 = 25;      // autumn tree trunk L/R

// Small 1x1 trees
const STR = 6;    // small green tree
const ST2 = 16;   // small complete tree
const STA = 9;    // small autumn tree
const FRT = 17;   // fruit tree

// Bushes and plants
const BSH = 28;   // green bush
const BBR = 29;   // berry bush
const FLB = 19;   // flower bush (purple)
const FRN = 18;   // small fern
const TLP = 15;   // orange tulip

// Pine/dense 1x2 trees
const PINE_TOP = 10, PINE_TRUNK = 22;
const DENSE_TOP = 11, DENSE_TRUNK = 23;

// Buildings
const RFL = 63, RFM = 64, RFR = 65, RFP = 67;
const WLL = 72, WLM = 73, WLD = 74, WLW = 75;
const SWL = 84, SWM = 85, SWD = 86, SWW = 87;
const FNL = 96, FNM = 97, FNR = 98;

// Water pond tiles
const WTL = 109, WTM = 110, WTR = 111;
const WML = 121, WMM = 122, WMR = 123;
const WBL = 120, WBM = 112, WBR = 113;

// Decorations
const WEL = 92, WEB = 104;
const BRL = 107, LNT = 93, CHT = 128;
const MSH = 102; // small mushroom

// Fence post
const FPT = 108;

// ── Create empty layers ─────────────────────────────────────────────────────
function makeLayer(fill) {
  const layer = [];
  for (let y = 0; y < H; y++) {
    layer[y] = [];
    for (let x = 0; x < W; x++) {
      layer[y][x] = fill;
    }
  }
  return layer;
}

const ground = makeLayer(GR);
const objects = makeLayer(E);
const collision = makeLayer(0);
const foreground = makeLayer(E);

// ── Helpers ─────────────────────────────────────────────────────────────────
function isOccupied(y, x) {
  if (y < 0 || y >= H || x < 0 || x >= W) return true;
  return objects[y][x] !== E;
}

function setObj(y, x, tile) {
  if (y >= 0 && y < H && x >= 0 && x < W) {
    objects[y][x] = tile;
  }
}
function setFG(y, x, tile) {
  if (y >= 0 && y < H && x >= 0 && x < W) {
    foreground[y][x] = tile;
  }
}

function isPathCell(y, x) {
  if (y < 0 || y >= H || x < 0 || x >= W) return false;
  const g = ground[y][x];
  return g === DP || g === DPL || g === DPR;
}

function nearPath(y, x, buffer) {
  for (let dy = -buffer; dy <= buffer; dy++) {
    for (let dx = -buffer; dx <= buffer; dx++) {
      if (isPathCell(y + dy, x + dx)) return true;
    }
  }
  return false;
}

function canPlaceSmall(y, x) {
  if (y < 0 || y >= H || x < 0 || x >= W) return false;
  if (isOccupied(y, x)) return false;
  if (isPathCell(y, x)) return false;
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// PASS 1: GROUND LAYER — value noise for natural grass variation
// ══════════════════════════════════════════════════════════════════════════════

const noise = createNoiseGrid(W, H, 7);   // broad terrain contour
const noise2 = createNoiseGrid(W, H, 3);  // fine detail overlay

// Flower clusters — intentional 2-3 tile groups ONLY near buildings/POIs
const flowerPatches = [
  // Grandma's garden (NW)
  { x: 11, y: 9 },  { x: 12, y: 9 },  { x: 12, y: 10 },
  // Baker's window boxes (NE)
  { x: 43, y: 10 }, { x: 44, y: 10 }, { x: 44, y: 11 },
  // Lily's cottage garden (SW)
  { x: 10, y: 30 }, { x: 11, y: 30 }, { x: 10, y: 31 },
  // Village center near well
  { x: 27, y: 16 }, { x: 28, y: 16 }, { x: 27, y: 17 },
  // Pond waterside flowers
  { x: 46, y: 21 }, { x: 47, y: 21 }, { x: 48, y: 21 },
  // Playground flower border (SE)
  { x: 45, y: 32 }, { x: 46, y: 32 },
];
const flowerSet = new Set(flowerPatches.map(fp => `${fp.x},${fp.y}`));

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // Blend two noise octaves: 70% broad + 30% fine
    const n = noise[y][x] * 0.7 + noise2[y][x] * 0.3;

    if (flowerSet.has(`${x},${y}`)) {
      ground[y][x] = GF;  // intentional flower cluster
    } else if (n > 0.82) {
      ground[y][x] = GR2;  // grass variant (~8%, subtle patches only)
    } else {
      ground[y][x] = GR;   // plain grass (~90%)
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PASS 2: PATHS — main roads and branch paths to buildings
// ══════════════════════════════════════════════════════════════════════════════

// Main N-S road: cols 29(left edge) - 30(right edge), rows 4 to bottom
for (let y = 4; y < H; y++) {
  ground[y][29] = DPL;
  ground[y][30] = DPR;
}

// Main E-W road: rows 19(top edge) - 20(bottom edge), cols 4 to 55
for (let x = 4; x <= 55; x++) {
  ground[19][x] = DPL;
  ground[20][x] = DPR;
}

// Intersection fills at E-W / N-S cross
ground[19][29] = DP; ground[19][30] = DP;
ground[20][29] = DP; ground[20][30] = DP;

// Branch to Grandma (NW): rows 9-10, cols 10-29
for (let x = 10; x <= 28; x++) {
  ground[9][x] = DPL;
  ground[10][x] = DPR;
}
// Branch to Baker (NE): rows 9-10, cols 31-46
for (let x = 31; x <= 46; x++) {
  ground[9][x] = DPL;
  ground[10][x] = DPR;
}
// Branch intersection at N-S
ground[9][29] = DP; ground[9][30] = DP;
ground[10][29] = DP; ground[10][30] = DP;

// Branch to Lily (SW): rows 31-32, cols 10-29
for (let x = 10; x <= 28; x++) {
  ground[31][x] = DPL;
  ground[32][x] = DPR;
}
// Branch to Playground (SE): rows 31-32, cols 31-46
for (let x = 31; x <= 46; x++) {
  ground[31][x] = DPL;
  ground[32][x] = DPR;
}
// Branch intersection at N-S
ground[31][29] = DP; ground[31][30] = DP;
ground[32][29] = DP; ground[32][30] = DP;

// ══════════════════════════════════════════════════════════════════════════════
// PASS 3: BUILDINGS — same positions as original level
// ══════════════════════════════════════════════════════════════════════════════

// Grandma's House (medium_house): roof row 6 cols 8-11, walls row 7 cols 8-11
setObj(6, 8, RFL); setObj(6, 9, RFM); setObj(6, 10, RFM); setObj(6, 11, RFR);
setObj(7, 8, WLL); setObj(7, 9, WLW); setObj(7, 10, WLD); setObj(7, 11, WLM);

// Grandma's fence: row 8, cols 7-13, gate at col 10 (aligned with door)
setObj(8, 7, FNL); setObj(8, 8, FNM); setObj(8, 9, FNM);
/* gate at 10 = empty */ setObj(8, 11, FNM); setObj(8, 12, FNM); setObj(8, 13, FNR);

// Baker's Shop (stone_shop_large): roof row 7 cols 42-46, walls row 8 cols 42-46
setObj(7, 42, RFL); setObj(7, 43, RFM); setObj(7, 44, RFP); setObj(7, 45, RFM); setObj(7, 46, RFR);
setObj(8, 42, SWL); setObj(8, 43, SWW); setObj(8, 44, SWD); setObj(8, 45, SWM); setObj(8, 46, SWW);
// Lantern + barrel beside baker
setObj(8, 41, LNT); setObj(8, 47, BRL);

// Lily's Cottage (small_house): roof row 27 cols 8-10, walls row 28 cols 8-10
setObj(27, 8, RFL); setObj(27, 9, RFM); setObj(27, 10, RFR);
setObj(28, 8, WLL); setObj(28, 9, WLD); setObj(28, 10, WLM);

// Lily's fence: row 29 cols 7-11, gate at 9
setObj(29, 7, FNL); setObj(29, 8, FNM);
/* gate at 9 */ setObj(29, 10, FNM); setObj(29, 11, FNR);

// ══════════════════════════════════════════════════════════════════════════════
// PASS 4: WATER & STRUCTURES
// ══════════════════════════════════════════════════════════════════════════════

// Well: village center intersection, col 29, rows 17-18
setObj(17, 29, WEL); setObj(18, 29, WEB);

// Pond: 4x3 (large_pond), cols 45-48, rows 18-20
setObj(18, 45, WTL); setObj(18, 46, WTM); setObj(18, 47, WTM); setObj(18, 48, WTR);
setObj(19, 45, WML); setObj(19, 46, WMM); setObj(19, 47, WMM); setObj(19, 48, WMR);
setObj(20, 45, WBL); setObj(20, 46, WBM); setObj(20, 47, WBM); setObj(20, 48, WBR);

// Treasure chest: col 48, row 33
setObj(33, 48, CHT);

// ══════════════════════════════════════════════════════════════════════════════
// PASS 5: FIXED DECORATIONS — flowers, lanterns, barrels near buildings
// ══════════════════════════════════════════════════════════════════════════════

// Grandma area
setObj(6, 6, FLB); setObj(6, 13, FLB);
setObj(9, 8, FLB); setObj(9, 12, FLB);
setObj(10, 9, LNT);
setObj(9, 14, TLP); setObj(10, 7, FRN);

// Village center decorations
setObj(15, 24, FLB); setObj(15, 33, FLB);
setObj(16, 25, LNT); setObj(16, 34, LNT);
setObj(17, 26, FLB); setObj(17, 32, FLB);
setObj(18, 27, LNT);
setObj(16, 28, MSH); setObj(16, 31, FRN);

// Pond surrounding plants
setObj(17, 44, FLB); setObj(17, 49, FLB);
setObj(21, 44, FRN); setObj(21, 46, FLB); setObj(21, 48, BBR);
setObj(18, 49, BSH); setObj(20, 49, FRN);

// Lily area decorations
setObj(27, 6, FLB); setObj(27, 12, FLB);
setObj(28, 5, BSH); setObj(28, 13, BSH);
setObj(30, 7, FLB); setObj(30, 9, FLB);
setObj(26, 11, TLP); setObj(26, 7, FRN);

// Playground / Park (SE)
setObj(27, 42, STR); setObj(27, 46, ST2);
setObj(28, 41, FLB); setObj(28, 44, FLB); setObj(28, 49, STR); setObj(28, 52, FLB);
setObj(29, 43, BBR); setObj(29, 47, BBR);
setObj(30, 45, FRN); setObj(30, 50, MSH);

// Baker area extra decoration
setObj(9, 42, BRL); setObj(9, 46, FLB);
setObj(10, 40, FRN); setObj(10, 48, BBR);

// ══════════════════════════════════════════════════════════════════════════════
// PASS 6: TREES — organic placement with mixed types
// ══════════════════════════════════════════════════════════════════════════════

// Clearance zones — buildings, paths, structures (no trees here)
const clearanceZones = [
  { cx: 10, cy: 7, r: 8 },   // Grandma
  { cx: 44, cy: 8, r: 8 },   // Baker
  { cx: 9, cy: 28, r: 8 },   // Lily
  { cx: 29, cy: 17, r: 6 },  // Well
  { cx: 47, cy: 19, r: 7 },  // Pond
  { cx: 30, cy: 19, r: 5 },  // Village center
  { cx: 46, cy: 30, r: 6 },  // Playground
];

function inClearanceZone(y, x) {
  for (const z of clearanceZones) {
    const d = Math.sqrt((x - z.cx) ** 2 + (y - z.cy) ** 2);
    if (d < z.r) return true;
  }
  return false;
}

function canPlaceRect(y, x, w, h, pathBuffer) {
  pathBuffer = pathBuffer || 3;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const ny = y + dy, nx = x + dx;
      if (ny < 0 || ny >= H || nx < 0 || nx >= W) return false;
      if (isOccupied(ny, nx)) return false;
      if (isPathCell(ny, nx)) return false;
    }
  }
  // Check path buffer for all cells of the tree footprint
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (nearPath(y + dy, x + dx, pathBuffer)) return false;
    }
  }
  if (inClearanceZone(y + Math.floor(h / 2), x + Math.floor(w / 2))) return false;
  return true;
}

// ── Tree type definitions ───────────────────────────────────────────────────
// Each has: w, h (footprint), place(y, x) function

const treeTypes = {
  // 2x2 green tree (catalog composite — canopy on foreground, trunks on objects)
  greenTree2x2: {
    w: 2, h: 2,
    place(y, x) {
      setObj(y + 1, x, TB1); setObj(y + 1, x + 1, TB2);
      setFG(y, x, CAN_GL); setFG(y, x + 1, CAN_GR_T);
    },
  },
  // 2x2 autumn tree
  autumnTree2x2: {
    w: 2, h: 2,
    place(y, x) {
      setObj(y + 1, x, ATB1); setObj(y + 1, x + 1, ATB2);
      setFG(y, x, CAN_AL); setFG(y, x + 1, CAN_AR);
    },
  },
  // User group: Tree1 (1x2 — tiles 3 top, 15 bottom)
  tree1_1x2: {
    w: 1, h: 2,
    place(y, x) {
      setFG(y, x, 3);
      setObj(y + 1, x, 15);
    },
  },
  // User group: Tree2 (1x2 — tiles 4 top, 16 bottom)
  tree2_1x2: {
    w: 1, h: 2,
    place(y, x) {
      setFG(y, x, 4);
      setObj(y + 1, x, 16);
    },
  },
  // User group: Tree_group1 (3x3 — sparse with center trunk column)
  treeGroup1_3x3: {
    w: 3, h: 3,
    place(y, x) {
      // Row 0: [-1, 7, -1]  (7 = autumn canopy top-left -> foreground)
      setFG(y, x + 1, 7);
      // Row 1: [18, 19, 20]
      setObj(y + 1, x, 18); setObj(y + 1, x + 1, 19); setObj(y + 1, x + 2, 20);
      // Row 2: [-1, 31, -1]
      setObj(y + 2, x + 1, 31);
    },
  },
  // User group: Tree_group2 (3x3 — pine cluster)
  treeGroup2_3x3: {
    w: 3, h: 3,
    place(y, x) {
      // Row 0: [-1, 10, -1]  (10 = pine tree top -> foreground)
      setFG(y, x + 1, 10);
      // Row 1: [21, 22, 23]
      setObj(y + 1, x, 21); setObj(y + 1, x + 1, 22); setObj(y + 1, x + 2, 23);
      // Row 2: [-1, 34, -1]
      setObj(y + 2, x + 1, 34);
    },
  },
  // Pine tree 1x2
  pineTree1x2: {
    w: 1, h: 2,
    place(y, x) {
      setFG(y, x, PINE_TOP);
      setObj(y + 1, x, PINE_TRUNK);
    },
  },
  // Dense tree 1x2
  denseTree1x2: {
    w: 1, h: 2,
    place(y, x) {
      setFG(y, x, DENSE_TOP);
      setObj(y + 1, x, DENSE_TRUNK);
    },
  },
};

const smallTreeTiles = [STR, ST2, STA, FRT]; // 6, 16, 9, 17
const bushTiles = [BSH, BBR]; // 28, 29
const plantTiles = [FRN, FLB, TLP]; // 18, 19, 15

// ── Weighted tree type picker ───────────────────────────────────────────────
// ~25% each of the 4 user groups, plus 2x2 composites mixed in
function pickTreeType(allowLarge) {
  const roll = rand();
  if (allowLarge && roll < 0.12) {
    return rand() < 0.5 ? 'treeGroup1_3x3' : 'treeGroup2_3x3';
  } else if (roll < 0.30) {
    return rand() < 0.55 ? 'greenTree2x2' : 'autumnTree2x2';
  } else if (roll < 0.50) {
    return 'tree1_1x2';
  } else if (roll < 0.65) {
    return 'tree2_1x2';
  } else if (roll < 0.78) {
    return 'pineTree1x2';
  } else if (roll < 0.88) {
    return 'denseTree1x2';
  } else {
    return null; // small 1x1 or bush
  }
}

// ── BORDER TREES — dense irregular forest edges (rows 0-3, 37-39, cols 0-3, 56-59) ──

function placeBorderTrees() {
  // Top border (rows 0-3)
  placeTreeStrip(0, 3, 0, W - 1, 1, 3, true);
  // Bottom border (rows 37-39)
  placeTreeStrip(37, 39, 0, W - 1, 1, 3, true);
  // Left border (cols 0-3, rows 4-36)
  placeTreeStripVertical(4, 36, 0, 3, 2, 4);
  // Right border (cols 56-59, rows 4-36)
  placeTreeStripVertical(4, 36, 56, 59, 2, 4);
}

function placeTreeStrip(rowStart, rowEnd, colStart, colEnd, gapMin, gapMax, horizontal) {
  let x = colStart;
  while (x <= colEnd) {
    const gap = randInt(gapMin, gapMax);
    x += gap;
    if (x > colEnd - 1) break;

    // Skip south exit gap at cols 28-32
    if (rowStart >= 37 && x >= 28 && x <= 32) {
      x = 33;
      continue;
    }

    const treeKey = pickTreeType(true);
    if (treeKey === null) {
      // Small 1x1
      const ty = randInt(rowStart, rowEnd);
      if (canPlaceSmall(ty, x)) {
        setObj(ty, x, pick(rand() < 0.6 ? smallTreeTiles : bushTiles));
      }
      x += 1;
    } else {
      const tree = treeTypes[treeKey];
      let placed = false;
      // Try each valid starting row in the strip
      const rows = [];
      for (let r = rowStart; r <= rowEnd - tree.h + 1; r++) rows.push(r);
      for (const tryRow of shuffle(rows)) {
        if (canPlaceRect(tryRow, x, tree.w, tree.h, 1)) {
          tree.place(tryRow, x);
          placed = true;
          break;
        }
      }
      x += placed ? tree.w + randInt(0, 1) : 1;
    }
  }
}

function placeTreeStripVertical(rowStart, rowEnd, colStart, colEnd, gapMin, gapMax) {
  let y = rowStart;
  while (y <= rowEnd) {
    const gap = randInt(gapMin, gapMax);
    y += gap;
    if (y > rowEnd - 1) break;

    const col = randInt(colStart, colEnd);
    const treeKey = pickTreeType(false);

    if (treeKey === null) {
      if (canPlaceSmall(y, col)) {
        setObj(y, col, pick(rand() < 0.6 ? smallTreeTiles : bushTiles));
      }
    } else {
      const tree = treeTypes[treeKey];
      // Try a few column positions for variety
      let placed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const tryCol = randInt(colStart, Math.min(colEnd, colEnd - tree.w + 1));
        if (canPlaceRect(y, tryCol, tree.w, tree.h, 2)) {
          tree.place(y, tryCol);
          placed = true;
          break;
        }
      }
    }
  }
}

// ── INTERIOR TREES — grove clusters with organic placement ──────────────────

function placeInteriorTrees() {
  // Define grove center points — natural clearings will form between them
  const groveCandidates = [];
  for (let i = 0; i < 20; i++) {
    const gx = randInt(6, W - 7);
    const gy = randInt(6, H - 7);
    if (!inClearanceZone(gy, gx) && !nearPath(gy, gx, 5)) {
      groveCandidates.push({ x: gx, y: gy, radius: randInt(3, 7), trees: randInt(2, 5) });
    }
  }

  for (const grove of groveCandidates) {
    for (let i = 0; i < grove.trees; i++) {
      // Jittered position around grove center
      const angle = rand() * Math.PI * 2;
      const dist = rand() * grove.radius;
      const tx = Math.round(grove.x + Math.cos(angle) * dist);
      const ty = Math.round(grove.y + Math.sin(angle) * dist);

      if (tx < 1 || tx >= W - 3 || ty < 1 || ty >= H - 3) continue;
      if (inClearanceZone(ty, tx)) continue;

      const treeKey = pickTreeType(true);

      if (treeKey === null) {
        if (canPlaceSmall(ty, tx)) {
          setObj(ty, tx, pick(smallTreeTiles));
        }
      } else {
        const tree = treeTypes[treeKey];
        if (canPlaceRect(ty, tx, tree.w, tree.h, 3)) {
          tree.place(ty, tx);
        }
      }
    }

    // Add 1-2 understory plants near each grove
    for (let p = 0; p < randInt(1, 2); p++) {
      const px = grove.x + randInt(-2, 2);
      const py = grove.y + randInt(-2, 2);
      if (canPlaceSmall(py, px) && !nearPath(py, px, 2) && !inClearanceZone(py, px)) {
        setObj(py, px, pick(plantTiles));
      }
    }
  }

  // Scatter a few solitary trees in open meadow areas
  for (let i = 0; i < 12; i++) {
    const sx = randInt(6, W - 7);
    const sy = randInt(6, H - 7);
    if (canPlaceSmall(sy, sx) && !inClearanceZone(sy, sx) && !nearPath(sy, sx, 3)) {
      setObj(sy, sx, pick(smallTreeTiles));
    }
  }

  // Scatter a few bushes/ferns in open areas
  for (let i = 0; i < 10; i++) {
    const bx = randInt(5, W - 6);
    const by = randInt(5, H - 6);
    if (canPlaceSmall(by, bx) && !inClearanceZone(by, bx) && !nearPath(by, bx, 2)) {
      setObj(by, bx, pick([...bushTiles, ...plantTiles]));
    }
  }
}

// ── Treasure tree (hiding the chest) ────────────────────────────────────────
function placeTreasureTree() {
  // Green 2x2 tree: trunks at row 34 cols 48-49, canopy at row 33 cols 48-49
  if (!isOccupied(34, 48) && !isOccupied(34, 49)) {
    setObj(34, 48, TB1);
    setObj(34, 49, TB2);
    setFG(33, 48, CAN_GL);
    setFG(33, 49, CAN_GR_T);
  }
}

// ── Execute all tree placement ──────────────────────────────────────────────
placeBorderTrees();
placeInteriorTrees();
placeTreasureTree();

// ══════════════════════════════════════════════════════════════════════════════
// PASS 7: COLLISION LAYER — auto-generate from objects + catalog walkable flags
// ══════════════════════════════════════════════════════════════════════════════

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const tileId = objects[y][x];
    if (tileId === E) {
      collision[y][x] = 0; // empty = walkable
    } else {
      const info = tileMap[tileId];
      if (info) {
        collision[y][x] = info.walkable ? 0 : 1;
      } else {
        collision[y][x] = 1; // unknown = blocked
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// OUTPUT — generate the JS level file
// ══════════════════════════════════════════════════════════════════════════════

function formatRow(row, indent) {
  return indent + '[' + row.join(',') + ']';
}

function formatLayer(layer, name) {
  const lines = [];
  for (let y = 0; y < H; y++) {
    lines.push(formatRow(layer[y], '  '));
  }
  return `const ${name} = grid([\n${lines.join(',\n')}\n]);`;
}

const outputLines = [];

outputLines.push(`/**
 * level-sparkle-village.js — Sparkle Village for Princess Sparkle V2
 *
 * AUTO-GENERATED by tools/generate-level.js (seed=${SEED})
 * Do not hand-edit — re-run the generator instead.
 *
 * 60x40 tile grid (960x640 pixels — 4x the viewport, camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Tile IDs reference the Kenney Tiny Town tileset (tilemap_packed.png):
 *   192x176 PNG, 12 columns x 11 rows of 16x16 tiles = 132 tiles.
 *   Tile ID = row * 12 + col.
 *
 * DEPTH LAYERS:
 *   ground     — Every cell filled: grass varieties + dirt paths
 *   objects    — Buildings, fences, tree trunks, furniture (-1 = empty)
 *   collision  — 0 = walkable, 1 = blocked
 *   foreground — Tree canopies drawn OVER entities for depth (-1 = empty)
 */

// ── Helper ──────────────────────────────────────────────────────────────────
function grid(rows) {
  const arr = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      arr.push(rows[y][x]);
    }
  }
  return arr;
}
`);

// Ground layer
outputLines.push('// ── GROUND LAYER (60x40 = 2400 tiles) ──────────────────────────────────────');
outputLines.push('// prettier-ignore');
outputLines.push(formatLayer(ground, 'ground'));
outputLines.push('');

// Objects layer
outputLines.push('// ── OBJECTS LAYER (60x40 = 2400 tiles) ─────────────────────────────────────');
outputLines.push('// prettier-ignore');
outputLines.push(formatLayer(objects, 'objects'));
outputLines.push('');

// Collision layer
outputLines.push('// ── COLLISION LAYER (60x40 = 2400 tiles) ───────────────────────────────────');
outputLines.push('// prettier-ignore');
outputLines.push(formatLayer(collision, 'collision'));
outputLines.push('');

// Foreground layer
outputLines.push('// ── FOREGROUND LAYER (60x40 = 2400 tiles) ──────────────────────────────────');
outputLines.push('// prettier-ignore');
outputLines.push(formatLayer(foreground, 'foreground'));
outputLines.push('');

// ══════════════════════════════════════════════════════════════════════════════
// ENTITY DATA — kept VERBATIM from original level
// ══════════════════════════════════════════════════════════════════════════════

outputLines.push(`// ── NPCs ──────────────────────────────────────────────────────────────────

const npcs = [
  {
    id: 'grandma-rose',
    name: 'Grandma Rose',
    spriteName: 'npc_grandma',
    homeX: 10,
    homeY: 11,
    wanderRadius: 4,
    personality: 'warm',
    dialogueId: 'grandma-rose-greeting',
    ambientLines: [
      'voice_grandma_ambient_01',
      'voice_grandma_ambient_02',
      'voice_grandma_ambient_03',
    ],
    sillyBehaviors: ['loses_glasses', 'hums_tune', 'talks_to_flowers'],
  },
  {
    id: 'neighbor-lily',
    name: 'Neighbor Lily',
    spriteName: 'npc_lily',
    homeX: 9,
    homeY: 30,
    wanderRadius: 3,
    personality: 'cheerful',
    dialogueId: 'lily-greeting',
    ambientLines: [
      'voice_lily_ambient_01',
      'voice_lily_ambient_02',
    ],
    sillyBehaviors: ['waters_wrong_plant', 'talks_to_flowers', 'hangs_laundry'],
  },
  {
    id: 'little-finn',
    name: 'Little Finn',
    spriteName: 'npc_finn',
    homeX: 44,
    homeY: 30,
    wanderRadius: 4,
    personality: 'playful',
    dialogueId: 'finn-greeting',
    ambientLines: [
      'voice_finn_ambient_01',
      'voice_finn_ambient_02',
    ],
    sillyBehaviors: ['chases_butterfly', 'trips_over_rock', 'draws_in_dirt', 'kite_stuck'],
  },
  {
    id: 'baker-maple',
    name: 'Baker Maple',
    spriteName: 'npc_baker',
    homeX: 44,
    homeY: 11,
    wanderRadius: 3,
    personality: 'jolly',
    dialogueId: 'baker-maple-greeting',
    ambientLines: [
      'voice_baker_ambient_01',
      'voice_baker_ambient_02',
    ],
    sillyBehaviors: ['drops_pie', 'sleeping_standing', 'flour_sneeze'],
  },
];
`);

outputLines.push(`// ── World Objects (tappable) ──────────────────────────────────────────────

const worldObjects = [
  // Grandma's area (NW)
  { type: 'WIND_CHIMES',   x: 10, y: 6,  id: 'wind-chimes-01' },
  { type: 'GARDEN_PLOT',   x: 12, y: 9,  id: 'garden-plot-01' },
  { type: 'FLOWER_BIG',    x: 6,  y: 6,  id: 'flower-big-01' },
  { type: 'FLOWER_BIG',    x: 13, y: 6,  id: 'flower-big-02' },
  { type: 'MAILBOX',       x: 10, y: 10, id: 'mailbox-grandma' },
  { type: 'LANTERN',       x: 9,  y: 10, id: 'lantern-grandma' },

  // Meadow flowers (top area)
  { type: 'FLOWER_SMALL',  x: 10, y: 4,  id: 'flower-meadow-01' },
  { type: 'FLOWER_SMALL',  x: 20, y: 3,  id: 'flower-meadow-02' },
  { type: 'FLOWER_SMALL',  x: 35, y: 4,  id: 'flower-meadow-03' },
  { type: 'DANDELION',     x: 50, y: 3,  id: 'dandelion-meadow-01' },

  // Village center / well area
  { type: 'WELL',          x: 29, y: 17, id: 'village-well' },
  { type: 'LANTERN',       x: 27, y: 18, id: 'lantern-well' },
  { type: 'LANTERN',       x: 25, y: 16, id: 'lantern-square-01' },
  { type: 'LANTERN',       x: 34, y: 16, id: 'lantern-square-02' },
  { type: 'FLOWER_BIG',    x: 24, y: 15, id: 'flower-square-01' },
  { type: 'FLOWER_BIG',    x: 33, y: 15, id: 'flower-square-02' },
  { type: 'FLOWER_SMALL',  x: 26, y: 17, id: 'flower-square-03' },

  // Baker's area (NE)
  { type: 'APPLE_BASKET',  x: 48, y: 8,  id: 'apple-basket-baker' },
  { type: 'FLOWER_SMALL',  x: 40, y: 9,  id: 'flower-baker-01' },
  { type: 'DANDELION',     x: 48, y: 9,  id: 'dandelion-baker' },
  { type: 'LANTERN',       x: 41, y: 8,  id: 'lantern-baker' },
  { type: 'FLOWER_SMALL',  x: 49, y: 7,  id: 'flower-baker-02' },

  // Lily's area (SW)
  { type: 'HANGING_LAUNDRY', x: 12, y: 28, id: 'laundry-lily' },
  { type: 'MAILBOX',       x: 9,  y: 30, id: 'mailbox-lily' },
  { type: 'FLOWER_SMALL',  x: 7,  y: 30, id: 'flower-lily-01' },
  { type: 'FLOWER_BIG',    x: 9,  y: 30, id: 'flower-lily-02' },

  // Pond area
  { type: 'POND',          x: 47, y: 19, id: 'village-pond' },
  { type: 'FLOWER_SMALL',  x: 45, y: 21, id: 'flower-pond-01' },
  { type: 'FLOWER_SMALL',  x: 49, y: 18, id: 'flower-pond-02' },
  { type: 'FLOWER_BIG',    x: 47, y: 21, id: 'flower-pond-03' },

  // Playground/Park (SE)
  { type: 'TREASURE_CHEST', x: 48, y: 33, id: 'chest-hidden' },
  { type: 'DANDELION',     x: 50, y: 28, id: 'dandelion-park' },
  { type: 'FLOWER_SMALL',  x: 41, y: 28, id: 'flower-park-01' },

  // Scattered
  { type: 'FLOWER_SMALL',  x: 52, y: 4,  id: 'flower-east-01' },
  { type: 'FLOWER_SMALL',  x: 3,  y: 35, id: 'flower-south-01' },
];
`);

outputLines.push(`// ── Ambient Animals ───────────────────────────────────────────────────────

const animals = [
  // Butterflies
  { type: 'BUTTERFLY', x: 10,  y: 5,   spriteName: 'butterfly', zone: { x: 5,  y: 3,  w: 15, h: 6 } },
  { type: 'BUTTERFLY', x: 36,  y: 4,   spriteName: 'butterfly', zone: { x: 30, y: 2,  w: 15, h: 6 } },
  { type: 'BUTTERFLY', x: 8,   y: 29,  spriteName: 'butterfly', zone: { x: 5, y: 27, w: 10, h: 5 } },
  { type: 'BUTTERFLY', x: 45,  y: 28,  spriteName: 'butterfly', zone: { x: 40, y: 26, w: 12, h: 5 } },

  // Birds
  { type: 'BIRD', x: 3,   y: 3,   spriteName: 'bird', zone: { x: 0,  y: 1,  w: 10, h: 6 } },
  { type: 'BIRD', x: 55,  y: 5,   spriteName: 'bird', zone: { x: 50, y: 3,  w: 10, h: 6 } },
  { type: 'BIRD', x: 5,   y: 14,  spriteName: 'bird', zone: { x: 2,  y: 12, w: 8,  h: 5 } },

  // Cat
  { type: 'CAT', x: 46,  y: 11,  spriteName: 'cat', zone: { x: 42, y: 9, w: 10, h: 5 } },

  // Frogs
  { type: 'FROG', x: 45,  y: 20,  spriteName: 'frog', zone: { x: 43, y: 18, w: 8, h: 5 } },
  { type: 'FROG', x: 50,  y: 19,  spriteName: 'frog', zone: { x: 47, y: 17, w: 6, h: 4 } },

  // Ducks
  { type: 'DUCK', x: 47,  y: 19,  spriteName: 'duck', zone: { x: 45, y: 18, w: 6, h: 4 } },

  // Dog
  { type: 'DOG', x: 46,  y: 30,  spriteName: 'dog', zone: { x: 42, y: 28, w: 10, h: 4 } },

  // Squirrel
  { type: 'SQUIRREL', x: 5,  y: 13, spriteName: 'squirrel', zone: { x: 2, y: 11, w: 8, h: 5 } },

  // Ladybug
  { type: 'LADYBUG', x: 8,  y: 30, spriteName: 'ladybug', zone: { x: 5, y: 27, w: 8, h: 5 } },

  // Bunny
  { type: 'BUNNY', x: 25,  y: 5,  spriteName: 'bunny', zone: { x: 20, y: 3, w: 12, h: 5 } },

  // Extra bird
  { type: 'BIRD', x: 50,  y: 37, spriteName: 'bird', zone: { x: 45, y: 35, w: 10, h: 4 } },

  // Superdark Forest Creatures
  // Bear near south trees
  { type: 'BEAR', x: 8,  y: 35, spriteName: 'bear', zone: { x: 3, y: 33, w: 12, h: 6 } },

  // Mushroom creatures near pond/forest edge
  { type: 'MUSHROOM', x: 43, y: 22, spriteName: 'mushroom', zone: { x: 40, y: 20, w: 8, h: 5 } },
  { type: 'MUSHROOM', x: 48, y: 24, spriteName: 'mushroom', zone: { x: 45, y: 22, w: 8, h: 5 } },

  // Ent near tree groves
  { type: 'ENT', x: 5,  y: 23, spriteName: 'ent', zone: { x: 2, y: 21, w: 10, h: 6 } },

  // Forest Guardian — hidden discovery creature in NE corner
  { type: 'FOREST_GUARDIAN', x: 55, y: 3, spriteName: 'forest_guardian', zone: { x: 52, y: 1, w: 7, h: 5 } },
];
`);

outputLines.push(`// ── Quests ────────────────────────────────────────────────────────────────

const quests = [
  {
    id: 'sharing-is-caring',
    name: 'Sharing is Caring',
    giverNpcId: 'grandma-rose',
    value: 'sharing',
    heartReward: 3,
    bridgeColor: '#ff9ec4',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'grandma-rose',
        dialogueId: 'sharing-start',
        description: 'voice_quest_sharing_start',
      },
      {
        type: 'PICKUP',
        targetId: 'cookies-item',
        pickupX: 12,
        pickupY: 9,
        itemId: 'cookies',
        dialogueId: 'sharing-pickup',
        description: 'voice_quest_sharing_pickup',
      },
      {
        type: 'DELIVER',
        targetId: 'neighbor-lily',
        itemId: 'cookies',
        dialogueId: 'sharing-deliver',
        description: 'voice_quest_sharing_deliver',
      },
      {
        type: 'RETURN_TO',
        targetId: 'grandma-rose',
        dialogueId: 'sharing-complete',
        description: 'voice_quest_sharing_complete',
      },
    ],
  },
  {
    id: 'being-brave-together',
    name: 'Being Brave Together',
    giverNpcId: 'little-finn',
    value: 'bravery',
    heartReward: 3,
    bridgeColor: '#7ec8e3',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'little-finn',
        dialogueId: 'brave-start',
        description: 'voice_quest_brave_start',
      },
      {
        type: 'ENCOURAGE',
        targetId: 'little-finn',
        dialogueId: 'brave-encourage',
        description: 'voice_quest_brave_encourage',
      },
      {
        type: 'OBSERVE',
        targetId: 'chest-hidden',
        dialogueId: 'brave-observe',
        description: 'voice_quest_brave_observe',
      },
      {
        type: 'RETURN_TO',
        targetId: 'little-finn',
        dialogueId: 'brave-complete',
        description: 'voice_quest_brave_complete',
      },
    ],
  },
];
`);

outputLines.push(`// ── Dialogues ─────────────────────────────────────────────────────────────

const dialogues = {
  'grandma-rose-greeting': {
    startId: 'g1',
    nodes: {
      g1: {
        id: 'g1',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_greeting',
        text: 'Oh hello, dear Princess! My, what a beautiful day for a visit. My garden is blooming so nicely today!',
        next: null,
        expression: 'happy',
      },
    },
  },

  'lily-greeting': {
    startId: 'l1',
    nodes: {
      l1: {
        id: 'l1',
        portrait: 'npc_lily',
        name: 'Neighbor Lily',
        voiceId: 'voice_lily_greeting',
        text: 'Well hello there, Princess! Oh, your companion is so cute! Come visit anytime, my door is always open!',
        next: null,
        expression: 'happy',
      },
    },
  },

  'finn-greeting': {
    startId: 'f1',
    nodes: {
      f1: {
        id: 'f1',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_greeting',
        text: 'Hi Princess! Want to play? I like climbing and running and... oh look, a butterfly!',
        next: null,
        expression: 'excited',
      },
    },
  },

  'baker-maple-greeting': {
    startId: 'b1',
    nodes: {
      b1: {
        id: 'b1',
        portrait: 'npc_baker',
        name: 'Baker Maple',
        voiceId: 'voice_baker_greeting',
        text: 'Welcome to my bakery, little one! The whole village loves my fresh bread. Would you like to smell? Mmm, doesn\\'t that smell yummy?',
        next: null,
        expression: 'happy',
      },
    },
  },

  'sharing-start': {
    startId: 'sc1',
    nodes: {
      sc1: {
        id: 'sc1',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_sharing_01',
        text: 'Princess, I just baked the most wonderful cookies! They are warm and golden and smell like sunshine.',
        next: 'sc2',
        expression: 'happy',
      },
      sc2: {
        id: 'sc2',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_sharing_02',
        text: 'But you know what makes cookies even more special? Sharing them! My neighbor Lily has been feeling a little lonely. Could you bring her some cookies from my garden table?',
        next: 'sc3',
        expression: 'gentle',
      },
      sc3: {
        id: 'sc3',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_sharing_01',
        text: 'Ooh, cookies! Let\\'s go get them from the garden! Look, they\\'re right there on the table!',
        next: null,
        expression: 'excited',
      },
    },
  },

  'sharing-pickup': {
    startId: 'sp1',
    nodes: {
      sp1: {
        id: 'sp1',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_sharing_02',
        text: 'You got the cookies! They smell so good. Now let\\'s find Lily! She lives in the house down south, past the village square.',
        next: null,
        expression: 'happy',
      },
    },
  },

  'sharing-deliver': {
    startId: 'sd1',
    nodes: {
      sd1: {
        id: 'sd1',
        portrait: 'npc_lily',
        name: 'Neighbor Lily',
        voiceId: 'voice_lily_cookies_01',
        text: 'Oh! Are those... cookies? For me?',
        next: 'sd2',
        expression: 'surprised',
      },
      sd2: {
        id: 'sd2',
        portrait: 'npc_lily',
        name: 'Neighbor Lily',
        voiceId: 'voice_lily_cookies_02',
        text: 'How sweet of Grandma Rose to think of me! And how kind of you to bring them all the way here! You made my whole day brighter, Princess.',
        next: 'sd3',
        expression: 'grateful',
      },
      sd3: {
        id: 'sd3',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_sharing_03',
        text: 'Look how happy she is! Sharing really does make everyone smile. Let\\'s go tell Grandma Rose!',
        next: null,
        expression: 'happy',
      },
    },
  },

  'sharing-complete': {
    startId: 'sf1',
    nodes: {
      sf1: {
        id: 'sf1',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_sharing_done_01',
        text: 'You gave the cookies to Lily? Oh, I bet she smiled so big! You know what, Princess?',
        next: 'sf2',
        expression: 'happy',
      },
      sf2: {
        id: 'sf2',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_sharing_done_02',
        text: 'When we share something with someone, we don\\'t have less — we have MORE. Because now we have cookies AND a happy friend! That\\'s the magic of sharing.',
        next: 'sf3',
        expression: 'wise',
      },
      sf3: {
        id: 'sf3',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_sharing_done',
        text: 'We did it! We made two people happy with one plate of cookies! You\\'re such a kind princess.',
        next: null,
        expression: 'proud',
      },
    },
  },

  'brave-start': {
    startId: 'bs1',
    nodes: {
      bs1: {
        id: 'bs1',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_01',
        text: '... oh, hi Princess. I\\'m just... sitting here.',
        next: 'bs2',
        expression: 'sad',
      },
      bs2: {
        id: 'bs2',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_01',
        text: 'Finn looks a little sad. Maybe we should ask what\\'s wrong?',
        next: 'bs3',
        expression: 'concerned',
      },
      bs3: {
        id: 'bs3',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_02',
        text: 'I want to climb on the big rock over there but... what if I fall? What if it\\'s too high? Everyone else can do it but me...',
        next: 'bs4',
        expression: 'worried',
      },
      bs4: {
        id: 'bs4',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_02',
        text: 'Hey Finn, being scared doesn\\'t mean you can\\'t be brave! Brave means trying even when you\\'re a little scared. We\\'ll be right here with you!',
        next: null,
        expression: 'encouraging',
      },
    },
  },

  'brave-encourage': {
    startId: 'be1',
    nodes: {
      be1: {
        id: 'be1',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_03',
        text: 'You... you\\'ll stay right here? You won\\'t leave?',
        next: 'be2',
        expression: 'hopeful',
      },
      be2: {
        id: 'be2',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_03',
        text: 'Of course! Friends stay together. You try the rock, and we\\'ll cheer you on! Ready? You can do it!',
        next: 'be3',
        expression: 'encouraging',
      },
      be3: {
        id: 'be3',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_04',
        text: 'Okay... okay! I\\'m going to try! Here I go!',
        next: null,
        expression: 'determined',
      },
    },
  },

  'brave-observe': {
    startId: 'bo1',
    nodes: {
      bo1: {
        id: 'bo1',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_04',
        text: 'Look! Finn is climbing! He\\'s doing it! Go Finn, go!',
        next: 'bo2',
        expression: 'excited',
      },
      bo2: {
        id: 'bo2',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_05',
        text: 'I... I DID IT! I\\'m on top! I can see the whole village from up here! WOOOO!',
        next: null,
        expression: 'thrilled',
      },
    },
  },

  'brave-complete': {
    startId: 'bc1',
    nodes: {
      bc1: {
        id: 'bc1',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_06',
        text: 'Princess! Princess! I did it! I was so scared but I tried anyway and I DID IT!',
        next: 'bc2',
        expression: 'happy',
      },
      bc2: {
        id: 'bc2',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_05',
        text: 'See, Finn? That\\'s what being brave means. It doesn\\'t mean you\\'re not scared. It means you try anyway, especially when friends are there to help.',
        next: 'bc3',
        expression: 'proud',
      },
      bc3: {
        id: 'bc3',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_07',
        text: 'Thank you, Princess! You\\'re the bravest friend ever. Next time I\\'m scared, I\\'ll remember — brave means trying! Want to climb together next time?',
        next: null,
        expression: 'grateful',
      },
    },
  },
};
`);

outputLines.push(`// ── Level Transitions ─────────────────────────────────────────────────────

const transitions = [
  {
    edge: 'south',
    targetLevel: 'whisper-forest',
    targetSpawnX: 15,
    targetSpawnY: 1,
    label: 'Whisper Forest',
    zoneStartX: 29,
    zoneEndX: 30,
  },
];

// ── Tileset Configuration ─────────────────────────────────────────────────

const tilesetConfig = {
  town: './sprites/town/tilemap_packed.png',
  dungeon: './sprites/dungeon/tilemap_packed.png',
};

// ── Animated Tile Definitions ─────────────────────────────────────────────

const animatedTiles = [
  { baseTile: 122, frames: [122, 121, 122, 123] },
];

// ── Export ─────────────────────────────────────────────────────────────────

export default {
  id: 'sparkle-village',
  name: 'Sparkle Village',
  width: 60,
  height: 40,
  tileSize: 16,
  tilesetPath: './sprites/town/tilemap_packed.png',

  spawnX: 30,
  spawnY: 18,

  ground,
  objects,
  collision,
  foreground,

  npcs,
  worldObjects,
  animals,

  quests,
  dialogues,
  transitions,
  tilesetConfig,
  animatedTiles,
};
`);

// ── Write output ────────────────────────────────────────────────────────────
const outputPath = path.join(toolsDir, '..', 'game', 'levels', 'level-sparkle-village.js');
fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf8');

// ── Summary stats ───────────────────────────────────────────────────────────
let treeCount = 0, bushCount = 0, totalObj = 0, plantCount = 0;
let collBlocked = 0;
const treeParts = [TB1, TB2, ATB1, ATB2, STR, ST2, STA, FRT, PINE_TRUNK, DENSE_TRUNK, 15, 16, 19, 20, 21, 22, 23, 31, 34];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = objects[y][x];
    if (t !== E) {
      totalObj++;
      if (treeParts.includes(t)) treeCount++;
      if ([BSH, BBR].includes(t)) bushCount++;
      if ([FRN, FLB, TLP, MSH].includes(t)) plantCount++;
    }
    if (collision[y][x] === 1) collBlocked++;
  }
}

let plainGrass = 0, variantGrass = 0, flowerCount = 0, pathCount = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const g = ground[y][x];
    if (g === GR) plainGrass++;
    else if (g === GR2) variantGrass++;
    else if (g === GF) flowerCount++;
    else pathCount++;
  }
}

const fgCount = foreground.flat().filter(t => t !== E).length;

console.log(`[generate-level] Output: ${outputPath}`);
console.log(`[generate-level] Ground: ${plainGrass} plain grass, ${variantGrass} variant grass, ${flowerCount} flower, ${pathCount} path`);
console.log(`[generate-level] Grass ratio: ${((plainGrass / (plainGrass + variantGrass + flowerCount)) * 100).toFixed(1)}% plain, ${((variantGrass / (plainGrass + variantGrass + flowerCount)) * 100).toFixed(1)}% variant, ${((flowerCount / (plainGrass + variantGrass + flowerCount)) * 100).toFixed(1)}% flower`);
console.log(`[generate-level] Objects: ${totalObj} total, ${treeCount} tree parts, ${bushCount} bushes, ${plantCount} plants`);
console.log(`[generate-level] Collision: ${collBlocked} blocked cells`);
console.log(`[generate-level] Foreground: ${fgCount} canopy tiles`);
console.log('[generate-level] Done!');
