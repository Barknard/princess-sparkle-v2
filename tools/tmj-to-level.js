#!/usr/bin/env node
/**
 * tmj-to-level.js — Convert a Tiled JSON (.tmj) file to the game's JS level format
 *
 * Reads a .tmj file, converts GID-based tile data to local tile IDs,
 * and merges the result into the existing JS level file (preserving
 * entity data: NPCs, quests, animals, worldObjects, dialogues, etc.).
 *
 * Usage:
 *   node tools/tmj-to-level.js [path-to-tmj]
 *
 * Default tmj path: levels/sparkle-village.tmj
 * Output: game/levels/level-sparkle-village.js
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const tmjArg = process.argv[2] || path.join(PROJECT_ROOT, 'levels', 'sparkle-village.tmj');
const TMJ_PATH = path.resolve(tmjArg);
const LEVEL_JS = path.join(PROJECT_ROOT, 'game', 'levels', 'level-sparkle-village.js');

// ── Read the .tmj ────────────────────────────────────────────────────────────

if (!fs.existsSync(TMJ_PATH)) {
  console.error(`Error: .tmj file not found: ${TMJ_PATH}`);
  console.error('Run "npm run map:export" first to create a .tmj from the current level.');
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(TMJ_PATH, 'utf8'));
const width = map.width;
const height = map.height;
const totalTiles = width * height;

// Get firstgid
const firstgid = (map.tilesets && map.tilesets.length > 0)
  ? (map.tilesets[0].firstgid || 1)
  : 1;

// Find layers by name
const layerMap = {};
for (const layer of map.layers) {
  if (layer.type === 'tilelayer' && layer.data) {
    layerMap[layer.name.toLowerCase()] = layer.data;
  }
}

/**
 * Convert GID array to local tile IDs.
 * GID 0 → emptyValue (-1 for tile layers)
 * GID > 0 → GID - firstgid
 */
function convertLayer(name, emptyValue) {
  const gids = layerMap[name];
  if (!gids) {
    console.warn(`Warning: layer "${name}" not found in .tmj, using empty`);
    return new Array(totalTiles).fill(emptyValue);
  }
  return gids.map(gid => gid === 0 ? emptyValue : gid - firstgid);
}

const groundData = convertLayer('ground', -1);
const objectsData = convertLayer('objects', -1);
const foregroundData = convertLayer('foreground', -1);

// Collision: GID 0 = walkable (0), GID > 0 = blocked (1)
const collisionGids = layerMap['collision'];
const collisionData = collisionGids
  ? collisionGids.map(gid => gid > 0 ? 1 : 0)
  : new Array(totalTiles).fill(0);

// ── Format as JS grid rows ──────────────────────────────────────────────────

function formatGrid(data, w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      row.push(data[y * w + x]);
    }
    rows.push('  [' + row.join(',') + ']');
  }
  return rows.join(',\n');
}

// ── Read existing level file for entity data ─────────────────────────────────

if (!fs.existsSync(LEVEL_JS)) {
  console.error(`Error: Existing level JS not found: ${LEVEL_JS}`);
  console.error('Cannot merge entity data without the existing file.');
  process.exit(1);
}

const existingSrc = fs.readFileSync(LEVEL_JS, 'utf8');

// Extract everything AFTER the foreground grid closing through the end of file.
// This includes NPCs, worldObjects, animals, quests, dialogues, transitions, etc.
// We look for the pattern after the last grid definition.

// Find the end of the foreground grid: "]);" followed by entity sections
// Strategy: find "// ── NPCs" or the export default and keep everything from NPCs onward
const npcMarker = '// ── NPCs';
const npcIdx = existingSrc.indexOf(npcMarker);

let entitySection = '';
if (npcIdx !== -1) {
  // Keep everything from NPCs onward, including the export block
  entitySection = existingSrc.substring(npcIdx);
}

// ── Write the new level file ─────────────────────────────────────────────────

const header = `/**
 * level-sparkle-village.js — Sparkle Village for Princess Sparkle V2
 *
 * TILE DATA imported from Tiled editor (.tmj) via tools/tmj-to-level.js
 * Entity data (NPCs, quests, animals, etc.) maintained in this file.
 *
 * ${width}x${height} tile grid (${width * 16}x${height * 16} pixels — 4x the viewport, camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Tile IDs reference the Kenney Tiny Town tileset (tilemap_packed.png):
 *   192x176 PNG, 12 columns x 11 rows of 16x16 tiles = 132 tiles.
 *   Tile ID = row * 12 + col.
 *
 * DEPTH LAYERS:
 *   ground     — Every cell filled: grass varieties + dirt paths
 *   objects    — Buildings, fences, tree trunks, furniture (-1 = empty)
 *   collision  — 0 = walkable, 1 = blocked
 *   foreground — Tree canopies drawn OVER entities for depth (-1 = empty)
 */

// ── Helper ──────────────────────────────────────────────────────────────────
function grid(rows) {
  const arr = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      arr.push(rows[y][x]);
    }
  }
  return arr;
}
`;

const groundSection = `// ── GROUND LAYER (${width}x${height} = ${totalTiles} tiles) ──────────────────────────────────────
// prettier-ignore
const ground = grid([
${formatGrid(groundData, width, height)}
]);`;

const objectsSection = `// ── OBJECTS LAYER (${width}x${height} = ${totalTiles} tiles) ─────────────────────────────────────
// prettier-ignore
const objects = grid([
${formatGrid(objectsData, width, height)}
]);`;

const collisionSection = `// ── COLLISION LAYER (${width}x${height} = ${totalTiles} tiles) ───────────────────────────────────
// prettier-ignore
const collision = grid([
${formatGrid(collisionData, width, height)}
]);`;

const foregroundSection = `// ── FOREGROUND LAYER (${width}x${height} = ${totalTiles} tiles) ──────────────────────────────────
// prettier-ignore
const foreground = grid([
${formatGrid(foregroundData, width, height)}
]);`;

const output = [
  header,
  groundSection,
  '',
  objectsSection,
  '',
  collisionSection,
  '',
  foregroundSection,
  '',
  entitySection,
].join('\n');

// Write the file
fs.writeFileSync(LEVEL_JS, output, 'utf8');

console.log(`Imported Tiled map into: ${LEVEL_JS}`);
console.log(`  Source: ${TMJ_PATH}`);
console.log(`  Map size: ${width}x${height} (${totalTiles} tiles per layer)`);
console.log(`  Firstgid: ${firstgid}`);
console.log(`  Layers converted: ground, objects, foreground, collision`);
console.log(`  Entity data preserved: NPCs, quests, animals, worldObjects, dialogues, transitions`);
