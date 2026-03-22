/**
 * QuestCompleteScene.js — Celebration screen for Princess Sparkle V2
 *
 * Soft golden light fills screen edges (gentle 800ms fade, no flash).
 * 3 hearts float up, staggered 400ms each.
 * Companion happy animation.
 * Warm completion chime (3-note ascending).
 * Voice: narrator congratulates.
 * Starlight Path piece glows (visual).
 * "Back to Adventure" button after 2000ms (cannot skip — intentional pacing).
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

function easeOutBack(t) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

// ---- Constants --------------------------------------------------------------

const GOLDEN_FADE_MS = 800;

const HEART_COUNT = 3;
const HEART_STAGGER_MS = 400;
const HEART_FLOAT_SPEED = 30;       // pixels per second
const HEART_SIZE = 28;              // BIG colorful hearts for a child

// Auto-return to adventure (no button needed for a pre-literate child)
const AUTO_RETURN_DELAY_S = 4.0;    // seconds after celebration completes

const HEART_COLORS = ['#ff6b8a', '#ff8fab', '#ff69b4', '#ff7eb3', '#e84393', '#fd79a8'];

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
    this._pathColor = '#ff6b6b'; // color of the Starlight Path piece
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

    // Auto-return timer (replaces button for pre-literate play)
    this._autoReturnReady = false;
    this._autoReturnTimer = 0;

    // Narrator played flag
    this._narratorPlayed = false;

    // Path glow
    this._pathGlowAlpha = 0;

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
   * @param {string} params.pathColor
   * @param {string} params.companionId
   */
  enter(params) {
    const p = params || {};
    this._questName = p.questName || '';
    this._heartsEarned = p.hearts || 3;
    this._pathColor = p.pathColor || '#ff6b6b';
    this._companionId = p.companionId || '';
    this._timer = 0;
    this._goldenAlpha = 0;
    this._autoReturnReady = false;
    this._autoReturnTimer = 0;
    this._narratorPlayed = false;
    this._pathGlowAlpha = 0;
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
      this._audioManager.playSFX('questComplete');
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
          this._audioManager.playSFX('heartEarned');
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
      // Use voice system for narrator lines
      playVoice('narrator_quest_complete_01');
    }

    // Starlight Path piece glow
    if (timerMs > 1500) {
      this._pathGlowAlpha = Math.min((timerMs - 1500) / 800, 1) * 0.7;
    }

    // Auto-return after celebration finishes (no button needed for 4yo)
    if (this._narratorPlayed && !this._autoReturnReady) {
      this._autoReturnReady = true;
      this._autoReturnTimer = 0;
    }
    if (this._autoReturnReady) {
      this._autoReturnTimer += dt;
      // Also allow tap-anywhere to return early (intuitive for kids)
      if (this._autoReturnTimer >= AUTO_RETURN_DELAY_S) {
        this._onBackToAdventure();
      } else if (this._autoReturnTimer > 1.0 && this._inputManager && this._inputManager.tapped) {
        // Tap anywhere after a short grace period returns to adventure
        this._onBackToAdventure();
      }
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

    // Starlight Path piece glow
    this._drawPathPiece(ctx);

    // Sparkle portal indicator (auto-returns, but show visual cue)
    if (this._autoReturnReady) {
      this._drawReturnPortal(ctx);
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
      this._drawHeart(ctx, h.x, h.y | 0, size | 0, i);

      ctx.restore();
    }
  }

  _drawHeart(ctx, x, y, size, colorIndex) {
    const cx = x;
    const cy = y;
    const r = size / 4;
    const color = HEART_COLORS[(colorIndex || 0) % HEART_COLORS.length];

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 1.2);
    ctx.bezierCurveTo(cx + r * 2.2, cy - r * 0.5, cx + r * 1.2, cy - r * 2, cx, cy - r * 0.6);
    ctx.bezierCurveTo(cx - r * 1.2, cy - r * 2, cx - r * 2.2, cy - r * 0.5, cx, cy + r * 1.2);
    ctx.fill();

    // Shine highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc((cx - r * 0.5) | 0, (cy - r * 0.8) | 0, (r * 0.5) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((cx - r * 0.3) | 0, (cy - r * 1.0) | 0, (r * 0.2) | 0 || 1, 0, Math.PI * 2);
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

  _drawPathPiece(ctx) {
    if (this._pathGlowAlpha <= 0) return;

    const pathX = (LOGICAL_WIDTH * 0.75) | 0;
    const pathY = (LOGICAL_HEIGHT * 0.15) | 0;

    ctx.save();
    ctx.globalAlpha = this._pathGlowAlpha;

    // Path arc piece
    ctx.strokeStyle = this._pathColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pathX, pathY + 25, 30, Math.PI, 0);
    ctx.stroke();

    // Glow
    ctx.globalAlpha = this._pathGlowAlpha * 0.4;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(pathX, pathY + 25, 30, Math.PI, 0);
    ctx.stroke();

    ctx.restore();
  }

  /** Draw a sparkly portal that shows the scene will auto-return. */
  _drawReturnPortal(ctx) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const cy = (LOGICAL_HEIGHT - 52) | 0;
    const fadeIn = Math.min(this._autoReturnTimer / 1.0, 1);
    const pulse = Math.sin(this._autoReturnTimer * 3) * 0.5 + 0.5;
    const portalR = 20 + pulse * 4;

    ctx.save();
    ctx.globalAlpha = easeInOutCubic(fadeIn) * 0.7;

    // Outer glow
    ctx.fillStyle = 'rgba(255, 200, 100, 0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, portalR * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Portal ring
    ctx.globalAlpha = easeInOutCubic(fadeIn) * (0.5 + pulse * 0.3);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, portalR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner sparkle
    ctx.fillStyle = '#fffacd';
    ctx.beginPath();
    ctx.arc(cx, cy, (portalR * 0.4) | 0, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting sparkle motes
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + this._autoReturnTimer * 2;
      const sx = (cx + Math.cos(angle) * portalR) | 0;
      const sy = (cy + Math.sin(angle) * portalR) | 0;
      ctx.globalAlpha = 0.4 + Math.sin(this._autoReturnTimer * 4 + i) * 0.3;
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
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
