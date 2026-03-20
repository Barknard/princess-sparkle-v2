/**
 * WorldObject.js — Tappable world objects for Princess Sparkle V2
 *
 * Type enum: FLOWER, TREE, POND, MUSHROOM, MAILBOX, etc.
 * Position in tile coords.
 * Tap response: animation + sound + optional particle effect.
 * Cooldown: 2 seconds between taps (prevents spam).
 * Some objects have multi-tap sequences (garden: plant -> water -> bloom).
 */

const TILE = 16;
const TAP_COOLDOWN = 2.0; // seconds

/** World object types */
export const ObjectType = {
  FLOWER_SMALL: 'FLOWER_SMALL',
  FLOWER_BIG: 'FLOWER_BIG',
  TALL_GRASS: 'TALL_GRASS',
  POND: 'POND',
  PUDDLE: 'PUDDLE',
  TREE: 'TREE',
  MAILBOX: 'MAILBOX',
  BENCH: 'BENCH',
  SIGNPOST: 'SIGNPOST',
  WELL: 'WELL',
  WIND_CHIMES: 'WIND_CHIMES',
  GARDEN: 'GARDEN',
  LANTERN: 'LANTERN',
  FENCE: 'FENCE',
  CHIMNEY: 'CHIMNEY',
  DOORMAT: 'DOORMAT',
  BASKET: 'BASKET',
  LAUNDRY: 'LAUNDRY',
  MUSHROOM_SMALL: 'MUSHROOM_SMALL',
  MUSHROOM_BIG: 'MUSHROOM_BIG',
  HOLLOW_LOG: 'HOLLOW_LOG',
  SPIDER_WEB: 'SPIDER_WEB',
  BERRY_BUSH: 'BERRY_BUSH',
  STREAM: 'STREAM',
  FALLEN_LEAVES: 'FALLEN_LEAVES',
  OWL_TREE: 'OWL_TREE',
  FAIRY_RING: 'FAIRY_RING',
  BEEHIVE: 'BEEHIVE',
  DANDELION: 'DANDELION',
  TOADSTOOL_DOOR: 'TOADSTOOL_DOOR',
  CRYSTAL_ROCK: 'CRYSTAL_ROCK',
  SLEEPING_DEER: 'SLEEPING_DEER',
  DRUM_LOG: 'DRUM_LOG'
};

