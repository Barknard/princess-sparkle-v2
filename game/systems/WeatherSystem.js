/**
 * WeatherSystem.js — Gentle weather changes for Princess Sparkle V2
 *
 * States: SUNNY (default), LIGHT_RAIN, BREEZY, FIREFLY_EVENING.
 * Sunny: butterflies active, flowers open.
 * Rain: puddles appear, worms pop up, frogs more active, princess gets umbrella.
 * Breezy: leaves blow, wind chimes ring, dandelion seeds drift.
 * Firefly: fireflies appear everywhere during sunset.
 * Weather never threatening — no storms, no dark skies.
 * Transitions are SLOW (30-60 second crossfade).
 */

/** Weather states */
export const WeatherState = {
  SUNNY: 'SUNNY',
  LIGHT_RAIN: 'LIGHT_RAIN',
  BREEZY: 'BREEZY',
  FIREFLY_EVENING: 'FIREFLY_EVENING'
};

// Transition duration in seconds
const TRANSITION_DURATION_MIN = 30;
const TRANSITION_DURATION_MAX = 60;

// Weather duration in seconds
const WEATHER_DURATION_MIN = 120; // 2 minutes
const WEATHER_DURATION_MAX = 300; // 5 minutes

// Rain particle config
const RAIN_DROP_INTERVAL = 3;   // frames between drops
const MAX_RAIN_DROPS = 30;

// Firefly config
const FIREFLY_SPAWN_INTERVAL = 0.5; // seconds
const MAX_FIREFLIES = 15;

// Leaf config
const LEAF_SPAWN_INTERVAL = 0.8;
const MAX_LEAVES = 10;

export default class WeatherSystem {
  constructor() {
    /** Current weather state */
    this.state = WeatherState.SUNNY;

    /** Weather we're transitioning to (null if not transitioning) */
    this.targetState = null;

    /** Transition progress 0-1 */
    this.transitionProgress = 0;
    this.transitionDuration = 0;

    /** Time remaining in current weather state (seconds) */
    this.weatherTimer = WEATHER_DURATION_MIN +
      Math.random() * (WEATHER_DURATION_MAX - WEATHER_DURATION_MIN);

    // Rain effect state
    /** @type {Array<{x: number, y: number, speed: number, active: boolean}>} */
    this.rainDrops = [];
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
      this.rainDrops.push({ x: 0, y: 0, speed: 0, active: false });
    }
    this.rainFrameCounter = 0;

    // Firefly state
    /** @type {Array<{x: number, y: number, vx: number, vy: number, brightness: number, phase: number, active: boolean}>} */
    this.fireflies = [];
    for (let i = 0; i < MAX_FIREFLIES; i++) {
      this.fireflies.push({ x: 0, y: 0, vx: 0, vy: 0, brightness: 0, phase: 0, active: false });
    }
    this.fireflyTimer = 0;

    // Leaf/wind state
    /** @type {Array<{x: number, y: number, vx: number, vy: number, rotation: number, active: boolean}>} */
    this.leaves = [];
    for (let i = 0; i < MAX_LEAVES; i++) {
      this.leaves.push({ x: 0, y: 0, vx: 0, vy: 0, rotation: 0, active: false });
    }
    this.leafTimer = 0;

    // Callbacks
    /** @type {Function|null} Called when weather changes */
    this.onWeatherChange = null;

