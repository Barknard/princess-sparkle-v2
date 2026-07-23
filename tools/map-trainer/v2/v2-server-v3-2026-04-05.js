#!/usr/bin/env node
/**
 * v2-server.js — V2 Map Trainer: Express server + auto-train evolution loop
 *
 * Combines the old server.js + auto-train.js into one self-contained process.
 * Starts training immediately on launch — dashboard is pure monitoring.
 *
 * Usage:
 *   node tools/map-trainer/v2/v2-server.js [--target=99 --max-gens=5000 --pop=30 --port=3456]
 */

"use strict";

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const sharp = require('sharp');

// ── Paths ────────────────────────────────────────────────────────────────────
const V2_DIR = __dirname;
const TRAINER_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(TRAINER_DIR, '..', '..');
const TILESET_PATH = path.join(PROJECT_ROOT, 'sprites', 'town', 'tilemap_packed.png');
const KNOWLEDGE_PATH = path.join(TRAINER_DIR, 'learned-tile-knowledge.json');
const RESULTS_DIR = path.join(V2_DIR, 'results');
const DASHBOARD_PATH = path.join(V2_DIR, 'v2-dashboard.html');
const REFERENCE_PATH = path.join(TRAINER_DIR, 'reference-images', 'kenney-tiny-town-sample.png');
const TARGET_LEVEL_PATH = path.join(PROJECT_ROOT, 'game', 'levels', 'level-sparkle-village.js');

if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

// ── Parse CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let TARGET_SCORE = 99;
let MAX_GENS = 50000;       // effectively unlimited — stop condition is error tolerance
let ERROR_TOLERANCE = 0;    // stop when errors reach zero (perfection)
let POP_SIZE = 30;
let PORT = 3456;

for (const arg of args) {
  if (arg.startsWith('--target='))   TARGET_SCORE = parseFloat(arg.split('=')[1]);
  if (arg.startsWith('--max-gens=')) MAX_GENS = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--errors='))   ERROR_TOLERANCE = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--pop='))      POP_SIZE = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--port='))     PORT = parseInt(arg.split('=')[1]);
}

// ── Load existing modules from parent trainer dir ────────────────────────────
const { GeneticEvolver } = require(path.join(TRAINER_DIR, 'genetic-evolver'));
const { V2Engine } = require(path.join(V2_DIR, 'v2-engine'));
const { V2Scorer } = require(path.join(V2_DIR, 'v2-scorer'));
// Create scorer with painted map as reference
let v2scorer = null;
function auditMap(map) {
  if (!v2scorer) {
    const pm = require('fs').existsSync(path.join(V2_DIR, 'painted-map.json'))
      ? JSON.parse(require('fs').readFileSync(path.join(V2_DIR, 'painted-map.json'), 'utf8'))
      : null;
    v2scorer = new V2Scorer(pm);
  }
  return v2scorer.score(map);
}
const { loadTargetMap, scoreTileMatch, combinedScore } = require(path.join(TRAINER_DIR, 'tile-match-scorer'));
const { TileRelationshipLearner } = require(path.join(TRAINER_DIR, 'tile-relationship-learner'));

// ── Inline Tile Renderer (Sharp-based, self-contained) ──────────────────────
const TILE_SIZE = 16;
const TILESET_COLS = 12;
const TILESET_ROWS = 11;
const MAX_TILE_ID = TILESET_COLS * TILESET_ROWS - 1; // 131

let _tilesetBuffer = null;
let _tilesetInfo = null;
const _tileCache = new Map();

async function initTileset() {
  if (_tilesetBuffer) return;
  if (!fs.existsSync(TILESET_PATH)) {
    throw new Error(`Tileset not found: ${TILESET_PATH}`);
  }
  const img = sharp(TILESET_PATH).ensureAlpha();
  const meta = await img.metadata();
  _tilesetBuffer = await img.raw().toBuffer();
  _tilesetInfo = { width: meta.width, height: meta.height };
}

async function extractTile(tileId) {
  if (_tileCache.has(tileId)) return _tileCache.get(tileId);
  const srcX = (tileId % TILESET_COLS) * TILE_SIZE;
  const srcY = Math.floor(tileId / TILESET_COLS) * TILE_SIZE;
  const buf = await sharp(_tilesetBuffer, {
    raw: { width: _tilesetInfo.width, height: _tilesetInfo.height, channels: 4 }
  })
    .extract({ left: srcX, top: srcY, width: TILE_SIZE, height: TILE_SIZE })
    .png()
    .toBuffer();
  _tileCache.set(tileId, buf);
  return buf;
}

async function renderMapToPng(tileData) {
  await initTileset();
  const { width, height, ground, objects, foreground } = tileData;
  const canvasW = width * TILE_SIZE;
  const canvasH = height * TILE_SIZE;
  const layers = [ground, objects, foreground];

  // Collect unique tile IDs
  const uniqueIds = new Set();
  for (const layer of layers) {
    if (!layer) continue;
    for (const id of layer) {
      if (id >= 0 && (id <= MAX_TILE_ID || _tileCache.has(id))) uniqueIds.add(id);
    }
  }

  // Pre-extract all unique tiles
  await Promise.all([...uniqueIds].map(id => extractTile(id)));

  // Build composite operations
  const composites = [];
  for (const layer of layers) {
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const tileId = layer[i];
      if (tileId < 0 || (tileId > MAX_TILE_ID && !_tileCache.has(tileId))) continue;
      const tileBuf = _tileCache.get(tileId);
      if (!tileBuf) continue;
      composites.push({
        input: tileBuf,
        left: (i % width) * TILE_SIZE,
        top: Math.floor(i / width) * TILE_SIZE
      });
    }
  }

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
  })
    .composite(composites)
    .png()
    .toBuffer();
}

