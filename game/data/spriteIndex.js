/**
 * spriteIndex.js — Maps entity names to spritesheet coordinates
 *
 * Used by the rendering system to look up sprite regions.
 * Each entry maps a name to: { sheet, x, y, w, h, frames, frameW }
 * where x/y are the top-left pixel in the spritesheet,
 * w/h are the full region size, frames is the number of animation frames,
 * and frameW is the width of each frame (w / frames).
 *
 * When using procedural sprites (sprites.js), these entries serve as
 * the canonical name-to-key mapping and metadata reference.
 */

const SPRITE_INDEX = {
  // === Player ===
  princess: {
    sheet: 'characters',
    x: 0, y: 0, w: 48, h: 64,  // 3 frames x 4 directions
    frames: 3,
    frameW: 16,
    frameH: 16,
    directions: 4,
    // Direction layout: row 0=down, 1=left, 2=right, 3=up
    directionRows: { down: 0, left: 1, right: 2, up: 3 }
  },

  // === Companions ===
  unicorn: {
    sheet: 'characters',
    x: 0, y: 64, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  dragon: {
    sheet: 'characters',
    x: 0, y: 80, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  bunny: {
    sheet: 'characters',
    x: 0, y: 96, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  butterfly: {
    sheet: 'characters',
    x: 0, y: 112, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  fox: {
    sheet: 'characters',
    x: 0, y: 128, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },

  // === NPCs ===
  npc_grandma: {
    sheet: 'characters',
    x: 0, y: 144, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  npc_finn: {
    sheet: 'characters',
    x: 0, y: 160, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  npc_lily: {
    sheet: 'characters',
    x: 0, y: 176, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  npc_baker: {
    sheet: 'characters',
    x: 0, y: 192, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },
  npc_melody: {
    sheet: 'characters',
    x: 0, y: 208, w: 32, h: 16,
    frames: 2,
    frameW: 16,
    frameH: 16,
    directions: 1
  },

  // === Animals ===
  cat: {
    sheet: 'animals',
    x: 0, y: 0, w: 32, h: 16,
    frames: 2, frameW: 16, frameH: 16, directions: 1
  },
  dog: {
    sheet: 'animals',
    x: 0, y: 16, w: 32, h: 16,
    frames: 2, frameW: 16, frameH: 16, directions: 1
  },
  bird: {
    sheet: 'animals',
    x: 0, y: 32, w: 32, h: 8,
    frames: 2, frameW: 16, frameH: 8, directions: 1
  },
  frog: {
    sheet: 'animals',
    x: 0, y: 40, w: 32, h: 8,
    frames: 2, frameW: 16, frameH: 8, directions: 1
  },
  duck: {
    sheet: 'animals',
    x: 0, y: 48, w: 32, h: 12,
    frames: 2, frameW: 16, frameH: 12, directions: 1
  },
  squirrel: {
    sheet: 'animals',
    x: 0, y: 60, w: 32, h: 12,
    frames: 2, frameW: 16, frameH: 12, directions: 1
  },
  rabbit: {
    sheet: 'animals',
    x: 0, y: 72, w: 32, h: 12,
    frames: 2, frameW: 16, frameH: 12, directions: 1
  },
  hedgehog: {
    sheet: 'animals',
    x: 0, y: 84, w: 32, h: 10,
    frames: 2, frameW: 16, frameH: 10, directions: 1
  },
  firefly: {
    sheet: 'animals',
    x: 0, y: 94, w: 16, h: 4,
    frames: 2, frameW: 8, frameH: 4, directions: 1
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
