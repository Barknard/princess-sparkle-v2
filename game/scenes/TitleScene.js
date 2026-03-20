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
 *   6: "Tap the sparkle" prompt — large 80px pulsing sparkle (42s+)
 *
 * Continue-Adventure flow is a compressed 3s version.
 *
 * All rendering is canvas-only. No DOM.
 * Integer coordinates. Pre-allocated particle arrays.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import TransitionOverlay from '../ui/TransitionOverlay.js';
import { playVoice, preloadVoices, SCENE_VOICES } from '../data/voiceIndex.js';
import spriteSheets from '../data/SpriteSheetManager.js';

// ---- Easing -----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- Constants --------------------------------------------------------------

// Phase durations in seconds
const PHASE_DURATIONS = [3, 7, 10, 8, 5, 9, 5]; // phase 6 auto-advances after 5s (tap speeds it up)
const CONTINUE_DURATION = 3; // compressed returning-player intro

// Colors
const PINK = '#ffe0ec';
const SKY_TOP = '#aaddff';
const SKY_LAVENDER = '#c8b8e8';
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

// Particle pool for sparkle burst + rainbow trail sparkles
const MAX_PARTICLES = 80;

// Cloud pool — fluffy, prominent, varying sizes
const MAX_CLOUDS = 10;
const CLOUD_SPEED = 0.3; // base px per frame at 30fps

// Star twinkle pool (magic sparkle stars)
const MAX_STARS = 12;

// Rainbow trail sparkle pool (separate from burst particles)
const MAX_RAINBOW_SPARKLES = 24;

// ---- Cloud definition: each cloud is a cluster of 3-5 overlapping circles ---

/**
 * Cloud sizes:  small 20-30px, medium 40-60px, large 60-90px
 * Each cloud has puffs (circle clusters) for a fluffy look.
 */
function _generateCloudPuffs(size) {
  // size is the overall width of the cloud
  const puffs = [];
  const count = size < 35 ? 3 : size < 55 ? 4 : 5;
  const halfW = size / 2;
  const baseR = size * 0.25;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1); // 0..1
    const px = -halfW + t * size;
    // arc shape: center puffs higher, edges lower
    const arcH = Math.sin(t * Math.PI) * (size * 0.18);
    const py = -arcH;
    // radius: center puffs bigger, edge puffs smaller
    const rVariance = 0.7 + Math.sin(t * Math.PI) * 0.5;
    const r = baseR * rVariance * (0.85 + Math.random() * 0.3);
    puffs.push({ ox: px, oy: py, r: Math.max(r, 6) });
  }
  return puffs;
}

function createCloudPool(count) {
  const pool = new Array(count);
  // Distribute sizes: 3 small, 4 medium, 3 large
  const sizes = [];
  for (let i = 0; i < count; i++) {
    if (i < 3) sizes.push(20 + Math.random() * 10);       // small 20-30
    else if (i < 7) sizes.push(40 + Math.random() * 20);   // medium 40-60
    else sizes.push(60 + Math.random() * 30);               // large 60-90
  }
  // Shuffle sizes
  for (let i = sizes.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = sizes[i]; sizes[i] = sizes[j]; sizes[j] = tmp;
  }

  for (let i = 0; i < count; i++) {
    const w = sizes[i];
    pool[i] = {
      x: Math.random() * (LOGICAL_WIDTH + 100) - 50,
      y: 15 + Math.random() * 80, // varied vertical positions
      w: w,
      speed: CLOUD_SPEED * (0.4 + Math.random() * 0.8), // parallax: different speeds
      puffs: _generateCloudPuffs(w),
      alpha: 0.75 + Math.random() * 0.2, // slight alpha variation
    };
  }
  return pool;
}

// ---- Particle (pre-allocated) -----------------------------------------------

