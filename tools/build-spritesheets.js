/**
 * build-spritesheets.js — Combines individual animation frames into spritesheets
 *
 * Reads individual frame PNGs from the Superdark Fantasy/Forest packs and
 * combines them into horizontal-strip spritesheets suitable for the game engine.
 *
 * Output layout per sheet (single row, 8 frames):
 *   Frames 0-1: Idle (used at 500ms per frame)
 *   Frames 2-3: Idle extra (present but unused by default)
 *   Frames 4-7: Walk (used at 150ms per frame)
 *
 * Each frame is 16x16 pixels.
 * Result: 128x16 spritesheet per character.
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
 * Layout: [Idle1, Idle2, Idle3, Idle4, Walk1, Walk2, Walk3, Walk4]
 */
const SHEET_DEFS = [
  {
    name: 'princess',
    frames: [
      path.join(CHAR_BASE, 'Princess', 'Princess_Idle_1.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Idle_2.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Idle_3.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Idle_4.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Walk_1.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Walk_2.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Walk_3.png'),
      path.join(CHAR_BASE, 'Princess', 'Princess_Walk_4.png'),
    ],
  },
  {
    name: 'merchant',
    frames: [
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Idle_1.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Idle_2.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Idle_3.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Idle_4.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Walk_1.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Walk_2.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Walk_3.png'),
      path.join(CHAR_BASE, 'Merchant', 'Merchant_Walk_4.png'),
    ],
  },
  {
    name: 'townsfolk-male',
    frames: [
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Idle_1.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Idle_2.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Idle_3.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Idle_4.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Walk_1.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Walk_2.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Walk_3.png'),
      path.join(CHAR_BASE, 'Townsfolk - Male', 'Townsfolk_M_Walk_4.png'),
    ],
  },
  {
    name: 'townsfolk-female',
    frames: [
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Idle_1.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Idle_2.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Idle_3.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Idle_4.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Walk_1.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Walk_2.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Walk_3.png'),
      path.join(CHAR_BASE, 'Townsfolk - Female', 'Townsfolk_F_Walk_4.png'),
    ],
  },
  {
    name: 'wolf',
    frames: [
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Idle_1.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Idle_2.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Idle_3.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Idle_4.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Walk_1.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Walk_2.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Walk_3.png'),
      path.join(CREATURE_BASE, 'Wolf', 'Wolf_Walk_4.png'),
    ],
  },
  {
    // Fairy has combined Idle+Walk frames (4 frames total, duplicated to fill 8)
    name: 'fairy',
    frames: [
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_1.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_2.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_3.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_4.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_1.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_2.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_3.png'),
      path.join(CREATURE_BASE, 'Fairy', 'Fairy_Idle + Walk_4.png'),
    ],
  },

  // ── Superdark Fantasy RPG NPCs ──────────────────────────────────────────
  {
    name: 'queen',
    frames: [
      path.join(CHAR_BASE, 'Queen', 'Queen_Idle_1.png'),
      path.join(CHAR_BASE, 'Queen', 'Queen_Idle_2.png'),
      path.join(CHAR_BASE, 'Queen', 'Queen_Idle_3.png'),
      path.join(CHAR_BASE, 'Queen', 'Queen_Idle_4.png'),
      path.join(CHAR_BASE, 'Queen', 'Queen_Walk_1.png'),
      path.join(CHAR_BASE, 'Queen', 'Queen_Walk_2.png'),
      path.join(CHAR_BASE, 'Queen', 'Queen_Walk_3.png'),
      path.join(CHAR_BASE, 'Queen', 'Queen_Walk_4.png'),
    ],
  },
  {
    name: 'alchemist',
    frames: [
      path.join(CHAR_BASE, 'Alchemist', 'Alchemist_Idle_1.png'),
      path.join(CHAR_BASE, 'Alchemist', 'Alchemist_Idle_2.png'),
      path.join(CHAR_BASE, 'Alchemist', 'Alchemist_Idle_3.png'),
      path.join(CHAR_BASE, 'Alchemist', 'Alchemist_Idle_4.png'),
      path.join(CHAR_BASE, 'Alchemist', 'Alchemist_Walk_1.png'),
      path.join(CHAR_BASE, 'Alchemist', 'Alchemist_Walk_2.png'),
      path.join(CHAR_BASE, 'Alchemist', 'Alchemist_Walk_3.png'),
      path.join(CHAR_BASE, 'Alchemist', 'Alchemist_Walk_4.png'),
    ],
  },
  {
    name: 'blacksmith',
    frames: [
      path.join(CHAR_BASE, 'Blacksmith', 'Blacksmith_Idle_1.png'),
      path.join(CHAR_BASE, 'Blacksmith', 'Blacksmith_Idle_2.png'),
      path.join(CHAR_BASE, 'Blacksmith', 'Blacksmith_Idle_3.png'),
      path.join(CHAR_BASE, 'Blacksmith', 'Blacksmith_Idle_4.png'),
      path.join(CHAR_BASE, 'Blacksmith', 'Blacksmith_Walk_1.png'),
      path.join(CHAR_BASE, 'Blacksmith', 'Blacksmith_Walk_2.png'),
      path.join(CHAR_BASE, 'Blacksmith', 'Blacksmith_Walk_3.png'),
      path.join(CHAR_BASE, 'Blacksmith', 'Blacksmith_Walk_4.png'),
    ],
  },
  {
    name: 'knight',
    frames: [
      path.join(CHAR_BASE, 'Knight - Standard', 'Knight_Idle_1.png'),
      path.join(CHAR_BASE, 'Knight - Standard', 'Knight_Idle_2.png'),
      path.join(CHAR_BASE, 'Knight - Standard', 'Knight_Idle_3.png'),
      path.join(CHAR_BASE, 'Knight - Standard', 'Knight_Idle_4.png'),
      path.join(CHAR_BASE, 'Knight - Standard', 'Knight_Walk_1.png'),
      path.join(CHAR_BASE, 'Knight - Standard', 'Knight_Walk_2.png'),
      path.join(CHAR_BASE, 'Knight - Standard', 'Knight_Walk_3.png'),
      path.join(CHAR_BASE, 'Knight - Standard', 'Knight_Walk_4.png'),
    ],
  },

  // ── Superdark Enchanted Forest Creatures ─────────────────────────────────
  {
    name: 'bear',
    frames: [
      path.join(CREATURE_BASE, 'Bear', 'Bear_Idle_1.png'),
      path.join(CREATURE_BASE, 'Bear', 'Bear_Idle_2.png'),
      path.join(CREATURE_BASE, 'Bear', 'Bear_Idle_3.png'),
      path.join(CREATURE_BASE, 'Bear', 'Bear_Idle_4.png'),
      path.join(CREATURE_BASE, 'Bear', 'Bear_Walk_1.png'),
      path.join(CREATURE_BASE, 'Bear', 'Bear_Walk_2.png'),
      path.join(CREATURE_BASE, 'Bear', 'Bear_Walk_3.png'),
      path.join(CREATURE_BASE, 'Bear', 'Bear_Walk_4.png'),
    ],
  },
  {
    name: 'elf-female',
    frames: [
      path.join(CREATURE_BASE, 'Elf - Female', 'Elf_F_Idle_1.png'),
      path.join(CREATURE_BASE, 'Elf - Female', 'Elf_F_Idle_2.png'),
      path.join(CREATURE_BASE, 'Elf - Female', 'Elf_F_Idle_3.png'),
      path.join(CREATURE_BASE, 'Elf - Female', 'Elf_F_Idle_4.png'),
      path.join(CREATURE_BASE, 'Elf - Female', 'Elf_F_Walk_1.png'),
      path.join(CREATURE_BASE, 'Elf - Female', 'Elf_F_Walk_2.png'),
      path.join(CREATURE_BASE, 'Elf - Female', 'Elf_F_Walk_3.png'),
      path.join(CREATURE_BASE, 'Elf - Female', 'Elf_F_Walk_4.png'),
    ],
  },
  {
    name: 'elf-princess',
    frames: [
      path.join(CREATURE_BASE, 'Elf Princess', 'HighElf_F_Idle_1.png'),
      path.join(CREATURE_BASE, 'Elf Princess', 'HighElf_F_Idle_2.png'),
      path.join(CREATURE_BASE, 'Elf Princess', 'HighElf_F_Idle_3.png'),
      path.join(CREATURE_BASE, 'Elf Princess', 'HighElf_F_Idle_4.png'),
      path.join(CREATURE_BASE, 'Elf Princess', 'HighElf_F_Walk_1.png'),
      path.join(CREATURE_BASE, 'Elf Princess', 'HighElf_F_Walk_2.png'),
      path.join(CREATURE_BASE, 'Elf Princess', 'HighElf_F_Walk_3.png'),
      path.join(CREATURE_BASE, 'Elf Princess', 'HighElf_F_Walk_4.png'),
    ],
  },
  {
    name: 'ranger',
    frames: [
      path.join(CREATURE_BASE, 'Ranger', 'Ranger_Idle_1.png'),
      path.join(CREATURE_BASE, 'Ranger', 'Ranger_Idle_2.png'),
      path.join(CREATURE_BASE, 'Ranger', 'Ranger_Idle_3.png'),
      path.join(CREATURE_BASE, 'Ranger', 'Ranger_Idle_4.png'),
      path.join(CREATURE_BASE, 'Ranger', 'Ranger_Walk_1.png'),
      path.join(CREATURE_BASE, 'Ranger', 'Ranger_Walk_2.png'),
      path.join(CREATURE_BASE, 'Ranger', 'Ranger_Walk_3.png'),
      path.join(CREATURE_BASE, 'Ranger', 'Ranger_Walk_4.png'),
    ],
  },
  {
    name: 'mushroom-small',
    frames: [
      path.join(CREATURE_BASE, 'Mushroom - Small', 'SmallMushroom_Idle_1.png'),
      path.join(CREATURE_BASE, 'Mushroom - Small', 'SmallMushroom_Idle_2.png'),
      path.join(CREATURE_BASE, 'Mushroom - Small', 'SmallMushroom_Idle_3.png'),
      path.join(CREATURE_BASE, 'Mushroom - Small', 'SmallMushroom_Idle_4.png'),
      path.join(CREATURE_BASE, 'Mushroom - Small', 'SmallMushroom_Walk_1.png'),
      path.join(CREATURE_BASE, 'Mushroom - Small', 'SmallMushroom_Walk_2.png'),
      path.join(CREATURE_BASE, 'Mushroom - Small', 'SmallMushroom_Walk_3.png'),
      path.join(CREATURE_BASE, 'Mushroom - Small', 'SmallMushroom_Walk_4.png'),
    ],
  },
  {
    name: 'ent',
    frames: [
      path.join(CREATURE_BASE, 'Ent', 'Ent_Idle_1.png'),
      path.join(CREATURE_BASE, 'Ent', 'Ent_Idle_2.png'),
      path.join(CREATURE_BASE, 'Ent', 'Ent_Idle_3.png'),
      path.join(CREATURE_BASE, 'Ent', 'Ent_Idle_4.png'),
      path.join(CREATURE_BASE, 'Ent', 'Ent_Walk_1.png'),
      path.join(CREATURE_BASE, 'Ent', 'Ent_Walk_2.png'),
      path.join(CREATURE_BASE, 'Ent', 'Ent_Walk_3.png'),
      path.join(CREATURE_BASE, 'Ent', 'Ent_Walk_4.png'),
    ],
  },
  {
    name: 'forest-guardian',
    frames: [
      path.join(CREATURE_BASE, 'Forest Guardian', 'ForestGuardian_Idle_1.png'),
      path.join(CREATURE_BASE, 'Forest Guardian', 'ForestGuardian_Idle_2.png'),
      path.join(CREATURE_BASE, 'Forest Guardian', 'ForestGuardian_Idle_3.png'),
      path.join(CREATURE_BASE, 'Forest Guardian', 'ForestGuardian_Idle_4.png'),
      path.join(CREATURE_BASE, 'Forest Guardian', 'ForestGuardian_walk_1.png'),
      path.join(CREATURE_BASE, 'Forest Guardian', 'ForestGuardian_walk_2.png'),
      path.join(CREATURE_BASE, 'Forest Guardian', 'ForestGuardian_walk_3.png'),
      path.join(CREATURE_BASE, 'Forest Guardian', 'ForestGuardian_walk_4.png'),
    ],
  },
];

