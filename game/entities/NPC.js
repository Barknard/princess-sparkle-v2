/**
 * NPC.js — Village/Forest characters for Princess Sparkle V2
 *
 * Home tile + wander radius (3x3).
 * Wanders to random tile every 3-6 seconds.
 * Silly behaviors (personality-specific, triggered randomly ~1/minute).
 * Quest indicator ("!" star) when quest available.
 * Interaction zone: 1.5 tile radius.
 * Dialogue ID reference.
 * Facial expression states: happy, sad, worried, grateful.
 * Ambient lines (spoken periodically when player is nearby).
 */

import spriteSheets from '../data/SpriteSheetManager.js';

const TILE = 16;

// Wander timing
const WANDER_MIN_INTERVAL = 3.0;  // seconds
const WANDER_MAX_INTERVAL = 6.0;
const WANDER_RADIUS = 1; // tiles from home (3x3 grid)
const WANDER_SPEED = 0.8; // tiles/second (slower than princess)

// Interaction
const INTERACTION_RADIUS = 1.5; // tiles

// Silly behaviors
const SILLY_CHANCE_PER_SECOND = 1 / 60; // ~1 per minute
const SILLY_DURATION = 2.5;

// Ambient lines
const AMBIENT_LINE_MIN_INTERVAL = 15.0; // seconds
const AMBIENT_LINE_MAX_INTERVAL = 30.0;
const AMBIENT_PLAYER_RANGE = 4.0; // tiles — player must be this close

// Quest indicator
const QUEST_STAR_PULSE_SPEED = 3.0;  // radians/second
const QUEST_STAR_Y_OFFSET = -14;     // pixels above sprite

/** Facial expression states */
export const Expression = {
  HAPPY: 'happy',
  SAD: 'sad',
  WORRIED: 'worried',
  GRATEFUL: 'grateful',
  NEUTRAL: 'neutral'
};

export default class NPC {
  /**
   * @param {object} config
   * @param {string} config.id - Unique NPC identifier
   * @param {string} config.name - Display name
   * @param {string} config.spriteName - Key into sprite system
   * @param {number} config.homeX - Home tile X
   * @param {number} config.homeY - Home tile Y
   * @param {string} [config.dialogueId] - Dialogue tree ID
   * @param {string} [config.personality] - Personality type for silly behaviors
   * @param {Array<string>} [config.ambientLines] - Voice IDs for ambient lines
   * @param {Array<string>} [config.sillyBehaviors] - Types of silly behaviors this NPC does
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name || 'Villager';
    this.spriteName = config.spriteName || 'npc';

    // Position in tile coords
    this.x = config.homeX || 0;
    this.y = config.homeY || 0;
    this.homeX = config.homeX || 0;
    this.homeY = config.homeY || 0;

    // Dialogue
    this.dialogueId = config.dialogueId || null;

    // Quest state
    this.hasQuest = false;
    this.questId = null;

    // Expression
    this.expression = Expression.NEUTRAL;

    // Personality / silly behaviors
    this.personality = config.personality || 'default';
    this.sillyBehaviors = config.sillyBehaviors || [];

    // Ambient lines
    this.ambientLines = config.ambientLines || [];

    // Animation
    this.animFrame = 0;
    this.animTimer = 0;
    this.flipX = false;

    // Wander state
    this.wanderTimer = this._randomWanderInterval();
    this.wanderTargetX = this.x;
    this.wanderTargetY = this.y;
    this.isWandering = false;

    // Silly state
    this.sillying = false;
    this.sillyTimer = 0;
    this.sillyType = '';

    // Ambient line state
    this.ambientTimer = this._randomAmbientInterval();
    this.currentAmbientLine = null;

    // Quest star animation
    this._starPulse = 0;
  }

  /**
   * Set quest availability for this NPC.
   * @param {string|null} questId
   */
  setQuest(questId) {
    this.questId = questId;
    this.hasQuest = questId !== null;
  }

