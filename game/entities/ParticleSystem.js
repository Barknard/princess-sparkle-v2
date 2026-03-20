/**
 * ParticleSystem.js — Object-pooled particle effects for Princess Sparkle V2
 *
 * Pool of 200 particles (pre-allocated, never GC'd).
 * Each particle: x, y, vx, vy, life, maxLife, color, size, shape, alpha.
 * Shapes: circle, star, heart, flower, note, sparkle.
 * Shape drawing: simple canvas primitives (no images).
 * emit(config) claims free slots from pool.
 * Overflow silently drops (never allocates).
 * Preset configs for common effects.
 */

const POOL_SIZE = 200;

/** Particle shapes */
export const ParticleShape = {
  CIRCLE: 'circle',
  STAR: 'star',
  HEART: 'heart',
  FLOWER: 'flower',
  NOTE: 'note',
  SPARKLE: 'sparkle'
};

/**
 * A single particle object. Pre-allocated, reused via pool.
 */
class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.maxLife = 0;
    this.color = '#ffffff';
    this.size = 2;
    this.shape = ParticleShape.CIRCLE;
    this.alpha = 1;
  }

  reset() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.maxLife = 0;
    this.color = '#ffffff';
    this.size = 2;
    this.shape = ParticleShape.CIRCLE;
    this.alpha = 1;
  }
}

export default class ParticleSystem {
  constructor() {
    // Pre-allocate pool — never GC'd
    /** @type {Particle[]} */
    this.pool = new Array(POOL_SIZE);
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool[i] = new Particle();
    }

