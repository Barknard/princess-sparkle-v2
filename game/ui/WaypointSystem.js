/**
 * WaypointSystem.js — Magical navigation for young RPG players (v2)
 *
 * Five enchanted layers guide the princess to her quest target:
 *   1. Flowing Sparkle Trail — particles stream from player toward goal (world space)
 *   2. Goal Beacon          — pulsing rings + rotating star at the goal (world space)
 *   3. Fairy Guide          — animated butterfly at screen edge when goal is off-screen
 *   4. Exit Glow            — quest-colored shimmer on archway when trail crosses maps
 *   5. No-Progress Signal   — fires callback after 15s without movement toward goal
 *
 * Cross-map routing:
 *   setTarget(worldX, worldY, mapId, exitTile)
 *     When mapId differs from currentMapId the system re-routes the trail to the
 *     nearest exit that leads toward the target map. The exit archway glows with
 *     the quest's pathColor. Once the player transitions, call onMapTransition()
 *     to update the target to the real goal position.
 *
 * Designed for a 4-year-old: the sparkle particles literally FLOW in the
 * direction she should walk. A glowing fairy butterfly beckons from the
 * screen edge when the goal is out of view.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';

const HALF_W = (LOGICAL_WIDTH * 0.5) | 0;
const HALF_H = (LOGICAL_HEIGHT * 0.5) | 0;

// ── Flowing Trail ───────────────────────────────────────────────────────────
const TRAIL_SPEED        = 40;   // px/s particle travel speed
const TRAIL_SPAWN_INTERVAL = 0.2; // seconds between new particles
const TRAIL_MAX_PARTICLES  = 15;
const TRAIL_STAR_SIZE_MIN  = 2;
const TRAIL_STAR_SIZE_MAX  = 3;
const TRAIL_PERP_AMP       = 3;  // perpendicular wave amplitude
const TRAIL_FADE_DUR       = 0.3; // fade-in / fade-out seconds

// ── Goal Beacon ─────────────────────────────────────────────────────────────
const BEACON_RING_COUNT    = 3;
const BEACON_RING_MAX_R    = 24;
const BEACON_RING_SPEED    = 1.2;   // ring expansion cycle (seconds per ring)
const BEACON_STAR_OUTER    = 12;
const BEACON_STAR_INNER    = 5;
const BEACON_STAR_POINTS   = 5;
const BEACON_STAR_ROT_SPEED = 0.8;  // rad/s
const BEACON_BOB_AMP       = 4;
const BEACON_BOB_SPEED     = 2.5;
const BEACON_BURST_INTERVAL = 2.0;  // seconds
const BEACON_BURST_COUNT   = 5;
const BEACON_BURST_SPEED   = 30;    // px/s outward

// ── Fairy Guide ─────────────────────────────────────────────────────────────
const FAIRY_WING_SPAN      = 12;   // total wingspan px
const FAIRY_BOB_AMP        = 4;
const FAIRY_BOB_SPEED      = 3.5;
const FAIRY_GLOW_R         = 14;
const FAIRY_COLOR          = '#ff88cc';
const FAIRY_GLOW_COLOR     = 'rgba(255,136,204,0.25)';
const FAIRY_TRAIL_COUNT    = 4;
const EDGE_MARGIN          = 22;
const CHEVRON_SIZE         = 8;

// ── Exit Glow ───────────────────────────────────────────────────────────────
const EXIT_GLOW_TILE_RANGE = 2;    // glow extends this many tiles around exit center
const EXIT_GLOW_PULSE_HZ   = 2.0;  // full pulse cycles per second (0.5s cycle)
const EXIT_GLOW_ALPHA_MIN  = 0.30;
const EXIT_GLOW_ALPHA_MAX  = 0.60;
const EXIT_PARTICLE_COUNT  = 6;    // beckoning particles drifting toward exit

// ── No-Progress Hint ────────────────────────────────────────────────────────
const NO_PROGRESS_THRESHOLD = 15.0; // seconds — companion hint trigger
const NO_PROGRESS_RESET_DIST = 32;  // px moved to reset the no-progress timer

export default class WaypointSystem {
  constructor() {
    this._hasTarget = false;
    this._targetX = 0;
    this._targetY = 0;
    this._player = null;
    this._currentMapId = null;

    // Cross-map state
    this._crossMapTarget = null;  // { mapId, worldX, worldY } — real goal in another map
    this._showExitGlow = false;
    this._exitTileX = 0;          // center tile position of the exit archway
    this._exitTileY = 0;
    this._questPathColor = '#ffd700'; // default gold — set via setQuestColor()

    // Timers
    this._time = 0;
    this._spawnTimer = 0;
    this._burstTimer = 0;

    // No-progress tracking
    this._noProgressTimer = 0;
    this._lastProgressX = 0;
    this._lastProgressY = 0;
    this._onNoProgress = null; // callback(waypointSystem)

    // Path points (player -> corner -> target, max 3)
    this._pathX = new Float64Array(3);
    this._pathY = new Float64Array(3);
    this._pathLen = 0;
    this._totalPathLen = 0;

    // Flowing trail particle pool
    this._particles = [];
    for (let i = 0; i < TRAIL_MAX_PARTICLES; i++) {
      this._particles.push({ active: false, dist: 0, maxDist: 0, age: 0, maxAge: 0, perpPhase: 0, size: 0 });
    }

    // Burst particles (goal beacon)
    this._bursts = [];
    for (let i = 0; i < BEACON_BURST_COUNT; i++) {
      this._bursts.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, maxAge: 0.6 });
    }

    // Exit glow particles (beckoning drift toward exit)
    this._exitParticles = [];
    for (let i = 0; i < EXIT_PARTICLE_COUNT; i++) {
      this._exitParticles.push({ active: false, x: 0, y: 0, age: 0, maxAge: 1.2, phase: i / EXIT_PARTICLE_COUNT });
    }
    this._exitParticleTimer = 0;

    // Screen-space state
    this._targetOnScreen = true;
    this._edgeX = 0;
    this._edgeY = 0;
    this._edgeAngle = 0; // angle from center to target
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Set the current map ID so cross-map routing knows when to reroute.
   * @param {string} mapId
   */
  setCurrentMap(mapId) {
    this._currentMapId = mapId;
  }

  /**
   * Set the quest's value color (from familyValues.pathColor) for the trail
   * and exit glow. Defaults to gold if not called.
   * @param {string} color  CSS color string
   */
  setQuestColor(color) {
    this._questPathColor = color || '#ffd700';
  }

  /**
   * Register a callback fired once after 15s of no progress toward goal.
   * Companion should call sayNavHint() in this callback.
   * Reset automatically when player moves toward goal.
   * @param {function} cb
   */
  onNoProgress(cb) {
    this._onNoProgress = cb;
  }

  /**
   * Set navigation target.
   *
   * Single-map usage:
   *   setTarget(worldX, worldY)
   *
   * Cross-map usage:
   *   setTarget(worldX, worldY, mapId, exitCenterX, exitCenterY)
   *   where exitCenterX/Y are the pixel coords of the exit archway center
   *   on the CURRENT map. The system will route to the exit instead.
   *
   * @param {number} worldX
   * @param {number} worldY
   * @param {string|null} [mapId]
   * @param {number} [exitCenterX]  pixel X of exit archway on current map
   * @param {number} [exitCenterY]  pixel Y of exit archway on current map
   */
  setTarget(worldX, worldY, mapId, exitCenterX, exitCenterY) {
    if (mapId && mapId !== this._currentMapId) {
      // Route to the exit that leads toward the target map
      this._targetX = exitCenterX !== undefined ? exitCenterX : worldX;
      this._targetY = exitCenterY !== undefined ? exitCenterY : worldY;
      this._crossMapTarget = { mapId, worldX, worldY };
      this._showExitGlow = true;
      // Store tile coords for glow rendering (1 tile = 16px)
      this._exitTileX = (this._targetX / 16) | 0;
      this._exitTileY = (this._targetY / 16) | 0;
    } else {
      this._targetX = worldX;
      this._targetY = worldY;
      this._crossMapTarget = null;
      this._showExitGlow = false;
    }

    this._hasTarget = true;
    this._noProgressTimer = 0;

    if (this._player) {
      this._lastProgressX = this._player.x;
      this._lastProgressY = this._player.y;
    }

    // Reset all particles on new target
    for (let i = 0; i < this._particles.length; i++) this._particles[i].active = false;
    for (let i = 0; i < this._bursts.length; i++) this._bursts[i].active = false;
  }

  /**
   * Call this after every map transition.
   * If the new map IS the cross-map target, switch to pointing at the real goal.
   * @param {string} newMapId
   */
  onMapTransition(newMapId) {
    this._currentMapId = newMapId;
    if (this._crossMapTarget && this._crossMapTarget.mapId === newMapId) {
      // Arrived — point at the actual goal
      this.setTarget(this._crossMapTarget.worldX, this._crossMapTarget.worldY);
    }
  }

  clearTarget() {
    this._hasTarget = false;
    this._crossMapTarget = null;
    this._showExitGlow = false;
    this._noProgressTimer = 0;
    // deactivate all particles
    for (let i = 0; i < this._particles.length; i++) this._particles[i].active = false;
    for (let i = 0; i < this._bursts.length; i++) this._bursts[i].active = false;
    for (let i = 0; i < this._exitParticles.length; i++) this._exitParticles[i].active = false;
  }

  setPlayer(player) {
    this._player = player;
    if (player) {
      this._lastProgressX = player.x;
      this._lastProgressY = player.y;
    }
  }

  get hasTarget() {
    return this._hasTarget;
  }

  /** True when the real goal is in another map (used by companion to know to mention the exit). */
  get isCrossMap() {
    return this._crossMapTarget !== null;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(dt) {
    if (!this._hasTarget) return;

    this._time += dt;

    // Build path from player to target
    this._buildPath();

    // Update flowing trail particles
    this._updateTrailParticles(dt);

    // Update burst particles
    this._updateBurstParticles(dt);

    // Update exit glow particles
    if (this._showExitGlow) {
      this._updateExitParticles(dt);
    }

    // No-progress tracking
    this._updateNoProgress(dt);
  }

  _buildPath() {
    if (!this._player) { this._pathLen = 0; this._totalPathLen = 0; return; }

    const px = this._player.x | 0;
    const py = this._player.y | 0;
    const tx = this._targetX | 0;
    const ty = this._targetY | 0;
    const dx = Math.abs(tx - px);
    const dy = Math.abs(ty - py);

    if (dx < 8 && dy < 8) {
      this._pathLen = 0;
      this._totalPathLen = 0;
    } else if (dx < 8 || dy < 8) {
      // Straight line
      this._pathX[0] = px; this._pathY[0] = py;
      this._pathX[1] = tx; this._pathY[1] = ty;
      this._pathLen = 2;
    } else {
      // L-shaped path: player -> corner -> target
      this._pathX[0] = px; this._pathY[0] = py;
      this._pathX[1] = tx; this._pathY[1] = py;
      this._pathX[2] = tx; this._pathY[2] = ty;
      this._pathLen = 3;
    }

    // Compute total length
    let total = 0;
    for (let i = 1; i < this._pathLen; i++) {
      const sdx = this._pathX[i] - this._pathX[i - 1];
      const sdy = this._pathY[i] - this._pathY[i - 1];
      total += Math.sqrt(sdx * sdx + sdy * sdy);
    }
    this._totalPathLen = total;
  }

  _updateTrailParticles(dt) {
    if (this._pathLen < 2 || this._totalPathLen < 16) return;

    const speed = TRAIL_SPEED;

    // Move existing particles
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (!p.active) continue;
      p.dist += speed * dt;
      p.age += dt;
      if (p.dist >= p.maxDist || p.age >= p.maxAge) {
        p.active = false;
      }
    }

    // Spawn new particles
    this._spawnTimer += dt;
    if (this._spawnTimer >= TRAIL_SPAWN_INTERVAL) {
      this._spawnTimer -= TRAIL_SPAWN_INTERVAL;
      // Find an inactive slot
      for (let i = 0; i < this._particles.length; i++) {
        const p = this._particles[i];
        if (!p.active) {
          p.active = true;
          p.dist = 0;
          p.maxDist = this._totalPathLen;
          p.maxAge = this._totalPathLen / speed;
          p.age = 0;
          p.perpPhase = this._time * 3; // wave phase at spawn
          p.size = TRAIL_STAR_SIZE_MIN + Math.random() * (TRAIL_STAR_SIZE_MAX - TRAIL_STAR_SIZE_MIN);
          break;
        }
      }
    }
  }

  _updateBurstParticles(dt) {
    // Burst timer
    this._burstTimer += dt;
    if (this._burstTimer >= BEACON_BURST_INTERVAL) {
      this._burstTimer -= BEACON_BURST_INTERVAL;
      // Spawn burst
      for (let i = 0; i < BEACON_BURST_COUNT; i++) {
        const b = this._bursts[i];
        const angle = (i / BEACON_BURST_COUNT) * Math.PI * 2;
        b.active = true;
        b.x = 0; b.y = 0;
        b.vx = Math.cos(angle) * BEACON_BURST_SPEED;
        b.vy = Math.sin(angle) * BEACON_BURST_SPEED;
        b.age = 0;
      }
    }

    for (let i = 0; i < this._bursts.length; i++) {
      const b = this._bursts[i];
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.age += dt;
      if (b.age >= b.maxAge) b.active = false;
    }
  }

  _updateExitParticles(dt) {
    // Stagger spawn across particles using their phase offset
    this._exitParticleTimer += dt;

    const targetPx = this._exitTileX * 16;
    const targetPy = this._exitTileY * 16;

    for (let i = 0; i < this._exitParticles.length; i++) {
      const p = this._exitParticles[i];
      if (p.active) {
        p.age += dt;
        if (p.age >= p.maxAge) p.active = false;
      } else {
        // Spawn when the global timer passes this particle's phase slot
        const slot = p.phase; // 0..1
        if ((this._exitParticleTimer % 1.0) >= slot &&
            (this._exitParticleTimer % 1.0) < slot + dt) {
          p.active = true;
          p.age = 0;
          // Start up to 2 tiles away from exit center, random direction
          const angle = Math.random() * Math.PI * 2;
          const dist = (EXIT_GLOW_TILE_RANGE * 16) * (0.5 + Math.random() * 0.5);
          p.x = targetPx + Math.cos(angle) * dist;
          p.y = targetPy + Math.sin(angle) * dist;
          p.toX = targetPx;
          p.toY = targetPy;
        }
      }
    }
  }

  _updateNoProgress(dt) {
    if (!this._player) return;

    const px = this._player.x;
    const py = this._player.y;
    const moved = Math.sqrt(
      Math.pow(px - this._lastProgressX, 2) +
      Math.pow(py - this._lastProgressY, 2)
    );

    if (moved >= NO_PROGRESS_RESET_DIST) {
      // Player moved enough — reset timer and update anchor point
      this._noProgressTimer = 0;
      this._lastProgressX = px;
      this._lastProgressY = py;
    } else {
      this._noProgressTimer += dt;
      if (this._noProgressTimer >= NO_PROGRESS_THRESHOLD) {
        this._noProgressTimer = 0; // reset so it can fire again in another 15s
        if (this._onNoProgress) this._onNoProgress(this);
      }
    }
  }

  // ── Draw World Space (trail + beacon + exit glow) ──────────────────────────

  drawWorld(ctx, camX, camY) {
    if (!this._hasTarget) return;

    if (this._showExitGlow) {
      this._drawExitGlow(ctx, camX, camY);
    }

    this._drawFlowingTrail(ctx, camX, camY);
    this._drawGoalBeacon(ctx, camX, camY);
  }

  // ── Draw Screen Space (fairy guide) ────────────────────────────────────────

  drawScreen(ctx) {
    if (!this._hasTarget || this._targetOnScreen) return;
    this._drawFairyGuide(ctx);
  }

  // ── Exit Glow ──────────────────────────────────────────────────────────────

  _drawExitGlow(ctx, camX, camY) {
    const cx = (this._exitTileX * 16 - camX) | 0;
    const cy = (this._exitTileY * 16 - camY) | 0;
    const tileSize = 16;
    const radius = (EXIT_GLOW_TILE_RANGE * tileSize) + tileSize * 0.5;

    // Parse the quest color into components for rgba construction
    const color = this._questPathColor;

    // Pulse: 0.5s cycle, alpha oscillates between MIN and MAX
    const pulseT = (Math.sin(this._time * Math.PI * 2 * EXIT_GLOW_PULSE_HZ) + 1) * 0.5;
    const alpha = EXIT_GLOW_ALPHA_MIN + (EXIT_GLOW_ALPHA_MAX - EXIT_GLOW_ALPHA_MIN) * pulseT;

    ctx.save();

    // Radial glow gradient centered on archway
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, this._colorWithAlpha(color, alpha));
    grad.addColorStop(0.5, this._colorWithAlpha(color, alpha * 0.5));
    grad.addColorStop(1, this._colorWithAlpha(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Beckoning particles drifting toward exit
    for (let i = 0; i < this._exitParticles.length; i++) {
      const p = this._exitParticles[i];
      if (!p.active) continue;

      const t = p.age / p.maxAge;
      const px2 = (p.x + (p.toX - p.x) * t - camX) | 0;
      const py2 = (p.y + (p.toY - p.y) * t - camY) | 0;
      const pAlpha = Math.sin(t * Math.PI) * 0.7; // fade in/out

      ctx.globalAlpha = pAlpha;
      ctx.fillStyle = color;
      this._draw4PointStar(ctx, px2, py2, 2);
    }

    ctx.restore();
  }

  /** Convert a hex or named color + alpha into rgba(r,g,b,a) string. */
  _colorWithAlpha(color, alpha) {
    // Handle hex colors like '#ff4444'
    if (color && color[0] === '#') {
      const hex = color.slice(1);
      let r, g, b;
      if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        return `rgba(255,215,0,${alpha.toFixed(2)})`;
      }
      return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
    }
    // Fallback: return gold with requested alpha
    return `rgba(255,215,0,${alpha.toFixed(2)})`;
  }

  // ── Flowing Sparkle Trail ──────────────────────────────────────────────────

  _drawFlowingTrail(ctx, camX, camY) {
    if (this._pathLen < 2 || this._totalPathLen < 16) return;

    ctx.save();

    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (!p.active) continue;

      // Position along path
      const pos = this._getPositionOnPath(p.dist);
      if (!pos) continue;

      // Perpendicular offset for organic feel
      const perpOffset = Math.sin(p.perpPhase) * TRAIL_PERP_AMP;
      // pos.nx/ny = perpendicular normal at this point
      const wx = pos.x + pos.nx * perpOffset;
      const wy = pos.y + pos.ny * perpOffset;

      // Convert to screen
      const sx = (wx - camX) | 0;
      const sy = (wy - camY) | 0;

      // Cull off-screen
      if (sx < -10 || sx > LOGICAL_WIDTH + 10 || sy < -10 || sy > LOGICAL_HEIGHT + 10) continue;

      // Progress (0 = player, 1 = goal) for color gradient
      const progress = p.dist / p.maxDist;

      // Fade in/out
      let alpha = 1.0;
      if (p.age < TRAIL_FADE_DUR) {
        alpha = p.age / TRAIL_FADE_DUR;
      } else if (p.age > p.maxAge - TRAIL_FADE_DUR) {
        alpha = (p.maxAge - p.age) / TRAIL_FADE_DUR;
      }
      alpha = Math.max(0, Math.min(1, alpha)) * 0.85;

      // Color: golden near player -> pink near goal
      const r = Math.round(255);
      const g = Math.round(215 - progress * 85);  // 215 -> 130
      const b = Math.round(0 + progress * 200);    // 0 -> 200
      const color = `rgba(${r},${g},${b},${alpha})`;

      // Glow behind particle
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw 4-pointed star
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      this._draw4PointStar(ctx, sx, sy, p.size);
    }

    ctx.restore();
  }

  /** Returns { x, y, nx, ny } at distance d along the path, or null */
  _getPositionOnPath(d) {
    let remaining = d;
    for (let i = 1; i < this._pathLen; i++) {
      const sx = this._pathX[i - 1], sy = this._pathY[i - 1];
      const ex = this._pathX[i], ey = this._pathY[i];
      const dx = ex - sx, dy = ey - sy;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 0.001) continue;

      if (remaining <= segLen) {
        const t = remaining / segLen;
        // Direction along segment
        const dirX = dx / segLen;
        const dirY = dy / segLen;
        // Perpendicular (rotate 90 degrees)
        return {
          x: sx + dx * t,
          y: sy + dy * t,
          nx: -dirY,
          ny: dirX
        };
      }
      remaining -= segLen;
    }
    return null;
  }

  // ── Goal Beacon ────────────────────────────────────────────────────────────

  _drawGoalBeacon(ctx, camX, camY) {
    const screenX = (this._targetX - camX) | 0;
    const screenY = (this._targetY - camY) | 0;

    // Cache on-screen state for fairy guide
    this._targetOnScreen =
      screenX >= -30 && screenX <= LOGICAL_WIDTH + 30 &&
      screenY >= -30 && screenY <= LOGICAL_HEIGHT + 30;

    // Compute edge position for fairy guide
    if (!this._targetOnScreen) {
      const angle = Math.atan2(screenY - HALF_H, screenX - HALF_W);
      this._edgeAngle = angle;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const edgeX = cos !== 0 ? ((cos > 0 ? LOGICAL_WIDTH - EDGE_MARGIN : EDGE_MARGIN) - HALF_W) / cos : Infinity;
      const edgeY = sin !== 0 ? ((sin > 0 ? LOGICAL_HEIGHT - EDGE_MARGIN : EDGE_MARGIN) - HALF_H) / sin : Infinity;
      const t = Math.min(edgeX > 0 ? edgeX : Infinity, edgeY > 0 ? edgeY : Infinity);
      this._edgeX = (HALF_W + cos * t) | 0;
      this._edgeY = (HALF_H + sin * t) | 0;
    }

    if (!this._targetOnScreen) return;

    ctx.save();

    const bob = Math.sin(this._time * BEACON_BOB_SPEED) * BEACON_BOB_AMP;
    const gx = screenX;
    const gy = screenY + bob;

    // 1. Concentric pulsing rings
    for (let ring = 0; ring < BEACON_RING_COUNT; ring++) {
      // Each ring expands outward on a staggered cycle
      const phase = ((this._time / BEACON_RING_SPEED) + ring / BEACON_RING_COUNT) % 1.0;
      const radius = phase * BEACON_RING_MAX_R;
      const ringAlpha = (1.0 - phase) * 0.5;

      ctx.globalAlpha = ringAlpha;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gx, gy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Glow
    ctx.globalAlpha = 1;
    const glowPulse = 0.3 + Math.sin(this._time * 3) * 0.1;
    const glowGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 20);
    glowGrad.addColorStop(0, `rgba(255, 230, 100, ${glowPulse})`);
    glowGrad.addColorStop(0.5, `rgba(255, 200, 80, ${glowPulse * 0.4})`);
    glowGrad.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(gx, gy, 20, 0, Math.PI * 2);
    ctx.fill();

    // 3. Rotating star
    const rot = this._time * BEACON_STAR_ROT_SPEED;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#ffd700';
    ctx.translate(gx, gy);
    ctx.rotate(rot);
    this._drawStarShape(ctx, 0, 0, BEACON_STAR_OUTER, BEACON_STAR_INNER, BEACON_STAR_POINTS);
    ctx.fill();

    // White highlight
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fffbe8';
    this._drawStarShape(ctx, 0, 0, BEACON_STAR_OUTER * 0.55, BEACON_STAR_INNER * 0.45, BEACON_STAR_POINTS);
    ctx.fill();

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 4. Burst particles
    for (let i = 0; i < this._bursts.length; i++) {
      const b = this._bursts[i];
      if (!b.active) continue;
      const bAlpha = 1.0 - (b.age / b.maxAge);
      const bx = gx + b.x;
      const by = gy + b.y;
      ctx.globalAlpha = bAlpha * 0.8;
      ctx.fillStyle = '#ffd700';
      this._draw4PointStar(ctx, bx, by, 2);
    }

    ctx.restore();
  }

  // ── Fairy Guide (screen space) ─────────────────────────────────────────────

  _drawFairyGuide(ctx) {
    const x = this._edgeX;
    const baseY = this._edgeY;

    // Gentle bob
    const bob = Math.sin(this._time * FAIRY_BOB_SPEED) * FAIRY_BOB_AMP;
    const y = baseY + bob;

    // Wing flap: faster when off-screen (excitement)
    const flapSpeed = 8;
    const flapScale = 0.5 + Math.abs(Math.sin(this._time * flapSpeed)) * 0.5;

    ctx.save();

    // 1. Aura glow
    ctx.globalAlpha = 0.35;
    const aura = ctx.createRadialGradient(x, y, 0, x, y, FAIRY_GLOW_R);
    aura.addColorStop(0, 'rgba(255,136,204,0.5)');
    aura.addColorStop(0.6, 'rgba(200,100,220,0.2)');
    aura.addColorStop(1, 'rgba(200,100,220,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, FAIRY_GLOW_R, 0, Math.PI * 2);
    ctx.fill();

    // 2. Sparkle trail (fading dots behind fairy, opposite to goal direction)
    const trailAngle = this._edgeAngle + Math.PI; // away from goal
    for (let t = 0; t < FAIRY_TRAIL_COUNT; t++) {
      const dist = 5 + t * 4;
      const tx2 = x + Math.cos(trailAngle) * dist + Math.sin(this._time * 4 + t * 2) * 1.5;
      const ty2 = y + Math.sin(trailAngle) * dist + Math.cos(this._time * 3 + t * 1.7) * 1.5;
      const tAlpha = (1 - t / FAIRY_TRAIL_COUNT) * 0.6;
      const tSize = 1.5 - t * 0.25;

      ctx.globalAlpha = tAlpha;
      ctx.fillStyle = '#ffaadd';
      ctx.beginPath();
      ctx.arc(tx2, ty2, tSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Butterfly wings (two filled arcs)
    const halfWing = FAIRY_WING_SPAN * 0.5;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = FAIRY_COLOR;

    // Left wing
    ctx.beginPath();
    ctx.ellipse(x - 3, y - 1, halfWing * flapScale, halfWing * 0.7, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.ellipse(x + 3, y - 1, halfWing * flapScale, halfWing * 0.7, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Lower wings (smaller)
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#ff99cc';
    ctx.beginPath();
    ctx.ellipse(x - 2.5, y + 2, halfWing * 0.55 * flapScale, halfWing * 0.45, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 2.5, y + 2, halfWing * 0.55 * flapScale, halfWing * 0.45, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Body (bright dot)
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Body inner glow
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ffe0f0';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Chevron arrow pointing toward goal
    const chevAngle = this._edgeAngle;
    // Offset the chevron slightly toward the goal from the fairy
    const chevX = x + Math.cos(chevAngle) * 14;
    const chevY = y + Math.sin(chevAngle) * 14;

    ctx.globalAlpha = 0.8 + Math.sin(this._time * 4) * 0.15;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    // Draw > chevron rotated toward goal
    const cSize = CHEVRON_SIZE;
    const arm1X = chevX - Math.cos(chevAngle - 0.5) * cSize;
    const arm1Y = chevY - Math.sin(chevAngle - 0.5) * cSize;
    const arm2X = chevX - Math.cos(chevAngle + 0.5) * cSize;
    const arm2Y = chevY - Math.sin(chevAngle + 0.5) * cSize;
    ctx.moveTo(arm1X, arm1Y);
    ctx.lineTo(chevX, chevY);
    ctx.lineTo(arm2X, arm2Y);
    ctx.stroke();

    // 6. Gentle bounce toward edge (fairy nudges toward goal)
    // Already handled by the bob animation

    ctx.restore();
  }

  // ── Shape Helpers ──────────────────────────────────────────────────────────

  /** 4-pointed sparkle star */
  _draw4PointStar(ctx, x, y, size) {
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size * 0.3, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size * 0.3, y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x, y + size * 0.3);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y - size * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  /** N-pointed star shape (for goal beacon) */
  _drawStarShape(ctx, cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI / points) - Math.PI / 2;
      const r = (i % 2 === 0) ? outerR : innerR;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
}