  /**
   * Set facial expression.
   * @param {string} expression - One of Expression values
   */
  setExpression(expression) {
    this.expression = expression;
  }

  /**
   * Check if a world position is within interaction range.
   * @param {number} worldX - Tile coordinate
   * @param {number} worldY - Tile coordinate
   * @returns {boolean}
   */
  isInRange(worldX, worldY) {
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    return (dx * dx + dy * dy) <= INTERACTION_RADIUS * INTERACTION_RADIUS;
  }

  /**
   * Update NPC each frame.
   * @param {number} dt - Delta time in seconds
   * @param {import('./Player.js').default|null} player - For proximity checks
   * @param {import('../systems/CollisionSystem.js').default|null} collision
   * @returns {{ambientLine: string|null}} Events triggered this frame
   */
  update(dt, player, collision) {
    const dtMs = dt * 1000;
    let ambientLine = null;

    // Animation: walk frames 4-7 at 150ms, idle frames 0-1 at 500ms
    const isMoving = this.isWandering;
    const frameInterval = isMoving ? 150 : 500;
    const frameCount = isMoving ? 4 : 2;
    this.animTimer += dtMs;
    if (this.animTimer >= frameInterval) {
      this.animTimer -= frameInterval;
      this.animFrame = (this.animFrame + 1) % frameCount;
    }

    // Quest star pulse
    if (this.hasQuest) {
      this._starPulse += dt * QUEST_STAR_PULSE_SPEED;
    }

    // Silly behavior check
    if (!this.sillying && !this.isWandering) {
      this._updateSilly(dt);
    }

    // Silly animation countdown
    if (this.sillying) {
      this.sillyTimer -= dt;
      if (this.sillyTimer <= 0) {
        this.sillying = false;
      }
    }

    // Wander behavior
    if (!this.sillying) {
      this._updateWander(dt, collision);
    }

    // Ambient lines (only when player is nearby)
    if (player && this.ambientLines.length > 0) {
      const px = player.x - this.x;
      const py = player.y - this.y;
      const playerDist = Math.sqrt(px * px + py * py);

      if (playerDist <= AMBIENT_PLAYER_RANGE) {
        this.ambientTimer -= dt;
        if (this.ambientTimer <= 0) {
          ambientLine = this.ambientLines[(Math.random() * this.ambientLines.length) | 0];
          this.ambientTimer = this._randomAmbientInterval();
        }
      }
    }

    return { ambientLine };
  }

  /**
   * Update wander behavior.
   * @param {number} dt
   * @param {object|null} collision
   */
  _updateWander(dt, collision) {
    if (this.isWandering) {
      // Move toward wander target
      const dx = this.wanderTargetX - this.x;
      const dy = this.wanderTargetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= WANDER_SPEED * dt) {
        // Arrived
        this.x = this.wanderTargetX;
        this.y = this.wanderTargetY;
        this.isWandering = false;
        this.wanderTimer = this._randomWanderInterval();
      } else {
        const invDist = 1 / dist;
        this.x += dx * invDist * WANDER_SPEED * dt;
        this.y += dy * invDist * WANDER_SPEED * dt;

        // Update facing
        if (Math.abs(dx) > Math.abs(dy)) {
          this.flipX = dx < 0;
        }
      }
      return;
    }

    // Countdown to next wander
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      // Pick random tile within wander radius
      const newX = this.homeX + ((Math.random() * (WANDER_RADIUS * 2 + 1)) | 0) - WANDER_RADIUS;
      const newY = this.homeY + ((Math.random() * (WANDER_RADIUS * 2 + 1)) | 0) - WANDER_RADIUS;

      // Check walkability if collision system available
      if (collision && !collision.isWalkable(newX, newY)) {
        this.wanderTimer = this._randomWanderInterval();
        return;
      }