    // Track the count of active particles for quick iteration
    this.activeCount = 0;
  }

  /**
   * Emit particles with the given configuration.
   * Claims free slots from pool. Overflow silently drops.
   *
   * @param {object} config
   * @param {number} config.x - World pixel X of emission center
   * @param {number} config.y - World pixel Y of emission center
   * @param {number} [config.count=1] - Number of particles to emit
   * @param {string[]} [config.colors=['#ffffff']] - Array of colors to pick from
   * @param {string} [config.shape='circle'] - Particle shape
   * @param {number} [config.sizeMin=2] - Min size in pixels
   * @param {number} [config.sizeMax=4] - Max size in pixels
   * @param {number} [config.life=600] - Lifetime in ms
   * @param {number} [config.vxMin=-0.5] - Min horizontal velocity (px/frame)
   * @param {number} [config.vxMax=0.5] - Max horizontal velocity
   * @param {number} [config.vyMin=-1] - Min vertical velocity
   * @param {number} [config.vyMax=0] - Max vertical velocity
   * @param {number} [config.spread=0] - Random position spread in pixels
   */
  emit(config) {
    const count = config.count || 1;
    const colors = config.colors || ['#ffffff'];
    const shape = config.shape || ParticleShape.CIRCLE;
    const sizeMin = config.sizeMin || 2;
    const sizeMax = config.sizeMax || 4;
    const life = config.life || 600;
    const vxMin = config.vxMin !== undefined ? config.vxMin : -0.5;
    const vxMax = config.vxMax !== undefined ? config.vxMax : 0.5;
    const vyMin = config.vyMin !== undefined ? config.vyMin : -1;
    const vyMax = config.vyMax !== undefined ? config.vyMax : 0;
    const spread = config.spread || 0;

    let emitted = 0;
    for (let i = 0; i < POOL_SIZE && emitted < count; i++) {
      const p = this.pool[i];
      if (p.active) continue;

      p.active = true;
      p.x = config.x + (spread > 0 ? (Math.random() - 0.5) * spread : 0);
      p.y = config.y + (spread > 0 ? (Math.random() - 0.5) * spread : 0);
      p.vx = vxMin + Math.random() * (vxMax - vxMin);
      p.vy = vyMin + Math.random() * (vyMax - vyMin);
      p.life = life;
      p.maxLife = life;
      p.color = colors[(Math.random() * colors.length) | 0];
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.shape = shape;
      p.alpha = 1;
      emitted++;
    }
    // Overflow is silently dropped — no allocation
  }

  /**
   * Update all active particles.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    const dtMs = dt * 1000;
    this.activeCount = 0;

    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dtMs;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Fade alpha based on remaining life
      p.alpha = p.life / p.maxLife;

      this.activeCount++;
    }
  }

  /**
   * Draw all active particles.
   * @param {import('../engine/Renderer.js').default} renderer
   * @param {object} camera - {x, y} in tile coords
   */
  draw(renderer, camera) {
    const ctx = renderer.ctx;
    const camPxX = camera.x * 16;
    const camPxY = camera.y * 16;

    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      const screenX = (p.x - camPxX) | 0;
      const screenY = (p.y - camPxY) | 0;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      switch (p.shape) {
        case ParticleShape.CIRCLE:
          this._drawCircle(ctx, screenX, screenY, p.size);
          break;
        case ParticleShape.STAR:
          this._drawStar(ctx, screenX, screenY, p.size);
          break;
        case ParticleShape.HEART:
          this._drawHeart(ctx, screenX, screenY, p.size);
          break;
        case ParticleShape.FLOWER:
          this._drawFlower(ctx, screenX, screenY, p.size);
          break;
        case ParticleShape.NOTE:
          this._drawNote(ctx, screenX, screenY, p.size);
          break;
        case ParticleShape.SPARKLE:
          this._drawSparkle(ctx, screenX, screenY, p.size);
          break;
        default:
          this._drawCircle(ctx, screenX, screenY, p.size);
      }
    }

    ctx.globalAlpha = 1;
  }

  // --- Shape drawing: simple canvas primitives ---

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} size
   */
  _drawCircle(ctx, x, y, size) {
    const r = (size / 2) | 0;
    if (r <= 1) {
      ctx.fillRect(x, y, size | 0, size | 0);
      return;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 4-pointed star using simple rects.
   */
  _drawStar(ctx, x, y, size) {
    const s = (size / 2) | 0;
    // Horizontal bar
    ctx.fillRect(x - s, y, s * 2 + 1, 1);
    // Vertical bar
    ctx.fillRect(x, y - s, 1, s * 2 + 1);
    // Center pixel larger
    if (s > 1) {
      ctx.fillRect(x - 1, y - 1, 3, 3);
    }
  }

  /**
   * Tiny heart shape.
   */
  _drawHeart(ctx, x, y, size) {
    const s = Math.max(1, (size / 2) | 0);
    // Top bumps
    ctx.fillRect(x - s, y - s, s, s);
    ctx.fillRect(x + 1, y - s, s, s);
    // Middle full
    ctx.fillRect(x - s, y, s * 2 + 1, s);
    // Bottom point
    if (s > 1) {
      ctx.fillRect(x - s + 1, y + s, s * 2 - 1, 1);
      ctx.fillRect(x, y + s + 1, 1, 1);
    }
  }

  /**
   * Simple flower: center dot + 4 petal dots.
   */
  _drawFlower(ctx, x, y, size) {
    const s = Math.max(1, (size / 3) | 0);
    // Center
    ctx.fillRect(x, y, s, s);
    // Petals
    ctx.fillRect(x - s, y, s, s);  // left
    ctx.fillRect(x + s, y, s, s);  // right
    ctx.fillRect(x, y - s, s, s);  // top
    ctx.fillRect(x, y + s, s, s);  // bottom
  }

  /**
   * Musical note: circle head + stem.
   */
  _drawNote(ctx, x, y, size) {
    const s = Math.max(1, (size / 2) | 0);
    // Note head (filled circle-ish)
    ctx.fillRect(x, y, s + 1, s);
    ctx.fillRect(x - 1, y + 1, s + 1, s - 1);
    // Stem
    ctx.fillRect(x + s, y - s * 2, 1, s * 2 + 1);
    // Flag
    if (s > 1) {
      ctx.fillRect(x + s + 1, y - s * 2, 1, s);
    }
  }

  /**
   * Sparkle: X-shape with bright center.
   */
  _drawSparkle(ctx, x, y, size) {
    const s = Math.max(1, (size / 2) | 0);
    // Center bright pixel
    ctx.fillRect(x, y, 1, 1);
    // Diagonals
    for (let i = 1; i <= s; i++) {
      ctx.fillRect(x - i, y - i, 1, 1);
      ctx.fillRect(x + i, y - i, 1, 1);
      ctx.fillRect(x - i, y + i, 1, 1);
      ctx.fillRect(x + i, y + i, 1, 1);
    }
    // Cross
    ctx.fillRect(x - s, y, s * 2 + 1, 1);
    ctx.fillRect(x, y - s, 1, s * 2 + 1);
  }

  /**
   * Clear all active particles.
   */
  clear() {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool[i].active = false;
    }
    this.activeCount = 0;
  }
}