// ── Compute match grid (for heatmap) ────────────────────────────────────────
function computeMatchGrid(generated, target) {
  const w = Math.min(generated.width, target.width);
  const h = Math.min(generated.height, target.height);
  const grid = new Array(w * h).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gi = y * generated.width + x;
      const ti = y * target.width + x;
      let matches = 0;
      if ((generated.ground[gi] ?? -1) === (target.ground[ti] ?? -1)) matches++;
      if ((generated.objects[gi] ?? -1) === (target.objects[ti] ?? -1)) matches++;
      if ((generated.foreground[gi] ?? -1) === (target.foreground[ti] ?? -1)) matches++;
      grid[y * w + x] = matches;
    }
  }
  return grid;
}

// ── Status state (polled by dashboard) ──────────────────────────────────────
const status = {
  running: false,
  generation: 0,
  maxGenerations: MAX_GENS,
  populationSize: POP_SIZE,
  elapsed: 0,
  bestScore: 0,
  bestGeneration: 0,
  currentBest: 0,
  currentAvg: 0,
  diversity: 0,
  tileMatch: 0,
  designScore: 0,
  breakdown: {},
  knowledgeRules: 0,
  bestMapPath: '/api/best-map',
  history: [],
  log: [],
  target: TARGET_SCORE,
  matchGrid: null,
  mapWidth: 0,
  mapHeight: 0
};

function addLog(msg) {
  status.log.push(msg);
  if (status.log.length > 100) status.log.shift();
  console.log(msg);
}

// ── Load target maps ────────────────────────────────────────────────────────
// Primary target: js13k-level1 (36x24, richest sample map)
// Fallback: user's hand-painted map, then level file
const JS13K_LEVEL1_PATH = path.join(V2_DIR, 'js13k-level1.json');
const PAINTED_MAP_PATH = path.join(V2_DIR, 'painted-map.json');
let targetMap = null;
let paintedMap = null;

// Try js13k-level1 first (primary target for visual learning)
if (fs.existsSync(JS13K_LEVEL1_PATH)) {
  try {
    targetMap = JSON.parse(fs.readFileSync(JS13K_LEVEL1_PATH, 'utf8'));
    console.log(`js13k-level1 loaded as PRIMARY target: ${targetMap.width}x${targetMap.height}`);
  } catch (e) {
    console.log(`Warning: could not load js13k-level1: ${e.message}`);
  }
}

// Also load painted map for learning (secondary knowledge source)
if (fs.existsSync(PAINTED_MAP_PATH)) {
  try {
    paintedMap = JSON.parse(fs.readFileSync(PAINTED_MAP_PATH, 'utf8'));
    console.log(`Painted map loaded for learning: ${paintedMap.width}x${paintedMap.height}`);
    if (!targetMap) {
      targetMap = paintedMap;
      console.log(`Using painted map as fallback target`);
    }
  } catch (e) {
    console.log(`Warning: could not load painted map: ${e.message}`);
  }
}

// Fallback to level file if nothing else
if (!targetMap) {
  try {
    targetMap = loadTargetMap(TARGET_LEVEL_PATH);
    console.log(`Level file loaded as target: ${targetMap.width}x${targetMap.height}`);
  } catch (e) {
    console.error(`ERROR: No target map available: ${e.message}`);
    process.exit(1);
  }
}

// Set map dimensions in status
status.mapWidth = targetMap.width;
status.mapHeight = targetMap.height;

// ── Load learned knowledge ──────────────────────────────────────────────────
const learner = new TileRelationshipLearner();
if (fs.existsSync(KNOWLEDGE_PATH)) {
  try {
    learner.loadFromFile(KNOWLEDGE_PATH);
    const stats = learner.getStats();
    console.log(`Loaded knowledge: ${JSON.stringify(stats)}`);
    status.knowledgeRules = stats.totalAdjacencies || stats.adjacencyRules || 0;
  } catch (e) {
    console.log(`Warning: could not load knowledge: ${e.message}`);
  }
}

// Learn from target map with highest weight
learner.learnFromMap(targetMap, 100);
addLog(`Learned from target map ${targetMap.width}x${targetMap.height} (100x weight)`);

// Also learn from painted map if different from target
if (paintedMap && paintedMap !== targetMap) {
  learner.learnFromMap(paintedMap, 50);
  addLog(`Also learned from painted map ${paintedMap.width}x${paintedMap.height} (50x weight)`);
}

// Also learn from level file (secondary, lower weight)
try {
  const levelMap = loadTargetMap(TARGET_LEVEL_PATH);
  learner.learnFromMap(levelMap, 10);
  addLog('Also learned from level file (10x weight)');
} catch (e) {}

// ── Evolver setup ───────────────────────────────────────────────────────────
const evolver = new GeneticEvolver({
  populationSize: POP_SIZE,
  eliteCount: Math.max(2, Math.floor(POP_SIZE * 0.2)),
  mutationRate: 0.15,
  mutationStrength: 0.2,
  crossoverRate: 0.7,
  mapSize: { width: targetMap.width, height: targetMap.height }
});

let population = evolver.initPopulation();

// V2Engine with target as template — used for map generation
const v2engine = new V2Engine({ width: targetMap.width, height: targetMap.height });
v2engine.setPaintedTemplate(targetMap);
console.log(`V2Engine: loaded ${v2engine._paintedBuildings.length} buildings, ${v2engine._paintedForeground.length} foreground tiles from target map`);
// Load user feedback (flagged tiles) as negative examples
v2engine.loadFlaggedTiles(path.join(V2_DIR, 'flagged-tiles.json'));
// Load user-defined tile tags
v2engine.loadTileTags(path.join(V2_DIR, 'tile-tags.json'));

