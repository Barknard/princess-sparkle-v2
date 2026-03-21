/**
 * Companion.js — Base companion class for Princess Sparkle V2
 *
 * Follows player with offset (1.5 tiles behind, 0.8 tiles right), lerp factor 0.12.
 * Trail particle emission every 8 frames at previous position.
 * Idle animation: gentle bob, 2 frames, 800ms cycle.
 * Silly idle behaviors (personality-specific, triggered randomly when idle >10s).
 * Care system: occasionally shows emote (heart, sleepy Z, playful star).
 * Evolves at level milestones (visual change at levels 4 and 7).
 *
 * Subclasses override: getParticleConfig(), getSillyIdleBehavior(), companion-specific SFX.
 */

import spriteSheets from '../data/SpriteSheetManager.js';

const TILE = 16;

// Follow behaviour (in pixels — 1 tile = 16px)
const FOLLOW_OFFSET_X = 0.8 * 16;  // ~13px to the right
const FOLLOW_OFFSET_Y = 1.5 * 16;  // ~24px behind
const LERP_FACTOR = 0.12;

// Animation — Superdark sheets have 4 frames per animation
const WALK_FRAME_MS = 150;
const WALK_FRAMES = 4;
const IDLE_FRAME_MS = 400;
const IDLE_FRAMES = 4;
const BOB_AMOUNT = 1; // pixels

// Trail
const TRAIL_EMIT_INTERVAL = 8; // frames between emissions

// Silly idle
const SILLY_IDLE_THRESHOLD = 10.0; // seconds idle before silly can trigger
const SILLY_IDLE_CHANCE = 0.005;   // per-frame chance once threshold met
const SILLY_IDLE_DURATION = 3.0;   // seconds a silly anim plays

// Care system
const CARE_EMOTE_MIN_INTERVAL = 30.0;  // seconds between care emotes
const CARE_EMOTE_MAX_INTERVAL = 90.0;  // seconds

// Evolution levels
const EVOLUTION_LEVELS = [4, 7];

/** Emote types */
export const EmoteType = {
  HEART: 'heart',
  SLEEPY: 'sleepy',
  PLAYFUL: 'playful'
};

export default class Companion {
  /**
   * @param {string} name - Companion name (Shimmer, Ember, etc.)
   * @param {string} spriteName - Key into sprite system
   */
  constructor(name, spriteName) {
    this.name = name;
    this.spriteName = spriteName;

    // Position in tile coords (fractional)
    this.x = 0;
    this.y = 0;

    // Previous position for trail emission
    this.prevX = 0;
    this.prevY = 0;

    // Animation
    this.animFrame = 0;
    this.animTimer = 0;

    // Trail emission counter
    this.trailFrameCounter = 0;

    // Idle tracking
    this.idleTime = 0;

    // Silly idle state
    this.sillying = false;
    this.sillyTimer = 0;
    this.sillyType = ''; // subclass-specific

    // Care system
    this.emoteVisible = false;
    this.emoteType = EmoteType.HEART;
    this.emoteTimer = 0;       // how long current emote has been visible
    this.nextEmoteIn = this._randomEmoteInterval(); // seconds until next emote

    // Evolution
    this.level = 1;
    this.evolutionStage = 0; // 0 = baby, 1 = young, 2 = full

    // Flip for direction
    this.flipX = false;

    // Target position (where we're lerping toward)
    this._targetX = 0;
    this._targetY = 0;

    // Movement state for animation (set in update)
    this._isMoving = false;
  }

  /**
   * Override in subclass: return particle config for trail.
   * @returns {object} Particle config for ParticleSystem.emit()
   */
  getParticleConfig() {
    return {
      x: this.prevX,
      y: this.prevY,
      count: 1,
      colors: ['#ffffff'],
      shape: 'circle',
      sizeMin: 2,
      sizeMax: 4,
      life: 600,
      vxMin: -0.2,
      vxMax: 0.2,
      vyMin: -0.5,
      vyMax: 0
    };
  }

  /**
   * Override in subclass: return silly idle behavior description.
   * @returns {{type: string, duration: number}}
   */
  getSillyIdleBehavior() {
    return { type: 'generic_bob', duration: SILLY_IDLE_DURATION };
  }

  /**
   * Set the companion's level and update evolution stage.
   * @param {number} level
   */
  setLevel(level) {
    this.level = level;
    if (level >= EVOLUTION_LEVELS[1]) {
      this.evolutionStage = 2;
    } else if (level >= EVOLUTION_LEVELS[0]) {
      this.evolutionStage = 1;
    } else {
      this.evolutionStage = 0;
    }
  }

  /**
   * Convenience follow method for OverworldScene.
   * Sets target position and lerps toward it.
   * @param {number} targetX - Player X position
   * @param {number} targetY - Player Y position
   * @param {number} dt - Delta time in seconds
   */
  follow(targetX, targetY, dt) {
    this.prevX = this.x;
    this.prevY = this.y;
    this._targetX = targetX + FOLLOW_OFFSET_X;
    this._targetY = targetY + FOLLOW_OFFSET_Y;
    this.x += (this._targetX - this.x) * LERP_FACTOR;
    this.y += (this._targetY - this.y) * LERP_FACTOR;
    const moveDx = this.x - this.prevX;
    if (Math.abs(moveDx) > 0.001) {
      this.flipX = moveDx < 0;
    }
  }

