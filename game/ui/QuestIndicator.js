/**
 * QuestIndicator.js — The gentle "!" above NPCs who need help
 *
 * Soft glowing star/exclamation mark with gentle pulse animation.
 * Scale oscillates 1.0 to 1.1, 1.5s cycle.
 * NOT urgent — gentle, inviting.
 * Renders above NPC sprite in world space.
 *
 * Uses object pooling — pre-allocate a fixed number and reuse.
 * No DOM — canvas only.
 */

// ---- Constants --------------------------------------------------------------

const PULSE_MIN = 1.0;
const PULSE_MAX = 1.4;
const PULSE_CYCLE_S = 1.5;

const INDICATOR_SIZE = 16;           // logical pixels (width and height of the star)
const GLOW_RADIUS = 16;             // glow extends beyond the star
const GLOW_COLOR = 'rgba(255, 220, 100, 0.4)';
const STAR_COLOR = '#ffd700';
const STAR_INNER_COLOR = '#fff8dc';

const RING_CYCLE_S = 1.5;            // time for beacon ring to expand and reset
const RING_MAX_RADIUS = 32;          // max radius of expanding beacon rings

const MAX_POOL_SIZE = 16;            // max simultaneous indicators

// ---- QuestIndicator (single instance) ---------------------------------------

class Indicator {
  constructor() {
    this.active = false;
    this.worldX = 0;       // center X in world space
    this.worldY = 0;       // top of the indicator in world space (above NPC)
    this.timer = 0;        // pulse timer
    this.scale = 1.0;
    this.ringTimer1 = 0;   // beacon ring 1
    this.ringTimer2 = 0.75; // beacon ring 2 (staggered)
  }

  /** Activate this indicator at a world position (above an NPC). */
  activate(worldX, worldY) {
    this.active = true;
    this.worldX = worldX;
    this.worldY = worldY;
    this.timer = Math.random() * PULSE_CYCLE_S; // offset so they don't all sync
  }

  /** Deactivate and return to pool. */
  deactivate() {
    this.active = false;
  }

  /** @param {number} dt — seconds */
  update(dt) {
    if (!this.active) return;
    this.timer += dt;
    const t = (Math.sin(this.timer * Math.PI * 2 / PULSE_CYCLE_S) + 1) * 0.5; // 0..1
    this.scale = PULSE_MIN + (PULSE_MAX - PULSE_MIN) * t;

    // Update beacon ring timers
    this.ringTimer1 = (this.ringTimer1 + dt) % RING_CYCLE_S;
    this.ringTimer2 = (this.ringTimer2 + dt) % RING_CYCLE_S;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} camX — camera offset X
   * @param {number} camY — camera offset Y
   */
  draw(ctx, camX, camY) {
    if (!this.active) return;

    const sx = (this.worldX - camX) | 0;
    const sy = (this.worldY - camY) | 0;
    const halfSize = (INDICATOR_SIZE * this.scale / 2) | 0;

    ctx.save();

    // Beacon rings (drawn behind the star)
    const ringTimers = [this.ringTimer1, this.ringTimer2];
    for (let r = 0; r < ringTimers.length; r++) {
      const rt = ringTimers[r] / RING_CYCLE_S;  // 0 to 1
      const ringRadius = 4 + (RING_MAX_RADIUS - 4) * rt;
      const ringAlpha = 0.6 * (1 - rt);
      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = 'rgba(255,215,0,' + ringAlpha + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Soft glow
    ctx.globalAlpha = 0.4 + 0.15 * (this.scale - PULSE_MIN) / (PULSE_MAX - PULSE_MIN);
    ctx.fillStyle = GLOW_COLOR;
    ctx.beginPath();
    ctx.arc(sx, sy, (GLOW_RADIUS * this.scale) | 0, 0, Math.PI * 2);
    ctx.fill();

    // Star shape (4-point star)
    ctx.globalAlpha = 1;
    ctx.fillStyle = STAR_COLOR;
    ctx.beginPath();
    this._starPath(ctx, sx, sy, halfSize, (halfSize * 0.4) | 0, 4);
    ctx.fill();

    // Inner bright center
    ctx.fillStyle = STAR_INNER_COLOR;
    ctx.beginPath();
    ctx.arc(sx, sy, (halfSize * 0.3) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw a star path with n points.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} outerR
   * @param {number} innerR
   * @param {number} points
   */
  _starPath(ctx, cx, cy, outerR, innerR, points) {
    const step = Math.PI / points;
    let angle = -Math.PI / 2; // start at top
    ctx.moveTo(
      (cx + Math.cos(angle) * outerR) | 0,
      (cy + Math.sin(angle) * outerR) | 0
    );
    for (let i = 0; i < points * 2; i++) {
      angle += step;
      const r = (i % 2 === 0) ? innerR : outerR;
      ctx.lineTo(
        (cx + Math.cos(angle) * r) | 0,
        (cy + Math.sin(angle) * r) | 0
      );
    }
    ctx.closePath();
  }
}

// ---- QuestIndicatorPool (exported) ------------------------------------------

export default class QuestIndicatorPool {
  constructor() {
    /** @type {Indicator[]} */
    this._pool = new Array(MAX_POOL_SIZE);
    for (let i = 0; i < MAX_POOL_SIZE; i++) {
      this._pool[i] = new Indicator();
    }
  }

  /**
   * Get an available indicator from the pool.
   * @param {number} worldX
   * @param {number} worldY
   * @returns {Indicator|null} — null if pool exhausted
   */
  acquire(worldX, worldY) {
    for (let i = 0; i < this._pool.length; i++) {
      if (!this._pool[i].active) {
        this._pool[i].activate(worldX, worldY);
        return this._pool[i];
      }
    }
    return null; // pool exhausted — should not happen with 16 max
  }

  /**
   * Release an indicator back to the pool.
   * @param {Indicator} indicator
   */
  release(indicator) {
    indicator.deactivate();
  }

  /** Release all. */
  releaseAll() {
    for (let i = 0; i < this._pool.length; i++) {
      this._pool[i].deactivate();
    }
  }

  /** Update all active indicators. @param {number} dt seconds */
  update(dt) {
    for (let i = 0; i < this._pool.length; i++) {
      this._pool[i].update(dt);
    }
  }

  /**
   * Draw all active indicators.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} camX
   * @param {number} camY
   */
  draw(ctx, camX, camY) {
    for (let i = 0; i < this._pool.length; i++) {
      this._pool[i].draw(ctx, camX, camY);
    }
  }
}
