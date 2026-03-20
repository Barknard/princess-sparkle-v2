/**
 * SaveManager.js — localStorage save system for Princess Sparkle V2
 *
 * Stores under key 'sparkle-save'.
 * Schema: { playerName, companionId, level, hearts, questLog, journalEntries,
 *           accessories, gardenState, sessionCount, lastPlayDate }
 * Auto-saves on every set() call.
 */

const SAVE_KEY = 'sparkle-save';

/** Default save data (fresh game). */
const DEFAULT_SAVE = {
  playerName: '',
  companionId: '',
  level: 1,
  hearts: 0,
  questLog: {},
  journalEntries: [],
  accessories: [],
  gardenState: {},
  sessionCount: 0,
  lastPlayDate: ''
};

export default class SaveManager {
  constructor() {
    /** @type {object|null} Cached save data */
    this._data = null;
    this._load();
  }

  /**
   * Load save data from localStorage into cache.
   */
  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults to ensure all fields exist (forward compat)
        this._data = Object.assign({}, DEFAULT_SAVE, parsed);
      } else {
        this._data = null;
      }
    } catch (err) {
      console.warn('SaveManager: Failed to load save data:', err.message);
      this._data = null;
    }
  }

  /**
   * Persist current cached data to localStorage.
   */
  _persist() {
    if (!this._data) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this._data));
    } catch (err) {
      console.warn('SaveManager: Failed to save:', err.message);
    }
  }

  /**
   * Check if a save file exists.
   * @returns {boolean}
   */
  hasSave() {
    return this._data !== null;
  }

  /**
   * Get the entire save data object (or a specific field).
   * @param {string} [key] - Optional specific field to get
   * @returns {*} The save data or specific field value
   */
  get(key) {
    if (!this._data) return key ? undefined : null;
    if (key) return this._data[key];
    // Return a shallow copy to prevent accidental mutation
    return Object.assign({}, this._data);
  }

  /**
   * Set save data (partial update). Merges with existing data.
   * Auto-saves to localStorage immediately.
   * @param {object} partial - Fields to update
   */
  set(partial) {
    if (!this._data) {
      // Create new save from defaults + partial
      this._data = Object.assign({}, DEFAULT_SAVE, partial);
    } else {
      Object.assign(this._data, partial);
    }
    this._persist();
  }

  /**
   * Reset save data (delete the save file).
   */
  reset() {
    this._data = null;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      console.warn('SaveManager: Failed to remove save:', err.message);
    }
  }

  /**
   * Initialize a new game save with starting values.
   * @param {string} playerName
   * @param {string} companionId
   */
  newGame(playerName, companionId) {
    this._data = Object.assign({}, DEFAULT_SAVE, {
      playerName,
      companionId,
      sessionCount: 1,
      lastPlayDate: new Date().toISOString().split('T')[0]
    });
    this._persist();
  }

  /**
   * Increment session count and update last play date.
   * Call this at the start of each play session.
   */
  startSession() {
    if (!this._data) return;
    this._data.sessionCount++;
    this._data.lastPlayDate = new Date().toISOString().split('T')[0];
    this._persist();
  }
}
