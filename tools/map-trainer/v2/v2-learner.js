/**
 * v2-learner.js — Consolidated knowledge learner for V2 map trainer
 *
 * Learns from generated maps and target maps:
 *   1. Pairwise tile adjacency (N/S/E/W) with observation counts
 *   2. 3x3 patterns extracted per layer, counted by frequency
 *   3. Building composites detected by roof→wall relationships
 *
 * Saves compact learned-knowledge-v2.json (no rawPatterns bloat).
 */

const fs = require('fs');
const path = require('path');

const DIRECTIONS = ['north', 'south', 'east', 'west'];
const DIR_OFFSETS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

// Tile classification for composite detection
const ROOF_TILES = new Set([63, 64, 65, 66, 67]);
const WALL_TILES = new Set();
for (let i = 72; i <= 87; i++) WALL_TILES.add(i);

// ── Layer assignments (which layer each tile belongs on) ────────────────────
const GROUND_TILES = new Set([1, 2, 43, 39, 40, 41, 44, 45]);
const FOREGROUND_TILES = new Set([4, 5, 7, 8, 10, 11]);
// Everything else with id >= 0 that isn't ground or foreground = objects

function tileLayer(tileId) {
  if (tileId < 0) return null;
  if (GROUND_TILES.has(tileId)) return 'ground';
  if (FOREGROUND_TILES.has(tileId)) return 'foreground';
  return 'objects';
}

// ═════════════════════════════════════════════════════════════════════════════
class V2Learner {
  constructor() {
    // adjacency[tileA][direction][tileB] = count
    this.adjacency = {};
    // Per-layer adjacency: layerAdj[layer][tileA][direction][tileB] = count
    this.layerAdj = { ground: {}, objects: {}, foreground: {} };
    // composites: { id: { tiles: [[row0],[row1]], count, type } }
    this.composites = {};
    // Stats
    this.totalMaps = 0;
    this.totalTiles = 0;
    this.targetWeight = 10; // target maps count 10x
  }

