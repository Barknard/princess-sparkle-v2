/**
 * tile-relationship-learner.js
 *
 * Learns tile adjacency relationships from reference images and high-scoring
 * evolved maps, then exports those relationships as WFC-compatible rules.
 *
 * Instead of hardcoding which tiles go next to which, this module OBSERVES
 * real tile placements and builds a probabilistic adjacency graph that can
 * drive instant map generation via Wave Function Collapse.
 */

const fs = require('fs');
const path = require('path');

const DIRECTIONS = ['north', 'south', 'east', 'west'];

const OPPOSITE = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east'
};

// Tile classification helpers for composite detection
const ROOF_TILES = new Set([63, 64, 65, 66, 67]);
const WALL_TILES = new Set();
for (let i = 72; i <= 87; i++) WALL_TILES.add(i);
const CANOPY_TILES = new Set([4, 5, 7, 8]);
const TRUNK_TILES = new Set([12, 13, 24, 25]);
const FENCE_TILES = new Set([96, 97, 98, 99, 100, 101]);
const WATER_TILES = new Set();
for (let i = 109; i <= 123; i++) WATER_TILES.add(i);

class TileRelationshipLearner {
  constructor() {
    // adjacency[tileA][direction][tileB] = count (how many times observed)
    // directions: 'north', 'south', 'east', 'west'
    this.adjacency = {};

    // composites: learned multi-tile patterns (buildings, trees, fences)
    // composites[patternId] = { tiles: [[row0], [row1], ...], count: N, avgScore: S }
    this.composites = {};

    // Track raw pattern observations before extractComposites filters them
    this._rawPatterns = {};

    // metadata
    this.totalMapsLearned = 0;
    this.totalTilesObserved = 0;

    // Track total occurrences of each tile (for WFC weights)
    this._tileOccurrences = {};
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  /**
   * Ensure the nested adjacency structure exists for a tile pair.
   */
  _ensureAdj(tileA, direction, tileB) {
    if (!this.adjacency[tileA]) this.adjacency[tileA] = {};
    if (!this.adjacency[tileA][direction]) this.adjacency[tileA][direction] = {};
    if (!this.adjacency[tileA][direction][tileB]) this.adjacency[tileA][direction][tileB] = 0;
  }

  /**
   * Record an adjacency observation with a given weight.
   */
  _recordAdjacency(tileA, direction, tileB, weight) {
    this._ensureAdj(tileA, direction, tileB);
    this.adjacency[tileA][direction][tileB] += weight;
  }

  /**
   * Record a tile occurrence for frequency tracking.
   */
  _recordOccurrence(tile, weight) {
    if (!this._tileOccurrences[tile]) this._tileOccurrences[tile] = 0;
    this._tileOccurrences[tile] += weight;
  }

  /**
   * Build a pattern ID string from a 2D array of tile IDs.
   */
  _patternId(tileGrid) {
    return tileGrid.map(row => row.join(',')).join('|');
  }

  /**
   * Record a raw pattern observation.
   */
  _recordPattern(tileGrid, score) {
    const id = this._patternId(tileGrid);
    if (!this._rawPatterns[id]) {
      this._rawPatterns[id] = { tiles: tileGrid, count: 0, totalScore: 0 };
    }
    this._rawPatterns[id].count += 1;
    this._rawPatterns[id].totalScore += score;
  }

  /**
   * Get tile value at (x, y) from a flat layer array.
   * Returns undefined if out of bounds.
   */
  _getTile(layer, x, y, width, height) {
    if (x < 0 || x >= width || y < 0 || y >= height) return undefined;
    return layer[y * width + x];
  }

  /**
   * Process a single layer's adjacency relationships.
   */
  _learnLayer(layer, width, height, weight) {
    if (!layer || layer.length === 0) return;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tileA = this._getTile(layer, x, y, width, height);
        if (tileA === -1 || tileA === undefined) continue;

        this._recordOccurrence(tileA, weight);
        this.totalTilesObserved++;

        // North
        if (y > 0) {
          const tileB = this._getTile(layer, x, y - 1, width, height);
          if (tileB !== undefined) {
            this._recordAdjacency(tileA, 'north', tileB, weight);
          }
        }
        // South
        if (y < height - 1) {
          const tileB = this._getTile(layer, x, y + 1, width, height);
          if (tileB !== undefined) {
            this._recordAdjacency(tileA, 'south', tileB, weight);
          }
        }
        // East
        if (x < width - 1) {
          const tileB = this._getTile(layer, x + 1, y, width, height);
          if (tileB !== undefined) {
            this._recordAdjacency(tileA, 'east', tileB, weight);
          }
        }
        // West
        if (x > 0) {
          const tileB = this._getTile(layer, x - 1, y, width, height);
          if (tileB !== undefined) {
            this._recordAdjacency(tileA, 'west', tileB, weight);
          }
        }
      }
    }
  }

  /**
   * Scan a layer for multi-tile composite patterns.
   */
  _scanCompositePatterns(layer, width, height, score) {
    if (!layer || layer.length === 0) return;

    // 2x2 window
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 1; x++) {
        const p = [
          [this._getTile(layer, x, y, width, height), this._getTile(layer, x + 1, y, width, height)],
          [this._getTile(layer, x, y + 1, width, height), this._getTile(layer, x + 1, y + 1, width, height)]
        ];
        // Only record if at least 3 cells are non-empty (non-trivial)
        const nonEmpty = p.flat().filter(t => t !== -1 && t !== undefined).length;
        if (nonEmpty >= 3) {
          this._recordPattern(p, score);
        }
      }
    }

    // 3x2 window (roof + wall building patterns)
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width - 2; x++) {
        const p = [
          [
            this._getTile(layer, x, y, width, height),
            this._getTile(layer, x + 1, y, width, height),
            this._getTile(layer, x + 2, y, width, height)
          ],
          [
            this._getTile(layer, x, y + 1, width, height),
            this._getTile(layer, x + 1, y + 1, width, height),
            this._getTile(layer, x + 2, y + 1, width, height)
          ]
        ];
        const nonEmpty = p.flat().filter(t => t !== -1 && t !== undefined).length;
        if (nonEmpty >= 4) {
          this._recordPattern(p, score);
        }
      }
    }

    // 2x1 vertical (tree: canopy + trunk)
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width; x++) {
        const top = this._getTile(layer, x, y, width, height);
        const bottom = this._getTile(layer, x, y + 1, width, height);
        if (top !== -1 && top !== undefined && bottom !== -1 && bottom !== undefined) {
          this._recordPattern([[top], [bottom]], score);
        }
      }
    }

    // 3x3 window (water bodies)
    for (let y = 0; y < height - 2; y++) {
      for (let x = 0; x < width - 2; x++) {
        const p = [];
        let nonEmpty = 0;
        for (let dy = 0; dy < 3; dy++) {
          const row = [];
          for (let dx = 0; dx < 3; dx++) {
            const t = this._getTile(layer, x + dx, y + dy, width, height);
            row.push(t);
            if (t !== -1 && t !== undefined) nonEmpty++;
          }
          p.push(row);
        }
        if (nonEmpty >= 6) {
          this._recordPattern(p, score);
        }
      }
    }
  }

  /**
   * Scan for LARGE multi-layer composites (up to maxSize x maxSize).
   * Finds recurring rectangular patterns across ground+objects+foreground simultaneously.
   * A "village block" composite might be 10x6: building+fence+path+decorations.
   */
  _scanLargeComposites(mapData, score, maxSize) {
    maxSize = maxSize || 20;
    const { width, height, ground, objects, foreground } = mapData;

    // Scan windows from largest to smallest, but only non-trivial ones
    // (at least 20% non-empty tiles across all layers)
    const sizes = [];
    for (let h = maxSize; h >= 4; h--) {
      for (let w = maxSize; w >= 4; w--) {
        if (w * h > 600) continue; // allow windows up to ~25x24
        sizes.push({ w, h });
      }
    }

    for (const { w: pw, h: ph } of sizes) {
      // Step by half the window size to find overlapping patterns
      const stepX = Math.max(1, Math.floor(pw / 2));
      const stepY = Math.max(1, Math.floor(ph / 2));

      for (let y = 0; y <= height - ph; y += stepY) {
        for (let x = 0; x <= width - pw; x += stepX) {
          // Extract multi-layer pattern
          const pattern = { ground: [], objects: [], foreground: [], w: pw, h: ph };
          let nonEmpty = 0;
          let hasStructure = false; // has building/fence/tree tiles

          for (let dy = 0; dy < ph; dy++) {
            const gRow = [], oRow = [], fRow = [];
            for (let dx = 0; dx < pw; dx++) {
              const i = (y + dy) * width + (x + dx);
              const g = ground[i] ?? -1;
              const o = objects[i] ?? -1;
              const f = foreground[i] ?? -1;
              gRow.push(g); oRow.push(o); fRow.push(f);
              if (o !== -1) nonEmpty++;
              if (f !== -1) nonEmpty++;
              if (ROOF_TILES.has(o) || WALL_TILES.has(o) || FENCE_TILES.has(o) || CANOPY_TILES.has(f)) hasStructure = true;
            }
            pattern.ground.push(gRow);
            pattern.objects.push(oRow);
            pattern.foreground.push(fRow);
          }

          // Only record if pattern has meaningful structure (not just grass)
          if (!hasStructure || nonEmpty < pw * ph * 0.15) continue;

          // Create a multi-layer pattern ID
          const id = `ml_${pw}x${ph}_` + pattern.objects.map(r => r.join(',')).join('|') +
            '_fg_' + pattern.foreground.map(r => r.join(',')).join('|');

          if (!this._rawPatterns[id]) {
            this._rawPatterns[id] = {
              tiles: pattern.objects, // primary layer
              multiLayer: pattern,   // all layers
              count: 0,
              totalScore: 0,
              width: pw,
              height: ph
            };
          }
          this._rawPatterns[id].count += 1;
          this._rawPatterns[id].totalScore += score;
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Learn tile relationships from a rendered map's tile arrays.
   * @param {Object} mapData - { width, height, ground, objects, foreground }
   * @param {number} score - quality score of this map (higher = more weight)
   */
  learnFromMap(mapData, score) {
    const { width, height, ground, objects, foreground } = mapData;
    const weight = score / 100;

    // Learn adjacency from each layer
    if (ground) this._learnLayer(ground, width, height, weight);
    if (objects) this._learnLayer(objects, width, height, weight);
    if (foreground) this._learnLayer(foreground, width, height, weight);

    // Scan for composite patterns in the objects layer (most structures live here)
    if (objects) this._scanCompositePatterns(objects, width, height, score);

    // Scan for LARGE multi-layer composites (buildings+fences+paths as one unit)
    this._scanLargeComposites(mapData, score, 12);

    this.totalMapsLearned++;
  }

  /**
   * Learn tile relationships from a reference image by analyzing its tile data.
   * Reference images get higher weight since they're ground truth.
   * @param {Object} mapData - tile arrays extracted from the reference
   * @param {number} [weight=3] - weight multiplier for reference data
   */
  learnFromReference(mapData, weight = 3) {
    const { width, height, ground, objects, foreground } = mapData;

    // Reference weight: treat as if it were a map with score = weight * 100
    const effectiveWeight = weight;

    if (ground) this._learnLayer(ground, width, height, effectiveWeight);
    if (objects) this._learnLayer(objects, width, height, effectiveWeight);
    if (foreground) this._learnLayer(foreground, width, height, effectiveWeight);

    // Composites from reference get a high pseudo-score
    if (objects) this._scanCompositePatterns(objects, width, height, weight * 100);

    // Large multi-layer composites from reference (ground truth — scan up to 40x40)
    this._scanLargeComposites(mapData, weight * 100, 40);

    this.totalMapsLearned++;
  }

  /**
   * Get the probability that tileB appears in direction from tileA.
   * @param {number} tileA - source tile ID
   * @param {string} direction - 'north', 'south', 'east', 'west'
   * @param {number} tileB - target tile ID
   * @returns {number} probability 0-1
   */
  getAdjacencyProbability(tileA, direction, tileB) {
    const dirMap = this.adjacency[tileA];
    if (!dirMap) return 0;
    const neighborMap = dirMap[direction];
    if (!neighborMap) return 0;

    const countB = neighborMap[tileB] || 0;
    if (countB === 0) return 0;

    // Sum all observations in this direction for tileA
    let total = 0;
    for (const key of Object.keys(neighborMap)) {
      total += neighborMap[key];
    }
    return total > 0 ? countB / total : 0;
  }

  /**
   * Get all valid neighbors for a tile in a direction, sorted by probability desc.
   * @param {number} tileA - source tile
   * @param {string} direction
   * @returns {Array<{tile: number, probability: number}>}
   */
  getValidNeighbors(tileA, direction) {
    const dirMap = this.adjacency[tileA];
    if (!dirMap) return [];
    const neighborMap = dirMap[direction];
    if (!neighborMap) return [];

    // Sum total for probability calculation
    let total = 0;
    for (const key of Object.keys(neighborMap)) {
      total += neighborMap[key];
    }
    if (total === 0) return [];

    const results = [];
    for (const [tileStr, count] of Object.entries(neighborMap)) {
      results.push({
        tile: parseInt(tileStr, 10),
        probability: count / total
      });
    }

    // Sort descending by probability
    results.sort((a, b) => b.probability - a.probability);
    return results;
  }

  /**
   * Extract composite patterns (multi-tile structures) from observed data.
   * Finds recurring 2x2, 3x2, 3x3 etc patterns that appear multiple times.
   */
  extractComposites() {
    this.composites = {};

    for (const [id, data] of Object.entries(this._rawPatterns)) {
      if (data.count < 3) continue;

      const { tiles, count, totalScore } = data;
      const avgScore = totalScore / count;
      const flatTiles = tiles.flat();
      const rows = tiles.length;
      const cols = tiles[0].length;

      // Classify the pattern
      let type = 'unknown';

      // Building: 3x2 with roof tiles in row 0 and wall tiles in row 1
      if (rows === 2 && cols === 3) {
        const row0HasRoof = tiles[0].some(t => ROOF_TILES.has(t));
        const row1HasWall = tiles[1].some(t => WALL_TILES.has(t));
        if (row0HasRoof && row1HasWall) type = 'building';
      }

      // Tree: 2x2 with canopy in row 0 and trunk in row 1
      if (rows === 2 && cols === 2) {
        const row0HasCanopy = tiles[0].some(t => CANOPY_TILES.has(t));
        const row1HasTrunk = tiles[1].some(t => TRUNK_TILES.has(t));
        if (row0HasCanopy && row1HasTrunk) type = 'tree';
      }

      // Tree: 2x1 vertical with canopy on top, trunk on bottom
      if (rows === 2 && cols === 1) {
        if (CANOPY_TILES.has(tiles[0][0]) && TRUNK_TILES.has(tiles[1][0])) type = 'tree';
      }

      // Fence: 1xN horizontal with fence tiles
      if (rows === 1 || (rows === 2 && cols === 1)) {
        const allFence = flatTiles.every(t => FENCE_TILES.has(t));
        if (allFence) type = 'fence';
      }

      // Water: 3x3 with water tiles
      if (rows === 3 && cols === 3) {
        const waterCount = flatTiles.filter(t => WATER_TILES.has(t)).length;
        if (waterCount >= 5) type = 'water';
      }

      // Classify large multi-layer patterns
      if (data.multiLayer && data.width >= 4 && data.height >= 3) {
        const oFlat = data.multiLayer.objects.flat();
        const hasRoof = oFlat.some(t => ROOF_TILES.has(t));
        const hasFence = oFlat.some(t => FENCE_TILES.has(t));
        const hasWall = oFlat.some(t => WALL_TILES.has(t));
        if (hasRoof && hasWall && hasFence) type = 'building-block';
        else if (hasRoof && hasWall) type = 'building-large';
      }

      // Build a descriptive ID
      const sizeTag = (data.width && data.height) ? `${data.width}x${data.height}_` : '';
      const compositeId = `${type}_${sizeTag}${flatTiles.filter(t => t !== -1).join('_').slice(0, 60)}`;

      // Merge with existing if same ID (shouldn't happen since pattern IDs are unique,
      // but pattern IDs could differ from composite IDs)
      if (this.composites[compositeId]) {
        this.composites[compositeId].count += count;
        this.composites[compositeId].avgScore =
          (this.composites[compositeId].avgScore + avgScore) / 2;
      } else {
        this.composites[compositeId] = {
          tiles: tiles,
          count: count,
          avgScore: avgScore,
          type: type
        };
      }
    }
  }

  /**
   * Export learned relationships as WFC-compatible adjacency rules.
   * Only includes relationships observed more than minCount times.
   * @param {number} [minCount=2] - minimum observation count
   * @returns {{ tiles: Array, neighbors: Array }} - WFC SimpleTiledModel format
   */
  exportAsWFCRules(minCount = 2) {
    // Collect all unique tiles and their total occurrence counts
    const uniqueTileSet = new Set();
    for (const tileA of Object.keys(this.adjacency)) {
      uniqueTileSet.add(parseInt(tileA, 10));
      for (const dir of Object.keys(this.adjacency[tileA])) {
        for (const tileB of Object.keys(this.adjacency[tileA][dir])) {
          uniqueTileSet.add(parseInt(tileB, 10));
        }
      }
    }

    // Build tiles array with frequency weights
    const tiles = Array.from(uniqueTileSet).sort((a, b) => a - b).map(id => ({
      name: `tile_${id}`,
      symmetry: 'X', // no rotation (tiles are fixed orientation)
      weight: this._tileOccurrences[id] || 1
    }));

    // Build neighbor rules
    const neighbors = [];
    const seen = new Set(); // deduplicate

    for (const [tileAStr, dirs] of Object.entries(this.adjacency)) {
      for (const [dir, neighborMap] of Object.entries(dirs)) {
        for (const [tileBStr, count] of Object.entries(neighborMap)) {
          if (count < minCount) continue;

          const tileA = `tile_${tileAStr}`;
          const tileB = `tile_${tileBStr}`;

          if (dir === 'east') {
            const key = `h:${tileAStr}:${tileBStr}`;
            if (!seen.has(key)) {
              seen.add(key);
              neighbors.push({ left: tileA, right: tileB });
            }
          } else if (dir === 'south') {
            const key = `v:${tileAStr}:${tileBStr}`;
            if (!seen.has(key)) {
              seen.add(key);
              neighbors.push({ up: tileA, down: tileB });
            }
          }
          // north and west are covered by the symmetric south/east entries
          // from the other tile's perspective, so we skip them to avoid duplication
        }
      }
    }

    return { tiles, neighbors };
  }

  /**
   * Export learned relationships as a JSON knowledge base.
   * @returns {Object} serializable representation
   */
  exportKnowledge() {
    return {
      version: '1.0',
      totalMapsLearned: this.totalMapsLearned,
      totalTilesObserved: this.totalTilesObserved,
      adjacency: JSON.parse(JSON.stringify(this.adjacency)),
      composites: JSON.parse(JSON.stringify(this.composites)),
      tileOccurrences: JSON.parse(JSON.stringify(this._tileOccurrences)),
      rawPatterns: JSON.parse(JSON.stringify(this._rawPatterns))
    };
  }

  /**
   * Import previously learned knowledge.
   * @param {Object} knowledge - from exportKnowledge()
   */
  importKnowledge(knowledge) {
    if (!knowledge || !knowledge.version) {
      throw new Error('Invalid knowledge format: missing version');
    }

    this.totalMapsLearned = knowledge.totalMapsLearned || 0;
    this.totalTilesObserved = knowledge.totalTilesObserved || 0;
    this.adjacency = knowledge.adjacency || {};
    this.composites = knowledge.composites || {};
    this._tileOccurrences = knowledge.tileOccurrences || {};
    this._rawPatterns = knowledge.rawPatterns || {};
  }

  /**
   * Save knowledge to a file.
   * @param {string} filepath
   */
  saveToFile(filepath) {
    const knowledge = this.exportKnowledge();
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filepath, JSON.stringify(knowledge, null, 2), 'utf8');
  }

  /**
   * Load knowledge from a file.
   * @param {string} filepath
   */
  loadFromFile(filepath) {
    if (!fs.existsSync(filepath)) {
      throw new Error(`Knowledge file not found: ${filepath}`);
    }
    const raw = fs.readFileSync(filepath, 'utf8');
    const knowledge = JSON.parse(raw);
    this.importKnowledge(knowledge);
  }

  /**
   * Get summary statistics.
   * @returns {{ totalMaps: number, totalTiles: number, uniqueTiles: number, totalRelationships: number, topComposites: Array }}
   */
  getStats() {
    // Count unique tiles
    const uniqueTiles = new Set();
    let totalRelationships = 0;

    for (const [tileA, dirs] of Object.entries(this.adjacency)) {
      uniqueTiles.add(parseInt(tileA, 10));
      for (const [dir, neighborMap] of Object.entries(dirs)) {
        for (const [tileB, count] of Object.entries(neighborMap)) {
          uniqueTiles.add(parseInt(tileB, 10));
          totalRelationships++;
        }
      }
    }

    // Get top composites sorted by count
    const topComposites = Object.entries(this.composites)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalMaps: this.totalMapsLearned,
      totalTiles: this.totalTilesObserved,
      uniqueTiles: uniqueTiles.size,
      totalRelationships,
      topComposites
    };
  }
}

module.exports = { TileRelationshipLearner };

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------
if (require.main === module) {
  const learner = new TileRelationshipLearner();

  // Create a simple test map
  const testMap = {
    width: 4, height: 3,
    ground:     [1, 1, 40, 1,   1, 2, 40, 2,   1, 1, 1, 1],
    objects:    [-1,-1,-1,-1,  -1,63,67,65,  -1,72,74,73],
    foreground: [-1,-1,-1,-1,  -1,-1,-1,-1,  -1,-1,-1,-1]
  };

  // Learn from it
  learner.learnFromMap(testMap, 80);
  learner.learnFromMap(testMap, 90); // learn twice to build counts

  console.log('Stats:', learner.getStats());

  // Check what tile 63 (roof-left) can have to its right
  const neighbors = learner.getValidNeighbors(63, 'east');
  console.log('Tile 63 (roof-left) east neighbors:', neighbors);

  // Check what's below tile 63
  const below = learner.getValidNeighbors(63, 'south');
  console.log('Tile 63 (roof-left) south neighbors:', below);

  // Extract composites
  learner.extractComposites();

  // Export as WFC rules
  const wfcRules = learner.exportAsWFCRules(1);
  console.log('WFC tiles:', wfcRules.tiles.length);
  console.log('WFC neighbor rules:', wfcRules.neighbors.length);

  // Save and reload
  const savePath = path.join(__dirname, 'learned-tile-knowledge.json');
  learner.saveToFile(savePath);
  console.log('Saved to', savePath);

  const learner2 = new TileRelationshipLearner();
  learner2.loadFromFile(savePath);
  console.log('Reloaded stats:', learner2.getStats());
}