    // View bounds (set by camera)
    this.viewLeft = 0;
    this.viewTop = 0;
    this.viewWidth = 480;
    this.viewHeight = 320;
  }

  /**
   * Force a weather state (used by session guard for firefly evening).
   * @param {string} state
   */
  setWeather(state) {
    if (this.state === state) return;
    this.targetState = state;
    this.transitionProgress = 0;
    this.transitionDuration = TRANSITION_DURATION_MIN +
      Math.random() * (TRANSITION_DURATION_MAX - TRANSITION_DURATION_MIN);
  }

  /**
   * Update weather system each frame.
   * @param {number} dt - Delta time in seconds
   * @param {object} camera - {x, y} in tile coords for view bounds
   */
  update(dt, camera) {
    // Update view bounds from camera
    if (camera) {
      this.viewLeft = camera.x * 16;
      this.viewTop = camera.y * 16;
    }

    // Handle transition
    if (this.targetState) {
      this.transitionProgress += dt / this.transitionDuration;
      if (this.transitionProgress >= 1) {
        this.state = this.targetState;
        this.targetState = null;
        this.transitionProgress = 0;
        this.weatherTimer = WEATHER_DURATION_MIN +
          Math.random() * (WEATHER_DURATION_MAX - WEATHER_DURATION_MIN);
        if (this.onWeatherChange) this.onWeatherChange(this.state);
      }
    } else {
      // Count down to next weather change
      this.weatherTimer -= dt;
      if (this.weatherTimer <= 0) {
        this._pickNextWeather();
      }
    }

    // Update weather effects based on current (or blended) state
    const activeState = this.targetState || this.state;

    switch (activeState) {
      case WeatherState.LIGHT_RAIN:
        this._updateRain(dt);
        break;
      case WeatherState.BREEZY:
        this._updateLeaves(dt);
        break;
      case WeatherState.FIREFLY_EVENING:
        this._updateFireflies(dt);
        break;
    }

    // Also update any leftover particles from previous state
    if (this.state !== activeState) {
      // Fade out old effects naturally (they just stop spawning)
      this._updateRain(dt);
      this._updateLeaves(dt);
      this._updateFireflies(dt);
    }
  }

  /**
   * Pick the next weather state randomly.
   */
  _pickNextWeather() {
    const options = [
      WeatherState.SUNNY,
      WeatherState.SUNNY,      // Sunny is more common
      WeatherState.LIGHT_RAIN,
      WeatherState.BREEZY
    ];

    let next;
    do {
      next = options[(Math.random() * options.length) | 0];
    } while (next === this.state);

    this.setWeather(next);
  }

  /** Update rain drops. */
  _updateRain(dt) {
    const isRaining = this.state === WeatherState.LIGHT_RAIN ||
                      this.targetState === WeatherState.LIGHT_RAIN;

    // Spawn new drops
    if (isRaining) {
      this.rainFrameCounter++;
      if (this.rainFrameCounter >= RAIN_DROP_INTERVAL) {
        this.rainFrameCounter = 0;
        this._spawnRainDrop();
      }
    }

    // Update existing drops
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
      const drop = this.rainDrops[i];
      if (!drop.active) continue;
      drop.y += drop.speed * dt * 60;
      if (drop.y > this.viewTop + this.viewHeight + 10) {
        drop.active = false;
      }
    }
  }

  /** Spawn a single rain drop. */
  _spawnRainDrop() {
    for (let i = 0; i < MAX_RAIN_DROPS; i++) {
      const drop = this.rainDrops[i];
      if (drop.active) continue;
      drop.active = true;
      drop.x = this.viewLeft + Math.random() * this.viewWidth;
      drop.y = this.viewTop - 5;
      drop.speed = 2 + Math.random() * 2;
      return;
    }
  }

  /** Update leaves for breezy weather. */
  _updateLeaves(dt) {
    const isBreezy = this.state === WeatherState.BREEZY ||
                     this.targetState === WeatherState.BREEZY;

    if (isBreezy) {
      this.leafTimer += dt;
      if (this.leafTimer >= LEAF_SPAWN_INTERVAL) {
        this.leafTimer -= LEAF_SPAWN_INTERVAL;
        this._spawnLeaf();
      }
    }

    for (let i = 0; i < MAX_LEAVES; i++) {
      const leaf = this.leaves[i];
      if (!leaf.active) continue;
      leaf.x += leaf.vx * dt * 60;
      leaf.y += leaf.vy * dt * 60;
      leaf.rotation += dt * 2;
      if (leaf.x > this.viewLeft + this.viewWidth + 20 ||
          leaf.y > this.viewTop + this.viewHeight + 20) {
        leaf.active = false;
      }
    }
  }

  /** Spawn a leaf. */
  _spawnLeaf() {
    for (let i = 0; i < MAX_LEAVES; i++) {
      const leaf = this.leaves[i];
      if (leaf.active) continue;
      leaf.active = true;
      leaf.x = this.viewLeft - 10;
      leaf.y = this.viewTop + Math.random() * this.viewHeight * 0.6;
      leaf.vx = 1 + Math.random() * 1.5;
      leaf.vy = 0.3 + Math.random() * 0.5;
      leaf.rotation = Math.random() * Math.PI * 2;
      return;
    }
  }

  /** Update fireflies. */
  _updateFireflies(dt) {
    const isFirefly = this.state === WeatherState.FIREFLY_EVENING ||
                      this.targetState === WeatherState.FIREFLY_EVENING;

    if (isFirefly) {
      this.fireflyTimer += dt;
      if (this.fireflyTimer >= FIREFLY_SPAWN_INTERVAL) {
        this.fireflyTimer -= FIREFLY_SPAWN_INTERVAL;
        this._spawnFirefly();
      }
    }

    for (let i = 0; i < MAX_FIREFLIES; i++) {
      const ff = this.fireflies[i];
      if (!ff.active) continue;

      ff.phase += dt * 2;
      ff.brightness = 0.4 + Math.sin(ff.phase) * 0.4;
      ff.x += ff.vx * dt * 60;
      ff.y += ff.vy * dt * 60;

      // Gentle random drift
      ff.vx += (Math.random() - 0.5) * 0.02;
      ff.vy += (Math.random() - 0.5) * 0.02;
      ff.vx *= 0.98;
      ff.vy *= 0.98;

      // Deactivate if far from view
      if (ff.x < this.viewLeft - 30 || ff.x > this.viewLeft + this.viewWidth + 30 ||
          ff.y < this.viewTop - 30 || ff.y > this.viewTop + this.viewHeight + 30) {
        ff.active = false;
      }
    }
  }

  /** Spawn a firefly. */
  _spawnFirefly() {
    for (let i = 0; i < MAX_FIREFLIES; i++) {
      const ff = this.fireflies[i];
      if (ff.active) continue;
      ff.active = true;
      ff.x = this.viewLeft + Math.random() * this.viewWidth;
      ff.y = this.viewTop + Math.random() * this.viewHeight;
      ff.vx = (Math.random() - 0.5) * 0.3;
      ff.vy = (Math.random() - 0.5) * 0.3;
      ff.brightness = 0.5;
      ff.phase = Math.random() * Math.PI * 2;
      return;
    }
  }

  /**
   * Draw weather effects.
   * @param {import('../engine/Renderer.js').default} renderer
   * @param {object} camera
   */
  draw(renderer, camera) {
    const ctx = renderer.ctx;
    const camPxX = camera.x * 16;
    const camPxY = camera.y * 16;

    // Get transition alpha for blending
    const alpha = this.targetState ? this.transitionProgress : 1;

    // Rain
    if (this.state === WeatherState.LIGHT_RAIN || this.targetState === WeatherState.LIGHT_RAIN) {
      const rainAlpha = this.state === WeatherState.LIGHT_RAIN ? 1 : alpha;
      ctx.globalAlpha = rainAlpha * 0.6;
      ctx.fillStyle = '#aaccee';
      for (let i = 0; i < MAX_RAIN_DROPS; i++) {
        const drop = this.rainDrops[i];
        if (!drop.active) continue;
        const sx = (drop.x - camPxX) | 0;
        const sy = (drop.y - camPxY) | 0;
        ctx.fillRect(sx, sy, 1, 3);
      }
    }

    // Leaves
    if (this.state === WeatherState.BREEZY || this.targetState === WeatherState.BREEZY) {
      const leafAlpha = this.state === WeatherState.BREEZY ? 1 : alpha;
      ctx.globalAlpha = leafAlpha * 0.8;

      for (let i = 0; i < MAX_LEAVES; i++) {
        const leaf = this.leaves[i];
        if (!leaf.active) continue;
        const sx = (leaf.x - camPxX) | 0;
        const sy = (leaf.y - camPxY) | 0;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(leaf.rotation);
        // Simple leaf shape: green oval
        ctx.fillStyle = i % 2 === 0 ? '#88bb44' : '#aa8833';
        ctx.fillRect(-2, -1, 4, 2);
        ctx.fillRect(-1, -2, 2, 4);
        ctx.restore();
      }
    }

    // Fireflies
    if (this.state === WeatherState.FIREFLY_EVENING || this.targetState === WeatherState.FIREFLY_EVENING) {
      for (let i = 0; i < MAX_FIREFLIES; i++) {
        const ff = this.fireflies[i];
        if (!ff.active) continue;
        const sx = (ff.x - camPxX) | 0;
        const sy = (ff.y - camPxY) | 0;

        // Glow
        ctx.globalAlpha = ff.brightness * 0.3;
        ctx.fillStyle = '#ffff88';
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();

        // Bright center
        ctx.globalAlpha = ff.brightness;
        ctx.fillStyle = '#ffffcc';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
    }

    ctx.globalAlpha = 1;

    // Weather tint overlay
    if (this.state === WeatherState.LIGHT_RAIN) {
      ctx.fillStyle = 'rgba(100, 120, 150, 0.06)';
      ctx.fillRect(0, 0, renderer.constructor === Object ? 480 : 480, 320);
    }
  }

  /**
   * Check if it's currently raining.
   * @returns {boolean}
   */
  isRaining() {
    return this.state === WeatherState.LIGHT_RAIN;
  }

  /**
   * Check if it's currently breezy.
   * @returns {boolean}
   */
  isBreezy() {
    return this.state === WeatherState.BREEZY;
  }

  /**
   * Check if it's firefly evening.
   * @returns {boolean}
   */
  isFireflyEvening() {
    return this.state === WeatherState.FIREFLY_EVENING;
  }
}
