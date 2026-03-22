/**
 * wfc-generator.js
 *
 * Generates tile maps using Wave Function Collapse (WFC) with adjacency rules
 * derived from tile semantics. Uses the `wavefunctioncollapse` npm package's
 * SimpleTiledModel for constraint-satisfaction-based map generation.
 *
 * WFC runs on a small set of abstract ground-layer tile categories (7-10),
 * then post-processes to add buildings, trees, decorations, and collision data.
 *
 * @module wfc-generator
 */

"use strict";

const wfc = require('wavefunctioncollapse');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Tile ID constants (matching blueprint-expander.js)
// ---------------------------------------------------------------------------

const TILE = {
  EMPTY: -1,

  // Ground
  GRASS_PLAIN: 1,
  GRASS_FLOWERS: 2,
  GRASS_WHITE_FLOWERS: 43,
  COBBLESTONE_A: 44,
  COBBLESTONE_B: 45,

  // Path
  PATH_EDGE_LT: 39,
  PATH_CENTER: 40,
  PATH_EDGE_RB: 41,
  PATH_VERT_EDGE: 42,

  // Red roof
  RED_ROOF_L: 63,
  RED_ROOF_M: 64,
  RED_ROOF_R: 65,
  RED_CHIMNEY: 67,

  // Wood walls
  WOOD_L: 72,
  WOOD_PLAIN: 73,
  WOOD_DOOR: 74,
  WOOD_WINDOW: 75,

  // Dark stone walls
  STONE_L: 84,
  STONE_PLAIN: 85,
  STONE_DOOR: 86,
  STONE_WINDOW: 87,

  // Blue roof
  BLUE_ROOF_L: 51,
  BLUE_ROOF_M: 52,
  BLUE_ROOF_R: 53,
  BLUE_CHIMNEY: 55,

  // Blue roof walls
  BLUE_WALL_L: 48,
  BLUE_WALL_M: 49,
  BLUE_WALL_R: 50,

  // Brick walls
  BRICK_L: 60,
  BRICK_M: 61,
  BRICK_R: 62,

  // Fences
  WHITE_FENCE_L: 96,
  WHITE_FENCE_M: 97,
  WHITE_FENCE_R: 98,
  BROWN_FENCE_L: 99,
  BROWN_FENCE_M: 100,
  BROWN_FENCE_R: 101,

  // Trees
  GREEN_TREE_CANOPY_L: 4,
  GREEN_TREE_CANOPY_R: 5,
  GREEN_TREE_TRUNK_L: 12,
  GREEN_TREE_TRUNK_R: 13,
  AUTUMN_TREE_CANOPY_L: 7,
  AUTUMN_TREE_CANOPY_R: 8,
  AUTUMN_TREE_TRUNK_L: 24,
  AUTUMN_TREE_TRUNK_R: 25,
  PINE_TOP: 10,
  PINE_TRUNK: 22,
  DENSE_TOP: 11,
  DENSE_TRUNK: 23,
  SMALL_GREEN: 6,
  SMALL_AUTUMN: 9,

  // Bushes / flowers
  BUSH_GREEN: 28,
  BUSH_BERRY: 29,
  TULIP: 15,
  FERN: 18,
  PURPLE_FLOWER_BUSH: 19,

  // Decorations
  WELL_TOP: 92,
  WELL_BASE: 104,
  LANTERN: 93,
  BARREL: 107,
};

// ---------------------------------------------------------------------------
// Building templates (from blueprint-expander)
// ---------------------------------------------------------------------------

const BUILDING_TEMPLATES = {
  small_house: {
    w: 3,
    roof: [TILE.RED_ROOF_L, TILE.RED_CHIMNEY, TILE.RED_ROOF_R],
    walls: [TILE.WOOD_L, TILE.WOOD_DOOR, TILE.WOOD_PLAIN],
    doorOffset: 1,
  },
  medium_house: {
    w: 4,
    roof: [TILE.RED_ROOF_L, TILE.RED_ROOF_M, TILE.RED_CHIMNEY, TILE.RED_ROOF_R],
    walls: [TILE.WOOD_L, TILE.WOOD_WINDOW, TILE.WOOD_DOOR, TILE.WOOD_PLAIN],
    doorOffset: 2,
  },
  large_house: {
    w: 5,
    roof: [TILE.RED_ROOF_L, TILE.RED_ROOF_M, TILE.RED_ROOF_M, TILE.RED_ROOF_M, TILE.RED_ROOF_R],
    walls: [TILE.WOOD_L, TILE.WOOD_WINDOW, TILE.WOOD_DOOR, TILE.WOOD_WINDOW, TILE.WOOD_PLAIN],
    doorOffset: 2,
  },
  stone_shop: {
    w: 3,
    roof: [TILE.RED_ROOF_L, TILE.RED_CHIMNEY, TILE.RED_ROOF_R],
    walls: [TILE.STONE_L, TILE.STONE_DOOR, TILE.STONE_PLAIN],
    doorOffset: 1,
  },
  blue_roof_house: {
    w: 3,
    roof: [TILE.BLUE_ROOF_L, TILE.BLUE_CHIMNEY, TILE.BLUE_ROOF_R],
    walls: [TILE.BLUE_WALL_L, TILE.BLUE_WALL_M, TILE.BLUE_WALL_R],
    doorOffset: 1,
  },
};