/** Tap response definitions for each object type */
const TAP_RESPONSES = {
  [ObjectType.FLOWER_SMALL]: {
    anim: 'bounce', sfx: 'tap_flower', particle: 'flowerBloom',
    description: 'Bounces, petals fly, butterfly emerges'
  },
  [ObjectType.FLOWER_BIG]: {
    anim: 'open', sfx: 'tap_flower_big', particle: 'sparkleBurst',
    description: 'Opens wide, releases sparkle pollen. May cause sneeze!'
  },
  [ObjectType.TALL_GRASS]: {
    anim: 'sway', sfx: 'tap_grass', particle: null,
    description: 'Sways dramatically, tiny frog hops out'
  },
  [ObjectType.POND]: {
    anim: 'ripple', sfx: 'tap_water', particle: null,
    description: 'Ripple animation, fish jumps with splash'
  },
  [ObjectType.PUDDLE]: {
    anim: 'splash', sfx: 'tap_splash', particle: null,
    description: 'Splash! Droplets fly up'
  },
  [ObjectType.TREE]: {
    anim: 'shake', sfx: 'tap_tree', particle: null,
    description: 'Leaves shake, birds scatter, resettle after 5s'
  },
  [ObjectType.MAILBOX]: {
    anim: 'open', sfx: 'tap_mailbox', particle: 'sparkleBurst',
    description: 'Opens, letters fly up like confetti'
  },
  [ObjectType.BENCH]: {
    anim: 'sit', sfx: 'tap_bench', particle: null,
    description: 'Princess sits, companion beside her for 3s'
  },
  [ObjectType.SIGNPOST]: {
    anim: 'wobble', sfx: 'tap_sign', particle: null,
    description: 'Wobbles, companion reads it aloud'
  },
  [ObjectType.WELL]: {
    anim: 'wish', sfx: 'tap_well', particle: 'sparkleBurst',
    description: 'Coin drops, splash, star floats up'
  },
  [ObjectType.WIND_CHIMES]: {
    anim: 'chime', sfx: 'tap_chimes', particle: null,
    description: 'Chimes ring, nearby flowers sway'
  },
  [ObjectType.GARDEN]: {
    anim: 'multi', sfx: 'tap_garden', particle: 'flowerBloom',
    description: 'Multi-tap: plant -> water -> bloom',
    multiTap: true, stages: 3
  },
  [ObjectType.LANTERN]: {
    anim: 'light', sfx: 'tap_lantern', particle: null,
    description: 'Lights up, fireflies emerge for 10s'
  },
  [ObjectType.FENCE]: {
    anim: 'peek', sfx: 'tap_fence', particle: null,
    description: 'Companion peeks over, ducks back'
  },
  [ObjectType.CHIMNEY]: {
    anim: 'puff', sfx: 'tap_chimney', particle: null,
    description: 'Smoke puffs into heart/star shape'
  },
  [ObjectType.DOORMAT]: {
    anim: 'dust', sfx: 'tap_doormat', particle: null,
    description: 'Dust puffs, tiny mouse runs out'
  },
  [ObjectType.BASKET]: {
    anim: 'tumble', sfx: 'tap_basket', particle: null,
    description: 'Apple rolls out, companion catches it'
  },
  [ObjectType.LAUNDRY]: {
    anim: 'billow', sfx: 'tap_laundry', particle: null,
    description: 'Sheets billow, sock falls off'
  },
  [ObjectType.MUSHROOM_SMALL]: {
    anim: 'bounce', sfx: 'tap_mushroom', particle: 'sparkleBurst',
    description: 'Bounces, glowing spores float up'
  },
  [ObjectType.MUSHROOM_BIG]: {
    anim: 'bigBounce', sfx: 'tap_mushroom_big', particle: 'sparkleBurst',
    description: 'Character bounces on top'
  },
  [ObjectType.HOLLOW_LOG]: {
    anim: 'peek', sfx: 'tap_log', particle: null,
    description: 'Glowing eyes, bunny/hedgehog hops out'
  },
  [ObjectType.SPIDER_WEB]: {
    anim: 'sparkle', sfx: 'tap_web', particle: 'sparkleBurst',
    description: 'Dewdrops sparkle and chime like wind chime'
  },
  [ObjectType.BERRY_BUSH]: {
    anim: 'rustle', sfx: 'tap_berry', particle: null,
    description: 'Berries jiggle, bird swoops to grab one'
  },
  [ObjectType.STREAM]: {
    anim: 'step', sfx: 'tap_stream', particle: null,
    description: 'Stepping stones each play a note'
  },
  [ObjectType.FALLEN_LEAVES]: {
    anim: 'scatter', sfx: 'tap_leaves', particle: null,
    description: 'Kick through, scatter and swirl'
  },
  [ObjectType.OWL_TREE]: {
    anim: 'blink', sfx: 'tap_owl', particle: null,
    description: 'Owl opens eye, hoots, closes eye. 3 taps = wink',
    multiTap: true, stages: 3
  },
  [ObjectType.FAIRY_RING]: {
    anim: 'glow', sfx: 'tap_fairy', particle: 'sparkleBurst',
    description: 'Companion glows brighter for 5s'
  },
  [ObjectType.BEEHIVE]: {
    anim: 'buzz', sfx: 'tap_beehive', particle: null,
    description: 'Cute bees buzz out and return'
  },
  [ObjectType.DANDELION]: {
    anim: 'blow', sfx: 'tap_dandelion', particle: 'wishDust',
    description: 'Seeds blow away, drift across screen'
  },
  [ObjectType.TOADSTOOL_DOOR]: {
    anim: 'open', sfx: 'tap_toadstool', particle: 'sparkleBurst',
    description: 'Tiny door opens, fairy peeks out and waves'
  },
  [ObjectType.CRYSTAL_ROCK]: {
    anim: 'glow', sfx: 'tap_crystal', particle: 'sparkleBurst',
    description: 'Cycles rainbow colors, ascending notes',
    multiTap: true, stages: 6
  },
  [ObjectType.SLEEPING_DEER]: {
    anim: 'twitch', sfx: 'tap_deer', particle: 'heartsFloating',
    description: 'Ears twitch, opens eyes, stretches, sleeps again'
  },
  [ObjectType.DRUM_LOG]: {
    anim: 'drum', sfx: 'tap_drum', particle: null,
    description: 'Deep drum sound. Tap repeatedly = companion dances'
  }
};

