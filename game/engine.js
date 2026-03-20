// Princess Sparkle V2 — Game Engine
// Lightweight canvas game loop with touch-first controls
// Designed for iPad, anti-addictive pacing

const Engine = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  scale: 1, // pixel scale for crisp pixel art
  lastTime: 0,
  scenes: {},
  activeScene: null,
  transitioning: false,

  // Gentle timing — no rush
  targetFPS: 30, // lower FPS = calmer feel, saves battery
  frameInterval: 1000 / 30,
  accumulator: 0,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Crisp pixel art rendering
    this.ctx.imageSmoothingEnabled = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Touch input
    Touch.init(this.canvas);

    // Start gentle game loop
    this.lastTime = performance.now();
    requestAnimationFrame(t => this.loop(t));

    return this;
  },

  resize() {
    const dpr = window.devicePixelRatio || 1;
    // Game renders at a fixed logical resolution for pixel art consistency
    // Then scales up to fill the screen
    const logicalW = 480;
    const logicalH = 320;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // Scale to fit while maintaining aspect ratio
    this.scale = Math.floor(Math.min(screenW / logicalW, screenH / logicalH));
    if (this.scale < 1) this.scale = 1;

    this.width = logicalW;
    this.height = logicalH;

    this.canvas.width = logicalW * this.scale;
    this.canvas.height = logicalH * this.scale;
    this.canvas.style.width = (logicalW * this.scale) + 'px';
    this.canvas.style.height = (logicalH * this.scale) + 'px';

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  },

  loop(now) {
    requestAnimationFrame(t => this.loop(t));

    const dt = now - this.lastTime;
    this.lastTime = now;

    // Cap delta to prevent spiral of death
    const cappedDt = Math.min(dt, 100);

    if (this.activeScene && !this.transitioning) {
      const scene = this.scenes[this.activeScene];
      if (scene.update) scene.update(cappedDt / 1000); // pass seconds
      if (scene.draw) scene.draw(this.ctx, this.width, this.height);
    }

    // Draw transition overlay if active
    if (this.transitioning) {
      this._drawTransition();
    }

    // Reset touch state at end of frame
    Touch.endFrame();
  },

  // Register a scene
  addScene(name, scene) {
    this.scenes[name] = scene;
    if (scene.init) scene.init(this);
  },

  // Gentle scene transition — slow iris wipe or fade
  switchScene(name, type = 'fade', durationMs = 800) {
    if (!this.scenes[name]) return;
    this.transitioning = true;
    this._transType = type;
    this._transDuration = durationMs;
    this._transStart = performance.now();
    this._transFrom = this.activeScene;
    this._transTo = name;
    this._transHalf = false;
  },

  _drawTransition() {
    const elapsed = performance.now() - this._transStart;
    const progress = Math.min(elapsed / this._transDuration, 1);

    // At halfway point, swap scenes
    if (progress >= 0.5 && !this._transHalf) {
      this._transHalf = true;
      this.activeScene = this._transTo;
      const scene = this.scenes[this.activeScene];
      if (scene.enter) scene.enter(this);
    }

    // Draw current scene underneath
    const scene = this.scenes[this.activeScene];
    if (scene && scene.draw) scene.draw(this.ctx, this.width, this.height);

    const ctx = this.ctx;

    if (this._transType === 'fade') {
      // Gentle fade through soft pink
      const alpha = progress < 0.5
        ? Ease.inOutCubic(progress * 2)
        : 1 - Ease.inOutCubic((progress - 0.5) * 2);
      ctx.fillStyle = `rgba(255, 220, 255, ${alpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (this._transType === 'iris') {
      // Iris wipe — circle closes then opens
      const cx = this.width / 2;
      const cy = this.height / 2;
      const maxR = Math.hypot(cx, cy);
      const r = progress < 0.5
        ? maxR * (1 - Ease.inOutCubic(progress * 2))
        : maxR * Ease.inOutCubic((progress - 0.5) * 2);

      ctx.save();
      ctx.fillStyle = '#1a0a2e';
      ctx.beginPath();
      ctx.rect(0, 0, this.width, this.height);
      ctx.arc(cx, cy, Math.max(r, 0.5), 0, Math.PI * 2, true);
      ctx.fill();
      ctx.restore();
    }

    if (progress >= 1) {
      this.transitioning = false;
    }
  }
};

// Easing functions — always gentle, never jarring
const Ease = {
  inOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; },
  inOutQuad(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; },
  outBack(t) { const c = 1.70158; return 1 + (c+1) * Math.pow(t-1, 3) + c * Math.pow(t-1, 2); },
  outElastic(t) {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10*t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  }
};

// Touch input system — designed for small fingers on iPad
const Touch = {
  x: 0, y: 0,          // current position (logical coords)
  pressed: false,       // is finger down right now
  tapped: false,        // was there a tap this frame
  held: false,          // has finger been held > 400ms
  swipe: null,          // 'up'|'down'|'left'|'right' or null
  _startX: 0, _startY: 0,
  _startTime: 0,
  _down: false,
  _tappedThisFrame: false,
  _swipeThisFrame: null,

  init(canvas) {
    const self = this;
    const toLogical = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / Engine.scale,
        y: (clientY - rect.top) / Engine.scale
      };
    };

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      const p = toLogical(t.clientX, t.clientY);
      self.x = p.x; self.y = p.y;
      self._startX = p.x; self._startY = p.y;
      self._startTime = performance.now();
      self._down = true;
      self.pressed = true;
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      const p = toLogical(t.clientX, t.clientY);
      self.x = p.x; self.y = p.y;
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const duration = performance.now() - self._startTime;
      const dx = self.x - self._startX;
      const dy = self.y - self._startY;
      const dist = Math.hypot(dx, dy);

      if (dist < 20 && duration < 400) {
        // Tap (not a swipe, not a hold)
        self._tappedThisFrame = true;
      } else if (dist > 30) {
        // Swipe
        if (Math.abs(dx) > Math.abs(dy)) {
          self._swipeThisFrame = dx > 0 ? 'right' : 'left';
        } else {
          self._swipeThisFrame = dy > 0 ? 'down' : 'up';
        }
      }

      self._down = false;
      self.pressed = false;
    }, { passive: false });

    // Mouse fallback for testing
    canvas.addEventListener('mousedown', e => {
      const p = toLogical(e.clientX, e.clientY);
      self.x = p.x; self.y = p.y;
      self._startX = p.x; self._startY = p.y;
      self._startTime = performance.now();
      self._down = true;
      self.pressed = true;
    });
    canvas.addEventListener('mousemove', e => {
      if (!self._down) return;
      const p = toLogical(e.clientX, e.clientY);
      self.x = p.x; self.y = p.y;
    });
    canvas.addEventListener('mouseup', e => {
      const duration = performance.now() - self._startTime;
      const dx = self.x - self._startX;
      const dy = self.y - self._startY;
      const dist = Math.hypot(dx, dy);
      if (dist < 20 && duration < 400) self._tappedThisFrame = true;
      else if (dist > 30) {
        if (Math.abs(dx) > Math.abs(dy)) self._swipeThisFrame = dx > 0 ? 'right' : 'left';
        else self._swipeThisFrame = dy > 0 ? 'down' : 'up';
      }
      self._down = false;
      self.pressed = false;
    });
  },

  endFrame() {
    this.tapped = this._tappedThisFrame;
    this.swipe = this._swipeThisFrame;
    this._tappedThisFrame = false;
    this._swipeThisFrame = null;
    this.held = this._down && (performance.now() - this._startTime > 400);
  },

  // Helper: is point inside a rectangle?
  inRect(rx, ry, rw, rh) {
    return this.x >= rx && this.x <= rx + rw && this.y >= ry && this.y <= ry + rh;
  }
};
