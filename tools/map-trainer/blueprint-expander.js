/**
 * blueprint-expander.js
 *
 * Converts LLM-generated semantic zone blueprints into 4 tile layers
 * (ground, objects, foreground, collision) using a deterministic 7-pass
 * expansion pipeline with seeded PRNG.
 *
 * @module blueprint-expander
 */

"use strict";

// ---------------------------------------------------------------------------
// Tile ID constants (verified from ASSET-VISUAL-AUDIT.md)
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
  PATH_EDGE_LT: 39,   // left / top edge
  PATH_CENTER: 40,
  PATH_EDGE_RB: 41,    // right / bottom edge
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

  // Brick walls
  BRICK_L: 60,
  BRICK_M: 61,
  BRICK_R: 62,

  // Blue roof walls (row beneath blue roof)
  BLUE_WALL_L: 48,
  BLUE_WALL_M: 49,
  BLUE_WALL_R: 50,

  // White fence
  WHITE_FENCE_L: 96,
  WHITE_FENCE_M: 97,
  WHITE_FENCE_R: 98,

  // Brown fence
  BROWN_FENCE_L: 99,
  BROWN_FENCE_M: 100,
  BROWN_FENCE_R: 101,

  FENCE_POST: 108,

  // Trees (2x2) - canopy on foreground, trunk on objects
  GREEN_TREE_CANOPY_L: 4,
  GREEN_TREE_CANOPY_R: 5,
  GREEN_TREE_TRUNK_L: 12,
  GREEN_TREE_TRUNK_R: 13,

  AUTUMN_TREE_CANOPY_L: 7,
  AUTUMN_TREE_CANOPY_R: 8,
  AUTUMN_TREE_TRUNK_L: 24,
  AUTUMN_TREE_TRUNK_R: 25,

  // Trees (1x2) - top on foreground, trunk on objects
  PINE_TOP: 10,
  PINE_TRUNK: 22,
  DENSE_TOP: 11,
  DENSE_TRUNK: 23,

  // Small trees (single tile, objects)
  SMALL_GREEN: 6,
  SMALL_AUTUMN: 9,
  SMALL_COMPLETE: 16,
  SMALL_FRUIT: 17,

  // Bushes (objects)
  BUSH_GREEN: 28,
  BUSH_BERRY: 29,

  // Flowers / understory (objects)
  TULIP: 15,
  FERN: 18,
  PURPLE_FLOWER_BUSH: 19,

  // Water edge tiles (objects)
  WATER_NW: 109,
  WATER_N: 110,
  WATER_NE: 111,
  WATER_W: 121,
  WATER_CENTER: 122,
  WATER_E: 123,
  WATER_SW: 120,
  WATER_S: 112,
  WATER_SE: 113,

  // Decorations (objects)
  WELL_TOP: 92,
  WELL_BASE: 104,
  LANTERN: 93,
  BARREL: 107,
  TREASURE_CLOSED: 128,
  TREASURE_OPEN: 129,
  HEART: 130,
  STAR: 131,
  KEY: 94,
  COIN: 95,
};

// Tiles that are walkable even though they sit on the objects layer
const WALKABLE_OBJECT_TILES = new Set([
  TILE.WOOD_DOOR,
  TILE.STONE_DOOR,
  TILE.PATH_EDGE_LT,
  TILE.PATH_CENTER,
  TILE.PATH_EDGE_RB,
  TILE.PATH_VERT_EDGE,
  TILE.COBBLESTONE_A,
  TILE.COBBLESTONE_B,
  TILE.TULIP,
  TILE.FERN,
  TILE.GRASS_FLOWERS,
  TILE.GRASS_WHITE_FLOWERS,
  TILE.PURPLE_FLOWER_BUSH,
  TILE.COIN,
  TILE.STAR,
  TILE.HEART,
  TILE.KEY,
  TILE.TREASURE_CLOSED,
  TILE.TREASURE_OPEN,
]);

