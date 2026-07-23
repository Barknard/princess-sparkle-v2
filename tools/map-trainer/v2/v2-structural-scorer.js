/**
 * v2-structural-scorer.js — Local structural similarity scorer
 *
 * Compares a generated map against a target map using tile data directly.
 * No API calls, no image rendering — pure structural analysis.
 * Fast enough to run every generation.
 *
 * Scoring dimensions (0-100 total):
 *   Building Match:    0-25  (count, sizes, positions)
 *   Path Match:        0-20  (network shape, coverage)
 *   Vegetation Match:  0-20  (density per quadrant, tree types)
 *   Ground Match:      0-15  (tile distribution per region)
 *   Composition:       0-20  (density balance, open space, edge usage)
 */

"use strict";

// Tile classification using boolean lookup arrays (faster than Set.has() in hot loops)
// Max tile ID we need to check — 256 covers all tiles including custom ones
const MAX_TILE = 256;
function makeLookup(ids) {
  const arr = new Uint8Array(MAX_TILE);
  for (const id of ids) if (id >= 0 && id < MAX_TILE) arr[id] = 1;
  return arr;
}
const ROOF_IDS = [48,49,50,51,52,53,54,55,60,61,62,63,64,65,66,67];
const WALL_IDS = [72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91];
const DOOR_IDS = [74,78,85,86,87,89,90,91,111,112,113,114,123,124];
const BUILDING_IDS = [...ROOF_IDS, ...WALL_IDS, ...DOOR_IDS];
const IS_BUILDING = makeLookup(BUILDING_IDS);
const IS_PATH = makeLookup([43,25,39,40,41,44,45,13,14,24,36,37,38]);
const IS_GRASS = makeLookup([0,1,2]);
const IS_FG_VEG = makeLookup([3,4,6,7,15,16,17,18,19,20,27,28,29,31,32,34]);
const IS_FENCE = makeLookup([44,45,46,47,56,58,59,68,69,70,71,80,81,82]);
const IS_CASTLE = makeLookup([96,97,98,100,102,108,109,110,111,112,120,121,122,123,124,204,205]);
const IS_WATER = makeLookup([109,110,111,112,113,120,121,122,123]);
// Keep Sets only for _findClusters which needs them for the tileSet parameter
const BUILDING_TILES = new Set(BUILDING_IDS);
const CASTLE_TILES = new Set([96,97,98,100,102,108,109,110,111,112,120,121,122,123,124,204,205]);

class StructuralScorer {
  constructor(targetMap) {
    this.target = targetMap;
    this.W = targetMap.width;
    this.H = targetMap.height;

    // Pre-compute zone boundaries once (used by every _analyze call)
    this.GRID = 4;
    this.zoneW = Math.ceil(this.W / this.GRID);
    this.zoneH = Math.ceil(this.H / this.GRID);
    this._zoneBounds = [];
    for (let zy = 0; zy < this.GRID; zy++) {
      for (let zx = 0; zx < this.GRID; zx++) {
        this._zoneBounds.push({
          x0: zx * this.zoneW,
          y0: zy * this.zoneH,
          x1: Math.min((zx + 1) * this.zoneW, this.W),
          y1: Math.min((zy + 1) * this.zoneH, this.H)
        });
      }
    }

    // Reusable analysis object to reduce GC pressure
    this._reusableAnalysis = this._createAnalysis();

    // Pre-analyze target (this one is kept permanently)
    this._targetAnalysis = this._analyze(targetMap, false);
  }

  /**
   * Score a generated map against the target.
   * @param {Object} map - { width, height, ground[], objects[], foreground[] }
   * @returns {{ total, buildings, paths, vegetation, ground, composition, details }}
   */
  score(map) {
    const gen = this._analyze(map, true);
    const tgt = this._targetAnalysis;

    const buildings = this._scoreBuildingMatch(gen, tgt);
    const paths = this._scorePathMatch(gen, tgt);
    const vegetation = this._scoreVegetationMatch(gen, tgt);
    const ground = this._scoreGroundMatch(gen, tgt);
    const composition = this._scoreComposition(gen, tgt);

    const total = buildings.score + paths.score + vegetation.score + ground.score + composition.score;

    return {
      total,
      buildings: buildings.score,
      paths: paths.score,
      vegetation: vegetation.score,
      ground: ground.score,
      composition: composition.score,
      details: { buildings, paths, vegetation, ground, composition }
    };
  }

