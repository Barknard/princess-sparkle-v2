/**
 * genetic-evolver.js
 *
 * Genetic algorithm that evolves map generation parameters (DNA) so that
 * generated maps visually converge toward a reference image.  Each organism
 * is a set of evolvable parameters; the fitness function is provided
 * externally (typically a vision-scorer comparison).
 *
 * The module exposes the GeneticEvolver class which handles population
 * initialisation, DNA-to-map generation, mutation, crossover, selection,
 * and generational evolution.
 *
 * @module genetic-evolver
 */

"use strict";

// ---------------------------------------------------------------------------
// Tile ID constants (matching blueprint-expander.js / wfc-generator.js)
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

  // Fences
  WHITE_FENCE_L: 96,
  WHITE_FENCE_M: 97,
  WHITE_FENCE_R: 98,

  // Trees (2x2) — canopy on foreground, trunk on objects
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

  // Small trees (single tile, objects)
  SMALL_GREEN: 6,
  SMALL_AUTUMN: 9,
  SMALL_COMPLETE: 16,
  SMALL_FRUIT: 17,

  // Bushes
  BUSH_GREEN: 28,
  BUSH_BERRY: 29,

  // Flowers
  TULIP: 15,
  FERN: 18,
  PURPLE_FLOWER_BUSH: 19,

  // Decorations
  WELL_TOP: 92,
  WELL_BASE: 104,
  LANTERN: 93,
  BARREL: 107,

  // Water
  WATER_NW: 109,
  WATER_N: 110,
  WATER_NE: 111,
  WATER_S: 112,
  WATER_SE: 113,
  WATER_SW: 120,
  WATER_W: 121,
  WATER_CENTER: 122,
  WATER_E: 123,
};

// ---------------------------------------------------------------------------
// Building templates — index matches dna.buildingTemplates values
// ---------------------------------------------------------------------------

const BUILDING_TEMPLATES = [
  {
    name: 'small_house',
    w: 3,
    roof:  [TILE.RED_ROOF_L, TILE.RED_CHIMNEY, TILE.RED_ROOF_R],
    walls: [TILE.WOOD_L, TILE.WOOD_DOOR, TILE.WOOD_PLAIN],
    doorOffset: 1,
  },
  {
    name: 'medium_house',
    w: 4,
    roof:  [TILE.RED_ROOF_L, TILE.RED_ROOF_M, TILE.RED_CHIMNEY, TILE.RED_ROOF_R],
    walls: [TILE.WOOD_L, TILE.WOOD_WINDOW, TILE.WOOD_DOOR, TILE.WOOD_PLAIN],
    doorOffset: 2,
  },
  {
    name: 'large_house',
    w: 5,
    roof:  [TILE.RED_ROOF_L, TILE.RED_ROOF_M, TILE.RED_ROOF_M, TILE.RED_ROOF_M, TILE.RED_ROOF_R],
    walls: [TILE.WOOD_L, TILE.WOOD_WINDOW, TILE.WOOD_DOOR, TILE.WOOD_WINDOW, TILE.WOOD_PLAIN],
    doorOffset: 2,
  },
  {
    name: 'stone_shop',
    w: 3,
    roof:  [TILE.RED_ROOF_L, TILE.RED_CHIMNEY, TILE.RED_ROOF_R],
    walls: [TILE.STONE_L, TILE.STONE_DOOR, TILE.STONE_PLAIN],
    doorOffset: 1,
  },
  {
    name: 'stone_shop_lg',
    w: 5,
    roof:  [TILE.RED_ROOF_L, TILE.RED_ROOF_M, TILE.RED_ROOF_M, TILE.RED_ROOF_M, TILE.RED_ROOF_R],
    walls: [TILE.STONE_L, TILE.STONE_WINDOW, TILE.STONE_DOOR, TILE.STONE_WINDOW, TILE.STONE_PLAIN],
    doorOffset: 2,
  },
];

// ---------------------------------------------------------------------------
// Tree definitions — index matches dna.treeTypeWeights order
// ---------------------------------------------------------------------------

const TREE_DEFS = [
  { // 0: green
    size: 2,
    canopy: [TILE.GREEN_TREE_CANOPY_L, TILE.GREEN_TREE_CANOPY_R],
    trunk:  [TILE.GREEN_TREE_TRUNK_L, TILE.GREEN_TREE_TRUNK_R],
  },
  { // 1: autumn
    size: 2,
    canopy: [TILE.AUTUMN_TREE_CANOPY_L, TILE.AUTUMN_TREE_CANOPY_R],
    trunk:  [TILE.AUTUMN_TREE_TRUNK_L, TILE.AUTUMN_TREE_TRUNK_R],
  },
  { // 2: pine
    size: 1,
    canopy: [TILE.PINE_TOP],
    trunk:  [TILE.PINE_TRUNK],
  },
  { // 3: dense
    size: 1,
    canopy: [TILE.DENSE_TOP],
    trunk:  [TILE.DENSE_TRUNK],
  },
];