// ---------------------------------------------------------------------------
// Tree definitions
// ---------------------------------------------------------------------------

const TREE_DEFS = {
  green_tree: {
    size: 2,
    canopy: [TILE.GREEN_TREE_CANOPY_L, TILE.GREEN_TREE_CANOPY_R],
    trunk: [TILE.GREEN_TREE_TRUNK_L, TILE.GREEN_TREE_TRUNK_R],
  },
  autumn_tree: {
    size: 2,
    canopy: [TILE.AUTUMN_TREE_CANOPY_L, TILE.AUTUMN_TREE_CANOPY_R],
    trunk: [TILE.AUTUMN_TREE_TRUNK_L, TILE.AUTUMN_TREE_TRUNK_R],
  },
  pine_tree: {
    size: 1,
    canopy: [TILE.PINE_TOP],
    trunk: [TILE.PINE_TRUNK],
  },
  dense_tree: {
    size: 1,
    canopy: [TILE.DENSE_TOP],
    trunk: [TILE.DENSE_TRUNK],
  },
};

const TREE_TYPES = Object.keys(TREE_DEFS);

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// WFC abstract tile categories for the ground layer
// ---------------------------------------------------------------------------

// Map from WFC category name to actual tile ID(s) used for expansion
const WFC_TILE_MAP = {
  grass:        { tileId: TILE.GRASS_PLAIN,         weight: 60 },
  grass_var:    { tileId: TILE.GRASS_FLOWERS,        weight: 30 },
  grass_flower: { tileId: TILE.GRASS_WHITE_FLOWERS,  weight: 10 },
  path_h_top:   { tileId: TILE.PATH_EDGE_LT,        weight: 5 },
  path_center:  { tileId: TILE.PATH_CENTER,          weight: 5 },
  path_h_bot:   { tileId: TILE.PATH_EDGE_RB,        weight: 5 },
  cobble:       { tileId: TILE.COBBLESTONE_A,        weight: 3 },
};

// ---------------------------------------------------------------------------
// Adjacency rules (horizontal and vertical)
// ---------------------------------------------------------------------------

// The SimpleTiledModel "neighbors" array defines horizontal adjacency:
//   { left: "A", right: "B" } means A can appear to the LEFT of B.
// Vertical adjacency is derived by the model from symmetry rotations.
// Since we use symmetry "X" (cardinality 1), the model's rotation-derived
// vertical rules come from the same left/right definitions. The model
// internally maps: direction 0 = left(-x), 1 = down(+y), 2 = right(+x), 3 = up(-y).
//
// For "X" symmetry tiles, the action array is [[0,0,0,0,0,0,0,0]] which means
// all rotations/reflections map to the same tile. The model then:
//   - For { left: A, right: B }: sets tempPropagator[0][B][A] = true (B has A to its left)
//   - Then derives vertical from action rotations.
//   - For X symmetry: action[t][1] = t (rotate = identity), so
//     D = action[L][1] = L, U = action[R][1] = R
//     tempPropagator[1][U][D] = true => tempPropagator[1][R][L] = true
//     This means: R can be BELOW L (direction 1 = down).
//
// So each { left: A, right: B } rule also creates: A can be ABOVE B.
// This means we need to define our rules carefully:
//   - Horizontal rules as { left, right }
//   - These ALSO create vertical rules (left = above, right = below)
//
// Strategy: define horizontal-only and vertical-only rules separately,
// then combine. Since we can't separate them with X symmetry, we use
// "I" symmetry for directional path tiles to get 2 orientations, OR
// we accept that all adjacency is omnidirectional for simple tiles.
//
// SIMPLEST approach: Since X symmetry makes left/right = up/down,
// define rules that work in both directions. Grass/cobble are fine.
// For paths, accept that WFC will create omnidirectional paths, then
// post-process to ensure proper 2-wide paths with correct edge tiles.

