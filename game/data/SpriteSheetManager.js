/**
 * SpriteSheetManager.js — Loads and draws real sprite sheets
 *
 * Central sprite rendering system for Princess Sparkle V2.
 * Loads the downloaded sprite pack PNGs (Kenney Tiny Dungeon,
 * Kenney Tiny Creatures, RPG 8-bit characters) and provides
 * a simple draw() method that entities can call.
 *
 * Falls back to placeholder drawing if sheets haven't loaded yet.
 */

import { tryLoadImage } from './assetDiscovery.js';

// ── Sheet paths (relative to game root) ─────────────────────────────────────

const SHEET_PATHS = {
  dungeon:   './sprites/characters/kenney-tiny-dungeon/Tilemap/tilemap_packed.png',
  creatures: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
  rpg8bit:   './sprites/characters/rpg_16x16_8bit.png',
  unicornRun:'./sprites/creatures/unicorn_running.png',
};

// ── Sheet tile dimensions ───────────────────────────────────────────────────

const SHEET_META = {
  dungeon:   { tileW: 16, tileH: 16, cols: 12, rows: 11, spacing: 0 }, // packed = no spacing
  creatures: { tileW: 16, tileH: 16, cols: 10, rows: 18, spacing: 0 },
  rpg8bit:   { tileW: 16, tileH: 16, cols: 16, rows: 8, spacing: 0 },
  unicornRun:{ tileW: 16, tileH: 16, cols: 4, rows: 1, spacing: 1 },  // 4-frame strip with 1px separators
};

// ── Sprite definitions: name -> { sheet, tileIndex (0-based in packed) } ────
// For dungeon: tile files start at tile_0000, so tileIndex = file number
// For creatures: tile files start at tile_0001, so tileIndex = file number - 1

const SPRITE_DEFS = {
  // === Characters (from Kenney Tiny Dungeon) ===
  princess: {
    sheet: 'dungeon',
    tileIndex: 99,  // tile_0099 - pink/purple female character
  },
  npc_grandma: {
    sheet: 'dungeon',
    tileIndex: 100, // tile_0100 - grey-haired figure
  },
  npc_finn: {
    sheet: 'dungeon',
    tileIndex: 108, // tile_0108 - green-hooded character
  },
  npc_lily: {
    sheet: 'dungeon',
    tileIndex: 109, // tile_0109 - brown-haired character
  },
  npc_baker: {
    sheet: 'dungeon',
    tileIndex: 110, // tile_0110 - red character
  },
  npc_melody: {
    sheet: 'dungeon',
    tileIndex: 101, // tile_0101 - another character
  },

  // === Companions (from Kenney Tiny Creatures) ===
  // Creature tiles start at tile_0001 = packed index 0
  unicorn: {
    sheet: 'creatures',
    tileIndex: 152, // tile_0153 -> index 152
  },
  dragon: {
    sheet: 'creatures',
    tileIndex: 40,  // tile_0041 -> index 40
  },
  bunny: {
    sheet: 'creatures',
    tileIndex: 130, // tile_0131 -> index 130
  },
  butterfly: {
    sheet: 'creatures',
    tileIndex: 136, // tile_0137 -> index 136
  },
  fox: {
    sheet: 'creatures',
    tileIndex: 132, // tile_0133 -> index 132
  },

  // === Animals (from Kenney Tiny Creatures) ===
  cat: {
    sheet: 'creatures',
    tileIndex: 131, // tile_0132 -> index 131
  },
  dog: {
    sheet: 'creatures',
    tileIndex: 168, // tile_0169 -> index 168
  },
  bird: {
    sheet: 'creatures',
    tileIndex: 137, // tile_0138 -> index 137
  },
  frog: {
    sheet: 'creatures',
    tileIndex: 146, // tile_0147 -> index 146
  },
  duck: {
    sheet: 'creatures',
    tileIndex: 145, // tile_0146 -> index 145
  },
  rabbit: {
    sheet: 'creatures',
    tileIndex: 130, // same as bunny
  },
};

// ── Placeholder colors (fallback when sprites not loaded) ───────────────────