// Deprecated tiles -- never emit these
const DEPRECATED = new Set([14, 105, 106, 116]);

// ---------------------------------------------------------------------------
// Building templates
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
  stone_shop_large: {
    w: 5,
    roof: [TILE.RED_ROOF_L, TILE.RED_ROOF_M, TILE.RED_ROOF_M, TILE.RED_ROOF_M, TILE.RED_ROOF_R],
    walls: [TILE.STONE_L, TILE.STONE_WINDOW, TILE.STONE_DOOR, TILE.STONE_WINDOW, TILE.STONE_PLAIN],
    doorOffset: 2,
  },
  blue_roof_house: {
    w: 3,
    roof: [TILE.BLUE_ROOF_L, TILE.BLUE_CHIMNEY, TILE.BLUE_ROOF_R],
    walls: [TILE.BLUE_WALL_L, TILE.BLUE_WALL_M, TILE.BLUE_WALL_R],
    doorOffset: 1, // centre tile treated as door for fence gap
  },
};

// ---------------------------------------------------------------------------
// Tree type definitions
// ---------------------------------------------------------------------------

const TREE_DEFS = {
  green_tree: {
    size: 2, // 2x2
    canopy: [TILE.GREEN_TREE_CANOPY_L, TILE.GREEN_TREE_CANOPY_R],
    trunk: [TILE.GREEN_TREE_TRUNK_L, TILE.GREEN_TREE_TRUNK_R],
  },
  autumn_tree: {
    size: 2,
    canopy: [TILE.AUTUMN_TREE_CANOPY_L, TILE.AUTUMN_TREE_CANOPY_R],
    trunk: [TILE.AUTUMN_TREE_TRUNK_L, TILE.AUTUMN_TREE_TRUNK_R],
  },
  pine_tree: {
    size: 1, // 1-wide, 2-tall
    canopy: [TILE.PINE_TOP],
    trunk: [TILE.PINE_TRUNK],
  },
  dense_tree: {
    size: 1,
    canopy: [TILE.DENSE_TOP],
    trunk: [TILE.DENSE_TRUNK],
  },
};

// ---------------------------------------------------------------------------
// Seeded PRNG -- mulberry32
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
// Value noise with smoothstep
// ---------------------------------------------------------------------------

