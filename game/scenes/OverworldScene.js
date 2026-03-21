/**
 * OverworldScene.js — Main game scene for Princess Sparkle V2
 *
 * Renders TileMap layers: ground -> objects -> entities -> foreground.
 * Updates: Player movement, Companion follow, NPC wander, ParticleSystem, Camera.
 * Handles tap input: check interactable first (NPC, object), then pathfind.
 * Manages world interactables, ambient animals, silly moments.
 * Session time tracking with sky color gradient shifts.
 * Ambient world life: grass sway, floating sparkles, butterflies,
 *   flower bloom on tap, water shimmer, companion trail, day-night tint.
 *
 * Canvas only. No DOM. Integer coordinates for pixel art.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import HUD from '../ui/HUD.js';
import QuestIndicatorPool from '../ui/QuestIndicator.js';
import TransitionOverlay from '../ui/TransitionOverlay.js';
import { playVoice, preloadVoices, SCENE_VOICES } from '../data/voiceIndex.js';
import spriteSheets from '../data/SpriteSheetManager.js';
import Player from '../entities/Player.js';
import Companion from '../entities/Companion.js';
import QuestSystem from '../systems/QuestSystem.js';
import sparkleVillage from '../levels/level-sparkle-village.js';

// ---- Easing -----------------------------------------------------------------

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  // c1, c2 are {r,g,b}
  return {
    r: (lerp(c1.r, c2.r, t)) | 0,
    g: (lerp(c1.g, c2.g, t)) | 0,
    b: (lerp(c1.b, c2.b, t)) | 0,
  };
}

function colorToHex(c) {
  return '#' + ((1 << 24) + (c.r << 16) + (c.g << 8) + c.b).toString(16).slice(1);
}

// ---- Session time thresholds (seconds) --------------------------------------

const SESSION_SUNSET_S = 15 * 60;    // 15 minutes
const SESSION_EVENING_S = 18 * 60;   // 18 minutes
const SESSION_WINDDOWN_S = 20 * 60;  // 20 minutes

// ---- Sky palettes -----------------------------------------------------------

const SKY_MORNING = {
  top:    { r: 170, g: 221, b: 255 },  // #aaddff
  bottom: { r: 255, g: 214, b: 232 },  // #ffd6e8
};
const SKY_SUNSET = {
  top:    { r: 255, g: 180, b: 120 },  // warm orange
  bottom: { r: 200, g: 160, b: 200 },  // soft lavender
};
const SKY_EVENING = {
  top:    { r: 60, g: 40, b: 90 },     // deep purple
  bottom: { r: 100, g: 80, b: 140 },   // soft purple
};

// ---- Ambient animal pool ----------------------------------------------------

const MAX_AMBIENT_ANIMALS = 16;

// ---- Silly moment timer -----------------------------------------------------

const SILLY_MIN_INTERVAL_S = 45;
const SILLY_MAX_INTERVAL_S = 75;

// ---- Interactable object pool -----------------------------------------------

const MAX_INTERACTABLES = 30;

// ---- Particle pool ----------------------------------------------------------

const MAX_PARTICLES = 64;

// ---- Ambient sparkle pool ---------------------------------------------------

const MAX_AMBIENT_SPARKLES = 15;

// ---- Ambient butterfly pool -------------------------------------------------

const MAX_BUTTERFLIES = 3;
const BUTTERFLY_COLORS = ['#ff69b4', '#ff4444', '#ffaa00', '#44cc44', '#4488ff', '#aa44ff', '#ff88cc'];

// ---- Companion trail --------------------------------------------------------

const COMPANION_TRAIL_INTERVAL = 8; // emit 1 particle every 8 frames

// ---- Day-night tint thresholds (minutes) ------------------------------------
// Morning: 0-15min = no tint
// Sunset: 15-18min = warm orange at 10% opacity
// Evening: 18-20min = purple at 15% opacity

// ---- Grass tile IDs that should sway (common Kenney grass range) ------------
// Grass tiles in the Kenney 1-bit pack are typically in the 0-20 range.
// We'll detect grass tiles by checking the ground layer for known IDs.
const GRASS_TILE_IDS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

// Water/pond tile IDs (common Kenney water range)
const WATER_TILE_IDS = new Set([104, 105, 106, 107, 108, 109, 110, 111, 112]);

// Flower tile IDs in the object layer
const FLOWER_TILE_IDS = new Set([48, 49, 50, 51, 52, 53, 54, 55, 56]);

// ---- OverworldScene ---------------------------------------------------------

export default class OverworldScene {
  constructor() {
    // Engine systems (set in init)
    this._audioManager = null;
    this._sceneManager = null;
    this._saveManager = null;
    this._inputManager = null;
    this._assetLoader = null;

    // World systems (set externally or via init)
    this._tileMap = null;        // TileMap instance
    this._player = null;         // Player entity
    this._companion = null;      // Companion entity
    this._questSystem = null;    // QuestSystem
    this._camera = null;         // Camera

    // UI
    this._hud = new HUD();
    this._questIndicators = new QuestIndicatorPool();
    this._transition = new TransitionOverlay();

    // Session timer (total seconds in this session)
    this._sessionTime = 0;
    this._timeOfDay = 'morning'; // 'morning' | 'sunset' | 'evening'
    this._sunsetNotified = false;
    this._eveningNotified = false;

    // Sky gradient (interpolated based on session time)
    this._skyTopColor = { ...SKY_MORNING.top };
    this._skyBottomColor = { ...SKY_MORNING.bottom };

    // Level dialogue data (loaded from level file)
    this._dialogues = null;

    // NPCs
    /** @type {Array<{id: string, x: number, y: number, sprite: any, hasQuest: boolean, indicator: any, wanderTimer: number, wanderTarget: {x:number,y:number}|null}>} */
    this._npcs = [];

    // Interactable world objects
    /** @type {Array<{id: string, type: string, x: number, y: number, w: number, h: number, active: boolean, cooldown: number}>} */
    this._interactables = new Array(MAX_INTERACTABLES);
    for (let i = 0; i < MAX_INTERACTABLES; i++) {
      this._interactables[i] = { id: '', type: '', x: 0, y: 0, w: 16, h: 16, active: false, cooldown: 0 };
    }

    // Ambient animals
    /** @type {Array<{type: string, x: number, y: number, vx: number, vy: number, active: boolean, animTimer: number, state: string}>} */
    this._animals = new Array(MAX_AMBIENT_ANIMALS);
    for (let i = 0; i < MAX_AMBIENT_ANIMALS; i++) {
      this._animals[i] = { type: '', x: 0, y: 0, vx: 0, vy: 0, active: false, animTimer: 0, state: 'idle' };
    }

    // Silly moment system
    this._sillyTimer = this._nextSillyInterval();
    this._activeSillyMoment = null;
    this._sillyMomentTimer = 0;

    // Particles
    this._particles = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this._particles[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#fff', size: 2 };
    }

    // Companion hint timer (5s of standing still = companion looks toward interest)
    this._idleTimer = 0;
    this._hintShown = false;
    this._companionLookTarget = null;  // {x, y} of nearest interesting thing

    // First quest completed flag (for HUD visibility)
    this._firstQuestDone = false;

    // First visit tutorial sequence
    this._isFirstVisit = true;
    this._autoWalkTriggered = false;
    this._autoWalkTimer = 0;

    // Tutorial sequence state machine
    // Steps: 0=wait (<1s), 1=narrator "This is Sparkle Village!",
    //        2=camera pan to Grandma, 3=narrator "See that sparkle?",
    //        4=camera pan back to player, 5=sparkle trail to Grandma,
    //        6=companion encouragement, 7=done
    this._tutorialStep = 0;
    this._tutorialTimer = 0;
    this._tutorialCameraPanActive = false;
    this._tutorialCameraPanTimer = 0;
    this._tutorialCameraPanDuration = 2.5; // seconds for camera pan
    this._tutorialCameraStartX = 0;
    this._tutorialCameraStartY = 0;
    this._tutorialCameraTargetX = 0;
    this._tutorialCameraTargetY = 0;
    this._tutorialSparkleTrail = new Array(10);
    for (let i = 0; i < 10; i++) {
      this._tutorialSparkleTrail[i] = { active: false, x: 0, y: 0, alpha: 0, timer: 0, delay: 0 };
    }
    this._tutorialSparkleTrailFadeTimer = 0; // lingers after tutorial ends
    this._tutorialSparkleTrailFading = false;

    // Idle nudge system — companion bounce + sparkle burst if player hasn't moved
    this._idleNudgeTimer = 0;
    this._idleNudgeFirstInterval = 10; // first nudge after 10s
    this._idleNudgeRepeatInterval = 15; // repeat every 15s
    this._idleNudgeCount = 0;
    this._idleNudgeActive = false; // true while bounce animation plays
    this._idleNudgeBounceTimer = 0;
    this._playerHasMoved = false; // set true on first player movement

    // Camera position (smooth follow)
    this._camX = 0;
    this._camY = 0;

    // Proximity sparkle system for interactables (3-tile range = 48px)
    this._proximitySparkleTimer = 0;

    // Quest path breadcrumb sparkles
    this._breadcrumbs = new Array(16);
    for (let i = 0; i < 16; i++) {
      this._breadcrumbs[i] = { active: false, x: 0, y: 0, alpha: 0, timer: 0 };
    }

    // ---- Ambient world life state -------------------------------------------

    // Floating ambient sparkles (always present in overworld)
    this._ambientSparkles = new Array(MAX_AMBIENT_SPARKLES);
    for (let i = 0; i < MAX_AMBIENT_SPARKLES; i++) {
      this._ambientSparkles[i] = {
        active: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 0,
        size: 1, alpha: 1, color: '#ffffff'
      };
    }
    this._sparkleSpawnTimer = 0;

    // Ambient butterflies
    this._butterflies = new Array(MAX_BUTTERFLIES);
    for (let i = 0; i < MAX_BUTTERFLIES; i++) {
      this._butterflies[i] = {
        active: false, x: 0, y: 0, baseY: 0,
        vx: 0, phase: 0, color: '#ff69b4', life: 0
      };
    }
    this._butterflySpawnTimer = 0;

    // Water shimmer timer
    this._waterShimmerTimer = 0;
    this._waterShimmerPhase = 0; // 0 or 1, toggles every 600ms

    // Companion trail frame counter
    this._companionTrailFrame = 0;

    // Flower bloom tap particles (separate from main particles for burst effect)
    this._bloomParticles = new Array(16);
    for (let i = 0; i < 16; i++) {
      this._bloomParticles[i] = {
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 0, color: '#ff69b4', size: 2
      };
    }

    // Global elapsed time for ambient animations (grass sway, etc.)
    this._worldTime = 0;

    // ---- Tap feedback state -------------------------------------------------

    // Tap ripple effect (golden expanding circle at tap position)
    this._tapRipple = null; // { x, y, timer, duration }

    // Destination marker (pulsing circle where the princess is walking to)
    this._destMarker = null; // { x, y, timer }

    // Movement path sparkle dots (3-4 dots from princess to destination)
    this._pathDots = new Array(4);
    for (let i = 0; i < 4; i++) {
      this._pathDots[i] = { active: false, x: 0, y: 0, timer: 0, passed: false };
    }

    // Canvas reference for cursor changes (set in draw)
    this._canvas = null;
  }

  // ---- Lifecycle ------------------------------------------------------------

  /**
   * @param {object} systems
   */
  init(systems) {
    this._audioManager = systems.audioManager || null;
    this._sceneManager = systems.sceneManager || null;
    this._saveManager = systems.saveManager || null;
    this._inputManager = systems.inputManager || null;
    this._assetLoader = systems.assetLoader || null;

    // Wire up tilemap from game systems (loaded in main.js with Kenney tileset)
    this._tileMap = systems.tileMap || null;
    this._player = systems.player || null;
    this._companion = systems.companion || null;
    this._questSystem = systems.questSystem || null;
    this._camera = systems.camera || null;
  }

  enter() {
    this._sessionTime = 0;
    this._timeOfDay = 'morning';
    this._sunsetNotified = false;
    this._eveningNotified = false;
    this._skyTopColor = { ...SKY_MORNING.top };
    this._skyBottomColor = { ...SKY_MORNING.bottom };
    this._sillyTimer = this._nextSillyInterval();
    this._activeSillyMoment = null;
    this._idleTimer = 0;
    this._hintShown = false;
    this._companionLookTarget = null;
    this._autoWalkTriggered = false;
    this._autoWalkTimer = 0;
    this._tutorialStep = 0;
    this._tutorialTimer = 0;
    this._tutorialCameraPanActive = false;
    this._tutorialCameraPanTimer = 0;
    this._tutorialSparkleTrailFadeTimer = 0;
    this._tutorialSparkleTrailFading = false;
    this._idleNudgeTimer = 0;
    this._idleNudgeCount = 0;
    this._idleNudgeActive = false;
    this._idleNudgeBounceTimer = 0;
    this._playerHasMoved = false;
    this._proximitySparkleTimer = 0;
    this._transition = new TransitionOverlay();

    // Reset breadcrumbs
    if (this._breadcrumbs) {
      for (let i = 0; i < this._breadcrumbs.length; i++) {
        this._breadcrumbs[i].active = false;
      }
    }

    // Reset particle pool
    for (let i = 0; i < this._particles.length; i++) {
      this._particles[i].active = false;
    }

    // Reset ambient sparkles
    for (let i = 0; i < this._ambientSparkles.length; i++) {
      this._ambientSparkles[i].active = false;
    }
    this._sparkleSpawnTimer = 0;

    // Reset butterflies
    for (let i = 0; i < this._butterflies.length; i++) {
      this._butterflies[i].active = false;
    }
    this._butterflySpawnTimer = 0;

    // Reset bloom particles
    for (let i = 0; i < this._bloomParticles.length; i++) {
      this._bloomParticles[i].active = false;
    }

    // Reset water shimmer
    this._waterShimmerTimer = 0;
    this._waterShimmerPhase = 0;

    // Reset companion trail counter
    this._companionTrailFrame = 0;

    // Reset world time
    this._worldTime = 0;

    // Reset tap feedback
    this._tapRipple = null;
    this._destMarker = null;
    for (let i = 0; i < this._pathDots.length; i++) {
      this._pathDots[i].active = false;
    }

    // Load real sprite sheets (async, non-blocking — placeholders show until loaded)
    spriteSheets.load().then(() => {
      console.log('OverworldScene: Sprite sheets loaded');
    }).catch(err => {
      console.warn('OverworldScene: Sprite sheet load error (using placeholders):', err);
    });

    // Create Player if not provided by external systems
    if (!this._player) {
      this._player = new Player();
    }

    // Create Companion if not provided by external systems
    if (!this._companion) {
      // Try to get companion choice from save data
      let companionName = 'Shimmer';
      let companionSprite = 'unicorn';
      if (this._saveManager) {
        const savedId = this._saveManager.get('companionId');
        if (savedId) {
          companionName = savedId.charAt(0).toUpperCase() + savedId.slice(1);
          const spriteMap = {
            shimmer: 'unicorn', ember: 'dragon', breeze: 'butterfly',
            petal: 'bunny', pip: 'fox'
          };
          companionSprite = spriteMap[savedId] || 'unicorn';
        }
      }
      this._companion = new Companion(companionName, companionSprite);
    }

    // Create QuestSystem if not provided
    if (!this._questSystem) {
      this._questSystem = new QuestSystem();
    }

    // Load level data (NPCs, interactables, animals) from level file
    this._loadWorldObjects();

    // Preload voice lines for village arrival
    preloadVoices(SCENE_VOICES.villageArrival);

    // Play morning ambience
    if (this._audioManager) {
      this._audioManager.playBGM('bgm_village_morning');
    }
  }

  exit() {
    this._questIndicators.releaseAll();
  }

  // ---- Update ---------------------------------------------------------------

  /**
   * @param {number} dt — seconds
   */
  update(dt) {
    this._transition.update(dt);
    if (this._transition.active) return;

    // Session time
    this._sessionTime += dt;
    this._updateTimeOfDay(dt);

    // Player movement
    this._updatePlayer(dt);

    // Companion follow
    this._updateCompanion(dt);

    // NPCs (wander AI)
    this._updateNPCs(dt);

    // Ambient animals
    this._updateAnimals(dt);

    // Interactable cooldowns
    for (let i = 0; i < this._interactables.length; i++) {
      const obj = this._interactables[i];
      if (obj.active && obj.cooldown > 0) {
        obj.cooldown -= dt;
        if (obj.cooldown < 0) obj.cooldown = 0;
      }
    }

    // Silly moments
    this._updateSillyMoments(dt);

    // Particles
    this._updateParticles(dt);

    // Ambient world life
    this._worldTime += dt;
    this._updateAmbientSparkles(dt);
    this._updateButterflies(dt);
    this._updateWaterShimmer(dt);
    this._updateCompanionTrail(dt);
    this._updateBloomParticles(dt);

    // Quest indicators
    this._questIndicators.update(dt);

    // Camera follow player
    this._updateCamera(dt);

    // HUD
    this._hud.update(dt);

    // Idle hint timer (companion looks toward interest after 5s)
    this._updateIdleHint(dt);

    // Proximity sparkle for nearby interactables
    this._updateProximitySparkles(dt);

    // Quest path breadcrumbs
    this._updateBreadcrumbs(dt);

    // First visit: tutorial sequence guides player to Grandma Rose
    this._updateAutoWalkDemo(dt);

    // Idle nudge — companion bounce if player hasn't moved
    this._updateIdleNudge(dt);

    // Tap feedback (ripple, destination marker, path dots)
    this._updateTapFeedback(dt);

    // Handle input
    this._handleInput();

    // Cursor feedback (desktop hover)
    this._updateCursorFeedback();

    // Check wind-down trigger
    if (this._sessionTime >= SESSION_WINDDOWN_S) {
      this._triggerWindDown();
    }
  }

  // ---- Time of day ----------------------------------------------------------

  _updateTimeOfDay(dt) {
    let t = 0;
    if (this._sessionTime < SESSION_SUNSET_S) {
      // Morning
      this._timeOfDay = 'morning';
      t = this._sessionTime / SESSION_SUNSET_S;
      this._skyTopColor = lerpColor(SKY_MORNING.top, SKY_SUNSET.top, t * 0.3);
      this._skyBottomColor = lerpColor(SKY_MORNING.bottom, SKY_SUNSET.bottom, t * 0.3);
    } else if (this._sessionTime < SESSION_EVENING_S) {
      // Sunset
      if (!this._sunsetNotified) {
        this._sunsetNotified = true;
        this._onSunsetBegins();
      }
      this._timeOfDay = 'sunset';
      t = (this._sessionTime - SESSION_SUNSET_S) / (SESSION_EVENING_S - SESSION_SUNSET_S);
      this._skyTopColor = lerpColor(SKY_SUNSET.top, SKY_EVENING.top, t);
      this._skyBottomColor = lerpColor(SKY_SUNSET.bottom, SKY_EVENING.bottom, t);
    } else {
      // Evening
      if (!this._eveningNotified) {
        this._eveningNotified = true;
        this._onEveningBegins();
      }
      this._timeOfDay = 'evening';
      this._skyTopColor = { ...SKY_EVENING.top };
      this._skyBottomColor = { ...SKY_EVENING.bottom };
    }
  }

  _onSunsetBegins() {
    if (this._audioManager) {
      this._audioManager.playBGM('bgm_village_sunset');
    }
    // Companion: "The sun is getting sleepy!" — voice line, use voice system
    playVoice('narrator_sunset_01');
  }

  _onEveningBegins() {
    if (this._audioManager) {
      this._audioManager.playBGM('bgm_village_evening');
    }
    // Companion: "What a wonderful day!" — voice line, use voice system
    playVoice('narrator_winddown_recap');
  }

  // ---- Player ---------------------------------------------------------------

  _updatePlayer(dt) {
    if (this._player) {
      this._player.update(dt);
    }
  }

  // ---- Companion ------------------------------------------------------------

  _updateCompanion(dt) {
    if (this._companion && this._player) {
      // update() handles follow internally when player is passed
      this._companion.update(dt, this._player);
    }
  }

  // ---- NPCs -----------------------------------------------------------------

  _updateNPCs(dt) {
    for (let i = 0; i < this._npcs.length; i++) {
      const npc = this._npcs[i];
      npc.wanderTimer -= dt;

      if (npc.wanderTimer <= 0 && npc.wanderTarget === null) {
        // Pick new wander target near home position (within 3 tiles)
        const range = 48; // 3 tiles
        const homeX = npc.homeX || npc.x;
        const homeY = npc.homeY || npc.y;
        npc.wanderTarget = {
          x: homeX + (Math.random() - 0.5) * range * 2,
          y: homeY + (Math.random() - 0.5) * range * 2,
        };
        npc.wanderTimer = 3 + Math.random() * 5;
      }

      // Simple move toward wander target
      if (npc.wanderTarget) {
        const dx = npc.wanderTarget.x - npc.x;
        const dy = npc.wanderTarget.y - npc.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const speed = 16; // px/s (slow NPC wander)
          npc.x += (dx / dist) * speed * dt;
          npc.y += (dy / dist) * speed * dt;
          // Flip sprite based on horizontal movement direction
          if (Math.abs(dx) > Math.abs(dy)) {
            npc.flipX = dx < 0;
          }
        } else {
          npc.wanderTarget = null;
        }
      }

      // Advance animation timer for idle bob
      npc.animTimer = (npc.animTimer || 0) + dt * 1000;
    }
  }

  // ---- Animals --------------------------------------------------------------

  _updateAnimals(dt) {
    for (let i = 0; i < this._animals.length; i++) {
      const a = this._animals[i];
      if (!a.active) continue;

      a.animTimer += dt * 1000;

      // Zone-based wandering: pick a new target when idle, move toward it
      if (!a.wanderTarget) {
        // Pause before picking a new target
        a.wanderPause = (a.wanderPause || 0) - dt;
        if (a.wanderPause <= 0) {
          // Pick a random point within the animal's zone (or near home)
          const homeX = a.homeX || a.x;
          const homeY = a.homeY || a.y;
          const range = (a.zoneW || 4) * 16;
          const rangeY = (a.zoneH || 3) * 16;
          a.wanderTarget = {
            x: homeX + (Math.random() - 0.5) * range,
            y: homeY + (Math.random() - 0.5) * rangeY,
          };
        }
      }

      if (a.wanderTarget) {
        const dx = a.wanderTarget.x - a.x;
        const dy = a.wanderTarget.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const speed = 12; // px/s (slow animal wander)
          a.vx = (dx / dist) * speed;
          a.vy = (dy / dist) * speed;
          a.x += a.vx * dt;
          a.y += a.vy * dt;
        } else {
          // Reached target, pause before next wander
          a.wanderTarget = null;
          a.wanderPause = 2 + Math.random() * 4;
          a.vx = 0;
          a.vy = 0;
          a.state = 'idle';
        }
      }

      // Track facing direction based on velocity
      if (Math.abs(a.vx) > 0.1) {
        a.flipX = a.vx < 0;
      }
    }
  }

  // ---- Silly moments --------------------------------------------------------

  _updateSillyMoments(dt) {
    if (this._activeSillyMoment) {
      this._sillyMomentTimer += dt;
      if (this._sillyMomentTimer > 5) {
        this._activeSillyMoment = null;
      }
      return;
    }

    this._sillyTimer -= dt;
    if (this._sillyTimer <= 0) {
      this._triggerSillyMoment();
      this._sillyTimer = this._nextSillyInterval();
    }
  }

  _triggerSillyMoment() {
    const moments = [
      'baker_drops_pie', 'squirrel_steals_hat', 'cat_in_way',
      'grandma_glasses', 'finn_kite', 'duck_parade',
      'sneeze_chain', 'sleeping_baker', 'butterfly_nose', 'wrong_way_npc',
    ];
    this._activeSillyMoment = moments[(Math.random() * moments.length) | 0];
    this._sillyMomentTimer = 0;

    // Play a random silly SFX from the available set
    if (this._audioManager) {
      const sillySfx = ['whoops', 'sneeze', 'bonk'];
      this._audioManager.playSFX(sillySfx[(Math.random() * sillySfx.length) | 0]);
    }
  }

  _nextSillyInterval() {
    return SILLY_MIN_INTERVAL_S + Math.random() * (SILLY_MAX_INTERVAL_S - SILLY_MIN_INTERVAL_S);
  }

  // ---- Particles ------------------------------------------------------------

  _updateParticles(dt) {
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 15 * dt; // gentle gravity
    }
  }

  _emitParticles(cx, cy, color, count) {
    let emitted = 0;
    for (let i = 0; i < this._particles.length && emitted < count; i++) {
      const p = this._particles[i];
      if (p.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 30;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 15;
      p.life = 0.6 + Math.random() * 0.5;
      p.maxLife = p.life;
      p.color = color;
      p.size = 2;
      emitted++;
    }
  }

  // ---- Camera ---------------------------------------------------------------

  _updateCamera(dt) {
    if (!this._player) return;

    // During tutorial camera pan, skip normal follow (pan is handled by tutorial)
    if (this._tutorialCameraPanActive) {
      // Clamp to world bounds even during pan
      if (this._tileMap) {
        const worldW = this._tileMap.widthPx || LOGICAL_WIDTH;
        const worldH = this._tileMap.heightPx || LOGICAL_HEIGHT;
        this._camX = Math.max(0, Math.min(this._camX, worldW - LOGICAL_WIDTH));
        this._camY = Math.max(0, Math.min(this._camY, worldH - LOGICAL_HEIGHT));
      }
      return;
    }

    const targetX = this._player.x - LOGICAL_WIDTH / 2;
    const targetY = this._player.y - LOGICAL_HEIGHT / 2;

    // Smooth camera follow
    this._camX += (targetX - this._camX) * Math.min(dt * 4, 1);
    this._camY += (targetY - this._camY) * Math.min(dt * 4, 1);

    // Clamp to world bounds
    if (this._tileMap) {
      const worldW = this._tileMap.widthPx || LOGICAL_WIDTH;
      const worldH = this._tileMap.heightPx || LOGICAL_HEIGHT;
      this._camX = Math.max(0, Math.min(this._camX, worldW - LOGICAL_WIDTH));
      this._camY = Math.max(0, Math.min(this._camY, worldH - LOGICAL_HEIGHT));
    }
  }

  // ---- Idle hint ------------------------------------------------------------

  _updateIdleHint(dt) {
    if (this._player && this._player.isMoving) {
      this._idleTimer = 0;
      this._hintShown = false;
      this._companionLookTarget = null;
      return;
    }

    this._idleTimer += dt;

    // After 5 seconds idle: companion looks toward the nearest interesting thing
    if (this._idleTimer >= 5 && !this._companionLookTarget) {
      this._companionLookTarget = this._findNearestInterest();
    }

    // After 15 seconds idle: companion gives a voice hint
    if (this._idleTimer >= 15 && !this._hintShown) {
      this._hintShown = true;
      // Use voice system for companion hint line
      playVoice('companion_village_shimmer_01');
    }
  }

  /** Find the nearest NPC with quest or sparkly interactable to the player. */
  _findNearestInterest() {
    if (!this._player) return null;
    const px = this._player.x;
    const py = this._player.y;
    let bestDist = Infinity;
    let bestPos = null;

    // Check NPCs with quests
    for (let i = 0; i < this._npcs.length; i++) {
      const npc = this._npcs[i];
      if (!npc.hasQuest) continue;
      const d = Math.hypot(npc.x - px, npc.y - py);
      if (d < bestDist) { bestDist = d; bestPos = { x: npc.x, y: npc.y }; }
    }

    // Check active interactables
    for (let i = 0; i < this._interactables.length; i++) {
      const obj = this._interactables[i];
      if (!obj.active) continue;
      const ox = obj.x + obj.w / 2;
      const oy = obj.y + obj.h / 2;
      const d = Math.hypot(ox - px, oy - py);
      if (d < bestDist) { bestDist = d; bestPos = { x: ox, y: oy }; }
    }

    return bestPos;
  }

  /**
   * First-visit tutorial sequence — guides the player on what to do.
   *
   * Steps:
   *   0: Wait <1s for scene to settle
   *   1: Narrator: "This is Sparkle Village!" (narrator_village_arrive_01)
   *   2: Camera smoothly pans to Grandma Rose with glowing quest "!" (2.5s)
   *   3: Narrator: "See that sparkle? That means someone needs help!" (narrator_village_quest_hint_01)
   *   4: Camera pans back to player
   *   5: Sparkle trail of golden diamonds appears from player toward Grandma
   *   6: Companion says something encouraging
   *   7: Tutorial done — normal gameplay resumes
   */
  _updateAutoWalkDemo(dt) {
    if (!this._isFirstVisit) {
      // Even after tutorial ends, keep fading the sparkle trail gracefully
      if (this._tutorialSparkleTrailFading) {
        this._tutorialSparkleTrailFadeTimer += dt;
        this._updateTutorialSparkleTrail(dt);
        if (this._tutorialSparkleTrailFadeTimer >= 3.0) {
          this._tutorialSparkleTrailFading = false;
          for (let i = 0; i < this._tutorialSparkleTrail.length; i++) {
            this._tutorialSparkleTrail[i].active = false;
          }
          console.log('[Tutorial] Sparkle trail fade-out complete');
        }
      }
      return;
    }

    // If tutorial is complete, skip
    if (this._tutorialStep >= 7) return;

    this._tutorialTimer += dt;

    switch (this._tutorialStep) {
      case 0: {
        // Log once to confirm tutorial is executing
        if (this._tutorialTimer < dt * 2) {
          console.log('[Tutorial] Tutorial system active — waiting 0.8s before starting');
        }
        // Wait <1s for the scene to settle in (requirement: within 1 second)
        if (this._tutorialTimer >= 0.8) {
          this._tutorialStep = 1;
          this._tutorialTimer = 0;

          // Step 1: Narrator welcome voice
          console.log('[Tutorial] Step 1: Narrator — "This is Sparkle Village!"');
          playVoice('narrator_village_arrive_01');
        }
        break;
      }

      case 1: {
        // Wait for narrator line to finish (~3s estimated), then pan camera to Grandma
        if (this._tutorialTimer >= 3.0) {
          this._tutorialStep = 2;
          this._tutorialTimer = 0;

          // Step 2: Camera pan to Grandma Rose
          console.log('[Tutorial] Step 2: Camera pan to Grandma Rose');
          const started = this._startTutorialCameraPan();
          if (!started) {
            console.warn('[Tutorial] WARN: Could not find Grandma Rose NPC — skipping pan');
            // Skip to step 5 (sparkle trail) if Grandma not found
            this._tutorialStep = 5;
          }
        }
        break;
      }

      case 2: {
        // Camera pan to Grandma is active
        this._updateTutorialCameraPan(dt);

        if (!this._tutorialCameraPanActive) {
          // Pan completed — hold for 1.0s so player sees Grandma + quest indicator,
          // then narrator explains the sparkle
          if (this._tutorialTimer >= 1.0) {
            this._tutorialStep = 3;
            this._tutorialTimer = 0;

            // Step 3: Narrator explains the quest indicator
            console.log('[Tutorial] Step 3: Narrator — "See that sparkle? That means someone needs help!"');
            playVoice('narrator_village_quest_hint_01');
          }
        }
        break;
      }

      case 3: {
        // Wait for narrator "See that sparkle?" line (~3s), then pan camera back
        if (this._tutorialTimer >= 3.0) {
          this._tutorialStep = 4;
          this._tutorialTimer = 0;

          // Step 4: Pan camera back to player
          console.log('[Tutorial] Step 4: Camera pan back to player');
          this._startTutorialCameraPanBack();
        }
        break;
      }

      case 4: {
        // Camera panning back to player
        this._updateTutorialCameraPan(dt);

        if (!this._tutorialCameraPanActive && this._tutorialTimer >= 0.5) {
          this._tutorialStep = 5;
          this._tutorialTimer = 0;

          // Step 5: Sparkle trail toward Grandma
          console.log('[Tutorial] Step 5: Sparkle trail of golden diamonds to Grandma');
          this._createSparkleTrailToGrandma();

          // Play a gentle sparkle trail SFX
          if (this._audioManager) {
            this._audioManager.playSFX('trailShimmer');
          }
        }
        break;
      }

      case 5: {
        // Update sparkle trail animation
        this._updateTutorialSparkleTrail(dt);

        // After 1.5s, companion says something encouraging
        if (this._tutorialTimer >= 1.5) {
          this._tutorialStep = 6;
          this._tutorialTimer = 0;

          // Step 6: Companion encouragement
          console.log('[Tutorial] Step 6: Companion encouragement');
          this._playCompanionVillageVoice();
        }
        break;
      }

      case 6: {
        // Keep updating sparkle trail while companion speaks
        this._updateTutorialSparkleTrail(dt);

        // After companion line (~2.5s) or if player taps (starts moving), end the tutorial
        const playerMoving = this._player && this._player.state === 'WALKING';
        if (this._tutorialTimer >= 3.0 || playerMoving) {
          this._tutorialStep = 7;
          this._isFirstVisit = false; // tutorial is done
          this._autoWalkTriggered = true;

          // Start sparkle trail fade-out instead of abrupt removal
          this._tutorialSparkleTrailFading = true;
          this._tutorialSparkleTrailFadeTimer = 0;

          console.log('[Tutorial] Complete — player is free to explore');
        }
        break;
      }
    }
  }

  /**
   * Find Grandma Rose NPC and start a smooth camera pan to her position.
   * @returns {boolean} true if pan was started, false if Grandma not found
   */
  _startTutorialCameraPan() {
    const grandma = this._npcs.find(n => n.id === 'grandma-rose');
    if (!grandma || !this._player) {
      // No Grandma found — skip to next step
      console.warn('[Tutorial] _startTutorialCameraPan: grandma-rose NPC not found in', this._npcs.map(n => n.id));
      this._tutorialCameraPanActive = false;
      return false;
    }

    console.log(`[Tutorial] Camera pan: from (${this._camX|0}, ${this._camY|0}) to Grandma at (${grandma.x|0}, ${grandma.y|0})`);

    this._tutorialCameraPanActive = true;
    this._tutorialCameraPanTimer = 0;
    this._tutorialCameraStartX = this._camX;
    this._tutorialCameraStartY = this._camY;
    // Target: center camera on Grandma
    this._tutorialCameraTargetX = grandma.x - LOGICAL_WIDTH / 2;
    this._tutorialCameraTargetY = grandma.y - LOGICAL_HEIGHT / 2;

    // Clamp target to world bounds
    if (this._tileMap) {
      const worldW = this._tileMap.widthPx || LOGICAL_WIDTH;
      const worldH = this._tileMap.heightPx || LOGICAL_HEIGHT;
      this._tutorialCameraTargetX = Math.max(0, Math.min(this._tutorialCameraTargetX, worldW - LOGICAL_WIDTH));
      this._tutorialCameraTargetY = Math.max(0, Math.min(this._tutorialCameraTargetY, worldH - LOGICAL_HEIGHT));
    }

    return true;
  }

  /**
   * Pan camera back from Grandma to player.
   */
  _startTutorialCameraPanBack() {
    if (!this._player) return;

    console.log(`[Tutorial] Camera pan back: from (${this._camX|0}, ${this._camY|0}) to player at (${this._player.x|0}, ${this._player.y|0})`);

    this._tutorialCameraPanActive = true;
    this._tutorialCameraPanTimer = 0;
    this._tutorialCameraStartX = this._camX;
    this._tutorialCameraStartY = this._camY;
    // Target: center camera on player
    this._tutorialCameraTargetX = this._player.x - LOGICAL_WIDTH / 2;
    this._tutorialCameraTargetY = this._player.y - LOGICAL_HEIGHT / 2;

    // Clamp target to world bounds
    if (this._tileMap) {
      const worldW = this._tileMap.widthPx || LOGICAL_WIDTH;
      const worldH = this._tileMap.heightPx || LOGICAL_HEIGHT;
      this._tutorialCameraTargetX = Math.max(0, Math.min(this._tutorialCameraTargetX, worldW - LOGICAL_WIDTH));
      this._tutorialCameraTargetY = Math.max(0, Math.min(this._tutorialCameraTargetY, worldH - LOGICAL_HEIGHT));
    }
  }

  /**
   * Smoothly interpolate camera during tutorial pan.
   */
  _updateTutorialCameraPan(dt) {
    if (!this._tutorialCameraPanActive) return;

    this._tutorialCameraPanTimer += dt;
    const t = Math.min(this._tutorialCameraPanTimer / this._tutorialCameraPanDuration, 1);
    const ease = easeInOutCubic(t);

    this._camX = lerp(this._tutorialCameraStartX, this._tutorialCameraTargetX, ease);
    this._camY = lerp(this._tutorialCameraStartY, this._tutorialCameraTargetY, ease);

    if (t >= 1) {
      this._tutorialCameraPanActive = false;
      this._tutorialTimer = 0; // reset timer for the hold/wait after pan
    }
  }

  /**
   * Play the companion's village arrival voice based on which companion was chosen.
   */
  _playCompanionVillageVoice() {
    if (!this._companion) return;

    const name = (this._companion.name || 'shimmer').toLowerCase();
    const voiceId = `companion_village_${name}_01`;
    console.log(`[Tutorial] Companion voice: ${voiceId}`);
    playVoice(voiceId);
  }

  /**
   * Create a sparkle trail from the player toward Grandma Rose.
   * Uses the _tutorialSparkleTrail array.
   */
  _createSparkleTrailToGrandma() {
    const grandma = this._npcs.find(n => n.id === 'grandma-rose');
    if (!grandma || !this._player) {
      console.warn('[Tutorial] _createSparkleTrailToGrandma: grandma or player missing', { grandma: !!grandma, player: !!this._player });
      return;
    }
    console.log(`[Tutorial] Creating sparkle trail: player(${this._player.x|0}, ${this._player.y|0}) -> grandma(${grandma.x|0}, ${grandma.y|0})`);

    const sx = this._player.x;
    const sy = this._player.y;
    const gx = grandma.x;
    const gy = grandma.y;
    const count = this._tutorialSparkleTrail.length;

    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1); // evenly spaced from player to grandma
      const sparkle = this._tutorialSparkleTrail[i];
      sparkle.active = true;
      sparkle.x = lerp(sx, gx, t);
      sparkle.y = lerp(sy, gy, t);
      sparkle.alpha = 0;
      sparkle.timer = 0;
      sparkle.delay = i * 0.15; // staggered appearance for trail effect
    }

    // Also set breadcrumb path for the quest breadcrumb system
    const points = [];
    for (let i = 0; i < count; i++) {
      if (this._tutorialSparkleTrail[i].active) {
        points.push({ x: this._tutorialSparkleTrail[i].x, y: this._tutorialSparkleTrail[i].y });
      }
    }
    this.setBreadcrumbPath(points);
  }

  /**
   * Animate the tutorial sparkle trail (twinkling gold diamonds from player to Grandma).
   */
  _updateTutorialSparkleTrail(dt) {
    for (let i = 0; i < this._tutorialSparkleTrail.length; i++) {
      const s = this._tutorialSparkleTrail[i];
      if (!s.active) continue;

      s.timer += dt;
      if (s.timer < s.delay) continue; // not visible yet

      const localTime = s.timer - s.delay;

      // If fading out, multiply alpha by fade factor
      let fadeMult = 1;
      if (this._tutorialSparkleTrailFading) {
        fadeMult = Math.max(0, 1 - this._tutorialSparkleTrailFadeTimer / 3.0);
      }

      // Fade in, then twinkle
      if (localTime < 0.3) {
        s.alpha = (localTime / 0.3) * fadeMult; // fade in
      } else {
        s.alpha = (0.5 + Math.sin(localTime * 4 + i * 0.8) * 0.4) * fadeMult; // twinkle
      }
    }
  }

  /**
   * Idle nudge system — if the player hasn't moved after spawning,
   * the companion does a bounce + sparkle burst pointing toward Grandma.
   * First nudge at 10s, then repeats every 15s until the player moves.
   */
  _updateIdleNudge(dt) {
    // Track whether the player has ever moved
    if (!this._playerHasMoved && this._player) {
      if (this._player.state === 'WALKING' || this._player.isMoving) {
        this._playerHasMoved = true;
        this._idleNudgeActive = false;
        console.log('[IdleNudge] Player moved — nudge system deactivated');
        return;
      }
    }

    // Once the player has moved, stop nudging
    if (this._playerHasMoved) return;

    // Don't nudge during the tutorial sequence
    if (this._isFirstVisit && this._tutorialStep < 7) return;

    this._idleNudgeTimer += dt;

    // Determine the threshold for the next nudge
    const threshold = this._idleNudgeCount === 0
      ? this._idleNudgeFirstInterval
      : this._idleNudgeRepeatInterval;

    if (this._idleNudgeTimer >= threshold && !this._idleNudgeActive) {
      // Trigger a nudge
      this._idleNudgeActive = true;
      this._idleNudgeBounceTimer = 0;
      this._idleNudgeCount++;

      console.log(`[IdleNudge] Nudge #${this._idleNudgeCount} — companion bounce + sparkle burst`);

      // Emit sparkle burst from companion position toward Grandma
      if (this._companion) {
        const cx = this._companion.x || 0;
        const cy = this._companion.y || 0;
        const grandma = this._npcs.find(n => n.id === 'grandma-rose');

        // Sparkle burst: directional particles pointing toward Grandma
        if (grandma) {
          const dx = grandma.x - cx;
          const dy = grandma.y - cy;
          const dist = Math.hypot(dx, dy);
          const dirX = dist > 0 ? dx / dist : 0;
          const dirY = dist > 0 ? dy / dist : 0;

          // Emit 6-8 directional sparkle particles
          let emitted = 0;
          for (let i = 0; i < this._particles.length && emitted < 8; i++) {
            const p = this._particles[i];
            if (p.active) continue;
            const spread = (Math.random() - 0.5) * 0.6; // slight spread
            const speed = 35 + Math.random() * 25;
            p.active = true;
            p.x = cx;
            p.y = cy - 4;
            p.vx = (dirX + spread) * speed;
            p.vy = (dirY + spread) * speed - 10;
            p.life = 0.8 + Math.random() * 0.4;
            p.maxLife = p.life;
            p.color = ['#ffd700', '#ffb6c1', '#ffe066', '#ff69b4'][emitted % 4];
            p.size = 3;
            emitted++;
          }
        } else {
          // No Grandma — just burst in a random upward direction
          this._emitParticles(cx, cy - 4, '#ffd700', 6);
        }

        // Play a subtle SFX
        if (this._audioManager) {
          this._audioManager.playSFX('sparkle');
        }
      }
    }

    // Animate the bounce (0.6s bounce animation)
    if (this._idleNudgeActive) {
      this._idleNudgeBounceTimer += dt;
      if (this._idleNudgeBounceTimer >= 0.6) {
        this._idleNudgeActive = false;
        this._idleNudgeTimer = 0; // reset for next interval
      }
    }
  }

  /**
   * Get the companion's idle nudge bounce Y offset.
   * Returns a Y pixel offset (negative = up) during the bounce animation.
   */
  _getIdleNudgeBounceOffset() {
    if (!this._idleNudgeActive) return 0;
    // Two quick bounces over 0.6s
    const t = this._idleNudgeBounceTimer / 0.6;
    // First bounce at t=0.25, second at t=0.65
    return -Math.abs(Math.sin(t * Math.PI * 3)) * 6; // 6px max bounce height
  }

  /** Emit sparkle particles on interactables within 3 tiles (48px) of the player. */
  _updateProximitySparkles(dt) {
    if (!this._player) return;
    this._proximitySparkleTimer += dt;
    if (this._proximitySparkleTimer < 0.8) return; // emit every 0.8s
    this._proximitySparkleTimer = 0;

    const px = this._player.x;
    const py = this._player.y;
    const range = 48; // 3 tiles

    for (let i = 0; i < this._interactables.length; i++) {
      const obj = this._interactables[i];
      if (!obj.active || obj.cooldown > 0) continue;
      const ox = obj.x + obj.w / 2;
      const oy = obj.y + obj.h / 2;
      const dist = Math.hypot(ox - px, oy - py);
      if (dist < range) {
        this._emitParticles(ox, oy - 4, '#ffd700', 2);
      }
    }
  }

  /** Update quest path breadcrumb sparkles. */
  _updateBreadcrumbs(dt) {
    for (let i = 0; i < this._breadcrumbs.length; i++) {
      const bc = this._breadcrumbs[i];
      if (!bc.active) continue;
      bc.timer += dt;
      bc.alpha = 0.3 + Math.sin(bc.timer * 3 + i) * 0.2;
      if (bc.timer > 5) bc.active = false;
    }
  }

  /**
   * Place breadcrumb sparkles along a path to guide the player visually.
   * Called by QuestSystem or externally when a quest objective changes.
   * @param {Array<{x:number,y:number}>} points — world positions along the path
   */
  setBreadcrumbPath(points) {
    for (let i = 0; i < this._breadcrumbs.length; i++) {
      if (i < points.length) {
        const bc = this._breadcrumbs[i];
        bc.active = true;
        bc.x = points[i].x;
        bc.y = points[i].y;
        bc.alpha = 0.3;
        bc.timer = i * 0.2; // stagger so they twinkle in sequence
      } else {
        this._breadcrumbs[i].active = false;
      }
    }
  }

  // ---- Ambient World Life: Floating Sparkles --------------------------------

  _updateAmbientSparkles(dt) {
    // Spawn new sparkles periodically
    this._sparkleSpawnTimer += dt;
    if (this._sparkleSpawnTimer >= 0.2) { // try to spawn every 0.2s
      this._sparkleSpawnTimer = 0;
      this._spawnAmbientSparkle();
    }

    // Update existing sparkles
    for (let i = 0; i < this._ambientSparkles.length; i++) {
      const s = this._ambientSparkles[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) { s.active = false; continue; }
      s.y += s.vy * dt;
      // Gentle horizontal drift
      s.x += Math.sin(this._worldTime * 2 + i * 1.3) * 0.15;
      // Fade out gently in the last 30% of life
      s.alpha = s.life < (s.maxLife * 0.3) ? (s.life / (s.maxLife * 0.3)) : 1.0;
    }
  }

  _spawnAmbientSparkle() {
    for (let i = 0; i < this._ambientSparkles.length; i++) {
      const s = this._ambientSparkles[i];
      if (s.active) continue;
      s.active = true;
      // Spawn randomly across the visible screen area (in world coords)
      s.x = this._camX + Math.random() * LOGICAL_WIDTH;
      s.y = this._camY + LOGICAL_HEIGHT * 0.3 + Math.random() * LOGICAL_HEIGHT * 0.7;
      s.vy = -8 - Math.random() * 6; // slow upward drift (px/sec)
      s.life = 2.0 + Math.random() * 1.0; // 2-3 seconds
      s.maxLife = s.life;
      s.size = 1 + Math.random(); // 1-2px
      // White or gold sparkle
      s.color = Math.random() < 0.6 ? '#ffffff' : '#ffd700';
      return;
    }
  }

  // ---- Ambient World Life: Butterflies -------------------------------------

  _updateButterflies(dt) {
    this._butterflySpawnTimer += dt;
    if (this._butterflySpawnTimer >= 3.0) { // check every 3s
      this._butterflySpawnTimer = 0;
      this._spawnButterfly();
    }

    for (let i = 0; i < this._butterflies.length; i++) {
      const b = this._butterflies[i];
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) { b.active = false; continue; }
      // Horizontal drift
      b.x += b.vx * dt;
      // Sine-wave vertical flight
      b.phase += dt * 2.5;
      b.y = b.baseY + Math.sin(b.phase) * 12;
      // Slow descent of the base path
      b.baseY += 2 * dt;
      // Deactivate if offscreen
      if (b.x < this._camX - 20 || b.x > this._camX + LOGICAL_WIDTH + 20) {
        b.active = false;
      }
    }
  }

  _spawnButterfly() {
    // Count active butterflies
    let activeCount = 0;
    for (let i = 0; i < this._butterflies.length; i++) {
      if (this._butterflies[i].active) activeCount++;
    }
    if (activeCount >= MAX_BUTTERFLIES) return;

    for (let i = 0; i < this._butterflies.length; i++) {
      const b = this._butterflies[i];
      if (b.active) continue;
      b.active = true;
      // Spawn from left or right edge
      const fromLeft = Math.random() < 0.5;
      b.x = fromLeft ? (this._camX - 10) : (this._camX + LOGICAL_WIDTH + 10);
      b.baseY = this._camY + 30 + Math.random() * (LOGICAL_HEIGHT * 0.5);
      b.y = b.baseY;
      b.vx = fromLeft ? (12 + Math.random() * 8) : -(12 + Math.random() * 8);
      b.phase = Math.random() * Math.PI * 2;
      b.color = BUTTERFLY_COLORS[(Math.random() * BUTTERFLY_COLORS.length) | 0];
      b.life = 8 + Math.random() * 6; // 8-14 seconds to cross
      return;
    }
  }

  // ---- Ambient World Life: Water Shimmer -----------------------------------

  _updateWaterShimmer(dt) {
    this._waterShimmerTimer += dt;
    if (this._waterShimmerTimer >= 0.6) {
      this._waterShimmerTimer -= 0.6;
      this._waterShimmerPhase = 1 - this._waterShimmerPhase;
    }
  }

  // ---- Ambient World Life: Companion Trail ---------------------------------

  _updateCompanionTrail(dt) {
    if (!this._companion) return;
    this._companionTrailFrame++;
    if (this._companionTrailFrame < COMPANION_TRAIL_INTERVAL) return;
    this._companionTrailFrame = 0;

    // Only emit if companion is moving
    const c = this._companion;
    const dx = (c.x || 0) - (c.prevX || 0);
    const dy = (c.y || 0) - (c.prevY || 0);
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

    // Emit trail particle based on companion type
    const trailConfig = this._getCompanionTrailConfig();
    if (trailConfig) {
      this._emitParticles(
        (c.x || 0), (c.y || 0),
        trailConfig.color, trailConfig.count
      );
    }
  }

  _getCompanionTrailConfig() {
    if (!this._companion) return null;
    const name = (this._companion.name || '').toLowerCase();
    switch (name) {
      case 'shimmer':
        return { color: '#ff99ee', count: 1 }; // rainbow sparkle
      case 'ember':
        return { color: '#ffaa00', count: 1 }; // warm golden sparks
      case 'petal':
        return { color: '#ffccff', count: 1 }; // flower petals
      case 'breeze':
        return { color: '#aaddff', count: 1 }; // wish dust
      case 'pip':
        return { color: '#ffdd44', count: 1 }; // musical notes
      default:
        return { color: '#ffffff', count: 1 };
    }
  }

  // ---- Ambient World Life: Bloom Particles (flower tap burst) ---------------

  _updateBloomParticles(dt) {
    for (let i = 0; i < this._bloomParticles.length; i++) {
      const p = this._bloomParticles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 20 * dt; // gentle arc (gravity)
    }
  }

  _emitBloomParticles(cx, cy, flowerColor) {
    const colors = flowerColor || ['#ff6688', '#ffcc44', '#ff99cc', '#ff4466'];
    let emitted = 0;
    for (let i = 0; i < this._bloomParticles.length && emitted < 4; i++) {
      const p = this._bloomParticles[i];
      if (p.active) continue;
      const angle = (emitted / 4) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 25 + Math.random() * 15;
      p.active = true;
      p.x = cx;
      p.y = cy;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 20; // arc upward
      p.life = 0.8;
      p.maxLife = 0.8;
      p.color = Array.isArray(colors) ? colors[emitted % colors.length] : colors;
      p.size = 2;
      emitted++;
    }
  }

  // ---- Input ----------------------------------------------------------------

  _handleInput() {
    if (!this._inputManager || !this._inputManager.tapped) return;

    const tx = this._inputManager.x;
    const ty = this._inputManager.y;

    // Convert screen tap to world coordinates
    const worldX = tx + this._camX;
    const worldY = ty + this._camY;

    // Reset idle timer on any tap
    this._idleTimer = 0;
    this._hintShown = false;

    // Tap ripple feedback at every tap position
    this._tapRipple = { x: worldX, y: worldY, timer: 0, duration: 0.4 };

    // 1. Check NPC interactions first
    for (let i = 0; i < this._npcs.length; i++) {
      const npc = this._npcs[i];
      if (Math.hypot(worldX - npc.x, worldY - npc.y) < 20) {
        this._onNPCTapped(npc);
        return;
      }
    }

    // 2. Check interactable objects
    for (let i = 0; i < this._interactables.length; i++) {
      const obj = this._interactables[i];
      if (!obj.active || obj.cooldown > 0) continue;
      if (worldX >= obj.x && worldX <= obj.x + obj.w &&
          worldY >= obj.y && worldY <= obj.y + obj.h) {
        this._onInteractableTapped(obj);
        return;
      }
    }

    // 3. Check ambient animals
    for (let i = 0; i < this._animals.length; i++) {
      const a = this._animals[i];
      if (!a.active) continue;
      if (Math.hypot(worldX - a.x, worldY - a.y) < 16) {
        this._onAnimalTapped(a);
        return;
      }
    }

    // 4. Check if tapping near a flower tile (object layer) for bloom effect
    if (this._tileMap && this._tileMap.objectLayer) {
      const tileX = (worldX / 16) | 0;
      const tileY = (worldY / 16) | 0;
      const tileId = this._tileMap.getTileAt('objects', tileX, tileY);
      if (tileId >= 0 && FLOWER_TILE_IDS.has(tileId)) {
        this._emitBloomParticles(
          tileX * 16 + 8, tileY * 16 + 8,
          ['#ff6688', '#ffcc44', '#6699ff', '#ff99cc']
        );
      }
    }

    // 5. Pathfind to tap position
    if (this._player) {
      this._player.moveTo(worldX, worldY);

      // Set destination marker
      this._destMarker = { x: worldX, y: worldY, timer: 0 };

      // Set path sparkle dots (4 evenly spaced dots from player to destination)
      const startX = this._player.x;
      const startY = this._player.y;
      for (let i = 0; i < this._pathDots.length; i++) {
        const t = (i + 1) / (this._pathDots.length + 1);
        this._pathDots[i].active = true;
        this._pathDots[i].x = startX + (worldX - startX) * t;
        this._pathDots[i].y = startY + (worldY - startY) * t;
        this._pathDots[i].timer = 0;
        this._pathDots[i].passed = false;
      }
    }
  }

  _onNPCTapped(npc) {
    // Walk toward the NPC first, then interact
    if (this._player) {
      const dist = Math.hypot(npc.x - this._player.x, npc.y - this._player.y);
      if (dist > 24) {
        // Walk closer before interacting
        const dx = npc.x - this._player.x;
        const dy = npc.y - this._player.y;
        const d = Math.hypot(dx, dy);
        const targetX = npc.x - (dx / d) * 20;
        const targetY = npc.y - (dy / d) * 20;
        this._player.moveTo(targetX, targetY);
      }
    }

    // Determine which dialogue to show
    let dialogueId = null;

    // Check if this NPC has an available quest via QuestSystem
    if (this._questSystem) {
      const questId = this._questSystem.getAvailableQuestForNPC(npc.id);
      if (questId) {
        // Start the quest
        const stage = this._questSystem.startQuest(questId);
        if (stage && stage.dialogueId) {
          dialogueId = stage.dialogueId;
        }
      }
    }

    // No quest — use greeting dialogue
    if (!dialogueId) {
      const npcDef = sparkleVillage.npcs ? sparkleVillage.npcs.find(n => n.id === npc.id) : null;
      dialogueId = npcDef ? npcDef.dialogueId : null;
    }

    // Convert dialogue tree to flat lines array for DialogueScene
    if (dialogueId && this._dialogues && this._dialogues[dialogueId]) {
      const lines = this._dialogueTreeToLines(this._dialogues[dialogueId]);
      if (lines.length > 0 && this._sceneManager) {
        this._sceneManager.pushOverlay('Dialogue', {
          npcId: npc.id,
          lines: lines,
        });
      }
    } else {
      // Fallback: ambient voice line
      playVoice('npc_' + npc.id + '_greeting_01');
    }

    // Emit sparkle particles around NPC on interaction
    this._emitParticles(npc.x, npc.y - 8, '#ffb6c1', 4);
  }

  /**
   * Convert a dialogue tree (startId + nodes) into a flat array of lines
   * for DialogueScene consumption.
   * @param {object} dialogueTree - { startId, nodes: { id: { voiceId, portrait, text, next, ... } } }
   * @returns {Array<object>} Flat array of line objects
   */
  _dialogueTreeToLines(dialogueTree) {
    const lines = [];
    if (!dialogueTree || !dialogueTree.startId || !dialogueTree.nodes) return lines;

    let currentId = dialogueTree.startId;
    const visited = new Set(); // prevent infinite loops

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const node = dialogueTree.nodes[currentId];
      if (!node) break;

      lines.push({
        voiceId: node.voiceId || null,
        portrait: null,
        portraitSrc: node.portrait || null,
        text: node.text || '',
        name: node.name || '',
        expression: node.expression || 'neutral',
        choices: node.choices || null,
        duration: null, // let voice system determine
      });

      currentId = node.next;
    }

    return lines;
  }

  _onInteractableTapped(obj) {
    obj.cooldown = 2; // 2 seconds before can tap again

    // Emit particles at object
    this._emitParticles(obj.x + obj.w / 2, obj.y, '#ffd700', 6);

    // Flower bloom burst: 3-4 petal particles in flower colors
    const flowerTypes = ['flower', 'FLOWER_SMALL', 'FLOWER_BIG'];
    if (flowerTypes.indexOf(obj.type) >= 0 || (obj.type && obj.type.toLowerCase().indexOf('flower') >= 0)) {
      const petalColors = ['#ff6688', '#ffcc44', '#6699ff', '#ff99cc'];
      this._emitBloomParticles(obj.x + obj.w / 2, obj.y + obj.h / 2, petalColors);
    }

    // Play corresponding SFX — map object type to actual sfxIndex keys
    if (this._audioManager) {
      const tapSfxMap = {
        flower: 'flowerTap',
        water:  'waterPlop',
        tree:   'treeRustle',
        mailbox: 'mailbox',
        mushroom: 'mushroomBoing',
        crystal: 'crystalTone',
      };
      this._audioManager.playSFX(tapSfxMap[obj.type] || 'flowerTap');
    }
  }

  _onAnimalTapped(animal) {
    // Animal reaction — map animal type to actual sfxIndex keys
    if (this._audioManager) {
      const animalSfxMap = {
        cat: 'catPurr',
        dog: 'dogBark',
        bird: 'birdTweet',
        frog: 'frogRibbit',
        duck: 'duckQuack',
        butterfly: 'trailShimmer',
      };
      this._audioManager.playSFX(animalSfxMap[animal.type] || 'birdTweet');
    }

    // Small particle burst
    this._emitParticles(animal.x, animal.y, '#ffb6c1', 4);
  }

  // ---- Tap Feedback Systems -------------------------------------------------

  _updateTapFeedback(dt) {
    // Update tap ripple timer
    if (this._tapRipple) {
      this._tapRipple.timer += dt;
      if (this._tapRipple.timer >= this._tapRipple.duration) {
        this._tapRipple = null;
      }
    }

    // Update destination marker timer
    if (this._destMarker) {
      this._destMarker.timer += dt;
      // Remove destination marker when player arrives (or after 10s safety timeout)
      if (this._player && !this._player.isMoving) {
        this._destMarker = null;
      }
      if (this._destMarker && this._destMarker.timer > 10) {
        this._destMarker = null;
      }
    }

    // Update path dots — fade out as princess passes them
    if (this._player) {
      const px = this._player.x;
      const py = this._player.y;
      for (let i = 0; i < this._pathDots.length; i++) {
        const dot = this._pathDots[i];
        if (!dot.active) continue;
        dot.timer += dt;
        // Mark as passed when princess is within 8px
        if (!dot.passed && Math.hypot(dot.x - px, dot.y - py) < 8) {
          dot.passed = true;
        }
        // Fade out quickly after being passed
        if (dot.passed && dot.timer > 0.3) {
          dot.active = false;
        }
        // Also deactivate all dots when player stops moving
        if (!this._player.isMoving) {
          dot.active = false;
        }
      }
    }
  }

  _updateCursorFeedback() {
    if (!this._canvas || !this._inputManager) return;

    // Use cursorX/cursorY which track the mouse continuously (desktop only)
    const mx = this._inputManager.cursorX;
    const my = this._inputManager.cursorY;
    if (mx === undefined || my === undefined) return;

    const worldX = mx + this._camX;
    const worldY = my + this._camY;

    // Check NPCs
    for (let i = 0; i < this._npcs.length; i++) {
      const npc = this._npcs[i];
      if (Math.hypot(worldX - npc.x, worldY - npc.y) < 20) {
        this._canvas.style.cursor = 'pointer';
        return;
      }
    }

    // Check interactables
    for (let i = 0; i < this._interactables.length; i++) {
      const obj = this._interactables[i];
      if (!obj.active || obj.cooldown > 0) continue;
      if (worldX >= obj.x && worldX <= obj.x + obj.w &&
          worldY >= obj.y && worldY <= obj.y + obj.h) {
        this._canvas.style.cursor = 'pointer';
        return;
      }
    }

    // Check animals
    for (let i = 0; i < this._animals.length; i++) {
      const a = this._animals[i];
      if (!a.active) continue;
      if (Math.hypot(worldX - a.x, worldY - a.y) < 16) {
        this._canvas.style.cursor = 'pointer';
        return;
      }
    }

    this._canvas.style.cursor = 'default';
  }

  // ---- Tap Feedback Drawing ------------------------------------------------

  _drawTapRipple(ctx) {
    if (!this._tapRipple) return;
    const r = this._tapRipple;
    const t = r.timer / r.duration; // 0→1
    const radius = t * 20;
    const alpha = 1 - t;

    // Expanding golden ring
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x | 0, r.y | 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // White center dot
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(r.x | 0, r.y | 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawDestinationMarker(ctx) {
    if (!this._destMarker) return;
    const m = this._destMarker;

    // Pulsing golden circle (scale 1.0→1.3 over 800ms cycle)
    const pulseT = (m.timer % 0.8) / 0.8;
    const scale = 1.0 + easeInOutCubic(pulseT < 0.5 ? pulseT * 2 : 2 - pulseT * 2) * 0.3;
    const baseRadius = 6;

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m.x | 0, m.y | 0, baseRadius * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Inner fill
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(m.x | 0, m.y | 0, baseRadius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawPathDots(ctx) {
    ctx.save();
    for (let i = 0; i < this._pathDots.length; i++) {
      const dot = this._pathDots[i];
      if (!dot.active) continue;

      // Twinkle animation
      const twinkle = Math.sin(dot.timer * 8 + i * 2) * 0.3 + 0.7;
      const fadeAlpha = dot.passed ? Math.max(0, 1 - (dot.timer / 0.3)) : 1;

      ctx.globalAlpha = twinkle * fadeAlpha * 0.7;
      ctx.fillStyle = '#ffd700';

      // Draw tiny diamond shape (3px)
      const dx = dot.x | 0;
      const dy = dot.y | 0;
      ctx.beginPath();
      ctx.moveTo(dx, dy - 3);
      ctx.lineTo(dx + 3, dy);
      ctx.lineTo(dx, dy + 3);
      ctx.lineTo(dx - 3, dy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Wind down trigger ----------------------------------------------------

  _triggerWindDown() {
    if (this._transition.active) return;

    this._transition.start('fade', {
      duration: 800,
      onHalf: () => {
        if (this._sceneManager) {
          this._sceneManager.switchTo('WindDown', {
            sessionTime: this._sessionTime,
            hearts: this._hud.hearts,
            questsCompleted: this._questSystem ? this._questSystem.getCompletedCount() : 0,
          });
        }
      },
    });
  }

  // ---- Public methods for external systems ----------------------------------

  /** Called by QuestSystem when first quest is completed. */
  onFirstQuestComplete() {
    this._firstQuestDone = true;
    this._hud.show();
  }

  /** Called by QuestSystem when any quest completes. */
  onQuestComplete(questData) {
    this._hud.addHearts(questData.hearts || 3);

    // Auto-save
    if (this._saveManager) {
      this._saveManager.save();
    }
  }

  /**
   * Register an NPC in the scene.
   * @param {object} npcData
   */
  addNPC(npcData) {
    this._npcs.push({
      id: npcData.id,
      x: npcData.x,
      y: npcData.y,
      homeX: npcData.x,  // remember spawn position for wander AI
      homeY: npcData.y,
      sprite: npcData.sprite || null,
      spriteName: npcData.spriteName || 'npc_grandma',
      flipX: false,
      animTimer: Math.random() * 1600,
      hasQuest: npcData.hasQuest || false,
      indicator: null,
      wanderTimer: 2 + Math.random() * 4,
      wanderTarget: null,
    });

    // Add quest indicator if applicable
    if (npcData.hasQuest) {
      const npc = this._npcs[this._npcs.length - 1];
      npc.indicator = this._questIndicators.acquire(npc.x, npc.y - 20);
    }
  }

  /**
   * Register an interactable world object.
   * @param {object} objData — {id, type, x, y, w, h}
   */
  addInteractable(objData) {
    for (let i = 0; i < this._interactables.length; i++) {
      if (!this._interactables[i].active) {
        const obj = this._interactables[i];
        obj.id = objData.id;
        obj.type = objData.type;
        obj.x = objData.x;
        obj.y = objData.y;
        obj.w = objData.w || 16;
        obj.h = objData.h || 16;
        obj.active = true;
        obj.cooldown = 0;
        return;
      }
    }
  }

  /**
   * Register an ambient animal.
   * @param {object} animalData — {type, x, y}
   */
  addAnimal(animalData) {
    for (let i = 0; i < this._animals.length; i++) {
      if (!this._animals[i].active) {
        const a = this._animals[i];
        a.type = animalData.spriteName || animalData.type.toLowerCase();
        a.x = animalData.x;
        a.y = animalData.y;
        a.homeX = animalData.x;     // remember spawn position
        a.homeY = animalData.y;
        a.zoneW = animalData.zoneW || 4;  // zone width in tiles
        a.zoneH = animalData.zoneH || 3;  // zone height in tiles
        a.vx = 0;
        a.vy = 0;
        a.active = true;
        a.animTimer = Math.random() * 1000;
        a.state = 'idle';
        a.flipX = false;
        a.wanderTarget = null;
        a.wanderPause = 1 + Math.random() * 3; // initial pause before first wander
        return;
      }
    }
  }

  // ---- Draw -----------------------------------------------------------------

  /**
   * @param {import('../engine/Renderer.js').default} renderer
   */
  draw(renderer) {
    const ctx = renderer.ctx;
    const camX = this._camX | 0;
    const camY = this._camY | 0;

    // Capture canvas ref for cursor feedback (desktop)
    if (!this._canvas && ctx.canvas) {
      this._canvas = ctx.canvas;
    }

    // ---- Sky gradient (time-of-day aware) -----------------------------------
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, colorToHex(this._skyTopColor));
    grad.addColorStop(1, colorToHex(this._skyBottomColor));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.save();
    ctx.translate(-camX, -camY);

    // ---- Layer 1: Ground tiles (with grass sway) -----------------------------
    if (this._tileMap) {
      this._tileMap.drawLayer(ctx, 'ground', camX, camY, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      // Grass sway overlay: subtle 1px oscillation on every 3rd grass tile
      this._drawGrassSway(ctx, camX, camY);
    }

    // ---- Layer 2: Object tiles (with water shimmer) -------------------------
    if (this._tileMap) {
      this._tileMap.drawLayer(ctx, 'objects', camX, camY, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      // Water shimmer: semi-transparent highlight on water tiles
      this._drawWaterShimmer(ctx, camX, camY);
    }

    // ---- Layer 3: Entities (NPCs, player, companion, animals) ---------------

    // Ambient animals
    this._drawAnimals(ctx);

    // NPCs
    this._drawNPCs(ctx);

    // Player
    if (this._player) {
      this._drawPlayer(ctx);
    }

    // Companion (with trail)
    if (this._companion) {
      this._drawCompanion(ctx);
    }

    // Interactable highlights
    this._drawInteractableHighlights(ctx);

    // ---- Layer 4: Foreground tiles ------------------------------------------
    if (this._tileMap) {
      this._tileMap.drawLayer(ctx, 'foreground', camX, camY, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }

    // Quest indicators (world space)
    this._questIndicators.draw(ctx, camX, camY);

    // Particles (world space)
    this._drawParticles(ctx);

    // Tap feedback (world space)
    this._drawTapRipple(ctx);
    this._drawDestinationMarker(ctx);
    this._drawPathDots(ctx);

    // Quest path breadcrumb sparkles (world space)
    this._drawBreadcrumbs(ctx);

    // Tutorial sparkle trail (world space, during tutorial and fade-out)
    if ((this._isFirstVisit && this._tutorialStep >= 5) || this._tutorialSparkleTrailFading) {
      this._drawTutorialSparkleTrail(ctx);
    }

    // Companion look-at indicator (world space)
    this._drawCompanionLookAt(ctx);

    // Silly moment overlay (world space)
    if (this._activeSillyMoment) {
      this._drawSillyMoment(ctx);
    }

    // ---- Ambient world life (world space) -----------------------------------
    this._drawAmbientSparkles(ctx);
    this._drawButterflies(ctx);
    this._drawBloomParticles(ctx);

    ctx.restore();

    // ---- Day-night tint overlay (screen space, on top of everything) --------
    this._drawDayNightTint(ctx);

    // ---- Screen-space UI ----------------------------------------------------
    this._hud.draw(renderer);
    this._transition.draw(renderer);
  }

  // ---- Draw helpers ---------------------------------------------------------

  _drawPlayer(ctx) {
    const p = this._player;
    const px = (p.x - 8) | 0;
    const py = (p.y - 8) | 0;

    // Idle sway / tiptoe bob
    let yOffset = 0;
    if (p.isTiptoeing && p.state === 'WALKING') {
      yOffset = Math.sin((p.animTimer || 0) * 0.01) * -1;
    } else if (p.state === 'IDLE' || p.state === 'INTERACTING') {
      yOffset = (p.animFrame === 1) ? -1 : 0;
    }

    // Use walk animation if moving, static sprite if idle
    if (p.state === 'WALKING' && spriteSheets.loaded) {
      const dir = p.direction || 0;
      const frame = (p.animFrame || 0) % 3;
      const flipX = (dir === 1); // left
      spriteSheets.drawWalk(ctx, px, py + (yOffset | 0), dir, frame, flipX);
    } else {
      const flipX = (p.direction === 1);
      spriteSheets.draw(ctx, 'princess', px, py + (yOffset | 0), { flipX });
    }

    // Sneeze particles
    if (p.sneezeTimer > 0) {
      const sneezeProgress = 1 - (p.sneezeTimer / 1.0);
      if (sneezeProgress > 0.2 && sneezeProgress < 0.6) {
        ctx.fillStyle = '#ffffcc';
        for (let i = 0; i < 3; i++) {
          const sx = px + 8 + (sneezeProgress * 12) + i * 3;
          const sy = py + 5 + (Math.sin(i * 2) * 2);
          ctx.fillRect(sx | 0, sy | 0, 1, 1);
        }
      }
    }

    // Splash water drops
    if (p.splashTimer > 0) {
      ctx.fillStyle = '#aaddff';
      for (let i = 0; i < 3; i++) {
        const dropX = px + 4 + (i * 4);
        const dropY = py + 2 - ((3.0 - p.splashTimer) * 2);
        if (dropY > py - 4) {
          ctx.fillRect(dropX | 0, dropY | 0, 1, 2);
        }
      }
    }

    // Celebration sparkles
    if (p.state === 'CELEBRATING') {
      ctx.fillStyle = '#ffd700';
      const t = p.celebrateTimer || 0;
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + t * 4;
        const r = 10 + t * 3;
        const sx = px + 8 + Math.cos(angle) * r;
        const sy = py + 8 + Math.sin(angle) * r;
        ctx.fillRect(sx | 0, sy | 0, 2, 2);
      }
    }
  }

  _drawCompanion(ctx) {
    const c = this._companion;
    const cx = (c.x - 8) | 0;
    const cy = (c.y - 8) | 0;

    // Idle bob
    let yOffset = (c.animFrame === 1) ? -1 : 0;
    // Silly wobble
    if (c.sillying) {
      yOffset += Math.sin((c.sillyTimer || 0) * 6) * 2;
    }
    // Idle nudge bounce
    yOffset += this._getIdleNudgeBounceOffset();

    const name = c.spriteName || 'unicorn';
    const flipX = c.flipX || false;

    // For unicorn companion: use running animation if following (moving)
    if (name === 'unicorn' && c.isFollowing !== false) {
      const frame = (c.animFrame || 0) % 4;
      spriteSheets.drawUnicornRun(ctx, cx, cy + (yOffset | 0), frame, flipX);
    } else {
      spriteSheets.draw(ctx, name, cx, cy + (yOffset | 0), { flipX });
    }

    // Care emote bubble
    if (c.emoteVisible) {
      const emoteX = cx + 4;
      const emoteY = cy - 12;
      const pulse = 1 + Math.sin((c.emoteTimer || 0) * 4) * 0.15;
      ctx.save();
      ctx.translate(emoteX, emoteY);
      ctx.scale(pulse, pulse);
      switch (c.emoteType) {
        case 'heart':
          ctx.fillStyle = '#ff6b8a';
          ctx.fillRect(-2, -1, 2, 1);
          ctx.fillRect(1, -1, 2, 1);
          ctx.fillRect(-3, 0, 7, 1);
          ctx.fillRect(-2, 1, 5, 1);
          ctx.fillRect(-1, 2, 3, 1);
          ctx.fillRect(0, 3, 1, 1);
          break;
        case 'sleepy':
          ctx.fillStyle = '#aabbff';
          ctx.font = '6px monospace';
          ctx.fillText('Z', 0, 0);
          ctx.font = '4px monospace';
          ctx.fillText('z', 4, -3);
          break;
        case 'playful':
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(-1, -3, 3, 1);
          ctx.fillRect(-2, -2, 5, 1);
          ctx.fillRect(-3, -1, 7, 1);
          ctx.fillRect(-1, 0, 3, 1);
          ctx.fillRect(-2, 1, 2, 1);
          ctx.fillRect(1, 1, 2, 1);
          break;
      }
      ctx.restore();
    }
  }

  _drawNPCs(ctx) {
    for (let i = 0; i < this._npcs.length; i++) {
      const npc = this._npcs[i];
      const nx = (npc.x - 8) | 0;
      const ny = (npc.y - 8) | 0;

      // Idle bob (1px every 800ms)
      const bobOffset = (npc.animTimer !== undefined)
        ? ((npc.animTimer | 0) % 1600 < 800 ? 0 : -1)
        : 0;

      // Determine sprite name from NPC data
      const spriteName = npc.spriteName || npc.sprite || 'npc_grandma';
      const flipX = npc.flipX || false;

      spriteSheets.draw(ctx, spriteName, nx, ny + bobOffset, { flipX });

      // Update indicator position
      if (npc.indicator) {
        npc.indicator.worldX = npc.x;
        npc.indicator.worldY = npc.y - 20;
      }
    }
  }

  _drawAnimals(ctx) {
    for (let i = 0; i < this._animals.length; i++) {
      const a = this._animals[i];
      if (!a.active) continue;

      const ax = (a.x - 8) | 0;
      const ay = (a.y - 8) | 0;

      // Idle bob effect (1px up/down at ~400ms)
      const bobOffset = ((a.animTimer | 0) % 800 < 400) ? 0 : -1;

      // Determine sprite name and flip
      const spriteName = a.type || 'cat';
      const flipX = (a.vx < 0) || a.flipX || false;

      spriteSheets.draw(ctx, spriteName, ax, ay + bobOffset, { flipX });

      // Sleep Z's
      if (a.state === 'sleep') {
        ctx.fillStyle = '#aabbff';
        ctx.font = '5px monospace';
        const zBob = Math.sin((a.animTimer || 0) * 0.003) * 2;
        ctx.fillText('z', ax + 10, ay - 6 + zBob);
        ctx.font = '4px monospace';
        ctx.fillText('z', ax + 13, ay - 10 + zBob);
      }
    }
  }

  _drawInteractableHighlights(ctx) {
    const hasPx = this._player != null;
    const px = hasPx ? this._player.x : 0;
    const py = hasPx ? this._player.y : 0;

    for (let i = 0; i < this._interactables.length; i++) {
      const obj = this._interactables[i];
      if (!obj.active) continue;
      if (obj.cooldown > 0) continue;

      const ox = obj.x + obj.w / 2;
      const oy = obj.y + obj.h / 2;
      const dist = hasPx ? Math.hypot(ox - px, oy - py) : 999;

      // Within 3 tiles: bright sparkle glow to invite tapping
      if (dist < 48) {
        const pulse = Math.sin(this._sessionTime * 3 + i * 1.5) * 0.5 + 0.5;
        ctx.save();
        // Glow circle
        ctx.globalAlpha = 0.2 + pulse * 0.2;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(ox | 0, oy | 0, (obj.w * 0.7) | 0, 0, Math.PI * 2);
        ctx.fill();
        // Sparkle outline
        ctx.globalAlpha = 0.4 + pulse * 0.3;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x | 0, obj.y | 0, obj.w, obj.h);
        ctx.restore();
      } else {
        // Far away: very subtle shimmer
        ctx.save();
        ctx.globalAlpha = 0.15 + Math.sin(this._sessionTime * 2 + i) * 0.08;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.strokeRect(obj.x | 0, obj.y | 0, obj.w, obj.h);
        ctx.restore();
      }
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

  _drawBreadcrumbs(ctx) {
    ctx.save();
    for (let i = 0; i < this._breadcrumbs.length; i++) {
      const bc = this._breadcrumbs[i];
      if (!bc.active) continue;
      const pulse = Math.sin(bc.timer * 3 + i * 0.7) * 0.5 + 0.5;
      ctx.globalAlpha = bc.alpha * (0.5 + pulse * 0.5);
      ctx.fillStyle = '#ffd700';
      // Small sparkle diamond
      const s = 3 + pulse * 2;
      ctx.beginPath();
      ctx.moveTo(bc.x | 0, (bc.y - s) | 0);
      ctx.lineTo((bc.x + s) | 0, bc.y | 0);
      ctx.lineTo(bc.x | 0, (bc.y + s) | 0);
      ctx.lineTo((bc.x - s) | 0, bc.y | 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Draw the tutorial sparkle trail — twinkling gold/pink diamonds from player toward Grandma.
   */
  _drawTutorialSparkleTrail(ctx) {
    ctx.save();
    const colors = ['#ffd700', '#ffb6c1', '#ffe066', '#ff69b4']; // gold, pink, yellow, hot pink
    for (let i = 0; i < this._tutorialSparkleTrail.length; i++) {
      const s = this._tutorialSparkleTrail[i];
      if (!s.active || s.alpha <= 0) continue;

      const localTime = s.timer - s.delay;
      if (localTime < 0) continue;

      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = colors[i % colors.length];

      // Sparkle diamond shape with gentle size pulse
      const pulse = Math.sin(localTime * 3 + i * 0.9) * 0.5 + 0.5;
      const size = 3 + pulse * 3;
      const sx = s.x | 0;
      const sy = (s.y - pulse * 2) | 0; // slight vertical float

      ctx.beginPath();
      ctx.moveTo(sx, sy - size);
      ctx.lineTo(sx + size, sy);
      ctx.lineTo(sx, sy + size);
      ctx.lineTo(sx - size, sy);
      ctx.closePath();
      ctx.fill();

      // Tiny glow ring around each sparkle
      ctx.globalAlpha = s.alpha * 0.3;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      const glowR = size + 2 + pulse * 2;
      ctx.beginPath();
      ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCompanionLookAt(ctx) {
    if (!this._companionLookTarget || !this._companion) return;

    // Draw a subtle sparkle trail from companion toward the target
    const cx = this._companion.x || 0;
    const cy = this._companion.y || 0;
    const tx = this._companionLookTarget.x;
    const ty = this._companionLookTarget.y;
    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;

    ctx.save();
    // Draw 3 sparkle dots along the direction the companion is looking
    for (let i = 1; i <= 3; i++) {
      const t = (i / 4) * Math.min(dist, 32) / dist;
      const sx = (cx + dx * t) | 0;
      const sy = (cy + dy * t) | 0;
      const pulse = Math.sin(this._sessionTime * 3 + i * 1.5) * 0.5 + 0.5;
      ctx.globalAlpha = 0.3 + pulse * 0.3;
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    ctx.restore();
  }

  _drawSillyMoment(ctx) {
    // Simple visual indicator that a silly moment is happening
    // Real implementation would animate specific NPCs/objects
    // For now, show a small sparkle + speech indicator
    if (!this._activeSillyMoment) return;

    const alpha = Math.max(0, 1 - this._sillyMomentTimer / 4);
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    // Comedic sparkle near center of screen (world space)
    const sx = (this._camX + LOGICAL_WIDTH / 2 + (Math.random() - 0.5) * 40) | 0;
    const sy = (this._camY + LOGICAL_HEIGHT / 2 - 20) | 0;
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(sx, sy, 3, 3);
    ctx.restore();
  }

  // ---- Ambient draw helpers --------------------------------------------------

  /**
   * Draw subtle 1px grass sway on every 3rd grass tile.
   * Uses a sine offset based on world time and tile position.
   */
  _drawGrassSway(ctx, camX, camY) {
    if (!this._tileMap || !this._tileMap.groundLayer) return;
    const tm = this._tileMap;
    const w = tm.width;
    const TILE = 16;
    const startTX = Math.max(0, (camX / TILE) | 0);
    const startTY = Math.max(0, (camY / TILE) | 0);
    const endTX = Math.min(w, startTX + Math.ceil(LOGICAL_WIDTH / TILE) + 2);
    const endTY = Math.min(tm.height, startTY + Math.ceil(LOGICAL_HEIGHT / TILE) + 2);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#88dd66';

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        // Only every 3rd grass tile sways
        if ((tx + ty * 7) % 3 !== 0) continue;
        const tileId = tm.groundLayer[ty * w + tx];
        if (tileId < 0 || !GRASS_TILE_IDS.has(tileId)) continue;

        const sway = Math.sin(this._worldTime * 1.5 + tx * 0.7) * 0.5;
        const px = tx * TILE + (sway | 0);
        const py = ty * TILE;
        // Draw a thin highlight line at the top of the grass tile to suggest motion
        ctx.fillRect(px + 2, py + 1, 12, 2);
      }
    }
    ctx.restore();
  }

  /**
   * Draw water shimmer: oscillating semi-transparent white highlights on water tiles.
   */
  _drawWaterShimmer(ctx, camX, camY) {
    if (!this._tileMap) return;
    // Check both ground and object layers for water tiles
    const layers = [this._tileMap.groundLayer, this._tileMap.objectLayer];
    const tm = this._tileMap;
    const w = tm.width;
    const TILE = 16;
    const startTX = Math.max(0, (camX / TILE) | 0);
    const startTY = Math.max(0, (camY / TILE) | 0);
    const endTX = Math.min(w, startTX + Math.ceil(LOGICAL_WIDTH / TILE) + 2);
    const endTY = Math.min(tm.height, startTY + Math.ceil(LOGICAL_HEIGHT / TILE) + 2);

    ctx.save();
    // Oscillating opacity: gentle shimmer between 0.04 and 0.12
    const shimmerAlpha = 0.04 + (Math.sin(this._worldTime * 3) * 0.5 + 0.5) * 0.08;
    ctx.globalAlpha = shimmerAlpha;
    ctx.fillStyle = '#ffffff';

    for (const layer of layers) {
      if (!layer) continue;
      for (let ty = startTY; ty < endTY; ty++) {
        for (let tx = startTX; tx < endTX; tx++) {
          const tileId = layer[ty * w + tx];
          if (tileId < 0 || !WATER_TILE_IDS.has(tileId)) continue;
          const px = tx * TILE;
          const py = ty * TILE;
          // Draw two small shimmer highlights at alternating positions
          const offset = this._waterShimmerPhase === 0 ? 0 : 4;
          ctx.fillRect(px + 3 + offset, py + 2, 4, 2);
          ctx.fillRect(px + 9 - offset, py + 10, 3, 2);
        }
      }
    }
    ctx.restore();
  }

  /**
   * Draw floating ambient sparkle particles (screen-anchored in world space).
   */
  _drawAmbientSparkles(ctx) {
    ctx.save();
    for (let i = 0; i < this._ambientSparkles.length; i++) {
      const s = this._ambientSparkles[i];
      if (!s.active) continue;
      ctx.globalAlpha = s.alpha * 0.7;
      ctx.fillStyle = s.color;
      const sz = s.size | 0;
      if (sz <= 1) {
        ctx.fillRect((s.x) | 0, (s.y) | 0, 1, 1);
      } else {
        // Tiny sparkle: center pixel + cross
        const cx = (s.x) | 0;
        const cy = (s.y) | 0;
        ctx.fillRect(cx, cy, 1, 1);
        ctx.globalAlpha = s.alpha * 0.4;
        ctx.fillRect(cx - 1, cy, 1, 1);
        ctx.fillRect(cx + 1, cy, 1, 1);
        ctx.fillRect(cx, cy - 1, 1, 1);
        ctx.fillRect(cx, cy + 1, 1, 1);
      }
    }
    ctx.restore();
  }

  /**
   * Draw ambient butterflies as small colored dots on sine-wave paths.
   */
  _drawButterflies(ctx) {
    ctx.save();
    for (let i = 0; i < this._butterflies.length; i++) {
      const b = this._butterflies[i];
      if (!b.active) continue;

      const bx = (b.x) | 0;
      const by = (b.y) | 0;

      // Wing flap animation (alternate size 2-3px)
      const wingOpen = Math.sin(this._worldTime * 12 + i * 3) > 0;

      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.8;

      if (wingOpen) {
        // Wings spread: 3px wide
        ctx.fillRect(bx - 1, by, 3, 2);
        ctx.fillRect(bx, by - 1, 1, 1); // body top
      } else {
        // Wings folded: 2px wide
        ctx.fillRect(bx, by, 2, 2);
      }

      // Tiny body dot
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#333333';
      ctx.fillRect(bx, by, 1, 1);
    }
    ctx.restore();
  }

  /**
   * Draw flower bloom burst particles.
   */
  _drawBloomParticles(ctx) {
    ctx.save();
    for (let i = 0; i < this._bloomParticles.length; i++) {
      const p = this._bloomParticles[i];
      if (!p.active) continue;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect((p.x - 1) | 0, (p.y - 1) | 0, p.size, p.size);
    }
    ctx.restore();
  }

  /**
   * Draw day-night tint overlay based on session time.
   * Morning (0-15min): no tint
   * Sunset (15-18min): warm orange at 10% opacity
   * Evening (18-20min): purple at 15% opacity
   */
  _drawDayNightTint(ctx) {
    if (this._sessionTime < SESSION_SUNSET_S) return; // no tint in morning

    ctx.save();
    if (this._timeOfDay === 'sunset') {
      // Warm orange overlay, fading in from 0% to 10%
      const t = (this._sessionTime - SESSION_SUNSET_S) / (SESSION_EVENING_S - SESSION_SUNSET_S);
      ctx.globalAlpha = t * 0.10;
      ctx.fillStyle = '#ff8833';
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    } else if (this._timeOfDay === 'evening') {
      // Purple overlay at 15% opacity
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#6633aa';
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    ctx.restore();
  }

  // ---- World loading --------------------------------------------------------

  _loadWorldObjects() {
    // Reset pools
    for (let i = 0; i < this._interactables.length; i++) {
      this._interactables[i].active = false;
    }
    for (let i = 0; i < this._animals.length; i++) {
      this._animals[i].active = false;
    }
    this._npcs.length = 0;
    this._questIndicators.releaseAll();

    // Get level data — use the imported sparkle village data
    const levelData = sparkleVillage;
    if (!levelData) {
      console.warn('OverworldScene: No level data available');
      return;
    }

    console.log(`OverworldScene: Loading level "${levelData.name}" (${levelData.width}x${levelData.height})`);

    // ---- 1. Set player spawn position ----
    if (this._player) {
      const spawnX = (levelData.spawnX || 14) * 16 + 8; // center of tile, in pixels
      const spawnY = (levelData.spawnY || 9) * 16 + 8;
      this._player.x = spawnX;
      this._player.y = spawnY;
      this._player.state = 'IDLE';
      this._player.path = null;
      console.log(`OverworldScene: Player spawned at tile (${levelData.spawnX}, ${levelData.spawnY}) -> pixel (${spawnX}, ${spawnY})`);
    }

    // ---- 2. Set companion start position near player ----
    if (this._companion && this._player) {
      this._companion.x = this._player.x + 12;
      this._companion.y = this._player.y + 20;
      this._companion.prevX = this._companion.x;
      this._companion.prevY = this._companion.y;
    }

    // ---- 3. Initialize camera at player position ----
    if (this._player) {
      this._camX = Math.max(0, this._player.x - LOGICAL_WIDTH / 2);
      this._camY = Math.max(0, this._player.y - LOGICAL_HEIGHT / 2);
    }

    // ---- 4. Load quests into QuestSystem ----
    if (levelData.quests && this._questSystem) {
      this._questSystem.loadQuests(levelData.quests);
      console.log(`OverworldScene: Loaded ${levelData.quests.length} quests`);
    }

    // ---- 5. Spawn NPCs ----
    if (levelData.npcs) {
      for (let i = 0; i < levelData.npcs.length; i++) {
        const npcData = levelData.npcs[i];
        // Convert tile coordinates to pixel coordinates (center of tile)
        const px = npcData.homeX * 16 + 8;
        const py = npcData.homeY * 16 + 8;

        // Check if this NPC has an available quest
        let hasQuest = false;
        if (this._questSystem) {
          const questId = this._questSystem.getAvailableQuestForNPC(npcData.id);
          hasQuest = questId !== null;
        }

        this.addNPC({
          id: npcData.id,
          x: px,
          y: py,
          spriteName: npcData.spriteName || 'npc_grandma',
          hasQuest: hasQuest,
        });
      }
      console.log(`OverworldScene: Spawned ${levelData.npcs.length} NPCs`);
    }

    // ---- 6. Spawn world objects (interactables) ----
    if (levelData.worldObjects) {
      for (let i = 0; i < levelData.worldObjects.length; i++) {
        const obj = levelData.worldObjects[i];
        this.addInteractable({
          id: obj.id || ('obj-' + i),
          type: obj.type,
          x: obj.x * 16,
          y: obj.y * 16,
          w: 16,
          h: 16,
        });
      }
      console.log(`OverworldScene: Spawned ${levelData.worldObjects.length} world objects`);
    }

    // ---- 7. Spawn ambient animals ----
    if (levelData.animals) {
      for (let i = 0; i < levelData.animals.length; i++) {
        const animalDef = levelData.animals[i];
        // Place animal at its defined start position (tile coords -> pixels)
        const ax = animalDef.x * 16 + 8;
        const ay = animalDef.y * 16 + 8;
        this.addAnimal({
          type: animalDef.type,
          spriteName: animalDef.spriteName || animalDef.type.toLowerCase(),
          x: ax,
          y: ay,
          zoneW: animalDef.zone ? animalDef.zone.w : 4,
          zoneH: animalDef.zone ? animalDef.zone.h : 3,
        });
      }
      console.log(`OverworldScene: Spawned ${levelData.animals.length} animals`);
    }

    // ---- 8. Store dialogues reference for NPC interactions ----
    if (levelData.dialogues) {
      this._dialogues = levelData.dialogues;
    }

    console.log('OverworldScene: World loading complete');
  }
}