function createParticlePool(size) {
  const pool = new Array(size);
  for (let i = 0; i < size; i++) {
    pool[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 2 };
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

// Rainbow trail sparkle pool
function createRainbowSparklePool(size) {
  const pool = new Array(size);
  for (let i = 0; i < size; i++) {
    pool[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 2 };
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
    this._rainbowSparkles = createRainbowSparklePool(MAX_RAINBOW_SPARKLES);

    // Rainbow build progress (0..1 per band)
    this._rainbowProgress = new Float32Array(RAINBOW.length);
    // Track which chimes have played
    this._rainbowChimePlayed = new Uint8Array(RAINBOW.length);

    // Camera pan offset for phase 3 (village reveal)
    // The "world" is taller than the screen — sky on top, village below.
    // We render a world that is ~2x screen height: sky fills top half, village fills bottom.
    // Camera starts looking at sky, pans down to village.
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

    // Rainbow glow timer (gentle pulse after fully drawn)
    this._rainbowGlowTimer = 0;
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
    // Pan target: scroll down by 75% of logical height to reveal village below sky
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
    this._rainbowGlowTimer = 0;

    // Reset rainbow
    for (let i = 0; i < this._rainbowProgress.length; i++) {
      this._rainbowProgress[i] = 0;
    }
    for (let i = 0; i < this._rainbowChimePlayed.length; i++) {
      this._rainbowChimePlayed[i] = 0;
    }

    // Reset particles
    for (let i = 0; i < this._particles.length; i++) {
      this._particles[i].active = false;
    }
    for (let i = 0; i < this._rainbowSparkles.length; i++) {
      this._rainbowSparkles[i].active = false;
    }

    // Regenerate clouds for variety each time
    this._clouds = createCloudPool(MAX_CLOUDS);

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

    // Auto-advance all phases (including phase 6 — toddler doesn't need to tap)
    if (this._phaseTimer >= PHASE_DURATIONS[this._phase]) {
      if (this._phase === 6) {
        // Phase 6 auto-advance: treat as if sparkle was tapped
        if (!this._sparkleTapped && !this._burstActive) {
          this._onSparkleTapped();
        }
      } else {
        this._advancePhase();
      }
    }

    // Update particles
    this._updateParticles(dt);
    this._updateRainbowSparkles(dt);

    // Update clouds (phases 1+)
    if (this._phase >= 1) {
      this._updateClouds(dt);
    }

    // Update rainbow glow timer (after rainbow is fully drawn)
    if (this._phase >= 3) {
      this._rainbowGlowTimer += dt;
    }
  }

  // ---- Phase updates --------------------------------------------------------

  /** Phase 0: Soft pink screen, single warm-gold sparkle pulses. */
  _updatePhase0(dt) {
    // Sparkle pulse is handled in draw via timer
  }

  /** Phase 1: Sky fades in with drifting clouds. */
  _updatePhase1(dt) {
    // Clouds handled in _updateClouds
  }

  /** Phase 2: Rainbow builds one color at a time with sparkle trail. */
  _updatePhase2(dt) {
    const bandDuration = PHASE_DURATIONS[2] / RAINBOW.length; // ~1.67s each
    for (let i = 0; i < RAINBOW.length; i++) {
      const bandStart = i * bandDuration;
      const localT = this._phaseTimer - bandStart;
      if (localT > 0) {
        const prevProgress = this._rainbowProgress[i];
        this._rainbowProgress[i] = Math.min(localT / bandDuration, 1);

        // Play chime when band starts (only once)
        if (!this._rainbowChimePlayed[i] && this._audioManager) {
          this._rainbowChimePlayed[i] = 1;
          this._audioManager.playSFX(RAINBOW_CHIMES[i]);
        }

        // Emit sparkle trail particles at the leading edge of the arc
        if (this._rainbowProgress[i] < 1 && this._rainbowProgress[i] > prevProgress) {
          this._emitRainbowTrailSparkle(i, this._rainbowProgress[i]);
        }
      }
    }
  }

  /** Phase 3: Camera pans down revealing village — smooth ease-in-out over 8s. */
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

      // Tap ANYWHERE to advance (toddler-friendly — no precision needed)
      if (this._inputManager && this._inputManager.tapped) {
        this._onSparkleTapped();
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

    // ---- Phase 1+: Sky gradient + clouds + stars ----------------------------
    if (this._phase >= 1) {
      const skyAlpha = this._phase === 1
        ? Math.min(this._phaseTimer / 2, 1) // fade in over 2s
        : 1;

      ctx.save();
      ctx.globalAlpha = skyAlpha;

      // Extended sky gradient: light blue -> lavender -> pink -> soft green
      const grad = ctx.createLinearGradient(0, -this._cameraPanY, 0, LOGICAL_HEIGHT * 2 - this._cameraPanY);
      grad.addColorStop(0, SKY_TOP);          // light blue at very top
      grad.addColorStop(0.25, SKY_LAVENDER);  // lavender through middle
      grad.addColorStop(0.4, SKY_BOTTOM);     // pink at horizon area
      grad.addColorStop(0.5, '#d4e8c2');      // transition to green
      grad.addColorStop(0.55, VILLAGE_GROUND); // soft green ground
      grad.addColorStop(1, '#8bc37a');         // slightly deeper green at bottom
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // Stars (magic sparkle stars) — only visible in upper sky
      this._drawStars(ctx);

      // Clouds — fluffy and prominent
      this._drawClouds(ctx);

      ctx.restore();
    }

    // ---- Phase 2+: Rainbow --------------------------------------------------
    if (this._phase >= 2) {
      this._drawRainbow(ctx);
      this._drawRainbowSparkles(ctx);
    }

    // ---- Phase 3+: Village (camera pan) -------------------------------------
    if (this._phase >= 3) {
      this._drawVillage(ctx);
    }

    // ---- Phase 4+: Princess -------------------------------------------------
    if (this._phase >= 4) {
      this._drawPrincess(ctx);
    }

    // ---- Phase 0: Center sparkle pulse (warm gold, before sky) --------------
    if (this._phase === 0) {
      this._drawCenterSparkle(ctx, this._phaseTimer);
    }

    // ---- Phase 5: Narrator dialogue box (visual) ----------------------------
    if (this._phase === 5) {
      this._drawNarratorBox(ctx);
    }

    // ---- Burst particles ----------------------------------------------------
    if (this._burstActive) {
      this._drawParticles(ctx);
    }

    // ---- Phase 6: Large pulsing sparkle prompt (drawn LAST so it's on top) --
    if (this._phase === 6 && this._sparkleActive && !this._sparkleTapped) {
      this._drawLargeSparkle(ctx);
    }
  }

  _drawContinueFlow(renderer) {
    const ctx = renderer.ctx;
    const t = Math.min(this._continueTimer / CONTINUE_DURATION, 1);

    // Sky with rainbow already formed
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, SKY_TOP);
    grad.addColorStop(0.3, SKY_LAVENDER);
    grad.addColorStop(0.5, SKY_BOTTOM);
    grad.addColorStop(0.7, VILLAGE_GROUND);
    grad.addColorStop(1, '#8bc37a');
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

  /** Phase 0 sparkle: warm gold pulsing star, not white. */
  _drawCenterSparkle(ctx, timer) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const cy = (LOGICAL_HEIGHT / 2) | 0;
    const pulse = Math.sin(timer * Math.PI * 2 / 1.5) * 0.5 + 0.5; // 0..1
    const size = 5 + pulse * 5;

    ctx.save();

    // Soft warm glow behind the sparkle
    ctx.globalAlpha = 0.15 + pulse * 0.15;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 3, 0, Math.PI * 2);
    ctx.fill();

    // Main warm gold sparkle
    ctx.globalAlpha = 0.7 + pulse * 0.3;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    this._starPath(ctx, cx, cy, size, size * 0.35, 4);
    ctx.fill();

    // Bright core
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(cx, cy, (size * 0.3) | 0 || 1, 0, Math.PI * 2);
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

  /**
   * Draw fluffy clouds as clusters of overlapping white/light-grey circles.
   * Each cloud has 3-5 puffs of varying size for a puffy, prominent look.
   * Visible against both pink and blue sky backgrounds.
   */
  _drawClouds(ctx) {
    ctx.save();
    for (let i = 0; i < this._clouds.length; i++) {
      const c = this._clouds[i];
      const cx = c.x | 0;
      const cy = c.y | 0;

      // Soft shadow underneath (light grey, offset down)
      ctx.globalAlpha = c.alpha * 0.25;
      ctx.fillStyle = '#c0c8d8';
      for (let j = 0; j < c.puffs.length; j++) {
        const p = c.puffs[j];
        ctx.beginPath();
        ctx.arc((cx + p.ox) | 0, (cy + p.oy + 3) | 0, (p.r * 0.9) | 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main cloud body — white with high opacity
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = c.alpha;
      for (let j = 0; j < c.puffs.length; j++) {
        const p = c.puffs[j];
        ctx.beginPath();
        ctx.arc((cx + p.ox) | 0, (cy + p.oy) | 0, p.r | 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Highlight on top puffs (slightly brighter white, smaller)
      ctx.globalAlpha = c.alpha * 0.5;
      ctx.fillStyle = '#f8fcff';
      for (let j = 0; j < c.puffs.length; j++) {
        const p = c.puffs[j];
        ctx.beginPath();
        ctx.arc((cx + p.ox) | 0, (cy + p.oy - 2) | 0, (p.r * 0.55) | 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Draw the rainbow as a prominent arc spanning 80%+ of screen width.
   * Each band is 3-4px thick. Proper curved arc using canvas arc.
   * After fully drawn, the rainbow glows gently.
   */
  _drawRainbow(ctx) {
    const bandWidth = 4;
    const bandGap = 1;               // tiny gap between bands for definition
    const totalBandStep = bandWidth + bandGap;
    const arcCenterX = (LOGICAL_WIDTH / 2) | 0;
    // Place arc center high enough that the full arc is visible in the upper sky
    // Arc center below the screen so the arc curves UP into the visible viewport
    const arcCenterY = (LOGICAL_HEIGHT * 0.85) | 0;
    // Smaller radius so the full arch fits on screen (peak in upper third of sky)
    const outerRadius = (LOGICAL_WIDTH * 0.48) | 0;

    ctx.save();

    // If rainbow is fully drawn and we're past phase 2, add a gentle glow
    const allDone = this._phase >= 3;
    if (allDone && this._rainbowGlowTimer > 0) {
      const glowPulse = Math.sin(this._rainbowGlowTimer * 1.5) * 0.5 + 0.5;
      const glowAlpha = 0.06 + glowPulse * 0.08;
      // Draw a wide, soft glow behind the rainbow
      for (let i = 0; i < RAINBOW.length; i++) {
        const r = outerRadius - i * totalBandStep;
        ctx.strokeStyle = RAINBOW[i];
        ctx.lineWidth = bandWidth + 6;
        ctx.globalAlpha = glowAlpha;
        ctx.beginPath();
        ctx.arc(arcCenterX, arcCenterY, r, Math.PI, 0);
        ctx.stroke();
      }
    }

    // Draw each color band
    for (let i = 0; i < RAINBOW.length; i++) {
      const progress = this._rainbowProgress[i];
      if (progress <= 0) continue;

      const r = outerRadius - i * totalBandStep;
      ctx.strokeStyle = RAINBOW[i];
      ctx.lineWidth = bandWidth;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      // Arc sweeps from left (PI) to right (0), progress controls how far
      const startAngle = Math.PI;
      const endAngle = Math.PI - Math.PI * progress; // sweeps left to right
      ctx.arc(arcCenterX, arcCenterY, r, startAngle, endAngle, true);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Emit a sparkle particle at the leading edge of a rainbow band.
   */
  _emitRainbowTrailSparkle(bandIndex, progress) {
    // Find an inactive sparkle
    let sparkle = null;
    for (let i = 0; i < this._rainbowSparkles.length; i++) {
      if (!this._rainbowSparkles[i].active) {
        sparkle = this._rainbowSparkles[i];
        break;
      }
    }
    if (!sparkle) return;

    const bandWidth = 4;
    const bandGap = 1;
    const totalBandStep = bandWidth + bandGap;
    const arcCenterX = (LOGICAL_WIDTH / 2) | 0;
    const arcCenterY = (LOGICAL_HEIGHT * 0.85) | 0;
    const outerRadius = (LOGICAL_WIDTH * 0.48) | 0;
    const r = outerRadius - bandIndex * totalBandStep;

    // Position at the leading edge of the arc
    const angle = Math.PI - Math.PI * progress;
    const sx = arcCenterX + Math.cos(angle) * r;
    const sy = arcCenterY + Math.sin(angle) * r;

    sparkle.active = true;
    sparkle.x = sx;
    sparkle.y = sy;
    sparkle.vx = (Math.random() - 0.5) * 20;
    sparkle.vy = -10 - Math.random() * 15;
    sparkle.life = 0.6 + Math.random() * 0.4;
    sparkle.maxLife = sparkle.life;
    sparkle.color = RAINBOW[bandIndex];
    sparkle.size = 1 + ((Math.random() * 2) | 0);
  }

  _updateRainbowSparkles(dt) {
    for (let i = 0; i < this._rainbowSparkles.length; i++) {
      const p = this._rainbowSparkles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 15 * dt; // very gentle gravity
    }
  }

  _drawRainbowSparkles(ctx) {
    ctx.save();
    for (let i = 0; i < this._rainbowSparkles.length; i++) {
      const p = this._rainbowSparkles[i];
      if (!p.active) continue;
      const lifeRatio = p.life / p.maxLife;
      ctx.globalAlpha = lifeRatio * 0.8;
      ctx.fillStyle = p.color;
      // Draw as tiny 4-point star for sparkle effect
      const s = p.size;
      const px = p.x | 0;
      const py = p.y | 0;
      ctx.fillRect(px - s, py, s * 2 + 1, 1);
      ctx.fillRect(px, py - s, 1, s * 2 + 1);
    }
    ctx.restore();
  }

  /**
   * Draw village with camera pan.
   * During phase 3, the camera smoothly scrolls down from sky to village.
   * The entire scene is rendered as a tall world and we translate by cameraPanY.
   */
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
    // Village sits below the visible sky area.
    // baseY is where the ground starts in the extended world.
    const baseY = LOGICAL_HEIGHT + LOGICAL_HEIGHT * 0.15;

    ctx.save();
    ctx.globalAlpha = Math.min(revealProgress * 1.5, 1);

    // Ground — lush green grass
    ctx.fillStyle = VILLAGE_GROUND;
    ctx.fillRect(0, baseY | 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Subtle grass texture (slightly different green strips)
    ctx.fillStyle = '#9ed094';
    for (let gy = 0; gy < LOGICAL_HEIGHT; gy += 8) {
      if (gy % 16 === 0) {
        ctx.fillRect(0, (baseY + gy) | 0, LOGICAL_WIDTH, 2);
      }
    }

    // Dirt path — narrow winding trail through the village
    ctx.fillStyle = '#d4b896';
    const pathW = 28;
    const pathX = 226; // centered in the old 200-280 region
    ctx.fillRect(pathX, baseY | 0, pathW, LOGICAL_HEIGHT);
    // Slight curve with two offset segments for a winding feel
    ctx.fillRect((pathX - 8) | 0, (baseY + 20) | 0, pathW, 30);
    ctx.fillRect((pathX + 6) | 0, (baseY + 60) | 0, pathW, 30);
    // Path edge highlights
    ctx.fillStyle = '#c9a87c';
    ctx.fillRect((pathX - 1) | 0, baseY | 0, 2, LOGICAL_HEIGHT);
    ctx.fillRect((pathX + pathW - 1) | 0, baseY | 0, 2, LOGICAL_HEIGHT);
    // Pebble details
    ctx.fillStyle = '#c0a070';
    ctx.fillRect((pathX + 8) | 0, (baseY + 10) | 0, 3, 2);
    ctx.fillRect((pathX + 16) | 0, (baseY + 28) | 0, 2, 2);
    ctx.fillRect((pathX + 5) | 0, (baseY + 50) | 0, 3, 2);
    ctx.fillRect((pathX + 20) | 0, (baseY + 70) | 0, 2, 2);

    // Houses (simple colored rectangles with roofs)
    const houses = [
      { x: 50,  w: 52, h: 38, roof: '#ff9999', wall: '#fff5ee', door: '#8B6914' },
      { x: 130, w: 46, h: 34, roof: '#99ccff', wall: '#fff8f0', door: '#7a5a2e' },
      { x: 310, w: 50, h: 40, roof: '#ffcc99', wall: '#fdf5e6', door: '#8B6914' },
      { x: 400, w: 44, h: 32, roof: '#cc99ff', wall: '#faf0ff', door: '#6e4a8a' },
    ];

    for (let i = 0; i < houses.length; i++) {
      const h = houses[i];
      const hy = (baseY - h.h + 10) | 0;

      // Wall
      ctx.fillStyle = h.wall;
      ctx.fillRect(h.x | 0, hy, h.w, h.h);

      // Door
      ctx.fillStyle = h.door;
      const doorW = 8;
      const doorH = 14;
      ctx.fillRect((h.x + h.w / 2 - doorW / 2) | 0, (hy + h.h - doorH) | 0, doorW, doorH);

      // Window(s)
      ctx.fillStyle = '#add8e6';
      ctx.fillRect((h.x + 6) | 0, (hy + 8) | 0, 7, 6);
      if (h.w > 44) {
        ctx.fillRect((h.x + h.w - 13) | 0, (hy + 8) | 0, 7, 6);
      }

      // Roof (triangle)
      ctx.fillStyle = h.roof;
      ctx.beginPath();
      ctx.moveTo(h.x - 4, hy);
      ctx.lineTo((h.x + h.w / 2) | 0, (hy - 18) | 0);
      ctx.lineTo(h.x + h.w + 4, hy);
      ctx.closePath();
      ctx.fill();

      // Chimney on first house (with curling smoke)
      if (i === 0) {
        ctx.fillStyle = '#8B7355';
        ctx.fillRect((h.x + h.w - 12) | 0, (hy - 22) | 0, 6, 10);
        // Smoke wisps
        const smokeT = this._totalTimer;
        ctx.globalAlpha = Math.min(revealProgress * 1.5, 1) * 0.3;
        ctx.fillStyle = '#d0d0d0';
        for (let s = 0; s < 3; s++) {
          const sxOff = Math.sin(smokeT * 0.8 + s * 1.5) * 4;
          const sy = (hy - 24 - s * 7) | 0;
          const sr = 3 + s * 1.5;
          ctx.beginPath();
          ctx.arc((h.x + h.w - 9 + sxOff) | 0, sy, sr | 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = Math.min(revealProgress * 1.5, 1);
      }
    }

    // Trees — more detailed with trunk and layered canopy
    ctx.fillStyle = '#5a8a3c';
    const treePositions = [20, 110, 170, 285, 360, 440, 465];
    for (let i = 0; i < treePositions.length; i++) {
      const tx = treePositions[i];
      const ty = (baseY - 8) | 0;
      // Trunk
      ctx.fillStyle = '#8B6914';
      ctx.fillRect((tx + 3) | 0, ty, 5, 14);
      // Canopy layers for depth
      ctx.fillStyle = '#4a7a2c';
      ctx.beginPath();
      ctx.arc((tx + 5) | 0, (ty - 3) | 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a8a3c';
      ctx.beginPath();
      ctx.arc((tx + 6) | 0, (ty - 6) | 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6a9a4c';
      ctx.beginPath();
      ctx.arc((tx + 4) | 0, (ty - 5) | 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flowers (small colored dots with gentle sway)
    const flowerColors = ['#ff69b4', '#ff9ecb', '#ffdd57', '#ff7eb3', '#c8a2ff'];
    const flowerX = [75, 155, 250, 345, 420, 100, 380, 260];
    const swayT = this._totalTimer;
    for (let i = 0; i < flowerX.length; i++) {
      const sway = Math.sin(swayT * 1.2 + i * 2.1) * 1.5;
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.fillRect((flowerX[i] + sway) | 0, (baseY + 3 + Math.sin(i) * 2) | 0, 3, 3);
      // Stem
      ctx.fillStyle = '#5a8a3c';
      ctx.fillRect((flowerX[i] + 1 + sway) | 0, (baseY + 6 + Math.sin(i) * 2) | 0, 1, 4);
    }

    // Small pond
    ctx.fillStyle = '#87ceeb';
    ctx.globalAlpha = Math.min(revealProgress * 1.5, 1) * 0.7;
    ctx.beginPath();
    ctx.ellipse(260, (baseY + 30) | 0, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pond edge
    ctx.strokeStyle = '#6bb8d9';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = Math.min(revealProgress * 1.5, 1);

    // Broken Rainbow Bridge (grey arch at far edge — no color yet)
    ctx.strokeStyle = 'rgba(140,140,140,0.55)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(LOGICAL_WIDTH - 25, (baseY - 2) | 0, 44, Math.PI, 0);
    ctx.stroke();
    // Bridge posts
    ctx.fillStyle = 'rgba(140,140,140,0.5)';
    ctx.fillRect((LOGICAL_WIDTH - 70) | 0, (baseY - 4) | 0, 5, 20);
    ctx.fillRect((LOGICAL_WIDTH + 18) | 0, (baseY - 4) | 0, 5, 20);

    ctx.restore();
  }

  _drawPrincess(ctx) {
    // After camera pan, princess is in the village area
    const baseY = LOGICAL_HEIGHT + LOGICAL_HEIGHT * 0.15;
    const cx = (LOGICAL_WIDTH / 2) | 0;
    // Position princess relative to village, offset by camera pan
    const worldCy = (baseY - 20) | 0;
    const screenCy = worldCy - (this._cameraPanY | 0);

    ctx.save();
    ctx.globalAlpha = this._princessAlpha;

    // Shimmer effect — sparkles around princess
    if (this._princessShimmerTimer > 0) {
      const shimmerCount = 8;
      for (let i = 0; i < shimmerCount; i++) {
        const angle = (i / shimmerCount) * Math.PI * 2 + this._princessShimmerTimer * 2;
        const radius = 16 + Math.sin(this._princessShimmerTimer * 3 + i) * 5;
        const sx = cx + (Math.cos(angle) * radius) | 0;
        const sy = screenCy + (Math.sin(angle) * radius) | 0;
        const sparkleAlpha = 0.4 + Math.sin(this._princessShimmerTimer * 4 + i * 2) * 0.3;
        ctx.globalAlpha = this._princessAlpha * sparkleAlpha;
        ctx.fillStyle = '#ffd700';
        // Draw as tiny star shape for shimmer
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      }
      ctx.globalAlpha = this._princessAlpha;
    }

    // Princess sprite (16x16 from Kenney Tiny Dungeon, drawn at 2x)
    const spriteSize = 32;
    const px = (cx - spriteSize / 2) | 0;
    const py = (screenCy - spriteSize / 2) | 0;

    if (spriteSheets.loaded && spriteSheets.getSpriteRect('princess')) {
      // Draw real sprite at 2x scale
      spriteSheets.draw(ctx, 'princess', px, py, { scale: 2 });
    } else {
      // Fallback placeholder
      ctx.fillStyle = '#ffe0ec';
      ctx.fillRect(px + 8, py + 10, 16, 18);
      ctx.fillStyle = '#ff99cc';
      ctx.fillRect(px + 6, py + 18, 20, 12);
      ctx.fillStyle = '#ffdab9';
      ctx.fillRect(px + 10, py + 2, 12, 12);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(px + 11, py, 10, 4);
      ctx.fillRect(px + 13, py - 2, 2, 3);
      ctx.fillRect(px + 17, py - 2, 2, 3);
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(px + 12, py + 6, 2, 2);
      ctx.fillRect(px + 18, py + 6, 2, 2);
    }

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

    // Gentle pulsing glow to show voice is playing
    const pulse = Math.sin(this._phaseTimer * Math.PI * 2 / 1.2) * 0.5 + 0.5;
    ctx.globalAlpha = 0.15 + pulse * 0.25;
    ctx.fillStyle = 'rgba(255, 200, 230, 0.5)';
    ctx.beginPath();
    this._roundRect(ctx, boxX + 2, boxY + 2, boxW - 4, boxH - 4, 6);
    ctx.fill();

    // Secondary inner pulse (slightly offset timing for gentle breathing effect)
    const pulse2 = Math.sin(this._phaseTimer * Math.PI * 2 / 1.8 + 0.5) * 0.5 + 0.5;
    ctx.globalAlpha = 0.08 + pulse2 * 0.12;
    ctx.fillStyle = 'rgba(255, 215, 180, 0.4)';
    ctx.beginPath();
    this._roundRect(ctx, boxX + 4, boxY + 4, boxW - 8, boxH - 8, 4);
    ctx.fill();

    ctx.restore();
  }

  _drawLargeSparkle(ctx) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const bobY = Math.sin(this._sparkleTimer * SPARKLE_BOB_SPEED) * SPARKLE_BOB_AMOUNT;
    // Position sparkle at screen center for maximum visibility
    const cy = ((LOGICAL_HEIGHT / 2) + bobY) | 0;
    const pulse = Math.sin(this._sparkleTimer * Math.PI * 2 / SPARKLE_PULSE_CYCLE) * 0.5 + 0.5;
    const scale = SPARKLE_MIN_SCALE + (SPARKLE_MAX_SCALE - SPARKLE_MIN_SCALE) * pulse;
    const size = SPARKLE_VISUAL_SIZE * scale;

    ctx.save();

    // Soft dark backing circle for contrast against any background
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#1a0033';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 2.5, 0, Math.PI * 2);
    ctx.fill();

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
      // Drift left to right at slightly different speeds (parallax feel)
      c.x += c.speed * dt * 30;
      // Wrap around when cloud drifts off the right edge
      if (c.x - c.w > LOGICAL_WIDTH + 20) {
        c.x = -(c.w + 20 + Math.random() * 40);
        c.y = 15 + Math.random() * 80;
      }
    }
  }

  // ---- Event handlers -------------------------------------------------------

  _onSparkleTapped() {
    this._sparkleTapped = true;
    this._sparkleActive = false;
    this._burstActive = true;
    this._burstTimer = 0;

    // Emit rainbow burst at sparkle's visual position (screen center)
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
