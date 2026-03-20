/**
 * Player.js — The Princess entity for Princess Sparkle V2
 *
 * Position in tile coordinates (fractional for smooth movement).
 * State machine: IDLE, WALKING, INTERACTING, CELEBRATING.
 * Walk speed: 2 tiles/second.
 * Sprite animation: 4 directions x 3 frames, 150ms per frame.
 * Idle animation: gentle sway, 2 frames, 800ms.
 * Silly reactions: sneeze near flowers, tiptoe near sleeping animals, splash in puddles.
 * Consumes path from MovementSystem step by step.
 */

/** Player states */
export const PlayerState = {
  IDLE: 'IDLE',
  WALKING: 'WALKING',
  INTERACTING: 'INTERACTING',
  CELEBRATING: 'CELEBRATING'
};

/** Facing directions */
export const Direction = {
  DOWN: 0,
  LEFT: 1,
  RIGHT: 2,
  UP: 3
};

// Tile size in pixels
const TILE = 16;

// Movement
const WALK_SPEED = 2.0; // tiles per second

// Animation timing
const WALK_FRAME_MS = 150;
const WALK_FRAMES = 3;
const IDLE_FRAME_MS = 800;
const IDLE_FRAMES = 2;

// Silly reaction thresholds
const SNEEZE_CHANCE = 0.33; // 1 in 3 near big flowers
const TIPTOE_RANGE = 1.5;  // tiles from sleeping animal
const SPLASH_DURATION = 3.0; // seconds of water drops on sprite

export default class Player {
  constructor() {
    // Position in tile coordinates (fractional for smooth movement)
    this.x = 0;
    this.y = 0;

    // State machine
    this.state = PlayerState.IDLE;
    this.direction = Direction.DOWN;

    // Animation
    this.animFrame = 0;
    this.animTimer = 0; // ms accumulated

    // Path following (set by MovementSystem)
    /** @type {Array<{x: number, y: number}>|null} */
    this.path = null;
    this.pathIndex = 0;

    // Silly reaction state
    this.isTiptoeing = false;
    this.splashTimer = 0; // seconds remaining for water drops effect
    this.sneezeTimer = 0; // seconds remaining for sneeze animation
    this.celebrateTimer = 0; // seconds remaining for celebration

    // Idle timer — tracks how long player has been standing still
    this.idleTime = 0;

    // Pre-allocated vector to avoid allocations in update
    this._moveVec = { x: 0, y: 0 };
  }

  /**
   * Set a path for the player to follow.
   * @param {Array<{x: number, y: number}>} path - Array of tile coordinates
   */
  setPath(path) {
    if (!path || path.length === 0) return;
    this.path = path;
    this.pathIndex = 0;
    this.state = PlayerState.WALKING;
    this.idleTime = 0;
    this.isTiptoeing = false;
  }

  /**
   * Cancel current movement and go idle.
   */
  stopMoving() {
    this.path = null;
    this.pathIndex = 0;
    if (this.state === PlayerState.WALKING) {
      this.state = PlayerState.IDLE;
    }
  }

  /**
   * Enter the interacting state (e.g., talking to NPC).
   */
  startInteracting() {
    this.stopMoving();
    this.state = PlayerState.INTERACTING;
    this.idleTime = 0;
  }

  /**
   * Return to idle after interaction.
   */
  stopInteracting() {
    this.state = PlayerState.IDLE;
    this.idleTime = 0;
  }

  /**
   * Trigger celebration animation (e.g., quest complete).
   * @param {number} [duration=2.0] - seconds
   */
  celebrate(duration) {
    this.state = PlayerState.CELEBRATING;
    this.celebrateTimer = duration || 2.0;
    this.animFrame = 0;
    this.animTimer = 0;
  }

  /**
   * Trigger sneeze reaction.
   */
  sneeze() {
    this.sneezeTimer = 1.0;
    // Sneeze interrupts walking briefly
    if (this.state === PlayerState.WALKING) {
      this.state = PlayerState.IDLE;
      // Will resume after sneezeTimer expires
    }
  }

  /**
   * Trigger splash reaction (stepped in puddle).
   */
  splash() {
    this.splashTimer = SPLASH_DURATION;
  }

