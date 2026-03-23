#!/usr/bin/env node
/**
 * overlapping-wfc-generator.js — THE breakthrough generator
 *
 * Uses WFC Overlapping Model to learn NxN tile patterns from a target map
 * and generate new maps with the same local structure.
 *
 * The trick: encode each tile ID as a unique RGBA color, feed to the
 * overlapping model as a "pixel image", decode output back to tile IDs.
 *
 * This captures 3x3 tile patterns (building fragments, path junctions,
 * tree clusters) instead of just pairwise adjacency — the missing piece.
 */

const fs = require('fs');
const path = require('path');
const wfc = require('wavefunctioncollapse');

const { loadTargetMap, scoreTileMatch } = require('./tile-match-scorer');
const { auditMap } = require('./self-audit');
const { renderMapToPng } = require('./tile-renderer');
const { TileRelationshipLearner } = require('./tile-relationship-learner');
const { SpatialGrammar } = require('./spatial-grammar');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TRAINER_DIR = __dirname;
const TILESET_PATH = path.join(PROJECT_ROOT, 'sprites', 'town', 'tilemap_packed.png');
const RESULTS_DIR = path.join(TRAINER_DIR, 'batch-results');
const KNOWLEDGE_PATH = path.join(TRAINER_DIR, 'learned-tile-knowledge.json');

if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

// ── Tile ID ↔ RGBA Color encoding ──────────────────────────────────────
// Each tile ID (0-131, plus -1 for empty) gets a unique RGBA color.
// We use R channel = tileId + 1 (so -1 maps to 0, tile 0 maps to 1, etc.)
// G, B, A are fixed at 0, 0, 255

function tileToColor(tileId) {
  const v = tileId + 1; // shift so -1 → 0, 0 → 1, 131 → 132
  return [v, 0, 0, 255]; // RGBA
}

function colorToTile(r, g, b, a) {
  return r - 1; // reverse: 0 → -1, 1 → 0, 132 → 131
}

/**
 * Encode a tile layer (flat array of tile IDs) as RGBA pixel data
 * @param {number[]} layer - flat row-major array of tile IDs
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array} RGBA pixel buffer
 */
function encodeLayer(layer, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b, a] = tileToColor(layer[i] ?? -1);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return data;
}

/**
 * Decode RGBA pixel data back to tile IDs
 * @param {Uint8Array|number[]} data - RGBA pixel buffer
 * @param {number} width
 * @param {number} height
 * @returns {number[]} flat array of tile IDs
 */
function decodeLayer(data, width, height) {
  const tiles = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    tiles[i] = colorToTile(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]);
  }
  return tiles;
}

/**
 * Encode all 3 layers into a single composite color per cell.
 * R = ground tile + 1, G = objects tile + 1, B = foreground tile + 1, A = 255
 * This lets the overlapping model learn CROSS-LAYER patterns.
 */
function encodeMultiLayer(ground, objects, foreground, width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = (ground[i] ?? -1) + 1;     // R = ground
    data[i * 4 + 1] = (objects[i] ?? -1) + 1;  // G = objects
    data[i * 4 + 2] = (foreground[i] ?? -1) + 1; // B = foreground
    data[i * 4 + 3] = 255;
  }
  return data;
}

/**
 * Decode composite color back to 3 layers
 */
function decodeMultiLayer(data, width, height) {
  const ground = new Array(width * height);
  const objects = new Array(width * height);
  const foreground = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    ground[i] = data[i * 4] - 1;
    objects[i] = data[i * 4 + 1] - 1;
    foreground[i] = data[i * 4 + 2] - 1;
  }
  return { ground, objects, foreground };
}

/**
 * Generate a map using WFC Overlapping Model learned from a target
 * @param {Object} options
 * @param {Object} options.target - { width, height, ground, objects, foreground } from loadTargetMap
 * @param {number} [options.N=3] - Pattern size (3 is sweet spot for tile maps)
 * @param {number} [options.outWidth] - Output width (default: same as target)
 * @param {number} [options.outHeight] - Output height (default: same as target)
 * @param {boolean} [options.multiLayer=true] - Learn cross-layer patterns
 * @param {boolean} [options.periodic=false] - Wrap around edges
 * @param {number} [options.maxAttempts=20] - Max WFC attempts
 * @returns {{ success: boolean, ground: number[], objects: number[], foreground: number[], collision: number[], width: number, height: number, attempts: number }}
 */