  // ── Analysis: extract structural features from a map ────────────────────

  _createAnalysis() {
    const numZones = this.GRID * this.GRID;
    const zones = [];
    for (let z = 0; z < numZones; z++) {
      zones.push({ buildings: 0, paths: 0, trees: 0, fg: 0, grass: 0, empty: 0, fence: 0, castle: 0, water: 0, total: 0 });
    }
    return {
      zones, buildingClusters: [], castleClusters: [],
      pathCount: 0, pathSpreadX: 0, pathSpreadY: 0,
      fgCount: 0, fgDensity: 0,
      groundFreq: {}, objectFreq: {}, fgFreq: {},
      edgeObjects: 0, interiorObjects: 0,
      W: this.W, H: this.H
    };
  }

  _analyze(map, reuse) {
    const W = map.width, H = map.height;
    const ground = map.ground || [];
    const objects = map.objects || [];
    const foreground = map.foreground || [];
    const size = W * H;

    // Reuse or create analysis object
    const a = reuse ? this._reusableAnalysis : this._createAnalysis();

    // Reset zones using pre-computed boundaries
    for (let z = 0; z < this._zoneBounds.length; z++) {
      const zone = a.zones[z];
      zone.buildings = 0; zone.paths = 0; zone.trees = 0; zone.fg = 0;
      zone.grass = 0; zone.empty = 0; zone.fence = 0; zone.castle = 0; zone.water = 0; zone.total = 0;
    }

    // Single pass: zone stats + freq + edge/interior + path spread + fg count
    // Reset freq objects
    const groundFreq = a.groundFreq; for (const k in groundFreq) delete groundFreq[k];
    const objectFreq = a.objectFreq; for (const k in objectFreq) delete objectFreq[k];
    const fgFreq = a.fgFreq; for (const k in fgFreq) delete fgFreq[k];

    let fgCount = 0, pathCount = 0;
    let edgeObjects = 0, interiorObjects = 0;
    let pathMinX = W, pathMaxX = 0, pathMinY = H, pathMaxY = 0;
    const edgeDepth = 3;

    for (let z = 0; z < this._zoneBounds.length; z++) {
      const b = this._zoneBounds[z];
      const zone = a.zones[z];
      for (let y = b.y0; y < b.y1; y++) {
        for (let x = b.x0; x < b.x1; x++) {
          const i = y * W + x;
          const g = ground[i] || 0;
          const o = objects[i] !== undefined ? objects[i] : -1;
          const f = foreground[i] !== undefined ? foreground[i] : -1;
          zone.total++;

          if (g >= 0 && g < MAX_TILE && IS_GRASS[g]) zone.grass++;
          if (g >= 0 && g < MAX_TILE && IS_PATH[g]) { zone.paths++; pathCount++; if (x < pathMinX) pathMinX = x; if (x > pathMaxX) pathMaxX = x; if (y < pathMinY) pathMinY = y; if (y > pathMaxY) pathMaxY = y; }
          if (o >= 0 && o < MAX_TILE) {
            if (IS_BUILDING[o]) zone.buildings++;
            if (IS_FENCE[o]) zone.fence++;
            if (IS_CASTLE[o]) zone.castle++;
            if (IS_WATER[o]) zone.water++;
            objectFreq[o] = (objectFreq[o] || 0) + 1;
          }
          if (f >= 0 && f < MAX_TILE && IS_FG_VEG[f]) zone.fg++;
          if (o === -1 && f === -1) zone.empty++;
          if (f >= 0) { fgCount++; fgFreq[f] = (fgFreq[f] || 0) + 1; }
          if (g >= 0) groundFreq[g] = (groundFreq[g] || 0) + 1;

          // Edge vs interior
          if (o >= 0 || f >= 0) {
            if (x < edgeDepth || x >= W - edgeDepth || y < edgeDepth || y >= H - edgeDepth) edgeObjects++;
            else interiorObjects++;
          }
        }
      }
    }

    // Building clusters: find connected groups of building tiles
    a.buildingClusters = this._findClusters(objects, W, H, BUILDING_TILES);
    a.castleClusters = this._findClusters(objects, W, H, CASTLE_TILES);

    // Path spread
    a.pathCount = pathCount;
    a.pathSpreadX = pathCount > 0 ? (pathMaxX - pathMinX) / W : 0;
    a.pathSpreadY = pathCount > 0 ? (pathMaxY - pathMinY) / H : 0;

    a.fgCount = fgCount;
    a.fgDensity = fgCount / size;
    a.edgeObjects = edgeObjects;
    a.interiorObjects = interiorObjects;
    a.W = W;
    a.H = H;

    return a;
  }

