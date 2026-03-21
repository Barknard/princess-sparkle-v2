/**
 * Shimmer.js — Unicorn companion for Princess Sparkle V2
 *
 * Trail: rainbow sparkle stars, colors cycle through ['#ff99ee','#ffaaff','#cc99ff']
 * Shape: star, size 4-6px, life 800ms, vy: -0.5 (float up)
 * Silly idle: horn accidentally shoots tiny rainbow that bonks a bird
 * SFX: soft harp glissando
 */

import Companion from '../entities/Companion.js';
import { ParticleShape } from '../entities/ParticleSystem.js';

const TRAIL_COLORS = ['#ff99ee', '#ffaaff', '#cc99ff'];

export default class Shimmer extends Companion {
  constructor() {
    super('Shimmer', 'unicorn');
  }

  /**
   * Rainbow sparkle star trail.
   * @returns {object} Particle config
   */
  getParticleConfig() {
    return {
      x: this.prevX,
      y: this.prevY + 8,
      count: 2,
      colors: TRAIL_COLORS,
      shape: ParticleShape.STAR,
      sizeMin: 4,
      sizeMax: 6,
      life: 800,
      vxMin: -0.3,
      vxMax: 0.3,
      vyMin: -0.5,
      vyMax: -0.1,
      spread: 4
    };
  }

  /**
   * Silly idle: horn shoots tiny rainbow that bonks a bird.
   * @returns {{type: string, duration: number}}
   */
  getSillyIdleBehavior() {
    return { type: 'rainbow_bonk', duration: 3.0 };
  }

  /**
   * Extended draw for Shimmer-specific silly animation.
   * @param {import('../engine/Renderer.js').default} renderer
   * @param {object} camera
   * @param {object} sprites
   */
  draw(renderer, camera, sprites) {
    // Call base draw
    super.draw(renderer, camera, sprites);

    // Draw silly idle animation overlay
    if (this.sillying && this.sillyType === 'rainbow_bonk') {
      this._drawRainbowBonk(renderer.ctx, camera);
    }
  }

  /**
   * Draw the rainbow bonk silly animation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   */
  _drawRainbowBonk(ctx, camera) {
    const sx = ((this.x - camera.x) * 16) | 0;
    const sy = ((this.y - camera.y) * 16) | 0;

    const progress = 1 - (this.sillyTimer / 3.0);

    // Tiny rainbow arc shooting from horn
    if (progress < 0.6) {
      const rainbowColors = ['#ff4444', '#ffaa00', '#ffdd00', '#44cc44', '#4488ff', '#8844ff'];
      const len = progress * 30;

      for (let i = 0; i < rainbowColors.length; i++) {
        ctx.fillStyle = rainbowColors[i];
        const arcX = sx + 8 + len;
        const arcY = sy - 4 + i * 1 + Math.sin(progress * 6 + i) * 2;
        ctx.fillRect(arcX | 0, arcY | 0, 2, 1);
      }
    }

    // "Bonk" star at end
    if (progress > 0.5 && progress < 0.8) {
      ctx.fillStyle = '#ffd700';
      const bx = sx + 28;
      const by = sy - 2;
      ctx.fillRect(bx - 1, by, 3, 1);
      ctx.fillRect(bx, by - 1, 1, 3);
    }

    // Embarrassed face (blush dots)
    if (progress > 0.7) {
      ctx.fillStyle = '#ffaacc';
      ctx.fillRect(sx + 3, sy + 6, 2, 1);
      ctx.fillRect(sx + 9, sy + 6, 2, 1);
    }
  }
}