function generateOverlapping(options) {
  const { target } = options;
  const N = options.N || 3;
  const outW = options.outWidth || target.width;
  const outH = options.outHeight || target.height;
  const periodic = options.periodic || false;
  const maxAttempts = options.maxAttempts || 20;
  const multiLayer = options.multiLayer !== false;

  // Encode target as pixel data
  let inputData;
  if (multiLayer) {
    inputData = encodeMultiLayer(target.ground, target.objects, target.foreground, target.width, target.height);
  } else {
    inputData = encodeLayer(target.ground, target.width, target.height);
  }

  // Run WFC Overlapping Model
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const model = new wfc.OverlappingModel(
        inputData,          // input pixel data (Uint8Array RGBA)
        target.width,       // input width
        target.height,      // input height
        N,                  // pattern size
        outW,               // output width
        outH,               // output height
        periodic,           // periodic input
        periodic,           // periodic output
        8                   // symmetry (8 = all rotations/reflections, 1 = none)
      );

      const success = model.generate(Math.random);

      if (success) {
        const output = model.graphics();

        let ground, objects, foreground;
        if (multiLayer) {
          ({ ground, objects, foreground } = decodeMultiLayer(output, outW, outH));
        } else {
          ground = decodeLayer(output, outW, outH);
          objects = new Array(outW * outH).fill(-1);
          foreground = new Array(outW * outH).fill(-1);
        }

        // Generate collision from objects
        const collision = new Array(outW * outH).fill(0);
        const WALKABLE = new Set([-1, 74, 86, 57, 80]); // empty, doors, arches
        for (let i = 0; i < outW * outH; i++) {
          if (objects[i] !== -1 && !WALKABLE.has(objects[i])) collision[i] = 1;
        }

        return {
          success: true,
          ground, objects, foreground, collision,
          width: outW, height: outH,
          attempts: attempt
        };
      }
    } catch (e) {
      // WFC can throw on contradiction — retry
      if (attempt === maxAttempts) {
        console.warn(`  WFC failed after ${maxAttempts} attempts: ${e.message}`);
      }
    }
  }

  return { success: false, attempts: maxAttempts, width: outW, height: outH,
    ground: new Array(outW * outH).fill(1),
    objects: new Array(outW * outH).fill(-1),
    foreground: new Array(outW * outH).fill(-1),
    collision: new Array(outW * outH).fill(0)
  };
}

/**
 * Generate a map per layer (higher success rate, no cross-layer patterns)
 */
function generatePerLayer(options) {
  const { target } = options;
  const N = options.N || 3;
  const outW = options.outWidth || target.width;
  const outH = options.outHeight || target.height;
  const periodic = options.periodic || false;
  const maxAttempts = options.maxAttempts || 20;

  const layers = { ground: target.ground, objects: target.objects, foreground: target.foreground };
  const result = { width: outW, height: outH, success: true, attempts: 0 };

  for (const [name, layer] of Object.entries(layers)) {
    const inputData = encodeLayer(layer, target.width, target.height);
    let layerResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Use symmetry=1 (no rotations) for structural layers, 8 for ground
        const symmetry = name === 'ground' ? 4 : 1;
        const model = new wfc.OverlappingModel(
          inputData, target.width, target.height,
          N, outW, outH, periodic, periodic, symmetry
        );
        if (model.generate(Math.random)) {
          layerResult = decodeLayer(model.graphics(), outW, outH);
          result.attempts = Math.max(result.attempts, attempt);
          break;
        }
      } catch (e) {
        // retry
      }
    }

    if (!layerResult) {
      console.warn(`  Layer ${name} failed — using fallback`);
      layerResult = name === 'ground' ? new Array(outW * outH).fill(1) : new Array(outW * outH).fill(-1);
      result.success = false;
    }
    result[name] = layerResult;
  }

  // Collision
  result.collision = new Array(outW * outH).fill(0);
  const WALKABLE = new Set([-1, 74, 86, 57, 80]);
  for (let i = 0; i < outW * outH; i++) {
    if (result.objects[i] !== -1 && !WALKABLE.has(result.objects[i])) result.collision[i] = 1;
  }

  return result;
}

