/**
 * SpriteSheetManager.js — Loads and draws real sprite sheets
 *
 * Central sprite rendering system for Princess Sparkle V2.
 * Loads Kenney Tiny Creatures (companions/animals) and Superdark
 * Fantasy/Forest animated spritesheets (characters/creatures).
 *
 * Animation configuration is loaded from sprites/sprite-anims.json
 * at boot time. All frame layouts, timing, and entity mappings are
 * driven by that JSON config — no hardcoded animation constants.
 *
 * Falls back to placeholder drawing if sheets haven't loaded yet.
 */

import { tryLoadImage } from './assetDiscovery.js';

// ── Static sheet paths (Kenney Tiny Creatures — not in anim config) ──────────

const SHEET_PATHS = {
  creatures: './sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png',
  unicornRun:'./sprites/creatures/unicorn_running.png',
};

// ── Sheet tile dimensions ───────────────────────────────────────────────────

const SHEET_META = {
  creatures: { tileW: 16, tileH: 16, cols: 10, rows: 18, spacing: 0 },
  unicornRun:{ tileW: 16, tileH: 16, cols: 4, rows: 1, spacing: 1 },  // 4-frame strip with 1px separators
};

// ── Sprite definitions: name -> { sheet, tileIndex (0-based in packed) } ────
// Characters use Superdark animated sheets (see entityMap in sprite-anims.json).
// Static SPRITE_DEFS are only for Kenney Tiny Creatures (companions/animals).
// For creatures: tile files start at tile_0001, so tileIndex = file number - 1

const SPRITE_DEFS = {
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
  wolf:             '#888899',
  fairy:            '#ccaaff',
  bear:             '#8B4513',
  ent:              '#556B2F',
  mushroom:         '#DC143C',
  forest_guardian:  '#228B22',
};


class SpriteSheetManager {
  constructor() {
    /** @type {Map<string, HTMLImageElement>} */
    this._sheets = new Map();
    /** @type {Map<string, HTMLImageElement>} Animated spritesheets */
    this._animSheets = new Map();
    this._loaded = false;
    this._loading = false;

    // ── JSON config data (populated from sprite-anims.json) ────────────
    /** @type {object|null} Full parsed config */
    this._animConfig = null;
    /** @type {object} meta.frameSize { w, h } */
    this._frameSize = { w: 16, h: 16 };
    /** @type {number} meta.scale */
    this._scale = 3;
    /** @type {object} sprites section keyed by sheet name */
    this._sprites = {};
    /** @type {object} entityMap section */
    this._entityMap = {};
    /** @type {object} creatureAnims section */
    this._creatureAnims = {};
  }

  /**
   * Whether all sheets have been loaded (or attempted).
   * @returns {boolean}
   */
  get loaded() {
    return this._loaded;
  }

  /**
   * Get the global render scale from the JSON config.
   * @returns {number}
   */
  getScale() {
    return this._scale;
  }

  /**
   * Check if an animated spritesheet is available for a given entity name.
   * @param {string} name - Entity sprite name (e.g. 'princess', 'npc_baker')
   * @returns {boolean}
   */
  hasAnimSheet(name) {
    const key = this._entityMap[name] || name;
    return this._animSheets.has(key);
  }

  /**
   * Get frame configuration for a given entity and animation state.
   * @param {string} entityName - Entity sprite name (e.g. 'princess', 'npc_baker', 'wolf')
   * @param {string} state - Animation state: 'idle' or 'walk'
   * @returns {{ from: number, to: number, frameCount: number, speed: number }|null}
   */
  getFrameConfig(entityName, state) {
    const sheetKey = this._entityMap[entityName] || entityName;
    const spriteDef = this._sprites[sheetKey];
    if (!spriteDef || !spriteDef.frameTags) return null;

    const tag = spriteDef.frameTags.find(t => t.name === state);
    if (!tag) return null;

    return {
      from: tag.from,
      to: tag.to,
      frameCount: tag.to - tag.from + 1,
      speed: tag.speed,
    };
  }