let bestMapPng = null;
let bestMapData = null;
let startTime = Date.now();
let stopRequested = false;

// ── Structural Scorer (local, no API calls) ────────────────────────────────
const { StructuralScorer } = require(path.join(V2_DIR, 'v2-structural-scorer'));
const structuralScorer = new StructuralScorer(targetMap);
console.log('Structural scorer initialized (local, runs every generation)');

// ── Reward Table + Feedback Learner (self-correcting RL) ────────────────
const { RewardTable } = require(path.join(V2_DIR, 'reward-table'));
const { FeedbackLearner } = require(path.join(V2_DIR, 'feedback-learner'));

const REWARD_TABLE_PATH = path.join(V2_DIR, 'reward-table.json');
const rewardTable = new RewardTable();
rewardTable.loadFromFile(REWARD_TABLE_PATH);

// Load tile tags for feedback learner
let tileTags = {};
const tileTagsPath = path.join(V2_DIR, 'tile-tags.json');
if (fs.existsSync(tileTagsPath)) {
  tileTags = JSON.parse(fs.readFileSync(tileTagsPath, 'utf8'));
}

const feedbackLearner = new FeedbackLearner(rewardTable, tileTags);

// ── Error Detector (self-audit — counts actual defects) ─────────────────────
const { ErrorDetector } = require(path.join(V2_DIR, 'error-detector'));
const errorDetector = new ErrorDetector(tileTags);
status.errorCount = null;
status.errorBreakdown = null;
// Learn from ALL data sources at startup
const learnStats = feedbackLearner.learnFromAll(V2_DIR);
console.log('Feedback learner: painted=' + learnStats.paintedMaps + ' samples=' + learnStats.sampleMaps +
  ' flags=' + learnStats.flagSessions + ' | Reward table: ' + JSON.stringify(rewardTable.getStats()));

// Wire reward table into the engine
v2engine.rewardTable = rewardTable;

status.structuralScore = null;
status.rewardStats = rewardTable.getStats();

// ── Auto-repair: fix detected errors in-place + learn from mistakes ─────────
const CANOPY_TO_TRUNK = { 4: 16, 7: 19, 3: 15, 6: 18, 10: 22 };
const TRUNK_TO_CANOPY = { 16: 4, 19: 7, 15: 3, 18: 6, 22: 10 };

function repairMap(map, errorResult, rewardTable, tileTags) {
  const W = map.width, H = map.height;
  const idx = (x, y) => y * W + x;

  // PASS 1: Remove all clearly broken things first (order matters!)
  // This prevents cascading — remove orphans before trying to fix pairs
  for (const err of errorResult.errors) {
    const ci = idx(err.x, err.y);
    // Learn from every error
    const contexts = RewardTable.buildContexts(err.x, err.y, map, tileTags);
    rewardTable.penalize(err.tile, contexts, 1.0);

    switch (err.sub) {
      case 'floating-edge':     map.foreground[ci] = -1; break;
      case 'incomplete-block':  map.foreground[ci] = -1; break;
      case 'fg-on-building':    map.foreground[ci] = -1; break;
      case 'under-building':    map.ground[ci] = 1; break;
      case 'isolated':          map.ground[ci] = 1; break;
      case 'random-deco':       map.objects[ci] = -1; break;
      case 'deco-in-water':     map.objects[ci] = -1; break;
    }
  }

  // PASS 2: Fix pairs (canopy/trunk, well top/base) — try to complete, else remove
  for (const err of errorResult.errors) {
    const { x, y, sub, tile } = err;
    const ci = idx(x, y);
    // Skip if already removed in pass 1
    if (sub === 'floating-edge' || sub === 'incomplete-block') continue;

    switch (sub) {
      case 'orphan-canopy': {
        if (map.foreground[ci] < 0) break; // already removed
        const trunk = CANOPY_TO_TRUNK[tile];
        if (trunk !== undefined && y + 1 < H && map.foreground[idx(x, y + 1)] < 0 && map.objects[idx(x, y + 1)] < 0) {
          map.foreground[idx(x, y + 1)] = trunk;
        } else {
          map.foreground[ci] = -1;
        }
        break;
      }
      case 'orphan-trunk': {
        if (map.foreground[ci] < 0) break;
        const canopy = TRUNK_TO_CANOPY[tile];
        if (canopy !== undefined && y > 0 && map.foreground[idx(x, y - 1)] < 0) {
          map.foreground[idx(x, y - 1)] = canopy;
        } else {
          map.foreground[ci] = -1;
        }
        break;
      }
      case 'no-base': {
        if (map.objects[ci] < 0) break;
        if (y + 1 < H && map.objects[idx(x, y + 1)] < 0) {
          map.objects[idx(x, y + 1)] = 104;
        } else {
          map.objects[ci] = -1;
        }
        break;
      }
      case 'no-top': {
        if (map.objects[ci] < 0) break;
        if (y > 0 && map.objects[idx(x, y - 1)] < 0) {
          map.objects[idx(x, y - 1)] = 92;
        } else {
          map.objects[ci] = -1;
        }
        break;
      }
      case 'blocked-door': {
        if (y + 1 < H) { map.objects[idx(x, y + 1)] = -1; map.foreground[idx(x, y + 1)] = -1; }
        break;
      }
    }
  }
}