export default class WorldObject {
  /**
   * @param {object} config
   * @param {string} config.type - One of ObjectType values
   * @param {number} config.x - Tile X
   * @param {number} config.y - Tile Y
   * @param {string} [config.spriteName] - Key into sprite system
   * @param {object} [config.extra] - Type-specific extra data
   */
  constructor(config) {
    this.type = config.type;
    this.x = config.x;
    this.y = config.y;
    this.spriteName = config.spriteName || null;

    // Tap state
    this.cooldownTimer = 0;
    this.tapResponse = TAP_RESPONSES[this.type] || null;

    // Animation state
    this.animating = false;
    this.animTimer = 0;
    this.animType = '';
    this.animFrame = 0;

    // Multi-tap state (for garden, owl, crystal)
    this.tapStage = 0;
    this.isMultiTap = this.tapResponse ? (this.tapResponse.multiTap || false) : false;
    this.maxStages = this.tapResponse ? (this.tapResponse.stages || 1) : 1;

    // Object-specific state
    this.litTimer = 0;   // for lantern
    this.extra = config.extra || {};

    // Idle animation
    this.idleFrame = 0;
    this.idleTimer = 0;
  }

  /**
   * Attempt to tap this object.
   * @returns {{success: boolean, response: object|null}} Tap result
   */
  tap() {
    if (this.cooldownTimer > 0) {
      return { success: false, response: null };
    }
    if (!this.tapResponse) {
      return { success: false, response: null };
    }

    this.cooldownTimer = TAP_COOLDOWN;

    // Start animation
    this.animating = true;
    this.animTimer = 0;
    this.animType = this.tapResponse.anim;
    this.animFrame = 0;

    // Handle multi-tap sequences
    let currentStage = this.tapStage;
    if (this.isMultiTap) {
      this.tapStage = (this.tapStage + 1) % this.maxStages;
    }

    return {
      success: true,
      response: {
        anim: this.tapResponse.anim,
        sfx: this.tapResponse.sfx,
        particle: this.tapResponse.particle,
        stage: currentStage,
        type: this.type
      }
    };
  }

  /**
   * Update the world object each frame.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const dtMs = dt * 1000;

    // Cooldown countdown
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    // Tap animation
    if (this.animating) {
      this.animTimer += dtMs;

      // Most animations last ~500-800ms
      if (this.animTimer >= 800) {
        this.animating = false;
        this.animTimer = 0;
      } else {
        // Frame progression
        this.animFrame = ((this.animTimer / 200) | 0) % 4;
      }
    }

    // Lit lantern countdown
    if (this.litTimer > 0) {
      this.litTimer -= dt;
    }

    // Idle animation (gentle sway for flowers, etc.)
    this.idleTimer += dtMs;
    if (this.idleTimer >= 1200) {
      this.idleTimer -= 1200;
      this.idleFrame = (this.idleFrame + 1) % 2;
    }
  }

  /**
   * Check if a world position is close enough to tap this object.
   * @param {number} worldX - Tile X
   * @param {number} worldY - Tile Y
   * @param {number} [radius=1.0] - Tap radius in tiles
   * @returns {boolean}
   */
  isInRange(worldX, worldY, radius) {
    const r = radius || 1.0;
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    return (dx * dx + dy * dy) <= r * r;
  }

