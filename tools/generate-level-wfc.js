#!/usr/bin/env node
/**
 * generate-level-wfc.js — Multi-pass procedural map generator for Sparkle Village
 *
 * Uses rot-js cellular automata + A* pathfinding for organic map generation.
 * Outputs level-sparkle-village.js and sparkle-village.tmj (Tiled).
 *
 * Usage:
 *   node tools/generate-level-wfc.js              # random seed
 *   node tools/generate-level-wfc.js --seed=42    # deterministic
 */

const fs = require('fs');
const path = require('path');
const ROT = require('rot-js');

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let SEED = Date.now();
for (const arg of args) {
  const m = arg.match(/^--seed=(\d+)$/);
  if (m) SEED = parseInt(m[1], 10);
}

// ── Seeded RNG (mulberry32) ─────────────────────────────────────────────────
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(SEED);
ROT.RNG.setSeed(SEED);

function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Constants ───────────────────────────────────────────────────────────────
const W = 60, H = 40;
const ZONE = {
  GRASS: 0, PATH: 1, BUILDING: 2, WATER: 3, FOREST: 4, GARDEN: 5
};
const ZONE_NAMES = ['GRASS', 'PATH', 'BUILDING', 'WATER', 'FOREST', 'GARDEN'];

// ── Layers ──────────────────────────────────────────────────────────────────
const zoneMap = new Array(W * H).fill(ZONE.GRASS);
const ground = new Array(W * H).fill(1);
const objects = new Array(W * H).fill(-1);
const collision = new Array(W * H).fill(0);
const foreground = new Array(W * H).fill(-1);

function idx(x, y) { return y * W + x; }
function inBounds(x, y) { return x >= 0 && x < W && y >= 0 && y < H; }
function getZone(x, y) { return inBounds(x, y) ? zoneMap[idx(x, y)] : ZONE.FOREST; }
function setZone(x, y, z) { if (inBounds(x, y)) zoneMap[idx(x, y)] = z; }

// ═══════════════════════════════════════════════════════════════════════════
// PASS 1: Zone Map — Cellular automata for organic forest borders
// ═══════════════════════════════════════════════════════════════════════════
console.log('=== Pass 1: Zone Map (Cellular Automata) ===');

// Start with outer 4 rows/cols as forest
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (x < 4 || x >= W - 4 || y < 4 || y >= H - 4) {
      setZone(x, y, ZONE.FOREST);
    }
  }
}

// Use ROT.Map.Cellular to create organic forest edges
// We'll use it to determine which border cells become forest vs grass
const cellular = new ROT.Map.Cellular(W, H, { born: [5, 6, 7, 8], survive: [4, 5, 6, 7, 8] });

// Initialize: outer 5 rows/cols + some random cells in the 4-6 range
cellular.randomize(0.35);
// Force outer rim
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (x < 3 || x >= W - 3 || y < 3 || y >= H - 3) {
      cellular._map[x][y] = 1;
    }
    // Keep center clear
    if (x > 8 && x < W - 8 && y > 8 && y < H - 8) {
      cellular._map[x][y] = 0;
    }
  }
}

// Run 4 iterations
for (let i = 0; i < 4; i++) {
  cellular.create();
}

// Apply cellular result to zone map for border areas
cellular.create((x, y, val) => {
  if (val === 1 && (x < 8 || x >= W - 8 || y < 8 || y >= H - 8)) {
    setZone(x, y, ZONE.FOREST);
  }
});

// Ensure outer 2 rows are always forest
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (x < 2 || x >= W - 2 || y < 2 || y >= H - 2) {
      setZone(x, y, ZONE.FOREST);
    }
  }
}

// Count zones
const zoneCounts = {};
for (const z of zoneMap) zoneCounts[ZONE_NAMES[z]] = (zoneCounts[ZONE_NAMES[z]] || 0) + 1;
console.log('  Initial zone counts:', zoneCounts);

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2: Building Placement
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Pass 2: Building Placement ===');

// Building definitions: { name, x, y, type, width, height, roofTiles, wallTiles }
const buildings = [
  {
    name: "Grandma's House",
    x: 8, y: 6,
    type: 'medium_house',
    width: 4, height: 2,
    roofTiles: [63, 64, 64, 65],
    wallTiles: [72, 75, 74, 73],
    fenceBelow: true,
    doorOffsetX: 2
  },
  {
    name: "Baker's Shop",
    x: 42, y: 7,
    type: 'stone_shop_large',
    width: 5, height: 2,
    roofTiles: [63, 64, 67, 64, 65],
    wallTiles: [84, 87, 86, 85, 87],
    fenceBelow: false,
    doorOffsetX: 2
  },
  {
    name: "Lily's Cottage",
    x: 8, y: 27,
    type: 'small_house',
    width: 3, height: 2,
    roofTiles: [63, 67, 65],
    wallTiles: [72, 74, 73],
    fenceBelow: true,
    doorOffsetX: 1
  },
];

