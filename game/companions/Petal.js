/**
 * Petal.js — Bunny companion for Princess Sparkle V2
 *
 * Trail: flower blooms, colors ['#99ff99','#ffccff','#ff99cc']
 * Shape: flower, size 5-8px, life 1200ms, stays in place
 * Silly idle: ears droop over eyes, bumps into princess gently
 * SFX: soft wind chime
 */

import Companion from '../entities/Companion.js';
import { ParticleShape } from '../entities/ParticleSystem.js';

const TRAIL_COLORS = ['#99ff99', '#ffccff', '#ff99cc'];

export default class Petal extends Companion {
  constructor() {
    super('Petal', 'bunny');
  }

  /**
   * Flower bloom trail that stays in place.
   * @returns {object} Particle config
   */
  getParticleConfig() {
    return {
      x: this.prevX,
      y: this.prevY + 12,
      count: 1,
      colors: TRAIL_COLORS,
      shape: ParticleShape.FLOWER,
      sizeMin: 5,
      sizeMax: 8,
      life: 1200,
      vxMin: -0.05,
      vxMax: 0.05,
      vyMin: -0.05,
      vyMax: 0.05,
      spread: 6
    };
  }

  /**
   * Silly idle: ears droop over eyes, bumps into princess.
   * @returns {{type: string, duration: number}}
   */
  getSillyIdleBehavior() {
    return { type: 'ear_droop_bump', duration: 3.5 };
  }

  /**
   * Extended draw for Petal-specific silly animation.
   */
  draw(renderer, camera, sprites) {
    super.draw(renderer, camera, sprites);

    if (this.sillying && this.sillyType === 'ear_droop_bump') {
      this._drawEarDroopBump(renderer.ctx, camera);
    }
  }

  /**
   * Draw ears drooping over eyes animation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   */
  _drawEarDroopBump(ctx, camera) {
    const sx = ((this.x - camera.x) * 16) | 0;
    const sy = ((this.y - camera.y) * 16) | 0;
    const progress = 1 - (this.sillyTimer / 3.5);

    // Ears gradually droop
    if (progress < 0.4) {
      const droopAmount = (progress / 0.4) * 6;
      ctx.fillStyle = '#ffffff';
      // Left ear drooping
      ctx.fillRect(sx + 3, sy - 4 + droopAmount, 2, 5);
      // Right ear drooping
      ctx.fillRect(sx + 9, sy - 4 + droopAmount, 2, 5);
      // Pink inner ear
      ctx.fillStyle = '#ffb6ff';
      ctx.fillRect(sx + 3, sy - 3 + droopAmount, 1, 3);
      ctx.fillRect(sx + 10, sy - 3 + droopAmount, 1, 3);
    }

    // Bump into princess (slight x drift)
    if (progress > 0.5 && progress < 0.7) {
      // Stars from bonk
      ctx.fillStyle = '#ffd700';
      const bx = sx + (this.flipX ? -4 : 16);
      const by = sy + 4;
      ctx.fillRect(bx, by, 2, 1);
      ctx.fillRect(bx + 1, by - 1, 1, 3);
    }

    // Confused blink at end
    if (progress > 0.8) {
      ctx.fillStyle = '#ffcccc';
      ctx.fillRect(sx + 5, sy + 5, 1, 1);
      ctx.fillRect(sx + 9, sy + 5, 1, 1);
    }
  }
}