function buildNeighborRules() {
  const neighbors = [];

  // Helper: add bidirectional rule
  function bi(a, b) {
    neighbors.push({ left: a, right: b });
    if (a !== b) {
      neighbors.push({ left: b, right: a });
    }
  }

  // Grass varieties connect to each other
  bi('grass', 'grass');
  bi('grass', 'grass_var');
  bi('grass', 'grass_flower');
  bi('grass_var', 'grass_var');
  bi('grass_var', 'grass_flower');
  bi('grass_flower', 'grass_flower');

  // Path edges connect grass to path center
  bi('grass', 'path_h_top');
  bi('grass', 'path_h_bot');
  bi('grass_var', 'path_h_top');
  bi('grass_var', 'path_h_bot');
  bi('path_h_top', 'path_center');
  bi('path_h_bot', 'path_center');
  bi('path_h_top', 'path_h_top');
  bi('path_h_bot', 'path_h_bot');
  bi('path_center', 'path_center');

  // Path edges can be adjacent to each other (for intersections)
  bi('path_h_top', 'path_h_bot');

  // Cobblestone
  bi('cobble', 'cobble');
  bi('cobble', 'path_center');
  bi('cobble', 'path_h_top');
  bi('cobble', 'path_h_bot');
  bi('cobble', 'grass');
  bi('cobble', 'grass_var');

  return neighbors;
}

// ---------------------------------------------------------------------------
// buildWFCRules - Create WFC data object from tile semantics
// ---------------------------------------------------------------------------

/**
 * Build WFC adjacency rules from tile-semantics.json
 * @param {Object} semantics - Parsed tile-semantics.json
 * @returns {{ tiles: Array, neighbors: Array }} - WFC SimpleTiledModel data format
 */
function buildWFCRules(semantics) {
  // We use abstract categories rather than all 132 tiles.
  // The semantics object is available for future refinement but the
  // core rules are hardcoded from known tile relationships.

  const tiles = Object.entries(WFC_TILE_MAP).map(([name, def]) => ({
    name: name,
    symmetry: 'X',
    weight: def.weight,
    // SimpleTiledModel requires bitmap data. We provide a dummy 1x1 RGBA pixel.
    // We only care about the observed[] output, not the graphics() output.
    bitmap: [255, 0, 0, 255], // single pixel RGBA (tilesize=1)
  }));

  const neighbors = buildNeighborRules();

  return {
    tilesize: 1,
    tiles: tiles,
    neighbors: neighbors,
  };
}

// ---------------------------------------------------------------------------
// Reverse map: WFC internal index -> category name -> tile ID
// ---------------------------------------------------------------------------

function buildReverseMap(wfcData) {
  // For X symmetry (cardinality 1), internal index i maps to tile i.
  // Order matches the tiles array order.
  const map = {};
  wfcData.tiles.forEach((t, i) => {
    map[i] = {
      name: t.name,
      tileId: WFC_TILE_MAP[t.name].tileId,
    };
  });
  return map;
}

// ---------------------------------------------------------------------------
// Post-processing helpers
// ---------------------------------------------------------------------------

/**
 * Get/set helpers for flat arrays indexed by (x, y) in a grid of given width.
 */
function idx(x, y, w) { return y * w + x; }

function layerGet(layer, x, y, w, h) {
  if (x < 0 || x >= w || y < 0 || y >= h) return TILE.EMPTY;
  return layer[idx(x, y, w)];
}

function layerSet(layer, x, y, w, val) {
  layer[idx(x, y, w)] = val;
}

/**
 * Fix paths: ensure paths are 2-wide and use correct edge tiles.
 * After WFC, path tiles may appear as single-width strips.
 * This pass widens them and corrects edges.
 */