// Place buildings on zone map
for (const b of buildings) {
  console.log(`  Placing ${b.name} at (${b.x}, ${b.y}), ${b.width}x${b.height}`);

  // Mark building zone
  for (let dy = 0; dy < b.height; dy++) {
    for (let dx = 0; dx < b.width; dx++) {
      setZone(b.x + dx, b.y + dy, ZONE.BUILDING);
    }
  }

  // Mark 3-tile garden buffer around building
  for (let dy = -3; dy < b.height + 3; dy++) {
    for (let dx = -3; dx < b.width + 3; dx++) {
      const gx = b.x + dx, gy = b.y + dy;
      if (inBounds(gx, gy) && getZone(gx, gy) === ZONE.GRASS) {
        setZone(gx, gy, ZONE.GARDEN);
      }
    }
  }
}

// Village center well
const wellX = 29, wellY = 17;
console.log(`  Placing village well at (${wellX}, ${wellY})`);

// Pond: east-center
const pondX = 46, pondY = 18;
const pondW = 4, pondH = 3;
console.log(`  Placing pond at (${pondX}, ${pondY}), ${pondW}x${pondH}`);
for (let dy = 0; dy < pondH; dy++) {
  for (let dx = 0; dx < pondW; dx++) {
    setZone(pondX + dx, pondY + dy, ZONE.WATER);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 3: Path Network (A* with organic curves)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Pass 3: Path Network (A* with curves) ===');

// Building entrances (door positions)
const entrances = [
  { name: "Grandma", x: 10, y: 9 },   // below grandma's door
  { name: "Baker",   x: 44, y: 10 },   // below baker's door
  { name: "Lily",    x: 9,  y: 30 },   // below lily's door
  { name: "Well",    x: wellX, y: wellY + 2 },  // village center
  { name: "Pond",    x: pondX - 1, y: pondY + 1 }, // near pond
  { name: "SE-park", x: 44, y: 32 },  // playground area SE
];

// Create a passability callback for A*
function passable(x, y) {
  if (!inBounds(x, y)) return false;
  const z = getZone(x, y);
  return z !== ZONE.BUILDING && z !== ZONE.WATER && z !== ZONE.FOREST;
}

// Generate curved path between two points using control point jitter
function generateCurvedWaypoints(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const numWaypoints = dist > 20 ? 2 : 1;
  const waypoints = [];

  for (let i = 1; i <= numWaypoints; i++) {
    const t = i / (numWaypoints + 1);
    const mx = Math.round(x1 + dx * t);
    const my = Math.round(y1 + dy * t);
    // Perpendicular offset for curve
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const offset = randInt(-5, 5);
    const wx = Math.round(mx + perpX * offset);
    const wy = Math.round(my + perpY * offset);
    // Clamp to safe zone
    waypoints.push({
      x: Math.max(5, Math.min(W - 6, wx)),
      y: Math.max(5, Math.min(H - 6, wy))
    });
  }
  return waypoints;
}

// Run A* between points through waypoints, marking 2-tile wide paths
function tracePath(fromX, fromY, toX, toY, label) {
  const pathCells = [];
  const astar = new ROT.Path.AStar(toX, toY, (x, y) => {
    if (!inBounds(x, y)) return false;
    const z = getZone(x, y);
    return z !== ZONE.BUILDING && z !== ZONE.WATER;
  }, { topology: 4 });

  astar.compute(fromX, fromY, (x, y) => {
    pathCells.push({ x, y });
  });

  return pathCells;
}

function markPath(cells) {
  for (const c of cells) {
    // 2-tile wide path
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 0; dx++) {
        const px = c.x + dx, py = c.y + dy;
        if (inBounds(px, py)) {
          const z = getZone(px, py);
          if (z !== ZONE.BUILDING && z !== ZONE.WATER) {
            setZone(px, py, ZONE.PATH);
          }
        }
      }
    }
  }
}

// Connect all building entrances to the village center (well)
const center = entrances.find(e => e.name === 'Well');
let totalPathLength = 0;

