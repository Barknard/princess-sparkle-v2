#!/usr/bin/env node
/**
 * level-to-tmj.js — Convert JS level file to Tiled JSON (.tmj)
 *
 * Reads the game's level-sparkle-village.js, extracts tile layer data,
 * and writes a .tmj file that can be opened in the Tiled editor.
 *
 * Usage:
 *   node tools/level-to-tmj.js
 *
 * Output: levels/sparkle-village.tmj (in project root, for browser fetch)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LEVEL_JS = path.join(PROJECT_ROOT, 'game', 'levels', 'level-sparkle-village.js');
const OUTPUT_TMJ = path.join(PROJECT_ROOT, 'levels', 'sparkle-village.tmj');

// ── Parse the level JS file ──────────────────────────────────────────────────
// We can't import ES modules directly in CommonJS, so we parse the arrays
// from the source text using eval in a controlled way.

const src = fs.readFileSync(LEVEL_JS, 'utf8');

// Extract the grid helper
function grid(rows) {
  const arr = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      arr.push(rows[y][x]);
    }
  }
  return arr;
}

/**
 * Extract a named grid array from the source file.
 * Matches: const NAME = grid([ ... ]);
 */
function extractGrid(name) {
  // Find "const <name> = grid(["
  const startPattern = `const ${name} = grid([`;
  const startIdx = src.indexOf(startPattern);
  if (startIdx === -1) {
    throw new Error(`Could not find "${startPattern}" in level file`);
  }

  // Find the matching end: ]);
  // We need to count bracket depth
  let depth = 0;
  let inArray = false;
  let arrayStart = startIdx + `const ${name} = grid`.length;

  for (let i = arrayStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') {
      depth++;
      if (!inArray) inArray = true;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && inArray) {
        // Extract the argument to grid(...)
        const gridCall = src.substring(arrayStart, i + 1);
        // Evaluate: grid([...])
        try {
          return eval(`grid${gridCall}`);
        } catch (e) {
          throw new Error(`Failed to evaluate grid data for "${name}": ${e.message}`);
        }
      }
    }
  }

  throw new Error(`Could not find closing bracket for "${name}" grid`);
}

// Extract all four layers
const groundData = extractGrid('ground');
const objectsData = extractGrid('objects');
const collisionData = extractGrid('collision');
const foregroundData = extractGrid('foreground');

const WIDTH = 60;
const HEIGHT = 40;
const TOTAL = WIDTH * HEIGHT;
const FIRSTGID = 1;

// Verify sizes
for (const [name, data] of [['ground', groundData], ['objects', objectsData], ['collision', collisionData], ['foreground', foregroundData]]) {
  if (data.length !== TOTAL) {
    console.warn(`Warning: ${name} layer has ${data.length} tiles, expected ${TOTAL}`);
  }
}

/**
 * Convert local tile IDs to Tiled GIDs.
 * tileID >= 0 → GID = tileID + firstgid
 * tileID = -1 (empty) → GID = 0
 */
function toGids(tileIds) {
  return tileIds.map(id => (id < 0) ? 0 : id + FIRSTGID);
}

/**
 * Convert collision layer: 0 = walkable → GID 0, 1 = blocked → GID firstgid
 */
function collisionToGids(collisionIds) {
  return collisionIds.map(v => v > 0 ? FIRSTGID : 0);
}

// ── Build the Tiled JSON structure ───────────────────────────────────────────

const tmj = {
  compressionlevel: -1,
  height: HEIGHT,
  infinite: false,
  layers: [
    {
      data: toGids(groundData),
      height: HEIGHT,
      id: 1,
      name: 'ground',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: WIDTH,
      x: 0,
      y: 0,
    },
    {
      data: toGids(objectsData),
      height: HEIGHT,
      id: 2,
      name: 'objects',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: WIDTH,
      x: 0,
      y: 0,
    },
    {
      data: toGids(foregroundData),
      height: HEIGHT,
      id: 3,
      name: 'foreground',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: WIDTH,
      x: 0,
      y: 0,
    },
    {
      data: collisionToGids(collisionData),
      height: HEIGHT,
      id: 4,
      name: 'collision',
      opacity: 0.5,
      type: 'tilelayer',
      visible: true,
      width: WIDTH,
      x: 0,
      y: 0,
    },
  ],
  nextlayerid: 5,
  nextobjectid: 1,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.10.2',
  tileheight: 16,
  tilesets: [
    {
      columns: 12,
      firstgid: FIRSTGID,
      image: '../sprites/town/tilemap_packed.png',
      imageheight: 176,
      imagewidth: 192,
      margin: 0,
      name: 'Kenney Tiny Town',
      spacing: 0,
      tilecount: 132,
      tileheight: 16,
      tilewidth: 16,
    },
  ],
  tilewidth: 16,
  type: 'map',
  version: '1.10',
  width: WIDTH,
};

// ── Write output ─────────────────────────────────────────────────────────────

// Ensure output directory exists
const outDir = path.dirname(OUTPUT_TMJ);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(OUTPUT_TMJ, JSON.stringify(tmj, null, 2), 'utf8');
console.log(`Exported: ${OUTPUT_TMJ}`);
console.log(`  ${WIDTH}x${HEIGHT} map (${TOTAL} tiles per layer)`);
console.log(`  Layers: ground, objects, foreground, collision`);
console.log(`  Tileset: Kenney Tiny Town (firstgid=${FIRSTGID})`);
console.log('');
console.log('Open in Tiled editor to start editing!');
