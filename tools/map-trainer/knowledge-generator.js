/**
 * knowledge-generator.js
 *
 * Knowledge-driven map generator that uses THREE levels of learned tile
 * knowledge to produce high-quality village maps:
 *
 *   Level 1 — Tile Adjacency: learned from 6000+ evolved maps
 *   Level 2 — Composites: atomic multi-tile structures (buildings, trees, water)
 *   Level 3 — Composition: DNA parameters control high-level layout
 *
 * Replaces the crude `generateFromDNA` in genetic-evolver.js with a generator
 * that validates every placement against real adjacency statistics.
 *
 * @module knowledge-generator
 */

"use strict";

const fs   = require('fs');
const path = require('path');
const { SpatialGrammar } = require('./spatial-grammar');

// ---------------------------------------------------------------------------
// Tile ID constants (matching genetic-evolver.js / blueprint-expander.js)
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

  // Blue walls
  BLUE_WALL_L: 48,
  BLUE_WALL_DOOR: 49,
  BLUE_WALL_R: 50,

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
// Default building templates (fallback when tile-semantics.json not loaded)
// ---------------------------------------------------------------------------

const DEFAULT_BUILDING_TEMPLATES = [
  {
    id: 'small_house', name: 'Small House', category: 'building',
    width: 3, height: 2,
    tiles: [[63, 67, 65], [72, 74, 73]],
    doorOffset: 1,
  },
  {
    id: 'medium_house', name: 'Medium House', category: 'building',
    width: 4, height: 2,
    tiles: [[63, 64, 64, 65], [72, 75, 74, 73]],
    doorOffset: 2,
  },
  {
    id: 'large_house', name: 'Large House', category: 'building',
    width: 5, height: 2,
    tiles: [[63, 64, 64, 64, 65], [72, 75, 74, 75, 73]],
    doorOffset: 2,
  },
  {
    id: 'stone_shop', name: 'Stone Shop', category: 'building',
    width: 3, height: 2,
    tiles: [[63, 67, 65], [84, 86, 85]],
    doorOffset: 1,
  },
  {
    id: 'stone_shop_large', name: 'Large Stone Shop', category: 'building',
    width: 5, height: 2,
    tiles: [[63, 64, 64, 64, 65], [84, 87, 86, 87, 85]],
    doorOffset: 2,
  },
  {
    id: 'blue_roof_house', name: 'Blue Roof House', category: 'building',
    width: 3, height: 2,
    tiles: [[51, 55, 53], [48, 49, 50]],
    doorOffset: 1,
  },
];

// ---------------------------------------------------------------------------
// Default tree definitions (index matches dna.treeTypeWeights order)
// ---------------------------------------------------------------------------

const TREE_DEFS = [
  { // 0: green (2-wide)
    size: 2,
    canopy: [TILE.GREEN_TREE_CANOPY_L, TILE.GREEN_TREE_CANOPY_R],
    trunk:  [TILE.GREEN_TREE_TRUNK_L,  TILE.GREEN_TREE_TRUNK_R],
  },
  { // 1: autumn (2-wide)
    size: 2,
    canopy: [TILE.AUTUMN_TREE_CANOPY_L, TILE.AUTUMN_TREE_CANOPY_R],
    trunk:  [TILE.AUTUMN_TREE_TRUNK_L,  TILE.AUTUMN_TREE_TRUNK_R],
  },
  { // 2: pine (1-wide)
    size: 1,
    canopy: [TILE.PINE_TOP],
    trunk:  [TILE.PINE_TRUNK],
  },
  { // 3: dense (1-wide)
    size: 1,
    canopy: [TILE.DENSE_TOP],
    trunk:  [TILE.DENSE_TRUNK],
  },
];

// Decoration tile IDs indexed by dna.decoTypes values
const DECO_TILES = [
  TILE.TULIP,              // 0 = flower
  TILE.BUSH_GREEN,         // 1 = bush
  TILE.BARREL,             // 2 = barrel
  TILE.LANTERN,            // 3 = lantern
  TILE.PURPLE_FLOWER_BUSH, // 4 = purple flowers
  TILE.FERN,               // 5 = fern
  TILE.BUSH_BERRY,         // 6 = berry bush
];

// Tiles that block walking
const COLLISION_TILES = new Set([
  TILE.BARREL, TILE.LANTERN,
  TILE.WELL_TOP, TILE.WELL_BASE,
  ...Object.values(TILE).filter(t => {
    // All roof, wall, fence, trunk, water tiles cause collision
    return (t >= 63 && t <= 67) || (t >= 72 && t <= 75) ||
           (t >= 84 && t <= 87) || (t >= 51 && t <= 55) ||
           (t >= 48 && t <= 50) ||
           (t >= 96 && t <= 98) ||
           t === 12 || t === 13 || t === 22 || t === 23 ||
           t === 24 || t === 25 ||
           (t >= 109 && t <= 127);
  }),
]);