  /**
   * Check if a sneeze should trigger (call when near big flowers).
   * @returns {boolean}
   */
  shouldSneeze() {
    return Math.random() < SNEEZE_CHANCE;
  }

  /**
   * Update player each frame.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const dtMs = dt * 1000;

    // Countdown timers
    if (this.splashTimer > 0) this.splashTimer -= dt;
    if (this.sneezeTimer > 0) {
      this.sneezeTimer -= dt;
      if (this.sneezeTimer <= 0 && this.path) {
        // Resume walking after sneeze
        this.state = PlayerState.WALKING;
      }
    }

    switch (this.state) {
      case PlayerState.IDLE:
        this._updateIdle(dtMs);
        break;
      case PlayerState.WALKING:
        this._updateWalking(dt, dtMs);
        break;
      case PlayerState.INTERACTING:
        this._updateIdle(dtMs); // Gentle sway while talking
        break;
      case PlayerState.CELEBRATING:
        this._updateCelebrating(dt, dtMs);
        break;
    }
  }

  /**
   * Idle animation: gentle sway, 2 frames, 800ms cycle.
   * @param {number} dtMs
   */
  _updateIdle(dtMs) {
    this.idleTime += dtMs / 1000;
    this.animTimer += dtMs;
    if (this.animTimer >= IDLE_FRAME_MS) {
      this.animTimer -= IDLE_FRAME_MS;
      this.animFrame = (this.animFrame + 1) % IDLE_FRAMES;
    }
  }

