/**
 * spriteIndex.js — Maps entity names to spritesheet coordinates
 *
 * Used by the rendering system to look up sprite regions.
 * Each entry maps a name to: { sheet, x, y, w, h, frames, frameW }
 * where x/y are the top-left pixel in the spritesheet,
 * w/h are the full region size, frames is the number of animation frames,
 * and frameW is the width of each frame (w / frames).
 *
 * AUTO-DISCOVERY: If a sprite name isn't in this index, the system tries
 * to load it by convention: sprites/{name}.png
 * Drop a new sprite file in the folder and it just works.
 *
 * When using procedural sprites (sprites.js), these entries serve as
 * the canonical name-to-key mapping and metadata reference.
 */

import { tryLoadImage } from './assetDiscovery.js';

const SPRITE_INDEX = {
  // === Player ===
  // Static frame from Kenney Tiny Dungeon tilemap_packed.png
  // Walk animation from rpg_16x16_8bit.png (character 0, 3 frames x 3 dirs)
  princess: {
    sheet: 'dungeon',
    sheetPath: './sprites/characters/kenney-tiny-dungeon/Tilemap/tilemap_packed.png',
    x: 48, y: 128, w: 16, h: 16,  // tile_0099: col=3, row=8 in 12-col packed sheet
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1,
    walkSheet: 'rpg8bit',
    walkSheetPath: './sprites/characters/rpg_16x16_8bit.png',
    walkFrames: 3,
    walkDirections: 3, // down, left/right, up
  },

  // === Companions (from Kenney Tiny Creatures tilemap_packed.png) ===
  // Tile numbers use 1-based file naming; packed index = tileNum - 1
  unicorn: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 32, y: 240, w: 16, h: 16,  // tile_0153: idx=152, col=2, row=15 in 10-col sheet
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1,
    runSheet: 'unicornRun',
    runSheetPath: './sprites/creatures/unicorn_running.png',
    runFrames: 4,
  },
  dragon: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 0, y: 64, w: 16, h: 16,    // tile_0041: idx=40, col=0, row=4
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  bunny: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 0, y: 208, w: 16, h: 16,   // tile_0131: idx=130, col=0, row=13
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  butterfly: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 96, y: 208, w: 16, h: 16,  // tile_0137: idx=136, col=6, row=13
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  fox: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 32, y: 208, w: 16, h: 16,  // tile_0133: idx=132, col=2, row=13
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },

  // === NPCs (from Kenney Tiny Dungeon tilemap_packed.png) ===
  npc_grandma: {
    sheet: 'dungeon',
    sheetPath: './sprites/characters/kenney-tiny-dungeon/Tilemap/tilemap_packed.png',
    x: 64, y: 128, w: 16, h: 16,  // tile_0100: col=4, row=8
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  npc_finn: {
    sheet: 'dungeon',
    sheetPath: './sprites/characters/kenney-tiny-dungeon/Tilemap/tilemap_packed.png',
    x: 0, y: 144, w: 16, h: 16,   // tile_0108: col=0, row=9
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  npc_lily: {
    sheet: 'dungeon',
    sheetPath: './sprites/characters/kenney-tiny-dungeon/Tilemap/tilemap_packed.png',
    x: 16, y: 144, w: 16, h: 16,  // tile_0109: col=1, row=9
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  npc_baker: {
    sheet: 'dungeon',
    sheetPath: './sprites/characters/kenney-tiny-dungeon/Tilemap/tilemap_packed.png',
    x: 32, y: 144, w: 16, h: 16,  // tile_0110: col=2, row=9
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  npc_melody: {
    sheet: 'dungeon',
    sheetPath: './sprites/characters/kenney-tiny-dungeon/Tilemap/tilemap_packed.png',
    x: 80, y: 128, w: 16, h: 16,  // tile_0101: col=5, row=8
    frames: 1,
    frameW: 16,
    frameH: 16,
    directions: 1
  },

  // === Animals (from Kenney Tiny Creatures tilemap_packed.png) ===
  cat: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 16, y: 208, w: 16, h: 16,  // tile_0132: idx=131, col=1, row=13
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },
  dog: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 128, y: 256, w: 16, h: 16, // tile_0169: idx=168, col=8, row=16
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },
  bird: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 112, y: 208, w: 16, h: 16, // tile_0138: idx=137, col=7, row=13
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },
  frog: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 96, y: 224, w: 16, h: 16,  // tile_0147: idx=146, col=6, row=14
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },
  duck: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 80, y: 224, w: 16, h: 16,  // tile_0146: idx=145, col=5, row=14
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },
  squirrel: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 48, y: 208, w: 16, h: 16,  // tile_0134: idx=133, col=3, row=13
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },
  rabbit: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 0, y: 208, w: 16, h: 16,   // same as bunny (tile_0131)
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },
  hedgehog: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 64, y: 208, w: 16, h: 16,  // tile_0135: idx=134, col=4, row=13
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },
  firefly: {
    sheet: 'creatures',
    sheetPath: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
    x: 128, y: 208, w: 16, h: 16, // tile_0139: idx=138, col=8, row=13
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },

  // === World Objects ===
  flower_small: {
    sheet: 'objects',
    x: 0, y: 0, w: 16, h: 16,
    frames: 2, frameW: 8, frameH: 8, directions: 1
  },
  flower_big: {
    sheet: 'objects',
    x: 0, y: 16, w: 16, h: 16,
    frames: 2, frameW: 8, frameH: 16, directions: 1
  },
  mushroom: {
    sheet: 'objects',
    x: 0, y: 32, w: 16, h: 16,
    frames: 1, frameW: 16, frameH: 16, directions: 1
  },

  // === UI Elements ===
  heart: {
    sheet: 'ui',
    x: 0, y: 0, w: 8, h: 8,
    frames: 1, frameW: 8, frameH: 8, directions: 1
  },
  star: {
    sheet: 'ui',
    x: 8, y: 0, w: 8, h: 8,
    frames: 1, frameW: 8, frameH: 8, directions: 1
  },
  quest_indicator: {
    sheet: 'ui',
    x: 16, y: 0, w: 16, h: 16,
    frames: 2, frameW: 8, frameH: 16, directions: 1
  }
};

