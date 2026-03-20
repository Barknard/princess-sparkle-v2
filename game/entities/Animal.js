/**
 * Animal.js — Ambient world animals for Princess Sparkle V2
 *
 * Type: CAT, DOG, BIRD, FROG, DUCK, SQUIRREL, RABBIT, HEDGEHOG, etc.
 * Behavior AI: wander, sleep, follow (brief), flee-and-return.
 * Tap interaction: pet (heart animation), startle (birds scatter).
 * Baby variant flag: uses smaller sprite, clumsy animations.
 * Follow mechanic: after being helped, follows princess for 1-2 min.
 * Max 1 animal follower at a time.
 */

const TILE = 16;

/** Animal types */
export const AnimalType = {
  CAT: 'CAT',
  DOG: 'DOG',
  BIRD: 'BIRD',
  FROG: 'FROG',
  DUCK: 'DUCK',
  SQUIRREL: 'SQUIRREL',
  RABBIT: 'RABBIT',
  HEDGEHOG: 'HEDGEHOG',
  FIREFLY: 'FIREFLY',
  LADYBUG: 'LADYBUG',
  BUTTERFLY: 'BUTTERFLY',
  FISH: 'FISH',
  // Baby variants
  DUCKLING: 'DUCKLING',
  KITTEN: 'KITTEN',
  PUPPY: 'PUPPY',
  BABY_BIRD: 'BABY_BIRD',
  FAWN: 'FAWN',
  TADPOLE: 'TADPOLE'
};

/** Behavior states */
export const AnimalBehavior = {
  WANDER: 'WANDER',
  IDLE: 'IDLE',
  SLEEP: 'SLEEP',
  FOLLOW: 'FOLLOW',
  FLEE: 'FLEE',
  RETURN: 'RETURN',
  TAP_REACT: 'TAP_REACT'
};

// Timing constants
const WANDER_SPEED = 0.6;      // tiles/second
const FOLLOW_SPEED = 1.8;      // tiles/second (needs to keep up)
const FLEE_SPEED = 3.0;        // tiles/second
const FOLLOW_DURATION_MIN = 60; // seconds (1 min)
const FOLLOW_DURATION_MAX = 120;// seconds (2 min)
const IDLE_MIN = 2.0;          // seconds
const IDLE_MAX = 8.0;
const WANDER_MIN = 1.0;
const WANDER_MAX = 4.0;
const FLEE_DISTANCE = 3.0;     // tiles
const FLEE_RETURN_DELAY = 5.0; // seconds before returning
const TAP_REACT_DURATION = 1.5;// seconds
const FOLLOW_OFFSET = 2.5;     // tiles behind player

/** Tap interaction types per animal */
const TAP_INTERACTIONS = {
  [AnimalType.CAT]:       { reaction: 'pet',     sfx: 'pet_cat',      particle: 'heartsFloating' },
  [AnimalType.DOG]:       { reaction: 'pet',     sfx: 'pet_dog',      particle: 'heartsFloating' },
  [AnimalType.BIRD]:      { reaction: 'scatter', sfx: 'tap_bird',     particle: null },
  [AnimalType.FROG]:      { reaction: 'jump',    sfx: 'tap_frog',     particle: null },
  [AnimalType.DUCK]:      { reaction: 'quack',   sfx: 'tap_duck',     particle: null },
  [AnimalType.SQUIRREL]:  { reaction: 'flip',    sfx: 'tap_squirrel', particle: null },
  [AnimalType.RABBIT]:    { reaction: 'sniff',   sfx: 'tap_rabbit',   particle: null },
  [AnimalType.HEDGEHOG]:  { reaction: 'curl',    sfx: 'tap_hedgehog', particle: null },
  [AnimalType.FIREFLY]:   { reaction: 'glow',    sfx: 'tap_firefly',  particle: 'sparkleBurst' },
  [AnimalType.LADYBUG]:   { reaction: 'flyUp',   sfx: 'tap_ladybug',  particle: null },
  [AnimalType.BUTTERFLY]: { reaction: 'swirl',   sfx: 'tap_butterfly',particle: null },
  [AnimalType.FISH]:      { reaction: 'jump',    sfx: 'tap_fish',     particle: null },
  [AnimalType.DUCKLING]:  { reaction: 'waddle',  sfx: 'tap_duckling', particle: 'heartsFloating' },
  [AnimalType.KITTEN]:    { reaction: 'pounce',  sfx: 'tap_kitten',   particle: 'heartsFloating' },
  [AnimalType.PUPPY]:     { reaction: 'spin',    sfx: 'tap_puppy',    particle: 'heartsFloating' },
  [AnimalType.BABY_BIRD]: { reaction: 'flap',    sfx: 'tap_babybird', particle: 'heartsFloating' },
  [AnimalType.FAWN]:      { reaction: 'wobble',  sfx: 'tap_fawn',     particle: 'heartsFloating' },
  [AnimalType.TADPOLE]:   { reaction: 'peep',    sfx: 'tap_tadpole',  particle: null }
};

