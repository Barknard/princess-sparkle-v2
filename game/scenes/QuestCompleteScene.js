/**
 * QuestCompleteScene.js — Celebration screen for Princess Sparkle V2
 *
 * Soft golden light fills screen edges (gentle 800ms fade, no flash).
 * 3 hearts float up, staggered 400ms each.
 * Companion happy animation.
 * Warm completion chime (3-note ascending).
 * Voice: narrator congratulates.
 * Rainbow Bridge piece glows (visual).
 * "Back to Adventure" button after 2000ms (cannot skip — intentional pacing).
 *
 * Canvas only. No DOM. Integer coords.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import TransitionOverlay from '../ui/TransitionOverlay.js';

// ---- Easing -----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBack(t) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

// ---- Constants --------------------------------------------------------------

const GOLDEN_FADE_MS = 800;

const HEART_COUNT = 3;
const HEART_STAGGER_MS = 400;
const HEART_FLOAT_SPEED = 30;       // pixels per second
const HEART_SIZE = 16;

const BUTTON_DELAY_MS = 2000;
const BUTTON_W = 140;
const BUTTON_H = 36;
const BUTTON_Y = LOGICAL_HEIGHT - 52;

const HEART_COLOR = '#ff6b8a';

// ---- QuestCompleteScene -----------------------------------------------------

export default class QuestCompleteScene {
  constructor() {
    // Systems
    this._audioManager = null;
    this._sceneManager = null;
    this._inputManager = null;
    this._assetLoader = null;

    // Quest data passed in on enter
    this._questName = '';
    this._heartsEarned = 3;
    this._bridgeColor = '#ff6b6b'; // color of the Rainbow Bridge piece
    this._companionId = '';

    // Timer
    this._timer = 0;

    // Hearts (pre-allocated)
    this._hearts = new Array(HEART_COUNT);
    for (let i = 0; i < HEART_COUNT; i++) {
      this._hearts[i] = {
        x: 0, y: 0,
        targetY: 0,
        startY: 0,
        alive: false,
        spawnTime: 0,
        scale: 0,
      };
    }

    // Golden edge glow
    this._goldenAlpha = 0;

    // Button
    this._buttonVisible = false;
    this._buttonAlpha = 0;

    // Narrator played flag
    this._narratorPlayed = false;

    // Bridge glow
    this._bridgeGlowAlpha = 0;

    // Companion animation
    this._companionBounceTimer = 0;

    // Transition
    this._transition = new TransitionOverlay();
  }

  // ---- Lifecycle ------------------------------------------------------------

  init(systems) {
    this._audioManager = systems.audioManager || null;
    this._sceneManager = systems.sceneManager || null;
    this._inputManager = systems.inputManager || null;
    this._assetLoader = systems.assetLoader || null;
  }

  /**
   * @param {object} [params]
   * @param {string} params.questName
   * @param {number} params.hearts
   * @param {string} params.bridgeColor
   * @param {string} params.companionId
   */
  enter(params) {
    const p = params || {};
    this._questName = p.questName || '';
    this._heartsEarned = p.hearts || 3;
    this._bridgeColor = p.bridgeColor || '#ff6b6b';
    this._companionId = p.companionId || '';
    this._timer = 0;
    this._goldenAlpha = 0;
    this._buttonVisible = false;
    this._buttonAlpha = 0;
    this._narratorPlayed = false;
    this._bridgeGlowAlpha = 0;
    this._companionBounceTimer = 0;
    this._transition = new TransitionOverlay();

    // Reset hearts
    const centerX = LOGICAL_WIDTH / 2;
    for (let i = 0; i < HEART_COUNT; i++) {
      const h = this._hearts[i];
      h.x = (centerX - 20 + i * 20) | 0;
      h.startY = LOGICAL_HEIGHT * 0.55;
      h.y = h.startY;
      h.targetY = LOGICAL_HEIGHT * 0.25;
      h.alive = false;
      h.spawnTime = HEART_STAGGER_MS * i; // ms
      h.scale = 0;
    }

    // Play completion chime (3-note ascending)
    if (this._audioManager) {
      this._audioManager.play('sfx_quest_complete');
    }
  }

  exit() {
    // Cleanup
  }

  // ---- Update ---------------------------------------------------------------

  update(dt) {
    this._timer += dt;
    const timerMs = this._timer * 1000;

    this._transition.update(dt);
    if (this._transition.active) return;

    // Golden edge fade in
    if (timerMs < GOLDEN_FADE_MS) {
      this._goldenAlpha = easeInOutCubic(timerMs / GOLDEN_FADE_MS) * 0.4;
    } else {
      this._goldenAlpha = 0.4;
    }

    // Hearts float up (staggered)
    for (let i = 0; i < HEART_COUNT; i++) {
      const h = this._hearts[i];
      if (timerMs >= h.spawnTime && !h.alive) {
        h.alive = true;
        // Play heart earned SFX
        if (this._audioManager) {
          this._audioManager.play('sfx_heart_earned');
        }
      }
      if (h.alive) {
        const heartAge = (timerMs - h.spawnTime) / 1000; // seconds since spawn
        const t = Math.min(heartAge / 1.2, 1);
        h.y = h.startY + (h.targetY - h.startY) * easeOutBack(t);
        h.scale = Math.min(heartAge / 0.3, 1); // quick scale-in
      }
    }

    // Companion bounce
    this._companionBounceTimer += dt;

    // Narrator congratulation (play once after hearts)
    if (!this._narratorPlayed && timerMs > HEART_STAGGER_MS * HEART_COUNT + 800) {
      this._narratorPlayed = true;
      if (this._audioManager) {
        this._audioManager.play('narrator_quest_complete');
      }
    }

    // Rainbow Bridge piece glow
    if (timerMs > 1500) {
      this._bridgeGlowAlpha = Math.min((timerMs - 1500) / 800, 1) * 0.7;
    }

    // Button appears after delay (cannot skip)
    if (timerMs > BUTTON_DELAY_MS && !this._buttonVisible) {
      this._buttonVisible = true;
    }
    if (this._buttonVisible) {
      this._buttonAlpha = Math.min(this._buttonAlpha + dt * 2, 1);
    }

    // Input
    this._handleInput();
  }

  _handleInput() {
    if (!this._buttonVisible || this._buttonAlpha < 0.5) return;
    if (!this._inputManager || !this._inputManager.tapped) return;

    const tx = this._inputManager.x;
    const ty = this._inputManager.y;
    const btnX = ((LOGICAL_WIDTH - BUTTON_W) / 2) | 0;

    if (tx >= btnX && tx <= btnX + BUTTON_W &&
        ty >= BUTTON_Y && ty <= BUTTON_Y + BUTTON_H) {
      this._onBackToAdventure();
    }
  }

  _onBackToAdventure() {
    this._transition.start('fade', {
      duration: 800,
      onHalf: () => {
        if (this._sceneManager) {
          this._sceneManager.switchTo('Overworld');
        }
      },
    });
  }

  // ---- Draw -----------------------------------------------------------------

  draw(renderer) {
    const ctx = renderer.ctx;

    // Background (soft warm gradient)
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, '#fff8f0');
    grad.addColorStop(1, '#fff0e6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Golden light at screen edges
    this._drawGoldenEdges(ctx);

    // Hearts
    this._drawHearts(ctx);

    // Companion happy animation (center-bottom area)
    this._drawCompanion(ctx);

    // Rainbow Bridge piece glow
    this._drawBridgePiece(ctx);

    // "Back to Adventure" button
    if (this._buttonVisible) {
      this._drawButton(ctx);
    }

    // Transition
    this._transition.draw(renderer);
  }

  _drawGoldenEdges(ctx) {
    if (this._goldenAlpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = this._goldenAlpha;

    // Soft radial-ish glow from edges
    const edgeW = 60;

    // Left edge
    const gradL = ctx.createLinearGradient(0, 0, edgeW, 0);
    gradL.addColorStop(0, '#ffd700');
    gradL.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = gradL;
    ctx.fillRect(0, 0, edgeW, LOGICAL_HEIGHT);

    // Right edge
    const gradR = ctx.createLinearGradient(LOGICAL_WIDTH, 0, LOGICAL_WIDTH - edgeW, 0);
    gradR.addColorStop(0, '#ffd700');
    gradR.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = gradR;
    ctx.fillRect(LOGICAL_WIDTH - edgeW, 0, edgeW, LOGICAL_HEIGHT);

    // Top edge
    const gradT = ctx.createLinearGradient(0, 0, 0, edgeW);
    gradT.addColorStop(0, '#ffd700');
    gradT.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = gradT;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, edgeW);

    // Bottom edge
    const gradB = ctx.createLinearGradient(0, LOGICAL_HEIGHT, 0, LOGICAL_HEIGHT - edgeW);
    gradB.addColorStop(0, '#ffd700');
    gradB.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = gradB;
    ctx.fillRect(0, LOGICAL_HEIGHT - edgeW, LOGICAL_WIDTH, edgeW);

    ctx.restore();
  }

  _drawHearts(ctx) {
    for (let i = 0; i < HEART_COUNT; i++) {
      const h = this._hearts[i];
      if (!h.alive) continue;

      ctx.save();
      ctx.globalAlpha = Math.min(h.scale, 1);

      const size = HEART_SIZE * h.scale;
      this._drawHeart(ctx, h.x, h.y | 0, size | 0);

      ctx.restore();
    }
  }

  _drawHeart(ctx, x, y, size) {
    const cx = x;
    const cy = y;
    const r = size / 4;

    ctx.fillStyle = HEART_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 1.2);
    ctx.bezierCurveTo(cx + r * 2.2, cy - r * 0.5, cx + r * 1.2, cy - r * 2, cx, cy - r * 0.6);
    ctx.bezierCurveTo(cx - r * 1.2, cy - r * 2, cx - r * 2.2, cy - r * 0.5, cx, cy + r * 1.2);
    ctx.fill();

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc((cx - r * 0.5) | 0, (cy - r * 0.8) | 0, (r * 0.4) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawCompanion(ctx) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const baseY = (LOGICAL_HEIGHT * 0.65) | 0;
    const bounceY = Math.abs(Math.sin(this._companionBounceTimer * 4)) * 8;
    const cy = (baseY - bounceY) | 0;

    // Simple happy companion placeholder (bouncing)
    ctx.save();

    // Glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffb3d9';
    ctx.fillRect((cx - 10) | 0, (cy - 8) | 0, 20, 16);

    // Happy face
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect((cx - 4) | 0, (cy - 4) | 0, 2, 2);
    ctx.fillRect((cx + 2) | 0, (cy - 4) | 0, 2, 2);
    // Smile
    ctx.fillRect((cx - 3) | 0, (cy + 1) | 0, 6, 1);
    ctx.fillRect((cx - 2) | 0, (cy + 2) | 0, 4, 1);

    // Sparkles around companion
    const sparkleCount = 4;
    for (let i = 0; i < sparkleCount; i++) {
      const angle = (i / sparkleCount) * Math.PI * 2 + this._companionBounceTimer * 3;
      const sr = 16 + Math.sin(this._companionBounceTimer * 2 + i) * 4;
      const sx = (cx + Math.cos(angle) * sr) | 0;
      const sy = (cy + Math.sin(angle) * sr) | 0;
      ctx.fillStyle = '#ffd700';
      ctx.globalAlpha = 0.5 + Math.sin(this._companionBounceTimer * 4 + i * 2) * 0.3;
      ctx.fillRect(sx, sy, 2, 2);
    }

    ctx.restore();
  }

  _drawBridgePiece(ctx) {
    if (this._bridgeGlowAlpha <= 0) return;

    const bridgeX = (LOGICAL_WIDTH * 0.75) | 0;
    const bridgeY = (LOGICAL_HEIGHT * 0.15) | 0;

    ctx.save();
    ctx.globalAlpha = this._bridgeGlowAlpha;

    // Bridge arc piece
    ctx.strokeStyle = this._bridgeColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bridgeX, bridgeY + 25, 30, Math.PI, 0);
    ctx.stroke();

    // Glow
    ctx.globalAlpha = this._bridgeGlowAlpha * 0.4;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(bridgeX, bridgeY + 25, 30, Math.PI, 0);
    ctx.stroke();

    ctx.restore();
  }

  _drawButton(ctx) {
    const btnX = ((LOGICAL_WIDTH - BUTTON_W) / 2) | 0;

    ctx.save();
    ctx.globalAlpha = easeInOutCubic(this._buttonAlpha);

    // Background
    ctx.fillStyle = 'rgba(255, 245, 240, 0.95)';
    ctx.beginPath();
    this._roundRect(ctx, btnX, BUTTON_Y, BUTTON_W, BUTTON_H, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#ffb366';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this._roundRect(ctx, btnX, BUTTON_Y, BUTTON_W, BUTTON_H, 8);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#8B6914';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Back to Adventure', (LOGICAL_WIDTH / 2) | 0, (BUTTON_Y + BUTTON_H / 2) | 0);

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