function createNoiseGrid(w, h, scale, rng) {
  const gw = Math.ceil(w / scale) + 2;
  const gh = Math.ceil(h / scale) + 2;
  const lattice = [];
  for (let i = 0; i < gh; i++) {
    lattice[i] = [];
    for (let j = 0; j < gw; j++) lattice[i][j] = rng();
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
      grid[y][x] = lerp(
        lerp(lattice[iy][ix], lattice[iy][ix + 1], tx),
        lerp(lattice[iy + 1][ix], lattice[iy + 1][ix + 1], tx),
        ty
      );
    }
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flat index for row-major layout */
function idx(x, y, w) {
  return y * w + x;
}

/** Check bounds */
function inBounds(x, y, w, h) {
  return x >= 0 && x < w && y >= 0 && y < h;
}

/**
 * Bresenham's line algorithm returning all integer points between (x0,y0)
 * and (x1,y1) inclusive.
 */
function bresenhamLine(x0, y0, x1, y1) {
  const points = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0;
  let cy = y0;
  while (true) {
    points.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return points;
}

/**
 * Compute manhattan distance from (x,y) to the nearest cell in a set of
 * pre-computed "attractor" positions.  Uses a simple lookup to avoid O(n)
 * per cell -- we build a distance map lazily.
 */
function buildDistanceMap(w, h, attractors) {
  const dist = new Int32Array(w * h).fill(0x7fffffff);
  // BFS from all attractors simultaneously
  const queue = [];
  for (const { x, y } of attractors) {
    if (inBounds(x, y, w, h)) {
      const i = idx(x, y, w);
      if (dist[i] > 0) {
        dist[i] = 0;
        queue.push(i);
      }
    }
  }
  let head = 0;
  const dirs = [1, -1, w, -w];
  while (head < queue.length) {
    const ci = queue[head++];
    const cx = ci % w;
    const cy = (ci - cx) / w;
    const nd = dist[ci] + 1;
    for (const d of dirs) {
      const ni = ci + d;
      if (ni < 0 || ni >= w * h) continue;
      const nx = ni % w;
      // Prevent wrapping
      if (Math.abs(nx - cx) > 1) continue;
      if (dist[ni] > nd) {
        dist[ni] = nd;
        queue.push(ni);
      }
    }
  }
  return dist;
}

// ---------------------------------------------------------------------------
// Pass implementations
// ---------------------------------------------------------------------------

/**
 * Pass 1: Ground fill with value noise and groundMix ratios.
 */
function passGround(ground, w, h, blueprint, rng) {
  const mix = blueprint.groundMix || { plain: 0.65, variant: 0.25, flower: 0.10 };
  const noise = createNoiseGrid(w, h, 6, rng);

  // Collect attractor positions (buildings and water zones) for flower proximity
  const attractors = [];
  for (const z of blueprint.zones) {
    if (z.type === "building-zone" && z.position) {
      attractors.push(z.position);
    }
    if (z.type === "water" && z.bounds) {
      // Add corners and centre of water
      const b = z.bounds;
      attractors.push({ x: b.x, y: b.y });
      attractors.push({ x: b.x + b.w - 1, y: b.y + b.h - 1 });
      attractors.push({ x: Math.floor(b.x + b.w / 2), y: Math.floor(b.y + b.h / 2) });
    }
  }
  const distMap = attractors.length > 0 ? buildDistanceMap(w, h, attractors) : null;

  // Cumulative thresholds
  const plainThresh = mix.plain;
  const variantThresh = mix.plain + mix.variant;
  // remainder = flower

  // Track consecutive same-tile counts per row
  for (let y = 0; y < h; y++) {
    let consecutive = 0;
    let lastTile = TILE.EMPTY;
    for (let x = 0; x < w; x++) {
      const n = noise[y][x]; // 0..1
      let tile;
      if (n < plainThresh) {
        tile = TILE.GRASS_PLAIN;
      } else if (n < variantThresh) {
        tile = TILE.GRASS_FLOWERS; // variant
      } else {
        // Flower tile -- only allowed within 4 tiles of an attractor
        const canFlower = distMap ? distMap[idx(x, y, w)] <= 4 : false;
        tile = canFlower ? TILE.GRASS_WHITE_FLOWERS : TILE.GRASS_PLAIN;
      }

      // Enforce no more than 4 consecutive same tiles
      if (tile === lastTile) {
        consecutive++;
        if (consecutive >= 4) {
          // Force a different variant
          tile = tile === TILE.GRASS_PLAIN ? TILE.GRASS_FLOWERS : TILE.GRASS_PLAIN;
          consecutive = 1;
        }
      } else {
        consecutive = 1;
      }

      lastTile = tile;
      ground[idx(x, y, w)] = tile;
    }
  }
}

/**
 * Pass 2: Path expansion using Bresenham between consecutive waypoints.
 */
function passPaths(ground, w, h, blueprint, _rng) {
  const pathZones = blueprint.zones.filter((z) => z.type === "path");

  // Track all path cells so we can detect intersections
  const pathCells = new Set();

  for (const zone of pathZones) {
    const wps = zone.waypoints;
    if (!wps || wps.length < 2) continue;
    const pathWidth = zone.width || 2;

    for (let i = 0; i < wps.length - 1; i++) {
      const a = wps[i];
      const b = wps[i + 1];
      const centerLine = bresenhamLine(a.x, a.y, b.x, b.y);

      // Determine primary direction of this segment
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      const isHorizontal = dx >= dy;

      for (const pt of centerLine) {
        if (isHorizontal) {
          // Expand vertically
          for (let off = 0; off < pathWidth; off++) {
            const py = pt.y + off;
            if (!inBounds(pt.x, py, w, h)) continue;
            const wasPath = pathCells.has(idx(pt.x, py, w));
            let tile;
            if (off === 0) {
              tile = TILE.PATH_EDGE_LT; // top edge
            } else if (off === pathWidth - 1) {
              tile = TILE.PATH_EDGE_RB; // bottom edge
            } else {
              tile = TILE.PATH_CENTER;
            }
            // If this cell was already a path (intersection), use center
            if (wasPath) tile = TILE.PATH_CENTER;
            ground[idx(pt.x, py, w)] = tile;
            pathCells.add(idx(pt.x, py, w));
          }
        } else {
          // Vertical segment -- expand horizontally
          for (let off = 0; off < pathWidth; off++) {
            const px = pt.x + off;
            if (!inBounds(px, pt.y, w, h)) continue;
            const wasPath = pathCells.has(idx(px, pt.y, w));
            let tile;
            if (off === 0) {
              tile = TILE.PATH_EDGE_LT; // left edge
            } else if (off === pathWidth - 1) {
              tile = TILE.PATH_EDGE_RB; // right edge
            } else {
              tile = TILE.PATH_CENTER;
            }
            if (wasPath) tile = TILE.PATH_CENTER;
            ground[idx(px, pt.y, w)] = tile;
            pathCells.add(idx(px, pt.y, w));
          }
        }
      }
    }

    // Handle waypoint intersections: 3x3 center fill
    for (let i = 1; i < wps.length - 1; i++) {
      const wp = wps[i];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = wp.x + dx;
          const py = wp.y + dy;
          if (inBounds(px, py, w, h)) {
            ground[idx(px, py, w)] = TILE.PATH_CENTER;
            pathCells.add(idx(px, py, w));
          }
        }
      }
    }
  }
}