for (const ent of entrances) {
  if (ent.name === 'Well') continue;

  // Generate curved waypoints
  const waypoints = generateCurvedWaypoints(ent.x, ent.y, center.x, center.y);
  const allPoints = [{ x: ent.x, y: ent.y }, ...waypoints, { x: center.x, y: center.y }];

  let fullPath = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    const seg = tracePath(allPoints[i].x, allPoints[i].y, allPoints[i + 1].x, allPoints[i + 1].y, ent.name);
    fullPath = fullPath.concat(seg);
  }

  markPath(fullPath);
  totalPathLength += fullPath.length;
  console.log(`  Path ${ent.name} -> Well: ${fullPath.length} cells (${waypoints.length} waypoint(s))`);
}

// Make crossroad at village center - 2x2 intersection
for (let dy = -1; dy <= 2; dy++) {
  for (let dx = -1; dx <= 2; dx++) {
    setZone(wellX + dx, wellY + dy, ZONE.PATH);
  }
}

console.log(`  Total path cells placed: ${totalPathLength}`);

// ═══════════════════════════════════════════════════════════════════════════
// PASS 4: Vegetation (Poisson Disk Sampling)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Pass 4: Vegetation (Poisson Disk Sampling) ===');

// Simple Poisson disk sampling
function poissonDisk(minDist, maxAttempts, zone, regionBounds) {
  const points = [];
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil((regionBounds.maxX - regionBounds.minX) / cellSize);
  const gridH = Math.ceil((regionBounds.maxY - regionBounds.minY) / cellSize);
  const grid2d = new Array(gridW * gridH).fill(-1);

  function gridIdx(x, y) {
    const gx = Math.floor((x - regionBounds.minX) / cellSize);
    const gy = Math.floor((y - regionBounds.minY) / cellSize);
    return gy * gridW + gx;
  }

  function tooClose(x, y) {
    const gx = Math.floor((x - regionBounds.minX) / cellSize);
    const gy = Math.floor((y - regionBounds.minY) / cellSize);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
          const pi = grid2d[ny * gridW + nx];
          if (pi >= 0) {
            const p = points[pi];
            const ddx = p.x - x, ddy = p.y - y;
            if (ddx * ddx + ddy * ddy < minDist * minDist) return true;
          }
        }
      }
    }
    return false;
  }

  // Seed with random point
  for (let attempt = 0; attempt < maxAttempts * 10; attempt++) {
    const x = randInt(regionBounds.minX, regionBounds.maxX);
    const y = randInt(regionBounds.minY, regionBounds.maxY);
    if (!inBounds(x, y)) continue;
    const z = getZone(x, y);
    if (zone !== null && z !== zone) continue;
    if (z === ZONE.BUILDING || z === ZONE.WATER || z === ZONE.PATH) continue;
    if (tooClose(x, y)) continue;

    points.push({ x, y });
    const gi = gridIdx(x, y);
    if (gi >= 0 && gi < grid2d.length) grid2d[gi] = points.length - 1;
  }

  return points;
}

// Tree types to place
const treeTypes = {
  // 2x2 composite trees
  green_tree: { canopy: [[4, 5]], trunk: [[12, 13]], w: 2, h: 2, weight: 35 },
  autumn_tree: { canopy: [[7, 8]], trunk: [[24, 25]], w: 2, h: 2, weight: 20 },
  // 1x2 vertical trees
  pine_tree: { canopy: [[10]], trunk: [[22]], w: 1, h: 2, weight: 15 },
  dense_tree: { canopy: [[11]], trunk: [[23]], w: 1, h: 2, weight: 10 },
  // 1x1 standalone
  small_green: { canopy: null, trunk: [[6]], w: 1, h: 1, weight: 10 },
  small_complete: { canopy: null, trunk: [[16]], w: 1, h: 1, weight: 5 },
  fruit_tree: { canopy: null, trunk: [[17]], w: 1, h: 1, weight: 5 },
};

// User tile groups (3x3)
const userGroups = {
  tree_group1: { tiles: [[-1, 7, -1], [18, 19, 20], [-1, 31, -1]], w: 3, h: 3, weight: 8 },
  tree_group2: { tiles: [[-1, 10, -1], [21, 22, 23], [-1, 34, -1]], w: 3, h: 3, weight: 7 },
};

