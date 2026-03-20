/**
 * assetDiscovery.js — Unified auto-discovery asset loader for Princess Sparkle V2
 *
 * DROP-AND-PLAY: Place assets in the correct folder with the right name,
 * and the game picks them up on next deploy. No code changes needed.
 * If an asset doesn't exist, the game silently continues.
 *
 * Convention paths:
 *   Voice:     voice-script/audio/voice/{id}.mp3
 *   SFX:       audio/sfx/{category}/{name}.mp3
 *   BGM:       audio/bgm/{name}.mp3
 *   Sprites:   sprites/{name}.png
 *   Tilesets:  sprites/tilesets/{name}.png
 *   Portraits: sprites/portraits/{name}.png
 *   JSON:      data/{name}.json
 *
 * All loaders cache results so each path is only probed once.
 * All loaders return null on failure — never crash.
 */

// ══════════════════════════════════════════════════════════════
// Cache: path → asset (Image, Audio, Object) or null
// ══════════════════════════════════════════════════════════════
const _cache = new Map();

// ══════════════════════════════════════════════════════════════
// Core loaders
// ══════════════════════════════════════════════════════════════

/**
 * Try to load an image from a path.
 * Returns a Promise that resolves with an Image element, or null if it fails.
 * Results are cached — each path is only probed once.
 *
 * @param {string} path - Relative path to the image (e.g. 'sprites/cat.png')
 * @returns {Promise<HTMLImageElement|null>}
 */
export function tryLoadImage(path) {
  if (_cache.has(path)) {
    return Promise.resolve(_cache.get(path));
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();

      img.addEventListener('load', function onLoad() {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        _cache.set(path, img);
        resolve(img);
      }, { once: true });

      img.addEventListener('error', function onError() {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        _cache.set(path, null);
        resolve(null);
      }, { once: true });

      img.src = path;
    } catch (err) {
      console.warn(`assetDiscovery: Failed to create image for "${path}":`, err);
      _cache.set(path, null);
      resolve(null);
    }
  });
}

/**
 * Try to load an audio file from a path.
 * Returns a Promise that resolves with an Audio element, or null if it fails.
 * Results are cached — each path is only probed once.
 *
 * @param {string} path - Relative path to the audio (e.g. 'audio/sfx/world/bell.mp3')
 * @returns {Promise<HTMLAudioElement|null>}
 */
export function tryLoadAudio(path) {
  if (_cache.has(path)) {
    return Promise.resolve(_cache.get(path));
  }

  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      audio.preload = 'auto';

      audio.addEventListener('canplaythrough', function onLoad() {
        audio.removeEventListener('canplaythrough', onLoad);
        audio.removeEventListener('error', onError);
        _cache.set(path, audio);
        resolve(audio);
      }, { once: true });

      audio.addEventListener('error', function onError() {
        audio.removeEventListener('canplaythrough', onLoad);
        audio.removeEventListener('error', onError);
        _cache.set(path, null);
        resolve(null);
      }, { once: true });

      audio.src = path;
      audio.load();
    } catch (err) {
      console.warn(`assetDiscovery: Failed to create audio for "${path}":`, err);
      _cache.set(path, null);
      resolve(null);
    }
  });
}

/**
 * Try to load a JSON file from a path.
 * Returns a Promise that resolves with the parsed object, or null if it fails.
 * Results are cached — each path is only probed once.
 *
 * @param {string} path - Relative path to the JSON file (e.g. 'data/config.json')
 * @returns {Promise<object|null>}
 */