// ---- Preset particle configurations ----

/**
 * Preset configs for common particle effects.
 * Usage: particles.emit(ParticlePresets.rainbowTrail(x, y));
 */
export const ParticlePresets = {
  /** Rainbow sparkle trail (Shimmer) */
  rainbowTrail(x, y) {
    return {
      x, y, count: 2,
      colors: ['#ff99ee', '#ffaaff', '#cc99ff', '#aaddff', '#ffdd88'],
      shape: ParticleShape.STAR,
      sizeMin: 3, sizeMax: 6,
      life: 800,
      vxMin: -0.3, vxMax: 0.3,
      vyMin: -0.5, vyMax: -0.1,
      spread: 4
    };
  },

  /** Warm golden sparks (Ember) */
  warmSparks(x, y) {
    return {
      x, y, count: 2,
      colors: ['#ff6633', '#ffaa00', '#ff99cc'],
      shape: ParticleShape.CIRCLE,
      sizeMin: 2, sizeMax: 5,
      life: 600,
      vxMin: -0.4, vxMax: 0.4,
      vyMin: -0.8, vyMax: -0.2,
      spread: 3
    };
  },

  /** Flower bloom trail (Petal) */
  flowerBloom(x, y) {
    return {
      x, y, count: 1,
      colors: ['#99ff99', '#ffccff', '#ff99cc'],
      shape: ParticleShape.FLOWER,
      sizeMin: 4, sizeMax: 8,
      life: 1200,
      vxMin: -0.05, vxMax: 0.05,
      vyMin: -0.05, vyMax: 0.05,
      spread: 6
    };
  },

  /** Wish dust clusters (Breeze) */
  wishDust(x, y) {
    return {
      x, y, count: 3,
      colors: ['#aaddff', '#ffffff', '#ccaaff'],
      shape: ParticleShape.CIRCLE,
      sizeMin: 1, sizeMax: 4,
      life: 1500,
      vxMin: -0.3, vxMax: 0.3,
      vyMin: -0.2, vyMax: 0.2,
      spread: 8
    };
  },

  /** Musical notes (Pip) */
  musicNotes(x, y) {
    return {
      x, y, count: 1,
      colors: ['#ffdd44', '#ffaa22'],
      shape: ParticleShape.NOTE,
      sizeMin: 5, sizeMax: 8,
      life: 1000,
      vxMin: -0.1, vxMax: 0.1,
      vyMin: -0.6, vyMax: -0.2,
      spread: 4
    };
  },

  /** Hearts floating up (care/quest complete) */
  heartsFloating(x, y) {
    return {
      x, y, count: 3,
      colors: ['#ff6b8a', '#ffaacc', '#ff99cc'],
      shape: ParticleShape.HEART,
      sizeMin: 4, sizeMax: 7,
      life: 1200,
      vxMin: -0.2, vxMax: 0.2,
      vyMin: -0.8, vyMax: -0.3,
      spread: 10
    };
  },

  /** Sparkle burst (celebration, quest complete) */
  sparkleBurst(x, y) {
    return {
      x, y, count: 12,
      colors: ['#ffd700', '#ffffff', '#ff99ee', '#aaddff', '#99ff99'],
      shape: ParticleShape.SPARKLE,
      sizeMin: 3, sizeMax: 6,
      life: 900,
      vxMin: -1.5, vxMax: 1.5,
      vyMin: -1.5, vyMax: 1.5,
      spread: 2
    };
  }
};