function fixPaths(ground, w, h, rng) {
  const isPath = (id) =>
    id === TILE.PATH_EDGE_LT || id === TILE.PATH_CENTER ||
    id === TILE.PATH_EDGE_RB || id === TILE.PATH_VERT_EDGE;

  const isCobble = (id) => id === TILE.COBBLESTONE_A || id === TILE.COBBLESTONE_B;
  const isPathOrCobble = (id) => isPath(id) || isCobble(id);

  // First pass: find all path cells
  const pathCells = new Set();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isPath(layerGet(ground, x, y, w, h))) {
        pathCells.add(idx(x, y, w));
      }
    }
  }

  // Widen isolated path tiles (path should be at least 2 wide)
  for (const cellIdx of pathCells) {
    const x = cellIdx % w;
    const y = (cellIdx / w) | 0;

    // Check if this path tile has a path neighbor horizontally or vertically
    const hasPathNeighborH =
      isPathOrCobble(layerGet(ground, x - 1, y, w, h)) ||
      isPathOrCobble(layerGet(ground, x + 1, y, w, h));
    const hasPathNeighborV =
      isPathOrCobble(layerGet(ground, x, y - 1, w, h)) ||
      isPathOrCobble(layerGet(ground, x, y + 1, w, h));

    if (!hasPathNeighborH && !hasPathNeighborV) {
      // Isolated path tile: extend in a random direction
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const dir = dirs[(rng() * dirs.length) | 0];
      const nx = x + dir[0];
      const ny = y + dir[1];
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        layerSet(ground, nx, ny, w, TILE.PATH_CENTER);
      }
    }
  }

  // Second pass: reassign edge tiles based on neighbors
  const copy = ground.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = layerGet(copy, x, y, w, h);
      if (!isPath(t)) continue;

      const n = layerGet(copy, x, y - 1, w, h);
      const s = layerGet(copy, x, y + 1, w, h);
      const e = layerGet(copy, x + 1, y, w, h);
      const ww = layerGet(copy, x - 1, y, w, h);

      const nPath = isPathOrCobble(n);
      const sPath = isPathOrCobble(s);
      const ePath = isPathOrCobble(e);
      const wPath = isPathOrCobble(ww);

      // Determine correct tile based on which sides have grass
      if (nPath && sPath && ePath && wPath) {
        layerSet(ground, x, y, w, TILE.PATH_CENTER);
      } else if (!nPath && sPath) {
        // North is grass -> top edge
        layerSet(ground, x, y, w, TILE.PATH_EDGE_LT);
      } else if (nPath && !sPath) {
        // South is grass -> bottom edge
        layerSet(ground, x, y, w, TILE.PATH_EDGE_RB);
      } else if (!wPath && ePath) {
        // West is grass -> left/vertical edge
        layerSet(ground, x, y, w, TILE.PATH_VERT_EDGE);
      } else if (wPath && !ePath) {
        // East is grass -> right/vertical edge
        layerSet(ground, x, y, w, TILE.PATH_VERT_EDGE);
      } else {
        layerSet(ground, x, y, w, TILE.PATH_CENTER);
      }
    }
  }
}

/**
 * Place a tree at (x, y) on the objects and foreground layers.
 * Returns true if placement succeeded.
 */
function placeTree(objects, foreground, collision, x, y, w, h, treeDef) {
  if (treeDef.size === 2) {
    // 2x2 tree: canopy row at y, trunk row at y+1
    if (x + 1 >= w || y + 1 >= h) return false;
    if (layerGet(objects, x, y, w, h) !== TILE.EMPTY) return false;
    if (layerGet(objects, x + 1, y, w, h) !== TILE.EMPTY) return false;
    if (layerGet(objects, x, y + 1, w, h) !== TILE.EMPTY) return false;
    if (layerGet(objects, x + 1, y + 1, w, h) !== TILE.EMPTY) return false;

    layerSet(foreground, x, y, w, treeDef.canopy[0]);
    layerSet(foreground, x + 1, y, w, treeDef.canopy[1]);
    layerSet(objects, x, y + 1, w, treeDef.trunk[0]);
    layerSet(objects, x + 1, y + 1, w, treeDef.trunk[1]);
    layerSet(collision, x, y + 1, w, 1);
    layerSet(collision, x + 1, y + 1, w, 1);
    return true;
  } else {
    // 1x2 tree: canopy at y, trunk at y+1
    if (y + 1 >= h) return false;
    if (layerGet(objects, x, y, w, h) !== TILE.EMPTY) return false;
    if (layerGet(objects, x, y + 1, w, h) !== TILE.EMPTY) return false;

    layerSet(foreground, x, y, w, treeDef.canopy[0]);
    layerSet(objects, x, y + 1, w, treeDef.trunk[0]);
    layerSet(collision, x, y + 1, w, 1);
    return true;
  }
}

/**
 * Place a building template at position (bx, by) on the map layers.
 * by is the wall row; roof is at by-1. Fence at by+1.
 * Returns true if placement succeeded.
 */