function pickTreeType() {
  const allTypes = Object.entries(treeTypes);
  const totalWeight = allTypes.reduce((s, [, t]) => s + t.weight, 0);
  let r = rng() * totalWeight;
  for (const [name, t] of allTypes) {
    r -= t.weight;
    if (r <= 0) return { name, ...t };
  }
  return { name: 'small_green', ...treeTypes.small_green };
}

// FOREST zone trees - dense
const forestPoints = poissonDisk(2.5, 500, ZONE.FOREST, { minX: 0, minY: 0, maxX: W - 1, maxY: H - 1 });
console.log(`  Forest tree positions: ${forestPoints.length}`);

// GRASS zone trees - sparse, near paths
const grassPoints = poissonDisk(5.5, 300, ZONE.GRASS, { minX: 5, minY: 5, maxX: W - 6, maxY: H - 6 });
console.log(`  Grass tree positions: ${grassPoints.length}`);

// GARDEN zone decorations
const gardenPoints = poissonDisk(3, 200, ZONE.GARDEN, { minX: 5, minY: 5, maxX: W - 6, maxY: H - 6 });
console.log(`  Garden decoration positions: ${gardenPoints.length}`);

// Track placed tree positions for collision
const treePlacements = [];

function canPlaceTree(x, y, w, h) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const px = x + dx, py = y + dy;
      if (!inBounds(px, py)) return false;
      const z = getZone(px, py);
      if (z === ZONE.BUILDING || z === ZONE.WATER || z === ZONE.PATH) return false;
      if (objects[idx(px, py)] !== -1) return false;
    }
  }
  // Check canopy row above
  if (h >= 2) {
    for (let dx = 0; dx < w; dx++) {
      if (y - 1 >= 0 && foreground[idx(x + dx, y - 1)] !== -1) return false;
    }
  }
  return true;
}

function placeTree(x, y, tree) {
  if (tree.w === 2 && tree.h === 2) {
    // trunk row at y, canopy at y-1
    const trunkY = y;
    const canopyY = y - 1;
    if (canopyY < 0) return false;
    if (!canPlaceTree(x, trunkY, 2, 1)) return false;
    // Check canopy space
    for (let dx = 0; dx < 2; dx++) {
      if (!inBounds(x + dx, canopyY)) return false;
      if (objects[idx(x + dx, canopyY)] !== -1) return false;
    }

    // Place trunk on objects
    objects[idx(x, trunkY)] = tree.trunk[0][0];
    objects[idx(x + 1, trunkY)] = tree.trunk[0][1];
    collision[idx(x, trunkY)] = 1;
    collision[idx(x + 1, trunkY)] = 1;

    // Place canopy on foreground
    foreground[idx(x, canopyY)] = tree.canopy[0][0];
    foreground[idx(x + 1, canopyY)] = tree.canopy[0][1];

    treePlacements.push({ x, y: trunkY, w: 2, h: 2, type: tree.name });
    return true;
  }
  else if (tree.w === 1 && tree.h === 2) {
    const trunkY = y;
    const canopyY = y - 1;
    if (canopyY < 0) return false;
    if (objects[idx(x, trunkY)] !== -1) return false;
    if (foreground[idx(x, canopyY)] !== -1) return false;
    const z = getZone(x, trunkY);
    if (z === ZONE.BUILDING || z === ZONE.WATER || z === ZONE.PATH) return false;

    objects[idx(x, trunkY)] = tree.trunk[0][0];
    collision[idx(x, trunkY)] = 1;
    foreground[idx(x, canopyY)] = tree.canopy[0][0];

    treePlacements.push({ x, y: trunkY, w: 1, h: 2, type: tree.name });
    return true;
  }
  else if (tree.w === 1 && tree.h === 1) {
    if (objects[idx(x, y)] !== -1) return false;
    const z = getZone(x, y);
    if (z === ZONE.BUILDING || z === ZONE.WATER || z === ZONE.PATH) return false;

    objects[idx(x, y)] = tree.trunk[0][0];
    collision[idx(x, y)] = 1;

    treePlacements.push({ x, y, w: 1, h: 1, type: tree.name });
    return true;
  }
  return false;
}