/** Animals that are baby variants */
const BABY_TYPES = new Set([
  AnimalType.DUCKLING, AnimalType.KITTEN, AnimalType.PUPPY,
  AnimalType.BABY_BIRD, AnimalType.FAWN, AnimalType.TADPOLE
]);

export default class Animal {
  /**
   * @param {object} config
   * @param {string} config.type - One of AnimalType values
   * @param {number} config.x - Spawn tile X
   * @param {number} config.y - Spawn tile Y
   * @param {string} [config.spriteName] - Sprite key
   * @param {number} [config.wanderRadius=3] - Max wander distance from spawn
   */
  constructor(config) {
    this.type = config.type;
    this.spriteName = config.spriteName || this.type.toLowerCase();
    this.isBaby = BABY_TYPES.has(this.type);

    // Position
    this.x = config.x;
    this.y = config.y;
    this.spawnX = config.x;
    this.spawnY = config.y;
    this.wanderRadius = config.wanderRadius || 3;

    // Behavior state machine
    this.behavior = AnimalBehavior.IDLE;
    this.prevBehavior = AnimalBehavior.IDLE;

    // Timers
    this.stateTimer = this._randomIdle();
    this.followTimer = 0;
    this.reactTimer = 0;
    this.fleeReturnTimer = 0;

    // Movement target
    this.targetX = this.x;
    this.targetY = this.y;

    // Animation
    this.animFrame = 0;
    this.animTimer = 0;
    this.flipX = false;

    // Tap interaction
    this.tapInteraction = TAP_INTERACTIONS[this.type] || null;

    // Following state
    this.isFollowing = false;

    // Flee origin (to return to)
    this.fleeOriginX = 0;
    this.fleeOriginY = 0;

    // Active flag for pool management
    this.active = true;
  }

  /**
   * Start following the player (after being helped).
   */
  startFollow() {
    this.isFollowing = true;
    this.behavior = AnimalBehavior.FOLLOW;
    this.followTimer = FOLLOW_DURATION_MIN +
      Math.random() * (FOLLOW_DURATION_MAX - FOLLOW_DURATION_MIN);
  }

  /**
   * Stop following.
   */
  stopFollow() {
    this.isFollowing = false;
    this.behavior = AnimalBehavior.IDLE;
    this.stateTimer = this._randomIdle();
  }

  /**
   * Handle tap on this animal.
   * @returns {{reaction: string, sfx: string, particle: string|null}|null}
   */
  tap() {
    if (!this.tapInteraction) return null;
    if (this.behavior === AnimalBehavior.TAP_REACT) return null;

    // Birds flee on tap
    if (this.type === AnimalType.BIRD || this.type === AnimalType.BUTTERFLY) {
      this._startFlee();
    } else {
      this.behavior = AnimalBehavior.TAP_REACT;
      this.reactTimer = TAP_REACT_DURATION;
    }

    return {
      reaction: this.tapInteraction.reaction,
      sfx: this.tapInteraction.sfx,
      particle: this.tapInteraction.particle
    };
  }

  /**
   * Update animal each frame.
   * @param {number} dt - Delta time in seconds
   * @param {import('./Player.js').default|null} player
   * @param {import('../systems/CollisionSystem.js').default|null} collision
   */
  update(dt, player, collision) {
    if (!this.active) return;

    const dtMs = dt * 1000;

    // Animation
    this.animTimer += dtMs;
    if (this.animTimer >= 600) {
      this.animTimer -= 600;
      this.animFrame = (this.animFrame + 1) % 2;
    }

    switch (this.behavior) {
      case AnimalBehavior.IDLE:
        this._updateIdle(dt);
        break;
      case AnimalBehavior.WANDER:
        this._updateWander(dt, collision);
        break;
      case AnimalBehavior.SLEEP:
        this._updateSleep(dt);
        break;
      case AnimalBehavior.FOLLOW:
        this._updateFollow(dt, player);
        break;
      case AnimalBehavior.FLEE:
        this._updateFlee(dt);
        break;
      case AnimalBehavior.RETURN:
        this._updateReturn(dt, collision);
        break;
      case AnimalBehavior.TAP_REACT:
        this._updateTapReact(dt);
        break;
    }
  }