  /**
   * Update companion each frame.
   * @param {number} dt - Delta time in seconds
   * @param {import('./Player.js').default} [player] - The princess
   * @param {import('./ParticleSystem.js').default|null} [particles] - Particle system
   */
  update(dt, player, particles) {
    const dtMs = dt * 1000;

    // Store previous position for trail
    this.prevX = this.x;
    this.prevY = this.y;

    // Calculate follow target based on player direction (if player provided)
    if (player) {
      this._calculateFollowTarget(player);
    }

    // Lerp toward target
    this.x += (this._targetX - this.x) * LERP_FACTOR;
    this.y += (this._targetY - this.y) * LERP_FACTOR;

    // Flip based on movement direction
    const moveDx = this.x - this.prevX;
    if (Math.abs(moveDx) > 0.001) {
      this.flipX = moveDx < 0;
    }

    // Determine if we're effectively idle
    const moved = Math.abs(this.x - this.prevX) + Math.abs(this.y - this.prevY);
    if (moved < 0.01) {
      this.idleTime += dt;
    } else {
      this.idleTime = 0;
      this.sillying = false;
    }

    // Animation: walk frames when moving (150ms), idle frames when still (400ms)
    const isMoving = moved >= 0.01;
    const frameInterval = isMoving ? WALK_FRAME_MS : IDLE_FRAME_MS;
    const frameCount = isMoving ? WALK_FRAMES : IDLE_FRAMES;
    this.animTimer += dtMs;
    if (this.animTimer >= frameInterval) {
      this.animTimer -= frameInterval;
      this.animFrame = (this.animFrame + 1) % frameCount;
    }
    /** @type {boolean} Whether the companion is actively moving (for draw) */
    this._isMoving = isMoving;

    // Trail emission
    this.trailFrameCounter++;
    if (this.trailFrameCounter >= TRAIL_EMIT_INTERVAL && particles && moved > 0.01) {
      this.trailFrameCounter = 0;
      particles.emit(this.getParticleConfig());
    }

    // Silly idle behavior
    this._updateSillyIdle(dt);

    // Care emote system
    this._updateCareEmote(dt);
  }

  /**
   * Calculate the follow target position based on player facing direction.
   * @param {import('./Player.js').default} player
   */
  _calculateFollowTarget(player) {
    // Follow offset depends on player direction
    // "Behind" means opposite of facing direction
    const dir = player.direction;
    let offX = FOLLOW_OFFSET_X;
    let offY = FOLLOW_OFFSET_Y;

    // Direction: 0=down, 1=left, 2=right, 3=up
    switch (dir) {
      case 0: // down — companion is above-right
        this._targetX = player.x + offX;
        this._targetY = player.y - offY;
        break;
      case 1: // left — companion is right-behind
        this._targetX = player.x + offY;
        this._targetY = player.y + offX;
        break;
      case 2: // right — companion is left-behind
        this._targetX = player.x - offY;
        this._targetY = player.y + offX;
        break;
      case 3: // up — companion is below-right
        this._targetX = player.x + offX;
        this._targetY = player.y + offY;
        break;
      default:
        this._targetX = player.x + offX;
        this._targetY = player.y + offY;
    }
  }

  /**
   * Update silly idle behavior trigger and animation.
   * @param {number} dt
   */
  _updateSillyIdle(dt) {
    if (this.sillying) {
      this.sillyTimer -= dt;
      if (this.sillyTimer <= 0) {
        this.sillying = false;
        this.sillyTimer = 0;
      }
      return;
    }

    if (this.idleTime >= SILLY_IDLE_THRESHOLD) {
      if (Math.random() < SILLY_IDLE_CHANCE) {
        const behavior = this.getSillyIdleBehavior();
        this.sillying = true;
        this.sillyType = behavior.type;
        this.sillyTimer = behavior.duration;
        this.idleTime = 0; // reset so we don't spam silly
      }
    }
  }

  /**
   * Update the care emote system.
   * @param {number} dt
   */
  _updateCareEmote(dt) {
    if (this.emoteVisible) {
      this.emoteTimer += dt;
      // Emote fades after 5 seconds if not tapped
      if (this.emoteTimer >= 5.0) {
        this.emoteVisible = false;
        this.nextEmoteIn = this._randomEmoteInterval();
      }
      return;
    }

    this.nextEmoteIn -= dt;
    if (this.nextEmoteIn <= 0) {
      this.emoteVisible = true;
      this.emoteTimer = 0;
      // Random emote type
      const emotes = [EmoteType.HEART, EmoteType.SLEEPY, EmoteType.PLAYFUL];
      this.emoteType = emotes[(Math.random() * emotes.length) | 0];
    }
  }