function placeUserGroup(x, y, group) {
  // Check 3x3 area
  for (let dy = 0; dy < group.h; dy++) {
    for (let dx = 0; dx < group.w; dx++) {
      const tileId = group.tiles[dy][dx];
      if (tileId === -1) continue;
      const px = x + dx, py = y + dy;
      if (!inBounds(px, py)) return false;
      const z = getZone(px, py);
      if (z === ZONE.BUILDING || z === ZONE.WATER || z === ZONE.PATH) return false;
      if (objects[idx(px, py)] !== -1) return false;
    }
  }

  // Place tiles - top row on foreground, middle on objects, bottom on objects
  for (let dy = 0; dy < group.h; dy++) {
    for (let dx = 0; dx < group.w; dx++) {
      const tileId = group.tiles[dy][dx];
      if (tileId === -1) continue;
      const px = x + dx, py = y + dy;
      if (dy === 0) {
        // Top row -> foreground (canopy)
        foreground[idx(px, py)] = tileId;
      } else {
        // Middle/bottom rows -> objects
        objects[idx(px, py)] = tileId;
        collision[idx(px, py)] = 1;
      }
    }
  }
  treePlacements.push({ x, y, w: group.w, h: group.h, type: 'user_group' });
  return true;
}

// Place forest trees
let forestTreesPlaced = 0;
for (const pt of shuffle(forestPoints)) {
  // Occasionally use user groups in forest
  if (rng() < 0.1 && pt.y > 2) {
    const g = rng() < 0.5 ? userGroups.tree_group1 : userGroups.tree_group2;
    if (placeUserGroup(pt.x - 1, pt.y - 1, g)) { forestTreesPlaced++; continue; }
  }

  const tree = pickTreeType();
  if (pt.y >= 1 && placeTree(pt.x, pt.y, tree)) {
    forestTreesPlaced++;
  }
}
console.log(`  Forest trees placed: ${forestTreesPlaced}`);

// Place grass trees
let grassTreesPlaced = 0;
for (const pt of shuffle(grassPoints)) {
  // Prefer smaller trees in open grass
  const tree = pickTreeType();
  if (pt.y >= 1 && placeTree(pt.x, pt.y, tree)) {
    grassTreesPlaced++;
  }
}
console.log(`  Grass trees placed: ${grassTreesPlaced}`);

// Place garden decorations (bushes, flowers)
const gardenDecos = [28, 29, 19, 15, 18]; // bush, berry bush, flower bush, tulip, fern
let gardenDecosPlaced = 0;
let flowerGrassCount = {};
for (const pt of shuffle(gardenPoints)) {
  if (objects[idx(pt.x, pt.y)] !== -1) continue;
  const z = getZone(pt.x, pt.y);
  if (z !== ZONE.GARDEN) continue;

  const deco = pick(gardenDecos);
  objects[idx(pt.x, pt.y)] = deco;
  // Bushes block, flowers don't
  if (deco === 28 || deco === 29) {
    collision[idx(pt.x, pt.y)] = 1;
  }
  gardenDecosPlaced++;
}
console.log(`  Garden decorations placed: ${gardenDecosPlaced}`);

// ═══════════════════════════════════════════════════════════════════════════
// PASS 5: Tile Selection (auto-tiling rules)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Pass 5: Tile Selection ===');

