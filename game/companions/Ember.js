/**
 * Ember.js — Baby Dragon companion for Princess Sparkle V2
 *
 * Trail: warm golden sparks, colors ['#ff6633','#ffaa00','#ff99cc']
 * Shape: circle, size 3-5px, life 600ms, vy: -0.8 (rises fast)
 * Silly idle: tries to breathe fire, only smoke ring comes out
 * SFX: tiny crackling whoosh
 */

import Companion from '../entities/Companion.js';
import { ParticleShape } from '../entities/ParticleSystem.js';

const TRAIL_COLORS = ['#ff6633', '#ffaa00', '#ff99cc'];

export default class Ember extends Companion {
  constructor() {
    super('Ember', 'dragon');
  }

  /**
   * Warm golden spark trail.
   * @returns {object} Particle config
   */
  getParticleConfig() {
    return {
      x: this.prevX,
      y: this.prevY + 8,
      count: 2,
      colors: TRAIL_COLORS,
      shape: ParticleShape.CIRCLE,
      sizeMin: 3,
      sizeMax: 5,
      life: 600,
      vxMin: -0.4,
      vxMax: 0.4,
      vyMin: -0.8,
      vyMax: -0.2,
      spread: 3
    };
  }

  /**
   * Silly idle: tries to breathe fire, only smoke ring.
   * @returns {{type: string, duration: number}}
   */
  getSillyIdleBehavior() {
    return { type: 'smoke_ring', duration: 3.0 };
  }

  /**
   * Extended draw for Ember-specific silly animation.
   */
  draw(renderer, camera, sprites) {
    super.draw(renderer, camera, sprites);

    if (this.sillying && this.sillyType === 'smoke_ring') {
      this._drawSmokeRing(renderer.ctx, camera);
    }
  }

  /**
   * Draw the smoke ring silly animation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   */
  _drawSmokeRing(ctx, camera) {
    const sx = ((this.x - camera.x) * 16) | 0;
    const sy = ((this.y - camera.y) * 16) | 0;
    const progress = 1 - (this.sillyTimer / 3.0);

    // Puff up cheeks (wider body)
    if (progress < 0.3) {
      ctx.fillStyle = '#ff8866';
      ctx.fillRect(sx + 3, sy + 5, 2, 2);
      ctx.fillRect(sx + 9, sy + 5, 2, 2);
    }

    // Smoke ring floats out
    if (progress > 0.3 && progress < 0.9) {
      const ringProgress = (progress - 0.3) / 0.6;
      const ringX = sx + 14 + ringProgress * 16;
      const ringY = sy + 2 - ringProgress * 4;
      const ringSize = 3 + ringProgress * 4;

      ctx.strokeStyle = `rgba(180, 180, 180, ${1 - ringProgress})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ringX, ringY, ringSize, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Proud face at end
    if (progress > 0.8) {
      ctx.fillStyle = '#ffdd00';
      // Happy eyes (smaller)
      ctx.fillRect(sx + 5, sy + 3, 1, 1);
      ctx.fillRect(sx + 8, sy + 3, 1, 1);
    }
  }
}
