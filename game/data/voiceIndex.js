/**
 * voiceIndex.js — Voice line loader for Princess Sparkle V2
 *
 * SMART LOADING: The game attempts to load any voice line by ID.
 * If the file exists at the expected path, it plays.
 * If not, it silently skips — no error, no crash.
 *
 * Convention: voice line ID "narrator_title_01" maps to:
 *   voice-script/audio/voice/narrator_title_01.mp3
 *
 * Eddie just drops MP3 files in that folder with the script ID as filename.
 * No code changes needed. The game figures it out.
 *
 * AUDIO PLAYBACK STRATEGY:
 *   1. Try HTML Audio element first (simple, works after user gesture)
 *   2. If autoplay blocks HTML Audio, fall back to Web Audio API
 *      (fetch + decodeAudioData) which works once AudioContext is unlocked
 *   3. If both fail, log the error and return 0 (game continues)
 */

const VOICE_BASE = './voice-script/audio/voice/';
const VOICE_EXT = '.mp3';

// Cache of voice lines we've confirmed exist (or confirmed missing)
const _cache = {};  // id → HTMLAudioElement | null
const _audioElements = {};  // id → HTMLAudioElement (reused)

// Web Audio API fallback cache
const _webAudioBuffers = {};  // id → AudioBuffer (decoded)

// Shared AudioContext reference (set via setAudioContext)
let _audioCtx = null;
let _voiceGain = null;

// Track whether user has interacted (for autoplay policy)
let _userHasInteracted = false;

// Queue of voice IDs that were blocked by autoplay — replay on unlock
const _pendingVoices = [];

/**
 * Register the AudioContext from AudioManager for Web Audio fallback.
 * Call once during game init, after AudioManager.init().
 * @param {AudioContext} ctx
 */
export function setAudioContext(ctx) {
  _audioCtx = ctx;
  if (_audioCtx) {
    _voiceGain = _audioCtx.createGain();
    _voiceGain.gain.value = 0.85; // voice volume (slightly louder than BGM)
    _voiceGain.connect(_audioCtx.destination);
  }
}

/**
 * Notify the voice system that a user gesture has occurred.
 * Unlocks HTML Audio autoplay and resumes AudioContext.
 * Call this on the first tap/click/touch anywhere.
 */
export function unlockVoiceAudio() {
  if (_userHasInteracted) return;
  _userHasInteracted = true;
  console.log('[Voice] Audio unlocked by user gesture');

  // Resume AudioContext if suspended
  if (_audioCtx && _audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }

  // Replay any pending voice lines that were blocked
  if (_pendingVoices.length > 0) {
    const nextId = _pendingVoices.shift();
    console.log(`[Voice] Replaying blocked voice: ${nextId}`);
    playVoice(nextId);
    // Clear remaining pending (only replay the most recent one)
    _pendingVoices.length = 0;
  }
}

/** @returns {boolean} Whether user has interacted (audio unlocked) */
export function isVoiceUnlocked() {
  return _userHasInteracted;
}

/**
 * Get the expected file path for a voice line ID.
 * Always returns a path — existence is checked at load time.
 */
export function getVoicePath(id) {
  return VOICE_BASE + id + VOICE_EXT;
}

/**
 * Try to load a voice line. Returns a Promise that resolves with
 * an Audio element if the file exists, or null if it doesn't.
 * Results are cached so each file is only probed once.
 */
export function loadVoice(id) {
  // Already cached
  if (_cache[id] !== undefined) {
    if (_cache[id] === null) return Promise.resolve(null);
    return Promise.resolve(_cache[id]);
  }

  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'auto';

    function onLoad() {
      audio.removeEventListener('canplaythrough', onLoad);
      audio.removeEventListener('error', onErr);
      _cache[id] = audio;
      _audioElements[id] = audio;
      resolve(audio);
    }

    function onErr(e) {
      audio.removeEventListener('canplaythrough', onLoad);
      audio.removeEventListener('error', onErr);
      console.warn(`[Voice] Failed to load "${id}" from ${getVoicePath(id)}:`, e.type || e);
      _cache[id] = null;
      resolve(null);
    }

    audio.addEventListener('canplaythrough', onLoad, { once: true });
    audio.addEventListener('error', onErr, { once: true });

    audio.src = getVoicePath(id);
    audio.load();
  });
}

/**
 * Load a voice line as a Web Audio buffer (fetch + decodeAudioData).
 * Used as fallback when HTML Audio autoplay is blocked.
 * @param {string} id
 * @returns {Promise<AudioBuffer|null>}
 */
