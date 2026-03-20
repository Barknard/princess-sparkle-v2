// Service Worker for Princess Sparkle V2
// Strategy: Network-first with cache fallback
// On every launch, checks for new content and updates silently

const CACHE_NAME = 'princess-sparkle-v2';

// Files to pre-cache for offline play
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './update-checker.js',
  // Engine
  './game/main.js',
  './game/engine/Renderer.js',
  './game/engine/GameLoop.js',
  './game/engine/SceneManager.js',
  './game/engine/InputManager.js',
  './game/engine/AudioManager.js',
  './game/engine/AssetLoader.js',
  './game/engine/Camera.js',
  './game/engine/SaveManager.js',
  './game/engine/TransitionOverlay.js',
  // Scenes
  './game/scenes/TitleScene.js',
  './game/scenes/CompanionSelectScene.js',
  './game/scenes/OverworldScene.js',
  './game/scenes/DialogueScene.js',
  './game/scenes/QuestCompleteScene.js',
  './game/scenes/WindDownScene.js',
  // Entities
  './game/entities/Player.js',
  './game/entities/Companion.js',
  './game/entities/NPC.js',
  './game/entities/Animal.js',
  './game/entities/WorldObject.js',
  './game/entities/ParticleSystem.js',
  // Systems
  './game/systems/MovementSystem.js',
  './game/systems/CollisionSystem.js',
  './game/systems/DialogueSystem.js',
  './game/systems/QuestSystem.js',
  './game/systems/SessionGuard.js',
  './game/systems/WeatherSystem.js',
  // UI
  './game/ui/DialogueBox.js',
  './game/ui/HUD.js',
  './game/ui/QuestIndicator.js',
  './game/ui/TransitionOverlay.js',
  // World
  './game/world/TileMap.js',
  './game/world/TileSet.js',
  './game/world/WorldLoader.js',
  './game/world/LevelRegistry.js',
  // Companions
  './game/companions/Shimmer.js',
  './game/companions/Ember.js',
  './game/companions/Petal.js',
  './game/companions/Breeze.js',
  './game/companions/Pip.js',
  // Data
  './game/data/companions.js',
  './game/data/familyValues.js',
  './game/data/sfxIndex.js',
  './game/data/spriteIndex.js',
  // Levels (loaded on demand but cached)
  './game/levels/level-sparkle-village.js',
];

// Install: cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first, fall back to cache
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Listen for update check messages from the app
self.addEventListener('message', event => {
  if (event.data === 'CHECK_UPDATE') {
    self.registration.update();
  }
});