// ── Ground layer ────────────────────────────────────────────────────────
let tile2Count = 0;
const maxTile2 = Math.floor(W * H * 0.05); // 5% max
const gardenFlowerCount = {}; // per-building tracker

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const z = getZone(x, y);
    const i = idx(x, y);

    switch (z) {
      case ZONE.GRASS:
      case ZONE.FOREST:
        // 95% tile 1, 5% tile 2
        if (tile2Count < maxTile2 && rng() < 0.05) {
          ground[i] = 2;
          tile2Count++;
        } else {
          ground[i] = 1;
        }
        break;

      case ZONE.GARDEN: {
        // Find nearest building for flower-grass limit
        let nearestBldg = null;
        let nearDist = Infinity;
        for (const b of buildings) {
          const bdx = x - (b.x + b.width / 2);
          const bdy = y - (b.y + b.height / 2);
          const d = bdx * bdx + bdy * bdy;
          if (d < nearDist) { nearDist = d; nearestBldg = b.name; }
        }
        const key = nearestBldg || 'unknown';
        gardenFlowerCount[key] = gardenFlowerCount[key] || 0;

        // Max 3 flower grass (tile 43) per garden, otherwise tile 1
        if (gardenFlowerCount[key] < 3 && rng() < 0.08) {
          ground[i] = 43;
          gardenFlowerCount[key]++;
        } else {
          ground[i] = 1;
        }
        break;
      }

      case ZONE.PATH: {
        // Determine path edge tiles based on cardinal neighbors
        const hasPathN = getZone(x, y - 1) === ZONE.PATH;
        const hasPathS = getZone(x, y + 1) === ZONE.PATH;
        const hasPathW = getZone(x - 1, y) === ZONE.PATH;
        const hasPathE = getZone(x + 1, y) === ZONE.PATH;

        // For horizontal paths (E-W): use top/bottom edge
        // For vertical paths (N-S): use left/right edge
        // Intersection: use center

        const pathNeighbors = (hasPathN ? 1 : 0) + (hasPathS ? 1 : 0) + (hasPathW ? 1 : 0) + (hasPathE ? 1 : 0);

        if (pathNeighbors >= 3) {
          // Intersection/wide area
          ground[i] = 40; // center
        } else if (hasPathN && hasPathS && !hasPathW && !hasPathE) {
          // Vertical path
          // Check which side has grass
          const grassW = getZone(x - 1, y) !== ZONE.PATH;
          const grassE = getZone(x + 1, y) !== ZONE.PATH;
          if (grassW && grassE) {
            // Narrow vertical - use pair 39,41 but pick based on x
            ground[i] = (x % 2 === 0) ? 39 : 41;
          } else if (grassW) {
            ground[i] = 39;
          } else if (grassE) {
            ground[i] = 41;
          } else {
            ground[i] = 40;
          }
        } else if (hasPathW && hasPathE && !hasPathN && !hasPathS) {
          // Horizontal path
          const grassN = getZone(x, y - 1) !== ZONE.PATH;
          const grassS = getZone(x, y + 1) !== ZONE.PATH;
          if (grassN && grassS) {
            ground[i] = (y % 2 === 0) ? 39 : 41;
          } else if (grassN) {
            ground[i] = 39;
          } else if (grassS) {
            ground[i] = 41;
          } else {
            ground[i] = 40;
          }
        } else if (pathNeighbors === 2) {
          // Corner or bend
          ground[i] = 40;
        } else if (pathNeighbors === 1) {
          // End of path
          if (hasPathN || hasPathS) {
            ground[i] = (x % 2 === 0) ? 39 : 41;
          } else {
            ground[i] = (y % 2 === 0) ? 39 : 41;
          }
        } else {
          ground[i] = 40;
        }
        break;
      }

      case ZONE.BUILDING:
        ground[i] = 1; // grass under buildings
        break;

      case ZONE.WATER:
        ground[i] = 1; // grass under water (water is on objects layer)
        break;
    }
  }
}

console.log(`  Tile 2 (flower grass) count: ${tile2Count}/${W * H} (${(tile2Count / (W * H) * 100).toFixed(1)}%)`);
console.log(`  Tile 43 per garden:`, gardenFlowerCount);

// ── Objects layer — Buildings ───────────────────────────────────────────
console.log('  Placing building tiles...');

for (const b of buildings) {
  // Roof row
  for (let dx = 0; dx < b.width; dx++) {
    objects[idx(b.x + dx, b.y)] = b.roofTiles[dx];
    collision[idx(b.x + dx, b.y)] = 1;
  }
  // Wall row
  for (let dx = 0; dx < b.width; dx++) {
    objects[idx(b.x + dx, b.y + 1)] = b.wallTiles[dx];
    collision[idx(b.x + dx, b.y + 1)] = 1;
  }

  // Fence below building
  if (b.fenceBelow) {
    const fenceY = b.y + 2;
    if (inBounds(b.x, fenceY)) {
      // Fence with gap at door
      for (let dx = 0; dx < b.width; dx++) {
        if (dx === b.doorOffsetX) continue; // gap for door
        const fx = b.x + dx;
        if (objects[idx(fx, fenceY)] === -1) {
          if (dx === 0) objects[idx(fx, fenceY)] = 96;
          else if (dx === b.width - 1) objects[idx(fx, fenceY)] = 98;
          else objects[idx(fx, fenceY)] = 97;
          collision[idx(fx, fenceY)] = 1;
        }
      }
    }
  }
}

// ── Objects layer — Baker decorations ───────────────────────────────────
// Lantern and barrel near baker
const bakerDeco = [
  { x: 41, y: 8, tile: 93 },   // lantern
  { x: 47, y: 8, tile: 107 },  // barrel
];
for (const d of bakerDeco) {
  if (inBounds(d.x, d.y) && objects[idx(d.x, d.y)] === -1) {
    objects[idx(d.x, d.y)] = d.tile;
    collision[idx(d.x, d.y)] = 1;
  }
}

