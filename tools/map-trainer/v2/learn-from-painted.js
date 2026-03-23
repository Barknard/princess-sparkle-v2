#!/usr/bin/env node
/**
 * learn-from-painted.js — Feed the hand-painted map into the V2 learner
 *
 * Extracts tile adjacency, cross-layer relationships, and composites
 * from the user's hand-painted 24x14 map and saves as learned knowledge.
 * This is GROUND TRUTH data — the user manually placed every tile.
 */

const fs = require('fs');
const path = require('path');
const { V2Learner, tileLayer } = require('./v2-learner');

const V2_DIR = __dirname;
const PAINTED_PATH = path.join(V2_DIR, 'painted-map.json');
const KNOWLEDGE_PATH = path.join(V2_DIR, 'learned-knowledge-v2.json');

// Load painted map
const painted = JSON.parse(fs.readFileSync(PAINTED_PATH, 'utf8'));
console.log(`Painted map: ${painted.width}x${painted.height}`);

// Load or create learner
const learner = new V2Learner();
if (fs.existsSync(KNOWLEDGE_PATH)) {
  learner.loadFromFile(KNOWLEDGE_PATH);
  console.log('Loaded existing knowledge:', learner.getStats());
}

// Learn from painted map with HIGHEST weight (human ground truth = 100x)
console.log('\nLearning from painted map (100x weight — human ground truth)...');
learner.learnFromMap(painted, 100);

// Also learn CROSS-LAYER relationships — what objects sit on which ground
// This is critical context the model was missing
const crossLayer = {
  groundToObjects: {},   // ground tile → what objects can sit on it
  groundToForeground: {}, // ground tile → what foreground can be above it
  objectsToForeground: {}, // objects tile → what foreground can be above it
};

for (let i = 0; i < painted.width * painted.height; i++) {
  const g = painted.ground[i];
  const o = painted.objects[i];
  const f = painted.foreground[i];

  if (g >= 0 && o >= 0) {
    if (!crossLayer.groundToObjects[g]) crossLayer.groundToObjects[g] = {};
    crossLayer.groundToObjects[g][o] = (crossLayer.groundToObjects[g][o] || 0) + 1;
  }
  if (g >= 0 && f >= 0) {
    if (!crossLayer.groundToForeground[g]) crossLayer.groundToForeground[g] = {};
    crossLayer.groundToForeground[g][f] = (crossLayer.groundToForeground[g][f] || 0) + 1;
  }
  if (f >= 0) {
    const oKey = o >= 0 ? o : 'empty';
    if (!crossLayer.objectsToForeground[oKey]) crossLayer.objectsToForeground[oKey] = {};
    crossLayer.objectsToForeground[oKey][f] = (crossLayer.objectsToForeground[oKey][f] || 0) + 1;
  }
}

// Extract vertical building patterns (what's above what in objects layer)
console.log('\nBuilding column patterns (objects layer, vertical):');
const vertPatterns = {};
for (let x = 0; x < painted.width; x++) {
  const col = [];
  for (let y = 0; y < painted.height; y++) {
    const t = painted.objects[y * painted.width + x];
    if (t >= 0 && t < 200) col.push({ y, tile: t });
  }
  // Find vertical runs of 2+ consecutive tiles
  for (let i = 0; i < col.length - 1; i++) {
    if (col[i + 1].y === col[i].y + 1) {
      const key = col[i].tile + '→below→' + col[i + 1].tile;
      vertPatterns[key] = (vertPatterns[key] || 0) + 1;
    }
  }
}
Object.entries(vertPatterns).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log('  ' + k + ' (' + v + 'x)');
});

// Extract horizontal building patterns
console.log('\nBuilding row patterns (objects layer, horizontal):');
const horzPatterns = {};
for (let y = 0; y < painted.height; y++) {
  for (let x = 0; x < painted.width - 1; x++) {
    const t1 = painted.objects[y * painted.width + x];
    const t2 = painted.objects[y * painted.width + (x + 1)];
    if (t1 >= 0 && t1 < 200 && t2 >= 0 && t2 < 200) {
      const key = t1 + '→right→' + t2;
      horzPatterns[key] = (horzPatterns[key] || 0) + 1;
    }
  }
}
Object.entries(horzPatterns).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log('  ' + k + ' (' + v + 'x)');
});

// Save learner first so the file exists
learner.saveToFile(KNOWLEDGE_PATH);

// Now enrich the knowledge file with cross-layer data
const knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_PATH, 'utf8'));
knowledge.crossLayer = crossLayer;
knowledge.paintedMapPatterns = {
  vertical: vertPatterns,
  horizontal: horzPatterns,
  mapSize: { width: painted.width, height: painted.height },
  groundFill: (() => {
    const freq = {};
    painted.ground.forEach(t => { if (t >= 0) freq[t] = (freq[t] || 0) + 1; });
    return freq;
  })(),
};
fs.writeFileSync(KNOWLEDGE_PATH, JSON.stringify(knowledge, null, 2));

// Also save learner state
learner.saveToFile(KNOWLEDGE_PATH);

console.log('\nKnowledge saved:', learner.getStats());
console.log('Cross-layer rules:', Object.keys(crossLayer.groundToObjects).length, 'ground→objects mappings');
console.log('Building vertical patterns:', Object.keys(vertPatterns).length);
console.log('Building horizontal patterns:', Object.keys(horzPatterns).length);

// Print layer assignment verification
console.log('\nLAYER VERIFICATION:');
const layerMismatches = [];
const tileNames = { 0: 'sparkle', 1: 'grass', 2: 'grass+flowers', 43: 'white flowers' };
for (let i = 0; i < painted.width * painted.height; i++) {
  for (const [layerName, expected] of [['ground', 'ground'], ['objects', 'objects'], ['foreground', 'foreground']]) {
    const t = painted[layerName][i];
    if (t < 0 || t >= 200) continue;
    const actual = tileLayer(t);
    if (actual && actual !== expected) {
      layerMismatches.push({ tile: t, expected: expected, actual: actual, pos: { x: i % painted.width, y: Math.floor(i / painted.width) } });
    }
  }
}
if (layerMismatches.length > 0) {
  console.log('  MISMATCHES (tiles on wrong layer):');
  const seen = new Set();
  layerMismatches.forEach(m => {
    const key = m.tile + ':' + m.expected;
    if (!seen.has(key)) {
      seen.add(key);
      console.log('    Tile ' + m.tile + ' on ' + m.expected + ' layer (expected: ' + m.actual + ')');
    }
  });
  console.log('  → These tiles teach the model new layer flexibility');
} else {
  console.log('  All tiles on expected layers ✓');
}

console.log('\nDone. The model now knows how YOU build maps.');