/**
 * Get sprite info by name.
 * @param {string} name
 * @returns {object|null}
 */
export function getSprite(name) {
  return SPRITE_INDEX[name] || null;
}

/**
 * Get all sprite names.
 * @returns {string[]}
 */
export function getSpriteNames() {
  return Object.keys(SPRITE_INDEX);
}

/**
 * Check if a sprite exists.
 * @param {string} name
 * @returns {boolean}
 */
export function hasSprite(name) {
  return name in SPRITE_INDEX;
}

export default SPRITE_INDEX;

// ══════════════════════════════════════════════════════════════
// Auto-discovery fallback
// ══════════════════════════════════════════════════════════════

// Cache for discovered standalone sprite images not in the index
const _discoveredSprites = {};

/**
 * Sprite folder conventions for auto-discovery.
 * When a sprite name isn't in the index, we try these paths in order.
 */
const SPRITE_FOLDERS = [
  './sprites/',
  './sprites/portraits/',
  './sprites/tilesets/',
];

/**
 * Get sprite info by name, with auto-discovery fallback.
 *
 * Fast path: looks up the hardcoded SPRITE_INDEX first.
 * Fallback: tries to load sprites/{name}.png as a standalone image.
 * Returns the index entry if found, or a discovered image wrapper.
 *
 * @param {string} name - Sprite name
 * @returns {object|null} Sprite info from index, or null (use discoverSprite for async)
 */
export function getSpriteWithFallback(name) {
  // Fast path: in the index
  if (SPRITE_INDEX[name]) return SPRITE_INDEX[name];

  // Already discovered as standalone image
  if (_discoveredSprites[name] !== undefined) {
    return _discoveredSprites[name];
  }

  // Not found synchronously — caller should use discoverSprite() for async lookup
  return null;
}

/**
 * Try to auto-discover a standalone sprite image by convention.
 *
 * If the name is in the index, returns the index entry immediately.
 * If not, tries:
 *   1. sprites/{name}.png
 *   2. sprites/portraits/{name}.png
 *   3. sprites/tilesets/{name}.png
 *
 * On success, returns an object with { image, w, h, standalone: true }
 * so callers can distinguish from spritesheet entries.
 *
 * Results are cached so each name is only probed once.
 *
 * @param {string} name - Sprite name (e.g. 'new-character')
 * @returns {Promise<object|null>}
 */
export async function discoverSprite(name) {
  // Fast path: in the index
  if (SPRITE_INDEX[name]) return SPRITE_INDEX[name];

  // Already discovered
  if (_discoveredSprites[name] !== undefined) {
    return _discoveredSprites[name];
  }

  // Try convention paths
  for (const folder of SPRITE_FOLDERS) {
    const path = `${folder}${name}.png`;
    try {
      const image = await tryLoadImage(path);
      if (image) {
        const entry = {
          standalone: true,
          image,
          path,
          w: image.naturalWidth || image.width,
          h: image.naturalHeight || image.height,
          frames: 1,
          frameW: image.naturalWidth || image.width,
          frameH: image.naturalHeight || image.height,
          directions: 1,
        };
        _discoveredSprites[name] = entry;
        console.log(`spriteIndex: Auto-discovered sprite "${name}" at ${path}`);
        return entry;
      }
    } catch (err) {
      // Continue to next folder
    }
  }

  // Not found
  _discoveredSprites[name] = null;
  console.warn(`spriteIndex: Sprite "${name}" not found in index or by convention`);
  return null;
}