function placeBuilding(ground, objects, foreground, collision, bx, by, w, h, template, rng) {
  const tw = template.w;
  // Check bounds: need 1 row above for roof, 1 row below for fence, plus margins
  if (bx + tw >= w - 2 || by - 1 < 2 || by + 1 >= h - 2) return false;

  // Check that entire footprint area is clear on objects layer
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = 0; dx < tw; dx++) {
      if (layerGet(objects, bx + dx, by + dy, w, h) !== TILE.EMPTY) return false;
      if (layerGet(foreground, bx + dx, by + dy, w, h) !== TILE.EMPTY) return false;
    }
  }

  // Place roof on foreground layer (row above wall)
  for (let dx = 0; dx < tw; dx++) {
    layerSet(foreground, bx + dx, by - 1, w, template.roof[dx]);
    layerSet(collision, bx + dx, by - 1, w, 1);
  }

  // Place walls on objects layer
  for (let dx = 0; dx < tw; dx++) {
    layerSet(objects, bx + dx, by, w, template.walls[dx]);
    layerSet(collision, bx + dx, by, w, 1);
  }

  // Mark door as walkable in collision
  layerSet(collision, bx + template.doorOffset, by, w, 0);

  // Place fence below building with gate aligned to door
  const fenceY = by + 1;
  const useBrown = rng() > 0.5;
  const fL = useBrown ? TILE.BROWN_FENCE_L : TILE.WHITE_FENCE_L;
  const fM = useBrown ? TILE.BROWN_FENCE_M : TILE.WHITE_FENCE_M;
  const fR = useBrown ? TILE.BROWN_FENCE_R : TILE.WHITE_FENCE_R;

  for (let dx = 0; dx < tw; dx++) {
    if (dx === template.doorOffset) continue; // gate opening
    let fTile;
    if (dx === 0) fTile = fL;
    else if (dx === tw - 1) fTile = fR;
    else fTile = fM;
    layerSet(objects, bx + dx, fenceY, w, fTile);
    layerSet(collision, bx + dx, fenceY, w, 1);
  }

  // Ensure ground under building is grass
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= tw; dx++) {
      const gx = bx + dx;
      const gy = by + dy;
      if (gx >= 0 && gx < w && gy >= 0 && gy < h) {
        const gTile = layerGet(ground, gx, gy, w, h);
        if (gTile === TILE.COBBLESTONE_A || gTile === TILE.COBBLESTONE_B) {
          layerSet(ground, gx, gy, w, TILE.GRASS_PLAIN);
        }
      }
    }
  }

  return true;
}

/**
 * Find path tiles and return their positions as an array of {x, y}.
 */
function findPathTiles(ground, w, h) {
  const positions = [];
  const isPath = (id) =>
    id === TILE.PATH_EDGE_LT || id === TILE.PATH_CENTER ||
    id === TILE.PATH_EDGE_RB || id === TILE.PATH_VERT_EDGE ||
    id === TILE.COBBLESTONE_A || id === TILE.COBBLESTONE_B;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isPath(layerGet(ground, x, y, w, h))) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

/**
 * Check if a rectangular region is clear on all object/foreground layers.
 */
function isRegionClear(objects, foreground, collision, x, y, rw, rh, w, h) {
  for (let dy = 0; dy < rh; dy++) {
    for (let dx = 0; dx < rw; dx++) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) return false;
      if (layerGet(objects, cx, cy, w, h) !== TILE.EMPTY) return false;
      if (layerGet(foreground, cx, cy, w, h) !== TILE.EMPTY) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Post-processing pipeline
// ---------------------------------------------------------------------------

/**
 * Add tree border around map edges.
 */
function addTreeBorder(objects, foreground, collision, ground, w, h, rng) {
  const borderDepth = 3;
  const isGrass = (id) =>
    id === TILE.GRASS_PLAIN || id === TILE.GRASS_FLOWERS || id === TILE.GRASS_WHITE_FLOWERS;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onBorder =
        x < borderDepth || x >= w - borderDepth ||
        y < borderDepth || y >= h - borderDepth;

      if (!onBorder) continue;
      if (!isGrass(layerGet(ground, x, y, w, h))) continue;
      if (layerGet(objects, x, y, w, h) !== TILE.EMPTY) continue;
      if (layerGet(foreground, x, y, w, h) !== TILE.EMPTY) continue;

      // Random chance to skip for natural look
      if (rng() < 0.25) continue;

      const treeType = TREE_TYPES[(rng() * TREE_TYPES.length) | 0];
      placeTree(objects, foreground, collision, x, y, w, h, TREE_DEFS[treeType]);
    }
  }
}

/**
 * Place buildings along paths.
 */