// ── Auto-train loop (non-blocking via setImmediate) ─────────────────────────
async function runGeneration() {
  if (stopRequested || status.generation >= MAX_GENS) {
    status.running = false;
    addLog(`Evolution stopped at gen ${status.generation}. Best: ${status.bestScore.toFixed(2)}%`);
    return;
  }

  status.generation++;
  status.elapsed = Date.now() - startTime;

  // Generate and score — REUSE single map buffer to prevent OOM
  // Only keep DNA + fitness number per organism, not full map data
  const scored = new Array(population.length);
  let bestMap = null, bestAudit = null, bestFitness = -1, bestIdx = 0;
  const W = targetMap.width, H = targetMap.height, size = W * H;
  // Reuse typed arrays
  if (!runGeneration._ground) {
    runGeneration._ground = new Array(size);
    runGeneration._objects = new Array(size);
    runGeneration._foreground = new Array(size);
    runGeneration._collision = new Array(size);
  }

  for (let i = 0; i < population.length; i++) {
    const dna = population[i];
    const map = v2engine.generate(dna, i + status.generation * 1000 + (Math.random() * 0x7fffffff | 0));

    // ── SELF-AUDIT + REPAIR LOOP: keep fixing until clean or max iterations ──
    let repairRounds = 0;
    let mapErrors;
    do {
      mapErrors = errorDetector.detect(map);
      if (mapErrors.totalErrors === 0) break;
      repairMap(map, mapErrors, rewardTable, tileTags);
      repairRounds++;
    } while (repairRounds < 5); // max 5 repair passes to catch cascading fixes
    // Final error count AFTER all repairs
    const finalErrors = errorDetector.detect(map);
    const errorPenalty = finalErrors.totalErrors * 1.0; // each remaining error costs 1.0 fitness

    const audit = auditMap(map);
    const tileMatchResult = scoreTileMatch(map, targetMap);

    // FITNESS = design quality + structural match + tile match - error penalty
    const designFit = audit.design || audit.total || 0;
    const tileFit = tileMatchResult.score || 0;
    const structFit = structuralScorer.score(map).total;
    const fitness = Math.max(0, designFit * 0.4 + structFit * 0.3 + tileFit * 0.3 - errorPenalty);

    scored[i] = { dna, fitness, tileMatch: tileFit, designScore: designFit, structScore: structFit };

    if (fitness > bestFitness) {
      bestFitness = fitness;
      bestIdx = i;
      // Copy best map data (only keep ONE copy)
      bestMap = { width: W, height: H, ground: map.ground.slice(), objects: map.objects.slice(), foreground: map.foreground.slice(), collision: map.collision ? map.collision.slice() : null };
      bestAudit = audit;
    }
    // map and audit go out of scope here — GC can collect them
  }

  const best = { ...scored[bestIdx], map: bestMap, audit: bestAudit };
  scored.sort((a, b) => b.fitness - a.fitness);
  const stats = evolver.getStats(scored);

  // Update status
  status.currentBest = best.fitness;
  status.currentAvg = stats.avg;
  status.diversity = stats.diversity;
  status.tileMatch = best.tileMatch;
  status.designScore = best.designScore;

  if (best.fitness > status.bestScore) {
    status.bestScore = best.fitness;
    status.bestGeneration = status.generation;
    bestMapData = best.map;
    // Run repair loop on the saved best map to ensure it's clean
    for (let rr = 0; rr < 5; rr++) {
      const errs = errorDetector.detect(bestMapData);
      if (errs.totalErrors === 0) break;
      repairMap(bestMapData, errs, rewardTable, tileTags);
    }
    // Re-render PNG immediately so thumbnail and data always match
    try {
      bestMapPng = await renderMapToPng(bestMapData);
    } catch (e) { /* will retry on next scheduled render */ }
  }

  // Compute breakdown from audit
  if (best.audit && best.audit.ruleResults) {
    const bd = {};
    const rules = best.audit.ruleResults || [];
    // Map audit rules to radar dimensions
    bd.pathNetwork = Math.min(10, 10 - (rules.filter(r => r && r.rule && r.rule.includes('path')).length));
    bd.buildings = Math.min(10, 10 - (rules.filter(r => r && r.rule && r.rule.includes('roof')).length) - (rules.filter(r => r && r.rule && r.rule.includes('door')).length));
    bd.treeQuality = Math.min(10, 10 - (rules.filter(r => r && r.rule && r.rule.includes('canopy')).length) - (rules.filter(r => r && r.rule && r.rule.includes('trunk')).length));
    bd.decorations = Math.min(10, Math.round(best.designScore / 10));
    bd.groundTexture = Math.min(10, 10 - (rules.filter(r => r && r.rule && r.rule.includes('ground')).length * 2));
    bd.composition = Math.min(10, Math.round(best.fitness / 10));
    bd.waterFeature = Math.min(5, Math.round(best.designScore / 20));
    bd.villageFeel = Math.min(5, Math.round(best.fitness / 20));
    status.breakdown = bd;
  } else {
    // Simple fallback breakdown based on scores
    status.breakdown = {
      pathNetwork: Math.round(best.tileMatch / 10),
      buildings: Math.round(best.designScore / 10),
      treeQuality: Math.round(best.tileMatch / 12),
      decorations: Math.round(best.designScore / 12),
      groundTexture: Math.round(best.tileMatch / 11),
      composition: Math.round(best.fitness / 10),
      waterFeature: Math.round(best.designScore / 25),
      villageFeel: Math.round(best.fitness / 22)
    };
  }

  // Compute match grid for heatmap
  if (bestMapData) {
    status.matchGrid = computeMatchGrid(bestMapData, targetMap);
  }

  // History entry
  status.history.push({
    gen: status.generation,
    best: parseFloat(best.fitness.toFixed(2)),
    avg: parseFloat(stats.avg.toFixed(2))
  });
  if (status.history.length > 200) status.history.shift();

  // Log
  const genSpeed = status.generation / (status.elapsed / 1000);
  const logMsg = `Gen ${status.generation}: fit=${(best.fitness||0).toFixed(1)}% tile=${(best.tileMatch||0).toFixed(1)}% design=${(best.designScore||0).toFixed(0)} struct=${(best.structScore||0).toFixed(0)} div=${(stats.diversity||0).toFixed(1)} [${genSpeed.toFixed(1)} gen/s]`;
  addLog(logMsg);

  // Force GC every 100 gens + clear Sharp tile cache every 500 gens
  if (status.generation % 100 === 0 && global.gc) {
    global.gc();
  }
  if (status.generation % 500 === 0) {
    // Clear extracted tile cache to free Sharp buffers (they'll be re-extracted on demand)
    _tileCache.clear();
  }

  // Render best map to PNG every 20 gens
  if (status.generation % 20 === 0 || status.generation === 1) {
    try {
      const mapToRender = bestMapData || best.map;
      bestMapPng = await renderMapToPng(mapToRender);
      const pngPath = path.join(RESULTS_DIR, `best-gen-${status.generation}.png`);
      fs.writeFileSync(pngPath, bestMapPng);
    } catch (e) {
      addLog(`Render error: ${e.message}`);
    }
  }

  // ── Self-learning: every generation the reward table evolves ────────────
  rewardTable.decay();

  // Re-detect and REPAIR errors on best map every generation
  if (bestMapData) {
    // Keep repairing the saved best map — it accumulates fixes over time
    const bestErrors = errorDetector.detect(bestMapData);
    if (bestErrors.totalErrors > 0) {
      repairMap(bestMapData, bestErrors, rewardTable, tileTags);
      // Re-render after repair so the thumbnail stays current
      if (status.generation % 20 === 0) {
        try { bestMapPng = await renderMapToPng(bestMapData); } catch (e) {}
      }
    }
    // Re-detect after repair for accurate count
    const afterRepair = errorDetector.detect(bestMapData);
    status.errorCount = afterRepair.totalErrors;
    status.errorBreakdown = afterRepair.byType;
    status.errorSummary = afterRepair.summary;
  }

  if (bestMapData && status.generation % 50 === 0) {
    // Self-comparison: compare best map to target, adjust weights
    if (targetMap) {
      feedbackLearner.selfCompare(bestMapData, targetMap);
    }
    // Save reward table
    rewardTable.saveToFile(REWARD_TABLE_PATH);
    status.rewardStats = rewardTable.getStats();

    const sResult = structuralScorer.score(bestMapData);
    status.structuralScore = sResult;
    // Error detection: count defects in best map
    const errorResult = errorDetector.detect(bestMapData);
    status.errorCount = errorResult.totalErrors;
    status.errorBreakdown = errorResult.byType;
    status.errorSummary = errorResult.summary;

    // SELF-LEARN FROM ERRORS: penalize every detected error in the reward table
    for (const err of errorResult.errors) {
      const contexts = RewardTable.buildContexts(err.x, err.y, bestMapData, tileTags);
      rewardTable.penalize(err.tile, contexts, 1.5); // learn to avoid this
    }

    const rs = rewardTable.getStats();
    const errStr = Object.entries(errorResult.byType).filter(([,v]) => v > 0).map(([k,v]) => k + '=' + v).join(' ');
    addLog(`📐 Structural: ${sResult.total.toFixed(1)}/100 [bldg=${sResult.buildings.toFixed(0)} path=${sResult.paths.toFixed(0)} veg=${sResult.vegetation.toFixed(0)} ground=${sResult.ground.toFixed(0)} comp=${sResult.composition.toFixed(0)}]`);
    addLog(`🔍 Errors: ${errorResult.totalErrors} [${errStr}]`);
    addLog(`🧠 Rewards: ${rs.totalRewards} penalties: ${rs.totalPenalties} contexts: ${rs.contextEntries} v${rs.version}`);
  }

  // Check stop conditions: error tolerance OR score target
  // Only check after 100 gens minimum (need time to generate real maps)
  const currentErrors = status.errorCount !== null ? status.errorCount : 999;
  if (status.generation >= 100 && currentErrors <= ERROR_TOLERANCE) {
    addLog(`✅ ERROR TOLERANCE REACHED at gen ${status.generation}! Errors: ${currentErrors} (tolerance: ${ERROR_TOLERANCE})`);
    addLog(`Final: score=${status.bestScore.toFixed(1)}% tile=${status.tileMatch.toFixed(1)}%`);
    status.running = false;
    rewardTable.saveToFile(REWARD_TABLE_PATH);
    try {
      if (bestMapData) {
        bestMapPng = await renderMapToPng(bestMapData);
        fs.writeFileSync(path.join(RESULTS_DIR, 'best-final.png'), bestMapPng);
      }
    } catch (e) { /* ignore */ }
    return;
  }
  if (status.bestScore >= TARGET_SCORE) {
    addLog(`TARGET REACHED at gen ${status.generation}! Score: ${status.bestScore.toFixed(2)}%`);
    status.running = false;
    rewardTable.saveToFile(REWARD_TABLE_PATH);
    try {
      if (bestMapData) {
        bestMapPng = await renderMapToPng(bestMapData);
        fs.writeFileSync(path.join(RESULTS_DIR, 'best-final.png'), bestMapPng);
      }
    } catch (e) { /* ignore */ }
    return;
  }

  // ── Best Practice: Continuous adaptive mutation (heavy-tailed) ──────────
  // Research: Doerr et al. (2022) — draw mutation rate from log-scaled
  // distribution based on stagnation. Replaces 3-tier nudge/shake/cataclysm.
  const staleGens = status.generation - status.bestGeneration;
  const baseMutRate = 0.12;
  const baseMutStrength = 0.15;

  // Continuous scaling: mutation grows with log of stagnation
  const staleMultiplier = 1 + Math.log2(1 + staleGens / 30);
  evolver.mutationRate = Math.min(0.5, baseMutRate * staleMultiplier);
  evolver.mutationStrength = Math.min(0.6, baseMutStrength * staleMultiplier);

  // ── RADICAL: Simulated Annealing on best map — CONTINUOUS ──────────
  // Every 20 gens, do an annealing pass on the best map (reuses buffers to save memory)
  if (bestMapData && status.generation % 20 === 0) {
    const annealRounds = 500;
    // Reuse static buffers for annealing to avoid OOM from repeated .slice() copies
    if (!runGeneration._annealGround) {
      const sz = bestMapData.width * bestMapData.height;
      runGeneration._annealGround = new Array(sz);
      runGeneration._annealObjects = new Array(sz);
      runGeneration._annealForeground = new Array(sz);
      runGeneration._annealCollision = new Array(sz);
    }
    // Copy current best into reusable buffers
    const sz = bestMapData.width * bestMapData.height;
    for (let k = 0; k < sz; k++) {
      runGeneration._annealGround[k] = bestMapData.ground[k];
      runGeneration._annealObjects[k] = bestMapData.objects[k];
      runGeneration._annealForeground[k] = bestMapData.foreground[k];
      runGeneration._annealCollision[k] = bestMapData.collision ? bestMapData.collision[k] : 0;
    }
    let annealMap = {
      width: bestMapData.width, height: bestMapData.height,
      ground: runGeneration._annealGround,
      objects: runGeneration._annealObjects,
      foreground: runGeneration._annealForeground,
      collision: runGeneration._annealCollision
    };
    let annealScore = auditMap(annealMap).design || 0;
    const W = annealMap.width, H = annealMap.height;
    // Valid ground tiles and foreground tiles from tags
    const grassTiles = [0, 1, 2, 43];
    const fgTiles = [3, 4, 6, 7, 15, 16, 17, 19, 20, 28, 32, -1, -1, -1]; // -1 = empty (weighted)
    let improved = 0;
    const temp0 = 3.0;
    // Castle tile check — pre-built outside loop to avoid allocating a Set every iteration
    const ANNEAL_CASTLE = new Set([102, 204, 205, 96, 98, 120, 122, 111, 112, 123, 124]);

    for (let r = 0; r < annealRounds; r++) {
      const temp = temp0 * (1 - r / annealRounds);
      const x = Math.floor(Math.random() * W);
      const y = Math.floor(Math.random() * H);
      const idx = y * W + x;

      // Pick which layer to tweak (weighted: ground 50%, foreground 40%, objects 10%)
      const roll = Math.random();
      let layer, newTile, oldTile;

      if (roll < 0.5) {
        // Ground tweak
        layer = 'ground';
        oldTile = annealMap.ground[idx];
        newTile = grassTiles[Math.floor(Math.random() * grassTiles.length)];
      } else if (roll < 0.9) {
        // Foreground tweak
        layer = 'foreground';
        oldTile = annealMap.foreground[idx];
        newTile = fgTiles[Math.floor(Math.random() * fgTiles.length)];
        // Don't mess with cells that have buildings below
        if (annealMap.objects[idx] >= 0) continue;
      } else {
        // Objects tweak — only empty cells (add/remove small decorations)
        layer = 'objects';
        oldTile = annealMap.objects[idx];
        if (ANNEAL_CASTLE.has(oldTile)) continue; // never touch castle
        // Can add well, barrel, lantern to empty cells or remove them
        const decoTiles = [92, 104, 107, 93, -1, -1, -1]; // decorations + empty
        if (oldTile >= 0 && oldTile < 44) continue; // don't touch buildings
        if (oldTile >= 48 && oldTile <= 91) continue; // don't touch buildings
        newTile = decoTiles[Math.floor(Math.random() * decoTiles.length)];
      }
      if (newTile === oldTile) continue;

      // Apply tweak
      annealMap[layer][idx] = newTile;
      const newScore = auditMap(annealMap).design || 0;
      const delta = newScore - annealScore;

      if (delta > 0 || Math.random() < Math.exp(delta / Math.max(0.01, temp))) {
        // Accept
        annealScore = newScore;
        if (delta > 0) improved++;
      } else {
        // Reject — revert
        annealMap[layer][idx] = oldTile;
      }
    }

    if (annealScore > status.bestScore) {
      addLog(`🔥 ANNEALING: ${annealScore.toFixed(1)}% (+${(annealScore - status.bestScore).toFixed(1)}) after ${improved} improvements`);
      // Copy out of reusable buffers into a new bestMapData (since buffers will be reused next time)
      bestMapData = {
        width: annealMap.width, height: annealMap.height,
        ground: annealMap.ground.slice(),
        objects: annealMap.objects.slice(),
        foreground: annealMap.foreground.slice(),
        collision: annealMap.collision.slice()
      };
      status.bestScore = annealScore;
      status.bestGeneration = status.generation;
      // Re-render immediately so dashboard updates
      try {
        bestMapPng = await renderMapToPng(bestMapData);
        fs.writeFileSync(path.join(RESULTS_DIR, `best-anneal-${status.generation}.png`), bestMapPng);
      } catch (e) {}
    } else if (improved > 0) {
      addLog(`🔥 Annealing: ${improved}/${annealRounds} accepted but no net gain`);
    }
  }

  // At extreme stagnation (>300), inject fresh random individuals
  if (staleGens > 300 && staleGens % 100 === 0) {
    const injectCount = Math.floor(population.length * 0.3);
    addLog(`🔄 Injecting ${injectCount} fresh individuals at gen ${status.generation} (stale ${staleGens})`);
    for (let i = population.length - injectCount; i < population.length; i++) {
      const fresh = JSON.parse(JSON.stringify(population[0]));
      for (const k of Object.keys(fresh)) {
        if (typeof fresh[k] === 'number') fresh[k] += (Math.random() - 0.5) * fresh[k] * 1.5;
      }
      population[i] = fresh;
    }
  }

  if (staleGens > 0 && staleGens % 50 === 0) {
    addLog(`📊 Stale ${staleGens}: mutation=${evolver.mutationRate.toFixed(3)} strength=${evolver.mutationStrength.toFixed(3)}`);
  }

  // Evolve next generation — optimizing for DESIGN QUALITY (variety mode)
  population = evolver.evolveGeneration(scored);

  // Schedule next generation (non-blocking)
  setImmediate(runGeneration);
}