// ── Objects layer — Well ────────────────────────────────────────────────
objects[idx(wellX, wellY)] = 92;     // well top
objects[idx(wellX, wellY + 1)] = 104; // well base
collision[idx(wellX, wellY)] = 1;
collision[idx(wellX, wellY + 1)] = 1;

// Lanterns near well
const wellDecos = [
  { x: wellX - 2, y: wellY + 1, tile: 93 },
  { x: wellX + 2, y: wellY, tile: 93 },
];
for (const d of wellDecos) {
  if (inBounds(d.x, d.y) && objects[idx(d.x, d.y)] === -1) {
    objects[idx(d.x, d.y)] = d.tile;
    collision[idx(d.x, d.y)] = 1;
  }
}

// ── Objects layer — Pond (water edge tiles) ─────────────────────────────
// 4x3 large pond
const pondTiles = [
  [109, 110, 110, 111],
  [121, 122, 122, 123],
  [120, 112, 112, 113],
];
for (let dy = 0; dy < 3; dy++) {
  for (let dx = 0; dx < 4; dx++) {
    const px = pondX + dx, py = pondY + dy;
    if (inBounds(px, py)) {
      objects[idx(px, py)] = pondTiles[dy][dx];
      collision[idx(px, py)] = 1;
    }
  }
}

// ── Collision layer finalization ────────────────────────────────────────
// Make sure paths are walkable, forest edges blocked where trees are
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const z = getZone(x, y);
    const i = idx(x, y);
    if (z === ZONE.PATH) {
      collision[i] = 0;
    }
    if (z === ZONE.WATER) {
      collision[i] = 1;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 6: Output
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n=== Pass 6: Output ===');

// ── Format layer as grid rows ───────────────────────────────────────────
function formatLayer(layer, name) {
  const lines = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      row.push(layer[idx(x, y)]);
    }
    lines.push('  [' + row.join(',') + ']');
  }
  return lines.join(',\n');
}

// ── Read entity data from original level ────────────────────────────────
// We copy all entity data verbatim from the existing file

const npcsStr = `const npcs = [
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
];`;

const worldObjectsStr = `const worldObjects = [
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
];`;

const animalsStr = `const animals = [
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
];`;

const questsStr = `const quests = [
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
];`;

const dialoguesStr = `const dialogues = {
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
        text: 'When we share something with someone, we don\\'t have less \\u2014 we have MORE. Because now we have cookies AND a happy friend! That\\'s the magic of sharing.',
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
        text: 'Thank you, Princess! You\\'re the bravest friend ever. Next time I\\'m scared, I\\'ll remember \\u2014 brave means trying! Want to climb together next time?',
        next: null,
        expression: 'grateful',
      },
    },
  },
};`;

const transitionsStr = `const transitions = [
  {
    edge: 'south',
    targetLevel: 'whisper-forest',
    targetSpawnX: 15,
    targetSpawnY: 1,
    label: 'Whisper Forest',
    zoneStartX: 29,
    zoneEndX: 30,
  },
];`;

const tilesetConfigStr = `const tilesetConfig = {
  town: './sprites/town/tilemap_packed.png',
  dungeon: './sprites/dungeon/tilemap_packed.png',
};`;

const animatedTilesStr = `const animatedTiles = [
  { baseTile: 122, frames: [122, 121, 122, 123] },
];`;

// ── Write level JS ──────────────────────────────────────────────────────
const levelOutput = `/**
 * level-sparkle-village.js — Sparkle Village for Princess Sparkle V2
 *
 * AUTO-GENERATED by tools/generate-level-wfc.js (seed=${SEED})
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

// ── GROUND LAYER (60x40 = 2400 tiles) ──────────────────────────────────────
// prettier-ignore
const ground = grid([
${formatLayer(ground, 'ground')}
]);

// ── OBJECTS LAYER (60x40 = 2400 tiles) ─────────────────────────────────────
// prettier-ignore
const objects = grid([
${formatLayer(objects, 'objects')}
]);

// ── COLLISION LAYER (60x40 = 2400 tiles) ───────────────────────────────────
// prettier-ignore
const collision = grid([
${formatLayer(collision, 'collision')}
]);

// ── FOREGROUND LAYER (60x40 = 2400 tiles) ──────────────────────────────────
// prettier-ignore
const foreground = grid([
${formatLayer(foreground, 'foreground')}
]);

// ── NPCs ──────────────────────────────────────────────────────────────────

${npcsStr}

// ── World Objects (tappable) ──────────────────────────────────────────────

${worldObjectsStr}

// ── Ambient Animals ───────────────────────────────────────────────────────

${animalsStr}

// ── Quests ────────────────────────────────────────────────────────────────

${questsStr}

// ── Dialogues ─────────────────────────────────────────────────────────────

${dialoguesStr}

// ── Level Transitions ─────────────────────────────────────────────────────

${transitionsStr}

// ── Tileset Configuration ─────────────────────────────────────────────────

${tilesetConfigStr}

// ── Animated Tile Definitions ─────────────────────────────────────────────

${animatedTilesStr}

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
`;