  _findClusters(layer, W, H, tileSet) {
    const size = W * H;
    // Use typed array for visited instead of Set (much faster for dense grids)
    if (!this._visitedBuf || this._visitedBuf.length < size) {
      this._visitedBuf = new Uint8Array(size);
    }
    const visited = this._visitedBuf;
    visited.fill(0);
    const clusters = [];
    // Reuse queue array to avoid repeated allocation
    const queue = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (visited[i] || !tileSet.has(layer[i])) continue;
        // Flood fill
        let cellCount = 0;
        let minX = W, maxX = 0, minY = H, maxY = 0;
        queue.length = 0;
        queue.push(x, y);
        while (queue.length) {
          const py = queue.pop();
          const px = queue.pop();
          if (px < 0 || px >= W || py < 0 || py >= H) continue;
          const pi = py * W + px;
          if (visited[pi]) continue;
          if (!tileSet.has(layer[pi])) continue;
          visited[pi] = 1;
          cellCount++;
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
          queue.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
        }
        if (cellCount >= 2) {
          clusters.push({
            cx: (minX + maxX) / 2 / W,
            cy: (minY + maxY) / 2 / H,
            w: maxX - minX + 1,
            h: maxY - minY + 1,
            size: cellCount
          });
        }
      }
    }
    return clusters;
  }

  // ── Scoring functions ───────────────────────────────────────────────────

  _scoreBuildingMatch(gen, tgt) {
    let score = 0;
    const maxScore = 25;

    // 1. Building count similarity (0-8)
    const tgtCount = tgt.buildingClusters.length;
    const genCount = gen.buildingClusters.length;
    const countRatio = tgtCount > 0 ? Math.min(genCount, tgtCount) / Math.max(genCount, tgtCount) : (genCount === 0 ? 1 : 0);
    score += countRatio * 8;

    // 2. Building size distribution (0-7)
    // Compare sorted size arrays
    const tgtSizes = tgt.buildingClusters.map(c => c.size).sort((a, b) => b - a);
    const genSizes = gen.buildingClusters.map(c => c.size).sort((a, b) => b - a);
    const maxLen = Math.max(tgtSizes.length, genSizes.length);
    if (maxLen > 0) {
      let sizeMatch = 0;
      for (let i = 0; i < maxLen; i++) {
        const ts = tgtSizes[i] || 0;
        const gs = genSizes[i] || 0;
        if (ts > 0 || gs > 0) {
          sizeMatch += 1 - Math.abs(ts - gs) / Math.max(ts, gs, 1);
        }
      }
      score += (sizeMatch / maxLen) * 7;
    }

    // 3. Position match — are buildings in similar quadrants? (0-7)
    // Compare per-zone building density
    let zoneBldgMatch = 0;
    for (let z = 0; z < gen.zones.length && z < tgt.zones.length; z++) {
      const tgtD = tgt.zones[z].buildings / Math.max(tgt.zones[z].total, 1);
      const genD = gen.zones[z].buildings / Math.max(gen.zones[z].total, 1);
      zoneBldgMatch += 1 - Math.min(1, Math.abs(tgtD - genD) * 10);
    }
    const numZones = Math.min(gen.zones.length, tgt.zones.length);
    score += (zoneBldgMatch / numZones) * 7;

    // 4. Castle presence (0-3)
    const tgtHasCastle = tgt.castleClusters.length > 0;
    const genHasCastle = gen.castleClusters.length > 0;
    if (tgtHasCastle === genHasCastle) score += 2;
    if (tgtHasCastle && genHasCastle) {
      // Castle in similar position?
      const tc = tgt.castleClusters[0];
      const gc = gen.castleClusters[0];
      const posDist = Math.sqrt((tc.cx - gc.cx) ** 2 + (tc.cy - gc.cy) ** 2);
      score += Math.max(0, 1 - posDist) * 1;
    }

    return { score: Math.min(maxScore, score), countRatio, tgtCount, genCount };
  }

  _scorePathMatch(gen, tgt) {
    let score = 0;
    const maxScore = 20;

    // 1. Path coverage ratio (0-8)
    const tgtCov = tgt.pathCount / (tgt.W * tgt.H);
    const genCov = gen.pathCount / (gen.W * gen.H);
    const covRatio = Math.max(tgtCov, genCov) > 0 ? 1 - Math.abs(tgtCov - genCov) / Math.max(tgtCov, genCov, 0.01) : 1;
    score += covRatio * 8;

    // 2. Path spread (0-6) — how far paths extend across the map
    const spreadMatchX = 1 - Math.abs(tgt.pathSpreadX - gen.pathSpreadX);
    const spreadMatchY = 1 - Math.abs(tgt.pathSpreadY - gen.pathSpreadY);
    score += ((spreadMatchX + spreadMatchY) / 2) * 6;

    // 3. Per-zone path density match (0-6)
    let zonePathMatch = 0;
    for (let z = 0; z < gen.zones.length && z < tgt.zones.length; z++) {
      const tgtD = tgt.zones[z].paths / Math.max(tgt.zones[z].total, 1);
      const genD = gen.zones[z].paths / Math.max(gen.zones[z].total, 1);
      zonePathMatch += 1 - Math.min(1, Math.abs(tgtD - genD) * 15);
    }
    const numZones = Math.min(gen.zones.length, tgt.zones.length);
    score += (zonePathMatch / numZones) * 6;

    return { score: Math.min(maxScore, score), tgtCov, genCov };
  }

  _scoreVegetationMatch(gen, tgt) {
    let score = 0;
    const maxScore = 20;

    // 1. Overall FG density match (0-6)
    const densDiff = Math.abs(tgt.fgDensity - gen.fgDensity);
    score += Math.max(0, 1 - densDiff * 8) * 6;

    // 2. Per-zone FG density match (0-8)
    let zoneFgMatch = 0;
    for (let z = 0; z < gen.zones.length && z < tgt.zones.length; z++) {
      const tgtD = tgt.zones[z].fg / Math.max(tgt.zones[z].total, 1);
      const genD = gen.zones[z].fg / Math.max(gen.zones[z].total, 1);
      zoneFgMatch += 1 - Math.min(1, Math.abs(tgtD - genD) * 10);
    }
    const numZones = Math.min(gen.zones.length, tgt.zones.length);
    score += (zoneFgMatch / numZones) * 8;

    // 3. FG tile type distribution match (0-6)
    // Compare which tile IDs appear and their relative frequencies
    const tgtTotal = Object.values(tgt.fgFreq).reduce((a, b) => a + b, 0) || 1;
    const genTotal = Object.values(gen.fgFreq).reduce((a, b) => a + b, 0) || 1;
    const allFgTiles = new Set([...Object.keys(tgt.fgFreq), ...Object.keys(gen.fgFreq)]);
    let freqMatch = 0;
    for (const t of allFgTiles) {
      const tgtF = (tgt.fgFreq[t] || 0) / tgtTotal;
      const genF = (gen.fgFreq[t] || 0) / genTotal;
      freqMatch += 1 - Math.min(1, Math.abs(tgtF - genF) * 5);
    }
    score += (allFgTiles.size > 0 ? freqMatch / allFgTiles.size : 0) * 6;

    return { score: Math.min(maxScore, score) };
  }

  _scoreGroundMatch(gen, tgt) {
    let score = 0;
    const maxScore = 15;

    // 1. Ground tile frequency distribution (JSD-like) (0-8)
    const tgtTotal = Object.values(tgt.groundFreq).reduce((a, b) => a + b, 0) || 1;
    const genTotal = Object.values(gen.groundFreq).reduce((a, b) => a + b, 0) || 1;
    const allTiles = new Set([...Object.keys(tgt.groundFreq), ...Object.keys(gen.groundFreq)]);
    let freqMatch = 0;
    for (const t of allTiles) {
      const tgtF = (tgt.groundFreq[t] || 0) / tgtTotal;
      const genF = (gen.groundFreq[t] || 0) / genTotal;
      freqMatch += 1 - Math.min(1, Math.abs(tgtF - genF) * 3);
    }
    score += (allTiles.size > 0 ? freqMatch / allTiles.size : 0) * 8;

    // 2. Per-zone ground character match (0-7)
    let zoneGroundMatch = 0;
    for (let z = 0; z < gen.zones.length && z < tgt.zones.length; z++) {
      const tgtGrass = tgt.zones[z].grass / Math.max(tgt.zones[z].total, 1);
      const genGrass = gen.zones[z].grass / Math.max(gen.zones[z].total, 1);
      zoneGroundMatch += 1 - Math.min(1, Math.abs(tgtGrass - genGrass) * 5);
    }
    const numZones = Math.min(gen.zones.length, tgt.zones.length);
    score += (zoneGroundMatch / numZones) * 7;

    return { score: Math.min(maxScore, score) };
  }

  _scoreComposition(gen, tgt) {
    let score = 0;
    const maxScore = 20;

    // 1. Edge vs interior balance (0-7)
    const tgtEdgeRatio = tgt.edgeObjects / Math.max(tgt.edgeObjects + tgt.interiorObjects, 1);
    const genEdgeRatio = gen.edgeObjects / Math.max(gen.edgeObjects + gen.interiorObjects, 1);
    score += Math.max(0, 1 - Math.abs(tgtEdgeRatio - genEdgeRatio) * 3) * 7;

    // 2. Open space distribution (0-7)
    let zoneEmptyMatch = 0;
    for (let z = 0; z < gen.zones.length && z < tgt.zones.length; z++) {
      const tgtE = tgt.zones[z].empty / Math.max(tgt.zones[z].total, 1);
      const genE = gen.zones[z].empty / Math.max(gen.zones[z].total, 1);
      zoneEmptyMatch += 1 - Math.min(1, Math.abs(tgtE - genE) * 5);
    }
    const numZones = Math.min(gen.zones.length, tgt.zones.length);
    score += (zoneEmptyMatch / numZones) * 7;

    // 3. Overall object tile distribution (0-6)
    const tgtObjTotal = Object.values(tgt.objectFreq).reduce((a, b) => a + b, 0) || 1;
    const genObjTotal = Object.values(gen.objectFreq).reduce((a, b) => a + b, 0) || 1;
    const allObj = new Set([...Object.keys(tgt.objectFreq), ...Object.keys(gen.objectFreq)]);
    let objMatch = 0;
    for (const t of allObj) {
      const tgtF = (tgt.objectFreq[t] || 0) / tgtObjTotal;
      const genF = (gen.objectFreq[t] || 0) / genObjTotal;
      objMatch += 1 - Math.min(1, Math.abs(tgtF - genF) * 3);
    }
    score += (allObj.size > 0 ? objMatch / allObj.size : 0) * 6;

    return { score: Math.min(maxScore, score) };
  }
}

module.exports = { StructuralScorer };
