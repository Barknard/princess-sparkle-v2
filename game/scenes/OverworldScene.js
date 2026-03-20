/**
 * OverworldScene.js — Main game scene for Princess Sparkle V2
 *
 * Renders TileMap layers: ground -> objects -> entities -> foreground.
 * Updates: Player movement, Companion follow, NPC wander, ParticleSystem, Camera.
 * Handles tap input: check interactable first (NPC, object), then pathfind.
 * Manages world interactables, ambient animals, silly moments.
 * Session time tracking with sky color gradient shifts.
 *
 * Canvas only. No DOM. Integer coordinates for pixel art.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import HUD from '../ui/HUD.js';
import QuestIndicatorPool from '../ui/QuestIndicator.js';
import TransitionOverlay from '../ui/TransitionOverlay.js';

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

const MAX_AMBIENT_ANIMALS = 8;

// ---- Silly moment timer -----------------------------------------------------

const SILLY_MIN_INTERVAL_S = 45;
const SILLY_MAX_INTERVAL_S = 75;

// ---- Interactable object pool -----------------------------------------------

const MAX_INTERACTABLES = 20;

// ---- Particle pool ----------------------------------------------------------

const MAX_PARTICLES = 64;

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

    // First visit auto-walk demo
    this._isFirstVisit = true;
    this._autoWalkTriggered = false;
    this._autoWalkTimer = 0;

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

    // Load level data (NPCs, interactables, animals) from tileMap / world loader
    this._loadWorldObjects();

    // Play morning ambience
    if (this._audioManager) {
      this._audioManager.play('bgm_village_morning');
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

    // Silly moments
    this._updateSillyMoments(dt);

    // Particles
    this._updateParticles(dt);

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

    // First visit: auto-walk demo so child sees the princess can move
    this._updateAutoWalkDemo(dt);

    // Handle input
    this._handleInput();

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
      this._audioManager.play('bgm_village_sunset');
    }
    // Companion: "The sun is getting sleepy!"
    if (this._audioManager) {
      this._audioManager.play('voice_companion_sunset');
    }
  }

  _onEveningBegins() {
    if (this._audioManager) {
      this._audioManager.play('bgm_village_evening');
    }
    // Companion: "What a wonderful day!"
    if (this._audioManager) {
      this._audioManager.play('voice_companion_evening');
    }
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
      this._companion.follow(this._player.x, this._player.y, dt);
      this._companion.update(dt);
    }
  }

  // ---- NPCs -----------------------------------------------------------------

  _updateNPCs(dt) {
    for (let i = 0; i < this._npcs.length; i++) {
      const npc = this._npcs[i];
      npc.wanderTimer -= dt;

      if (npc.wanderTimer <= 0 && npc.wanderTarget === null) {
        // Pick new wander target nearby (within 3 tiles)
        const range = 48; // 3 tiles
        npc.wanderTarget = {
          x: npc.x + (Math.random() - 0.5) * range * 2,
          y: npc.y + (Math.random() - 0.5) * range * 2,
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
        } else {
          npc.wanderTarget = null;
        }
      }
    }
  }

  // ---- Animals --------------------------------------------------------------

  _updateAnimals(dt) {
    for (let i = 0; i < this._animals.length; i++) {
      const a = this._animals[i];
      if (!a.active) continue;

      a.animTimer += dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // Simple boundary wrapping
      if (a.x < -16) a.x = LOGICAL_WIDTH + 16;
      if (a.x > LOGICAL_WIDTH + 32) a.x = -16;
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

    if (this._audioManager) {
      this._audioManager.play('sfx_silly_' + this._activeSillyMoment);
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
      if (this._audioManager) {
        this._audioManager.play('voice_companion_hint');
      }
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

  /** Auto-walk demo: on first village visit, walk princess a few tiles to show movement. */
  _updateAutoWalkDemo(dt) {
    if (!this._isFirstVisit || this._autoWalkTriggered) return;
    this._autoWalkTimer += dt;

    // After 2 seconds in the village, auto-walk 3 tiles to the right
    if (this._autoWalkTimer >= 2 && this._player) {
      this._autoWalkTriggered = true;
      this._player.moveTo(this._player.x + 48, this._player.y);

      // Play a gentle sparkle trail SFX to draw attention
      if (this._audioManager) {
        this._audioManager.play('sfx_footstep_sparkle');
      }
    }
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

    // 4. Pathfind to tap position
    if (this._player) {
      this._player.moveTo(worldX, worldY);
    }
  }

  _onNPCTapped(npc) {
    if (npc.hasQuest) {
      // Start dialogue scene as overlay
      if (this._sceneManager) {
        this._sceneManager.pushOverlay('Dialogue', { npcId: npc.id });
      }
    } else {
      // Ambient NPC line
      if (this._audioManager) {
        this._audioManager.play('voice_npc_' + npc.id + '_ambient');
      }
    }
  }

  _onInteractableTapped(obj) {
    obj.cooldown = 2; // 2 seconds before can tap again

    // Emit particles at object
    this._emitParticles(obj.x + obj.w / 2, obj.y, '#ffd700', 6);

    // Play corresponding SFX
    if (this._audioManager) {
      this._audioManager.play('sfx_tap_' + obj.type);
    }
  }

  _onAnimalTapped(animal) {
    // Animal reaction
    if (this._audioManager) {
      this._audioManager.play('sfx_animal_' + animal.type);
    }

    // Small particle burst
    this._emitParticles(animal.x, animal.y, '#ffb6c1', 4);
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
            questsCompleted: this._questSystem ? this._questSystem.completedCount : 0,
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
      sprite: npcData.sprite || null,
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
        a.type = animalData.type;
        a.x = animalData.x;
        a.y = animalData.y;
        a.vx = (Math.random() - 0.5) * 10;
        a.vy = 0;
        a.active = true;
        a.animTimer = 0;
        a.state = 'idle';
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

    // ---- Sky gradient (time-of-day aware) -----------------------------------
    const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    grad.addColorStop(0, colorToHex(this._skyTopColor));
    grad.addColorStop(1, colorToHex(this._skyBottomColor));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    ctx.save();
    ctx.translate(-camX, -camY);

    // ---- Layer 1: Ground tiles ----------------------------------------------
    if (this._tileMap) {
      this._tileMap.drawLayer(ctx, 'ground', camX, camY, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }

    // ---- Layer 2: Object tiles ----------------------------------------------
    if (this._tileMap) {
      this._tileMap.drawLayer(ctx, 'objects', camX, camY, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }

    // ---- Layer 3: Entities (NPCs, player, companion, animals) ---------------

    // Ambient animals
    this._drawAnimals(ctx);

    // NPCs
    this._drawNPCs(ctx);

    // Player
    if (this._player) {
      this._player.draw(ctx);
    }

    // Companion (with trail)
    if (this._companion) {
      this._companion.draw(ctx);
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

    // Quest path breadcrumb sparkles (world space)
    this._drawBreadcrumbs(ctx);

    // Companion look-at indicator (world space)
    this._drawCompanionLookAt(ctx);

    // Silly moment overlay (world space)
    if (this._activeSillyMoment) {
      this._drawSillyMoment(ctx);
    }

    ctx.restore();

    // ---- Screen-space UI ----------------------------------------------------
    this._hud.draw(renderer);
    this._transition.draw(renderer);
  }

  // ---- Draw helpers ---------------------------------------------------------

  _drawNPCs(ctx) {
    for (let i = 0; i < this._npcs.length; i++) {
      const npc = this._npcs[i];
      const nx = (npc.x - 8) | 0;
      const ny = (npc.y - 8) | 0;

      // Placeholder NPC sprite (16x16)
      ctx.fillStyle = '#f0d0a0';
      ctx.fillRect(nx, ny, 16, 16);
      // Head
      ctx.fillStyle = '#ffdab9';
      ctx.fillRect(nx + 3, ny, 10, 8);
      // Body
      ctx.fillStyle = '#8899cc';
      ctx.fillRect(nx + 2, ny + 8, 12, 8);

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

      const ax = (a.x - 4) | 0;
      const ay = (a.y - 4) | 0;

      // Simple animal placeholder (8x8)
      switch (a.type) {
        case 'butterfly':
          ctx.fillStyle = '#ffaacc';
          ctx.fillRect(ax, ay, 3, 3);
          ctx.fillRect(ax + 5, ay, 3, 3);
          ctx.fillStyle = '#6a5acd';
          ctx.fillRect(ax + 3, ay + 1, 2, 4);
          break;
        case 'bird':
          ctx.fillStyle = '#aa6633';
          ctx.fillRect(ax, ay, 6, 4);
          ctx.fillStyle = '#ff9933';
          ctx.fillRect(ax + 6, ay + 1, 2, 2);
          break;
        case 'cat':
          ctx.fillStyle = '#ff9966';
          ctx.fillRect(ax, ay, 8, 6);
          ctx.fillRect(ax + 1, ay - 2, 2, 3);
          ctx.fillRect(ax + 5, ay - 2, 2, 3);
          break;
        case 'frog':
          ctx.fillStyle = '#66cc66';
          ctx.fillRect(ax, ay, 6, 4);
          ctx.fillStyle = '#226622';
          ctx.fillRect(ax, ay, 2, 2);
          ctx.fillRect(ax + 4, ay, 2, 2);
          break;
        default:
          ctx.fillStyle = '#cccccc';
          ctx.fillRect(ax, ay, 6, 6);
          break;
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

  // ---- World loading --------------------------------------------------------

  _loadWorldObjects() {
    // This would be populated from level data files.
    // Placeholder: set up a few default interactables and animals
    // Real data comes from levels/level-sparkle-village.js etc.

    // Reset pools
    for (let i = 0; i < this._interactables.length; i++) {
      this._interactables[i].active = false;
    }
    for (let i = 0; i < this._animals.length; i++) {
      this._animals[i].active = false;
    }
    this._npcs.length = 0;
    this._questIndicators.releaseAll();
  }
}
