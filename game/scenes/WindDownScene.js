/**
 * WindDownScene.js — Gentle session end for Princess Sparkle V2
 *
 * Deep blue/purple gradient background.
 * Princess and companion sit together, companion curls up.
 * Recap: "Today you helped X friends and found Y hearts!" (voice)
 * Companion goodnight line (voice).
 * Narrator: "Your friends will be here when you come back!" (voice)
 * Lullaby music crossfades in.
 * "Goodnight" button fades in after 3000ms.
 * Tap → auto-save → return to TitleScene.
 *
 * Canvas only. No DOM. Integer coords.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import TransitionOverlay from '../ui/TransitionOverlay.js';
import { playVoice } from '../data/voiceIndex.js';

// ---- Easing -----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- Constants --------------------------------------------------------------

// Auto-progress: moon icon appears, then auto-transitions after lullaby
const MOON_APPEAR_S = 3.0;          // when the moon icon fades in
const AUTO_GOODNIGHT_S = 12.0;      // auto-save and return to title after this

// Star twinkle pool
const MAX_STARS = 20;

// Firefly pool
const MAX_FIREFLIES = 10;

// Voice timeline (approximate seconds)
const VOICE_RECAP_TIME = 1.5;
const VOICE_COMPANION_TIME = 5.0;
const VOICE_NARRATOR_TIME = 8.0;
const LULLABY_CROSSFADE_TIME = 6.0;

// ---- WindDownScene ----------------------------------------------------------

export default class WindDownScene {
  constructor() {
    // Systems
    this._audioManager = null;
    this._sceneManager = null;
    this._saveManager = null;
    this._inputManager = null;

    // Session data (passed in via enter)
    this._heartsCollected = 0;
    this._friendsHelped = 0;
    this._companionId = '';

    // Timer
    this._timer = 0;

    // Moon icon (visual cue, no text)
    this._moonVisible = false;
    this._moonAlpha = 0;
    this._autoGoodnightTriggered = false;

    // Voice flags
    this._recapPlayed = false;
    this._companionPlayed = false;
    this._narratorPlayed = false;
    this._lullabyCrossfaded = false;

    // Stars
    this._stars = new Array(MAX_STARS);
    for (let i = 0; i < MAX_STARS; i++) {
      this._stars[i] = {
        x: (Math.random() * LOGICAL_WIDTH) | 0,
        y: (Math.random() * LOGICAL_HEIGHT * 0.4) | 0,
        size: 1 + ((Math.random() * 2) | 0),
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
      };
    }

    // Fireflies
    this._fireflies = new Array(MAX_FIREFLIES);
    for (let i = 0; i < MAX_FIREFLIES; i++) {
      this._fireflies[i] = {
        x: Math.random() * LOGICAL_WIDTH,
        y: LOGICAL_HEIGHT * 0.3 + Math.random() * LOGICAL_HEIGHT * 0.5,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 4,
        phase: Math.random() * Math.PI * 2,
        glowSpeed: 1 + Math.random() * 2,
      };
    }

    // Princess/companion breathing animation
    this._breatheTimer = 0;

    // Transition
    this._transition = new TransitionOverlay();
  }

  // ---- Lifecycle ------------------------------------------------------------

  init(systems) {
    this._audioManager = systems.audioManager || null;
    this._sceneManager = systems.sceneManager || null;
    this._saveManager = systems.saveManager || null;
    this._inputManager = systems.inputManager || null;
  }

  /**
   * @param {object} [params]
   * @param {number} params.hearts
   * @param {number} params.questsCompleted
   * @param {string} params.companionId
   */
  enter(params) {
    const p = params || {};
    this._heartsCollected = p.hearts || 0;
    this._friendsHelped = p.questsCompleted || 0;
    this._companionId = p.companionId || '';
    this._timer = 0;
    this._moonVisible = false;
    this._moonAlpha = 0;
    this._autoGoodnightTriggered = false;
    this._recapPlayed = false;
    this._companionPlayed = false;
    this._narratorPlayed = false;
    this._lullabyCrossfaded = false;
    this._breatheTimer = 0;
    this._transition = new TransitionOverlay();
  }

  exit() {
    // Cleanup
  }

  // ---- Update ---------------------------------------------------------------

  update(dt) {
    this._timer += dt;
    this._breatheTimer += dt;

    this._transition.update(dt);
    if (this._transition.active) return;

    // Voice timeline
    if (!this._recapPlayed && this._timer >= VOICE_RECAP_TIME) {
      this._recapPlayed = true;
      // "Today you helped X friends and found Y hearts!" — voice line
      playVoice('narrator_winddown_recap');
    }

    if (!this._companionPlayed && this._timer >= VOICE_COMPANION_TIME) {
      this._companionPlayed = true;
      // Companion goodnight — voice line
      playVoice('companion_goodnight_shimmer_01');
    }

    if (!this._narratorPlayed && this._timer >= VOICE_NARRATOR_TIME) {
      this._narratorPlayed = true;
      // "Your friends will be here when you come back!" — voice line
      playVoice('narrator_winddown_goodbye');
    }

    // Lullaby crossfade
    if (!this._lullabyCrossfaded && this._timer >= LULLABY_CROSSFADE_TIME) {
      this._lullabyCrossfaded = true;
      if (this._audioManager) {
        this._audioManager.playBGM('bgm_lullaby');
      }
    }

    // Firefly movement
    this._updateFireflies(dt);

    // Moon icon appears after delay
    if (this._timer >= MOON_APPEAR_S && !this._moonVisible) {
      this._moonVisible = true;
    }
    if (this._moonVisible) {
      this._moonAlpha = Math.min(this._moonAlpha + dt * 0.5, 1);
    }

    // Auto-goodnight after lullaby plays (no button needed)
    if (this._timer >= AUTO_GOODNIGHT_S && !this._autoGoodnightTriggered) {
      this._autoGoodnightTriggered = true;
      this._onGoodnight();
    }

    // Allow tap-anywhere to trigger goodnight early (after moon is visible)
    if (this._moonVisible && this._moonAlpha > 0.5 && !this._autoGoodnightTriggered) {
      if (this._inputManager && this._inputManager.tapped) {
        this._autoGoodnightTriggered = true;
        this._onGoodnight();
      }
    }
  }

  _updateFireflies(dt) {
    for (let i = 0; i < this._fireflies.length; i++) {
      const f = this._fireflies[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.phase += f.glowSpeed * dt;

      // Gentle boundary wrapping
      if (f.x < -5) f.x = LOGICAL_WIDTH + 5;
      if (f.x > LOGICAL_WIDTH + 5) f.x = -5;
      if (f.y < LOGICAL_HEIGHT * 0.2) f.vy = Math.abs(f.vy);
      if (f.y > LOGICAL_HEIGHT * 0.85) f.vy = -Math.abs(f.vy);
    }
  }

  _onGoodnight() {
    // Auto-save
    if (this._saveManager) {
      this._saveManager.save();
    }

    // Fade to title
    this._transition.start('fade', {
      duration: 1200,
      onHalf: () => {
        if (this._sceneManager) {
          this._sceneManager.switchTo('Title');
        }
      },
    });
  }

  // ---- Draw -----------------------------------------------------------------

  draw(renderer) {
    const ctx = renderer.ctx;

    // Deep blue/purple gradient
    this._drawBackground(ctx);

    // Stars
    this._drawStars(ctx);

    // Fireflies
    this._drawFireflies(ctx);

    // Princess and companion sitting
    this._drawPrincessAndCompanion(ctx);

    // Recap hearts display (visual, not text)
    this._drawRecapHearts(ctx);

    // Moon icon with stars (no text, pure visual)
    if (this._moonVisible) {
      this._drawMoonIcon(ctx);
    }

    // Transition
    this._transition.draw(renderer);
  }

  _drawBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, '#0d0a2a');   // deep night blue
    grad.addColorStop(0.3, '#1a1040'); // dark purple
    grad.addColorStop(0.7, '#2a1858'); // medium purple
    grad.addColorStop(1, '#3d2070');   // lighter purple at bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Soft horizon glow
    ctx.save();
    ctx.globalAlpha = 0.15;
    const horizonGrad = ctx.createLinearGradient(0, LOGICAL_HEIGHT * 0.6, 0, LOGICAL_HEIGHT);
    horizonGrad.addColorStop(0, 'rgba(100,60,140,0)');
    horizonGrad.addColorStop(1, '#6040a0');
    ctx.fillStyle = horizonGrad;
    ctx.fillRect(0, LOGICAL_HEIGHT * 0.6, LOGICAL_WIDTH, LOGICAL_HEIGHT * 0.4);
    ctx.restore();
  }

  _drawStars(ctx) {
    for (let i = 0; i < this._stars.length; i++) {
      const s = this._stars[i];
      const twinkle = Math.sin(this._timer * s.speed + s.phase) * 0.5 + 0.5;
      ctx.save();
      ctx.globalAlpha = 0.3 + twinkle * 0.7;
      ctx.fillStyle = '#ffffee';
      ctx.fillRect(s.x, s.y, s.size, s.size);
      ctx.restore();
    }
  }

  _drawFireflies(ctx) {
    for (let i = 0; i < this._fireflies.length; i++) {
      const f = this._fireflies[i];
      const glow = Math.sin(f.phase) * 0.5 + 0.5;

      ctx.save();

      // Outer glow
      ctx.globalAlpha = glow * 0.2;
      ctx.fillStyle = '#ffee88';
      ctx.beginPath();
      ctx.arc(f.x | 0, f.y | 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright dot
      ctx.globalAlpha = 0.5 + glow * 0.5;
      ctx.fillStyle = '#ffffcc';
      ctx.fillRect((f.x - 1) | 0, (f.y - 1) | 0, 2, 2);

      ctx.restore();
    }
  }

  _drawPrincessAndCompanion(ctx) {
    const baseX = (LOGICAL_WIDTH / 2 - 20) | 0;
    const baseY = (LOGICAL_HEIGHT * 0.58) | 0;
    const breathe = Math.sin(this._breatheTimer * 1.5) * 1;

    ctx.save();

    // Ground (small grass patch)
    ctx.fillStyle = '#2a4a2a';
    ctx.fillRect(baseX - 20, baseY + 16, 60, 6);

    // Princess sitting
    // Body
    ctx.fillStyle = '#ffe0ec';
    ctx.fillRect(baseX | 0, (baseY + 4 + breathe) | 0, 14, 12);
    // Dress
    ctx.fillStyle = '#ff99cc';
    ctx.fillRect((baseX - 1) | 0, (baseY + 10 + breathe) | 0, 16, 8);
    // Head
    ctx.fillStyle = '#ffdab9';
    ctx.fillRect((baseX + 2) | 0, (baseY - 4 + breathe) | 0, 10, 10);
    // Crown
    ctx.fillStyle = '#ffd700';
    ctx.fillRect((baseX + 3) | 0, (baseY - 6 + breathe) | 0, 8, 3);
    // Closed eyes (sleeping/peaceful)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect((baseX + 4) | 0, (baseY + breathe) | 0, 2, 1);
    ctx.fillRect((baseX + 8) | 0, (baseY + breathe) | 0, 2, 1);
    // Smile
    ctx.fillRect((baseX + 5) | 0, (baseY + 2 + breathe) | 0, 4, 1);

    // Companion curled up beside princess
    const compX = baseX + 18;
    const compY = baseY + 8;
    const compBreathe = Math.sin(this._breatheTimer * 1.5 + 0.5) * 0.5;

    ctx.fillStyle = '#ffb3d9';
    ctx.beginPath();
    ctx.ellipse(
      (compX + 6) | 0,
      (compY + 3 + compBreathe) | 0,
      8, 5, 0, 0, Math.PI * 2
    );
    ctx.fill();

    // Companion head
    ctx.fillRect((compX + 10) | 0, (compY - 2 + compBreathe) | 0, 6, 5);
    // Closed eye
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect((compX + 12) | 0, (compY + compBreathe) | 0, 2, 1);

    // Sleepy sparkle motes (replacing "z" text — no text for pre-literate play)
    for (let zi = 0; zi < 3; zi++) {
      const zFloat = (this._timer * 0.8 + zi * 0.5) % 3;
      const zAlpha = Math.sin(this._timer * 2 + zi) * 0.5 + 0.5;
      ctx.globalAlpha = zAlpha * 0.4 * (1 - zFloat / 3);
      ctx.fillStyle = '#ccccff';
      const zx = (compX + 18 + zi * 4) | 0;
      const zy = (compY - 4 - zFloat * 8) | 0;
      // Tiny star shape instead of letter
      ctx.fillRect(zx, zy, 2, 2);
      ctx.fillRect(zx - 1, zy + 1, 1, 1);
      ctx.fillRect(zx + 2, zy + 1, 1, 1);
    }

    ctx.restore();
  }

  _drawRecapHearts(ctx) {
    // Show collected hearts as visual display (top area)
    const startX = (LOGICAL_WIDTH / 2 - this._heartsCollected * 7) | 0;
    const y = 40;

    ctx.save();
    const fadeIn = Math.min(this._timer / 2, 1);
    ctx.globalAlpha = fadeIn * 0.8;

    for (let i = 0; i < this._heartsCollected && i < 12; i++) {
      this._drawHeart(ctx, startX + i * 14, y, 10);
    }

    ctx.restore();
  }

  _drawHeart(ctx, x, y, size) {
    const r = size / 4;
    ctx.fillStyle = '#ff6b8a';
    ctx.beginPath();
    ctx.moveTo(x, y + r * 1.2);
    ctx.bezierCurveTo(x + r * 2.2, y - r * 0.5, x + r * 1.2, y - r * 2, x, y - r * 0.6);
    ctx.bezierCurveTo(x - r * 1.2, y - r * 2, x - r * 2.2, y - r * 0.5, x, y + r * 1.2);
    ctx.fill();
  }

  /** Draw a large moon icon with orbiting stars — no text. */
  _drawMoonIcon(ctx) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const cy = (LOGICAL_HEIGHT - 48) | 0;
    const pulse = Math.sin(this._timer * 1.5) * 0.5 + 0.5;

    ctx.save();
    ctx.globalAlpha = easeInOutCubic(this._moonAlpha);

    // Soft glow behind moon
    ctx.globalAlpha = easeInOutCubic(this._moonAlpha) * (0.15 + pulse * 0.1);
    ctx.fillStyle = '#ffeebb';
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fill();

    // Moon (crescent)
    ctx.globalAlpha = easeInOutCubic(this._moonAlpha);
    ctx.fillStyle = '#ffeebb';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    // Shadow to make crescent shape
    ctx.fillStyle = '#1a1040';
    ctx.beginPath();
    ctx.arc((cx + 5) | 0, (cy - 3) | 0, 11, 0, Math.PI * 2);
    ctx.fill();

    // Small twinkling stars around the moon
    const starPositions = [
      { dx: -20, dy: -12, s: 3 },
      { dx: 18, dy: -16, s: 2 },
      { dx: -14, dy: 14, s: 2 },
      { dx: 22, dy: 8, s: 3 },
      { dx: -8, dy: -22, s: 2 },
    ];
    for (let i = 0; i < starPositions.length; i++) {
      const sp = starPositions[i];
      const twinkle = Math.sin(this._timer * (2 + i * 0.5) + i * 1.3) * 0.5 + 0.5;
      ctx.globalAlpha = easeInOutCubic(this._moonAlpha) * (0.3 + twinkle * 0.7);
      ctx.fillStyle = '#ffffee';
      ctx.fillRect((cx + sp.dx) | 0, (cy + sp.dy) | 0, sp.s, sp.s);
    }

    ctx.restore();
  }

  // ---- Helpers --------------------------------------------------------------

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