function startEvolution() {
  if (status.running) return;
  stopRequested = false;
  status.running = true;
  startTime = Date.now() - status.elapsed; // preserve elapsed if restarting
  addLog(`Starting evolution: errors<=${ERROR_TOLERANCE}, pop=${POP_SIZE}, max=${MAX_GENS}`);
  setImmediate(runGeneration);
}

function stopEvolution() {
  stopRequested = true;
  addLog('Stop requested...');
}

// ── Express server ──────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Dashboard
app.get('/', (req, res) => {
  if (!fs.existsSync(DASHBOARD_PATH)) {
    return res.status(404).send('Dashboard not found at ' + DASHBOARD_PATH);
  }
  res.sendFile(DASHBOARD_PATH);
});

// API: Status (polled by dashboard)
app.get('/api/status', (req, res) => {
  res.json(status);
});

// API: Best map PNG
app.get('/api/best-map', (req, res) => {
  if (!bestMapPng) {
    return res.status(404).send('No map rendered yet');
  }
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-cache');
  res.send(bestMapPng);
});

// API: Flagged tiles — save user feedback and update engine rules
const FLAGGED_PATH = path.join(V2_DIR, 'flagged-tiles.json');
let allFlaggedSessions = [];
if (fs.existsSync(FLAGGED_PATH)) {
  try { allFlaggedSessions = JSON.parse(fs.readFileSync(FLAGGED_PATH, 'utf8')); } catch(e) {}
}