  /**
   * Walk along path, step by step.
   * @param {number} dt - seconds
   * @param {number} dtMs - milliseconds
   */
  _updateWalking(dt, dtMs) {
    this.idleTime = 0;

    // Animate walk cycle
    this.animTimer += dtMs;
    if (this.animTimer >= WALK_FRAME_MS) {
      this.animTimer -= WALK_FRAME_MS;
      this.animFrame = (this.animFrame + 1) % WALK_FRAMES;
    }

    // Follow path
    if (!this.path || this.pathIndex >= this.path.length) {
      this.state = PlayerState.IDLE;
      this.animFrame = 0;
      this.animTimer = 0;
      this.path = null;
      return;
    }

    const target = this.path[this.pathIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Determine facing direction
    if (Math.abs(dx) > Math.abs(dy)) {
      this.direction = dx > 0 ? Direction.RIGHT : Direction.LEFT;
    } else {
      this.direction = dy > 0 ? Direction.DOWN : Direction.UP;
    }

    // Use tiptoe speed if tiptoeing
    const speed = this.isTiptoeing ? WALK_SPEED * 0.4 : WALK_SPEED;
    const step = speed * dt;

    if (dist <= step) {
      // Arrived at this waypoint
      this.x = target.x;
      this.y = target.y;
      this.pathIndex++;
      if (this.pathIndex >= this.path.length) {
        this.state = PlayerState.IDLE;
        this.animFrame = 0;
        this.animTimer = 0;
        this.path = null;
      }
    } else {
      // Move toward waypoint
      const invDist = 1 / dist;
      this.x += dx * invDist * step;
      this.y += dy * invDist * step;
    }
  }

  /**
   * Celebration: spin + sparkle for a duration, then idle.
   * @param {number} dt - seconds
   * @param {number} dtMs
   */
  _updateCelebrating(dt, dtMs) {
    this.celebrateTimer -= dt;
    this.animTimer += dtMs;
    if (this.animTimer >= 120) { // faster spin
      this.animTimer -= 120;
      this.animFrame = (this.animFrame + 1) % 4;
      // Cycle through directions for spin effect
      this.direction = this.animFrame;
    }
    if (this.celebrateTimer <= 0) {
      this.state = PlayerState.IDLE;
      this.direction = Direction.DOWN;
      this.animFrame = 0;
      this.animTimer = 0;
    }
  }

  /**
   * Set tiptoe mode (near sleeping animals).
   * @param {boolean} tiptoeing
   */
  setTiptoe(tiptoeing) {
    this.isTiptoeing = tiptoeing;
  }

  /**
   * Get the screen pixel position for rendering.
   * @param {object} camera - Camera with x, y (tile offsets)
   * @returns {{sx: number, sy: number}}
   */
  screenPos(camera) {
    return {
      sx: ((this.x - camera.x) * TILE) | 0,
      sy: ((this.y - camera.y) * TILE) | 0
    };
  }

  /**
   * Draw the player sprite at the correct screen position.
   * @param {import('../engine/Renderer.js').default} renderer
   * @param {object} camera - Camera with x, y in tile coords
   * @param {object} sprites - Sprite system (game/sprites.js Sprites object)
   */
  draw(renderer, camera, sprites) {
    const pos = this.screenPos(camera);
    const ctx = renderer.ctx;

    // Determine sprite frame
    // Idle: use direction + idle sway frame
    // Walking: use direction + walk frame
    // Interacting: same as idle
    // Celebrating: spin frames

    let spriteName = 'princess';
    let frame = 0;
    let flipX = false;

    if (this.state === PlayerState.WALKING) {
      // Walk frames: 1 = step left, 0 = neutral, could add more
      frame = this.animFrame % 2; // sprites.js has 2 frames for princess
    } else {
      frame = 0; // idle/standing frame
    }

    // Flip sprite for left-facing direction
    if (this.direction === Direction.LEFT) {
      flipX = true;
    }

    // Tiptoe visual: slightly smaller Y oscillation
    let yOffset = 0;
    if (this.isTiptoeing && this.state === PlayerState.WALKING) {
      // Exaggerated slow creep: bob up slightly
      yOffset = Math.sin(this.animTimer * 0.01) * -1;
    }

    // Idle sway: gentle vertical bob
    if (this.state === PlayerState.IDLE || this.state === PlayerState.INTERACTING) {
      yOffset = this.animFrame === 1 ? -1 : 0; // 1px sway
    }

    // Sneeze visual override
    if (this.sneezeTimer > 0) {
      // Draw sneeze particles (tiny dots in front of face)
      const sneezeProgress = 1 - (this.sneezeTimer / 1.0);
      if (sneezeProgress > 0.2 && sneezeProgress < 0.6) {
        ctx.fillStyle = '#ffffcc';
        for (let i = 0; i < 3; i++) {
          const sx = pos.sx + 8 + (sneezeProgress * 12) + i * 3;
          const sy = pos.sy + 5 + (Math.sin(i * 2) * 2);
          ctx.fillRect(sx | 0, sy | 0, 1, 1);
        }
      }
    }

    // Draw the princess sprite
    if (sprites && sprites.draw) {
      sprites.draw(ctx, spriteName, pos.sx, pos.sy + (yOffset | 0), frame, flipX);
    }

    // Splash water drops effect
    if (this.splashTimer > 0) {
      ctx.fillStyle = '#aaddff';
      const count = 3;
      for (let i = 0; i < count; i++) {
        const dropX = pos.sx + 4 + (i * 4);
        const dropY = pos.sy + 2 - ((SPLASH_DURATION - this.splashTimer) * 2);
        if (dropY > pos.sy - 4) {
          ctx.fillRect(dropX | 0, dropY | 0, 1, 2);
        }
      }
    }

    // Celebration sparkles
    if (this.state === PlayerState.CELEBRATING) {
      ctx.fillStyle = '#ffd700';
      const t = this.celebrateTimer;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + t * 4;
        const r = 10 + t * 3;
        const sx = pos.sx + 8 + Math.cos(angle) * r;
        const sy = pos.sy + 8 + Math.sin(angle) * r;
        ctx.fillRect(sx | 0, sy | 0, 2, 2);
      }
    }
  }

  /**
   * Get the tile the player is standing on (integer coords).
   * @returns {{tx: number, ty: number}}
   */
  getTile() {
    return {
      tx: Math.round(this.x),
      ty: Math.round(this.y)
    };
  }

  /**
   * Serialize player state for save system.
   * @returns {object}
   */
  serialize() {
    return {
      x: this.x,
      y: this.y,
      direction: this.direction
    };
  }

  /**
   * Restore player state from save data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data) return;
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.direction = data.direction || Direction.DOWN;
    this.state = PlayerState.IDLE;
    this.path = null;
  }
}
