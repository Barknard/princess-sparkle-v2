/**
 * CompanionSelectScene.js — Choose your companion friend
 *
 * Five companions in a horizontal arc on a meadow background.
 * Each animates with its idle animation at 3x scale from sprite-anims.json.
 * Big 80x80px tap targets for a 4-year-old.
 *
 * AUTO-NARRATION FLOW:
 *   0-2s:  "Every princess needs a special friend!" (subtitle)
 *   2-4s:  "Tap the one you like!" (subtitle)
 *   15s+:  Auto-select a random companion if no tap
 *
 * ON TAP:  Celebration sparkle burst + subtitle + quick fade to Overworld
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

// Map companion IDs to sprite entity names
const COMP_SPRITES = {
  shimmer: 'unicorn',
  ember: 'dragon',
  petal: 'bunny',
  breeze: 'butterfly',
  pip: 'fox',
};

// Layout
const ARC_CENTER_X = LOGICAL_WIDTH / 2;
const ARC_CENTER_Y = LOGICAL_HEIGHT * 0.48;
const ARC_RADIUS_X = LOGICAL_WIDTH * 0.38;
const ARC_RADIUS_Y = 20;
const TOUCH_SIZE = 80; // 80x80px minimum for 4-year-old fingers

// Auto-narration timing
const NARRATE_INTRO_1 = 0.5;   // "Every princess needs a special friend!"
const NARRATE_INTRO_2 = 3.0;   // "Tap the one you like!"
const AUTO_SELECT_TIME = 15.0; // auto-select random companion after 15s

// Celebration
const CELEBRATION_DURATION = 2.5; // how long celebration plays before transition

// Particles
const MAX_PARTICLES = 60;

// Per-companion confirm lines
const NARRATOR_CONFIRM = {
  shimmer: 'narrator_companion_confirm_shimmer',
  ember:   'narrator_companion_confirm_ember',
  petal:   'narrator_companion_confirm_petal',
  breeze:  'narrator_companion_confirm_breeze',
  pip:     'narrator_companion_confirm_pip',
};

// ---- CompanionSelectScene ---------------------------------------------------

export default class CompanionSelectScene {
  constructor() {
    // Systems
    this._audioManager = null;
    this._sceneManager = null;
    this._saveManager = null;
    this._inputManager = null;
    this._assetLoader = null;
    this._subtitleBar = null;

    // State
    this._selectedIndex = -1;      // chosen companion
    this._confirmed = false;       // celebration + transition in progress
    this._sceneTimer = 0;

    // Narration tracking
    this._narrate1Played = false;
    this._narrate2Played = false;

    // Celebration timer
    this._celebrationTimer = 0;

    // Animation timer (ms) for sprite idle animations
    this._animTimer = 0;

    // Companion visual states (pre-allocated)
    this._companionStates = new Array(COMPANIONS.length);
    for (let i = 0; i < COMPANIONS.length; i++) {
      this._companionStates[i] = {
        scale: 1.0,
        targetScale: 1.0,
        alpha: 1.0,
        targetAlpha: 1.0,
        glowAlpha: 0.3,
        bobTimer: Math.random() * Math.PI * 2,
        bobY: 0,
        enterTimer: 0, // entrance animation timer
      };
    }

    // Pre-calculated positions
    this._positions = new Array(COMPANIONS.length);
    for (let i = 0; i < COMPANIONS.length; i++) {
      const angle = Math.PI + (Math.PI * (i / (COMPANIONS.length - 1)));
      this._positions[i] = {
        x: (ARC_CENTER_X + Math.cos(angle) * ARC_RADIUS_X) | 0,
        y: (ARC_CENTER_Y + Math.sin(angle) * ARC_RADIUS_Y) | 0,
      };
    }

    // Particles
    this._particles = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._particles[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 2 };
    }

    // Transition
    this._transition = new TransitionOverlay();

    // Meadow grass
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
    this._subtitleBar = systems.subtitleBar || null;
  }

  enter() {
    this._selectedIndex = -1;
    this._confirmed = false;
    this._sceneTimer = 0;
    this._animTimer = 0;
    this._narrate1Played = false;
    this._narrate2Played = false;
    this._celebrationTimer = 0;
    this._transition = new TransitionOverlay();

    for (let i = 0; i < this._companionStates.length; i++) {
      const cs = this._companionStates[i];
      cs.scale = 0;            // start small for entrance bounce
      cs.targetScale = 1.0;
      cs.alpha = 1.0;
      cs.targetAlpha = 1.0;
      cs.glowAlpha = 0.3;
      cs.bobTimer = Math.random() * Math.PI * 2;
      cs.bobY = 0;
      cs.enterTimer = 0;
    }

    for (let i = 0; i < this._particles.length; i++) {
      this._particles[i].active = false;
    }

    // Preload voice lines
    preloadVoices(SCENE_VOICES.companionSelect);
  }

  exit() {
    if (this._subtitleBar) {
      this._subtitleBar.hide();
    }
  }

  // ---- Update ---------------------------------------------------------------

  update(dt) {
    this._transition.update(dt);
    if (this._transition.active) return;

    this._sceneTimer += dt;
    this._animTimer += dt * 1000; // convert to ms for sprite frame calc

    // ---- Entrance animations (companions bounce in) ----
    for (let i = 0; i < this._companionStates.length; i++) {
      const cs = this._companionStates[i];
      const entranceDelay = i * 0.15; // stagger by 150ms each

      if (this._sceneTimer > entranceDelay && cs.enterTimer < 0.5) {
        cs.enterTimer = Math.min(cs.enterTimer + dt, 0.5);
        cs.scale = easeOutBack(cs.enterTimer / 0.5);
      }
    }

    // ---- Auto-narration ----
    if (!this._narrate1Played && this._sceneTimer >= NARRATE_INTRO_1) {
      this._narrate1Played = true;
      if (this._subtitleBar) {
        this._subtitleBar.show('Every princess needs a special friend!');
      }
      playVoice('narrator_companion_intro_01');
    }

    if (!this._narrate2Played && this._sceneTimer >= NARRATE_INTRO_2) {
      this._narrate2Played = true;
      if (this._subtitleBar) {
        this._subtitleBar.show('Tap the one you like best!');
      }
      playVoice('narrator_companion_intro_02');
    }

    // ---- Auto-select after 15s if no tap ----
    if (!this._confirmed && this._selectedIndex < 0 && this._sceneTimer >= AUTO_SELECT_TIME) {
      const randomIndex = (Math.random() * COMPANIONS.length) | 0;
      this._selectCompanion(randomIndex);
    }

    // ---- Handle input (tap to select) ----
    if (!this._confirmed && this._inputManager && this._inputManager.tapped) {
      this._handleInput();
    }

    // ---- Companion idle animations ----
    for (let i = 0; i < this._companionStates.length; i++) {
      const cs = this._companionStates[i];
      cs.bobTimer += dt;

      // Gentle bob
      const bobSpeed = 2.0 + i * 0.3;
      cs.bobY = Math.sin(cs.bobTimer * bobSpeed) * 3;

      // Smooth scale interpolation
      cs.scale += (cs.targetScale - cs.scale) * Math.min(dt * 6, 1);
      cs.alpha += (cs.targetAlpha - cs.alpha) * Math.min(dt * 6, 1);
    }

    // ---- Celebration → transition to Overworld ----
    if (this._confirmed) {
      this._celebrationTimer += dt;

      // Pulsing glow on selected companion
      if (this._selectedIndex >= 0) {
        const cs = this._companionStates[this._selectedIndex];
        cs.glowAlpha = 0.5 + Math.sin(this._celebrationTimer * 5) * 0.3;
      }

      if (this._celebrationTimer >= CELEBRATION_DURATION && !this._transition.active) {
        this._transition.start('iris', {
          duration: 800,
          onHalf: () => {
            // Save companion choice
            if (this._saveManager) {
              this._saveManager.setCompanion(COMPANIONS[this._selectedIndex].id);
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

  // ---- Input ----------------------------------------------------------------

  _handleInput() {
    const tx = this._inputManager.x;
    const ty = this._inputManager.y;

    for (let i = 0; i < this._positions.length; i++) {
      const pos = this._positions[i];
      const halfTouch = TOUCH_SIZE / 2;
      if (tx >= pos.x - halfTouch && tx <= pos.x + halfTouch &&
          ty >= pos.y - halfTouch && ty <= pos.y + halfTouch) {
        this._selectCompanion(i);
        return;
      }
    }
  }

  _selectCompanion(index) {
    if (this._confirmed) return;

    this._selectedIndex = index;
    this._confirmed = true;
    this._celebrationTimer = 0;

    const comp = COMPANIONS[index];

    // Grow selected companion, dim others
    for (let i = 0; i < this._companionStates.length; i++) {
      if (i === index) {
        this._companionStates[i].targetScale = 1.5;
        this._companionStates[i].targetAlpha = 1.0;
        this._companionStates[i].glowAlpha = 0.8;
      } else {
        this._companionStates[i].targetAlpha = 0.3;
        this._companionStates[i].targetScale = 0.8;
      }
    }

    // Sparkle burst
    const pos = this._positions[index];
    this._emitBurst(pos.x, pos.y, comp.glowColor);

    // Show celebration subtitle
    if (this._subtitleBar) {
      this._subtitleBar.show(`You chose ${comp.name}! What a wonderful friend!`);
    }

    // Play confirm voice + companion voice
    playVoice(NARRATOR_CONFIRM[comp.id]);

    // SFX
    if (this._audioManager) {
      this._audioManager.playSFX('evolution');
    }
  }

  // ---- Draw -----------------------------------------------------------------

  draw(renderer) {
    const ctx = renderer.ctx;

    // Background meadow
    this._drawMeadow(ctx);

    // Draw all companions
    for (let i = 0; i < COMPANIONS.length; i++) {
      this._drawCompanion(ctx, i);
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
      const sway = Math.sin(g.phase + this._sceneTimer * 1.5) * 2;
      ctx.fillRect((g.x + sway) | 0, g.y | 0, 1, g.h);
    }

    // Small flowers
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

    // Get the sprite scale from config (3x)
    const configScale = spriteSheets.getScale() || 3;
    const drawScale = cs.scale * configScale;
    const spriteFrameSize = 16; // base sprite frame size (16x16)
    const size = (spriteFrameSize * drawScale) | 0;
    const halfSize = (size / 2) | 0;
    const cx = pos.x | 0;
    const cy = (pos.y + cs.bobY) | 0;

    ctx.save();
    ctx.globalAlpha = cs.alpha;

    // Colored glow behind companion
    ctx.save();
    ctx.globalAlpha = cs.alpha * Math.max(0, Math.min(1, cs.glowAlpha));
    ctx.fillStyle = comp.glowColor;
    ctx.beginPath();
    ctx.arc(cx, cy, (halfSize + 6) | 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = cs.alpha;

    // Draw sprite (animated idle or fallback placeholder)
    const lx = (cx - halfSize) | 0;
    const ly = (cy - halfSize) | 0;

    const spriteName = COMP_SPRITES[comp.id];
    if (spriteName && spriteSheets.loaded && spriteSheets.hasAnimSheet(spriteName)) {
      // Animated idle: get current frame from animation timer
      const idleFrame = spriteSheets.getAnimFrame(this._animTimer, false, spriteName);
      spriteSheets.drawIdleFrame(ctx, spriteName, idleFrame, lx, ly, false, drawScale);
    } else if (spriteName && spriteSheets.loaded && spriteSheets.getSpriteRect(spriteName)) {
      // Static sprite fallback
      spriteSheets.draw(ctx, spriteName, lx, ly, { scale: drawScale });
    } else {
      // Procedural placeholder
      this._drawPlaceholder(ctx, comp.id, lx, ly, size);
    }

    // Name label below companion (small, warm)
    ctx.font = '7px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#5a3a1a';
    ctx.globalAlpha = cs.alpha * 0.8;
    ctx.fillText(comp.name, cx, cy + halfSize + 4);

    // Shimmer sparkles on unselected companions (inviting taps)
    if (this._selectedIndex < 0 && !this._confirmed) {
      const shimmerCount = 3;
      for (let j = 0; j < shimmerCount; j++) {
        const angle = this._sceneTimer * 2.5 + j * (Math.PI * 2 / shimmerCount) + index * 1.3;
        const shimmerR = halfSize + 4 + Math.sin(this._sceneTimer * 2 + j) * 3;
        const sx = (cx + Math.cos(angle) * shimmerR) | 0;
        const sy = (cy + Math.sin(angle) * shimmerR) | 0;
        const shimmerAlpha = 0.25 + Math.sin(this._sceneTimer * 3 + j * 2.1 + index) * 0.2;
        ctx.globalAlpha = shimmerAlpha;
        ctx.fillStyle = comp.glowColor;
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
    }

    ctx.restore();
  }

  // ---- Placeholder drawings (when sprites not loaded) ----------------------

  _drawPlaceholder(ctx, compId, x, y, size) {
    switch (compId) {
      case 'shimmer': this._drawShimmer(ctx, x, y, size); break;
      case 'ember':   this._drawEmber(ctx, x, y, size); break;
      case 'petal':   this._drawPetal(ctx, x, y, size); break;
      case 'breeze':  this._drawBreeze(ctx, x, y, size); break;
      case 'pip':     this._drawPip(ctx, x, y, size); break;
    }
  }

  _drawShimmer(ctx, x, y, size) {
    const s = size;
    ctx.fillStyle = '#fff0f5';
    ctx.fillRect((x + s * 0.2) | 0, (y + s * 0.3) | 0, (s * 0.6) | 0, (s * 0.5) | 0);
    ctx.fillRect((x + s * 0.3) | 0, (y + s * 0.1) | 0, (s * 0.35) | 0, (s * 0.3) | 0);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect((x + s * 0.44) | 0, y | 0, (s * 0.08) | 0, (s * 0.15) | 0);
    ctx.fillStyle = '#fff0f5';
    ctx.fillRect((x + s * 0.25) | 0, (y + s * 0.8) | 0, (s * 0.1) | 0, (s * 0.2) | 0);
    ctx.fillRect((x + s * 0.6) | 0, (y + s * 0.8) | 0, (s * 0.1) | 0, (s * 0.2) | 0);
    ctx.fillStyle = '#4a4a8a';
    ctx.fillRect((x + s * 0.4) | 0, (y + s * 0.2) | 0, 2, 2);
    ctx.fillStyle = '#ffb3d9';
    ctx.fillRect((x + s * 0.55) | 0, (y + s * 0.1) | 0, (s * 0.12) | 0, (s * 0.25) | 0);
  }

  _drawEmber(ctx, x, y, size) {
    const s = size;
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect((x + s * 0.25) | 0, (y + s * 0.2) | 0, (s * 0.5) | 0, (s * 0.5) | 0);
    ctx.fillRect((x + s * 0.3) | 0, (y + s * 0.05) | 0, (s * 0.4) | 0, (s * 0.25) | 0);
    ctx.fillStyle = '#ff9966';
    ctx.fillRect((x + s * 0.1) | 0, (y + s * 0.2) | 0, (s * 0.15) | 0, (s * 0.2) | 0);
    ctx.fillRect((x + s * 0.75) | 0, (y + s * 0.2) | 0, (s * 0.15) | 0, (s * 0.2) | 0);
    ctx.fillStyle = '#ffe0b2';
    ctx.fillRect((x + s * 0.35) | 0, (y + s * 0.4) | 0, (s * 0.3) | 0, (s * 0.25) | 0);
    ctx.fillStyle = '#4a4a00';
    ctx.fillRect((x + s * 0.35) | 0, (y + s * 0.12) | 0, 2, 2);
    ctx.fillRect((x + s * 0.55) | 0, (y + s * 0.12) | 0, 2, 2);
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect((x + s * 0.7) | 0, (y + s * 0.65) | 0, (s * 0.2) | 0, (s * 0.08) | 0);
  }

  _drawPetal(ctx, x, y, size) {
    const s = size;
    ctx.fillStyle = '#f5f5dc';
    ctx.fillRect((x + s * 0.25) | 0, (y + s * 0.35) | 0, (s * 0.5) | 0, (s * 0.45) | 0);
    ctx.fillRect((x + s * 0.3) | 0, (y + s * 0.15) | 0, (s * 0.4) | 0, (s * 0.3) | 0);
    ctx.fillStyle = '#ffb6c1';
    ctx.fillRect((x + s * 0.32) | 0, y | 0, (s * 0.1) | 0, (s * 0.2) | 0);
    ctx.fillRect((x + s * 0.55) | 0, y | 0, (s * 0.1) | 0, (s * 0.2) | 0);
    ctx.fillStyle = '#4a2a2a';
    ctx.fillRect((x + s * 0.38) | 0, (y + s * 0.25) | 0, 2, 2);
    ctx.fillRect((x + s * 0.55) | 0, (y + s * 0.25) | 0, 2, 2);
    ctx.fillStyle = '#ffb6c1';
    ctx.fillRect((x + s * 0.47) | 0, (y + s * 0.32) | 0, 2, 1);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc((x + s * 0.75) | 0, (y + s * 0.6) | 0, (s * 0.06) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBreeze(ctx, x, y, size) {
    const s = size;
    ctx.fillStyle = '#87ceeb';
    ctx.beginPath();
    ctx.ellipse((x + s * 0.25) | 0, (y + s * 0.4) | 0, (s * 0.22) | 0, (s * 0.3) | 0, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse((x + s * 0.75) | 0, (y + s * 0.4) | 0, (s * 0.22) | 0, (s * 0.3) | 0, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0f0ff';
    ctx.beginPath();
    ctx.arc((x + s * 0.25) | 0, (y + s * 0.4) | 0, (s * 0.08) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc((x + s * 0.75) | 0, (y + s * 0.4) | 0, (s * 0.08) | 0 || 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a5acd';
    ctx.fillRect((x + s * 0.45) | 0, (y + s * 0.25) | 0, (s * 0.1) | 0, (s * 0.4) | 0);
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
    const s = size;
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect((x + s * 0.2) | 0, (y + s * 0.3) | 0, (s * 0.55) | 0, (s * 0.4) | 0);
    ctx.fillRect((x + s * 0.2) | 0, (y + s * 0.1) | 0, (s * 0.4) | 0, (s * 0.3) | 0);
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
    ctx.fillStyle = '#fff5ee';
    ctx.fillRect((x + s * 0.28) | 0, (y + s * 0.2) | 0, (s * 0.24) | 0, (s * 0.18) | 0);
    ctx.fillStyle = '#4a2a00';
    ctx.fillRect((x + s * 0.28) | 0, (y + s * 0.18) | 0, 2, 2);
    ctx.fillRect((x + s * 0.42) | 0, (y + s * 0.18) | 0, 2, 2);
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect((x + s * 0.7) | 0, (y + s * 0.5) | 0, (s * 0.25) | 0, (s * 0.1) | 0);
    ctx.fillStyle = '#fff5ee';
    ctx.fillRect((x + s * 0.88) | 0, (y + s * 0.48) | 0, (s * 0.1) | 0, (s * 0.14) | 0);
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect((x + s * 0.25) | 0, (y + s * 0.7) | 0, (s * 0.1) | 0, (s * 0.15) | 0);
    ctx.fillRect((x + s * 0.55) | 0, (y + s * 0.7) | 0, (s * 0.1) | 0, (s * 0.15) | 0);
  }

  // ---- Particles ------------------------------------------------------------

  _emitBurst(cx, cy, color) {
    const burstColors = [color, '#ffd700', '#fffacd', '#ffffff', color];
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
      p.color = burstColors[(Math.random() * burstColors.length) | 0];
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