/**
 * Pass 3: Building placement on the objects layer.
 */
function passBuildings(objects, collision, w, h, blueprint, _rng) {
  const buildingZones = blueprint.zones.filter((z) => z.type === "building-zone");

  for (const zone of buildingZones) {
    const tmpl = BUILDING_TEMPLATES[zone.template];
    if (!tmpl) continue;
    const px = zone.position.x;
    const py = zone.position.y;

    // Place roof row
    for (let dx = 0; dx < tmpl.w; dx++) {
      const tx = px + dx;
      const ty = py;
      if (!inBounds(tx, ty, w, h)) continue;
      objects[idx(tx, ty, w)] = tmpl.roof[dx];
      collision[idx(tx, ty, w)] = 1;
    }

    // Place wall row
    for (let dx = 0; dx < tmpl.w; dx++) {
      const tx = px + dx;
      const ty = py + 1;
      if (!inBounds(tx, ty, w, h)) continue;
      objects[idx(tx, ty, w)] = tmpl.walls[dx];
      // Door tiles are walkable
      const tile = tmpl.walls[dx];
      collision[idx(tx, ty, w)] = (tile === TILE.WOOD_DOOR || tile === TILE.STONE_DOOR) ? 0 : 1;
    }

    // Fence
    if (zone.fenced) {
      const fenceY = py + 2;
      const fenceStartX = px - 1;
      const fenceW = tmpl.w + 2;
      const fenceType = zone.fenceType || "white";
      const fL = fenceType === "brown" ? TILE.BROWN_FENCE_L : TILE.WHITE_FENCE_L;
      const fM = fenceType === "brown" ? TILE.BROWN_FENCE_M : TILE.WHITE_FENCE_M;
      const fR = fenceType === "brown" ? TILE.BROWN_FENCE_R : TILE.WHITE_FENCE_R;

      // Door column in the fence coordinate system
      const doorCol = px + tmpl.doorOffset;

      for (let i = 0; i < fenceW; i++) {
        const fx = fenceStartX + i;
        if (!inBounds(fx, fenceY, w, h)) continue;

        // Gap at door alignment
        if (fx === doorCol) {
          // Leave empty for passage
          continue;
        }

        let tile;
        if (i === 0) tile = fL;
        else if (i === fenceW - 1) tile = fR;
        else tile = fM;

        objects[idx(fx, fenceY, w)] = tile;
        collision[idx(fx, fenceY, w)] = 1;
      }
    }
  }
}