export async function tryLoadJSON(path) {
  if (_cache.has(path)) {
    return _cache.get(path);
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      _cache.set(path, null);
      return null;
    }
    const data = await response.json();
    _cache.set(path, data);
    return data;
  } catch (err) {
    console.warn(`assetDiscovery: Failed to load JSON "${path}":`, err);
    _cache.set(path, null);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// Convention-based helpers
// ══════════════════════════════════════════════════════════════

/**
 * Try to load a sound effect by category and name.
 * Convention: audio/sfx/{category}/{name}.mp3
 *
 * @param {string} category - SFX category folder (e.g. 'world', 'animal')
 * @param {string} name - Sound name (e.g. 'bell-chime')
 * @returns {Promise<HTMLAudioElement|null>}
 */
export function tryLoadSFX(category, name) {
  return tryLoadAudio(`./audio/sfx/${category}/${name}.mp3`);
}

/**
 * Try to load background music by name.
 * Convention: audio/bgm/{name}.mp3
 *
 * @param {string} name - BGM name (e.g. 'bgm-village')
 * @returns {Promise<HTMLAudioElement|null>}
 */
export function tryLoadBGM(name) {
  return tryLoadAudio(`./audio/bgm/${name}.mp3`);
}

/**
 * Try to load a sprite image by name.
 * Convention: sprites/{name}.png
 *
 * @param {string} name - Sprite name (e.g. 'cat')
 * @returns {Promise<HTMLImageElement|null>}
 */
export function tryLoadSprite(name) {
  return tryLoadImage(`./sprites/${name}.png`);
}

/**
 * Try to load a tileset image by name.
 * Convention: sprites/tilesets/{name}.png
 *
 * @param {string} name - Tileset name (e.g. 'village-tiles')
 * @returns {Promise<HTMLImageElement|null>}
 */
export function tryLoadTileset(name) {
  return tryLoadImage(`./sprites/tilesets/${name}.png`);
}

/**
 * Try to load a portrait image by name.
 * Convention: sprites/portraits/{name}.png
 *
 * @param {string} name - Portrait name (e.g. 'grandma')
 * @returns {Promise<HTMLImageElement|null>}
 */
export function tryLoadPortrait(name) {
  return tryLoadImage(`./sprites/portraits/${name}.png`);
}

// ══════════════════════════════════════════════════════════════
// Cache management
// ══════════════════════════════════════════════════════════════

/**
 * Check if a path has been probed (cached as asset or null).
 * @param {string} path
 * @returns {boolean}
 */
export function isCached(path) {
  return _cache.has(path);
}

/**
 * Check if a cached path resolved to a real asset (not null).
 * Returns undefined if not yet probed.
 * @param {string} path
 * @returns {boolean|undefined}
 */
export function assetExists(path) {
  if (!_cache.has(path)) return undefined;
  return _cache.get(path) !== null;
}

/**
 * Get a cached asset directly. Returns undefined if not probed yet.
 * @param {string} path
 * @returns {*}
 */
export function getCached(path) {
  return _cache.get(path);
}

/**
 * Clear the entire asset cache (e.g. on memory pressure or scene change).
 */
export function clearCache() {
  _cache.clear();
}

/**
 * Get the number of cached entries (for debugging/telemetry).
 * @returns {number}
 */
export function cacheSize() {
  return _cache.size;
}

/**
 * Preload a batch of assets in parallel. Silently skips failures.
 * Returns a map of { path: asset } for assets that loaded successfully.
 *
 * @param {Array<{path: string, type: 'image'|'audio'|'json'}>} entries
 * @returns {Promise<Map<string, *>>}
 */
export async function preloadBatch(entries) {
  const results = new Map();
  const loaders = {
    image: tryLoadImage,
    audio: tryLoadAudio,
    json: tryLoadJSON,
  };

  await Promise.all(entries.map(async ({ path, type }) => {
    const loader = loaders[type];
    if (!loader) {
      console.warn(`assetDiscovery: Unknown asset type "${type}" for "${path}"`);
      return;
    }
    try {
      const asset = await loader(path);
      if (asset !== null) {
        results.set(path, asset);
      }
    } catch (err) {
      console.warn(`assetDiscovery: Preload failed for "${path}":`, err);
    }
  }));

  return results;
}