// Decoration tile IDs indexed by dna.decoTypes values
const DECO_TILES = [
  TILE.TULIP,           // 0 = flower
  TILE.BUSH_GREEN,      // 1 = bush
  TILE.BARREL,          // 2 = barrel
  TILE.LANTERN,         // 3 = lantern
];

// ---------------------------------------------------------------------------
// Default DNA — the starting set of map generation parameters
// ---------------------------------------------------------------------------

const DEFAULT_DNA = {
  // Building placement
  buildingCount: 3,
  buildingMinSpacing: 10,
  buildingTemplates: [0, 1],
  buildingYBand: [0.15, 0.7],

  // Fence rules
  fenceEnabled: true,
  fenceWidth: 1,
  fenceGapAligned: true,

  // Path rules
  pathStyle: 'cross',
  pathWidth: 2,
  pathConnectBuildings: true,
  pathCenterX: 0.5,
  pathCenterY: 0.5,

  // Ground mix
  grassPlainPct: 0.60,
  grassVariantPct: 0.30,
  grassFlowerPct: 0.10,
  flowerNearPOI: true,

  // Tree rules
  treeBorderDepth: 3,
  treeBorderDensity: 0.6,
  treeInteriorClusters: 5,
  treeClusterSize: 3,
  treeTypeWeights: [0.4, 0.3, 0.2, 0.1],

  // Decoration rules
  decoPerBuilding: 3,
  decoTypes: [0, 1, 2, 3],
  decoRadius: 4,
  wellEnabled: true,
  wellPosition: 'center',

  // Water
  waterEnabled: true,
  waterSize: [4, 3],
  waterPosition: [0.7, 0.5],

  // Village square
  squareEnabled: true,
  squareSize: [8, 6],
  squarePosition: [0.5, 0.5],
};

// ---------------------------------------------------------------------------
// Gene metadata — describes valid ranges and types for mutation/clamping
// ---------------------------------------------------------------------------

const GENE_META = {
  buildingCount:        { type: 'int',    min: 2,    max: 6 },
  buildingMinSpacing:   { type: 'int',    min: 6,    max: 20 },
  buildingTemplates:    { type: 'intArray', min: 0, max: BUILDING_TEMPLATES.length - 1, minLen: 1, maxLen: 4 },
  buildingYBand:        { type: 'floatPair', min: 0.05, max: 0.95 },

  fenceEnabled:         { type: 'bool' },
  fenceWidth:           { type: 'int',    min: 0,    max: 2 },
  fenceGapAligned:      { type: 'bool' },

  pathStyle:            { type: 'enum',   options: ['cross', 'L-shape', 'radial', 'loop', 'organic'] },
  pathWidth:            { type: 'int',    min: 1,    max: 3 },
  pathConnectBuildings: { type: 'bool' },
  pathCenterX:          { type: 'float',  min: 0.2,  max: 0.8 },
  pathCenterY:          { type: 'float',  min: 0.2,  max: 0.8 },

  grassPlainPct:        { type: 'float',  min: 0.40, max: 0.80 },
  grassVariantPct:      { type: 'float',  min: 0.10, max: 0.40 },
  grassFlowerPct:       { type: 'float',  min: 0.02, max: 0.20 },
  flowerNearPOI:        { type: 'bool' },

  treeBorderDepth:      { type: 'int',    min: 1,    max: 5 },
  treeBorderDensity:    { type: 'float',  min: 0.3,  max: 0.9 },
  treeInteriorClusters: { type: 'int',    min: 1,    max: 10 },
  treeClusterSize:      { type: 'int',    min: 2,    max: 7 },
  treeTypeWeights:      { type: 'weights', len: 4 },

  decoPerBuilding:      { type: 'int',    min: 1,    max: 6 },
  decoTypes:            { type: 'intArray', min: 0, max: DECO_TILES.length - 1, minLen: 1, maxLen: 4 },
  decoRadius:           { type: 'int',    min: 2,    max: 8 },
  wellEnabled:          { type: 'bool' },
  wellPosition:         { type: 'enum',   options: ['center', 'random', 'near-path'] },

  waterEnabled:         { type: 'bool' },
  waterSize:            { type: 'intPair', min: 2, max: 8 },
  waterPosition:        { type: 'floatPair', min: 0.1, max: 0.9 },

  squareEnabled:        { type: 'bool' },
  squareSize:           { type: 'intPair', min: 4, max: 12 },
  squarePosition:       { type: 'floatPair', min: 0.2, max: 0.8 },
};

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Clamp a number between min and max. */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Box–Muller gaussian random (mean 0, stddev 1). */
function gaussRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Simple 2-D value noise for organic clustering (not Perlin — cheaper). */
function valueNoise(x, y, scale) {
  // Hash-based value noise with bilinear interpolation
  const sx = x / scale;
  const sy = y / scale;
  const ix = Math.floor(sx);
  const iy = Math.floor(sy);
  const fx = sx - ix;
  const fy = sy - iy;

  const hash = (a, b) => {
    let h = ((a * 374761393 + b * 668265263 + 1013904223) & 0x7fffffff);
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff;
  };

  const v00 = hash(ix, iy);
  const v10 = hash(ix + 1, iy);
  const v01 = hash(ix, iy + 1);
  const v11 = hash(ix + 1, iy + 1);

  const top    = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
}