/**
 * Pass 4: Water placement using 9-tile edge system.
 */
function passWater(objects, collision, w, h, blueprint) {
  const waterZones = blueprint.zones.filter((z) => z.type === "water");

  for (const zone of waterZones) {
    const b = zone.bounds;
    if (!b) continue;

    for (let dy = 0; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        const tx = b.x + dx;
        const ty = b.y + dy;
        if (!inBounds(tx, ty, w, h)) continue;

        const isTop = dy === 0;
        const isBottom = dy === b.h - 1;
        const isLeft = dx === 0;
        const isRight = dx === b.w - 1;

        let tile;
        if (isTop && isLeft) tile = TILE.WATER_NW;
        else if (isTop && isRight) tile = TILE.WATER_NE;
        else if (isTop) tile = TILE.WATER_N;
        else if (isBottom && isLeft) tile = TILE.WATER_SW;
        else if (isBottom && isRight) tile = TILE.WATER_SE;
        else if (isBottom) tile = TILE.WATER_S;
        else if (isLeft) tile = TILE.WATER_W;
        else if (isRight) tile = TILE.WATER_E;
        else tile = TILE.WATER_CENTER;

        objects[idx(tx, ty, w)] = tile;
        collision[idx(tx, ty, w)] = 1;
      }
    }
  }
}

/**
 * Pass 5: Tree and forest placement.
 */