app.post('/api/flagged-tiles', (req, res) => {
  const { flags, generation } = req.body;
  if (!flags || !flags.length) return res.json({ ok: true, count: 0 });

  // Save this session's flags
  const session = {
    time: new Date().toISOString(),
    generation,
    flags
  };
  allFlaggedSessions.push(session);
  fs.writeFileSync(FLAGGED_PATH, JSON.stringify(allFlaggedSessions, null, 2));

  // Extract learnings from flags and log them
  for (const flag of flags) {
    addLog(`🚩 Flag (${flag.x},${flag.y}): g:${flag.ground} o:${flag.objects} f:${flag.foreground} — ${flag.note}`);
  }

  // Reload into engine immediately so next generation uses the feedback
  v2engine.loadFlaggedTiles(FLAGGED_PATH);

  addLog(`📝 Saved ${flags.length} flags from gen ${generation}. Total sessions: ${allFlaggedSessions.length}`);
  res.json({ ok: true, count: flags.length, totalSessions: allFlaggedSessions.length });
});

app.get('/api/flagged-tiles', (req, res) => {
  res.json(allFlaggedSessions);
});

// API: Tile catalog for inspector
app.get('/api/tile-catalog', (req, res) => {
  const catalogPath = path.join(__dirname, '..', '..', 'tools', 'tile-catalog.json');
  if (fs.existsSync(catalogPath)) return res.sendFile(catalogPath);
  res.status(404).json({ error: 'No tile catalog' });
});