  /**
   * Load sprite-anims.json config, then all sprite sheet PNGs.
   * Safe to call multiple times.
   * @returns {Promise<void>}
   */
  async load() {
    if (this._loaded || this._loading) return;
    this._loading = true;

    // ── Load JSON animation config ────────────────────────────────────
    try {
      const resp = await fetch('./sprites/sprite-anims.json');
      if (resp.ok) {
        this._animConfig = await resp.json();
        this._applyConfig(this._animConfig);
        console.log('SpriteSheetManager: Loaded sprite-anims.json');
      } else {
        console.warn('SpriteSheetManager: sprite-anims.json not found, using defaults');
      }
    } catch (e) {
      console.warn('SpriteSheetManager: Failed to load sprite-anims.json:', e);
    }

    // ── Load static sheets (Kenney Tiny Creatures, unicorn run) ──────
    const staticEntries = Object.entries(SHEET_PATHS);
    const staticResults = await Promise.all(
      staticEntries.map(async ([key, path]) => {
        const img = await tryLoadImage(path);
        if (img) {
          console.log(`SpriteSheetManager: Loaded "${key}" (${img.width}x${img.height}) from ${path}`);
        } else {
          console.warn(`SpriteSheetManager: Failed to load "${key}" from ${path}`);
        }
        return [key, img];
      })
    );

    for (const [key, img] of staticResults) {
      if (img) {
        this._sheets.set(key, img);
      }
    }

    // ── Load animated spritesheets from JSON config ──────────────────
    const animEntries = Object.entries(this._sprites);
    const animResults = await Promise.all(
      animEntries.map(async ([key, spriteDef]) => {
        const path = spriteDef.sheet;
        const img = await tryLoadImage(path);
        if (img) {
          console.log(`SpriteSheetManager: Loaded anim "${key}" (${img.width}x${img.height}) from ${path}`);
        } else {
          console.warn(`SpriteSheetManager: Failed to load anim "${key}" from ${path}`);
        }
        return [key, img];
      })
    );

    for (const [key, img] of animResults) {
      if (img) {
        this._animSheets.set(key, img);
      }
    }

    this._loaded = true;
    this._loading = false;
  }