function addBuildings(ground, objects, foreground, collision, w, h, rng, count) {
  const pathTiles = findPathTiles(ground, w, h);
  if (pathTiles.length === 0) return;

  const templateNames = Object.keys(BUILDING_TEMPLATES);
  let placed = 0;
  let attempts = 0;
  const maxAttempts = count * 30;

  while (placed < count && attempts < maxAttempts) {
    attempts++;

    // Pick a random path tile
    const pathTile = pathTiles[(rng() * pathTiles.length) | 0];

    // Place building 3-5 tiles away from path (above or below)
    const offset = 3 + ((rng() * 3) | 0);
    const above = rng() > 0.5;
    const by = above ? pathTile.y - offset : pathTile.y + offset;
    const bx = pathTile.x - 1 + ((rng() * 3) | 0);

    const tName = templateNames[(rng() * templateNames.length) | 0];
    const template = BUILDING_TEMPLATES[tName];

    // Check minimum distance from existing buildings
    let tooClose = false;
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= template.w + 5; dx++) {
        const cx = bx + dx;
        const cy = by + dy;
        if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
          const obj = layerGet(objects, cx, cy, w, h);
          // Check if there's already a wall/roof tile nearby
          if (obj >= 48 && obj <= 101 && obj !== TILE.EMPTY) {
            tooClose = true;
            break;
          }
        }
      }
      if (tooClose) break;
    }

    if (!tooClose && placeBuilding(ground, objects, foreground, collision, bx, by, w, h, template, rng)) {
      // Create a path segment from door to nearest path
      const doorX = bx + template.doorOffset;
      const doorY = above ? by + 1 : by - 1;

      // Draw path from door toward the original path tile
      let py = doorY;
      const targetY = pathTile.y;
      const step = py < targetY ? 1 : -1;

      while (py !== targetY) {
        py += step;
        const gTile = layerGet(ground, doorX, py, w, h);
        if (gTile === TILE.GRASS_PLAIN || gTile === TILE.GRASS_FLOWERS || gTile === TILE.GRASS_WHITE_FLOWERS) {
          layerSet(ground, doorX, py, w, TILE.PATH_CENTER);
          // Make 2-wide
          if (doorX + 1 < w) {
            const g2 = layerGet(ground, doorX + 1, py, w, h);
            if (g2 === TILE.GRASS_PLAIN || g2 === TILE.GRASS_FLOWERS || g2 === TILE.GRASS_WHITE_FLOWERS) {
              layerSet(ground, doorX + 1, py, w, TILE.PATH_CENTER);
            }
          }
        }
      }

      placed++;
    }
  }
}

/**
 * Add tree clusters in open grass areas.
 */
function addTreeClusters(objects, foreground, collision, ground, w, h, rng, count) {
  const isGrass = (id) =>
    id === TILE.GRASS_PLAIN || id === TILE.GRASS_FLOWERS || id === TILE.GRASS_WHITE_FLOWERS;

  let placed = 0;
  let attempts = 0;

  while (placed < count && attempts < count * 20) {
    attempts++;

    // Random position away from borders
    const cx = 5 + ((rng() * (w - 10)) | 0);
    const cy = 5 + ((rng() * (h - 10)) | 0);

    // Check 5x5 area is mostly grass and clear
    let grassCount = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (isGrass(layerGet(ground, cx + dx, cy + dy, w, h)) &&
            layerGet(objects, cx + dx, cy + dy, w, h) === TILE.EMPTY) {
          grassCount++;
        }
      }
    }

    if (grassCount < 15) continue;

    // Place 2-5 trees in a cluster
    const clusterSize = 2 + ((rng() * 4) | 0);
    let treesPlaced = 0;
    for (let t = 0; t < clusterSize; t++) {
      const tx = cx - 2 + ((rng() * 5) | 0);
      const ty = cy - 2 + ((rng() * 5) | 0);
      const treeType = TREE_TYPES[(rng() * TREE_TYPES.length) | 0];

      if (isGrass(layerGet(ground, tx, ty, w, h)) &&
          placeTree(objects, foreground, collision, tx, ty, w, h, TREE_DEFS[treeType])) {
        treesPlaced++;
      }
    }

    if (treesPlaced > 0) placed++;
  }
}

/**
 * Add decorations near buildings (flowers, bushes, lanterns).
 */
