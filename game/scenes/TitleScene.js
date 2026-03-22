/**
 * TitleScene.js — Opening for Princess Sparkle V2
 *
 * Radically simplified: 3 phases for new players, 2 phases for returning.
 * Gets a 4-year-old to her first interaction in ~5 seconds.
 *
 * NEW PLAYER flow:
 *   Phase 0 (0-2s): Sparkle fade-in — title scales up, particles drift
 *   Phase 1 (2s+):  Tap to begin — large pulsing sparkle star, auto-advance 8s
 *   Phase 2:        Sparkle burst → fade to CompanionSelectScene
 *
 * RETURNING PLAYER flow (save exists with companionId):
 *   Phase 0 (0-1.5s): "Welcome back, Princess!" subtitle
 *   Phase 1 (1.5-3s): Fade to OverworldScene
 *
 * Canvas only. No DOM. Integer coordinates. Pre-allocated particles.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import TransitionOverlay from '../ui/TransitionOverlay.js';
import { playVoice, preloadVoices, SCENE_VOICES, unlockVoiceAudio, isVoiceUnlocked } from '../data/voiceIndex.js';
import spriteSheets from '../data/SpriteSheetManager.js';

// ---- Easing -----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBack(t) {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
}

// ---- Constants --------------------------------------------------------------

// Phase durations (seconds)
const PHASE0_DURATION = 2.0;     // Sparkle fade-in with title
const PHASE1_AUTO_ADVANCE = 8.0; // Auto-advance if no tap after 8s
const BURST_DELAY = 1.2;         // Time after burst before transition

// Returning player
const CONTINUE_WELCOME_DELAY = 0.3;
const CONTINUE_TRANSITION_DELAY = 1.5;

// Background gradient (soft purple/gold — fairy tale)
const BG_TOP = '#1a0a2e';       // deep purple
const BG_MID = '#2d1b4e';       // mid purple
const BG_BOTTOM = '#4a2a6e';    // lighter purple
const GOLD_TINT = 'rgba(255, 215, 0, 0.06)';

// Title text
const TITLE_FONT_SIZE = 16;
const TITLE_FONT = `bold ${TITLE_FONT_SIZE}px "Segoe UI", "Arial Rounded MT Bold", sans-serif`;
const SUBTITLE_FONT_SIZE = 8;
const SUBTITLE_FONT = `${SUBTITLE_FONT_SIZE}px "Segoe UI", "Arial Rounded MT Bold", sans-serif`;

// Sparkle config — large, irresistible to touch
const SPARKLE_SIZE = 80;           // touch target (logical px)
const SPARKLE_VISUAL_SIZE = 40;    // visual radius
const SPARKLE_PULSE_CYCLE = 1.5;
const SPARKLE_MIN_SCALE = 0.82;
const SPARKLE_MAX_SCALE = 1.0;
const SPARKLE_BOB_SPEED = 2.0;
const SPARKLE_BOB_AMOUNT = 6;
const SPARKLE_GLOW_RING_MIN = 1.0;
const SPARKLE_GLOW_RING_MAX = 1.6;
const SPARKLE_HALO_COUNT = 8;
const SPARKLE_DING_INTERVAL = 3.0;

// Particle pool
const MAX_PARTICLES = 80;

// Drifting sparkle motes (ambient)
const MAX_DRIFT_MOTES = 20;

// Sparkle burst colors (rainbow-ish for celebration)
const BURST_COLORS = ['#ffd700', '#ff6b6b', '#ffb347', '#77dd77', '#6baaff', '#b388ff', '#fffacd'];

// ---- TitleScene -------------------------------------------------------------

export default class TitleScene {
  constructor() {
    // Phase tracking
    this._phase = 0;
    this._phaseTimer = 0;
    this._totalTimer = 0;

    // Returning player
    this._isContinue = false;
    this._continueTimer = 0;
    this._continueWelcomePlayed = false;

    // Engine systems (set in init)
    this._audioManager = null;
    this._saveManager = null;
    this._sceneManager = null;
    this._assetLoader = null;
    this._inputManager = null;

    // User interaction tracking (audio unlock)
    this._userTapped = false;

    // Title animation
    this._titleScale = 0;
    this._titleAlpha = 0;

    // Sparkle prompt state (Phase 1)
    this._sparkleActive = false;
    this._sparkleTimer = 0;
    this._sparkleDingTimer = 0;
    this._sparkleTapped = false;

    // Burst state (Phase 2)
    this._burstActive = false;
    this._burstTimer = 0;

    // Pre-allocated particle pool (for burst)
    this._particles = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._particles[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 2 };
    }

    // Drifting sparkle motes (ambient background sparkles)
    this._driftMotes = new Array(MAX_DRIFT_MOTES);
    for (let i = 0; i < MAX_DRIFT_MOTES; i++) {
      this._driftMotes[i] = {
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT,
        vx: (Math.random() - 0.5) * 8,
        vy: -3 - Math.random() * 8,
        size: 1 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        life: Math.random(), // stagger initial phase
      };
    }

    // Transition overlay
    this._transition = new TransitionOverlay();

    // SubtitleBar reference (set from outside if available)
    this._subtitleBar = null;
  }

  // ---- Scene lifecycle ------------------------------------------------------

  init(systems) {
    this._audioManager = systems.audioManager || null;
    this._saveManager = systems.saveManager || null;
    this._sceneManager = systems.sceneManager || null;
    this._assetLoader = systems.assetLoader || null;
    this._inputManager = systems.inputManager || null;

    // SubtitleBar may be on systems
    this._subtitleBar = systems.subtitleBar || null;
  }

  enter() {
    this._phase = 0;
    this._phaseTimer = 0;
    this._totalTimer = 0;
    this._titleScale = 0;
    this._titleAlpha = 0;
    this._userTapped = false;

    this._sparkleActive = false;
    this._sparkleTimer = 0;
    this._sparkleDingTimer = 0;
    this._sparkleTapped = false;
    this._burstActive = false;
    this._burstTimer = 0;

    this._transition = new TransitionOverlay();

    // Reset particles
    for (let i = 0; i < this._particles.length; i++) {
      this._particles[i].active = false;
    }

    // Reset drift motes
    for (let i = 0; i < this._driftMotes.length; i++) {
      const m = this._driftMotes[i];
      m.x = Math.random() * LOGICAL_WIDTH;
      m.y = Math.random() * LOGICAL_HEIGHT;
      m.life = Math.random();
    }

    // Check for save data (returning player)
    this._isContinue = this._hasSaveData();
    this._continueTimer = 0;
    this._continueWelcomePlayed = false;

    // Preload voice lines
    preloadVoices(SCENE_VOICES.title);

    // Play soft ambient tone
    if (this._audioManager) {
      this._audioManager.playSFX('crystalTone');
    }
  }

  exit() {
    // Hide subtitle on exit
    if (this._subtitleBar) {
      this._subtitleBar.hide();
    }
  }

  // ---- Update ---------------------------------------------------------------

  update(dt) {
    this._totalTimer += dt;
    this._transition.update(dt);

    if (this._transition.active) return;

    // ---- Returning player (has save with companionId) --------------------
    if (this._isContinue) {
      this._updateContinueFlow(dt);
      return;
    }

    // ---- New player: 3-phase intro ---------------------------------------

    this._phaseTimer += dt;

    // Detect ANY tap — unlock audio
    if (this._inputManager && this._inputManager.tapped && !this._userTapped) {
      this._userTapped = true;
      console.log('[TitleScene] User tapped — unlocking audio');
      unlockVoiceAudio();
      if (this._audioManager) {
        this._audioManager.unlock();
      }
    }

    switch (this._phase) {
      case 0: this._updatePhase0(dt); break;
      case 1: this._updatePhase1(dt); break;
      case 2: this._updatePhase2(dt); break;
    }

    // Update ambient drift motes
    this._updateDriftMotes(dt);

    // Update burst particles
    this._updateParticles(dt);
  }

  // ---- Phase 0: Sparkle Fade-In (0-2s) -----------------------------------
  // Screen fades from black to purple/gold gradient.
  // Title "Princess Sparkle" scales up with gentle easeOutBack.
  // Tiny sparkle particles drift around.
  // Subtitle: "A magical adventure awaits..."

  _updatePhase0(dt) {
    const t = Math.min(this._phaseTimer / PHASE0_DURATION, 1);

    // Title scale: 0 → 1 with overshoot
    this._titleScale = easeOutBack(t);
    this._titleAlpha = easeInOutCubic(Math.min(t * 1.5, 1));

    // Show subtitle partway through
    if (this._phaseTimer > 0.8 && this._subtitleBar && !this._subtitleBar._visible) {
      this._subtitleBar.show('A magical adventure awaits...');
      playVoice('narrator_title_01');
    }

    // Auto-advance to Phase 1
    if (this._phaseTimer >= PHASE0_DURATION) {
      this._phase = 1;
      this._phaseTimer = 0;
    }
  }

  // ---- Phase 1: Tap to Begin (2s+) ----------------------------------------
  // Large pulsing sparkle star appears below title.
  // Subtitle: "Tap the sparkle to begin!"
  // Auto-advance after 8s if no tap.

  _updatePhase1(dt) {
    if (!this._sparkleActive && !this._sparkleTapped) {
      this._sparkleActive = true;
      this._sparkleTimer = 0;
      this._sparkleDingTimer = 0;

      // Update subtitle
      if (this._subtitleBar) {
        this._subtitleBar.show('Tap the sparkle to begin!');
      }
      playVoice('narrator_title_02');
    }

    if (this._sparkleActive) {
      this._sparkleTimer += dt;
      this._sparkleDingTimer += dt;

      // Gentle repeating ding
      if (this._sparkleDingTimer >= SPARKLE_DING_INTERVAL) {
        this._sparkleDingTimer = 0;
        if (this._audioManager) {
          this._audioManager.playSFX('crystalTone');
        }
      }

      // Tap ANYWHERE to advance (toddler-friendly)
      if (this._inputManager && this._inputManager.tapped) {
        this._onSparkleTapped();
      }

      // Auto-advance after 8s
      if (this._sparkleTimer >= PHASE1_AUTO_ADVANCE && !this._sparkleTapped) {
        this._onSparkleTapped();
      }
    }

    // Burst animation after tap → transition
    if (this._burstActive) {
      this._burstTimer += dt;
      if (this._burstTimer > BURST_DELAY && !this._transition.active) {
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

  // ---- Phase 2: (unused — burst handled in Phase 1) ----------------------

  _updatePhase2(dt) {
    // Burst is handled within Phase 1 update
  }

  // ---- Continue flow (returning player) -----------------------------------

  _updateContinueFlow(dt) {
    this._continueTimer += dt;

    // Detect tap for audio unlock
    if (!this._userTapped && this._inputManager && this._inputManager.tapped) {
      this._userTapped = true;
      unlockVoiceAudio();
      if (this._audioManager) {
        this._audioManager.unlock();
      }
    }

    // Show "Welcome back, Princess!" subtitle
    if (!this._continueWelcomePlayed && this._continueTimer >= CONTINUE_WELCOME_DELAY) {
      this._continueWelcomePlayed = true;
      if (this._subtitleBar) {
        this._subtitleBar.show('Welcome back, Princess!');
      }
      playVoice('narrator_title_return_01');
    }

    // Fade to Overworld
    if (this._continueTimer >= CONTINUE_TRANSITION_DELAY && !this._transition.active) {
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

  draw(renderer) {
    const ctx = renderer.ctx;

    if (this._isContinue) {
      this._drawContinueFlow(renderer);
    } else {
      this._drawNewPlayer(renderer);
    }

    // Transition overlay always on top
    this._transition.draw(renderer);
  }

  _drawNewPlayer(renderer) {
    const ctx = renderer.ctx;

    // ---- Background: soft purple/gold gradient ----------------------------
    this._drawBackground(ctx);

    // ---- Ambient drift motes (sparkle particles) --------------------------
    this._drawDriftMotes(ctx);

    // ---- Title text -------------------------------------------------------
    if (this._titleAlpha > 0) {
      this._drawTitle(ctx);
    }

    // ---- Large pulsing sparkle (Phase 1) ----------------------------------
    if (this._sparkleActive && !this._sparkleTapped) {
      this._drawLargeSparkle(ctx);
    }

    // ---- Burst particles --------------------------------------------------
    if (this._burstActive) {
      this._drawParticles(ctx);
    }
  }

  _drawContinueFlow(renderer) {
    const ctx = renderer.ctx;
    this._drawBackground(ctx);
    this._drawDriftMotes(ctx);

    // "Welcome back" — title still shows briefly
    const t = Math.min(this._continueTimer / 1.0, 1);
    this._titleScale = 1;
    this._titleAlpha = easeInOutCubic(t);
    this._drawTitle(ctx);
  }

  // ---- Draw helpers ---------------------------------------------------------

  _drawBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, BG_TOP);
    grad.addColorStop(0.5, BG_MID);
    grad.addColorStop(1, BG_BOTTOM);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Subtle gold radial glow at center
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const cy = (LOGICAL_HEIGHT * 0.35) | 0;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, LOGICAL_WIDTH * 0.6);
    glow.addColorStop(0, 'rgba(255, 215, 0, 0.08)');
    glow.addColorStop(0.5, 'rgba(255, 200, 150, 0.03)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Twinkling stars in the background
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 15; i++) {
      const sx = (29 + i * 37 + Math.sin(i * 2.7) * 12) % LOGICAL_WIDTH;
      const sy = (15 + Math.sin(i * 3.1) * 30 + i * 7) % (LOGICAL_HEIGHT * 0.7);
      const twinkle = Math.sin(this._totalTimer * 2.5 + i * 1.9) * 0.5 + 0.5;
      ctx.globalAlpha = 0.15 + twinkle * 0.4;
      const starSize = twinkle > 0.7 ? 2 : 1;
      ctx.fillRect(sx | 0, sy | 0, starSize, starSize);
    }
    ctx.globalAlpha = 1;
  }

  _drawTitle(ctx) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const cy = (LOGICAL_HEIGHT * 0.3) | 0;

    ctx.save();
    ctx.globalAlpha = this._titleAlpha;
    ctx.translate(cx, cy);
    ctx.scale(this._titleScale, this._titleScale);

    // Title text shadow/glow
    ctx.font = TITLE_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Soft gold glow behind text
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.fillText('Princess Sparkle', 1, 1);
    ctx.fillText('Princess Sparkle', -1, -1);

    // Main title text (warm cream)
    ctx.fillStyle = '#fff8e7';
    ctx.fillText('Princess Sparkle', 0, 0);

    // Small sparkle accents on either side of title
    const tw = ctx.measureText('Princess Sparkle').width / 2;
    const sparkleT = this._totalTimer;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const sx = side * (tw + 8 + Math.sin(sparkleT * 2 + i) * 3);
      const sy = Math.sin(sparkleT * 1.5 + i * Math.PI) * 3;
      const sparkAlpha = 0.5 + Math.sin(sparkleT * 3 + i * 2) * 0.3;
      ctx.globalAlpha = this._titleAlpha * sparkAlpha;
      ctx.fillStyle = '#ffd700';
      // Tiny 4-point star
      ctx.fillRect((sx - 1) | 0, sy | 0, 3, 1);
      ctx.fillRect(sx | 0, (sy - 1) | 0, 1, 3);
    }

    ctx.restore();
  }

  _drawLargeSparkle(ctx) {
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const bobY = Math.sin(this._sparkleTimer * SPARKLE_BOB_SPEED) * SPARKLE_BOB_AMOUNT;
    const cy = ((LOGICAL_HEIGHT * 0.6) + bobY) | 0;
    const pulse = Math.sin(this._sparkleTimer * Math.PI * 2 / SPARKLE_PULSE_CYCLE) * 0.5 + 0.5;
    const scale = SPARKLE_MIN_SCALE + (SPARKLE_MAX_SCALE - SPARKLE_MIN_SCALE) * pulse;
    const size = SPARKLE_VISUAL_SIZE * scale;

    ctx.save();

    // Soft dark backing circle for contrast
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#1a0033';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Golden glow ring that pulses
    const ringScale = SPARKLE_GLOW_RING_MIN + (SPARKLE_GLOW_RING_MAX - SPARKLE_GLOW_RING_MIN) * pulse;
    ctx.globalAlpha = 0.15 + (1 - pulse) * 0.15;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, size * ringScale * 1.4, 0, Math.PI * 2);
    ctx.stroke();

    // Second glow ring (offset timing)
    const pulse2 = Math.sin(this._sparkleTimer * Math.PI * 2 / SPARKLE_PULSE_CYCLE + Math.PI * 0.6) * 0.5 + 0.5;
    ctx.globalAlpha = 0.08 + (1 - pulse2) * 0.1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size * ringScale * 1.8, 0, Math.PI * 2);
    ctx.stroke();

    // Soft radial glow
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

    // Main star shape
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

  // ---- Ambient drift motes -------------------------------------------------

  _updateDriftMotes(dt) {
    for (let i = 0; i < this._driftMotes.length; i++) {
      const m = this._driftMotes[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.phase += dt * 2;

      // Respawn when off screen
      if (m.y < -5 || m.x < -5 || m.x > LOGICAL_WIDTH + 5) {
        m.x = Math.random() * LOGICAL_WIDTH;
        m.y = LOGICAL_HEIGHT + 5;
        m.vx = (Math.random() - 0.5) * 8;
        m.vy = -3 - Math.random() * 8;
      }
    }
  }

  _drawDriftMotes(ctx) {
    ctx.save();
    for (let i = 0; i < this._driftMotes.length; i++) {
      const m = this._driftMotes[i];
      const twinkle = Math.sin(m.phase) * 0.5 + 0.5;
      ctx.globalAlpha = 0.15 + twinkle * 0.35;
      ctx.fillStyle = (i % 3 === 0) ? '#ffd700' : (i % 3 === 1) ? '#b388ff' : '#fffacd';

      // Draw as tiny cross (sparkle shape)
      const px = m.x | 0;
      const py = m.y | 0;
      const s = m.size;
      if (s > 1.2) {
        ctx.fillRect(px - 1, py, 3, 1);
        ctx.fillRect(px, py - 1, 1, 3);
      } else {
        ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.restore();
  }

  // ---- Particle system (burst) ----------------------------------------------

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
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 30;
      p.life = 1.0 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.color = BURST_COLORS[(Math.random() * BURST_COLORS.length) | 0];
      p.size = 2 + ((Math.random() * 3) | 0);
    }
  }

  // ---- Event handlers -------------------------------------------------------

  _onSparkleTapped() {
    if (this._sparkleTapped) return;

    this._sparkleTapped = true;
    this._sparkleActive = false;
    this._burstActive = true;
    this._burstTimer = 0;

    // Ensure audio is unlocked
    if (!this._userTapped) {
      this._userTapped = true;
      unlockVoiceAudio();
      if (this._audioManager) {
        this._audioManager.unlock();
      }
    }

    // Hide subtitle during burst
    if (this._subtitleBar) {
      this._subtitleBar.hide();
    }

    // Emit sparkle burst at the sparkle's visual position
    const bobY = Math.sin(this._sparkleTimer * SPARKLE_BOB_SPEED) * SPARKLE_BOB_AMOUNT;
    this._emitBurst(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT * 0.6 + bobY);

    // Play chime SFX
    if (this._audioManager) {
      this._audioManager.playSFX('crystalTone');
    }
  }

  _hasSaveData() {
    // Only treat as "continue" if a companion has been chosen
    if (this._saveManager && this._saveManager.hasSave()) {
      return !!this._saveManager.get('companionId');
    }
    try {
      const raw = localStorage.getItem('sparkle-save');
      if (!raw) return false;
      const data = JSON.parse(raw);
      return !!data.companionId;
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
