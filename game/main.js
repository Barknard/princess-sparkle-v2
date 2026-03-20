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
import TileSet from './world/TileSet.js';
import TileMap from './world/TileMap.js';
import TitleScene from './scenes/TitleScene.js';
import CompanionSelectScene from './scenes/CompanionSelectScene.js';
import OverworldScene from './scenes/OverworldScene.js';
import DialogueScene from './scenes/DialogueScene.js';
import QuestCompleteScene from './scenes/QuestCompleteScene.js';
import WindDownScene from './scenes/WindDownScene.js';
import sparkleVillage from './levels/level-sparkle-village.js';

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

// ── Tileset and TileMap (Kenney Tiny Town) ────────────────────────────────

const townTileset = new TileSet(16);
const dungeonTileset = new TileSet(16);
const tileMap = new TileMap();

// Define water animation (tile 122 cycles through nearby water tiles)
townTileset.defineAnimation(122, [122, 110, 122, 109]);

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
  transitionOverlay,
  townTileset,
  dungeonTileset,
  tileMap
};

// Make accessible for debugging in dev console
if (typeof window !== 'undefined') {
  window.__game = game;
}

// ── Game loop wiring ───────────────────────────────────────────────────────

function update(dt) {
  // Process input events first
  inputManager.processEvents();

  // Update animated tiles
  tileMap.update(dt);

  // Update the active scene stack
  sceneManager.update(dt);
}

function draw() {
  // Clear the canvas
  renderer.clear();

  // Draw all visible scenes (including transition overlay)
  sceneManager.draw(renderer);
}

// ── Register scenes ────────────────────────────────────────────────────────

sceneManager.setGame(game);
sceneManager.register('Title', () => new TitleScene());
sceneManager.register('CompanionSelect', () => new CompanionSelectScene());
sceneManager.register('Overworld', () => new OverworldScene());
sceneManager.register('Dialogue', () => new DialogueScene());
sceneManager.register('QuestComplete', () => new QuestCompleteScene());
sceneManager.register('WindDown', () => new WindDownScene());

// ── Load Kenney tilesets and start ────────────────────────────────────────

async function boot() {
  try {
    // Load the Kenney Tiny Town tileset PNG
    await townTileset.load('./sprites/town/tilemap_packed.png');
    console.log(`Town tileset loaded: ${townTileset.cols}x${townTileset.rows} tiles`);
  } catch (err) {
    console.warn('Failed to load town tileset, game will use fallback:', err);
  }

  try {
    // Load the dungeon tileset for cave/indoor areas
    await dungeonTileset.load('./sprites/dungeon/tilemap_packed.png');
    console.log(`Dungeon tileset loaded: ${dungeonTileset.cols}x${dungeonTileset.rows} tiles`);
  } catch (err) {
    console.warn('Failed to load dungeon tileset:', err);
  }

  // Pre-load the first level into the TileMap
  if (townTileset.loaded) {
    tileMap.loadLevel(sparkleVillage, townTileset);
    console.log(`Level "${sparkleVillage.name}" loaded: ${sparkleVillage.width}x${sparkleVillage.height}`);
  }

  // Start with TitleScene
  const titleScene = new TitleScene();
  titleScene.init(game);
  sceneManager.push(titleScene);
  gameLoop.start(update, draw);
}

boot();

export default game;
