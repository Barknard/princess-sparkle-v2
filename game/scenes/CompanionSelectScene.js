/**
 * CompanionSelectScene.js — Choose your companion friend
 *
 * Five companions in a horizontal arc on a meadow background.
 * Each has a colored glow matching their personality.
 *
 * AUTO-CYCLE SHOWCASE: After narrator intro, companions are showcased one at a
 * time — each grows, glows, plays its voice intro, then shrinks back. After all
 * 5 have been shown, the cycle repeats with ESCALATING visual nudges:
 *   0-10s:  gentle bob, colored glows
 *   10-20s: higher bounce, brighter pulsing glows
 *   20-30s: sparkle particles orbit each companion, gentle chime
 *   30s+:   one companion at a time does a "pick me!" dance (jump+spin+sparkle burst)
 *
 * SELECTION RULE: NEVER auto-select. She MUST choose herself.
 *   - Tap any companion: it grows, glows bright, plays its voice intro
 *   - Tap the SAME companion a second time: confirm with celebration
 *   - Scene waits FOREVER. Never auto-picks.
 *
 * Canvas only. No DOM. Pre-allocated particles. Integer coords.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import TransitionOverlay from '../ui/TransitionOverlay.js';
import { playVoice, preloadVoices, SCENE_VOICES } from '../data/voiceIndex.js';
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

const COMPANIONS = [
  { id: 'shimmer', name: 'Shimmer', creature: 'Unicorn', glowColor: '#ffb3d9', bodyColor: '#fff0f5', hornColor: '#ffd700', voice: 'companion_shimmer_intro_01' },
  { id: 'ember',   name: 'Ember',   creature: 'Baby Dragon', glowColor: '#ffcc80', bodyColor: '#ff6b35', wingColor: '#ff9966', voice: 'companion_ember_intro_01' },
  { id: 'petal',   name: 'Petal',   creature: 'Bunny', glowColor: '#b3e6b3', bodyColor: '#f5f5dc', earColor: '#ffb6c1', voice: 'companion_petal_intro_01' },
  { id: 'breeze',  name: 'Breeze',  creature: 'Butterfly', glowColor: '#b3d9ff', bodyColor: '#e0f0ff', wingColor: '#87ceeb', voice: 'companion_breeze_intro_01' },
  { id: 'pip',     name: 'Pip',     creature: 'Fox Cub', glowColor: '#ffe066', bodyColor: '#ff8c42', tailColor: '#fff5ee', voice: 'companion_pip_intro_01' },
];

// Layout: companions in a gentle arc
const ARC_CENTER_X = LOGICAL_WIDTH / 2;
const ARC_CENTER_Y = LOGICAL_HEIGHT * 0.52;
const ARC_RADIUS_X = LOGICAL_WIDTH * 0.38;
const ARC_RADIUS_Y = 20; // slight vertical arc
const COMPANION_SIZE = 28; // base sprite size
const TOUCH_SIZE = 80;     // touch target around each companion

// Confirm heart icon (replaces text button)
const HEART_ICON_SIZE = 64;  // 64x64 logical px — large touch target for 4yo
const HEART_ICON_Y = LOGICAL_HEIGHT - 80;

// Shimmer effect for untapped companions
const SHIMMER_SPEED = 2.5;     // shimmer animation speed
const SHIMMER_PARTICLES = 3;   // sparkle motes per untapped companion

// Particles
const MAX_PARTICLES = 60; // increased for orbit sparkles and pick-me bursts

// Narrator voice lines (IDs match voice-script/audio/voice/ filenames)
const NARRATOR_LINES = {
  intro1: 'narrator_companion_intro_01',
  intro2: 'narrator_companion_intro_02',
  intro3: 'narrator_companion_intro_03',
  confirm2: 'narrator_companion_confirm_02',
};

// Per-companion confirm lines (keyed by companion id)
const NARRATOR_CONFIRM = {
  shimmer: 'narrator_companion_confirm_shimmer',
  ember:   'narrator_companion_confirm_ember',
  petal:   'narrator_companion_confirm_petal',
  breeze:  'narrator_companion_confirm_breeze',
  pip:     'narrator_companion_confirm_pip',
};

// Auto-cycle timing
const SHOWCASE_DURATION = 3.0;   // seconds each companion is showcased
const SHOWCASE_FADE_IN = 0.4;    // seconds to grow/brighten
const SHOWCASE_HOLD = 1.8;       // seconds at full highlight
const SHOWCASE_FADE_OUT = 0.8;   // seconds to shrink back

// Escalation thresholds (seconds after first full cycle completes)
const ESCALATION_TIER_2 = 10;   // higher bounce, brighter pulse
const ESCALATION_TIER_3 = 20;   // orbit sparkles, chime
const ESCALATION_TIER_4 = 30;   // pick-me dance

// ---- CompanionSelectScene ---------------------------------------------------

export default class CompanionSelectScene {
  constructor() {
    // Systems
    this._audioManager = null;
    this._sceneManager = null;
    this._saveManager = null;
    this._inputManager = null;
    this._assetLoader = null;

    // State
    this._selectedIndex = -1;     // currently highlighted companion (by player tap)
    this._confirmedIndex = -1;    // chosen companion (after double-tap)
    this._tapCount = 0;           // taps on same companion
    this._showConfirmHeart = false;

    // Narrator state
    this._introPhase = 0;        // 0,1=playing intro lines, 2=interactive/showcase
    this._introTimer = 0;

    // === Auto-cycle showcase state ===
    this._showcaseActive = false;     // true while auto-cycling (stops on player tap)
    this._playerEngaged = false;      // true once player taps ANY companion — auto-cycle NEVER resumes
    this._showcaseIndex = -1;         // which companion is currently showcased (-1 = none yet)
    this._showcaseTimer = 0;          // time into current showcase step
    this._showcaseCycle = 0;          // how many full cycles completed
    this._showcaseEscalationTime = 0; // total seconds since first cycle completed
    this._showcaseChimePlayed = false; // per-showcase-step chime flag

    // Companion animation states (pre-allocated)
    this._companionStates = new Array(COMPANIONS.length);
    for (let i = 0; i < COMPANIONS.length; i++) {
      this._companionStates[i] = {
        scale: 1.0,
        targetScale: 1.0,
        alpha: 0.7,       // slightly transparent until tapped
        targetAlpha: 0.7,
        glowAlpha: 0.3,
        bobTimer: Math.random() * Math.PI * 2,
        bobY: 0,
        waving: false,    // wave goodbye animation
        waveTimer: 0,
        tapped: false,    // has this companion been tapped at least once?
        danceTimer: 0,    // happy dance timer for selected companion
        dancing: false,   // whether doing happy dance
        // Escalation-specific
        pickMeDancing: false,  // "pick me!" dance during tier 4
        pickMeTimer: 0,
        orbitSparkleTimer: 0,
        spinAngle: 0,         // for pick-me spin
      };
    }

    // Positions (pre-calculated)
    this._positions = new Array(COMPANIONS.length);
    for (let i = 0; i < COMPANIONS.length; i++) {
      const angle = Math.PI + (Math.PI * (i / (COMPANIONS.length - 1)));
      this._positions[i] = {
        x: (ARC_CENTER_X + Math.cos(angle) * ARC_RADIUS_X) | 0,
        y: (ARC_CENTER_Y + Math.sin(angle) * ARC_RADIUS_Y) | 0,
      };
    }

    // Confirmation animation
    this._confirmTimer = 0;
    this._confirmAnimating = false;

    // Particles
    this._particles = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._particles[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 2 };
    }

    // Transition
    this._transition = new TransitionOverlay();

    // Meadow background details
    this._grassBlades = new Array(30);
    for (let i = 0; i < 30; i++) {
      this._grassBlades[i] = {
        x: (Math.random() * LOGICAL_WIDTH) | 0,
        y: (LOGICAL_HEIGHT * 0.65 + Math.random() * LOGICAL_HEIGHT * 0.3) | 0,
        h: 3 + ((Math.random() * 5) | 0),
        phase: Math.random() * Math.PI * 2,
      };
    }
  }

  // ---- Lifecycle ------------------------------------------------------------

  init(systems) {
    this._audioManager = systems.audioManager || null;
    this._sceneManager = systems.sceneManager || null;
    this._saveManager = systems.saveManager || null;
    this._inputManager = systems.inputManager || null;
    this._assetLoader = systems.assetLoader || null;
  }

  enter() {
    this._selectedIndex = -1;
    this._confirmedIndex = -1;
    this._tapCount = 0;
    this._showConfirmHeart = false;
    this._introPhase = 0;
    this._introTimer = 0;
    this._confirmTimer = 0;
    this._confirmAnimating = false;
    this._transition = new TransitionOverlay();

    // Reset showcase
    this._showcaseActive = false;
    this._playerEngaged = false;
    this._showcaseIndex = -1;
    this._showcaseTimer = 0;
    this._showcaseCycle = 0;
    this._showcaseEscalationTime = 0;
    this._showcaseChimePlayed = false;

    for (let i = 0; i < this._companionStates.length; i++) {
      const cs = this._companionStates[i];
      cs.scale = 1.0;
      cs.targetScale = 1.0;
      cs.alpha = 0.7;
      cs.targetAlpha = 0.7;
      cs.glowAlpha = 0.3;
      cs.waving = false;
      cs.waveTimer = 0;
      cs.tapped = false;
      cs.danceTimer = 0;
      cs.dancing = false;
      cs.pickMeDancing = false;
      cs.pickMeTimer = 0;
      cs.orbitSparkleTimer = 0;
      cs.spinAngle = 0;
    }

    for (let i = 0; i < this._particles.length; i++) {
      this._particles[i].active = false;
    }

    // Preload voice lines for this scene
    preloadVoices(SCENE_VOICES.companionSelect);

    // Play narrator intro
    this._playVoice(NARRATOR_LINES.intro1);
  }

  exit() {
    // Cleanup
  }

  // ---- Update ---------------------------------------------------------------

  update(dt) {
    this._transition.update(dt);
    if (this._transition.active) return;

    this._introTimer += dt;

    // Narrator intro sequence — leads into showcase
    if (this._introPhase === 0) {
      if (this._introTimer > 3) {
        this._playVoice(NARRATOR_LINES.intro2);
        this._introPhase = 1;
      }
    } else if (this._introPhase === 1) {
      if (this._introTimer > 6) {
        this._playVoice(NARRATOR_LINES.intro3);
        this._introPhase = 2;
        // Start auto-cycle showcase
        this._showcaseActive = true;
        this._showcaseIndex = 0;
        this._showcaseTimer = 0;
        this._showcaseChimePlayed = false;
        // Immediately highlight first companion
        this._beginShowcaseStep(0);
      }
    }

    // Handle input FIRST (before showcase) so taps immediately stop auto-cycle
    if (this._introPhase >= 2 && !this._confirmAnimating) {
      this._handleInput();
    }

    // === Auto-cycle showcase ===
    // Only run if player hasn't tapped anything yet
    if (this._showcaseActive && !this._playerEngaged && this._selectedIndex === -1 && !this._confirmAnimating) {
      this._updateShowcase(dt);
    }

    // === Escalation timer (counts up after first full cycle) ===
    if (this._showcaseCycle >= 1 && this._showcaseActive && !this._playerEngaged) {
      this._showcaseEscalationTime += dt;
    }

    // Companion idle animations
    for (let i = 0; i < this._companionStates.length; i++) {
      const cs = this._companionStates[i];
      cs.bobTimer += dt;

      // Determine escalation tier
      const tier = this._getEscalationTier();

      // Base bob — amplitude depends on escalation
      let bobAmp = 3;
      let bobSpeed = 2.0 + i * 0.3;
      if (tier >= 2 && this._showcaseActive && !this._playerEngaged) {
        bobAmp = 6;
        bobSpeed = 2.5 + i * 0.3;
      }
      cs.bobY = Math.sin(cs.bobTimer * bobSpeed) * bobAmp;

      // Happy dance for player-selected companion (bouncy squash-stretch)
      if (cs.dancing) {
        cs.danceTimer += dt;
        const dancePulse = Math.sin(cs.danceTimer * 8) * 0.08;
        cs.scale += (cs.targetScale + dancePulse - cs.scale) * Math.min(dt * 8, 1);
        cs.bobY += Math.abs(Math.sin(cs.danceTimer * 6)) * 4;
      } else if (cs.pickMeDancing) {
        // Tier 4 "pick me!" dance: jump + spin + sparkle burst
        cs.pickMeTimer += dt;
        cs.spinAngle += dt * 12; // spin fast
        // Big bouncy jump
        cs.bobY -= Math.abs(Math.sin(cs.pickMeTimer * 5)) * 12;
        // Scale pulse
        const pickPulse = Math.sin(cs.pickMeTimer * 6) * 0.12;
        cs.scale += (cs.targetScale + pickPulse - cs.scale) * Math.min(dt * 10, 1);
        // Emit sparkle burst periodically
        if (cs.pickMeTimer > 0.5 && ((cs.pickMeTimer * 3) | 0) % 2 === 0) {
          const pos = this._positions[i];
          this._emitCompanionParticles(pos.x, pos.y + cs.bobY, COMPANIONS[i].glowColor);
        }
      } else {
        // Smooth scale interpolation
        cs.scale += (cs.targetScale - cs.scale) * Math.min(dt * 6, 1);
      }

      cs.alpha += (cs.targetAlpha - cs.alpha) * Math.min(dt * 6, 1);

      // Orbit sparkle timer (tier 3+)
      if (tier >= 3 && this._showcaseActive) {
        cs.orbitSparkleTimer += dt;
      }

      // Wave goodbye animation
      if (cs.waving) {
        cs.waveTimer += dt;
      }
    }

    // Confirmation animation
    if (this._confirmAnimating) {
      this._confirmTimer += dt;
      if (this._confirmTimer > 3 && !this._transition.active) {
        // Transition to Overworld via iris wipe (fire once)
        this._confirmAnimating = false;
        this._transition.start('iris', {
          duration: 800,
          onHalf: () => {
            // Save companion choice
            if (this._saveManager) {
              this._saveManager.setCompanion(COMPANIONS[this._confirmedIndex].id);
            }
            if (this._sceneManager) {
              this._sceneManager.switchTo('Overworld');
            }
          },
        });
      }
    }

    // Particles
    this._updateParticles(dt);
  }

  // ---- Auto-cycle showcase --------------------------------------------------

  _getEscalationTier() {
    if (this._showcaseCycle < 1) return 1;
    const t = this._showcaseEscalationTime;
    if (t >= ESCALATION_TIER_4) return 4;
    if (t >= ESCALATION_TIER_3) return 3;
    if (t >= ESCALATION_TIER_2) return 2;
    return 1;
  }

  _beginShowcaseStep(index) {
    // Reset all companions to idle
    for (let i = 0; i < this._companionStates.length; i++) {
      const cs = this._companionStates[i];
      cs.targetScale = 1.0;
      cs.targetAlpha = 0.6;
      cs.glowAlpha = 0.3;
      cs.pickMeDancing = false;
      cs.pickMeTimer = 0;
    }

    // Highlight the showcased companion
    const cs = this._companionStates[index];
    cs.targetScale = 1.25;
    cs.targetAlpha = 1.0;
    cs.glowAlpha = 0.6;

    // Play this companion's voice intro so she hears each one
    this._playVoice(COMPANIONS[index].voice);

    // Demo particles
    const pos = this._positions[index];
    this._emitCompanionParticles(pos.x, pos.y, COMPANIONS[index].glowColor);

    this._showcaseChimePlayed = false;
  }

  _updateShowcase(dt) {
    this._showcaseTimer += dt;
    const tier = this._getEscalationTier();

    // Current showcased companion visual updates based on showcase phase
    if (this._showcaseIndex >= 0 && this._showcaseIndex < COMPANIONS.length) {
      const cs = this._companionStates[this._showcaseIndex];
      const t = this._showcaseTimer;

      if (t < SHOWCASE_FADE_IN) {
        // Growing in
        const progress = t / SHOWCASE_FADE_IN;
        cs.targetScale = 1.0 + 0.25 * easeOutBack(progress);
        cs.targetAlpha = 0.6 + 0.4 * progress;
        cs.glowAlpha = 0.3 + 0.4 * progress;
      } else if (t < SHOWCASE_FADE_IN + SHOWCASE_HOLD) {
        // Holding at full highlight
        cs.targetScale = 1.25;
        cs.targetAlpha = 1.0;
        cs.glowAlpha = 0.7;

        // Tier 3+: play chime once per showcase step
        if (tier >= 3 && !this._showcaseChimePlayed) {
          if (this._audioManager) {
            this._audioManager.playSFX('trailShimmer');
          }
          this._showcaseChimePlayed = true;
        }

        // Tier 4: "pick me!" dance for the showcased companion
        if (tier >= 4) {
          cs.pickMeDancing = true;
          cs.targetScale = 1.3;
        }
      } else {
        // Fading out
        const fadeProgress = (t - SHOWCASE_FADE_IN - SHOWCASE_HOLD) / SHOWCASE_FADE_OUT;
        cs.targetScale = 1.25 - 0.25 * Math.min(fadeProgress, 1);
        cs.targetAlpha = 1.0 - 0.4 * Math.min(fadeProgress, 1);
        cs.glowAlpha = 0.7 - 0.4 * Math.min(fadeProgress, 1);
        cs.pickMeDancing = false;
      }

      // Tier 2+: brighter glow pulse on showcased companion
      if (tier >= 2) {
        cs.glowAlpha += Math.sin(this._introTimer * 4) * 0.15;
      }
    }

    // Advance to next companion when showcase duration expires
    if (this._showcaseTimer >= SHOWCASE_DURATION) {
      this._showcaseTimer = 0;

      // Stop pick-me dance on current
      if (this._showcaseIndex >= 0) {
        this._companionStates[this._showcaseIndex].pickMeDancing = false;
        this._companionStates[this._showcaseIndex].pickMeTimer = 0;
      }

      this._showcaseIndex++;
      if (this._showcaseIndex >= COMPANIONS.length) {
        // Completed one full cycle
        this._showcaseIndex = 0;
        this._showcaseCycle++;
      }

      this._beginShowcaseStep(this._showcaseIndex);
    }
  }

  // ---- Input ----------------------------------------------------------------

  _handleInput() {
    if (!this._inputManager || !this._inputManager.tapped) return;

    const tx = this._inputManager.x;
    const ty = this._inputManager.y;

    // Check confirm heart icon first (only visible after double-tap)
    if (this._showConfirmHeart) {
      const heartCX = (LOGICAL_WIDTH / 2) | 0;
      const heartCY = (HEART_ICON_Y + HEART_ICON_SIZE / 2) | 0;
      const dist = Math.hypot(tx - heartCX, ty - heartCY);
      if (dist < HEART_ICON_SIZE * 0.7) {
        this._onConfirm();
        return;
      }
    }

    // Check companion taps
    for (let i = 0; i < this._positions.length; i++) {
      const pos = this._positions[i];
      const halfTouch = TOUCH_SIZE / 2;
      if (tx >= pos.x - halfTouch && tx <= pos.x + halfTouch &&
          ty >= pos.y - halfTouch && ty <= pos.y + halfTouch) {
        this._onCompanionTapped(i);
        return;
      }
    }
  }

  _onCompanionTapped(index) {
    // Player tapped a companion — stop auto-cycle showcase PERMANENTLY
    this._showcaseActive = false;
    this._playerEngaged = true;  // never resume auto-cycle

    // Reset all pick-me dances from showcase
    for (let i = 0; i < this._companionStates.length; i++) {
      this._companionStates[i].pickMeDancing = false;
      this._companionStates[i].pickMeTimer = 0;
    }

    if (index === this._selectedIndex) {
      // Same companion tapped again — CONFIRM selection with celebration
      this._tapCount++;
      if (this._tapCount >= 2) {
        this._onConfirm();
        return;
      }
    } else {
      // New companion selected
      // Dim previous
      if (this._selectedIndex >= 0) {
        this._companionStates[this._selectedIndex].targetScale = 1.0;
        this._companionStates[this._selectedIndex].targetAlpha = 0.7;
        this._companionStates[this._selectedIndex].dancing = false;
      }
      this._selectedIndex = index;
      this._tapCount = 1;
      this._showConfirmHeart = false;
    }

    // Highlight selected — grow bigger, glow brighter, start happy dance
    const cs = this._companionStates[index];
    cs.targetScale = 1.3;
    cs.targetAlpha = 1.0;
    cs.glowAlpha = 0.7;
    cs.tapped = true;
    cs.dancing = true;
    cs.danceTimer = 0;

    // Dim all others and stop their dances
    for (let i = 0; i < this._companionStates.length; i++) {
      if (i !== index) {
        this._companionStates[i].targetScale = 1.0;
        this._companionStates[i].targetAlpha = 0.5;
        this._companionStates[i].dancing = false;
      }
    }

    // Play companion voice intro
    this._playVoice(COMPANIONS[index].voice);

    // Demo particle effect
    const pos = this._positions[index];
    this._emitCompanionParticles(pos.x, pos.y, COMPANIONS[index].glowColor);

    // Play companion SFX
    if (this._audioManager) {
      this._audioManager.playSFX('trailShimmer');
    }
  }

  _onConfirm() {
    if (this._selectedIndex < 0) return;

    this._confirmedIndex = this._selectedIndex;
    this._confirmAnimating = true;
    this._confirmTimer = 0;
    this._showConfirmHeart = false;
    this._showcaseActive = false;

    // Joyful animation for chosen companion
    const cs = this._companionStates[this._confirmedIndex];
    cs.targetScale = 1.4;

    // Others wave goodbye
    for (let i = 0; i < this._companionStates.length; i++) {
      if (i !== this._confirmedIndex) {
        this._companionStates[i].waving = true;
        this._companionStates[i].waveTimer = 0;
        this._companionStates[i].targetAlpha = 0;
        this._companionStates[i].dancing = false;
      }
    }

    // Big particle burst
    const pos = this._positions[this._confirmedIndex];
    this._emitBurst(pos.x, pos.y, COMPANIONS[this._confirmedIndex].glowColor);

    // Narrator confirm (per-companion line)
    const companionId = COMPANIONS[this._confirmedIndex].id;
    this._playVoice(NARRATOR_CONFIRM[companionId] || NARRATOR_LINES.confirm2);

    if (this._audioManager) {
      this._audioManager.playSFX('evolution');
    }
  }

  // ---- Draw -----------------------------------------------------------------

  draw(renderer) {
    const ctx = renderer.ctx;

    // Meadow background
    this._drawMeadow(ctx);

    // Companions
    for (let i = 0; i < COMPANIONS.length; i++) {
      this._drawCompanion(ctx, i);
    }

    // Orbit sparkles (tier 3+ escalation)
    if (this._showcaseActive && this._getEscalationTier() >= 3) {
      this._drawOrbitSparkles(ctx);
    }

    // Confirm heart icon — only shown after double-tap (never during showcase)
    if (this._showConfirmHeart && this._selectedIndex >= 0) {
      this._drawConfirmHeart(ctx, this._selectedIndex);
    }

    // Shimmer on untapped companions to say "tap me!"
    this._drawUntappedShimmers(ctx);

    // Showcase spotlight indicator — subtle "look here!" arrow/ring
    if (this._showcaseActive && this._showcaseIndex >= 0) {
      this._drawShowcaseIndicator(ctx, this._showcaseIndex);
    }

    // Particles
    this._drawParticles(ctx);

    // Transition
    this._transition.draw(renderer);
  }

  _drawMeadow(ctx) {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, '#cce8ff');
    grad.addColorStop(0.5, '#e8f4ff');
    grad.addColorStop(0.7, '#d4edda');
    grad.addColorStop(1, '#a8d8a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Gentle grass blades
    ctx.fillStyle = '#7ec87e';
    for (let i = 0; i < this._grassBlades.length; i++) {
      const g = this._grassBlades[i];
      const sway = Math.sin(g.phase + this._introTimer * 1.5) * 2;
      ctx.fillRect((g.x + sway) | 0, g.y | 0, 1, g.h);
    }

    // Small flowers on the ground
    const flowerColors = ['#ff99cc', '#ffcc99', '#cc99ff', '#99ccff', '#ffff99'];
    for (let i = 0; i < 8; i++) {
      const fx = (40 + i * 55 + Math.sin(i * 1.7) * 20) | 0;
      const fy = (LOGICAL_HEIGHT * 0.75 + Math.sin(i * 2.3) * 15) | 0;
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.fillRect(fx, fy, 3, 3);
      ctx.fillStyle = '#6aad6a';
      ctx.fillRect(fx + 1, fy + 3, 1, 4);
    }
  }

  _drawCompanion(ctx, index) {
    const comp = COMPANIONS[index];
    const cs = this._companionStates[index];
    const pos = this._positions[index];
    const size = (COMPANION_SIZE * cs.scale) | 0;
    const halfSize = (size / 2) | 0;
    const cx = pos.x | 0;
    const cy = (pos.y + cs.bobY) | 0;

    ctx.save();
    ctx.globalAlpha = cs.alpha;

    // Apply spin for pick-me dance
    if (cs.pickMeDancing && cs.spinAngle !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(cs.spinAngle) * 0.3); // wobble-spin, not full 360
      ctx.translate(-cx, -cy);
    }

    // Colored glow behind companion
    ctx.save();
    ctx.globalAlpha = cs.alpha * Math.max(0, Math.min(1, cs.glowAlpha));
    ctx.fillStyle = comp.glowColor;
    ctx.beginPath();
    // Glow radius grows with escalation tier
    let glowSize = size * 0.7;
    if (this._showcaseActive) {
      const tier = this._getEscalationTier();
      if (tier >= 2) glowSize = size * 0.85;
      if (tier >= 3) glowSize = size * 1.0;
      if (tier >= 4 && cs.pickMeDancing) glowSize = size * 1.2;
    }
    ctx.arc(cx, cy, glowSize | 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = cs.alpha;

    // Draw companion sprite (real art if loaded, placeholder otherwise)
    const lx = (cx - halfSize) | 0;
    const ly = (cy - halfSize) | 0;

    // Map companion IDs to sprite names
    const COMP_SPRITES = {
      shimmer: 'unicorn',
      ember: 'dragon',
      petal: 'bunny',
      breeze: 'butterfly',
      pip: 'fox',
    };

    const spriteName = COMP_SPRITES[comp.id];
    if (spriteName && spriteSheets.loaded && spriteSheets.getSpriteRect(spriteName)) {
      // Draw real sprite scaled up from 16x16 to display size
      const spriteScale = size / 16;
      spriteSheets.draw(ctx, spriteName, lx, ly, { scale: spriteScale });
    } else {
      // Fallback to procedural placeholder
      switch (comp.id) {
        case 'shimmer': this._drawShimmer(ctx, lx, ly, size); break;
        case 'ember':   this._drawEmber(ctx, lx, ly, size); break;
        case 'petal':   this._drawPetal(ctx, lx, ly, size); break;
        case 'breeze':  this._drawBreeze(ctx, lx, ly, size); break;
        case 'pip':     this._drawPip(ctx, lx, ly, size); break;
      }
    }

    // Wave goodbye animation
    if (cs.waving && cs.waveTimer < 2) {
      // Small hand-wave indicator
      ctx.fillStyle = comp.glowColor;
      const wx = (cx + halfSize + 2) | 0;
      const wy = (cy - halfSize + 4 + Math.sin(cs.waveTimer * 8) * 3) | 0;
      ctx.fillRect(wx, wy, 3, 3);
    }

    ctx.restore();
  }

  /** Draw a pulsing ring + down-arrow above the currently showcased companion. */
  _drawShowcaseIndicator(ctx, index) {
    const pos = this._positions[index];
    const cs = this._companionStates[index];
    const comp = COMPANIONS[index];
    const cy = (pos.y + cs.bobY) | 0;
    const pulse = Math.sin(this._introTimer * 4) * 0.5 + 0.5;

    ctx.save();

    // Pulsing ring
    ctx.globalAlpha = 0.15 + pulse * 0.15;
    ctx.strokeStyle = comp.glowColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, cy, (COMPANION_SIZE * 0.9 + pulse * 4) | 0, 0, Math.PI * 2);
    ctx.stroke();

    // Small bouncing down-arrow above companion
    const arrowY = (cy - COMPANION_SIZE - 10 - Math.sin(this._introTimer * 5) * 4) | 0;
    ctx.globalAlpha = 0.5 + pulse * 0.3;
    ctx.fillStyle = comp.glowColor;
    ctx.beginPath();
    ctx.moveTo(pos.x, arrowY + 6);
    ctx.lineTo(pos.x - 4, arrowY);
    ctx.lineTo(pos.x + 4, arrowY);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /** Draw sparkle particles orbiting each companion (tier 3+ escalation). */
  _drawOrbitSparkles(ctx) {
    ctx.save();
    for (let i = 0; i < this._companionStates.length; i++) {
      const cs = this._companionStates[i];
      const pos = this._positions[i];
      const comp = COMPANIONS[i];
      const t = cs.orbitSparkleTimer;
      if (t <= 0) continue;

      const numSparkles = 5;
      for (let j = 0; j < numSparkles; j++) {
        const angle = (j / numSparkles) * Math.PI * 2 + t * 2.5;
        const orbitR = COMPANION_SIZE * 0.8 + Math.sin(t * 1.5 + j) * 4;
        const sx = (pos.x + Math.cos(angle) * orbitR) | 0;
        const sy = (pos.y + cs.bobY + Math.sin(angle) * orbitR * 0.6) | 0;
        const sparkleAlpha = 0.4 + Math.sin(t * 3 + j * 1.7) * 0.3;

        ctx.globalAlpha = Math.max(0, Math.min(1, sparkleAlpha));
        ctx.fillStyle = comp.glowColor;
        // Star-shaped sparkle: draw a small + shape
        ctx.fillRect(sx - 1, sy, 3, 1);
        ctx.fillRect(sx, sy - 1, 1, 3);
      }
    }
    ctx.restore();
  }

  // ---- Companion placeholder drawings (replaced by sprites in production) ---

  _drawShimmer(ctx, x, y, size) {
    // Unicorn — white body, golden horn
    const s = size;
    ctx.fillStyle = '#fff0f5';
    ctx.fillRect((x + s * 0.2) | 0, (y + s * 0.3) | 0, (s * 0.6) | 0, (s * 0.5) | 0);
    // Head
    ctx.fillRect((x + s * 0.3) | 0, (y + s * 0.1) | 0, (s * 0.35) | 0, (s * 0.3) | 0);
    // Horn
    ctx.fillStyle = '#ffd700';
    ctx.fillRect((x + s * 0.44) | 0, y | 0, (s * 0.08) | 0, (s * 0.15) | 0);
    // Legs
    ctx.fillStyle = '#fff0f5';
    ctx.fillRect((x + s * 0.25) | 0, (y + s * 0.8) | 0, (s * 0.1) | 0, (s * 0.2) | 0);
    ctx.fillRect((x + s * 0.6) | 0, (y + s * 0.8) | 0, (s * 0.1) | 0, (s * 0.2) | 0);
    // Eye
    ctx.fillStyle = '#4a4a8a';
    ctx.fillRect((x + s * 0.4) | 0, (y + s * 0.2) | 0, 2, 2);
    // Mane (pink)
    ctx.fillStyle = '#ffb3d9';
    ctx.fillRect((x + s * 0.55) | 0, (y + s * 0.1) | 0, (s * 0.12) | 0, (s * 0.25) | 0);
  }

  _drawEmber(ctx, x, y, size) {
    // Baby Dragon — orange body, small wings
    const s = size;
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect((x + s * 0.25) | 0, (y + s * 0.2) | 0, (s * 0.5) | 0, (s * 0.5) | 0);
    // Head
    ctx.fillRect((x + s * 0.3) | 0, (y + s * 0.05) | 0, (s * 0.4) | 0, (s * 0.25) | 0);
    // Wings
    ctx.fillStyle = '#ff9966';
    ctx.fillRect((x + s * 0.1) | 0, (y + s * 0.2) | 0, (s * 0.15) | 0, (s * 0.2) | 0);
    ctx.fillRect((x + s * 0.75) | 0, (y + s * 0.2) | 0, (s * 0.15) | 0, (s * 0.2) | 0);
    // Belly
    ctx.fillStyle = '#ffe0b2';
    ctx.fillRect((x + s * 0.35) | 0, (y + s * 0.4) | 0, (s * 0.3) | 0, (s * 0.25) | 0);
    // Eyes
    ctx.fillStyle = '#4a4a00';
    ctx.fillRect((x + s * 0.35) | 0, (y + s * 0.12) | 0, 2, 2);
    ctx.fillRect((x + s * 0.55) | 0, (y + s * 0.12) | 0, 2, 2);
    // Tail
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect((x + s * 0.7) | 0, (y + s * 0.65) | 0, (s * 0.2) | 0, (s * 0.08) | 0);
  }

  _drawPetal(ctx, x, y, size) {
    // Bunny — cream body, pink ears
    const s = size;
    ctx.fillStyle = '#f5f5dc';
    ctx.fillRect((x + s * 0.25) | 0, (y + s * 0.35) | 0, (s * 0.5) | 0, (s * 0.45) | 0);
    // Head
    ctx.fillRect((x + s * 0.3) | 0, (y + s * 0.15) | 0, (s * 0.4) | 0, (s * 0.3) | 0);
    // Ears
    ctx.fillStyle = '#ffb6c1';
    ctx.fillRect((x + s * 0.32) | 0, y | 0, (s * 0.1) | 0, (s * 0.2) | 0);
    ctx.fillRect((x + s * 0.55) | 0, y | 0, (s * 0.1) | 0, (s * 0.2) | 0);
    // Eyes
    ctx.fillStyle = '#4a2a2a';
    ctx.fillRect((x + s * 0.38) | 0, (y + s * 0.25) | 0, 2, 2);
    ctx.fillRect((x + s * 0.55) | 0, (y + s * 0.25) | 0, 2, 2);
    // Nose
    ctx.fillStyle = '#ffb6c1';
    ctx.fillRect((x + s * 0.47) | 0, (y + s * 0.32) | 0, 2, 1);
    // Tail (puff)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((x + s * 0.75) | 0, (y + s * 0.6) | 0, (s * 0.06) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBreeze(ctx, x, y, size) {
    // Butterfly — light blue wings, tiny body
    const s = size;
    // Wings
    ctx.fillStyle = '#87ceeb';
    ctx.beginPath();
    ctx.ellipse((x + s * 0.25) | 0, (y + s * 0.4) | 0, (s * 0.22) | 0, (s * 0.3) | 0, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse((x + s * 0.75) | 0, (y + s * 0.4) | 0, (s * 0.22) | 0, (s * 0.3) | 0, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Wing spots
    ctx.fillStyle = '#e0f0ff';
    ctx.beginPath();
    ctx.arc((x + s * 0.25) | 0, (y + s * 0.4) | 0, (s * 0.08) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((x + s * 0.75) | 0, (y + s * 0.4) | 0, (s * 0.08) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = '#6a5acd';
    ctx.fillRect((x + s * 0.45) | 0, (y + s * 0.25) | 0, (s * 0.1) | 0, (s * 0.4) | 0);
    // Antennae
    ctx.strokeStyle = '#6a5acd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo((x + s * 0.47) | 0, (y + s * 0.25) | 0);
    ctx.lineTo((x + s * 0.38) | 0, (y + s * 0.12) | 0);
    ctx.moveTo((x + s * 0.53) | 0, (y + s * 0.25) | 0);
    ctx.lineTo((x + s * 0.62) | 0, (y + s * 0.12) | 0);
    ctx.stroke();
  }

  _drawPip(ctx, x, y, size) {
    // Fox Cub — orange body, white-tipped tail
    const s = size;
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect((x + s * 0.2) | 0, (y + s * 0.3) | 0, (s * 0.55) | 0, (s * 0.4) | 0);
    // Head
    ctx.fillRect((x + s * 0.2) | 0, (y + s * 0.1) | 0, (s * 0.4) | 0, (s * 0.3) | 0);
    // Ears (pointed)
    ctx.beginPath();
    ctx.moveTo((x + s * 0.22) | 0, (y + s * 0.15) | 0);
    ctx.lineTo((x + s * 0.18) | 0, y | 0);
    ctx.lineTo((x + s * 0.32) | 0, (y + s * 0.1) | 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo((x + s * 0.48) | 0, (y + s * 0.15) | 0);
    ctx.lineTo((x + s * 0.52) | 0, y | 0);
    ctx.lineTo((x + s * 0.42) | 0, (y + s * 0.1) | 0);
    ctx.fill();
    // Face white patch
    ctx.fillStyle = '#fff5ee';
    ctx.fillRect((x + s * 0.28) | 0, (y + s * 0.2) | 0, (s * 0.24) | 0, (s * 0.18) | 0);
    // Eyes
    ctx.fillStyle = '#4a2a00';
    ctx.fillRect((x + s * 0.28) | 0, (y + s * 0.18) | 0, 2, 2);
    ctx.fillRect((x + s * 0.42) | 0, (y + s * 0.18) | 0, 2, 2);
    // Tail
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect((x + s * 0.7) | 0, (y + s * 0.5) | 0, (s * 0.25) | 0, (s * 0.1) | 0);
    ctx.fillStyle = '#fff5ee';
    ctx.fillRect((x + s * 0.88) | 0, (y + s * 0.48) | 0, (s * 0.1) | 0, (s * 0.14) | 0);
    // Legs
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect((x + s * 0.25) | 0, (y + s * 0.7) | 0, (s * 0.1) | 0, (s * 0.15) | 0);
    ctx.fillRect((x + s * 0.55) | 0, (y + s * 0.7) | 0, (s * 0.1) | 0, (s * 0.15) | 0);
  }

  // ---- Choose button --------------------------------------------------------

  /** Draw a large glowing heart as the confirm icon (no text). */
  _drawConfirmHeart(ctx, index) {
    const comp = COMPANIONS[index];
    const cx = (LOGICAL_WIDTH / 2) | 0;
    const cy = (HEART_ICON_Y + HEART_ICON_SIZE / 2) | 0;
    const pulse = Math.sin(this._introTimer * 3) * 0.5 + 0.5;
    const heartScale = 0.9 + pulse * 0.1;
    const r = (HEART_ICON_SIZE / 2) * heartScale;

    ctx.save();

    // Outer glow ring (companion color)
    ctx.globalAlpha = 0.2 + pulse * 0.15;
    ctx.fillStyle = comp.glowColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Heart shape
    ctx.globalAlpha = 0.85 + pulse * 0.15;
    ctx.fillStyle = '#ff6b8a';
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.5);
    ctx.bezierCurveTo(cx + r * 1.1, cy - r * 0.25, cx + r * 0.6, cy - r * 1.0, cx, cy - r * 0.3);
    ctx.bezierCurveTo(cx - r * 0.6, cy - r * 1.0, cx - r * 1.1, cy - r * 0.25, cx, cy + r * 0.5);
    ctx.fill();

    // Shine on heart
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((cx - r * 0.25) | 0, (cy - r * 0.4) | 0, (r * 0.2) | 0 || 2, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle motes orbiting the heart
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + this._introTimer * 2;
      const sr = r * 1.2 + Math.sin(this._introTimer * 3 + i) * 3;
      const sx = (cx + Math.cos(angle) * sr) | 0;
      const sy = (cy + Math.sin(angle) * sr) | 0;
      ctx.globalAlpha = 0.5 + Math.sin(this._introTimer * 4 + i * 2) * 0.3;
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }

    ctx.restore();
  }

  /** Draw subtle shimmer sparkles on companions that haven't been tapped yet. */
  _drawUntappedShimmers(ctx) {
    for (let i = 0; i < this._companionStates.length; i++) {
      const cs = this._companionStates[i];
      if (cs.tapped || i === this._selectedIndex) continue;
      // During showcase, the showcased companion already has effects
      if (this._showcaseActive && i === this._showcaseIndex) continue;

      const pos = this._positions[i];
      const comp = COMPANIONS[i];

      ctx.save();
      for (let j = 0; j < SHIMMER_PARTICLES; j++) {
        const angle = this._introTimer * SHIMMER_SPEED + j * (Math.PI * 2 / SHIMMER_PARTICLES) + i * 1.3;
        const shimmerR = COMPANION_SIZE * 0.6 + Math.sin(this._introTimer * 2 + j) * 3;
        const sx = (pos.x + Math.cos(angle) * shimmerR) | 0;
        const sy = (pos.y + cs.bobY + Math.sin(angle) * shimmerR) | 0;
        const shimmerAlpha = 0.25 + Math.sin(this._introTimer * 3 + j * 2.1 + i) * 0.2;
        ctx.globalAlpha = shimmerAlpha;
        ctx.fillStyle = comp.glowColor;
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
      ctx.restore();
    }
  }

  // ---- Particles ------------------------------------------------------------

  _emitCompanionParticles(cx, cy, color) {
    let count = 0;
    for (let i = 0; i < this._particles.length && count < 8; i++) {
      const p = this._particles[i];
      if (p.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = 15 + Math.random() * 25;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 10;
      p.life = 0.8 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.color = color;
      p.size = 2;
      count++;
    }
  }

  _emitBurst(cx, cy, color) {
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 20;
      p.life = 1.0 + Math.random() * 0.8;
      p.maxLife = p.life;
      p.color = color;
      p.size = 2 + ((Math.random() * 3) | 0);
    }
  }

  _updateParticles(dt) {
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 15 * dt;
    }
  }

  _drawParticles(ctx) {
    ctx.save();
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (!p.active) continue;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect((p.x - p.size / 2) | 0, (p.y - p.size / 2) | 0, p.size, p.size);
    }
    ctx.restore();
  }

  // ---- Helpers --------------------------------------------------------------

  _playVoice(id) {
    // Route voice lines through the voice system (auto-discovers from voice folder)
    playVoice(id);
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