const levelPath = path.join(__dirname, '..', 'game', 'levels', 'level-sparkle-village.js');
fs.writeFileSync(levelPath, levelOutput, 'utf8');
console.log(`  Written: ${levelPath}`);

// ── Write Tiled .tmj ────────────────────────────────────────────────────
function layerToTiledData(layer) {
  // Tiled uses 1-based tile IDs, 0 = empty
  return layer.map(t => t === -1 ? 0 : t + 1);
}

const tiledMap = {
  compressionlevel: -1,
  height: H,
  width: W,
  infinite: false,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  tileheight: 16,
  tilewidth: 16,
  type: 'map',
  version: '1.10',
  nextlayerid: 5,
  nextobjectid: 1,
  tilesets: [
    {
      columns: 12,
      firstgid: 1,
      image: '../game/sprites/town/tilemap_packed.png',
      imageheight: 176,
      imagewidth: 192,
      margin: 0,
      name: 'Kenney Tiny Town',
      spacing: 0,
      tilecount: 132,
      tileheight: 16,
      tilewidth: 16,
    }
  ],
  layers: [
    {
      data: layerToTiledData(ground),
      height: H,
      id: 1,
      name: 'ground',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: W,
      x: 0,
      y: 0,
    },
    {
      data: layerToTiledData(objects),
      height: H,
      id: 2,
      name: 'objects',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: W,
      x: 0,
      y: 0,
    },
    {
      data: layerToTiledData(foreground),
      height: H,
      id: 3,
      name: 'foreground',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: W,
      x: 0,
      y: 0,
    },
    {
      data: layerToTiledData(collision),
      height: H,
      id: 4,
      name: 'collision',
      opacity: 0.5,
      type: 'tilelayer',
      visible: true,
      width: W,
      x: 0,
      y: 0,
    },
  ],
};

const tmjPath = path.join(__dirname, 'sparkle-village.tmj');
fs.writeFileSync(tmjPath, JSON.stringify(tiledMap, null, 2), 'utf8');
console.log(`  Written: ${tmjPath}`);

// ── Stats ───────────────────────────────────────────────────────────────
console.log('\n=== Stats ===');

// Zone counts
const finalZoneCounts = {};
for (const z of zoneMap) finalZoneCounts[ZONE_NAMES[z]] = (finalZoneCounts[ZONE_NAMES[z]] || 0) + 1;
console.log('  Zone counts:', finalZoneCounts);

// Tile counts
const tileCounts = {};
for (const t of ground) tileCounts[`ground_${t}`] = (tileCounts[`ground_${t}`] || 0) + 1;
let objCount = 0;
for (const t of objects) if (t !== -1) objCount++;
let fgCount = 0;
for (const t of foreground) if (t !== -1) fgCount++;
let blocked = 0;
for (const t of collision) if (t === 1) blocked++;

console.log(`  Ground tile 1 (grass): ${tileCounts['ground_1'] || 0}`);
console.log(`  Ground tile 2 (flower): ${tileCounts['ground_2'] || 0} (${((tileCounts['ground_2'] || 0) / (W * H) * 100).toFixed(1)}%)`);
console.log(`  Ground tile 43 (white flower): ${tileCounts['ground_43'] || 0}`);
console.log(`  Ground tile 40 (path center): ${tileCounts['ground_40'] || 0}`);
console.log(`  Ground tile 39 (path left): ${tileCounts['ground_39'] || 0}`);
console.log(`  Ground tile 41 (path right): ${tileCounts['ground_41'] || 0}`);
console.log(`  Objects placed: ${objCount}`);
console.log(`  Foreground placed: ${fgCount}`);
console.log(`  Collision blocked: ${blocked}/${W * H} (${(blocked / (W * H) * 100).toFixed(1)}%)`);
console.log(`  Trees placed: ${treePlacements.length}`);
console.log(`  Total path length: ${totalPathLength}`);
console.log(`  Seed: ${SEED}`);
console.log('\nDone!');