function passTrees(objects, foreground, collision, w, h, blueprint, rng) {
  const noise = createNoiseGrid(w, h, 4, rng);

  /**
   * Place a single tree of the given type at (tx, ty).
   * Returns true if placed, false if blocked.
   */
  function placeTree(treeName, tx, ty) {
    const def = TREE_DEFS[treeName];
    if (!def) return false;

    if (def.size === 2) {
      // 2x2 tree: canopy at (tx, ty), (tx+1, ty); trunk at (tx, ty+1), (tx+1, ty+1)
      const cells = [
        { x: tx, y: ty }, { x: tx + 1, y: ty },
        { x: tx, y: ty + 1 }, { x: tx + 1, y: ty + 1 },
      ];
      // Check all cells are in bounds and empty
      for (const c of cells) {
        if (!inBounds(c.x, c.y, w, h)) return false;
        if (objects[idx(c.x, c.y, w)] !== TILE.EMPTY) return false;
        if (foreground[idx(c.x, c.y, w)] !== TILE.EMPTY) return false;
      }
      // Place canopy on foreground
      foreground[idx(tx, ty, w)] = def.canopy[0];
      foreground[idx(tx + 1, ty, w)] = def.canopy[1];
      // Place trunk on objects
      objects[idx(tx, ty + 1, w)] = def.trunk[0];
      objects[idx(tx + 1, ty + 1, w)] = def.trunk[1];
      // Collision on trunk
      collision[idx(tx, ty + 1, w)] = 1;
      collision[idx(tx + 1, ty + 1, w)] = 1;
      return true;
    } else {
      // 1-wide, 2-tall tree: top on foreground at (tx, ty), trunk on objects at (tx, ty+1)
      if (!inBounds(tx, ty, w, h) || !inBounds(tx, ty + 1, w, h)) return false;
      if (objects[idx(tx, ty, w)] !== TILE.EMPTY && foreground[idx(tx, ty, w)] !== TILE.EMPTY) return false;
      if (objects[idx(tx, ty + 1, w)] !== TILE.EMPTY) return false;

      foreground[idx(tx, ty, w)] = def.canopy[0];
      objects[idx(tx, ty + 1, w)] = def.trunk[0];
      collision[idx(tx, ty + 1, w)] = 1;
      return true;
    }
  }

  // Understory tiles
  const understoryTiles = [TILE.FERN, TILE.SMALL_GREEN, TILE.SMALL_AUTUMN, TILE.SMALL_COMPLETE, TILE.BUSH_GREEN, TILE.BUSH_BERRY];

  function placeUnderstory(tx, ty) {
    if (!inBounds(tx, ty, w, h)) return;
    if (objects[idx(tx, ty, w)] !== TILE.EMPTY) return;
    const pick = understoryTiles[Math.floor(rng() * understoryTiles.length)];
    objects[idx(tx, ty, w)] = pick;
  }

  // --- Forest zones ---
  const forestZones = blueprint.zones.filter((z) => z.type === "forest");
  for (const zone of forestZones) {
    const b = zone.bounds;
    if (!b) continue;
    const densityMap = { dense: 0.60, medium: 0.40, sparse: 0.20 };
    const coverage = densityMap[zone.density] || 0.40;
    const types = zone.treeTypes && zone.treeTypes.length > 0 ? zone.treeTypes : ["green_tree"];

    // Walk the bounds in a staggered pattern with 2-tile spacing
    for (let gy = b.y; gy < b.y + b.h - 1; gy += 2) {
      const rowOffset = ((gy - b.y) % 4 === 0) ? 0 : 1; // stagger
      for (let gx = b.x + rowOffset; gx < b.x + b.w - 1; gx += 3) {
        // Use noise for organic distribution
        const n = noise[Math.min(gy, h - 1)][Math.min(gx, w - 1)];
        if (n > coverage) continue;

        const treeName = types[Math.floor(rng() * types.length)];
        const placed = placeTree(treeName, gx, gy);

        // Add understory below/beside trunk
        if (placed) {
          const def = TREE_DEFS[treeName];
          const trunkY = gy + 1;
          if (def && def.size === 2) {
            // Understory beneath 2-wide trunk
            if (rng() < 0.4) placeUnderstory(gx, trunkY + 1);
            if (rng() < 0.4) placeUnderstory(gx + 1, trunkY + 1);
          } else {
            if (rng() < 0.4) placeUnderstory(gx, trunkY + 1);
          }
        }
      }
    }
  }

  // --- Tree cluster zones ---
  const clusterZones = blueprint.zones.filter((z) => z.type === "tree-cluster");
  for (const zone of clusterZones) {
    const pos = zone.position;
    const count = zone.count || 3;
    const types = zone.treeTypes && zone.treeTypes.length > 0 ? zone.treeTypes : ["green_tree"];

    for (let i = 0; i < count; i++) {
      const jitterX = Math.floor(rng() * 5) - 2; // -2..+2
      const jitterY = Math.floor(rng() * 5) - 2;
      const tx = pos.x + jitterX;
      const ty = pos.y + jitterY;
      const treeName = types[Math.floor(rng() * types.length)];
      placeTree(treeName, tx, ty);
    }
  }
}

/**
 * Pass 6: Decorations, gardens, and village squares.
 */