/** Deep-clone a plain JSON-friendly object. */
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

/** Pick a weighted random index from an array of weights. */
function weightedPick(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** Normalise an array of weights so they sum to 1. */
function normaliseWeights(arr) {
  const sum = arr.reduce((s, v) => s + Math.abs(v), 0) || 1;
  return arr.map(v => Math.abs(v) / sum);
}

// ---------------------------------------------------------------------------
// GeneticEvolver
// ---------------------------------------------------------------------------

class GeneticEvolver {
  /**
   * @param {Object} options
   * @param {number} [options.populationSize=20]
   * @param {number} [options.eliteCount=4]
   * @param {number} [options.mutationRate=0.15]
   * @param {number} [options.mutationStrength=0.2]
   * @param {number} [options.crossoverRate=0.7]
   * @param {{width:number, height:number}} [options.mapSize]
   */
  constructor(options = {}) {
    this.populationSize   = options.populationSize   || 20;
    this.eliteCount       = options.eliteCount       || 4;
    this.mutationRate     = options.mutationRate      || 0.15;
    this.mutationStrength = options.mutationStrength  || 0.2;
    this.crossoverRate    = options.crossoverRate     || 0.7;
    this.mapWidth         = (options.mapSize && options.mapSize.width)  || 60;
    this.mapHeight        = (options.mapSize && options.mapSize.height) || 40;
  }

  // -----------------------------------------------------------------------
  // Population initialisation
  // -----------------------------------------------------------------------

  /**
   * Create initial random population.
   * First organism is DEFAULT_DNA; the rest are high-strength mutations for
   * initial diversity.
   * @returns {Array<Object>} Array of DNA objects
   */
  initPopulation() {
    const pop = [deepClone(DEFAULT_DNA)];
    const savedRate     = this.mutationRate;
    const savedStrength = this.mutationStrength;
    this.mutationRate     = 0.8;   // mutate most genes
    this.mutationStrength = 0.5;   // large changes
    for (let i = 1; i < this.populationSize; i++) {
      pop.push(this.mutate(deepClone(DEFAULT_DNA)));
    }
    this.mutationRate     = savedRate;
    this.mutationStrength = savedStrength;
    return pop;
  }

  // -----------------------------------------------------------------------
  // Map generation from DNA
  // -----------------------------------------------------------------------

  /**
   * Generate a complete 4-layer tile map from a DNA parameter set.
   * @param {Object} dna
   * @returns {{width:number, height:number, ground:number[], objects:number[], foreground:number[], collision:number[]}}
   */
  generateFromDNA(dna) {
    const W = this.mapWidth;
    const H = this.mapHeight;
    const size = W * H;

    const ground     = new Array(size).fill(TILE.GRASS_PLAIN);
    const objects    = new Array(size).fill(TILE.EMPTY);
    const foreground = new Array(size).fill(TILE.EMPTY);
    const collision  = new Array(size).fill(0);

    const idx = (x, y) => y * W + x;
    const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

    // Track occupied tiles so layers don't clobber each other
    const occupied = new Uint8Array(size); // 1 = occupied by structure/water

    // ----- 1) Ground layer: grass mix with value noise -----
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const noise = valueNoise(x, y, 8);
        const threshold1 = dna.grassPlainPct;
        const threshold2 = threshold1 + dna.grassVariantPct;
        if (noise < threshold1) {
          ground[idx(x, y)] = TILE.GRASS_PLAIN;
        } else if (noise < threshold2) {
          ground[idx(x, y)] = TILE.GRASS_FLOWERS;
        } else {
          ground[idx(x, y)] = TILE.GRASS_WHITE_FLOWERS;
        }
      }
    }

    // ----- 2) Village square -----
    if (dna.squareEnabled) {
      const sw = dna.squareSize[0];
      const sh = dna.squareSize[1];
      const sx = Math.round(dna.squarePosition[0] * W - sw / 2);
      const sy = Math.round(dna.squarePosition[1] * H - sh / 2);
      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const px = sx + dx;
          const py = sy + dy;
          if (inBounds(px, py)) {
            ground[idx(px, py)] = (dx + dy) % 2 === 0
              ? TILE.COBBLESTONE_A
              : TILE.COBBLESTONE_B;
          }
        }
      }
    }

    // ----- 3) Paths -----
    const pcx = Math.round(dna.pathCenterX * W);
    const pcy = Math.round(dna.pathCenterY * H);
    const pw  = dna.pathWidth;

    const placePath = (x, y) => {
      if (!inBounds(x, y)) return;
      ground[idx(x, y)] = TILE.PATH_CENTER;
    };

    const placePathStrip = (x, y, horizontal) => {
      for (let d = -Math.floor(pw / 2); d < Math.ceil(pw / 2); d++) {
        if (horizontal) {
          placePath(x, y + d);
        } else {
          placePath(x + d, y);
        }
      }
    };

    // Build path arrays for "near-path" calculations later
    const pathTiles = new Set();

    const markPath = (x, y) => {
      if (inBounds(x, y)) pathTiles.add(idx(x, y));
    };

    const placePathWithMark = (x, y, horizontal) => {
      for (let d = -Math.floor(pw / 2); d < Math.ceil(pw / 2); d++) {
        const px = horizontal ? x : x + d;
        const py = horizontal ? y + d : y;
        placePath(px, py);
        markPath(px, py);
      }
    };

    switch (dna.pathStyle) {
      case 'cross': {
        // Vertical path through center
        for (let y = 0; y < H; y++) placePathWithMark(pcx, y, false);
        // Horizontal path through center
        for (let x = 0; x < W; x++) placePathWithMark(x, pcy, true);
        break;
      }
      case 'L-shape': {
        // Vertical from top to center, then horizontal to right
        for (let y = 0; y <= pcy; y++) placePathWithMark(pcx, y, false);
        for (let x = pcx; x < W; x++) placePathWithMark(x, pcy, true);
        break;
      }
      case 'radial': {
        // Four paths from center to edges
        for (let y = 0; y < H; y++) placePathWithMark(pcx, y, false);
        for (let x = 0; x < W; x++) placePathWithMark(x, pcy, true);
        // Diagonal approximations (45 degrees)
        const diag = Math.min(pcx, pcy, W - pcx, H - pcy);
        for (let d = 0; d < diag; d++) {
          placePathWithMark(pcx + d, pcy + d, false);
          placePathWithMark(pcx - d, pcy - d, false);
          placePathWithMark(pcx + d, pcy - d, false);
          placePathWithMark(pcx - d, pcy + d, false);
        }
        break;
      }
      case 'loop': {
        const lx1 = Math.round(W * 0.25);
        const lx2 = Math.round(W * 0.75);
        const ly1 = Math.round(H * 0.25);
        const ly2 = Math.round(H * 0.75);
        for (let x = lx1; x <= lx2; x++) {
          placePathWithMark(x, ly1, true);
          placePathWithMark(x, ly2, true);
        }
        for (let y = ly1; y <= ly2; y++) {
          placePathWithMark(lx1, y, false);
          placePathWithMark(lx2, y, false);
        }
        break;
      }
      case 'organic':
      default: {
        // Random waypoints connected by L-shaped segments
        const numWaypoints = 4 + Math.floor(Math.random() * 4);
        const waypoints = [{ x: pcx, y: pcy }];
        for (let i = 0; i < numWaypoints; i++) {
          waypoints.push({
            x: Math.floor(Math.random() * (W - 4)) + 2,
            y: Math.floor(Math.random() * (H - 4)) + 2,
          });
        }
        for (let i = 0; i < waypoints.length - 1; i++) {
          const a = waypoints[i];
          const b = waypoints[i + 1];
          // Horizontal then vertical
          const xDir = b.x > a.x ? 1 : -1;
          for (let x = a.x; x !== b.x; x += xDir) {
            placePathWithMark(x, a.y, true);
          }
          const yDir = b.y > a.y ? 1 : -1;
          for (let y = a.y; y !== b.y; y += yDir) {
            placePathWithMark(b.x, y, false);
          }
        }
        break;
      }
    }

    // Apply path edge tiles (replace ground PATH_CENTER with proper edges)
    for (const tileIdx of pathTiles) {
      const x = tileIdx % W;
      const y = Math.floor(tileIdx / W);
      // Check neighbors for edge detection
      const hasPathLeft  = x > 0     && pathTiles.has(idx(x - 1, y));
      const hasPathRight = x < W - 1 && pathTiles.has(idx(x + 1, y));
      const hasPathUp    = y > 0     && pathTiles.has(idx(x, y - 1));
      const hasPathDown  = y < H - 1 && pathTiles.has(idx(x, y + 1));

      const neighbors = (hasPathLeft ? 1 : 0) + (hasPathRight ? 1 : 0) +
                         (hasPathUp ? 1 : 0) + (hasPathDown ? 1 : 0);

      if (neighbors >= 3) {
        ground[tileIdx] = TILE.PATH_CENTER;
      } else if (!hasPathLeft && hasPathRight) {
        ground[tileIdx] = TILE.PATH_EDGE_LT;
      } else if (hasPathLeft && !hasPathRight) {
        ground[tileIdx] = TILE.PATH_EDGE_RB;
      } else {
        ground[tileIdx] = TILE.PATH_CENTER;
      }
    }

    // ----- 4) Buildings -----
    const buildings = [];  // { x, y, w, doorX, doorY, template }
    const numBuildings = dna.buildingCount;
    const yMin = Math.round(dna.buildingYBand[0] * H);
    const yMax = Math.round(dna.buildingYBand[1] * H);

    for (let attempt = 0; attempt < numBuildings * 30 && buildings.length < numBuildings; attempt++) {
      const tplIdx = dna.buildingTemplates[Math.floor(Math.random() * dna.buildingTemplates.length)];
      const tpl = BUILDING_TEMPLATES[clamp(tplIdx, 0, BUILDING_TEMPLATES.length - 1)];
      const bx = Math.floor(Math.random() * (W - tpl.w - 2)) + 1;
      const by = yMin + Math.floor(Math.random() * Math.max(1, yMax - yMin - 2));

      // Check spacing
      let tooClose = false;
      for (const b of buildings) {
        const dx = Math.abs(bx - b.x);
        const dy = Math.abs(by - b.y);
        if (dx < dna.buildingMinSpacing && dy < dna.buildingMinSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Check bounds
      if (by < 1 || by + 1 >= H || bx + tpl.w >= W) continue;

      // Place roof row (objects layer, row = by)
      for (let dx = 0; dx < tpl.w; dx++) {
        objects[idx(bx + dx, by)] = tpl.roof[dx];
        occupied[idx(bx + dx, by)] = 1;
        collision[idx(bx + dx, by)] = 1;
      }
      // Place wall row (objects layer, row = by + 1)
      for (let dx = 0; dx < tpl.w; dx++) {
        objects[idx(bx + dx, by + 1)] = tpl.walls[dx];
        occupied[idx(bx + dx, by + 1)] = 1;
        // Door tile is walkable, rest is collision
        if (dx === tpl.doorOffset) {
          collision[idx(bx + dx, by + 1)] = 0;
        } else {
          collision[idx(bx + dx, by + 1)] = 1;
        }
      }

      const doorX = bx + tpl.doorOffset;
      const doorY = by + 1;
      buildings.push({ x: bx, y: by, w: tpl.w, doorX, doorY, template: tpl });

      // Connect building to nearest path if enabled
      if (dna.pathConnectBuildings) {
        // Simple: draw path from door downward until hitting an existing path
        for (let py = doorY + 1; py < H; py++) {
          if (pathTiles.has(idx(doorX, py))) break;
          ground[idx(doorX, py)] = TILE.PATH_CENTER;
          pathTiles.add(idx(doorX, py));
          if (pw > 1 && doorX + 1 < W) {
            ground[idx(doorX + 1, py)] = TILE.PATH_CENTER;
            pathTiles.add(idx(doorX + 1, py));
          }
        }
      }
    }

    // ----- 5) Fences -----
    if (dna.fenceEnabled) {
      for (const b of buildings) {
        const fenceY = b.y + 2; // row below walls
        if (fenceY >= H) continue;

        let fenceLeft, fenceRight;
        if (dna.fenceWidth === 0) {
          fenceLeft  = b.x;
          fenceRight = b.x + b.w - 1;
        } else if (dna.fenceWidth === 1) {
          fenceLeft  = b.x;
          fenceRight = b.x + b.w - 1;
        } else {
          fenceLeft  = Math.max(0, b.x - 1);
          fenceRight = Math.min(W - 1, b.x + b.w);
        }

        for (let fx = fenceLeft; fx <= fenceRight; fx++) {
          if (!inBounds(fx, fenceY)) continue;
          if (occupied[idx(fx, fenceY)]) continue;

          // Gate gap at door column
          if (dna.fenceGapAligned && fx === b.doorX) continue;

          if (fx === fenceLeft) {
            objects[idx(fx, fenceY)] = TILE.WHITE_FENCE_L;
          } else if (fx === fenceRight) {
            objects[idx(fx, fenceY)] = TILE.WHITE_FENCE_R;
          } else {
            objects[idx(fx, fenceY)] = TILE.WHITE_FENCE_M;
          }
          collision[idx(fx, fenceY)] = 1;
          occupied[idx(fx, fenceY)] = 1;
        }
      }
    }

    // ----- 6) Trees -----

    // 6a) Border trees
    const borderDepth = dna.treeBorderDepth;
    const borderDensity = dna.treeBorderDensity;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const distFromEdge = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (distFromEdge >= borderDepth) continue;
        if (Math.random() > borderDensity) continue;
        if (occupied[idx(x, y)]) continue;

        const treeType = weightedPick(dna.treeTypeWeights);
        this._placeTree(treeType, x, y, objects, foreground, collision, occupied, W, H);
      }
    }

    // 6b) Interior clusters
    for (let c = 0; c < dna.treeInteriorClusters; c++) {
      const cx = borderDepth + Math.floor(Math.random() * Math.max(1, W - 2 * borderDepth));
      const cy = borderDepth + Math.floor(Math.random() * Math.max(1, H - 2 * borderDepth));

      for (let t = 0; t < dna.treeClusterSize; t++) {
        const tx = cx + Math.floor(Math.random() * 5) - 2;
        const ty = cy + Math.floor(Math.random() * 5) - 2;
        if (!inBounds(tx, ty) || occupied[idx(tx, ty)]) continue;

        const treeType = weightedPick(dna.treeTypeWeights);
        this._placeTree(treeType, tx, ty, objects, foreground, collision, occupied, W, H);
      }
    }

    // ----- 7) Decorations -----
    for (const b of buildings) {
      for (let d = 0; d < dna.decoPerBuilding; d++) {
        const dx = b.x + Math.floor(Math.random() * (b.w + 2 * dna.decoRadius)) - dna.decoRadius;
        const dy = b.y + Math.floor(Math.random() * (2 + 2 * dna.decoRadius)) - dna.decoRadius;
        if (!inBounds(dx, dy) || occupied[idx(dx, dy)]) continue;

        const decoIdx = dna.decoTypes[Math.floor(Math.random() * dna.decoTypes.length)];
        const tile = DECO_TILES[clamp(decoIdx, 0, DECO_TILES.length - 1)];
        objects[idx(dx, dy)] = tile;
        // Flowers and bushes are walkable; barrels and lanterns block
        if (tile === TILE.BARREL || tile === TILE.LANTERN) {
          collision[idx(dx, dy)] = 1;
        }
        occupied[idx(dx, dy)] = 1;
      }
    }

    // Well placement
    if (dna.wellEnabled && buildings.length > 0) {
      let wx, wy;
      if (dna.wellPosition === 'center') {
        wx = Math.round(W / 2);
        wy = Math.round(H / 2);
      } else if (dna.wellPosition === 'near-path') {
        // Pick a random path tile
        const pathArr = Array.from(pathTiles);
        if (pathArr.length > 0) {
          const pick = pathArr[Math.floor(Math.random() * pathArr.length)];
          wx = (pick % W) + 1;
          wy = Math.floor(pick / W);
        } else {
          wx = Math.round(W / 2);
          wy = Math.round(H / 2);
        }
      } else {
        wx = Math.floor(Math.random() * (W - 4)) + 2;
        wy = Math.floor(Math.random() * (H - 4)) + 2;
      }
      if (inBounds(wx, wy) && inBounds(wx, wy + 1) &&
          !occupied[idx(wx, wy)] && !occupied[idx(wx, wy + 1)]) {
        objects[idx(wx, wy)]     = TILE.WELL_TOP;
        objects[idx(wx, wy + 1)] = TILE.WELL_BASE;
        collision[idx(wx, wy)]     = 1;
        collision[idx(wx, wy + 1)] = 1;
        occupied[idx(wx, wy)]     = 1;
        occupied[idx(wx, wy + 1)] = 1;
      }
    }

    // ----- 8) Water -----
    if (dna.waterEnabled) {
      const ww = dna.waterSize[0];
      const wh = dna.waterSize[1];
      const waterX = Math.round(dna.waterPosition[0] * W - ww / 2);
      const waterY = Math.round(dna.waterPosition[1] * H - wh / 2);

      for (let dy = 0; dy < wh; dy++) {
        for (let dx = 0; dx < ww; dx++) {
          const px = waterX + dx;
          const py = waterY + dy;
          if (!inBounds(px, py) || occupied[idx(px, py)]) continue;

          let tile;
          const isTop    = dy === 0;
          const isBottom = dy === wh - 1;
          const isLeft   = dx === 0;
          const isRight  = dx === ww - 1;

          if (isTop && isLeft)         tile = TILE.WATER_NW;
          else if (isTop && isRight)   tile = TILE.WATER_NE;
          else if (isTop)              tile = TILE.WATER_N;
          else if (isBottom && isLeft)  tile = TILE.WATER_SW;
          else if (isBottom && isRight) tile = TILE.WATER_SE;
          else if (isBottom)           tile = TILE.WATER_S;
          else if (isLeft)             tile = TILE.WATER_W;
          else if (isRight)            tile = TILE.WATER_E;
          else                         tile = TILE.WATER_CENTER;

          objects[idx(px, py)] = tile;
          collision[idx(px, py)] = 1;
          occupied[idx(px, py)] = 1;
        }
      }
    }

    return { width: W, height: H, ground, objects, foreground, collision };
  }

  /**
   * Place a single tree (handles 1-wide and 2-wide variants).
   * @private
   */
  _placeTree(typeIdx, x, y, objects, foreground, collision, occupied, W, H) {
    const def = TREE_DEFS[clamp(typeIdx, 0, TREE_DEFS.length - 1)];
    const idx = (tx, ty) => ty * W + tx;
    const inBounds = (tx, ty) => tx >= 0 && tx < W && ty >= 0 && ty < H;

    if (def.size === 2) {
      // 2-wide tree: canopy row (y-1), trunk row (y)
      if (!inBounds(x + 1, y) || !inBounds(x, y - 1) || !inBounds(x + 1, y - 1)) return;
      if (occupied[idx(x, y)] || occupied[idx(x + 1, y)] ||
          occupied[idx(x, y - 1)] || occupied[idx(x + 1, y - 1)]) return;

      foreground[idx(x, y - 1)]     = def.canopy[0];
      foreground[idx(x + 1, y - 1)] = def.canopy[1];
      objects[idx(x, y)]            = def.trunk[0];
      objects[idx(x + 1, y)]        = def.trunk[1];
      collision[idx(x, y)]     = 1;
      collision[idx(x + 1, y)] = 1;
      occupied[idx(x, y)]          = 1;
      occupied[idx(x + 1, y)]      = 1;
      occupied[idx(x, y - 1)]      = 1;
      occupied[idx(x + 1, y - 1)]  = 1;
    } else {
      // 1-wide tree: canopy (y-1), trunk (y)
      if (!inBounds(x, y - 1)) return;
      if (occupied[idx(x, y)] || occupied[idx(x, y - 1)]) return;

      foreground[idx(x, y - 1)] = def.canopy[0];
      objects[idx(x, y)]        = def.trunk[0];
      collision[idx(x, y)] = 1;
      occupied[idx(x, y)]     = 1;
      occupied[idx(x, y - 1)] = 1;
    }
  }

  // -----------------------------------------------------------------------
  // Mutation
  // -----------------------------------------------------------------------

  /**
   * Mutate a DNA — small random changes to parameters.
   * @param {Object} dna
   * @returns {Object} mutated copy
   */
  mutate(dna) {
    const child = deepClone(dna);

    for (const key of Object.keys(GENE_META)) {
      if (!(key in child)) continue;
      if (Math.random() >= this.mutationRate) continue;

      const meta = GENE_META[key];

      switch (meta.type) {
        case 'int': {
          const range = meta.max - meta.min;
          const delta = Math.round(gaussRandom() * this.mutationStrength * range);
          child[key] = clamp(child[key] + delta, meta.min, meta.max);
          break;
        }
        case 'float': {
          const range = meta.max - meta.min;
          const delta = gaussRandom() * this.mutationStrength * range;
          child[key] = clamp(child[key] + delta, meta.min, meta.max);
          break;
        }
        case 'bool': {
          child[key] = !child[key];
          break;
        }
        case 'enum': {
          const options = meta.options;
          child[key] = options[Math.floor(Math.random() * options.length)];
          break;
        }
        case 'intArray': {
          const arr = child[key].slice();
          const action = Math.random();
          if (action < 0.33 && arr.length > meta.minLen) {
            // Remove random element
            arr.splice(Math.floor(Math.random() * arr.length), 1);
          } else if (action < 0.66 && arr.length < meta.maxLen) {
            // Add random element
            arr.push(Math.floor(Math.random() * (meta.max - meta.min + 1)) + meta.min);
          } else if (arr.length > 0) {
            // Swap one element
            const i = Math.floor(Math.random() * arr.length);
            arr[i] = Math.floor(Math.random() * (meta.max - meta.min + 1)) + meta.min;
          }
          child[key] = arr;
          break;
        }
        case 'weights': {
          const arr = child[key].slice();
          const i = Math.floor(Math.random() * arr.length);
          arr[i] = clamp(arr[i] + gaussRandom() * this.mutationStrength * 0.3, 0.01, 1);
          child[key] = normaliseWeights(arr);
          break;
        }
        case 'floatPair': {
          const arr = child[key].slice();
          const i = Math.floor(Math.random() * 2);
          const range = meta.max - meta.min;
          arr[i] = clamp(arr[i] + gaussRandom() * this.mutationStrength * range, meta.min, meta.max);
          // Ensure [0] <= [1] for ordered pairs like buildingYBand
          if (arr[0] > arr[1]) { const tmp = arr[0]; arr[0] = arr[1]; arr[1] = tmp; }
          child[key] = arr;
          break;
        }
        case 'intPair': {
          const arr = child[key].slice();
          const i = Math.floor(Math.random() * 2);
          const range = meta.max - meta.min;
          const delta = Math.round(gaussRandom() * this.mutationStrength * range);
          arr[i] = clamp(arr[i] + delta, meta.min, meta.max);
          child[key] = arr;
          break;
        }
      }
    }

    // Re-normalise grass percentages so they sum to ~1
    const gSum = child.grassPlainPct + child.grassVariantPct + child.grassFlowerPct;
    if (gSum > 0) {
      child.grassPlainPct   /= gSum;
      child.grassVariantPct /= gSum;
      child.grassFlowerPct  /= gSum;
    }

    return child;
  }

  // -----------------------------------------------------------------------
  // Crossover
  // -----------------------------------------------------------------------

  /**
   * Crossover two parents to produce a child (uniform crossover).
   * @param {Object} parent1
   * @param {Object} parent2
   * @returns {Object} child DNA
   */
  crossover(parent1, parent2) {
    const child = {};
    const allKeys = new Set([...Object.keys(parent1), ...Object.keys(parent2)]);

    for (const key of allKeys) {
      if (Math.random() < this.crossoverRate) {
        child[key] = deepClone(key in parent1 ? parent1[key] : parent2[key]);
      } else {
        child[key] = deepClone(key in parent2 ? parent2[key] : parent1[key]);
      }
    }

    return child;
  }

  // -----------------------------------------------------------------------
  // Selection & evolution
  // -----------------------------------------------------------------------

  /**
   * Tournament selection — pick 3 random organisms, return the fittest.
   * @private
   * @param {Array<{dna:Object, fitness:number}>} scored
   * @returns {Object} winning DNA
   */
  _tournamentSelect(scored) {
    const tournamentSize = Math.min(3, scored.length);
    let best = null;
    for (let i = 0; i < tournamentSize; i++) {
      const candidate = scored[Math.floor(Math.random() * scored.length)];
      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    return deepClone(best.dna);
  }

  /**
   * Evolve one generation.
   * @param {Array<{dna:Object, fitness:number}>} scoredPopulation
   * @returns {Array<Object>} new population of DNA objects
   */
  evolveGeneration(scoredPopulation) {
    // Sort descending by fitness
    const sorted = scoredPopulation.slice().sort((a, b) => b.fitness - a.fitness);

    const nextGen = [];

    // Elitism: keep top N unchanged
    for (let i = 0; i < this.eliteCount && i < sorted.length; i++) {
      nextGen.push(deepClone(sorted[i].dna));
    }

    // Fill remaining slots with offspring
    while (nextGen.length < this.populationSize) {
      const p1 = this._tournamentSelect(sorted);
      const p2 = this._tournamentSelect(sorted);
      let child = this.crossover(p1, p2);
      child = this.mutate(child);
      nextGen.push(child);
    }

    return nextGen;
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  /**
   * Get current generation stats.
   * @param {Array<{dna:Object, fitness:number}>} scored
   * @returns {{best:number, avg:number, worst:number, diversity:number}}
   */
  getStats(scored) {
    if (!scored || scored.length === 0) {
      return { best: 0, avg: 0, worst: 0, diversity: 0 };
    }

    const fitnesses = scored.map(s => s.fitness);
    const best  = Math.max(...fitnesses);
    const worst = Math.min(...fitnesses);
    const avg   = fitnesses.reduce((s, f) => s + f, 0) / fitnesses.length;

    // Diversity = standard deviation of fitness (low = converged)
    const variance = fitnesses.reduce((s, f) => s + (f - avg) ** 2, 0) / fitnesses.length;
    const diversity = Math.sqrt(variance);

    return { best, avg, worst, diversity };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { GeneticEvolver, DEFAULT_DNA, BUILDING_TEMPLATES, TILE };

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

if (require.main === module) {
  const evolver = new GeneticEvolver({ populationSize: 10, mapSize: { width: 60, height: 40 } });
  const pop = evolver.initPopulation();
  console.log('Population:', pop.length, 'organisms');

  // Generate map from first DNA
  const map = evolver.generateFromDNA(pop[0]);
  console.log('Map:', map.width, 'x', map.height);
  console.log('Ground tiles:', map.ground.length);
  console.log('Objects:', map.objects.filter(t => t >= 0).length);

  // Test mutation
  const mutated = evolver.mutate(pop[0]);
  let diffs = 0;
  for (const key of Object.keys(pop[0])) {
    if (JSON.stringify(pop[0][key]) !== JSON.stringify(mutated[key])) diffs++;
  }
  console.log('Mutation changed', diffs, 'genes out of', Object.keys(pop[0]).length);

  // Test crossover
  const child = evolver.crossover(pop[0], pop[1]);
  console.log('Crossover produced child with', Object.keys(child).length, 'genes');

  // Test evolution
  const scored = pop.map((dna, i) => ({ dna, fitness: Math.random() * 100 }));
  const nextGen = evolver.evolveGeneration(scored);
  console.log('Evolved to generation 2:', nextGen.length, 'organisms');

  const stats = evolver.getStats(scored);
  console.log('Stats:', stats);
}