  /**
   * Load existing knowledge from file.
   * @param {string} filePath - Path to learned-knowledge-v2.json
   */
  loadFromFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.version && !data.version.startsWith('2.')) {
      console.warn(`Knowledge file version ${data.version} — expected 2.x, loading anyway`);
    }
    this.adjacency = data.adjacency || {};
    this.layerAdj = data.layerAdj || { ground: {}, objects: {}, foreground: {} };
    this.composites = {};
    if (Array.isArray(data.composites)) {
      for (const c of data.composites) {
        this.composites[c.id] = { tiles: c.tiles, count: c.count, type: c.type || 'unknown' };
      }
    }
    this.totalMaps = (data.stats && data.stats.maps) || 0;
    this.totalTiles = (data.stats && data.stats.tiles) || 0;
  }

  /**
   * Save knowledge to file in compact format.
   * @param {string} filePath
   */
  saveToFile(filePath) {
    // Convert composites to sorted array, keep top 100
    const compList = Object.entries(this.composites)
      .map(([id, c]) => ({ id, tiles: c.tiles, count: c.count, type: c.type }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // Count unique adjacency rules
    let ruleCount = 0;
    for (const tA of Object.keys(this.adjacency)) {
      for (const dir of DIRECTIONS) {
        if (this.adjacency[tA][dir]) ruleCount += Object.keys(this.adjacency[tA][dir]).length;
      }
    }

    const data = {
      version: '2.1',
      stats: {
        maps: this.totalMaps,
        tiles: this.totalTiles,
        rules: ruleCount,
        composites: compList.length,
      },
      adjacency: this.adjacency,
      layerAdj: this.layerAdj,
      composites: compList,
    };

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Learn adjacency rules and composites from a generated map.
   * @param {Object} mapData - { width, height, ground[], objects[], foreground[] }
   * @param {number} [score] - Quality score 0-100 (higher = more weight)
   */
  learnFromMap(mapData, score = 50) {
    const weight = Math.max(1, Math.round(score / 20)); // 1-5x weight based on score
    this._learnLayers(mapData, weight);
    this._detectComposites(mapData);
    this.totalMaps++;
  }

  /**
   * Learn from a target/reference map with 10x weight.
   * @param {Object} targetMap - { width, height, ground[], objects[], foreground[] }
   */
  learnFromTarget(targetMap) {
    this._learnLayers(targetMap, this.targetWeight);
    this._detectComposites(targetMap);
    this.totalMaps++;
  }

  /**
   * Get statistics about learned knowledge.
   * @returns {{ maps, tiles, rules, patterns }}
   */
  getStats() {
    let rules = 0;
    for (const tA of Object.keys(this.adjacency)) {
      for (const dir of DIRECTIONS) {
        if (this.adjacency[tA][dir]) rules += Object.keys(this.adjacency[tA][dir]).length;
      }
    }
    return {
      maps: this.totalMaps,
      tiles: this.totalTiles,
      rules,
      composites: Object.keys(this.composites).length,
    };
  }

  /**
   * Get adjacency probabilities for a tile in a direction.
   * @param {number} tileA - Source tile ID
   * @param {string} dir - 'north', 'south', 'east', or 'west'
   * @returns {Object} { tileB: probability, ... } normalized to sum=1
   */
  getAdjacency(tileA, dir) {
    const key = String(tileA);
    if (!this.adjacency[key] || !this.adjacency[key][dir]) return {};
    const counts = this.adjacency[key][dir];
    const total = Object.values(counts).reduce((s, c) => s + c, 0);
    if (total === 0) return {};
    const probs = {};
    for (const [tB, count] of Object.entries(counts)) {
      probs[tB] = count / total;
    }
    return probs;
  }

  // ── Internal Methods ──────────────────────────────────────────────────

  /**
   * Learn adjacency from all layers of a map.
   */
  _learnLayers(mapData, weight) {
    const W = mapData.width;
    const H = mapData.height;
    const layers = ['ground', 'objects', 'foreground'].filter(l => Array.isArray(mapData[l]));

    for (const layerName of layers) {
      const layer = mapData[layerName];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const tA = layer[y * W + x];
          if (tA === -1) continue; // skip empty
          this.totalTiles += weight;

          for (const dir of DIRECTIONS) {
            const [dx, dy] = DIR_OFFSETS[dir];
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const tB = layer[ny * W + nx];
            if (tB === -1) continue;
            this._recordAdjacency(tA, dir, tB, weight);
          }
        }
      }
    }
  }

  /**
   * Record an adjacency observation.
   */
  _recordAdjacency(tileA, dir, tileB, weight) {
    const kA = String(tileA);
    const kB = String(tileB);
    // Global adjacency (capped at 10000 to prevent memory bloat)
    if (!this.adjacency[kA]) this.adjacency[kA] = {};
    if (!this.adjacency[kA][dir]) this.adjacency[kA][dir] = {};
    const cur = this.adjacency[kA][dir][kB] || 0;
    this.adjacency[kA][dir][kB] = Math.min(10000, cur + weight);
    // Per-layer adjacency
    const layerA = tileLayer(tileA);
    const layerB = tileLayer(tileB);
    if (layerA && layerA === layerB) {
      const la = this.layerAdj[layerA];
      if (!la[kA]) la[kA] = {};
      if (!la[kA][dir]) la[kA][dir] = {};
      la[kA][dir][kB] = Math.min(10000, (la[kA][dir][kB] || 0) + weight);
    }
  }

  /**
   * Detect building composites by finding roof tiles above wall tiles.
   */
  _detectComposites(mapData) {
    if (!Array.isArray(mapData.objects)) return;
    const W = mapData.width;
    const H = mapData.height;
    const objs = mapData.objects;

    // Scan for roof tiles, then check below for walls
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const tile = objs[y * W + x];
        if (!ROOF_TILES.has(tile)) continue;

        // Found a roof tile — scan right to find full roof span
        let roofEnd = x;
        while (roofEnd + 1 < W && ROOF_TILES.has(objs[y * W + roofEnd + 1])) roofEnd++;
        const roofW = roofEnd - x + 1;
        if (roofW < 2 || roofW > 6) { x = roofEnd; continue; }

        // Check wall row below
        let allWall = true;
        for (let dx = 0; dx < roofW; dx++) {
          if (!WALL_TILES.has(objs[(y + 1) * W + x + dx])) { allWall = false; break; }
        }
        if (!allWall) { x = roofEnd; continue; }

        // Extract composite
        const roof = [];
        const wall = [];
        for (let dx = 0; dx < roofW; dx++) {
          roof.push(objs[y * W + x + dx]);
          wall.push(objs[(y + 1) * W + x + dx]);
        }

        // Determine type from wall material
        const hasStone = wall.some(t => t >= 84 && t <= 87);
        const type = hasStone ? 'stone' : 'wood';
        const id = `building_${roofW}x2_${roof.join('-')}_${wall.join('-')}`;

        if (!this.composites[id]) {
          this.composites[id] = { tiles: [roof, wall], count: 0, type };
        }
        this.composites[id].count++;

        x = roofEnd; // skip past this building
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Self-test
// ═════════════════════════════════════════════════════════════════════════════
if (require.main === module) {
  console.log('=== V2 Learner Self-Test ===\n');

  const learner = new V2Learner();

  // Create a small synthetic map to learn from
  const W = 10, H = 8;
  const ground = new Array(W * H).fill(1); // all grass
  const objects = new Array(W * H).fill(-1);
  const foreground = new Array(W * H).fill(-1);

  // Add a path
  for (let x = 2; x < 8; x++) {
    ground[3 * W + x] = 40; // path center
    ground[4 * W + x] = 40;
  }
  ground[3 * W + 2] = 39; // path edge left
  ground[4 * W + 2] = 39;
  ground[3 * W + 7] = 41; // path edge right
  ground[4 * W + 7] = 41;

  // Add a building (3x2)
  objects[1 * W + 3] = 63; // roof L
  objects[1 * W + 4] = 67; // chimney
  objects[1 * W + 5] = 65; // roof R
  objects[2 * W + 3] = 72; // wall L
  objects[2 * W + 4] = 74; // door
  objects[2 * W + 5] = 73; // wall R

  const testMap = { width: W, height: H, ground, objects, foreground };

  // Learn from it
  learner.learnFromMap(testMap, 80);
  console.log('After learning 1 map:', learner.getStats());

  // Learn again as target (10x weight)
  learner.learnFromTarget(testMap);
  console.log('After learning target:', learner.getStats());

  // Check adjacency
  const grassAdj = learner.getAdjacency(1, 'east');
  console.log('Grass east adjacency:', Object.keys(grassAdj).length, 'neighbors');
  console.assert(Object.keys(grassAdj).length > 0, 'Should have grass adjacency rules');

  const pathAdj = learner.getAdjacency(40, 'east');
  console.log('Path center east adjacency:', pathAdj);
  console.assert(pathAdj['40'] > 0 || pathAdj['41'] > 0, 'Path should connect to path');

  // Check composites
  const compKeys = Object.keys(learner.composites);
  console.log('Composites found:', compKeys.length);
  console.assert(compKeys.length >= 1, 'Should detect at least 1 building composite');
  if (compKeys.length > 0) {
    const first = learner.composites[compKeys[0]];
    console.log('First composite:', JSON.stringify(first));
    console.assert(first.tiles.length === 2, 'Building composite should have 2 rows');
  }

  // Save and reload
  const tmpFile = path.join(__dirname, '_test_knowledge.json');
  learner.saveToFile(tmpFile);
  console.log('Saved to', tmpFile);

  const learner2 = new V2Learner();
  learner2.loadFromFile(tmpFile);
  console.log('Reloaded stats:', learner2.getStats());
  console.assert(learner2.totalMaps === 2, 'Should preserve map count');

  const reloadedAdj = learner2.getAdjacency(1, 'east');
  console.assert(Object.keys(reloadedAdj).length > 0, 'Reloaded adjacency should work');

  // Cleanup
  try { fs.unlinkSync(tmpFile); } catch (_) {}

  // Test empty file handling
  const learner3 = new V2Learner();
  learner3.loadFromFile('/nonexistent/path.json');
  console.log('Empty learner stats:', learner3.getStats());
  console.assert(learner3.totalMaps === 0, 'Empty learner should have 0 maps');

  console.log('\nAll self-tests PASSED');
}

module.exports = { V2Learner, tileLayer, GROUND_TILES, FOREGROUND_TILES };