module.exports = { generateOverlapping, generatePerLayer, encodeLayer, decodeLayer, encodeMultiLayer, decodeMultiLayer };

// ── Main: test it ───────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    console.log('\n  WFC OVERLAPPING MODEL — Pattern-based map generation\n');

    // Load target
    const targetPath = path.join(PROJECT_ROOT, 'game', 'levels', 'level-sparkle-village.js');
    const target = loadTargetMap(targetPath);
    console.log(`  Target: ${target.width}x${target.height}`);

    // Method 1: Multi-layer (learns cross-layer patterns)
    console.log('\n  --- Multi-layer N=3 ---');
    console.time('  multi-layer');
    const ml = generateOverlapping({ target, N: 3, multiLayer: true, maxAttempts: 10 });
    console.timeEnd('  multi-layer');
    console.log(`  Success: ${ml.success}, Attempts: ${ml.attempts}`);
    if (ml.success) {
      const mlMatch = scoreTileMatch(ml, target);
      console.log(`  Match: ${mlMatch.score.toFixed(2)}% (g:${mlMatch.groundMatch.toFixed(1)} o:${mlMatch.objectsMatch.toFixed(1)} f:${mlMatch.foregroundMatch.toFixed(1)})`);
      const mlAudit = auditMap(ml);
      console.log(`  Audit: ${mlAudit.score}`);
      const pngBuf = await renderMapToPng(ml, TILESET_PATH);
      fs.writeFileSync(path.join(RESULTS_DIR, 'overlapping_multilayer_n3.png'), pngBuf);
      console.log(`  Saved: overlapping_multilayer_n3.png`);
    }

    // Method 2: Per-layer (higher success rate)
    console.log('\n  --- Per-layer N=3 ---');
    console.time('  per-layer');
    const pl = generatePerLayer({ target, N: 3, maxAttempts: 10 });
    console.timeEnd('  per-layer');
    console.log(`  Success: ${pl.success}, Attempts: ${pl.attempts}`);
    const plMatch = scoreTileMatch(pl, target);
    console.log(`  Match: ${plMatch.score.toFixed(2)}% (g:${plMatch.groundMatch.toFixed(1)} o:${plMatch.objectsMatch.toFixed(1)} f:${plMatch.foregroundMatch.toFixed(1)})`);
    const plAudit = auditMap(pl);
    console.log(`  Audit: ${plAudit.score}`);
    const pngBuf2 = await renderMapToPng(pl, TILESET_PATH);
    fs.writeFileSync(path.join(RESULTS_DIR, 'overlapping_perlayer_n3.png'), pngBuf2);
    console.log(`  Saved: overlapping_perlayer_n3.png`);

    // Method 3: Ground only with N=4
    console.log('\n  --- Ground only N=4 ---');
    console.time('  ground-n4');
    const g4 = generatePerLayer({ target, N: 4, maxAttempts: 20 });
    console.timeEnd('  ground-n4');
    const g4Match = scoreTileMatch(g4, target);
    console.log(`  Match: ${g4Match.score.toFixed(2)}%`);

    // Learn from best result
    console.log('\n  --- Learning from results ---');
    const learner = new TileRelationshipLearner();
    if (fs.existsSync(KNOWLEDGE_PATH)) learner.loadFromFile(KNOWLEDGE_PATH);
    if (ml.success) learner.learnFromMap(ml, 90);
    learner.learnFromMap(pl, 80);
    learner.saveToFile(KNOWLEDGE_PATH);
    console.log(`  Knowledge: ${learner.getStats().totalRelationships} relationships`);

    console.log('\n  Done.\n');
  })();
}
