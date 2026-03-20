/**
 * Pip.js — Fox Cub companion for Princess Sparkle V2
 *
 * Trail: musical notes, colors ['#ffdd44','#ffaa22']
 * Shape: note, size 6-8px, life 1000ms, float up
 * Silly idle: chases own tail, catches it, falls over
 * SFX: three-note ascending chime
 */

import Companion from '../entities/Companion.js';
import { ParticleShape } from '../entities/ParticleSystem.js';

const TRAIL_COLORS = ['#ffdd44', '#ffaa22'];

export default class Pip extends Companion {
  constructor() {
    super('Pip', 'fox');
  }

  /**
   * Musical note trail.
   * @returns {object} Particle config
   */
  getParticleConfig() {
    return {
      x: this.prevX * 16,
      y: this.prevY * 16 + 8,
      count: 1,
      colors: TRAIL_COLORS,
      shape: ParticleShape.NOTE,
      sizeMin: 6,
      sizeMax: 8,
      life: 1000,
      vxMin: -0.1,
      vxMax: 0.1,
      vyMin: -0.6,
      vyMax: -0.2,
      spread: 4
    };
  }

  /**
   * Silly idle: chases tail, catches it, falls over.
   * @returns {{type: string, duration: number}}
   */
  getSillyIdleBehavior() {
    return { type: 'tail_chase', duration: 4.0 };
  }

  /**
   * Extended draw for Pip-specific silly animation.
   */
  draw(renderer, camera, sprites) {
    super.draw(renderer, camera, sprites);

    if (this.sillying && this.sillyType === 'tail_chase') {
      this._drawTailChase(renderer.ctx, camera);
    }
  }

  /**
   * Draw the tail-chasing silly animation.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} camera
   */
  _drawTailChase(ctx, camera) {
    const sx = ((this.x - camera.x) * 16) | 0;
    const sy = ((this.y - camera.y) * 16) | 0;
    const progress = 1 - (this.sillyTimer / 4.0);

    if (progress < 0.6) {
      // Spinning — draw motion circle
      const spinAngle = progress * Math.PI * 8;
      ctx.strokeStyle = 'rgba(255, 136, 68, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const radius = 6;
      ctx.arc(sx + 8, sy + 8, radius, spinAngle, spinAngle + Math.PI * 1.5);
      ctx.stroke();

      // Speed lines
      for (let i = 0; i < 3; i++) {
        const lineAngle = spinAngle + i * 0.5;
        const lx = sx + 8 + Math.cos(lineAngle) * (radius + 2);
        const ly = sy + 8 + Math.sin(lineAngle) * (radius + 2);
        ctx.fillStyle = 'rgba(255, 200, 100, 0.4)';
        ctx.fillRect(lx | 0, ly | 0, 1, 1);
      }
    } else if (progress < 0.75) {
      // Caught tail! Surprised face
      ctx.fillStyle = '#ffdd00';
      ctx.fillRect(sx + 5, sy + 3, 2, 2);
      ctx.fillRect(sx + 9, sy + 3, 2, 2);
    } else {
      // Fall over (tilt)
      ctx.save();
      ctx.translate(sx + 8, sy + 16);
      const fallAngle = ((progress - 0.75) / 0.25) * (Math.PI / 4);
      ctx.rotate(fallAngle);

      // Dizzy stars
      for (let i = 0; i < 3; i++) {
        const starAngle = progress * 6 + i * 2;
        const starX = Math.cos(starAngle) * 8;
        const starY = -12 + Math.sin(starAngle) * 3;
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(starX - 1, starY, 2, 1);
        ctx.fillRect(starX, starY - 1, 1, 2);
      }

      ctx.restore();
    }
  }
}