  /** Idle: wait, then pick a new behavior. */
  _updateIdle(dt) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      // Randomly pick next behavior
      const roll = Math.random();
      if (roll < 0.5) {
        // Wander
        this._pickWanderTarget();
        this.behavior = AnimalBehavior.WANDER;
        this.stateTimer = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
      } else if (roll < 0.75 && this._canSleep()) {
        // Sleep
        this.behavior = AnimalBehavior.SLEEP;
        this.stateTimer = 5 + Math.random() * 10;
      } else {
        // Stay idle a bit longer
        this.stateTimer = this._randomIdle();
      }
    }
  }

  /** Wander toward target. */
  _updateWander(dt, collision) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clumsy movement for babies
    const speed = this.isBaby ? WANDER_SPEED * 0.6 : WANDER_SPEED;

    if (dist <= speed * dt) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.behavior = AnimalBehavior.IDLE;
      this.stateTimer = this._randomIdle();
    } else {
      const invDist = 1 / dist;
      this.x += dx * invDist * speed * dt;
      this.y += dy * invDist * speed * dt;
      this.flipX = dx < 0;
    }
  }

  /** Sleep: just wait. */
  _updateSleep(dt) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.behavior = AnimalBehavior.IDLE;
      this.stateTimer = this._randomIdle();
    }
  }

  /** Follow the player. */
  _updateFollow(dt, player) {
    if (!player) {
      this.stopFollow();
      return;
    }

    this.followTimer -= dt;
    if (this.followTimer <= 0) {
      this.stopFollow();
      return;
    }

    // Move toward a position behind the player
    const targetX = player.x - FOLLOW_OFFSET * (player.direction === 2 ? -1 : 1);
    const targetY = player.y + FOLLOW_OFFSET;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.5) {
      const speed = FOLLOW_SPEED * dt;
      const invDist = 1 / dist;
      this.x += dx * invDist * speed;
      this.y += dy * invDist * speed;
      this.flipX = dx < 0;
    }
  }

  /** Flee from current position. */
  _updateFlee(dt) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= FLEE_SPEED * dt) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.behavior = AnimalBehavior.RETURN;
      this.fleeReturnTimer = FLEE_RETURN_DELAY;
    } else {
      const invDist = 1 / dist;
      this.x += dx * invDist * FLEE_SPEED * dt;
      this.y += dy * invDist * FLEE_SPEED * dt;
      this.flipX = dx < 0;
    }
  }

  /** Wait, then return to original position. */
  _updateReturn(dt, collision) {
    this.fleeReturnTimer -= dt;
    if (this.fleeReturnTimer > 0) return;

    // Wander back toward spawn area
    const dx = this.fleeOriginX - this.x;
    const dy = this.fleeOriginY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= WANDER_SPEED * dt) {
      this.x = this.fleeOriginX;
      this.y = this.fleeOriginY;
      this.behavior = AnimalBehavior.IDLE;
      this.stateTimer = this._randomIdle();
    } else {
      const invDist = 1 / dist;
      this.x += dx * invDist * WANDER_SPEED * dt;
      this.y += dy * invDist * WANDER_SPEED * dt;
      this.flipX = dx < 0;
    }
  }

  /** Tap reaction animation countdown. */
  _updateTapReact(dt) {
    this.reactTimer -= dt;
    if (this.reactTimer <= 0) {
      this.behavior = AnimalBehavior.IDLE;
      this.stateTimer = this._randomIdle();
    }
  }

  /** Start fleeing from current position. */
  _startFlee() {
    this.fleeOriginX = this.x;
    this.fleeOriginY = this.y;

    // Flee in a random direction
    const angle = Math.random() * Math.PI * 2;
    this.targetX = this.x + Math.cos(angle) * FLEE_DISTANCE;
    this.targetY = this.y + Math.sin(angle) * FLEE_DISTANCE;

    this.behavior = AnimalBehavior.FLEE;
  }

  /** Pick a random wander target within wander radius of spawn. */
  _pickWanderTarget() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.wanderRadius;
    this.targetX = this.spawnX + Math.cos(angle) * dist;
    this.targetY = this.spawnY + Math.sin(angle) * dist;
  }

  /** Can this animal type sleep? */
  _canSleep() {
    const sleepyTypes = new Set([
      AnimalType.CAT, AnimalType.DOG, AnimalType.HEDGEHOG,
      AnimalType.KITTEN, AnimalType.PUPPY, AnimalType.FAWN
    ]);
    return sleepyTypes.has(this.type);
  }

  /** Random idle duration. */
  _randomIdle() {
    return IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
  }

  /**
   * Check if position is within tap range.
   * @param {number} worldX - Tile X
   * @param {number} worldY - Tile Y
   * @returns {boolean}
   */
  isInRange(worldX, worldY) {
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    return (dx * dx + dy * dy) <= 1.5 * 1.5;
  }

  /**
   * Draw the animal.
   * @param {import('../engine/Renderer.js').default} renderer
   * @param {object} camera
   * @param {object} sprites
   */
  draw(renderer, camera, sprites) {
    if (!this.active) return;

    const sx = ((this.x - camera.x) * TILE) | 0;
    const sy = ((this.y - camera.y) * TILE) | 0;
    const ctx = renderer.ctx;

    let yOffset = 0;
    let scale = this.isBaby ? 0.7 : 1.0;

    // Behavior-specific visuals
    switch (this.behavior) {
      case AnimalBehavior.SLEEP:
        // Draw Z's above
        ctx.fillStyle = '#aabbff';
        ctx.font = '5px monospace';
        const zBob = Math.sin(this.animTimer * 0.003) * 2;
        ctx.fillText('z', sx + 10, sy - 6 + zBob);
        ctx.font = '4px monospace';
        ctx.fillText('z', sx + 13, sy - 10 + zBob);
        break;
      case AnimalBehavior.TAP_REACT:
        // Reaction animation
        yOffset = Math.sin(this.reactTimer * 8) * 2;
        break;
      case AnimalBehavior.FLEE:
        // Speed lines? Just faster animation
        break;
    }

    // Clumsy baby animation (wobble)
    if (this.isBaby && this.behavior === AnimalBehavior.WANDER) {
      yOffset += Math.sin(this.animTimer * 0.008) * 1.5;
    }

    // Draw sprite
    if (sprites && sprites.draw) {
      ctx.save();
      if (scale !== 1) {
        ctx.translate(sx + 8, sy + 16);
        ctx.scale(scale, scale);
        ctx.translate(-8, -16);
        sprites.draw(ctx, this.spriteName, 0, yOffset | 0, this.animFrame, this.flipX);
      } else {
        sprites.draw(ctx, this.spriteName, sx, sy + (yOffset | 0), this.animFrame, this.flipX);
      }
      ctx.restore();
    } else {
      // Placeholder
      const size = this.isBaby ? 8 : 12;
      ctx.fillStyle = this._getPlaceholderColor();
      ctx.fillRect(sx + (8 - size / 2), sy + (16 - size) + (yOffset | 0), size, size);
    }
  }

  /** Placeholder color per type. */
  _getPlaceholderColor() {
    const colors = {
      [AnimalType.CAT]: '#ffaa66',
      [AnimalType.DOG]: '#cc8844',
      [AnimalType.BIRD]: '#6699ff',
      [AnimalType.FROG]: '#44cc44',
      [AnimalType.DUCK]: '#ffdd44',
      [AnimalType.SQUIRREL]: '#bb6633',
      [AnimalType.RABBIT]: '#ffffff',
      [AnimalType.HEDGEHOG]: '#886644',
      [AnimalType.FIREFLY]: '#ffff88',
      [AnimalType.LADYBUG]: '#ff4444',
      [AnimalType.BUTTERFLY]: '#ff88cc',
      [AnimalType.FISH]: '#44aaff',
      [AnimalType.DUCKLING]: '#ffee66',
      [AnimalType.KITTEN]: '#ffcc88',
      [AnimalType.PUPPY]: '#ddaa77',
      [AnimalType.BABY_BIRD]: '#88bbff',
      [AnimalType.FAWN]: '#ddbb88',
      [AnimalType.TADPOLE]: '#66dd66'
    };
    return colors[this.type] || '#888888';
  }
}