  /**
   * Apply parsed JSON config to internal state.
   * @param {object} config
   */
  _applyConfig(config) {
    if (config.meta) {
      if (config.meta.frameSize) {
        this._frameSize = config.meta.frameSize;
      }
      if (config.meta.scale !== undefined) {
        this._scale = config.meta.scale;
      }
    }
    if (config.sprites) {
      this._sprites = config.sprites;
    }
    if (config.entityMap) {
      this._entityMap = config.entityMap;
    }
    if (config.creatureAnims) {
      this._creatureAnims = config.creatureAnims;
    }
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
  getSpriteRect(name, animTimer) {
    const def = SPRITE_DEFS[name];
    if (!def) return null;

    const img = this._sheets.get(def.sheet);
    if (!img) return null;

    const meta = SHEET_META[def.sheet];

    // Check for creature animation from JSON config (e.g. bird wing flap)
    let tileIndex = def.tileIndex;
    const anim = this._creatureAnims[name];
    if (anim && animTimer !== undefined) {
      const frameIdx = Math.floor(animTimer / anim.speed) % anim.frames.length;
      tileIndex = anim.frames[frameIdx];
    }

    const col = tileIndex % meta.cols;
    const row = Math.floor(tileIndex / meta.cols);
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
    const animTimer = options.animTimer;

    const rect = this.getSpriteRect(name, animTimer);

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
   * Draw a walk animation frame from the Superdark animated spritesheets.
   * Uses the walk frameTag from sprite-anims.json config.
   * Falls back to static sprite if animated sheet is not available.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} name - Entity sprite name (e.g. 'princess', 'npc_baker', 'wolf')
   * @param {number} frame - Walk frame index (0-based within walk range)
   * @param {number} x - Destination X
   * @param {number} y - Destination Y
   * @param {boolean} [flipX=false] - Flip horizontally (for facing left)
   * @param {number} [scale] - Scale factor (defaults to config scale)
   */
  drawWalkFrame(ctx, name, frame, x, y, flipX = false, scale) {
    const sheetKey = this._entityMap[name] || name;
    const sheet = this._animSheets.get(sheetKey);

    if (!sheet) {
      this.draw(ctx, name, x, y, { flipX, scale: scale || 1 });
      return;
    }

    // Look up walk frameTag from config
    const walkConfig = this._getFrameTag(sheetKey, 'walk');
    const walkStart = walkConfig ? walkConfig.from : 4;
    const walkFrames = walkConfig ? (walkConfig.to - walkConfig.from + 1) : 4;

    const frameIndex = walkStart + (frame % walkFrames);
    const sx = frameIndex * this._frameSize.w;
    const sy = 0;

    this._drawAnimFrame(ctx, sheet, sx, sy, x, y, flipX, scale);
  }

  /**
   * Draw an idle animation frame from the Superdark animated spritesheets.
   * Uses the idle frameTag from sprite-anims.json config.
   * Falls back to static sprite if animated sheet is not available.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} name - Entity sprite name (e.g. 'princess', 'npc_baker', 'wolf')
   * @param {number} frame - Idle frame index (0-based within idle range)
   * @param {number} x - Destination X
   * @param {number} y - Destination Y
   * @param {boolean} [flipX=false] - Flip horizontally (for facing left)
   * @param {number} [scale] - Scale factor (defaults to config scale)
   */
  drawIdleFrame(ctx, name, frame, x, y, flipX = false, scale) {
    const sheetKey = this._entityMap[name] || name;
    const sheet = this._animSheets.get(sheetKey);

    if (!sheet) {
      this.draw(ctx, name, x, y, { flipX, scale: scale || 1 });
      return;
    }

    // Look up idle frameTag from config
    const idleConfig = this._getFrameTag(sheetKey, 'idle');
    const idleStart = idleConfig ? idleConfig.from : 0;
    const idleFrames = idleConfig ? (idleConfig.to - idleConfig.from + 1) : 2;

    const frameIndex = idleStart + (frame % idleFrames);
    const sx = frameIndex * this._frameSize.w;
    const sy = 0;

    this._drawAnimFrame(ctx, sheet, sx, sy, x, y, flipX, scale);
  }

  /**
   * Look up a frameTag by name for a given sprite sheet key.
   * @param {string} sheetKey - Sprite sheet key (e.g. 'princess', 'wolf')
   * @param {string} tagName - Tag name (e.g. 'idle', 'walk')
   * @returns {{ name: string, from: number, to: number, direction: string, speed: number }|null}
   */
  _getFrameTag(sheetKey, tagName) {
    const spriteDef = this._sprites[sheetKey];
    if (!spriteDef || !spriteDef.frameTags) return null;
    return spriteDef.frameTags.find(t => t.name === tagName) || null;
  }

  /**
   * Internal: draw a single frame from an animated spritesheet with flip support.
   * All Superdark sprites face RIGHT by default; flip for LEFT movement.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLImageElement} sheet
   * @param {number} sx - Source X on sheet
   * @param {number} sy - Source Y on sheet
   * @param {number} x - Destination X
   * @param {number} y - Destination Y
   * @param {boolean} flipX
   * @param {number} [scale] - Scale factor (defaults to config scale)
   */
  _drawAnimFrame(ctx, sheet, sx, sy, x, y, flipX, scale) {
    const fw = this._frameSize.w;
    const fh = this._frameSize.h;
    const s = scale !== undefined ? scale : 1;
    const dw = (fw * s) | 0;
    const dh = (fh * s) | 0;

    if (flipX) {
      ctx.save();
      ctx.translate(x + dw, y);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, sy, fw, fh,
        0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, sx, sy, fw, fh,
        x | 0, y | 0, dw, dh);
    }
  }

  /**
   * Compute the current animation frame based on elapsed time.
   * Uses frame speeds from the JSON config.
   *
   * @param {number} animTimer - Accumulated time in milliseconds
   * @param {boolean} isWalking - Whether the entity is moving
   * @param {string} [entityName] - Optional entity name for config lookup
   * @returns {number} Current frame index
   */
  getAnimFrame(animTimer, isWalking, entityName) {
    let interval, maxFrames;

    if (entityName) {
      const state = isWalking ? 'walk' : 'idle';
      const config = this.getFrameConfig(entityName, state);
      if (config) {
        interval = config.speed;
        maxFrames = config.frameCount;
      }
    }

    // Fallback to defaults derived from config (or hardcoded defaults)
    if (!interval) {
      // Use the first sprite's config as representative defaults
      const firstKey = Object.keys(this._sprites)[0];
      if (firstKey) {
        const tag = this._getFrameTag(firstKey, isWalking ? 'walk' : 'idle');
        if (tag) {
          interval = tag.speed;
          maxFrames = tag.to - tag.from + 1;
        }
      }
    }

    // Ultimate fallback
    if (!interval) {
      interval = isWalking ? 150 : 500;
      maxFrames = isWalking ? 4 : 2;
    }

    return Math.floor(animTimer / interval) % maxFrames;
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