const PLACEHOLDER_COLORS = {
  princess:    '#ff9ff3',
  npc_grandma: '#9966cc',
  npc_finn:    '#4488ff',
  npc_lily:    '#66dd88',
  npc_baker:   '#cc8844',
  npc_melody:  '#ff6699',
  unicorn:     '#ffffff',
  dragon:      '#ff6b6b',
  bunny:       '#ffffff',
  butterfly:   '#66aaff',
  fox:         '#ff8844',
  cat:         '#ff9966',
  dog:         '#aa7744',
  bird:        '#44aaff',
  frog:        '#44cc44',
  duck:        '#ffdd44',
  rabbit:      '#dddddd',
};

// ── Walk animation definitions for RPG 8-bit sheet ──────────────────────────
// Layout: 4 characters per row-group, each character = 3 frames wide + 1 blank col
// Row group 1 (rows 0-2): characters 0-3, directions down/left/up
// Row group 2 (rows 4-6): characters 4-7, directions down/left/up
// Character 0 = red (princess walk), character 1 = gold, etc.
// Each character block: col offset = charIdx * 4, row offset = dirIdx
// Direction mapping: row+0=down, row+1=left/right(flip), row+2=up

const RPG_WALK = {
  charIndex: 0,  // first character (red) for princess walk
  framesPerDir: 3,
  colStride: 4,  // 3 frames + 1 blank
  // Row offsets within the group
  dirRows: {
    down: 0,
    left: 1,  // also used for right (flipped)
    right: 1,
    up: 2,
  },
  groupRowOffset: 0, // top group starts at row 0
};


class SpriteSheetManager {
  constructor() {
    /** @type {Map<string, HTMLImageElement>} */
    this._sheets = new Map();
    this._loaded = false;
    this._loading = false;
  }

  /**
   * Whether all sheets have been loaded (or attempted).
   * @returns {boolean}
   */
  get loaded() {
    return this._loaded;
  }

  /**
   * Load all sprite sheet PNGs. Safe to call multiple times.
   * @returns {Promise<void>}
   */
  async load() {
    if (this._loaded || this._loading) return;
    this._loading = true;

    const entries = Object.entries(SHEET_PATHS);
    const results = await Promise.all(
      entries.map(async ([key, path]) => {
        const img = await tryLoadImage(path);
        if (img) {
          console.log(`SpriteSheetManager: Loaded "${key}" (${img.width}x${img.height}) from ${path}`);
        } else {
          console.warn(`SpriteSheetManager: Failed to load "${key}" from ${path}`);
        }
        return [key, img];
      })
    );

    for (const [key, img] of results) {
      if (img) {
        this._sheets.set(key, img);
      }
    }

    this._loaded = true;
    this._loading = false;
  }

  /**
   * Check if a specific sheet is available.
   * @param {string} sheetKey
   * @returns {boolean}
   */
  hasSheet(sheetKey) {
    return this._sheets.has(sheetKey);
  }

  /**
   * Get the source rectangle for a named sprite on its packed sheet.
   * @param {string} name - Sprite name (e.g. 'princess', 'unicorn')
   * @returns {{sheet: string, image: HTMLImageElement, sx: number, sy: number, sw: number, sh: number}|null}
   */
  getSpriteRect(name) {
    const def = SPRITE_DEFS[name];
    if (!def) return null;

    const img = this._sheets.get(def.sheet);
    if (!img) return null;

    const meta = SHEET_META[def.sheet];
    const col = def.tileIndex % meta.cols;
    const row = Math.floor(def.tileIndex / meta.cols);
    const sx = col * (meta.tileW + meta.spacing);
    const sy = row * (meta.tileH + meta.spacing);

    return {
      sheet: def.sheet,
      image: img,
      sx, sy,
      sw: meta.tileW,
      sh: meta.tileH,
    };
  }