function addDecorations(objects, collision, ground, w, h, rng) {
  const isGrass = (id) =>
    id === TILE.GRASS_PLAIN || id === TILE.GRASS_FLOWERS || id === TILE.GRASS_WHITE_FLOWERS;

  const decorations = [TILE.TULIP, TILE.FERN, TILE.PURPLE_FLOWER_BUSH, TILE.BUSH_GREEN, TILE.BUSH_BERRY];
  const walkableDecorations = new Set([TILE.TULIP, TILE.FERN, TILE.PURPLE_FLOWER_BUSH]);

  // Find building tiles (wall tiles)
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const obj = layerGet(objects, x, y, w, h);
      // Detect wall tiles
      const isWall =
        (obj >= TILE.BLUE_WALL_L && obj <= TILE.BLUE_WALL_R) ||
        (obj >= TILE.WOOD_L && obj <= TILE.WOOD_WINDOW) ||
        (obj >= TILE.STONE_L && obj <= TILE.STONE_WINDOW);

      if (!isWall) continue;

      // Place decorations in a ring 2-3 tiles away
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue; // skip near building
          if (rng() > 0.15) continue; // sparse placement

          const px = x + dx;
          const py = y + dy;
          if (px < 0 || px >= w || py < 0 || py >= h) continue;
          if (!isGrass(layerGet(ground, px, py, w, h))) continue;
          if (layerGet(objects, px, py, w, h) !== TILE.EMPTY) continue;

          const dec = decorations[(rng() * decorations.length) | 0];
          layerSet(objects, px, py, w, dec);
          if (!walkableDecorations.has(dec)) {
            layerSet(collision, px, py, w, 1);
          }
        }
      }
    }
  }

  // Place a well near the center of the map if there's room
  const wcx = (w / 2) | 0;
  const wcy = (h / 2) | 0;

  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const wx = wcx + dx;
      const wy = wcy + dy;
      if (layerGet(objects, wx, wy, w, h) === TILE.EMPTY &&
          layerGet(objects, wx, wy + 1, w, h) === TILE.EMPTY &&
          wy + 1 < h) {
        layerSet(objects, wx, wy, w, TILE.WELL_TOP);
        layerSet(objects, wx, wy + 1, w, TILE.WELL_BASE);
        layerSet(collision, wx, wy, w, 1);
        layerSet(collision, wx, wy + 1, w, 1);
        // Done
        return;
      }
    }
  }
}

/**
 * Generate collision layer from ground and objects.
 * 0 = walkable, 1 = blocked.
 */
