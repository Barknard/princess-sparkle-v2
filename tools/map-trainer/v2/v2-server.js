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
let MAX_GENS = 5000;
let POP_SIZE = 30;
let PORT = 3456;

for (const arg of args) {
  if (arg.startsWith('--target='))   TARGET_SCORE = parseFloat(arg.split('=')[1]);
  if (arg.startsWith('--max-gens=')) MAX_GENS = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--pop='))      POP_SIZE = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--port='))     PORT = parseInt(arg.split('=')[1]);
}

// ── Load existing modules from parent trainer dir ────────────────────────────
const { GeneticEvolver } = require(path.join(TRAINER_DIR, 'genetic-evolver'));
const { auditMap } = require(path.join(TRAINER_DIR, 'self-audit'));
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
      if (id >= 0 && id <= MAX_TILE_ID) uniqueIds.add(id);
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
      if (tileId < 0 || tileId > MAX_TILE_ID) continue;
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
  matchGrid: null
};

function addLog(msg) {
  status.log.push(msg);
  if (status.log.length > 100) status.log.shift();
  console.log(msg);
}

// ── Load target map ─────────────────────────────────────────────────────────
let targetMap = null;
try {
  targetMap = loadTargetMap(TARGET_LEVEL_PATH);
  console.log(`Target map loaded: ${targetMap.width}x${targetMap.height} (${targetMap.ground.length} tiles/layer)`);
} catch (e) {
  console.error(`ERROR: Could not load target map: ${e.message}`);
  process.exit(1);
}

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

// Learn from target map heavily (10x weight)
for (let i = 0; i < 10; i++) {
  learner.learnFromMap(targetMap, 100);
}
addLog('Learned from target map (10x weight)');

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
let bestMapPng = null;
let bestMapData = null;
let startTime = Date.now();
let stopRequested = false;

// ── Auto-train loop (non-blocking via setImmediate) ─────────────────────────
async function runGeneration() {
  if (stopRequested || status.generation >= MAX_GENS) {
    status.running = false;
    addLog(`Evolution stopped at gen ${status.generation}. Best: ${status.bestScore.toFixed(2)}%`);
    return;
  }

  status.generation++;
  status.elapsed = Date.now() - startTime;

  // Generate and score all individuals
  const scored = [];
  for (let i = 0; i < population.length; i++) {
    const dna = population[i];
    const map = evolver.generateFromDNA(dna);
    const audit = auditMap(map);
    const result = combinedScore(map, targetMap, audit);
    scored.push({
      dna,
      fitness: result.combined,
      tileMatch: result.tileMatch,
      designScore: result.designQuality,
      map,
      audit
    });
  }

  // Sort by fitness descending
  scored.sort((a, b) => b.fitness - a.fitness);
  const best = scored[0];
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
  if (status.history.length > 500) status.history.shift();

  // Log
  const genSpeed = status.generation / (status.elapsed / 1000);
  const logMsg = `Gen ${status.generation}: best=${best.fitness.toFixed(1)}% tile=${best.tileMatch.toFixed(1)}% audit=${best.designScore.toFixed(0)} div=${stats.diversity.toFixed(1)} [${genSpeed.toFixed(1)} gen/s]`;
  addLog(logMsg);

  // Learn from best map every generation
  learner.learnFromMap(best.map, best.fitness);

  // Save knowledge every 20 gens
  if (status.generation % 20 === 0) {
    try {
      learner.saveToFile(KNOWLEDGE_PATH);
      const kStats = learner.getStats();
      status.knowledgeRules = kStats.totalAdjacencies || kStats.adjacencyRules || 0;
    } catch (e) { /* ignore save errors */ }
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

  // Check for target reached
  if (status.bestScore >= TARGET_SCORE) {
    addLog(`TARGET REACHED at gen ${status.generation}! Score: ${status.bestScore.toFixed(2)}%`);
    status.running = false;
    // Final render
    try {
      if (bestMapData) {
        bestMapPng = await renderMapToPng(bestMapData);
        fs.writeFileSync(path.join(RESULTS_DIR, 'best-final.png'), bestMapPng);
      }
    } catch (e) { /* ignore */ }
    return;
  }

  // Check for plateau (best score hasn't improved in 200 gens)
  if (status.generation - status.bestGeneration > 200) {
    addLog(`PLATEAU detected: no improvement in 200 gens. Increasing mutation.`);
    evolver.mutationRate = Math.min(0.5, evolver.mutationRate + 0.05);
    evolver.mutationStrength = Math.min(0.6, evolver.mutationStrength + 0.05);
    // Reset plateau counter
    status.bestGeneration = status.generation;
  }

  // Evolve next generation
  population = evolver.evolveGeneration(scored);

  // Schedule next generation (non-blocking)
  setImmediate(runGeneration);
}

function startEvolution() {
  if (status.running) return;
  stopRequested = false;
  status.running = true;
  startTime = Date.now() - status.elapsed; // preserve elapsed if restarting
  addLog(`Starting evolution: target=${TARGET_SCORE}%, pop=${POP_SIZE}, max=${MAX_GENS}`);
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

// Reference image
app.get('/reference', (req, res) => {
  if (!fs.existsSync(REFERENCE_PATH)) {
    return res.status(404).send('Reference image not found');
  }
  res.sendFile(REFERENCE_PATH);
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