  /**
   * Draw a named sprite at the given position on the canvas.
   * Falls back to a colored placeholder rectangle if the sprite isn't loaded.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} name - Sprite name (e.g. 'princess', 'cat')
   * @param {number} x - Destination X in canvas coords
   * @param {number} y - Destination Y in canvas coords
   * @param {object} [options]
   * @param {boolean} [options.flipX=false] - Flip horizontally
   * @param {number} [options.scale=1] - Scale factor
   * @param {number} [options.frame=0] - Animation frame (for bob effect)
   */
  draw(ctx, name, x, y, options = {}) {
    const flipX = options.flipX || false;
    const scale = options.scale || 1;

    const rect = this.getSpriteRect(name);

    if (rect) {
      // Draw from real sprite sheet
      const dw = (rect.sw * scale) | 0;
      const dh = (rect.sh * scale) | 0;

      if (flipX) {
        ctx.save();
        ctx.translate(x + dw, y);
        ctx.scale(-1, 1);
        ctx.drawImage(
          rect.image,
          rect.sx, rect.sy, rect.sw, rect.sh,
          0, 0, dw, dh
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          rect.image,
          rect.sx, rect.sy, rect.sw, rect.sh,
          x | 0, y | 0, dw, dh
        );
      }
    } else {
      // Placeholder fallback
      const color = PLACEHOLDER_COLORS[name] || '#888888';
      const size = 16 * scale;
      ctx.fillStyle = color;
      ctx.fillRect(x | 0, y | 0, size | 0, size | 0);
      // Add a small darker border to make it visible
      ctx.fillStyle = '#00000044';
      ctx.fillRect(x | 0, y | 0, size | 0, 1);
      ctx.fillRect(x | 0, y | 0, 1, size | 0);
    }
  }

  /**
   * Draw a walk animation frame for the princess from the RPG 8-bit sheet.
   * Falls back to the static dungeon princess tile if RPG sheet isn't loaded.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Destination X
   * @param {number} y - Destination Y
   * @param {number} direction - 0=down, 1=left, 2=right, 3=up
   * @param {number} frame - Walk frame (0, 1, 2)
   * @param {boolean} [flipX=false]
   */
  drawWalk(ctx, x, y, direction, frame, flipX = false) {
    const rpgSheet = this._sheets.get('rpg8bit');
    if (!rpgSheet) {
      // Fall back to static sprite
      this.draw(ctx, 'princess', x, y, { flipX });
      return;
    }

    const cfg = RPG_WALK;
    const meta = SHEET_META.rpg8bit;

    // Map direction to row
    let dirKey;
    let needFlip = false;
    switch (direction) {
      case 0: dirKey = 'down'; break;
      case 1: dirKey = 'left'; break;
      case 2: dirKey = 'right'; needFlip = true; break; // right = flip of left
      case 3: dirKey = 'up'; break;
      default: dirKey = 'down';
    }

    const dirRow = cfg.dirRows[dirKey];
    const row = cfg.groupRowOffset + dirRow;
    const col = cfg.charIndex * cfg.colStride + (frame % cfg.framesPerDir);

    const sx = col * meta.tileW;
    const sy = row * meta.tileH;

    const shouldFlip = needFlip || flipX;

    if (shouldFlip) {
      ctx.save();
      ctx.translate(x + meta.tileW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(rpgSheet, sx, sy, meta.tileW, meta.tileH, 0, 0, meta.tileW, meta.tileH);
      ctx.restore();
    } else {
      ctx.drawImage(rpgSheet, sx, sy, meta.tileW, meta.tileH, x | 0, y | 0, meta.tileW, meta.tileH);
    }
  }

  /**
   * Draw a unicorn running animation frame.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - Destination X
   * @param {number} y - Destination Y
   * @param {number} frame - Frame index (0-3)
   * @param {boolean} [flipX=false]
   */
  drawUnicornRun(ctx, x, y, frame, flipX = false) {
    const sheet = this._sheets.get('unicornRun');
    if (!sheet) {
      this.draw(ctx, 'unicorn', x, y, { flipX });
      return;
    }

    const meta = SHEET_META.unicornRun;
    const col = frame % meta.cols;
    const sx = col * (meta.tileW + meta.spacing);
    const sy = 0;

    if (flipX) {
      ctx.save();
      ctx.translate(x + meta.tileW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, sy, meta.tileW, meta.tileH, 0, 0, meta.tileW, meta.tileH);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, sx, sy, meta.tileW, meta.tileH, x | 0, y | 0, meta.tileW, meta.tileH);
    }
  }
}

// Singleton instance
const spriteSheets = new SpriteSheetManager();
export default spriteSheets;