  /**
   * Handle care emote tap (player tapped the emote).
   * @returns {string|null} The emote type that was active, or null
   */
  tapEmote() {
    if (!this.emoteVisible) return null;
    const type = this.emoteType;
    this.emoteVisible = false;
    this.nextEmoteIn = this._randomEmoteInterval();
    return type;
  }

  /**
   * Random interval until next care emote.
   * @returns {number} seconds
   */
  _randomEmoteInterval() {
    return CARE_EMOTE_MIN_INTERVAL +
      Math.random() * (CARE_EMOTE_MAX_INTERVAL - CARE_EMOTE_MIN_INTERVAL);
  }

  /**
   * Get screen position for rendering.
   * @param {object} camera - {x, y} in tile coords
   * @returns {{sx: number, sy: number}}
   */
  screenPos(camera) {
    return {
      sx: ((this.x - camera.x) * TILE) | 0,
      sy: ((this.y - camera.y) * TILE) | 0
    };
  }

  /**
   * Draw the companion at the correct screen position.
   *
   * Supports two calling patterns:
   *   1. draw(renderer, camera, sprites) — entity-based draw with camera offset
   *   2. draw(ctx) — direct canvas context draw (already camera-translated)
   *
   * @param {import('../engine/Renderer.js').default|CanvasRenderingContext2D} rendererOrCtx
   * @param {object} [camera]
   * @param {object} [sprites]
   */
  draw(rendererOrCtx, camera, sprites) {
    let ctx, drawX, drawY;
    if (camera && typeof camera === 'object' && 'x' in camera) {
      ctx = rendererOrCtx.ctx || rendererOrCtx;
      const pos = this.screenPos(camera);
      drawX = pos.sx;
      drawY = pos.sy;
    } else {
      ctx = rendererOrCtx;
      drawX = (this.x * TILE) | 0;
      drawY = (this.y * TILE) | 0;
    }

    // Gentle bob for idle animation
    let yOffset = this.animFrame === 1 ? -BOB_AMOUNT : 0;

    // Silly idle visual override
    if (this.sillying) {
      yOffset += Math.sin(this.sillyTimer * 6) * 2;
    }

    // Draw companion sprite using SpriteSheetManager
    const name = this.spriteName || 'unicorn';

    // Prefer Superdark animated spritesheets for creatures with walk/idle
    if (spriteSheets.loaded && spriteSheets.hasAnimSheet(name)) {
      if (this._isMoving) {
        spriteSheets.drawWalkFrame(ctx, name, this.animFrame, drawX, drawY + (yOffset | 0), this.flipX);
      } else {
        spriteSheets.drawIdleFrame(ctx, name, this.animFrame, drawX, drawY + (yOffset | 0), this.flipX);
      }
    } else if (name === 'unicorn') {
      // Legacy unicorn running animation
      const frame = this.animFrame % 4;
      spriteSheets.drawUnicornRun(ctx, drawX, drawY + (yOffset | 0), frame, this.flipX);
    } else {
      spriteSheets.draw(ctx, name, drawX, drawY + (yOffset | 0), { flipX: this.flipX });
    }

    // Draw care emote if visible
    if (this.emoteVisible) {
      this._drawEmote(ctx, drawX, drawY);
    }
  }

  /**
   * Draw a care emote bubble above the companion.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   */
  _drawEmote(ctx, x, y) {
    const emoteX = x + 4;
    const emoteY = y - 12;
    const pulse = 1 + Math.sin(this.emoteTimer * 4) * 0.15;

    ctx.save();
    ctx.translate(emoteX, emoteY);
    ctx.scale(pulse, pulse);

    switch (this.emoteType) {
      case EmoteType.HEART:
        ctx.fillStyle = '#ff6b8a';
        // Tiny heart shape with pixels
        ctx.fillRect(-2, -1, 2, 1);
        ctx.fillRect(1, -1, 2, 1);
        ctx.fillRect(-3, 0, 7, 1);
        ctx.fillRect(-2, 1, 5, 1);
        ctx.fillRect(-1, 2, 3, 1);
        ctx.fillRect(0, 3, 1, 1);
        break;
      case EmoteType.SLEEPY:
        // Z z z
        ctx.fillStyle = '#aabbff';
        ctx.font = '6px monospace';
        ctx.fillText('Z', 0, 0);
        ctx.font = '4px monospace';
        ctx.fillText('z', 4, -3);
        break;
      case EmoteType.PLAYFUL:
        // Star
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-1, -3, 3, 1);
        ctx.fillRect(-2, -2, 5, 1);
        ctx.fillRect(-3, -1, 7, 1);
        ctx.fillRect(-1, 0, 3, 1);
        ctx.fillRect(-2, 1, 2, 1);
        ctx.fillRect(1, 1, 2, 1);
        break;
    }

    ctx.restore();
  }

  /**
   * Serialize companion state.
   * @returns {object}
   */
  serialize() {
    return {
      name: this.name,
      level: this.level,
      evolutionStage: this.evolutionStage
    };
  }

  /**
   * Restore companion state.
   * @param {object} data
   */
  deserialize(data) {
    if (!data) return;
    this.level = data.level || 1;
    this.evolutionStage = data.evolutionStage || 0;
  }
}