// API: Best map raw tile data (for interactive inspector)
app.get('/api/best-map-data', (req, res) => {
  if (!bestMapData) return res.status(404).json({ error: 'No map yet' });
  res.json(bestMapData);
});

// API: Knowledge stats
app.get('/api/knowledge', (req, res) => {
  try {
    const stats = learner.getStats();
    res.json(stats);
  } catch (e) {
    res.json({ error: e.message });
  }
});

// API: Score history for charting
app.get('/api/history', (req, res) => {
  res.json(status.history);
});

// Tilemap PNG
app.get('/tilemap', (req, res) => {
  if (!fs.existsSync(TILESET_PATH)) {
    return res.status(404).send('Tileset not found');
  }
  res.sendFile(TILESET_PATH);
});

// Reference image — pixel-perfect render of current target map
const PAINTED_REF_PATH = path.join(V2_DIR, 'painted-reference.png');
let targetPngCache = null;
app.get('/reference', async (req, res) => {
  // Serve a pixel-perfect render of the current target map (not a static file)
  try {
    if (!targetPngCache && targetMap) {
      targetPngCache = await renderMapToPng({
        width: targetMap.width, height: targetMap.height,
        ground: targetMap.ground, objects: targetMap.objects, foreground: targetMap.foreground
      });
    }
    if (targetPngCache) {
      res.set('Content-Type', 'image/png');
      return res.send(targetPngCache);
    }
  } catch (e) { /* fall through */ }
  // Fallback to static files
  if (fs.existsSync(PAINTED_REF_PATH)) return res.sendFile(PAINTED_REF_PATH);
  if (fs.existsSync(REFERENCE_PATH)) return res.sendFile(REFERENCE_PATH);
  res.status(404).send('Reference image not found');
});
// Original Kenney image still available at /kenney-reference
app.get('/kenney-reference', (req, res) => {
  if (fs.existsSync(REFERENCE_PATH)) return res.sendFile(REFERENCE_PATH);
  res.status(404).send('Not found');
});

