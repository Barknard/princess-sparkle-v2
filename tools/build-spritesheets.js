/**
 * build-spritesheets.js — Combines individual animation frames into spritesheets
 *
 * Reads individual frame PNGs from the Superdark Fantasy/Forest packs and
 * combines them into horizontal-strip spritesheets suitable for the game engine.
 *
 * Output layout per sheet:
 *   Row 0: Idle frames (left to right)
 *   Row 1: Walk frames (left to right)
 *
 * Each frame is 16x16 pixels.
 * A character with 4 idle + 4 walk frames = 64x32 spritesheet.
 *
 * Usage:  node tools/build-spritesheets.js
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Base directories
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CHAR_BASE = path.join(PROJECT_ROOT, 'sprites', 'characters', 'superdark-fantasy',
  'Fantasy RPG NPCs - Individuel Frames');
const CREATURE_BASE = path.join(PROJECT_ROOT, 'sprites', 'creatures', 'superdark-forest',
  'Enchanted Forest - Individual Frames');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'sprites', 'sheets');

// Frame size
const FRAME_W = 16;
const FRAME_H = 16;

/**
 * Character/creature definitions.
 * Each entry maps an output name to source frame paths.
 */
const SHEET_DEFS = [
  {
    name: 'princess',
    idle: [
      path.join(CHAR_BASE, 'Princess', 'Princess_Idle_1.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Idle_2.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Idle_3.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Idle_4.png'),
    ],
    walk: [
      path.join(CHAR_BASE, 'Princess', 'Princess_Walk_1.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Walk_2.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Walk_3.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Walk_4.png'),
    ],
  },
  {
    name: 'merchant',
    idle: [
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Idle_1.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Idle_2.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Idle_3.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Idle_4.png'),
    ],
    walk: [
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Walk_1.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Walk_2.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Walk_3.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Walk_4.png'),
    ],
  },
  {
    name: 'townsfolk-male',
    idle: [
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Idle_1.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Idle_2.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Idle_3.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Idle_4.png'),
    ],
    walk: [
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Walk_1.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Walk_2.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Walk_3.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Walk_4.png'),
    ],
  },
  {
    name: 'townsfolk-female',
    idle: [
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Idle_1.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Idle_2.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Idle_3.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Idle_4.png'),
    ],
    walk: [
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Walk_1.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Walk_2.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Walk_3.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Walk_4.png'),
    ],
  },
  {
    name: 'wolf',
    idle: [
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Idle_1.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Idle_2.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Idle_3.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Idle_4.png'),
    ],
    walk: [
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Walk_1.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Walk_2.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Walk_3.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Walk_4.png'),
    ],
  },
  {
    // Fairy has combined Idle+Walk frames (4 frames total, used for both)
    name: 'fairy',
    idle: [
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_1.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_2.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_3.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_4.png'),
    ],
    walk: [
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_1.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_2.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_3.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_4.png'),
    ],
  },
];

/**
 * Build a single spritesheet from frame files.
 *
 * @param {object} def - Sheet definition with name, idle[], walk[]
 * @returns {Promise<void>}
 */
async function buildSheet(def) {
  const idleCount = def.idle.length;
  const walkCount = def.walk.length;
  const cols = Math.max(idleCount, walkCount);
  const rows = 2; // row 0 = idle, row 1 = walk

  const sheetW = cols * FRAME_W;
  const sheetH = rows * FRAME_H;

  // Verify all source frames exist
  const allFrames = [...def.idle, ...def.walk];
  for (const framePath of allFrames) {
    if (!fs.existsSync(framePath)) {
      console.error(`  MISSING: ${framePath}`);
      console.error(`  Skipping sheet "${def.name}"`);
      return;
    }
  }

  // Build composite operations
  const composites = [];

  // Row 0: Idle frames
  for (let i = 0; i < idleCount; i++) {
    const buf = await sharp(def.idle[i])
      .resize(FRAME_W, FRAME_H, { fit: 'fill', kernel: 'nearest' })
      .png()
      .toBuffer();
    composites.push({
      input: buf,
      left: i * FRAME_W,
      top: 0,
    });
  }

  // Row 1: Walk frames
  for (let i = 0; i < walkCount; i++) {
    const buf = await sharp(def.walk[i])
      .resize(FRAME_W, FRAME_H, { fit: 'fill', kernel: 'nearest' })
      .png()
      .toBuffer();
    composites.push({
      input: buf,
      left: i * FRAME_W,
      top: FRAME_H,
    });
  }

  // Create the blank canvas and composite all frames
  const outPath = path.join(OUTPUT_DIR, `${def.name}.png`);
  await sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);

  console.log(`  OK: ${def.name}.png (${sheetW}x${sheetH}, ${idleCount} idle + ${walkCount} walk frames)`);
}

/**
 * Main: build all spritesheets.
 */
async function main() {
  console.log('Building spritesheets...');
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log('');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const def of SHEET_DEFS) {
    await buildSheet(def);
  }

  console.log('');
  console.log('Done! Spritesheets written to sprites/sheets/');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