/**
 * Build a single spritesheet from frame files.
 * Single horizontal strip: all frames in one row.
 */
async function buildSheet(def) {
  const frameCount = def.frames.length;
  const sheetW = frameCount * FRAME_W;
  const sheetH = FRAME_H; // single row

  // Verify all source frames exist
  for (const framePath of def.frames) {
    if (!fs.existsSync(framePath)) {
      console.error(`  MISSING: ${framePath}`);
      console.error(`  Skipping sheet "${def.name}"`);
      return;
    }
  }

  // Build composite operations — single row
  const composites = [];
  for (let i = 0; i < frameCount; i++) {
    const buf = await sharp(def.frames[i])
      .resize(FRAME_W, FRAME_H, { fit: 'fill', kernel: 'nearest' })
      .png()
      .toBuffer();
    composites.push({
      input: buf,
      left: i * FRAME_W,
      top: 0,
    });
  }

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

  console.log(`  OK: ${def.name}.png (${sheetW}x${sheetH}, ${frameCount} frames — idle 0-1, walk 4-7)`);
}

async function main() {
  console.log('Building spritesheets...');
  console.log(`  Output: ${OUTPUT_DIR}`);
  console.log(`  Layout: single row [Idle1, Idle2, Idle3, Idle4, Walk1, Walk2, Walk3, Walk4]`);
  console.log('');

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