function passDecorations(ground, objects, collision, w, h, blueprint, rng) {
  // --- Garden zones ---
  const gardenZones = blueprint.zones.filter((z) => z.type === "garden");
  const flowerTiles = [TILE.PURPLE_FLOWER_BUSH, TILE.TULIP, TILE.FERN];
  const bushTiles = [TILE.BUSH_GREEN, TILE.BUSH_BERRY];

  for (const zone of gardenZones) {
    const cx = zone.center.x;
    const cy = zone.center.y;
    const r = zone.radius || 3;

    // Place flowers in clusters near center
    let flowersPlaced = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (!inBounds(tx, ty, w, h)) continue;
        if (objects[idx(tx, ty, w)] !== TILE.EMPTY) continue;

        // Edges get bushes, inner gets flowers
        if (dist > r - 1 && rng() < 0.5) {
          objects[idx(tx, ty, w)] = bushTiles[Math.floor(rng() * bushTiles.length)];
        } else if (dist <= r - 1 && rng() < 0.6 && flowersPlaced < 8) {
          objects[idx(tx, ty, w)] = flowerTiles[Math.floor(rng() * flowerTiles.length)];
          flowersPlaced++;
        }
      }
    }
  }

  // --- Decoration zones (individual items) ---
  const decoZones = blueprint.zones.filter((z) => z.type === "decoration");
  for (const zone of decoZones) {
    const px = zone.position.x;
    const py = zone.position.y;

    switch (zone.subtype) {
      case "well":
        if (inBounds(px, py, w, h)) {
          objects[idx(px, py, w)] = TILE.WELL_TOP;
          collision[idx(px, py, w)] = 1;
        }
        if (inBounds(px, py + 1, w, h)) {
          objects[idx(px, py + 1, w)] = TILE.WELL_BASE;
          collision[idx(px, py + 1, w)] = 1;
        }
        break;
      case "lantern":
        if (inBounds(px, py, w, h)) {
          objects[idx(px, py, w)] = TILE.LANTERN;
          collision[idx(px, py, w)] = 1;
        }
        break;
      case "barrel":
        if (inBounds(px, py, w, h)) {
          objects[idx(px, py, w)] = TILE.BARREL;
          collision[idx(px, py, w)] = 1;
        }
        break;
      case "chest":
        if (inBounds(px, py, w, h)) {
          objects[idx(px, py, w)] = TILE.TREASURE_CLOSED;
          collision[idx(px, py, w)] = 1;
        }
        break;
      default:
        break;
    }
  }

  // --- Village square zones ---
  const squareZones = blueprint.zones.filter((z) => z.type === "village-square");
  for (const zone of squareZones) {
    const b = zone.bounds;
    if (!b) continue;
    for (let dy = 0; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        const tx = b.x + dx;
        const ty = b.y + dy;
        if (!inBounds(tx, ty, w, h)) continue;
        // Clear any objects in this area
        objects[idx(tx, ty, w)] = TILE.EMPTY;
        collision[idx(tx, ty, w)] = 0;
        // Cobblestone ground -- alternate tiles for variety
        ground[idx(tx, ty, w)] = ((dx + dy) % 2 === 0) ? TILE.COBBLESTONE_A : TILE.COBBLESTONE_B;
      }
    }
  }
}

/**
 * Pass 7: Auto-generate collision from final object/ground state.
 */