function buildCollisionLayer(ground, objects, foreground, collision, w, h) {
  const isPath = (id) =>
    id === TILE.PATH_EDGE_LT || id === TILE.PATH_CENTER ||
    id === TILE.PATH_EDGE_RB || id === TILE.PATH_VERT_EDGE ||
    id === TILE.COBBLESTONE_A || id === TILE.COBBLESTONE_B;

  const WALKABLE_OBJECTS = new Set([
    TILE.WOOD_DOOR, TILE.STONE_DOOR,
    TILE.TULIP, TILE.FERN, TILE.PURPLE_FLOWER_BUSH,
    TILE.GRASS_FLOWERS, TILE.GRASS_WHITE_FLOWERS,
  ]);

  // collision layer is already partially filled by building/tree placement
  // Fill in remaining cells: blocked at borders, walkable on paths/grass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      // Skip if already set by building/tree/decoration placement
      if (collision[i] !== 0) continue;

      // Block map edges (1 tile border)
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) {
        collision[i] = 1;
        continue;
      }

      const obj = objects[i];
      if (obj !== TILE.EMPTY && !WALKABLE_OBJECTS.has(obj)) {
        collision[i] = 1;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

/**
 * Generate a map using WFC
 * @param {Object} options
 * @param {number} [options.width=60] - Map width in tiles
 * @param {number} [options.height=40] - Map height in tiles
 * @param {string} [options.theme="village"] - Theme (future: "forest", "dungeon")
 * @param {number} [options.seed] - Random seed
 * @param {number} [options.maxRetries=10] - Max WFC attempts before giving up
 * @returns {{ success: boolean, ground: number[], objects: number[], foreground: number[], collision: number[], width: number, height: number, attempts: number }}
 */
function generateWithWFC(options) {
  const {
    width = 60,
    height = 40,
    theme = 'village',
    seed,
    maxRetries = 10,
  } = options || {};

  const baseSeed = seed != null ? seed : (Date.now() ^ (Math.random() * 0xFFFFFFFF)) | 0;
  const totalCells = width * height;

  // Load semantics for rule building (optional enrichment)
  let semantics = null;
  try {
    const semanticsPath = path.join(__dirname, 'tile-semantics.json');
    semantics = JSON.parse(fs.readFileSync(semanticsPath, 'utf8'));
  } catch (e) {
    // Proceed without semantics file — use hardcoded rules only
  }

  // Build WFC rules
  const wfcData = buildWFCRules(semantics);
  const reverseMap = buildReverseMap(wfcData);

  // Attempt WFC generation with retries
  let success = false;
  let observed = null;
  let attempts = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    attempts++;
    const attemptSeed = baseSeed + attempt;
    const rng = mulberry32(attemptSeed);

    try {
      const model = new wfc.SimpleTiledModel(wfcData, null, width, height, false);
      success = model.generate(rng);

      if (success) {
        observed = model.observed;
        break;
      }
    } catch (e) {
      // WFC contradiction or error — retry with different seed
      continue;
    }
  }

  if (!success || !observed) {
    // Fallback: fill with grass
    const ground = new Array(totalCells).fill(TILE.GRASS_PLAIN);
    const objects = new Array(totalCells).fill(TILE.EMPTY);
    const foreground = new Array(totalCells).fill(TILE.EMPTY);
    const collision = new Array(totalCells).fill(0);

    return {
      success: false,
      ground,
      objects,
      foreground,
      collision,
      width,
      height,
      attempts,
    };
  }

  // Map WFC observed indices to tile IDs for the ground layer
  const rng = mulberry32(baseSeed);
  const ground = new Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    const entry = reverseMap[observed[i]];
    if (entry) {
      ground[i] = entry.tileId;
    } else {
      ground[i] = TILE.GRASS_PLAIN;
    }
  }

  // Vary cobblestone tiles for visual interest
  for (let i = 0; i < totalCells; i++) {
    if (ground[i] === TILE.COBBLESTONE_A && rng() > 0.5) {
      ground[i] = TILE.COBBLESTONE_B;
    }
  }

  // Initialize other layers
  const objects = new Array(totalCells).fill(TILE.EMPTY);
  const foreground = new Array(totalCells).fill(TILE.EMPTY);
  const collision = new Array(totalCells).fill(0);

  // Post-processing pipeline
  const postRng = mulberry32(baseSeed + 1000);

  // 1. Fix paths (ensure 2-wide, correct edge tiles)
  fixPaths(ground, width, height, postRng);

  // 2. Place buildings along paths (3-5 for village theme)
  const buildingCount = theme === 'village' ? 3 + ((postRng() * 3) | 0) : 3;
  addBuildings(ground, objects, foreground, collision, width, height, postRng, buildingCount);

  // 3. Re-fix paths after building connections
  fixPaths(ground, width, height, postRng);

  // 4. Add tree border on map edges
  addTreeBorder(objects, foreground, collision, ground, width, height, postRng);

  // 5. Add tree clusters in open areas (5-10 clusters)
  const clusterCount = 5 + ((postRng() * 6) | 0);
  addTreeClusters(objects, foreground, collision, ground, width, height, postRng, clusterCount);

  // 6. Add decorations near buildings
  addDecorations(objects, collision, ground, width, height, postRng);

  // 7. Build final collision layer
  buildCollisionLayer(ground, objects, foreground, collision, width, height);

  return {
    success: true,
    ground,
    objects,
    foreground,
    collision,
    width,
    height,
    attempts,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { generateWithWFC, buildWFCRules };

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

if (require.main === module) {
  const semantics = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, 'tile-semantics.json'), 'utf8'));
    } catch (e) {
      console.log('Warning: tile-semantics.json not found, using hardcoded rules');
      return null;
    }
  })();

  // Show WFC rules summary
  const rules = buildWFCRules(semantics);
  console.log('WFC tiles:', rules.tiles.map(t => `${t.name}(w=${t.weight})`).join(', '));
  console.log('WFC neighbor rules:', rules.neighbors.length);

  console.log('\n--- Generating 60x40 village map ---');
  console.time('WFC generation');
  const result = generateWithWFC({ width: 60, height: 40, theme: 'village', seed: 42 });
  console.timeEnd('WFC generation');

  console.log('Success:', result.success);
  console.log('Attempts:', result.attempts);
  console.log('Ground tiles:', result.ground.length);
  console.log('Non-empty objects:', result.objects.filter(t => t >= 0).length);
  console.log('Non-empty foreground:', result.foreground.filter(t => t >= 0).length);
  console.log('Blocked collision:', result.collision.filter(t => t === 1).length);

  // Count tile distribution
  const counts = {};
  result.ground.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  console.log('Ground distribution:', counts);

  // Run a few more to test reliability
  console.log('\n--- Reliability test (10 maps) ---');
  let successes = 0;
  let totalAttempts = 0;
  console.time('10 maps');
  for (let i = 0; i < 10; i++) {
    const r = generateWithWFC({ width: 60, height: 40, theme: 'village', seed: i * 1000 });
    if (r.success) successes++;
    totalAttempts += r.attempts;
  }
  console.timeEnd('10 maps');
  console.log(`Success rate: ${successes}/10, avg attempts: ${(totalAttempts / 10).toFixed(1)}`);
}
