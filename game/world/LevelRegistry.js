/**
 * LevelRegistry.js — Lightweight level manifest for Princess Sparkle V2
 *
 * OPTIONAL MANIFEST: This file lists known levels for preloading and
 * map screen display. The game can load ANY level-{id}.js file from
 * the levels/ folder even if it is not listed here.
 *
 * To add a new level:
 *   1. Create levels/level-{your-id}.js (auto-discovered by WorldLoader)
 *   2. Optionally add an entry here for preloading and map screen
 *
 * The game works fine without this file — WorldLoader uses convention-based
 * dynamic import as the primary loading mechanism.
 */

/**
 * Known levels for preloading and map screen.
 * Each entry provides metadata for UI display and asset preloading.
 *
 * @type {Array<{id: string, name: string, bgm?: string, description?: string}>}
 */
export const KNOWN_LEVELS = [
  {
    id: 'sparkle-village',
    name: 'Sparkle Village',
    bgm: 'bgm-village',
    description: 'A cozy village where kindness blooms',
  },
  {
    id: 'whisper-forest',
    name: 'Whisper Forest',
    bgm: 'bgm-forest',
    description: 'A mysterious forest full of gentle secrets',
  },
];

/**
 * Look up a known level by ID (for map screen metadata).
 * Returns null if the level is not in the manifest — this does NOT
 * mean the level cannot be loaded (WorldLoader discovers any level file).
 *
 * @param {string} levelId
 * @returns {{id: string, name: string, bgm?: string, description?: string}|null}
 */
export function getKnownLevel(levelId) {
  return KNOWN_LEVELS.find(l => l.id === levelId) || null;
}

/**
 * Get all known level IDs.
 * @returns {string[]}
 */
export function getKnownLevelIds() {
  return KNOWN_LEVELS.map(l => l.id);
}