function passCollision(ground, objects, foreground, collision, w, h) {
  // Path tile set for quick lookup
  const pathTiles = new Set([
    TILE.PATH_EDGE_LT, TILE.PATH_CENTER, TILE.PATH_EDGE_RB, TILE.PATH_VERT_EDGE,
    TILE.COBBLESTONE_A, TILE.COBBLESTONE_B,
  ]);

  // Water tile set
  const waterTiles = new Set([
    TILE.WATER_NW, TILE.WATER_N, TILE.WATER_NE,
    TILE.WATER_W, TILE.WATER_CENTER, TILE.WATER_E,
    TILE.WATER_SW, TILE.WATER_S, TILE.WATER_SE,
  ]);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      const objTile = objects[i];
      const gndTile = ground[i];

      // Path tiles on ground are always walkable
      if (pathTiles.has(gndTile)) {
        collision[i] = 0;
        continue;
      }

      // If no object, walkable
      if (objTile === TILE.EMPTY) {
        collision[i] = 0;
        continue;
      }

      // Water is never walkable
      if (waterTiles.has(objTile)) {
        collision[i] = 1;
        continue;
      }

      // Check walkable objects set
      if (WALKABLE_OBJECT_TILES.has(objTile)) {
        collision[i] = 0;
        continue;
      }

      // Default: non-empty objects are obstacles
      collision[i] = 1;
    }
  }

  // Map edges with trees get collision = 1 (already handled by tree trunks,
  // but ensure canopy-only edge tiles also block)
  const treeCanopyTiles = new Set([
    TILE.GREEN_TREE_CANOPY_L, TILE.GREEN_TREE_CANOPY_R,
    TILE.AUTUMN_TREE_CANOPY_L, TILE.AUTUMN_TREE_CANOPY_R,
    TILE.PINE_TOP, TILE.DENSE_TOP,
  ]);

  for (let x = 0; x < w; x++) {
    for (const ey of [0, h - 1]) {
      const i = idx(x, ey, w);
      if (treeCanopyTiles.has(foreground[i]) || treeCanopyTiles.has(objects[i])) {
        collision[i] = 1;
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const ex of [0, w - 1]) {
      const i = idx(ex, y, w);
      if (treeCanopyTiles.has(foreground[i]) || treeCanopyTiles.has(objects[i])) {
        collision[i] = 1;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Expands an LLM-generated semantic zone blueprint into 4 flat tile layers.
 *
 * @param {Object} blueprint - The blueprint object from the LLM.
 * @param {Object} blueprint.mapSize - Map dimensions { width, height }.
 * @param {number} blueprint.seed - Seed for deterministic PRNG.
 * @param {Array<Object>} blueprint.zones - Array of zone definitions.
 * @param {Object} [blueprint.groundMix] - Ground tile ratios { plain, variant, flower }.
 * @param {string} [blueprint.rationale] - LLM explanation (ignored by expander).
 *
 * @returns {{
 *   width: number,
 *   height: number,
 *   ground: Int16Array,
 *   objects: Int16Array,
 *   foreground: Int16Array,
 *   collision: Uint8Array
 * }} Four flat row-major tile layers where index = y * width + x.
 */
function expandBlueprint(blueprint) {
  const w = blueprint.mapSize.width;
  const h = blueprint.mapSize.height;
  const seed = blueprint.seed || 42;
  const rng = mulberry32(seed);

  const totalCells = w * h;

  // Allocate layers -- Int16Array supports -1 (EMPTY)
  const ground = new Int16Array(totalCells).fill(TILE.EMPTY);
  const objects = new Int16Array(totalCells).fill(TILE.EMPTY);
  const foreground = new Int16Array(totalCells).fill(TILE.EMPTY);
  const collision = new Uint8Array(totalCells); // 0 = walkable

  // 7-pass expansion pipeline
  passGround(ground, w, h, blueprint, rng);           // Pass 1
  passPaths(ground, w, h, blueprint, rng);             // Pass 2
  passBuildings(objects, collision, w, h, blueprint, rng); // Pass 3
  passWater(objects, collision, w, h, blueprint);      // Pass 4
  passTrees(objects, foreground, collision, w, h, blueprint, rng); // Pass 5
  passDecorations(ground, objects, collision, w, h, blueprint, rng); // Pass 6
  passCollision(ground, objects, foreground, collision, w, h); // Pass 7

  // Sanity: ground must be 100% filled
  for (let i = 0; i < totalCells; i++) {
    if (ground[i] === TILE.EMPTY || DEPRECATED.has(ground[i])) {
      ground[i] = TILE.GRASS_PLAIN;
    }
  }

  // Sanity: no deprecated tiles anywhere
  for (let i = 0; i < totalCells; i++) {
    if (DEPRECATED.has(objects[i])) objects[i] = TILE.EMPTY;
    if (DEPRECATED.has(foreground[i])) foreground[i] = TILE.EMPTY;
  }

  return { width: w, height: h, ground, objects, foreground, collision };
}

module.exports = { expandBlueprint };
