/**
 * main.js — Entry point for Princess Sparkle V2
 *
 * Creates canvas, initializes all engine systems, and starts the game loop.
 * This is loaded as an ES module from index.html.
 */

import GameLoop from './engine/GameLoop.js';
import Renderer from './engine/Renderer.js';
import SceneManager from './engine/SceneManager.js';
import InputManager, { InputEvent } from './engine/InputManager.js';
import AudioManager from './engine/AudioManager.js';
import AssetLoader from './engine/AssetLoader.js';
import Camera from './engine/Camera.js';
import SaveManager from './engine/SaveManager.js';
import TransitionOverlay from './engine/TransitionOverlay.js';

// ── Bootstrap ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('game');
if (!canvas) {
  throw new Error('Missing <canvas id="game"> in the document.');
}

// ── Initialize engine systems ──────────────────────────────────────────────

const renderer = new Renderer(canvas);
const audioManager = new AudioManager();
audioManager.init();

const assetLoader = new AssetLoader(audioManager);
const camera = new Camera();
const saveManager = new SaveManager();
const transitionOverlay = new TransitionOverlay();
const sceneManager = new SceneManager(transitionOverlay);
const inputManager = new InputManager(canvas, renderer);
const gameLoop = new GameLoop();

// ── iOS audio unlock on first tap ──────────────────────────────────────────

inputManager.on(InputEvent.TAP, function unlockAudio() {
  audioManager.unlock();
  // Only need to do this once, but keeping the listener is harmless
  // since unlock() is a no-op after the first call.
});

// ── Expose engine systems as a global game object ──────────────────────────
// Scenes and other modules can import from engine/ directly, but this
// provides a convenient single reference for wiring.

const game = {
  canvas,
  renderer,
  audioManager,
  assetLoader,
  camera,
  saveManager,
  sceneManager,
  inputManager,
  gameLoop,
  transitionOverlay
};

// Make accessible for debugging in dev console
if (typeof window !== 'undefined') {
  window.__game = game;
}

// ── Game loop wiring ───────────────────────────────────────────────────────

function update(dt) {
  // Process input events first
  inputManager.processEvents();

  // Update the active scene stack
  sceneManager.update(dt);
}

function draw() {
  // Clear the canvas
  renderer.clear();

  // Draw all visible scenes (including transition overlay)
  sceneManager.draw(renderer);
}

// ── Placeholder boot scene ─────────────────────────────────────────────────
// This is a minimal scene so the engine has something to display immediately.
// It will be replaced by TitleScene once scenes are built.

const BootScene = {
  _timer: 0,
  _sparkleAlpha: 0,

  init() {
    this._timer = 0;
    this._sparkleAlpha = 0;
  },

  enter() {},
  exit() {},

  update(dt) {
    this._timer += dt;
    // Gentle pulsing sparkle (matches OPENING-STORYBOARD MOMENT 0)
    this._sparkleAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this._timer * 2));
  },

  draw(r) {
    // Soft pink background (#ffe0ec) per the storyboard
    r.fillBackground('#ffe0ec');

    // Center sparkle indicator
    r.save();
    r.setAlpha(this._sparkleAlpha);
    r.fillRect(232, 152, 16, 16, '#ffffff');
    r.restore();

    // Engine ready text (temporary — will be replaced by proper title scene)
    r.drawText('Princess Sparkle V2', 240, 140, {
      font: '10px monospace',
      color: '#9b59b6',
      align: 'center',
      baseline: 'bottom'
    });

    r.drawText('Engine Ready', 240, 180, {
      font: '8px monospace',
      color: '#c39bd3',
      align: 'center',
      baseline: 'top'
    });
  }
};

// ── Start! ─────────────────────────────────────────────────────────────────

sceneManager.push(BootScene);
gameLoop.start(update, draw);

export default game;