// Door tiles are walkable exceptions
const DOOR_TILES = new Set([TILE.WOOD_DOOR, TILE.STONE_DOOR, TILE.BLUE_WALL_DOOR]);

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function valueNoise(x, y, scale) {
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

function weightedPick(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function distanceSq(x1, y1, x2, y2) {
  return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

// ---------------------------------------------------------------------------
// KnowledgeGenerator
// ---------------------------------------------------------------------------

class KnowledgeGenerator {
  /**
   * @param {Object} options
   * @param {number} [options.width=60]  - Map width in tiles
   * @param {number} [options.height=40] - Map height in tiles
   * @param {string} [options.knowledgePath] - Path to learned-tile-knowledge.json
   * @param {string} [options.semanticsPath] - Path to tile-semantics.json
   */
  constructor(options = {}) {
    this.width  = options.width  || 60;
    this.height = options.height || 40;

    // ---- Level 1: Load adjacency knowledge ----
    this.adjacency = {};  // adjacency[tileA][direction][tileB] = count
    this.learnedBlocks = []; // Large multi-layer composites (building blocks)
    if (options.knowledgePath && fs.existsSync(options.knowledgePath)) {
      try {
        const k = JSON.parse(fs.readFileSync(options.knowledgePath, 'utf8'));
        this.adjacency = k.adjacency || {};
        this._totalMapsLearned = k.totalMapsLearned || 0;

        // Load large multi-layer composites (building blocks)
        const rawPatterns = k.rawPatterns || {};
        for (const [id, data] of Object.entries(rawPatterns)) {
          if (!data.multiLayer || !data.width || data.width < 4) continue;
          // Only keep patterns that have real structure (buildings)
          const oFlat = data.multiLayer.objects.flat();
          const hasRoof = oFlat.some(t => [63,64,65,67,51,52,53,55].includes(t));
          const hasWall = oFlat.some(t => t >= 72 && t <= 87);
          if (!hasRoof || !hasWall) continue;

          // Trim the composite — find the bounding box of non-empty tiles
          const ml = data.multiLayer;
          let minX = data.width, maxX = 0, minY = data.height, maxY = 0;
          for (let y = 0; y < data.height; y++) {
            for (let x = 0; x < data.width; x++) {
              const o = ml.objects[y]?.[x] ?? -1;
              const f = ml.foreground[y]?.[x] ?? -1;
              if (o !== -1 || f !== -1) {
                minX = Math.min(minX, x); maxX = Math.max(maxX, x);
                minY = Math.min(minY, y); maxY = Math.max(maxY, y);
              }
            }
          }
          if (maxX < minX) continue; // no content

          // Extract trimmed block
          const tw = maxX - minX + 1;
          const th = maxY - minY + 1;
          if (tw < 3 || th < 2) continue; // too small

          const block = { ground: [], objects: [], foreground: [], width: tw, height: th, count: data.count, score: data.totalScore / Math.max(1, data.count) };
          for (let y = minY; y <= maxY; y++) {
            block.ground.push((ml.ground[y] || []).slice(minX, maxX + 1));
            block.objects.push((ml.objects[y] || []).slice(minX, maxX + 1));
            block.foreground.push((ml.foreground[y] || []).slice(minX, maxX + 1));
          }

          // Find door position in this block
          block.doorX = -1; block.doorY = -1;
          for (let y = 0; y < th; y++) {
            for (let x = 0; x < tw; x++) {
              if (block.objects[y][x] === TILE.WOOD_DOOR || block.objects[y][x] === TILE.STONE_DOOR) {
                block.doorX = x; block.doorY = y;
              }
            }
          }

          this.learnedBlocks.push(block);
        }

        // Sort by score descending — best blocks first
        this.learnedBlocks.sort((a, b) => b.score - a.score);
        // Keep top 50
        if (this.learnedBlocks.length > 50) this.learnedBlocks = this.learnedBlocks.slice(0, 50);
      } catch (e) {
        console.warn('Warning: Could not load knowledge file:', e.message);
      }
    }

    // Build fast adjacency lookup: normalized probabilities
    this._adjProb = {};  // _adjProb[tileA][dir] = { tileB: probability, ... }
    for (const [tileA, dirs] of Object.entries(this.adjacency)) {
      this._adjProb[tileA] = {};
      for (const [dir, neighbors] of Object.entries(dirs)) {
        const total = Object.values(neighbors).reduce((s, v) => s + v, 0);
        if (total > 0) {
          this._adjProb[tileA][dir] = {};
          for (const [tileB, count] of Object.entries(neighbors)) {
            this._adjProb[tileA][dir][tileB] = count / total;
          }
        }
      }
    }

    // ---- Level 2: Load composite templates ----
    this.composites = { buildings: [], trees: [], water: [], fences: [] };
    this._semanticTiles = null;

    if (options.semanticsPath && fs.existsSync(options.semanticsPath)) {
      try {
        const s = JSON.parse(fs.readFileSync(options.semanticsPath, 'utf8'));
        this._semanticTiles = s.tiles || null;

        // Extract composites from compositeObjects array
        const composites = s.compositeObjects || [];
        for (const c of composites) {
          if (c.category === 'building') {
            // Determine door offset from tiles or doorPosition
            let doorOff = 1;
            if (c.placementRules && c.placementRules.doorPosition) {
              doorOff = c.placementRules.doorPosition.x;
            } else if (c.tiles && c.tiles[1]) {
              // Find door tile in wall row
              const wallRow = c.tiles[1];
              for (let i = 0; i < wallRow.length; i++) {
                if (DOOR_TILES.has(wallRow[i])) { doorOff = i; break; }
              }
            }
            this.composites.buildings.push({
              id: c.id, name: c.name, category: 'building',
              width: c.width, height: c.height,
              tiles: c.tiles, doorOffset: doorOff,
            });
          } else if (c.category === 'vegetation') {
            this.composites.trees.push(c);
          } else if (c.category === 'water') {
            this.composites.water.push(c);
          } else if (c.category === 'fence') {
            this.composites.fences.push(c);
          }
        }

        // Also load from buildingTemplates if present (alternative location)
        if (this.composites.buildings.length === 0 && s.buildingTemplates) {
          for (const bt of s.buildingTemplates) {
            if (bt.category !== 'building') continue;
            let doorOff = 1;
            if (bt.placementRules && bt.placementRules.doorPosition) {
              doorOff = bt.placementRules.doorPosition.x;
            } else if (bt.tiles && bt.tiles[1]) {
              const wallRow = bt.tiles[1];
              for (let i = 0; i < wallRow.length; i++) {
                if (DOOR_TILES.has(wallRow[i])) { doorOff = i; break; }
              }
            }
            this.composites.buildings.push({
              id: bt.id, name: bt.name, category: 'building',
              width: bt.width, height: bt.height,
              tiles: bt.tiles, doorOffset: doorOff,
            });
          }
        }
      } catch (e) {
        console.warn('Warning: Could not load semantics file:', e.message);
      }
    }

    // Fallback to hardcoded building templates
    if (this.composites.buildings.length === 0) {
      this.composites.buildings = deepClone(DEFAULT_BUILDING_TEMPLATES);
    }

    // Internal state — populated during generate()
    this._ground     = null;
    this._objects    = null;
    this._foreground = null;
    this._collision  = null;
    this._occupied   = null;
    this._pathTiles  = null;
    this._W = 0;
    this._H = 0;
  }

  // -------------------------------------------------------------------------
  // Internal accessors
  // -------------------------------------------------------------------------

  _idx(x, y) { return y * this._W + x; }
  _inBounds(x, y) { return x >= 0 && x < this._W && y >= 0 && y < this._H; }

  _getLayer(layer) {
    switch (layer) {
      case 'ground':     return this._ground;
      case 'objects':    return this._objects;
      case 'foreground': return this._foreground;
      default:           return this._objects;
    }
  }

  _getTile(layer, x, y) {
    if (!this._inBounds(x, y)) return TILE.EMPTY;
    return this._getLayer(layer)[this._idx(x, y)];
  }

  _setTile(layer, x, y, tileId) {
    if (!this._inBounds(x, y)) return;
    this._getLayer(layer)[this._idx(x, y)] = tileId;
  }

  // -------------------------------------------------------------------------
  // Level 1: Adjacency validation
  // -------------------------------------------------------------------------

  /**
   * Check if placing a tile at (x,y) is valid according to learned adjacency.
   * @param {string} layer - 'ground', 'objects', 'foreground'
   * @param {number} x
   * @param {number} y
   * @param {number} tileId
   * @returns {boolean}
   */
  isValidPlacement(layer, x, y, tileId) {
    const layerData = this._getLayer(layer);
    if (!layerData) return true; // no layer data = allow
    const w = this._W;
    const dirs = [
      { dx: 0, dy: -1, dir: 'north', opposite: 'south' },
      { dx: 0, dy:  1, dir: 'south', opposite: 'north' },
      { dx: 1, dy:  0, dir: 'east',  opposite: 'west'  },
      { dx:-1, dy:  0, dir: 'west',  opposite: 'east'  },
    ];

    for (const { dx, dy, dir, opposite } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= this._H) continue;
      const neighbor = layerData[ny * w + nx];
      if (neighbor === TILE.EMPTY) continue; // empty = anything goes

      // Check: does tileId allow neighbor in direction?
      const rules = this._adjProb[tileId]?.[dir];
      if (rules && !(String(neighbor) in rules)) return false;

      // Check reverse: does neighbor allow tileId in opposite direction?
      const reverseRules = this._adjProb[neighbor]?.[opposite];
      if (reverseRules && !(String(tileId) in reverseRules)) return false;
    }
    return true; // no rules violated (permissive default)
  }

  /**
   * Get the best tile for a position based on adjacency rules.
   * Scores each candidate by how many adjacency rules it satisfies with
   * the highest probability.
   * @param {string} layer
   * @param {number} x
   * @param {number} y
   * @param {number[]} candidates - Tile IDs to choose from
   * @returns {number} Best tile ID
   */
  bestTileForPosition(layer, x, y, candidates) {
    if (!candidates || candidates.length === 0) return TILE.EMPTY;
    if (candidates.length === 1) return candidates[0];

    const layerData = this._getLayer(layer);
    if (!layerData) return candidates[Math.floor(Math.random() * candidates.length)];

    const w = this._W;
    const dirs = [
      { dx: 0, dy: -1, dir: 'north', opposite: 'south' },
      { dx: 0, dy:  1, dir: 'south', opposite: 'north' },
      { dx: 1, dy:  0, dir: 'east',  opposite: 'west'  },
      { dx:-1, dy:  0, dir: 'west',  opposite: 'east'  },
    ];

    let bestTile = candidates[0];
    let bestScore = -1;

    for (const cand of candidates) {
      let score = 0;

      for (const { dx, dy, dir, opposite } of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= this._H) continue;
        const neighbor = layerData[ny * w + nx];
        if (neighbor === TILE.EMPTY) continue;

        // Forward probability: P(neighbor | cand in dir)
        const prob = this._adjProb[cand]?.[dir]?.[String(neighbor)] || 0;
        score += prob;

        // Reverse probability: P(cand | neighbor in opposite)
        const revProb = this._adjProb[neighbor]?.[opposite]?.[String(cand)] || 0;
        score += revProb;
      }

      // Add small random jitter for variety when scores are close
      score += Math.random() * 0.001;

      if (score > bestScore) {
        bestScore = score;
        bestTile = cand;
      }
    }

    return bestTile;
  }

  // -------------------------------------------------------------------------
  // Level 2: Composite placement
  // -------------------------------------------------------------------------

  /**
   * Place a complete building composite on the objects layer.
   * @param {Object} template - Building template with tiles[][], width, height, doorOffset
   * @param {number} bx - Left x of building
   * @param {number} by - Top y of building (roof row)
   * @returns {{x, y, w, doorX, doorY, template}|null} Building info or null if failed
   */
  _placeBuilding(template, bx, by) {
    const w = template.width;

    // Verify all cells are available
    for (let dy = 0; dy < template.height; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = bx + dx;
        const py = by + dy;
        if (!this._inBounds(px, py)) return null;
        if (this._occupied[this._idx(px, py)]) return null;
      }
    }

    // Place roof row (first row of tiles)
    const roofRow = template.tiles[0];
    for (let dx = 0; dx < w; dx++) {
      const px = bx + dx;
      this._objects[this._idx(px, by)] = roofRow[dx];
      this._occupied[this._idx(px, by)] = 1;
      this._collision[this._idx(px, by)] = 1;
    }

    // Place wall row (second row of tiles)
    const wallRow = template.tiles[1];
    for (let dx = 0; dx < w; dx++) {
      const px = bx + dx;
      const py = by + 1;
      this._objects[this._idx(px, py)] = wallRow[dx];
      this._occupied[this._idx(px, py)] = 1;
      // Door is walkable, everything else blocks
      if (DOOR_TILES.has(wallRow[dx])) {
        this._collision[this._idx(px, py)] = 0;
      } else {
        this._collision[this._idx(px, py)] = 1;
      }
    }

    const doorX = bx + template.doorOffset;
    const doorY = by + 1;
    return { x: bx, y: by, w, doorX, doorY, template };
  }

  /**
   * Place a composite tree (canopy on foreground, trunk on objects).
   * @param {number} typeIdx - Index into TREE_DEFS
   * @param {number} x - Left x of trunk
   * @param {number} y - Trunk row y
   * @returns {boolean} true if placed
   */
  _placeTree(typeIdx, x, y) {
    const def = TREE_DEFS[clamp(typeIdx, 0, TREE_DEFS.length - 1)];

    if (def.size === 2) {
      // 2-wide tree: canopy at (x, y-1)+(x+1, y-1), trunk at (x, y)+(x+1, y)
      if (!this._inBounds(x + 1, y) || !this._inBounds(x, y - 1) || !this._inBounds(x + 1, y - 1)) return false;
      if (this._occupied[this._idx(x, y)] || this._occupied[this._idx(x + 1, y)] ||
          this._occupied[this._idx(x, y - 1)] || this._occupied[this._idx(x + 1, y - 1)]) return false;

      // Don't place on paths
      if (this._pathTiles.has(this._idx(x, y)) || this._pathTiles.has(this._idx(x + 1, y)) ||
          this._pathTiles.has(this._idx(x, y - 1)) || this._pathTiles.has(this._idx(x + 1, y - 1))) return false;

      this._foreground[this._idx(x, y - 1)]     = def.canopy[0];
      this._foreground[this._idx(x + 1, y - 1)] = def.canopy[1];
      this._objects[this._idx(x, y)]             = def.trunk[0];
      this._objects[this._idx(x + 1, y)]         = def.trunk[1];
      this._collision[this._idx(x, y)]     = 1;
      this._collision[this._idx(x + 1, y)] = 1;
      this._occupied[this._idx(x, y)]          = 1;
      this._occupied[this._idx(x + 1, y)]      = 1;
      this._occupied[this._idx(x, y - 1)]      = 1;
      this._occupied[this._idx(x + 1, y - 1)]  = 1;
    } else {
      // 1-wide tree: canopy at (x, y-1), trunk at (x, y)
      if (!this._inBounds(x, y - 1)) return false;
      if (this._occupied[this._idx(x, y)] || this._occupied[this._idx(x, y - 1)]) return false;
      if (this._pathTiles.has(this._idx(x, y)) || this._pathTiles.has(this._idx(x, y - 1))) return false;

      this._foreground[this._idx(x, y - 1)] = def.canopy[0];
      this._objects[this._idx(x, y)]         = def.trunk[0];
      this._collision[this._idx(x, y)] = 1;
      this._occupied[this._idx(x, y)]     = 1;
      this._occupied[this._idx(x, y - 1)] = 1;
    }
    return true;
  }

  /**
   * Place water pond using the 9-tile edge system, expanded for larger sizes.
   * @param {number} wx - Left x
   * @param {number} wy - Top y
   * @param {number} ww - Width in tiles (min 3)
   * @param {number} wh - Height in tiles (min 3)
   */
  _placeWater(wx, wy, ww, wh) {
    for (let dy = 0; dy < wh; dy++) {
      for (let dx = 0; dx < ww; dx++) {
        const px = wx + dx;
        const py = wy + dy;
        if (!this._inBounds(px, py) || this._occupied[this._idx(px, py)]) continue;

        let tile;
        const isTop    = dy === 0;
        const isBottom = dy === wh - 1;
        const isLeft   = dx === 0;
        const isRight  = dx === ww - 1;

        if      (isTop && isLeft)      tile = TILE.WATER_NW;
        else if (isTop && isRight)     tile = TILE.WATER_NE;
        else if (isTop)                tile = TILE.WATER_N;
        else if (isBottom && isLeft)   tile = TILE.WATER_SW;
        else if (isBottom && isRight)  tile = TILE.WATER_SE;
        else if (isBottom)             tile = TILE.WATER_S;
        else if (isLeft)               tile = TILE.WATER_W;
        else if (isRight)              tile = TILE.WATER_E;
        else                           tile = TILE.WATER_CENTER;

        this._objects[this._idx(px, py)]   = tile;
        this._collision[this._idx(px, py)] = 1;
        this._occupied[this._idx(px, py)]  = 1;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Path helpers
  // -------------------------------------------------------------------------

  /**
   * Place a 2-wide horizontal path segment.
   * Top row = edge(39), bottom row = edge(41).
   */
  _placeHPath(x, y) {
    if (this._inBounds(x, y)) {
      this._ground[this._idx(x, y)] = TILE.PATH_EDGE_LT;
      this._pathTiles.add(this._idx(x, y));
    }
    if (this._inBounds(x, y + 1)) {
      this._ground[this._idx(x, y + 1)] = TILE.PATH_EDGE_RB;
      this._pathTiles.add(this._idx(x, y + 1));
    }
  }

  /**
   * Place a 2-wide vertical path segment.
   * Left col = edge(39), right col = edge(41).
   */
  _placeVPath(x, y) {
    if (this._inBounds(x, y)) {
      this._ground[this._idx(x, y)] = TILE.PATH_EDGE_LT;
      this._pathTiles.add(this._idx(x, y));
    }
    if (this._inBounds(x + 1, y)) {
      this._ground[this._idx(x + 1, y)] = TILE.PATH_EDGE_RB;
      this._pathTiles.add(this._idx(x + 1, y));
    }
  }

  /**
   * Place a 3x3 intersection of center tiles.
   */
  _placeIntersection(x, y) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (this._inBounds(x + dx, y + dy)) {
          this._ground[this._idx(x + dx, y + dy)] = TILE.PATH_CENTER;
          this._pathTiles.add(this._idx(x + dx, y + dy));
        }
      }
    }
  }

  /**
   * Connect a point (typically a door) to the nearest path via 2-wide vertical branch.
   * Searches downward first, then upward if no path below.
   */
  _connectToPath(doorX, doorY) {
    // Try downward first
    let connected = false;
    for (let py = doorY + 1; py < this._H; py++) {
      if (this._pathTiles.has(this._idx(doorX, py)) ||
          this._pathTiles.has(this._idx(doorX + 1, py))) {
        connected = true;
        break;
      }
      if (this._occupied[this._idx(doorX, py)]) break; // blocked
      this._placeVPath(doorX, py);
    }

    if (!connected) {
      // Try upward
      for (let py = doorY - 2; py >= 0; py--) { // -2 to skip building
        if (this._pathTiles.has(this._idx(doorX, py)) ||
            this._pathTiles.has(this._idx(doorX + 1, py))) {
          break;
        }
        if (this._occupied[this._idx(doorX, py)]) break;
        this._placeVPath(doorX, py);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Main generation — Level 3: Composition from DNA
  // -------------------------------------------------------------------------

  /**
   * Generate a map using DNA parameters + learned knowledge.
   * @param {Object} dna - Same DNA format as genetic-evolver.js
   * @returns {{ width: number, height: number, ground: number[], objects: number[], foreground: number[], collision: number[] }}
   */
  generate(dna) {
    const W = this.width;
    const H = this.height;
    const size = W * H;

    // Initialise layers
    this._W = W;
    this._H = H;
    this._ground     = new Array(size).fill(TILE.GRASS_PLAIN);
    this._objects    = new Array(size).fill(TILE.EMPTY);
    this._foreground = new Array(size).fill(TILE.EMPTY);
    this._collision  = new Array(size).fill(0);
    this._occupied   = new Uint8Array(size);
    this._pathTiles  = new Set();

    // =======================================================================
    // SPATIAL GRAMMAR: Plan zones BEFORE placing tiles
    // =======================================================================
    this._grammar = new SpatialGrammar(W, H);
    this._grammar.planZones(dna);

    // =======================================================================
    // PASS 1: Ground layer (value noise grass mix, zone-aware)
    // =======================================================================
    const grassNoiseSeed = Math.random() * 1000;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const noise = valueNoise(x + grassNoiseSeed, y + grassNoiseSeed, 8);
        const threshold1 = dna.grassPlainPct || 0.60;
        const threshold2 = threshold1 + (dna.grassVariantPct || 0.30);

        const candidates = [];
        if (noise < threshold1) {
          candidates.push(TILE.GRASS_PLAIN, TILE.GRASS_PLAIN, TILE.GRASS_PLAIN);
        } else if (noise < threshold2) {
          candidates.push(TILE.GRASS_FLOWERS, TILE.GRASS_FLOWERS, TILE.GRASS_PLAIN);
        } else {
          candidates.push(TILE.GRASS_WHITE_FLOWERS, TILE.GRASS_FLOWERS, TILE.GRASS_PLAIN);
        }

        // Use adjacency knowledge to pick best grass tile
        this._ground[this._idx(x, y)] = this.bestTileForPosition('ground', x, y, candidates);
      }
    }

    // Enforce max-4-consecutive rule for grass
    this._breakGrassRuns();

    // =======================================================================
    // PASS 2: Village square
    // =======================================================================
    let squareBounds = null;
    if (dna.squareEnabled) {
      const sw = (dna.squareSize && dna.squareSize[0]) || 6;
      const sh = (dna.squareSize && dna.squareSize[1]) || 4;
      const sxCenter = (dna.squarePosition && dna.squarePosition[0]) || 0.5;
      const syCenter = (dna.squarePosition && dna.squarePosition[1]) || 0.5;
      const sx = Math.round(sxCenter * W - sw / 2);
      const sy = Math.round(syCenter * H - sh / 2);

      squareBounds = { x: sx, y: sy, w: sw, h: sh };

      for (let dy = 0; dy < sh; dy++) {
        for (let dx = 0; dx < sw; dx++) {
          const px = sx + dx;
          const py = sy + dy;
          if (this._inBounds(px, py)) {
            this._ground[this._idx(px, py)] = (dx + dy) % 2 === 0
              ? TILE.COBBLESTONE_A
              : TILE.COBBLESTONE_B;
          }
        }
      }
    }

    // =======================================================================
    // PASS 3: Paths
    // =======================================================================
    const pcx = Math.round((dna.pathCenterX || 0.5) * W);
    const pcy = Math.round((dna.pathCenterY || 0.5) * H);

    switch (dna.pathStyle || 'cross') {
      case 'cross': {
        for (let y = 4; y < H - 4; y++) this._placeVPath(pcx, y);
        for (let x = 4; x < W - 4; x++) this._placeHPath(x, pcy);
        this._placeIntersection(pcx, pcy);
        break;
      }
      case 'L-shape': {
        for (let y = 4; y <= pcy; y++) this._placeVPath(pcx, y);
        for (let x = pcx; x < W - 4; x++) this._placeHPath(x, pcy);
        this._placeIntersection(pcx, pcy);
        break;
      }
      case 'loop': {
        const lx1 = Math.round(W * 0.2), lx2 = Math.round(W * 0.8);
        const ly1 = Math.round(H * 0.2), ly2 = Math.round(H * 0.8);
        for (let x = lx1; x <= lx2; x++) { this._placeHPath(x, ly1); this._placeHPath(x, ly2); }
        for (let y = ly1; y <= ly2; y++) { this._placeVPath(lx1, y); this._placeVPath(lx2, y); }
        this._placeIntersection(lx1, ly1); this._placeIntersection(lx2, ly1);
        this._placeIntersection(lx1, ly2); this._placeIntersection(lx2, ly2);
        break;
      }
      case 'radial':
      case 'organic':
      default: {
        for (let y = 4; y < H - 4; y++) this._placeVPath(pcx, y);
        for (let x = 4; x < W - 4; x++) this._placeHPath(x, pcy);
        this._placeIntersection(pcx, pcy);
        const qx1 = Math.round(W * 0.25), qx2 = Math.round(W * 0.75);
        const qy1 = Math.round(H * 0.25), qy2 = Math.round(H * 0.75);
        for (let x = qx1; x <= pcx; x++) this._placeHPath(x, qy1);
        for (let x = pcx; x <= qx2; x++) this._placeHPath(x, qy1);
        for (let x = qx1; x <= pcx; x++) this._placeHPath(x, qy2);
        for (let x = pcx; x <= qx2; x++) this._placeHPath(x, qy2);
        this._placeIntersection(pcx, qy1);
        this._placeIntersection(pcx, qy2);
        break;
      }
    }

    // =======================================================================
    // PASS 4: Buildings (grammar-planned positions → learned blocks → templates)
    // =======================================================================
    const buildings = [];
    const numBuildings = dna.buildingCount || 3;
    const yMin = Math.round((dna.buildingYBand ? dna.buildingYBand[0] : 0.15) * H);
    const yMax = Math.round((dna.buildingYBand ? dna.buildingYBand[1] : 0.70) * H);
    const minSpacing = dna.buildingMinSpacing || 10;

    // USE GRAMMAR-PLANNED POSITIONS (buildings already validated near paths)
    const plannedPositions = this._grammar.getPlannedBuildings();

    // TRY LEARNED BLOCKS at grammar-planned positions FIRST
    if (this.learnedBlocks.length > 0) {
      const shuffledBlocks = [...this.learnedBlocks].sort(() => Math.random() - 0.5);

      for (let pi = 0; pi < plannedPositions.length && buildings.length < numBuildings; pi++) {
        const pos = plannedPositions[pi];
        const block = shuffledBlocks[pi % shuffledBlocks.length];
        const bw = block.width;
        const bh = block.height;

        // USE GRAMMAR-PLANNED POSITION (already validated near paths)
        const bx = pos.x;
        const by = pos.y;

        // Check bounds
        if (by < 1 || by + bh >= H || bx + bw >= W) continue;

        // Check clear area (no paths or occupied)
        let blocked = false;
        for (let dy = 0; dy < bh && !blocked; dy++) {
          for (let dx = 0; dx < bw && !blocked; dx++) {
            const pi = this._idx(bx + dx, by + dy);
            if (this._occupied[pi]) blocked = true;
          }
        }
        if (blocked) continue;

        // STAMP the entire block — all 3 layers
        for (let dy = 0; dy < bh; dy++) {
          for (let dx = 0; dx < bw; dx++) {
            const ti = this._idx(bx + dx, by + dy);
            const gt = block.ground[dy]?.[dx];
            const ot = block.objects[dy]?.[dx];
            const ft = block.foreground[dy]?.[dx];

            if (gt !== undefined && gt !== -1) this._ground[ti] = gt;
            if (ot !== undefined && ot !== -1) {
              this._objects[ti] = ot;
              this._occupied[ti] = 1;
              // Collision for non-door building tiles
              if (ot !== TILE.WOOD_DOOR && ot !== TILE.STONE_DOOR) {
                this._collision[ti] = 1;
              }
            }
            if (ft !== undefined && ft !== -1) this._foreground[ti] = ft;
          }
        }

        // Record building info
        const doorX = block.doorX >= 0 ? bx + block.doorX : bx + Math.floor(bw / 2);
        const doorY = block.doorY >= 0 ? by + block.doorY : by + 1;
        buildings.push({ x: bx, y: by, w: bw, h: bh, doorX, doorY, source: 'learned-block' });

        // Connect door to nearest path
        if (dna.pathConnectBuildings !== false) {
          this._connectToPath(doorX, doorY);
        }
      }
    }

    // FALLBACK: Use template-based placement for remaining buildings needed
    const templateIndices = dna.buildingTemplates || [0, 1];
    const availableTemplates = this.composites.buildings;

    for (let attempt = 0; attempt < numBuildings * 50 && buildings.length < numBuildings; attempt++) {
      // Pick a template
      const tplIdx = templateIndices[Math.floor(Math.random() * templateIndices.length)];
      const tpl = availableTemplates[clamp(tplIdx, 0, availableTemplates.length - 1)];

      // Pick a position with staggering (avoid grid alignment)
      const bx = Math.floor(Math.random() * (W - tpl.width - 4)) + 2;
      const by = yMin + Math.floor(Math.random() * Math.max(1, yMax - yMin - 2));

      // Check spacing from other buildings
      let tooClose = false;
      for (const b of buildings) {
        if (Math.abs(bx - b.x) < minSpacing && Math.abs(by - b.y) < minSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Check bounds
      if (by < 1 || by + 1 >= H || bx + tpl.width >= W) continue;

      // Don't place on paths or occupied tiles
      let onPath = false;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < tpl.width; dx++) {
          const pi = this._idx(bx + dx, by + dy);
          if (this._pathTiles.has(pi) || this._occupied[pi]) { onPath = true; break; }
        }
        if (onPath) break;
      }
      if (onPath) continue;

      // Place the composite building
      const bInfo = this._placeBuilding(tpl, bx, by);
      if (!bInfo) continue;

      buildings.push(bInfo);

      // Connect building door to nearest path
      if (dna.pathConnectBuildings !== false) {
        this._connectToPath(bInfo.doorX, bInfo.doorY);
      }
    }

    // =======================================================================
    // PASS 5: Fences (below each building, gate at door)
    // =======================================================================
    if (dna.fenceEnabled !== false) {
      for (const b of buildings) {
        const fenceY = b.y + 2; // one row below wall row
        if (fenceY >= H) continue;

        // Fence extends 1 tile each side of building
        const fenceExtend = (dna.fenceWidth != null) ? dna.fenceWidth : 1;
        const fenceLeft  = Math.max(0, b.x - fenceExtend);
        const fenceRight = Math.min(W - 1, b.x + b.w - 1 + fenceExtend);

        for (let fx = fenceLeft; fx <= fenceRight; fx++) {
          if (!this._inBounds(fx, fenceY)) continue;
          if (this._occupied[this._idx(fx, fenceY)]) continue;

          // Gate gap aligned with door column
          if ((dna.fenceGapAligned !== false) && fx === b.doorX) continue;

          let fenceTile;
          if (fx === fenceLeft) {
            fenceTile = TILE.WHITE_FENCE_L;
          } else if (fx === fenceRight) {
            fenceTile = TILE.WHITE_FENCE_R;
          } else {
            fenceTile = TILE.WHITE_FENCE_M;
          }

          // Validate fence placement with adjacency
          if (!this.isValidPlacement('objects', fx, fenceY, fenceTile)) {
            // Fall back to middle fence if specific end piece doesn't validate
            fenceTile = TILE.WHITE_FENCE_M;
          }

          this._objects[this._idx(fx, fenceY)]   = fenceTile;
          this._collision[this._idx(fx, fenceY)] = 1;
          this._occupied[this._idx(fx, fenceY)]  = 1;
        }
      }
    }

    // =======================================================================
    // PASS 6: Trees (border + interior clusters, composite placement)
    // =======================================================================
    const borderDepth   = dna.treeBorderDepth   || 3;
    const borderDensity = dna.treeBorderDensity  || 0.6;
    const treeWeights   = dna.treeTypeWeights    || [0.4, 0.3, 0.2, 0.1];

    // 6a) Border trees — staggered along map edges
    for (let y = 1; y < H; y++) {  // Start at 1 to allow canopy at y-1
      for (let x = 0; x < W; x++) {
        const distFromEdge = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (distFromEdge >= borderDepth) continue;
        if (this._occupied[this._idx(x, y)]) continue;
        if (this._pathTiles.has(this._idx(x, y))) continue;
        // SPATIAL GRAMMAR: only place trees in forest/open/yard zones
        if (!this._grammar.canPlaceTree(x, y)) continue;

        // Stagger: place every 2-3 tiles, offset by row for organic look
        const stagger = (x + y * 2) % 3;
        if (stagger !== 0 && Math.random() > borderDensity * 0.5) continue;

        // Mix tree types: bias by row pairs for visual variety, but use DNA weights
        const rowBias = (y % 4 < 2) ? 0 : 1;
        const treeType = Math.random() < 0.6 ? rowBias : weightedPick(treeWeights);

        this._placeTree(treeType, x, y);
      }
    }

    // 6b) Interior tree clusters
    const numClusters = dna.treeInteriorClusters || 5;
    const clusterSize = dna.treeClusterSize      || 3;

    for (let c = 0; c < numClusters; c++) {
      // Pick cluster center in interior zone (away from border)
      const cx = borderDepth + 2 + Math.floor(Math.random() * Math.max(1, W - 2 * (borderDepth + 2)));
      const cy = borderDepth + 2 + Math.floor(Math.random() * Math.max(1, H - 2 * (borderDepth + 2)));

      // Verify cluster center isn't too close to buildings
      let nearBuilding = false;
      for (const b of buildings) {
        if (distanceSq(cx, cy, b.x + b.w / 2, b.y + 1) < 16) { // 4-tile radius
          nearBuilding = true;
          break;
        }
      }
      if (nearBuilding) continue;

      // Place trees around cluster center with jitter
      for (let t = 0; t < clusterSize; t++) {
        const tx = cx + Math.floor(Math.random() * 5) - 2;
        const ty = cy + Math.floor(Math.random() * 5) - 2;
        if (ty < 1 || !this._inBounds(tx, ty)) continue;
        if (this._occupied[this._idx(tx, ty)]) continue;
        if (!this._grammar.canPlaceTree(tx, ty)) continue;
        if (this._pathTiles.has(this._idx(tx, ty))) continue;

        // Mix at least 2 types per cluster
        const treeType = (t === 0) ? weightedPick(treeWeights)
          : Math.random() < 0.5 ? weightedPick(treeWeights)
          : (weightedPick(treeWeights) + 1) % TREE_DEFS.length;

        this._placeTree(treeType, tx, ty);
      }

      // Add understory small trees / ferns near cluster base
      for (let u = 0; u < 2; u++) {
        const ux = cx + Math.floor(Math.random() * 5) - 2;
        const uy = cy + Math.floor(Math.random() * 5) - 2;
        if (!this._inBounds(ux, uy) || this._occupied[this._idx(ux, uy)]) continue;
        if (this._pathTiles.has(this._idx(ux, uy))) continue;

        const smallTree = [TILE.SMALL_GREEN, TILE.SMALL_AUTUMN, TILE.SMALL_COMPLETE, TILE.FERN];
        const pick = smallTree[Math.floor(Math.random() * smallTree.length)];
        this._objects[this._idx(ux, uy)] = pick;
        this._occupied[this._idx(ux, uy)] = 1;
        // Small trees and ferns are walkable decorations
      }
    }

    // =======================================================================
    // PASS 7: Decorations (near buildings)
    // =======================================================================
    const decoPerBuilding = dna.decoPerBuilding || 3;
    const decoRadius      = dna.decoRadius      || 4;
    const decoTypes       = dna.decoTypes        || [0, 1, 2, 3];

    for (const b of buildings) {
      const centerX = b.x + Math.floor(b.w / 2);
      const centerY = b.y + 1;

      for (let d = 0; d < decoPerBuilding; d++) {
        // Place decorations in a radius around the building
        const dx = centerX + Math.floor(Math.random() * (b.w + 2 * decoRadius)) - decoRadius;
        const dy = centerY + Math.floor(Math.random() * (2 + 2 * decoRadius)) - decoRadius;

        if (!this._inBounds(dx, dy) || this._occupied[this._idx(dx, dy)]) continue;
        if (this._pathTiles.has(this._idx(dx, dy))) continue;
        // SPATIAL GRAMMAR: decorations only in yards, open space, or square
        if (!this._grammar.canPlaceDecoration(dx, dy)) continue;

        // Pick decoration type from DNA
        const decoIdx = decoTypes[Math.floor(Math.random() * decoTypes.length)];
        const candidates = [];

        // Build candidate list for adjacency-based selection
        if (decoIdx === 0) {
          candidates.push(TILE.TULIP, TILE.PURPLE_FLOWER_BUSH, TILE.FERN);
        } else if (decoIdx === 1) {
          candidates.push(TILE.BUSH_GREEN, TILE.BUSH_BERRY);
        } else if (decoIdx === 2) {
          candidates.push(TILE.BARREL);
        } else if (decoIdx === 3) {
          candidates.push(TILE.LANTERN);
        } else {
          candidates.push(DECO_TILES[clamp(decoIdx, 0, DECO_TILES.length - 1)]);
        }

        // Use adjacency to pick best decoration
        const tile = this.bestTileForPosition('objects', dx, dy, candidates);

        this._objects[this._idx(dx, dy)] = tile;
        this._occupied[this._idx(dx, dy)] = 1;

        // Collision for blocking decorations
        if (tile === TILE.BARREL || tile === TILE.LANTERN) {
          this._collision[this._idx(dx, dy)] = 1;
        }
      }
    }

    // Flower clusters near POIs (paths, square, water) if DNA says so
    if (dna.flowerNearPOI !== false) {
      this._placeFlowerClusters(buildings, squareBounds);
    }

    // Well placement
    if (dna.wellEnabled !== false && buildings.length > 0) {
      this._placeWell(dna, buildings, squareBounds);
    }

    // =======================================================================
    // PASS 8: Water
    // =======================================================================
    if (dna.waterEnabled) {
      const ww = Math.max(3, (dna.waterSize && dna.waterSize[0]) || 4);
      const wh = Math.max(3, (dna.waterSize && dna.waterSize[1]) || 3);
      const wpx = (dna.waterPosition && dna.waterPosition[0]) || 0.7;
      const wpy = (dna.waterPosition && dna.waterPosition[1]) || 0.5;
      const waterX = Math.round(wpx * W - ww / 2);
      const waterY = Math.round(wpy * H - wh / 2);

      // Verify water area is clear of buildings (2-tile gap)
      let waterClear = true;
      for (const b of buildings) {
        if (waterX - 2 < b.x + b.w && waterX + ww + 2 > b.x &&
            waterY - 2 < b.y + 2 && waterY + wh + 2 > b.y) {
          waterClear = false;
          break;
        }
      }

      if (waterClear) {
        this._placeWater(waterX, waterY, ww, wh);

        // Surround water with flowers on 1-2 sides
        this._decorateAroundWater(waterX, waterY, ww, wh);
      }
    }

    // =======================================================================
    // PASS 9: Collision auto-generation
    // =======================================================================
    // Already set during placement passes, but do a final validation sweep
    for (let i = 0; i < size; i++) {
      const objTile = this._objects[i];
      if (objTile === TILE.EMPTY) continue;

      // Door tiles are always walkable
      if (DOOR_TILES.has(objTile)) {
        this._collision[i] = 0;
        continue;
      }

      // Walkable decorations: flowers, bushes, small trees, ferns
      if (objTile === TILE.TULIP || objTile === TILE.FERN ||
          objTile === TILE.PURPLE_FLOWER_BUSH ||
          objTile === TILE.BUSH_GREEN || objTile === TILE.BUSH_BERRY ||
          objTile === TILE.SMALL_GREEN || objTile === TILE.SMALL_AUTUMN ||
          objTile === TILE.SMALL_COMPLETE || objTile === TILE.SMALL_FRUIT) {
        this._collision[i] = 0;
        continue;
      }

      // Everything else on objects layer that isn't empty blocks
      if (this._collision[i] === 0 && COLLISION_TILES.has(objTile)) {
        this._collision[i] = 1;
      }
    }

    // Ground paths are always walkable
    for (const pi of this._pathTiles) {
      this._collision[pi] = 0;
    }

    // Build result
    const result = {
      width:  W,
      height: H,
      ground:     Array.from(this._ground),
      objects:    Array.from(this._objects),
      foreground: Array.from(this._foreground),
      collision:  Array.from(this._collision),
    };

    // Clean up internal state
    this._ground = null;
    this._objects = null;
    this._foreground = null;
    this._collision = null;
    this._occupied = null;
    this._pathTiles = null;

    return result;
  }

  // -------------------------------------------------------------------------
  // Private generation helpers
  // -------------------------------------------------------------------------

  /**
   * Break long runs of the same grass tile (max 4 consecutive in any row).
   */
  _breakGrassRuns() {
    const grassTiles = [TILE.GRASS_PLAIN, TILE.GRASS_FLOWERS, TILE.GRASS_WHITE_FLOWERS];

    for (let y = 0; y < this._H; y++) {
      let runTile = -1;
      let runLen = 0;

      for (let x = 0; x < this._W; x++) {
        const t = this._ground[this._idx(x, y)];
        if (!grassTiles.includes(t)) { runTile = -1; runLen = 0; continue; }

        if (t === runTile) {
          runLen++;
          if (runLen > 4) {
            // Swap to a different grass tile
            const alt = grassTiles.filter(g => g !== t);
            this._ground[this._idx(x, y)] = alt[Math.floor(Math.random() * alt.length)];
            runLen = 1;
            runTile = this._ground[this._idx(x, y)];
          }
        } else {
          runTile = t;
          runLen = 1;
        }
      }
    }
  }

  /**
   * Place flower clusters near points of interest.
   */
  _placeFlowerClusters(buildings, squareBounds) {
    const flowerTiles = [TILE.TULIP, TILE.PURPLE_FLOWER_BUSH, TILE.FERN];

    // Near buildings
    for (const b of buildings) {
      const numFlowers = 2 + Math.floor(Math.random() * 3);
      for (let f = 0; f < numFlowers; f++) {
        const fx = b.x + Math.floor(Math.random() * (b.w + 4)) - 2;
        const fy = b.y + 3 + Math.floor(Math.random() * 3); // Below fence line
        if (!this._inBounds(fx, fy) || this._occupied[this._idx(fx, fy)]) continue;
        if (this._pathTiles.has(this._idx(fx, fy))) continue;

        const tile = this.bestTileForPosition('objects', fx, fy, flowerTiles);
        this._objects[this._idx(fx, fy)] = tile;
        this._occupied[this._idx(fx, fy)] = 1;
      }
    }

    // Near village square edges
    if (squareBounds) {
      const { x: sx, y: sy, w: sw, h: sh } = squareBounds;
      for (let i = 0; i < 6; i++) {
        const side = Math.floor(Math.random() * 4);
        let fx, fy;
        if (side === 0) { fx = sx - 1 - Math.floor(Math.random() * 2); fy = sy + Math.floor(Math.random() * sh); }
        else if (side === 1) { fx = sx + sw + Math.floor(Math.random() * 2); fy = sy + Math.floor(Math.random() * sh); }
        else if (side === 2) { fx = sx + Math.floor(Math.random() * sw); fy = sy - 1 - Math.floor(Math.random() * 2); }
        else { fx = sx + Math.floor(Math.random() * sw); fy = sy + sh + Math.floor(Math.random() * 2); }

        if (!this._inBounds(fx, fy) || this._occupied[this._idx(fx, fy)]) continue;
        if (this._pathTiles.has(this._idx(fx, fy))) continue;

        const tile = flowerTiles[Math.floor(Math.random() * flowerTiles.length)];
        this._objects[this._idx(fx, fy)] = tile;
        this._occupied[this._idx(fx, fy)] = 1;
      }
    }
  }

  /**
   * Place decorative flowers/bushes around water feature.
   */
  _decorateAroundWater(wx, wy, ww, wh) {
    const decoTiles = [TILE.TULIP, TILE.PURPLE_FLOWER_BUSH, TILE.BUSH_GREEN, TILE.FERN];
    const sides = shuffleArray([0, 1, 2, 3]); // pick 1-2 random sides
    const numSides = 1 + Math.floor(Math.random() * 2);

    for (let s = 0; s < numSides; s++) {
      const side = sides[s];
      const numDeco = 2 + Math.floor(Math.random() * 3);

      for (let d = 0; d < numDeco; d++) {
        let dx, dy;
        if (side === 0) { // north
          dx = wx + Math.floor(Math.random() * ww);
          dy = wy - 1;
        } else if (side === 1) { // south
          dx = wx + Math.floor(Math.random() * ww);
          dy = wy + wh;
        } else if (side === 2) { // west
          dx = wx - 1;
          dy = wy + Math.floor(Math.random() * wh);
        } else { // east
          dx = wx + ww;
          dy = wy + Math.floor(Math.random() * wh);
        }

        if (!this._inBounds(dx, dy) || this._occupied[this._idx(dx, dy)]) continue;
        if (this._pathTiles.has(this._idx(dx, dy))) continue;

        const tile = decoTiles[Math.floor(Math.random() * decoTiles.length)];
        this._objects[this._idx(dx, dy)] = tile;
        this._occupied[this._idx(dx, dy)] = 1;
      }
    }
  }

  /**
   * Place a well at the appropriate location.
   */
  _placeWell(dna, buildings, squareBounds) {
    let wx, wy;
    const pos = dna.wellPosition || 'center';

    if (pos === 'center') {
      // Place at village square center if available, else map center
      if (squareBounds) {
        wx = squareBounds.x + Math.floor(squareBounds.w / 2);
        wy = squareBounds.y + Math.floor(squareBounds.h / 2);
      } else {
        wx = Math.round(this._W / 2);
        wy = Math.round(this._H / 2);
      }
    } else if (pos === 'near-path') {
      const pathArr = Array.from(this._pathTiles);
      if (pathArr.length > 0) {
        // Pick a path tile near the center for good placement
        const centerIdx = this._idx(Math.round(this._W / 2), Math.round(this._H / 2));
        pathArr.sort((a, b) => Math.abs(a - centerIdx) - Math.abs(b - centerIdx));
        const pick = pathArr[Math.floor(Math.random() * Math.min(10, pathArr.length))];
        wx = (pick % this._W) + 1; // Offset so well is beside path, not on it
        wy = Math.floor(pick / this._W);
      } else {
        wx = Math.round(this._W / 2);
        wy = Math.round(this._H / 2);
      }
    } else {
      wx = Math.floor(Math.random() * (this._W - 4)) + 2;
      wy = Math.floor(Math.random() * (this._H - 4)) + 2;
    }

    // Try to place well (top + base, 1x2 vertical)
    if (this._inBounds(wx, wy) && this._inBounds(wx, wy + 1) &&
        !this._occupied[this._idx(wx, wy)] && !this._occupied[this._idx(wx, wy + 1)] &&
        !this._pathTiles.has(this._idx(wx, wy)) && !this._pathTiles.has(this._idx(wx, wy + 1))) {
      this._objects[this._idx(wx, wy)]       = TILE.WELL_TOP;
      this._objects[this._idx(wx, wy + 1)]   = TILE.WELL_BASE;
      this._collision[this._idx(wx, wy)]     = 1;
      this._collision[this._idx(wx, wy + 1)] = 1;
      this._occupied[this._idx(wx, wy)]      = 1;
      this._occupied[this._idx(wx, wy + 1)]  = 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = { KnowledgeGenerator, TILE, TREE_DEFS, DECO_TILES };

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

if (require.main === module) {
  const gen = new KnowledgeGenerator({
    width: 60, height: 40,
    knowledgePath: path.join(__dirname, 'learned-tile-knowledge.json'),
    semanticsPath: path.join(__dirname, 'tile-semantics.json'),
  });

  // Default DNA
  const dna = {
    buildingCount: 4, buildingMinSpacing: 10,
    buildingTemplates: [0, 1, 2, 3], buildingYBand: [0.15, 0.7],
    fenceEnabled: true, fenceWidth: 2, fenceGapAligned: true,
    pathStyle: 'cross', pathWidth: 2, pathConnectBuildings: true,
    pathCenterX: 0.5, pathCenterY: 0.5,
    grassPlainPct: 0.60, grassVariantPct: 0.30, grassFlowerPct: 0.10,
    flowerNearPOI: true,
    treeBorderDepth: 3, treeBorderDensity: 0.6,
    treeInteriorClusters: 5, treeClusterSize: 3,
    treeTypeWeights: [0.4, 0.3, 0.2, 0.1],
    decoPerBuilding: 3, decoTypes: [0, 1, 2, 3], decoRadius: 4,
    wellEnabled: true, wellPosition: 'center',
    waterEnabled: true, waterSize: [4, 3], waterPosition: [0.7, 0.5],
    squareEnabled: true, squareSize: [6, 4], squarePosition: [0.5, 0.5],
  };

  console.log('Generating with knowledge-driven generator...');
  console.log('Adjacency rules loaded:', Object.keys(gen.adjacency).length, 'tiles');
  console.log('Building templates:', gen.composites.buildings.length);
  console.time('generate');
  const map = gen.generate(dna);
  console.timeEnd('generate');

  console.log('Map:', map.width, 'x', map.height);
  console.log('Objects:', map.objects.filter(t => t >= 0).length);
  console.log('Foreground:', map.foreground.filter(t => t >= 0).length);
  console.log('Collision:', map.collision.filter(t => t === 1).length, 'blocking tiles');

  // Score it
  try {
    const { auditMap } = require('./self-audit');
    const audit = auditMap(map);
    console.log('Audit score:', audit.score);
    if (audit.designDetails) {
      audit.designDetails.forEach(d => console.log(' ', d));
    }
  } catch (e) {
    console.log('(self-audit not available:', e.message, ')');
  }

  // Render
  try {
    const { renderMapToPng } = require('./tile-renderer');
    renderMapToPng(map, path.join(__dirname, '../../sprites/town/tilemap_packed.png')).then(buf => {
      const outDir = path.join(__dirname, 'batch-results');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'knowledge-gen-test.png'), buf);
      console.log('Saved: batch-results/knowledge-gen-test.png');
    }).catch(e => console.log('(render failed:', e.message, ')'));
  } catch (e) {
    console.log('(tile-renderer not available:', e.message, ')');
  }
}