// Rendered target level (pixel-perfect from tile data)
app.get('/target-render', async (req, res) => {
  try {
    if (!targetPngCache && targetMap) {
      targetPngCache = await renderMapToPng({
        width: targetMap.width, height: targetMap.height,
        ground: targetMap.ground, objects: targetMap.objects, foreground: targetMap.foreground
      });
    }
    if (targetPngCache) res.type('png').send(targetPngCache);
    else res.status(404).send('No target render');
  } catch (e) { res.status(500).send(e.message); }
});

// Stop evolution
app.post('/api/stop', (req, res) => {
  stopEvolution();
  res.json({ ok: true, message: 'Stop requested' });
});

// Start/restart evolution
app.post('/api/start', (req, res) => {
  if (status.running) {
    return res.json({ ok: false, message: 'Already running' });
  }
  startEvolution();
  res.json({ ok: true, message: 'Started' });
});

// ── Annotator ───────────────────────────────────────────────────────────
const ANNOTATIONS_PATH = path.join(V2_DIR, 'annotations.json');

// API: Tile tags — user-defined metadata for all tiles
const TILE_TAGS_PATH = path.join(V2_DIR, 'tile-tags.json');
app.get('/api/tile-tags', (req, res) => {
  if (fs.existsSync(TILE_TAGS_PATH)) return res.sendFile(TILE_TAGS_PATH);
  res.json({});
});
app.post('/api/tile-tags', (req, res) => {
  fs.writeFileSync(TILE_TAGS_PATH, JSON.stringify(req.body, null, 2));
  // Reload into engine immediately — next generation uses updated tags
  v2engine.loadTileTags(TILE_TAGS_PATH);
  addLog(`💾 Tile tags updated: ${Object.keys(req.body).filter(k => k !== '_customTags').length} tiles tagged — engine reloaded`);
  res.json({ ok: true, count: Object.keys(req.body).length });
});

app.get('/annotate', (req, res) => {
  res.sendFile(path.join(V2_DIR, 'v2-annotator.html'));
});

app.get('/api/annotations', (req, res) => {
  if (fs.existsSync(ANNOTATIONS_PATH)) {
    res.sendFile(ANNOTATIONS_PATH);
  } else {
    res.json({ version: '2.0', width: targetMap?.width || 24, height: targetMap?.height || 14, cells: {}, stats: { totalTagged: 0, tagCounts: {} } });
  }
});

app.post('/api/annotations', (req, res) => {
  fs.writeFileSync(ANNOTATIONS_PATH, JSON.stringify(req.body, null, 2));
  res.json({ ok: true, saved: true });
});

// ── Painter ─────────────────────────────────────────────────────────────────
app.get('/paint', (req, res) => {
  res.sendFile(path.join(V2_DIR, 'v2-painter.html'));
});

app.post('/api/painted-map', (req, res) => {
  fs.writeFileSync(PAINTED_MAP_PATH, JSON.stringify(req.body, null, 2));
  res.json({ ok: true, saved: true });
});
app.get('/api/painted-map', (req, res) => {
  if (fs.existsSync(PAINTED_MAP_PATH)) res.sendFile(PAINTED_MAP_PATH);
  else res.json({ width: targetMap?.width || 24, height: targetMap?.height || 14, ground: [], objects: [], foreground: [] });
});

// ── Custom Tiles ────────────────────────────────────────────────────────────
const CUSTOM_TILES_PATH = path.join(V2_DIR, 'custom-tiles.json');

app.get('/api/custom-tiles', (req, res) => {
  if (fs.existsSync(CUSTOM_TILES_PATH)) {
    res.sendFile(CUSTOM_TILES_PATH);
  } else {
    res.json({});
  }
});

app.post('/api/custom-tiles', (req, res) => {
  // req.body = { "200": "data:image/png;base64,...", "203": "...", ... }
  fs.writeFileSync(CUSTOM_TILES_PATH, JSON.stringify(req.body, null, 2));
  // Also load into tile cache for server-side rendering
  loadCustomTilesIntoCache(req.body);
  res.json({ ok: true, count: Object.keys(req.body).length });
});

function loadCustomTilesIntoCache(tilesObj) {
  for (const [idStr, dataUrl] of Object.entries(tilesObj)) {
    const id = parseInt(idStr);
    if (isNaN(id)) continue;
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64, 'base64');
      _tileCache.set(id, buf);
    } catch (e) {
      console.error(`Failed to load custom tile ${id}: ${e.message}`);
    }
  }
}

// Load custom tiles on startup
if (fs.existsSync(CUSTOM_TILES_PATH)) {
  try {
    const ct = JSON.parse(fs.readFileSync(CUSTOM_TILES_PATH, 'utf8'));
    loadCustomTilesIntoCache(ct);
    console.log(`Loaded ${Object.keys(ct).length} custom tiles from disk`);
  } catch (e) {
    console.error(`Failed to load custom tiles: ${e.message}`);
  }
}

// ── Launch ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== V2 Map Trainer ===');
  console.log(`Target: ${TARGET_SCORE}% | Pop: ${POP_SIZE} | Max gens: ${MAX_GENS}`);
  console.log(`Tileset: ${TILESET_PATH}`);
  console.log(`Target level: ${TARGET_LEVEL_PATH}`);
  console.log(`Results dir: ${RESULTS_DIR}`);

  // Pre-init tileset for faster first render
  try {
    await initTileset();
    console.log('Tileset initialized');
  } catch (e) {
    console.error(`Tileset init failed: ${e.message}`);
  }

  // Start Express
  app.listen(PORT, () => {
    console.log(`Dashboard: http://localhost:${PORT}`);
    console.log('Auto-training starting immediately...\n');

    // Start evolution immediately
    startEvolution();
  });
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