async function _loadWebAudioBuffer(id) {
  if (_webAudioBuffers[id] !== undefined) {
    return _webAudioBuffers[id];
  }
  if (!_audioCtx) {
    console.warn(`[Voice] No AudioContext for Web Audio fallback (voice: ${id})`);
    return null;
  }

  try {
    const path = getVoicePath(id);
    const response = await fetch(path);
    if (!response.ok) {
      console.warn(`[Voice] Web Audio fetch failed for "${id}": HTTP ${response.status}`);
      _webAudioBuffers[id] = null;
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await _audioCtx.decodeAudioData(arrayBuffer);
    _webAudioBuffers[id] = audioBuffer;
    return audioBuffer;
  } catch (e) {
    console.warn(`[Voice] Web Audio decode failed for "${id}":`, e.message || e);
    _webAudioBuffers[id] = null;
    return null;
  }
}

/**
 * Play a voice line via Web Audio API (fallback path).
 * @param {AudioBuffer} buffer
 * @returns {number} duration in ms
 */
function _playViaWebAudio(buffer) {
  if (!_audioCtx || !_voiceGain) return 0;

  // Stop previous Web Audio voice if playing
  if (_currentWebAudioSource) {
    try { _currentWebAudioSource.stop(); } catch (_) {}
  }

  const source = _audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(_voiceGain);
  source.start(0);
  _currentWebAudioSource = source;
  source.onended = () => {
    if (_currentWebAudioSource === source) {
      _currentWebAudioSource = null;
    }
  };

  return (buffer.duration || 0) * 1000;
}

let _currentWebAudioSource = null;

/**
 * Play a voice line by ID.
 * If the file exists, plays it and returns the duration in ms.
 * If not, returns 0 (game continues without pause).
 *
 * Strategy:
 *   1. Try HTML Audio .play()
 *   2. If autoplay blocked, try Web Audio API fallback
 *   3. If both fail, queue for replay on next user gesture
 *
 * Usage in scenes/dialogue:
 *   const duration = await playVoice('narrator_title_01');
 *   // wait duration ms, then continue
 */
export async function playVoice(id) {
  console.log(`[Voice] playVoice("${id}") called — unlocked: ${_userHasInteracted}`);

  const audio = await loadVoice(id);
  if (!audio) {
    console.log(`[Voice] "${id}" not found or failed to load — skipping`);
    return 0;
  }

  // Strategy 1: Try HTML Audio element
  try {
    audio.currentTime = 0;
    await audio.play();
    console.log(`[Voice] Playing "${id}" via HTML Audio (${((audio.duration || 0) * 1000).toFixed(0)}ms)`);
    return (audio.duration || 0) * 1000;
  } catch (e) {
    console.warn(`[Voice] HTML Audio blocked for "${id}": ${e.name} — trying Web Audio fallback`);
  }

  // Strategy 2: Web Audio API fallback (works if AudioContext is unlocked)
  if (_audioCtx && _audioCtx.state === 'running') {
    try {
      const buffer = await _loadWebAudioBuffer(id);
      if (buffer) {
        const durationMs = _playViaWebAudio(buffer);
        console.log(`[Voice] Playing "${id}" via Web Audio API (${durationMs.toFixed(0)}ms)`);
        return durationMs;
      }
    } catch (e) {
      console.warn(`[Voice] Web Audio fallback failed for "${id}":`, e.message || e);
    }
  }

  // Strategy 3: Queue for replay after user gesture
  if (!_userHasInteracted) {
    console.log(`[Voice] Queuing "${id}" for replay after user gesture`);
    // Only keep the latest pending voice (don't pile up)
    _pendingVoices.length = 0;
    _pendingVoices.push(id);
  }

  return 0;
}

/**
 * Stop any currently playing voice line.
 */
export function stopVoice(id) {
  const audio = _audioElements[id];
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

/**
 * Stop ALL playing voice lines (both HTML Audio and Web Audio).
 */
export function stopAllVoice() {
  for (const id in _audioElements) {
    const audio = _audioElements[id];
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  }
  // Stop Web Audio voice if playing
  if (_currentWebAudioSource) {
    try { _currentWebAudioSource.stop(); } catch (_) {}
    _currentWebAudioSource = null;
  }
}

/**
 * Preload a batch of voice lines (for upcoming scene).
 * Silently skips any that don't exist.
 * Returns a map of { id: durationMs } for lines that loaded.
 */
export async function preloadVoices(ids) {
  const results = {};
  await Promise.all(ids.map(async (id) => {
    const audio = await loadVoice(id);
    if (audio) {
      results[id] = (audio.duration || 0) * 1000;
    }
  }));
  return results;
}

/**
 * Check if a voice line has been cached as existing.
 * Returns true/false/undefined (undefined = not checked yet).
 */
export function isVoiceCached(id) {
  if (_cache[id] === undefined) return undefined;
  return _cache[id] !== null;
}

/**
 * Get estimated duration of a voice line (if cached).
 * Returns 0 if not loaded or doesn't exist.
 */
export function getVoiceDuration(id) {
  const audio = _cache[id];
  if (!audio) return 0;
  return (audio.duration || 0) * 1000;
}

// ══════════════════════════════════════════════════════════════
// Known voice line IDs from the script (for reference/preloading)
// These are hints — the system works with ANY filename in the folder
// ══════════════════════════════════════════════════════════════

export const SCENE_VOICES = {
  title: [
    'narrator_title_01', 'narrator_title_02', 'narrator_title_03',
    'narrator_title_return_01', 'narrator_title_return_02', 'narrator_title_return_03',
  ],
  companionSelect: [
    'narrator_companion_intro_01', 'narrator_companion_intro_02',
    'narrator_companion_intro_03', 'narrator_companion_intro_04',
    'companion_shimmer_intro_01', 'companion_shimmer_intro_02',
    'companion_ember_intro_01', 'companion_ember_intro_02',
    'companion_petal_intro_01', 'companion_petal_intro_02',
    'companion_breeze_intro_01', 'companion_breeze_intro_02',
    'companion_pip_intro_01', 'companion_pip_intro_02',
    'narrator_companion_confirm_shimmer', 'narrator_companion_confirm_ember',
    'narrator_companion_confirm_petal', 'narrator_companion_confirm_breeze',
    'narrator_companion_confirm_pip', 'narrator_companion_confirm_02',
  ],
  villageArrival: [
    'narrator_village_arrive_01', 'narrator_village_arrive_02',
    'narrator_village_arrive_03', 'narrator_village_arrive_04',
    'narrator_village_arrive_05',
    'narrator_village_tutorial_01', 'narrator_village_tutorial_02',
    'narrator_village_tutorial_03',
    'companion_village_shimmer_01', 'companion_village_ember_01',
    'companion_village_petal_01', 'companion_village_breeze_01',
    'companion_village_pip_01',
    'companion_tutorial_shimmer_01', 'companion_tutorial_ember_01',
    'companion_tutorial_petal_01', 'companion_tutorial_breeze_01',
    'companion_tutorial_pip_01',
  ],
  questGrandma: [
    'narrator_grandma_approach_01',
    'npc_grandma_greeting_01', 'npc_grandma_greeting_02',
    'npc_grandma_quest_01', 'npc_grandma_quest_02', 'npc_grandma_quest_03',
    'narrator_quest_accept_01', 'narrator_quest_accept_02',
    'companion_walk_shimmer_01', 'companion_walk_ember_01',
    'companion_walk_petal_01', 'companion_walk_breeze_01',
    'companion_walk_pip_01',
    'narrator_lily_arrive_01',
    'npc_lily_receive_01', 'npc_lily_receive_02', 'npc_lily_thanks_01',
    'narrator_return_grandma_01',
    'npc_grandma_thanks_01', 'npc_grandma_thanks_02', 'npc_grandma_thanks_03',
    'narrator_quest_complete_01', 'narrator_quest_complete_02',
    'narrator_quest_complete_03',
  ],
  questFinn: [
    'narrator_finn_approach_01',
    'npc_finn_greeting_01', 'npc_finn_scared_01', 'npc_finn_scared_02',
    'narrator_finn_try_01', 'narrator_finn_try_02',
    'npc_finn_success_01', 'npc_finn_success_02',
    'narrator_finn_complete_01', 'narrator_finn_complete_02',
    'narrator_finn_complete_03', 'narrator_finn_complete_04',
  ],
  rainbowBridge: [
    'narrator_bridge_01', 'narrator_bridge_02',
    'narrator_bridge_piece_01', 'narrator_bridge_piece_02',
    'narrator_bridge_piece_03', 'narrator_bridge_piece_04',
    'narrator_bridge_piece_05', 'narrator_bridge_piece_06',
  ],
  windDown: [
    'narrator_sunset_01', 'narrator_winddown_recap',
    'narrator_winddown_hearts', 'narrator_winddown_goodbye',
    'companion_sunset_shimmer_01', 'companion_sunset_ember_01',
    'companion_sunset_petal_01', 'companion_sunset_breeze_01',
    'companion_sunset_pip_01',
    'companion_goodnight_shimmer_01', 'companion_goodnight_ember_01',
    'companion_goodnight_petal_01', 'companion_goodnight_breeze_01',
    'companion_goodnight_pip_01',
  ],
  whisperForest: [
    'narrator_forest_arrive_01', 'narrator_forest_arrive_02',
    'narrator_forest_arrive_03',
    'npc_owl_intro_01', 'npc_owl_intro_02', 'npc_owl_intro_03',
  ],
};