      this.wanderTargetX = newX;
      this.wanderTargetY = newY;
      this.isWandering = true;
    }
  }

  /**
   * Check and trigger silly behavior.
   * @param {number} dt
   */
  _updateSilly(dt) {
    if (this.sillyBehaviors.length === 0) return;

    if (Math.random() < SILLY_CHANCE_PER_SECOND * dt) {
      this.sillying = true;
      this.sillyType = this.sillyBehaviors[(Math.random() * this.sillyBehaviors.length) | 0];
      this.sillyTimer = SILLY_DURATION;
    }
  }

  /**
   * Random wander interval.
   * @returns {number} seconds
   */
  _randomWanderInterval() {
    return WANDER_MIN_INTERVAL + Math.random() * (WANDER_MAX_INTERVAL - WANDER_MIN_INTERVAL);
  }

  /**
   * Random ambient line interval.
   * @returns {number} seconds
   */
  _randomAmbientInterval() {
    return AMBIENT_LINE_MIN_INTERVAL +
      Math.random() * (AMBIENT_LINE_MAX_INTERVAL - AMBIENT_LINE_MIN_INTERVAL);
  }

  /**
   * Draw NPC at correct screen position.
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
    let ctx, sx, sy;
    if (camera && typeof camera === 'object' && 'x' in camera) {
      ctx = rendererOrCtx.ctx || rendererOrCtx;
      sx = ((this.x - camera.x) * TILE) | 0;
      sy = ((this.y - camera.y) * TILE) | 0;
    } else {
      ctx = rendererOrCtx;
      sx = (this.x * TILE) | 0;
      sy = (this.y * TILE) | 0;
    }

    // Silly behavior visual
    let yOffset = 0;
    if (this.sillying) {
      yOffset = Math.sin(this.sillyTimer * 8) * 2;
    }

    // Draw sprite using SpriteSheetManager — prefer animated sheets
    if (spriteSheets.loaded && spriteSheets.hasAnimSheet(this.spriteName)) {
      if (this.isWandering) {
        // Walk animation: cycle Walk_1-4 at 150ms
        spriteSheets.drawWalkFrame(ctx, this.spriteName, this.animFrame, sx, sy + (yOffset | 0), this.flipX);
      } else {
        // Idle animation: cycle Idle_1-4 at 400ms
        spriteSheets.drawIdleFrame(ctx, this.spriteName, this.animFrame, sx, sy + (yOffset | 0), this.flipX);
      }
    } else {
      // Fallback to static sprite
      spriteSheets.draw(ctx, this.spriteName, sx, sy + (yOffset | 0), { flipX: this.flipX });
    }

    // Draw quest indicator ("!" star)
    if (this.hasQuest) {
      this._drawQuestStar(ctx, sx + 4, sy + QUEST_STAR_Y_OFFSET);
    }

    // Draw expression indicator (small colored dot above head for non-neutral)
    if (this.expression !== Expression.NEUTRAL && !this.hasQuest) {
      this._drawExpressionDot(ctx, sx + 6, sy - 4);
    }
  }

  /**
   * Draw the quest available "!" star indicator.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   */
  _drawQuestStar(ctx, x, y) {
    const pulse = 0.8 + Math.sin(this._starPulse) * 0.2;
    const size = 6 * pulse;

    ctx.save();
    ctx.translate(x + 4, y + 3);

    // Star shape
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
      const r = i === 0 ? size : size;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // "!" in center
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(-1, -3, 2, 3);
    ctx.fillRect(-1, 1, 2, 1);

    ctx.restore();
  }

  /**
   * Draw a small expression dot.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   */
  _drawExpressionDot(ctx, x, y) {
    const colors = {
      [Expression.HAPPY]: '#90ee90',
      [Expression.SAD]: '#6699cc',
      [Expression.WORRIED]: '#ffaa44',
      [Expression.GRATEFUL]: '#ff99cc'
    };
    ctx.fillStyle = colors[this.expression] || '#ffffff';
    ctx.fillRect(x, y, 3, 3);
  }
}