  /**
   * Draw the world object.
   * @param {import('../engine/Renderer.js').default} renderer
   * @param {object} camera
   * @param {object} sprites
   */
  draw(renderer, camera, sprites) {
    const sx = ((this.x - camera.x) * TILE) | 0;
    const sy = ((this.y - camera.y) * TILE) | 0;
    const ctx = renderer.ctx;

    // Animation offsets
    let yOffset = 0;
    let xOffset = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (this.animating) {
      switch (this.animType) {
        case 'bounce':
          yOffset = -Math.abs(Math.sin(this.animTimer * 0.012)) * 4;
          break;
        case 'bigBounce':
          yOffset = -Math.abs(Math.sin(this.animTimer * 0.01)) * 8;
          break;
        case 'wobble':
          xOffset = Math.sin(this.animTimer * 0.02) * 2;
          break;
        case 'sway':
          xOffset = Math.sin(this.animTimer * 0.015) * 3;
          break;
        case 'shake':
          xOffset = Math.sin(this.animTimer * 0.04) * 1.5;
          break;
        case 'splash':
          yOffset = this.animTimer < 200 ? -3 : 0;
          break;
        case 'open':
          scaleX = 1 + Math.sin(this.animTimer * 0.008) * 0.15;
          break;
        case 'ripple':
          scaleX = 1 + Math.sin(this.animTimer * 0.01) * 0.1;
          scaleY = 1 - Math.sin(this.animTimer * 0.01) * 0.05;
          break;
        case 'glow':
        case 'light':
        case 'sparkle':
          // Draw a glow behind
          ctx.fillStyle = 'rgba(255, 255, 200, 0.3)';
          ctx.beginPath();
          ctx.arc(sx + 8, sy + 8, 10 + Math.sin(this.animTimer * 0.01) * 3, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'scatter':
          // Leaf scatter particles handled externally
          break;
        case 'blow':
          // Dandelion seeds handled by particle system
          break;
        default:
          yOffset = -Math.abs(Math.sin(this.animTimer * 0.01)) * 2;
      }
    }

    // Idle sway for flowers/grass
    const isFloral = this.type === ObjectType.FLOWER_SMALL ||
                     this.type === ObjectType.FLOWER_BIG ||
                     this.type === ObjectType.TALL_GRASS ||
                     this.type === ObjectType.DANDELION;
    if (!this.animating && isFloral) {
      xOffset = this.idleFrame === 1 ? 0.5 : -0.5;
    }

    // Draw sprite
    if (sprites && this.spriteName && sprites.draw) {
      sprites.draw(
        ctx, this.spriteName,
        sx + (xOffset | 0), sy + (yOffset | 0),
        this.animFrame, false
      );
    } else {
      // Fallback: draw placeholder colored square
      ctx.fillStyle = this._getPlaceholderColor();
      const finalX = sx + (xOffset | 0);
      const finalY = sy + (yOffset | 0);
      ctx.fillRect(finalX, finalY, TILE * scaleX, TILE * scaleY);
    }

    // Multi-tap stage indicator (garden progress, etc.)
    if (this.isMultiTap && this.tapStage > 0) {
      ctx.fillStyle = '#90ee90';
      for (let i = 0; i < this.tapStage; i++) {
        ctx.fillRect(sx + 2 + i * 4, sy - 3, 3, 2);
      }
    }
  }

  /**
   * Get a placeholder color for objects without sprites.
   * @returns {string}
   */
  _getPlaceholderColor() {
    const colors = {
      [ObjectType.FLOWER_SMALL]: '#ff69b4',
      [ObjectType.FLOWER_BIG]: '#ff99cc',
      [ObjectType.TALL_GRASS]: '#66cc66',
      [ObjectType.POND]: '#6699cc',
      [ObjectType.PUDDLE]: '#88bbdd',
      [ObjectType.TREE]: '#228b22',
      [ObjectType.MAILBOX]: '#cc4444',
      [ObjectType.BENCH]: '#8b7355',
      [ObjectType.MUSHROOM_SMALL]: '#dd8866',
      [ObjectType.MUSHROOM_BIG]: '#cc6644',
      [ObjectType.CRYSTAL_ROCK]: '#aa88ff',
    };
    return colors[this.type] || '#888888';
  }
}
