/**
 * TitleScene.js — Opening cinematic for Princess Sparkle V2
 *
 * Seven phases of gentle wonder, from soft pink to "Tap the sparkle."
 * If a save exists, shows a shorter "Continue Adventure" flow.
 *
 * Phase timing (first visit):
 *   0: Soft pink + single sparkle pulse (0–3s)
 *   1: Pixel art sky fades in, drifting clouds (3–10s)
 *   2: Rainbow builds one color at a time with chimes (10–20s)
 *   3: Camera pans down revealing village (20–28s)
 *   4: Princess appears with shimmer effect (28–33s)
 *   5: Narrator welcome voice lines (33–42s)
 *   6: "Tap the sparkle" prompt — large 64x64 pulsing sparkle (42s+)
 *
 * Continue-Adventure flow is a compressed 3s version.
 *
 * All rendering is canvas-only. No DOM.
 * Integer coordinates. Pre-allocated particle arrays.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import TransitionOverlay from '../ui/TransitionOverlay.js';
import { playVoice, preloadVoices, SCENE_VOICES } from '../data/voiceIndex.js';

// ---- Easing -----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- Constants --------------------------------------------------------------

// Phase durations in seconds
const PHASE_DURATIONS = [3, 7, 10, 8, 5, 9, Infinity]; // phase 6 waits for tap
const CONTINUE_DURATION = 3; // compressed returning-player intro

// Colors
const PINK = '#ffe0ec';
const SKY_TOP = '#aaddff';
const SKY_BOTTOM = '#ffd6e8';
const VILLAGE_GROUND = '#a8d8a0';

// Rainbow colors (6 bands, no indigo — simple for 4yo)
const RAINBOW = ['#ff6b6b', '#ffb347', '#ffe066', '#77dd77', '#6baaff', '#b388ff'];

// Rainbow chime SFX IDs (ascending scale — mapped to stepping stone notes in sfxIndex)
const RAINBOW_CHIMES = [
  'steppingStoneC', 'steppingStoneD', 'steppingStoneE',
  'steppingStoneF', 'steppingStoneG', 'steppingStoneA'
];

// Sparkle config — large, irresistible to touch
const SPARKLE_SIZE = 80;           // logical pixels (touch target, big for small fingers)
const SPARKLE_VISUAL_SIZE = 40;    // visual radius (32x32+ visible area)
const SPARKLE_PULSE_CYCLE = 1.5;   // seconds
const SPARKLE_MIN_SCALE = 0.82;
const SPARKLE_MAX_SCALE = 1.0;
const SPARKLE_BOB_SPEED = 2.0;    // up/down bob speed
const SPARKLE_BOB_AMOUNT = 6;     // pixels of vertical bob
const SPARKLE_GLOW_RING_MIN = 1.0;
const SPARKLE_GLOW_RING_MAX = 1.6; // glow ring expansion range
const SPARKLE_HALO_COUNT = 8;     // particle halo sparkles
const SPARKLE_DING_INTERVAL = 3.0; // seconds between attention dings

// Particle pool for sparkle burst
const MAX_PARTICLES = 48;

// Cloud pool
const MAX_CLOUDS = 5;
const CLOUD_SPEED = 0.3; // px per frame at 30fps ≈ 9px/s

// Star twinkle pool (magic sparkle stars)
const MAX_STARS = 12;

// ---- Particle (pre-allocated) -----------------------------------------------

function createParticlePool(size) {
  const pool = new Array(size);
  for (let i = 0; i < size; i++) {
    pool[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 2 };
  }
  return pool;
}

function createCloudPool(count) {
  const pool = new Array(count);
  for (let i = 0; i < count; i++) {
    pool[i] = {
      x: Math.random() * LOGICAL_WIDTH + LOGICAL_WIDTH * 0.3,
      y: 20 + Math.random() * 60,
      w: 24 + (Math.random() * 16) | 0,
      h: 10 + (Math.random() * 6) | 0,
      speed: CLOUD_SPEED * (0.7 + Math.random() * 0.6),
    };
  }
  return pool;
}

function createStarPool(count) {
  const pool = new Array(count);
  for (let i = 0; i < count; i++) {
    pool[i] = {
      x: (Math.random() * LOGICAL_WIDTH) | 0,
      y: (Math.random() * 80) | 0,
      phase: Math.random() * Math.PI * 2,
      size: 1 + ((Math.random() * 2) | 0),
    };
  }
  return pool;
}

// ---- TitleScene -------------------------------------------------------------

export default class TitleScene {
  constructor() {
    // Phase tracking
    this._phase = 0;
    this._phaseTimer = 0;
    this._totalTimer = 0;

    // Whether we're in "continue adventure" mode
    this._isContinue = false;
    this._continueTimer = 0;
    this._continueWelcomePlayed = false;

    // Reference to engine systems (set in init)
    this._audioManager = null;
    this._saveManager = null;
    this._sceneManager = null;
    this._assetLoader = null;
    this._inputManager = null;

    // Pre-allocated pools
    this._particles = createParticlePool(MAX_PARTICLES);
    this._clouds = createCloudPool(MAX_CLOUDS);
    this._stars = createStarPool(MAX_STARS);

    // Rainbow build progress (0..1 per band)
    this._rainbowProgress = new Float32Array(RAINBOW.length);

    // Camera pan offset for phase 3 (village reveal)
    this._cameraPanY = 0;
    this._cameraPanTarget = 0;

    // Princess appear alpha
    this._princessAlpha = 0;
    this._princessShimmerTimer = 0;

    // Narrator phase tracking
    this._narratorLineIndex = 0;
    this._narratorWaitTimer = 0;
    this._narratorDone = false;

    // Sparkle prompt state
    this._sparkleActive = false;
    this._sparkleTimer = 0;
    this._sparkleTapped = false;
    this._burstActive = false;
    this._burstTimer = 0;

    // Transition overlay
    this._transition = new TransitionOverlay();

    // Voice line IDs per phase
    this._narratorLines = [
      'narrator_title_01', // "Welcome to Princess Sparkle!"
      'narrator_title_02', // "A world full of kindness is waiting for you."
      'narrator_title_03', // "Tap the sparkle to begin your adventure."
    ];
  }

  // ---- Scene lifecycle ------------------------------------------------------

  /**
   * Called once when the scene is registered.
   * @param {object} systems — { audioManager, saveManager, sceneManager, assetLoader, inputManager }
   */
  init(systems) {
    this._audioManager = systems.audioManager || null;
    this._saveManager = systems.saveManager || null;
    this._sceneManager = systems.sceneManager || null;
    this._assetLoader = systems.assetLoader || null;
    this._inputManager = systems.inputManager || null;
  }

  /**
   * Called every time we enter/re-enter this scene.
   */
  enter() {
    this._phase = 0;
    this._phaseTimer = 0;
    this._totalTimer = 0;
    this._cameraPanY = 0;
    this._cameraPanTarget = LOGICAL_HEIGHT * 0.75;
    this._princessAlpha = 0;
    this._princessShimmerTimer = 0;
    this._narratorLineIndex = 0;
    this._narratorWaitTimer = 0;
    this._narratorDone = false;
    this._sparkleActive = false;
    this._sparkleTimer = 0;
    this._sparkleTapped = false;
    this._burstActive = false;
    this._burstTimer = 0;
    this._transition = new TransitionOverlay();

    // Reset rainbow
    for (let i = 0; i < this._rainbowProgress.length; i++) {
      this._rainbowProgress[i] = 0;
    }

    // Reset particles
    for (let i = 0; i < this._particles.length; i++) {
      this._particles[i].active = false;
    }

    // Check for save data
    this._isContinue = this._hasSaveData();
    this._continueTimer = 0;
    this._continueWelcomePlayed = false;

    // Preload voice lines for this scene
    preloadVoices(SCENE_VOICES.title);

    // Play opening ambience
    if (this._audioManager) {
      this._audioManager.playSFX('crystalTone');
    }
  }

  /** Called when leaving this scene. */
  exit() {
    // Stop any playing audio specific to this scene if needed
  }

  // ---- Update ---------------------------------------------------------------

  /**
   * @param {number} dt — seconds
   */
  update(dt) {
    this._totalTimer += dt;
    this._transition.update(dt);

    if (this._transition.active) return;

    // ---- Continue Adventure (returning player) --------------------------
    if (this._isContinue) {
      this._updateContinueFlow(dt);
      return;
    }

    // ---- First-time cinematic phases ------------------------------------
    this._phaseTimer += dt;

    switch (this._phase) {
      case 0: this._updatePhase0(dt); break; // Pink + sparkle pulse
      case 1: this._updatePhase1(dt); break; // Sky + clouds
      case 2: this._updatePhase2(dt); break; // Rainbow build
      case 3: this._updatePhase3(dt); break; // Camera pan down
      case 4: this._updatePhase4(dt); break; // Princess appears
      case 5: this._updatePhase5(dt); break; // Narrator welcome
      case 6: this._updatePhase6(dt); break; // Tap the sparkle
    }

    // Auto-advance phases (except phase 6 which waits for tap)
    if (this._phase < 6 && this._phaseTimer >= PHASE_DURATIONS[this._phase]) {
      this._advancePhase();
    }

    // Update particles
    this._updateParticles(dt);

    // Update clouds (phases 1+)
    if (this._phase >= 1) {
      this._updateClouds(dt);
    }
  }

  // ---- Phase updates --------------------------------------------------------

  /** Phase 0: Soft pink screen, single sparkle pulses. */
  _updatePhase0(dt) {
    // Sparkle pulse is handled in draw via timer
  }

  /** Phase 1: Sky fades in with drifting clouds. */
  _updatePhase1(dt) {
    // Clouds handled in _updateClouds
  }

  /** Phase 2: Rainbow builds one color at a time. */
  _updatePhase2(dt) {
    const bandDuration = PHASE_DURATIONS[2] / RAINBOW.length; // ~1.67s each
    for (let i = 0; i < RAINBOW.length; i++) {
      const bandStart = i * bandDuration;
      const localT = this._phaseTimer - bandStart;
      if (localT > 0) {
        this._rainbowProgress[i] = Math.min(localT / bandDuration, 1);

        // Play chime when band starts
        if (localT < dt * 2 && this._audioManager) {
          this._audioManager.playSFX(RAINBOW_CHIMES[i]);
        }
      }
    }
  }

  /** Phase 3: Camera pans down revealing village. */
  _updatePhase3(dt) {
    const t = Math.min(this._phaseTimer / PHASE_DURATIONS[3], 1);
    this._cameraPanY = this._cameraPanTarget * easeInOutCubic(t);
  }

  /** Phase 4: Princess appears with shimmer effect. */
  _updatePhase4(dt) {
    const t = Math.min(this._phaseTimer / PHASE_DURATIONS[4], 1);
    this._princessAlpha = easeInOutCubic(t);
    this._princessShimmerTimer += dt;

    // Play shimmer SFX at start
    if (this._phaseTimer < dt * 2 && this._audioManager) {
      this._audioManager.playSFX('trailShimmer');
    }
  }

  /** Phase 5: Narrator welcome lines. */
  _updatePhase5(dt) {
    if (this._narratorDone) return;

    this._narratorWaitTimer += dt;

    // Play voice lines sequentially with pauses
    if (this._narratorLineIndex === 0 && this._narratorWaitTimer > 0.5) {
      this._playNarratorLine(0);
      this._narratorLineIndex = 1;
      this._narratorWaitTimer = 0;
    } else if (this._narratorLineIndex === 1 && this._narratorWaitTimer > 4) {
      this._playNarratorLine(1);
      this._narratorLineIndex = 2;
      this._narratorWaitTimer = 0;
    } else if (this._narratorLineIndex === 2 && this._narratorWaitTimer > 4) {
      this._narratorDone = true;
    }
  }

  /** Phase 6: Large pulsing sparkle — tap to begin. */
  _updatePhase6(dt) {
    if (!this._sparkleActive && !this._sparkleTapped) {
      this._sparkleActive = true;
      this._sparkleTimer = 0;
      this._sparkleDingTimer = 0;

      // Play "Tap the sparkle" voice (narrator guides with voice, not text)
      this._playNarratorLine(2);
    }

    if (this._sparkleActive) {
      this._sparkleTimer += dt;
      this._sparkleDingTimer = (this._sparkleDingTimer || 0) + dt;

      // Gentle repeating ding to draw attention to the sparkle
      if (this._sparkleDingTimer >= SPARKLE_DING_INTERVAL) {
        this._sparkleDingTimer = 0;
        if (this._audioManager) {
          this._audioManager.playSFX('crystalTone');
        }
      }

      // Check for tap on sparkle (generous touch target)
      if (this._inputManager && this._inputManager.tapped) {
        const tx = this._inputManager.x;
        const ty = this._inputManager.y;
        const cx = LOGICAL_WIDTH / 2;
        const bobY = Math.sin(this._sparkleTimer * SPARKLE_BOB_SPEED) * SPARKLE_BOB_AMOUNT;
        const cy = LOGICAL_HEIGHT / 2 + bobY;
        const dist = Math.hypot(tx - cx, ty - cy);

        if (dist < SPARKLE_SIZE) {
          this._onSparkleTapped();
        }
      }
    }

    // Burst animation after tap
    if (this._burstActive) {
      this._burstTimer += dt;
      if (this._burstTimer > 1.5) {
        // Fade to white, then transition to CompanionSelect
        this._transition.start('white', {
          duration: 600,
          onHalf: () => {
            if (this._sceneManager) {
              this._sceneManager.switchTo('CompanionSelect');
            }
          },
        });
      }
    }
  }

  // ---- Continue adventure flow (returning player) ---------------------------

  _updateContinueFlow(dt) {
    this._continueTimer += dt;

    // Play "Welcome back!" narrator voice once, shortly after the scene starts
    if (!this._continueWelcomePlayed && this._continueTimer >= 0.5) {
      this._continueWelcomePlayed = true;
      playVoice('narrator_title_return_01');
    }

    // Quick 3-second intro: sky with rainbow already formed, village visible
    if (this._continueTimer >= CONTINUE_DURATION && !this._transition.active) {
      this._transition.start('fade', {
        duration: 800,
        onHalf: () => {
          if (this._sceneManager) {
            this._sceneManager.switchTo('Overworld');
          }
        },
      });
    }
  }

  // ---- Draw -----------------------------------------------------------------

  /**
   * @param {import('../engine/Renderer.js').default} renderer
   */
  draw(renderer) {
    const ctx = renderer.ctx;

    if (this._isContinue) {
      this._drawContinueFlow(renderer);
    } else {
      this._drawCinematic(renderer);
    }

    // Transition overlay always on top
    this._transition.draw(renderer);
  }

  _drawCinematic(renderer) {
    const ctx = renderer.ctx;

    // ---- Phase 0+: Pink background ------------------------------------------
    renderer.fillBackground(PINK);

    // ---- Phase 1+: Sky gradient ---------------------------------------------
    if (this._phase >= 1) {
      const skyAlpha = this._phase === 1
        ? Math.min(this._phaseTimer / 2, 1) // fade in over 2s
        : 1;

      ctx.save();
      ctx.globalAlpha = skyAlpha;

      const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
      grad.addColorStop(0, SKY_TOP);
      grad.addColorStop(0.6, SKY_BOTTOM);
      grad.addColorStop(1, VILLAGE_GROUND);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // Stars (magic sparkle stars)
      this._drawStars(ctx);

      // Clouds
      this._drawClouds(ctx);

      ctx.restore();
    }

    // ---- Phase 2+: Rainbow --------------------------------------------------
    if (this._phase >= 2) {
      this._drawRainbow(ctx);
    }

    // ---- Phase 3+: Village (camera pan) -------------------------------------
    if (this._phase >= 3) {
      this._drawVillage(ctx);
    }

    // ---- Phase 4+: Princess -------------------------------------------------
    if (this._phase >= 4) {
      this._drawPrincess(ctx);
    }

    // ---- Phase 0: Center sparkle pulse (before sky) -------------------------
    if (this._phase === 0) {
      this._drawCenterSparkle(ctx, this._phaseTimer);
    }

    // ---- Phase 5: Narrator dialogue box (visual) ----------------------------
    if (this._phase === 5) {
      this._drawNarratorBox(ctx);
    }

    // ---- Phase 6: Large pulsing sparkle prompt ------------------------------
    if (this._phase === 6 && this._sparkleActive && !this._sparkleTapped) {
      this._drawLargeSparkle(ctx);
    }

    // ---- Burst particles ----------------------------------------------------
    if (this._burstActive) {
      this._drawParticles(ctx);
    }
  }

  _drawContinueFlow(renderer) {
    const ctx = renderer.ctx;
    const t = Math.min(this._continueTimer / CONTINUE_DURATION, 1);

    // Sky with rainbow already formed
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(0.6, SKY_BOTTOM);
    grad.addColorStop(1, VILLAGE_GROUND);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Full rainbow
    for (let i = 0; i < RAINBOW.length; i++) {
      this._rainbowProgress[i] = 1;
    }
    this._drawRainbow(ctx);

    // Clouds
    this._drawClouds(ctx);

    // Village (already visible)
    ctx.save();
    ctx.globalAlpha = easeInOutCubic(t);
    this._drawVillageShapes(ctx, 0);
    ctx.restore();
  }

  // ---- Draw helpers ---------------------------------------------------------

  _drawCenterSparkle(ctx, timer) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const cy = (LOGICAL_HEIGHT / 2) | 0;
    const pulse = Math.sin(timer * Math.PI * 2 / 1.5) * 0.5 + 0.5; // 0..1
    const size = 4 + pulse * 4;

    ctx.save();
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    // 4-point star
    this._starPath(ctx, cx, cy, size, size * 0.35, 4);
    ctx.fill();
    ctx.restore();
  }

  _drawStars(ctx) {
    const t = this._totalTimer;
    for (let i = 0; i < this._stars.length; i++) {
      const s = this._stars[i];
      const twinkle = Math.sin(t * 2 + s.phase) * 0.5 + 0.5;
      ctx.globalAlpha = 0.3 + twinkle * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  _drawClouds(ctx) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < this._clouds.length; i++) {
      const c = this._clouds[i];
      // Simple cloud: 2-3 overlapping ellipses
      const cx = c.x | 0;
      const cy = c.y | 0;
      ctx.beginPath();
      ctx.ellipse(cx, cy, (c.w / 2) | 0, (c.h / 2) | 0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse((cx - c.w * 0.25) | 0, (cy + 2) | 0, (c.w * 0.35) | 0, (c.h * 0.4) | 0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse((cx + c.w * 0.25) | 0, (cy + 1) | 0, (c.w * 0.3) | 0, (c.h * 0.45) | 0, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawRainbow(ctx) {
    const bandWidth = 4;
    const startX = -20;
    const endX = LOGICAL_WIDTH + 20;
    const arcCenterY = -40;
    const arcRadius = 200;

    ctx.save();
    for (let i = 0; i < RAINBOW.length; i++) {
      const progress = this._rainbowProgress[i];
      if (progress <= 0) continue;

      ctx.strokeStyle = RAINBOW[i];
      ctx.lineWidth = bandWidth;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      // Arc from left to right
      const startAngle = Math.PI;
      const endAngle = Math.PI + Math.PI * progress;
      ctx.arc(
        (LOGICAL_WIDTH / 2) | 0,
        arcCenterY + i * (bandWidth + 1),
        arcRadius - i * (bandWidth + 1),
        startAngle,
        endAngle
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawVillage(ctx) {
    const panProgress = this._phase === 3
      ? Math.min(this._phaseTimer / PHASE_DURATIONS[3], 1)
      : 1;
    const offsetY = -this._cameraPanY;

    ctx.save();
    ctx.translate(0, (offsetY) | 0);
    this._drawVillageShapes(ctx, panProgress);
    ctx.restore();
  }

  /** Draws placeholder village shapes (real tiles loaded from TileMap later). */
  _drawVillageShapes(ctx, revealProgress) {
    const baseY = LOGICAL_HEIGHT * 0.6;

    ctx.save();
    ctx.globalAlpha = Math.min(revealProgress * 1.5, 1);

    // Ground
    ctx.fillStyle = '#a8d8a0';
    ctx.fillRect(0, baseY | 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Path
    ctx.fillStyle = '#d4b896';
    ctx.fillRect(200, baseY | 0, 80, LOGICAL_HEIGHT - baseY);

    // Houses (simple colored rectangles with roofs)
    const houses = [
      { x: 60, w: 50, h: 36, roof: '#ff9999', wall: '#fff5ee' },
      { x: 140, w: 44, h: 32, roof: '#99ccff', wall: '#fff8f0' },
      { x: 310, w: 48, h: 38, roof: '#ffcc99', wall: '#fdf5e6' },
      { x: 390, w: 42, h: 30, roof: '#cc99ff', wall: '#faf0ff' },
    ];

    for (let i = 0; i < houses.length; i++) {
      const h = houses[i];
      const hy = (baseY - h.h + 10) | 0;
      // Wall
      ctx.fillStyle = h.wall;
      ctx.fillRect(h.x | 0, hy, h.w, h.h);
      // Roof (triangle)
      ctx.fillStyle = h.roof;
      ctx.beginPath();
      ctx.moveTo(h.x - 4, hy);
      ctx.lineTo((h.x + h.w / 2) | 0, (hy - 16) | 0);
      ctx.lineTo(h.x + h.w + 4, hy);
      ctx.closePath();
      ctx.fill();
    }

    // Trees
    ctx.fillStyle = '#5a8a3c';
    const treePositions = [30, 120, 290, 430, 460];
    for (let i = 0; i < treePositions.length; i++) {
      const tx = treePositions[i];
      const ty = (baseY - 10) | 0;
      // Trunk
      ctx.fillStyle = '#8B6914';
      ctx.fillRect((tx + 4) | 0, ty, 4, 12);
      // Canopy
      ctx.fillStyle = '#5a8a3c';
      ctx.beginPath();
      ctx.arc((tx + 6) | 0, (ty - 4) | 0, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flowers (small colored dots)
    ctx.fillStyle = '#ff69b4';
    const flowerX = [80, 160, 350, 410, 250];
    for (let i = 0; i < flowerX.length; i++) {
      ctx.fillRect(flowerX[i] | 0, (baseY + 4) | 0, 3, 3);
    }

    // Broken Rainbow Bridge (grey arch at far edge)
    ctx.strokeStyle = 'rgba(150,150,150,0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(LOGICAL_WIDTH - 30, baseY | 0, 40, Math.PI, 0);
    ctx.stroke();

    ctx.restore();
  }

  _drawPrincess(ctx) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const cy = (LOGICAL_HEIGHT * 0.55) | 0;

    ctx.save();
    ctx.globalAlpha = this._princessAlpha;

    // Shimmer effect — sparkles around princess
    if (this._princessShimmerTimer > 0) {
      const shimmerCount = 6;
      for (let i = 0; i < shimmerCount; i++) {
        const angle = (i / shimmerCount) * Math.PI * 2 + this._princessShimmerTimer * 2;
        const radius = 14 + Math.sin(this._princessShimmerTimer * 3 + i) * 4;
        const sx = cx + (Math.cos(angle) * radius) | 0;
        const sy = cy + (Math.sin(angle) * radius) | 0;
        const sparkleAlpha = 0.4 + Math.sin(this._princessShimmerTimer * 4 + i * 2) * 0.3;
        ctx.globalAlpha = this._princessAlpha * sparkleAlpha;
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
      ctx.globalAlpha = this._princessAlpha;
    }

    // Princess placeholder (16x16 sprite, drawn at 2x)
    // In production, replaced with actual sprite from AssetLoader
    const spriteSize = 32;
    const px = (cx - spriteSize / 2) | 0;
    const py = (cy - spriteSize / 2) | 0;

    // Body (placeholder)
    ctx.fillStyle = '#ffe0ec';
    ctx.fillRect(px + 8, py + 10, 16, 18);
    // Dress
    ctx.fillStyle = '#ff99cc';
    ctx.fillRect(px + 6, py + 18, 20, 12);
    // Head
    ctx.fillStyle = '#ffdab9';
    ctx.fillRect(px + 10, py + 2, 12, 12);
    // Crown
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(px + 11, py, 10, 4);
    ctx.fillRect(px + 13, py - 2, 2, 3);
    ctx.fillRect(px + 17, py - 2, 2, 3);
    // Eyes
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(px + 12, py + 6, 2, 2);
    ctx.fillRect(px + 18, py + 6, 2, 2);

    ctx.restore();
  }

  _drawNarratorBox(ctx) {
    // Soft rounded box at bottom — visual indicator that narrator is speaking
    const boxW = LOGICAL_WIDTH - 32;
    const boxH = 48;
    const boxX = 16;
    const boxY = LOGICAL_HEIGHT - boxH - 12;

    const fadeIn = Math.min(this._phaseTimer / 0.8, 1);
    ctx.save();
    ctx.globalAlpha = easeInOutCubic(fadeIn) * 0.9;

    // Background
    ctx.fillStyle = 'rgba(255, 245, 250, 0.9)';
    ctx.beginPath();
    this._roundRect(ctx, boxX, boxY, boxW, boxH, 8);
    ctx.fill();

    // Narrator icon (sparkle/book) on left
    ctx.fillStyle = '#ffd700';
    this._starPath(ctx, boxX + 20, boxY + boxH / 2, 8, 3, 4);
    ctx.fill();

    // Pulsing glow to show voice is playing
    const pulse = Math.sin(this._phaseTimer * Math.PI * 2 / 1.2) * 0.5 + 0.5;
    ctx.globalAlpha = 0.2 + pulse * 0.2;
    ctx.fillStyle = 'rgba(255, 200, 230, 0.5)';
    ctx.beginPath();
    this._roundRect(ctx, boxX + 2, boxY + 2, boxW - 4, boxH - 4, 6);
    ctx.fill();

    ctx.restore();
  }

  _drawLargeSparkle(ctx) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const bobY = Math.sin(this._sparkleTimer * SPARKLE_BOB_SPEED) * SPARKLE_BOB_AMOUNT;
    const cy = ((LOGICAL_HEIGHT / 2) + bobY) | 0;
    const pulse = Math.sin(this._sparkleTimer * Math.PI * 2 / SPARKLE_PULSE_CYCLE) * 0.5 + 0.5;
    const scale = SPARKLE_MIN_SCALE + (SPARKLE_MAX_SCALE - SPARKLE_MIN_SCALE) * pulse;
    const size = SPARKLE_VISUAL_SIZE * scale;

    ctx.save();

    // Golden glow ring that expands and contracts
    const ringScale = SPARKLE_GLOW_RING_MIN + (SPARKLE_GLOW_RING_MAX - SPARKLE_GLOW_RING_MIN) * pulse;
    ctx.globalAlpha = 0.15 + (1 - pulse) * 0.15;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, size * ringScale * 1.4, 0, Math.PI * 2);
    ctx.stroke();

    // Second, wider glow ring (offset timing)
    const pulse2 = Math.sin(this._sparkleTimer * Math.PI * 2 / SPARKLE_PULSE_CYCLE + Math.PI * 0.6) * 0.5 + 0.5;
    ctx.globalAlpha = 0.08 + (1 - pulse2) * 0.1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size * ringScale * 1.8, 0, Math.PI * 2);
    ctx.stroke();

    // Soft radial glow behind everything
    ctx.globalAlpha = 0.25 + pulse * 0.15;
    ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Particle halo — orbiting sparkle motes
    for (let i = 0; i < SPARKLE_HALO_COUNT; i++) {
      const angle = (i / SPARKLE_HALO_COUNT) * Math.PI * 2 + this._sparkleTimer * 1.2;
      const haloR = size * 1.3 + Math.sin(this._sparkleTimer * 2.5 + i * 1.7) * 4;
      const hx = (cx + Math.cos(angle) * haloR) | 0;
      const hy = (cy + Math.sin(angle) * haloR) | 0;
      const moteAlpha = 0.4 + Math.sin(this._sparkleTimer * 3 + i * 2.3) * 0.3;
      ctx.globalAlpha = moteAlpha;
      ctx.fillStyle = (i % 2 === 0) ? '#ffd700' : '#fffacd';
      ctx.fillRect(hx - 1, hy - 1, 3, 3);
    }

    // Main star shape (large and prominent)
    ctx.globalAlpha = 0.85 + pulse * 0.15;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    this._starPath(ctx, cx, cy, size, size * 0.35, 4);
    ctx.fill();

    // Inner bright core
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fffacd';
    ctx.beginPath();
    ctx.arc(cx, cy, (size * 0.35) | 0, 0, Math.PI * 2);
    ctx.fill();

    // White hot center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, (size * 0.15) | 0 || 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ---- Particle system ------------------------------------------------------

  _updateParticles(dt) {
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 20 * dt; // gentle gravity
    }
  }

  _drawParticles(ctx) {
    ctx.save();
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (!p.active) continue;
      const lifeRatio = p.life / p.maxLife;
      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = p.color;
      ctx.fillRect((p.x - p.size / 2) | 0, (p.y - p.size / 2) | 0, p.size, p.size);
    }
    ctx.restore();
  }

  _emitBurst(cx, cy) {
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (p.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 30;
      p.life = 1.0 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.color = RAINBOW[(Math.random() * RAINBOW.length) | 0];
      p.size = 2 + ((Math.random() * 3) | 0);
    }
  }

  // ---- Cloud animation ------------------------------------------------------

  _updateClouds(dt) {
    for (let i = 0; i < this._clouds.length; i++) {
      const c = this._clouds[i];
      c.x -= c.speed * dt * 30; // speed is per-frame at 30fps, convert to per-second
      if (c.x + c.w < -10) {
        c.x = LOGICAL_WIDTH + 20 + Math.random() * 40;
        c.y = 20 + Math.random() * 60;
      }
    }
  }

  // ---- Event handlers -------------------------------------------------------

  _onSparkleTapped() {
    this._sparkleTapped = true;
    this._sparkleActive = false;
    this._burstActive = true;
    this._burstTimer = 0;

    // Emit rainbow burst
    this._emitBurst(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

    // Play pop-chime SFX
    if (this._audioManager) {
      this._audioManager.playSFX('crystalTone');
    }
  }

  _advancePhase() {
    this._phase++;
    this._phaseTimer = 0;

    // Phase-specific triggers
    if (this._phase === 1 && this._audioManager) {
      this._audioManager.playSFX('treeRustle');
    }
  }

  _playNarratorLine(index) {
    if (index < this._narratorLines.length) {
      playVoice(this._narratorLines[index]);
    }
  }

  _hasSaveData() {
    if (this._saveManager) {
      return this._saveManager.hasSave();
    }
    // Fallback: check localStorage directly
    try {
      return localStorage.getItem('sparkle-save') !== null;
    } catch (e) {
      return false;
    }
  }

  // ---- Geometry helpers -----------------------------------------------------

  _starPath(ctx, cx, cy, outerR, innerR, points) {
    const step = Math.PI / points;
    let angle = -Math.PI / 2;
    ctx.moveTo((cx + Math.cos(angle) * outerR) | 0, (cy + Math.sin(angle) * outerR) | 0);
    for (let i = 0; i < points * 2; i++) {
      angle += step;
      const r = (i % 2 === 0) ? innerR : outerR;
      ctx.lineTo((cx + Math.cos(angle) * r) | 0, (cy + Math.sin(angle) * r) | 0);
    }
    ctx.closePath();
  }

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
