/**
 * Breeze.js — Butterfly companion for Princess Sparkle V2
 *
 * Trail: wish-dust clusters of 3, colors ['#aaddff','#ffffff','#ccaaff']
 * Shape: circle, size 2-4px, life 1500ms, drift randomly
 * Silly idle: flies into spiderweb, shakes it off with glitter
 * SFX: gentle breeze tone
 */

import Companion from '../entities/Companion.js';
import { ParticleShape } from '../entities/ParticleSystem.js';

const TRAIL_COLORS = ['#aaddff', '#ffffff', '#ccaaff'];

export default class Breeze extends Companion {
  constructor() {
    super('Breeze', 'butterfly');
  }

  /**
   * Wish-dust cluster trail.
   * @returns {object} Particle config
   */
  getParticleConfig() {
    return {
      x: this.prevX * 16,
      y: this.prevY * 16 + 4,
      count: 3,
      colors: TRAIL_COLORS,
      shape: ParticleShape.CIRCLE,
      sizeMin: 2,
      sizeMax: 4,
      life: 1500,
      vxMin: -0.3,
      vxMax: 0.3,
      vyMin: -0.2,
      vyMax: 0.2,
      spread: 8
    };
  }

  /**
   * Silly idle: flies into spiderweb, shakes off with glitter.
   * @returns {{type: string, duration: number}}
   */
  getSillyIdleBehavior() {
    return { type: 'web_shake', duration: 3.5 };
  }

  /**
   * Extended draw for Breeze-specific silly animation.
   */
  draw(renderer, camera, sprites) {
    super.draw(renderer, camera, sprites);

    if (this.sillying && this.sillyType === 'web_shake') {
      this._drawWebShake(renderer.ctx, camera);
    }
  }

  /**
   * Draw the spiderweb silly animation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   */
  _drawWebShake(ctx, camera) {
    const sx = ((this.x - camera.x) * 16) | 0;
    const sy = ((this.y - camera.y) * 16) | 0;
    const progress = 1 - (this.sillyTimer / 3.5);

    // Web strands
    if (progress < 0.5) {
      ctx.strokeStyle = `rgba(200, 200, 200, ${0.6 - progress})`;
      ctx.lineWidth = 0.5;
      // Simple web lines across the sprite
      ctx.beginPath();
      ctx.moveTo(sx - 2, sy - 2);
      ctx.lineTo(sx + 14, sy + 10);
      ctx.moveTo(sx + 14, sy - 2);
      ctx.lineTo(sx - 2, sy + 10);
      ctx.moveTo(sx + 6, sy - 4);
      ctx.lineTo(sx + 6, sy + 12);
      ctx.stroke();
    }

    // Shaking off (vibration)
    if (progress > 0.3 && progress < 0.6) {
      // The companion wobbles — handled by base class sillyTimer wobble
    }

    // Glitter burst as web comes off
    if (progress > 0.5 && progress < 0.7) {
      const glitterAlpha = 1 - ((progress - 0.5) / 0.2);
      ctx.fillStyle = `rgba(200, 200, 255, ${glitterAlpha})`;
      for (let i = 0; i < 6; i++) {
        const gx = sx + 4 + Math.sin(i * 1.5 + progress * 10) * 8;
        const gy = sy + 4 + Math.cos(i * 1.5 + progress * 10) * 6;
        ctx.fillRect(gx | 0, gy | 0, 1, 1);
      }
    }
  }
}
