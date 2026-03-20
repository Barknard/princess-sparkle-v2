/**
 * Princess Sparkle V2 - Sound Effects Index
 *
 * Maps sound IDs to file paths for all game SFX.
 * See audio/sfx/SOURCES.md for licensing and attribution details.
 *
 * AUTO-DISCOVERY: If an SFX ID isn't in this index, the system tries
 * to load it by convention: audio/sfx/{category}/{id}.mp3
 * Drop a new sound file in the right folder and it just works.
 *
 * Audio specs: MP3, 44100 Hz, mono, 64 kbps, normalized to -12dB
 * All frequencies filtered to 80-4000 Hz range (child-safe).
 */

import { tryLoadAudio } from './assetDiscovery.js';

export const SFX = {
  // === Movement ===
  footstepGrass:      './audio/sfx/movement/footstep-grass.mp3',
  footstepPath:       './audio/sfx/movement/footstep-path.mp3',
  splash:             './audio/sfx/movement/splash.mp3',

  // === Social ===
  npcTalk:            './audio/sfx/social/npc-talk.mp3',
  dialogueAdvance:    './audio/sfx/social/dialogue-advance.mp3',

  // === Items ===
  pickup:             './audio/sfx/items/pickup.mp3',
  deliver:            './audio/sfx/items/deliver.mp3',

  // === Quest ===
  questAccept:        './audio/sfx/quest/quest-accept.mp3',
  questComplete:      './audio/sfx/quest/quest-complete.mp3',

  // === Reward ===
  heartEarned:        './audio/sfx/reward/heart-earned.mp3',
  levelUp:            './audio/sfx/reward/level-up.mp3',
  bridgePiece:        './audio/sfx/reward/bridge-piece.mp3',

  // === Companion ===
  trailShimmer:       './audio/sfx/companion/trail-shimmer.mp3',
  companionSpeak:     './audio/sfx/companion/companion-speak.mp3',
  evolution:          './audio/sfx/companion/evolution.mp3',

  // === World (Tappable Objects) ===
  flowerTap:          './audio/sfx/world/flower-tap.mp3',
  waterPlop:          './audio/sfx/world/water-plop.mp3',
  treeRustle:         './audio/sfx/world/tree-rustle.mp3',
  mailbox:            './audio/sfx/world/mailbox.mp3',
  mushroomBoing:      './audio/sfx/world/mushroom-boing.mp3',
  crystalTone:        './audio/sfx/world/crystal-tone.mp3',

  // === Animal ===
  catPurr:            './audio/sfx/animal/cat-purr.mp3',
  dogBark:            './audio/sfx/animal/dog-bark.mp3',
  birdTweet:          './audio/sfx/animal/bird-tweet.mp3',
  frogRibbit:         './audio/sfx/animal/frog-ribbit.mp3',
  duckQuack:          './audio/sfx/animal/duck-quack.mp3',  // TODO: replace placeholder with real duck quack

  // === Silly ===
  whoops:             './audio/sfx/silly/whoops.mp3',
  sneeze:             './audio/sfx/silly/sneeze.mp3',
  bonk:               './audio/sfx/silly/bonk.mp3',

  // === Music (Interactive) ===
  steppingStoneC:     './audio/sfx/music/stepping-stone-C.mp3',
  steppingStoneD:     './audio/sfx/music/stepping-stone-D.mp3',
  steppingStoneE:     './audio/sfx/music/stepping-stone-E.mp3',
  steppingStoneF:     './audio/sfx/music/stepping-stone-F.mp3',
  steppingStoneG:     './audio/sfx/music/stepping-stone-G.mp3',
  steppingStoneA:     './audio/sfx/music/stepping-stone-A.mp3',
  drumLog:            './audio/sfx/music/drum-log.mp3',

  // === Session ===
  kindnessEncounter:  './audio/sfx/session/kindness-encounter.mp3',
  winddown:           './audio/sfx/session/winddown.mp3',
  goodnight:          './audio/sfx/session/goodnight.mp3',
};

/**
 * Sound categories for batch loading and volume control.
 * Volumes match the WORLD-LIFE.md Sound Design Master Table.
 */
export const SFX_CATEGORIES = {
  movement:  { keys: ['footstepGrass', 'footstepPath', 'splash'],              volume: 0.25 },
  social:    { keys: ['npcTalk', 'dialogueAdvance'],                           volume: 0.40 },
  items:     { keys: ['pickup', 'deliver'],                                    volume: 0.38 },
  quest:     { keys: ['questAccept', 'questComplete'],                         volume: 0.45 },
  reward:    { keys: ['heartEarned', 'levelUp', 'bridgePiece'],               volume: 0.50 },
  companion: { keys: ['trailShimmer', 'companionSpeak', 'evolution'],          volume: 0.35 },
  world:     { keys: ['flowerTap', 'waterPlop', 'treeRustle', 'mailbox', 'mushroomBoing', 'crystalTone'], volume: 0.32 },
  animal:    { keys: ['catPurr', 'dogBark', 'birdTweet', 'frogRibbit', 'duckQuack'], volume: 0.30 },
  silly:     { keys: ['whoops', 'sneeze', 'bonk'],                            volume: 0.35 },
  music:     { keys: ['steppingStoneC', 'steppingStoneD', 'steppingStoneE', 'steppingStoneF', 'steppingStoneG', 'steppingStoneA', 'drumLog'], volume: 0.40 },
  session:   { keys: ['kindnessEncounter', 'winddown', 'goodnight'],           volume: 0.40 },
};

/**
 * Stepping stone notes in ascending order for melody playback.
 */
export const STEPPING_STONE_SCALE = [
  'steppingStoneC',
  'steppingStoneD',
  'steppingStoneE',
  'steppingStoneF',
  'steppingStoneG',
  'steppingStoneA',
];

// ══════════════════════════════════════════════════════════════
// Auto-discovery fallback
// ══════════════════════════════════════════════════════════════

// Cache for discovered SFX not in the index
const _discoveredSFX = {};

/**
 * SFX category folders — used for convention-based auto-discovery.
 * When an SFX ID isn't found in the index, we try each category folder.
 */
const SFX_CATEGORY_FOLDERS = [
  'movement', 'social', 'items', 'quest', 'reward',
  'companion', 'world', 'animal', 'silly', 'music', 'session',
];

/**
 * Get the path for an SFX ID.
 *
 * Fast path: looks up the hardcoded SFX index first.
 * Fallback: if not found, returns null (use discoverSFX for auto-discovery).
 *
 * @param {string} id - SFX identifier (e.g. 'footstepGrass')
 * @returns {string|null} File path or null
 */
export function getSFXPath(id) {
  if (SFX[id]) return SFX[id];
  if (_discoveredSFX[id]) return _discoveredSFX[id];
  return null;
}

/**
 * Try to auto-discover an SFX file by convention.
 *
 * If the ID is in the index, returns its path immediately.
 * If not, tries audio/sfx/{category}/{id}.mp3 for each known category.
 * If a specific category is provided, only tries that one.
 *
 * Results are cached so each ID is only probed once.
 *
 * @param {string} id - SFX identifier (e.g. 'bell-chime')
 * @param {string} [category] - Optional category hint (e.g. 'world')
 * @returns {Promise<HTMLAudioElement|null>}
 */
export async function discoverSFX(id, category) {
  // Fast path: already in index
  if (SFX[id]) {
    try {
      return await tryLoadAudio(SFX[id]);
    } catch (err) {
      console.warn(`sfxIndex: Failed to load indexed SFX "${id}":`, err);
      return null;
    }
  }

  // Already discovered
  if (_discoveredSFX[id] !== undefined) {
    if (_discoveredSFX[id] === null) return null;
    try {
      return await tryLoadAudio(_discoveredSFX[id]);
    } catch (err) {
      return null;
    }
  }

  // Try specific category first if provided
  const categoriesToTry = category
    ? [category, ...SFX_CATEGORY_FOLDERS.filter(c => c !== category)]
    : SFX_CATEGORY_FOLDERS;

  for (const cat of categoriesToTry) {
    const path = `./audio/sfx/${cat}/${id}.mp3`;
    try {
      const audio = await tryLoadAudio(path);
      if (audio) {
        _discoveredSFX[id] = path;
        console.log(`sfxIndex: Auto-discovered SFX "${id}" at ${path}`);
        return audio;
      }
    } catch (err) {
      // Continue to next category
    }
  }

  // Not found in any category
  _discoveredSFX[id] = null;
  console.warn(`sfxIndex: SFX "${id}" not found in index or by convention`);
  return null;
}
