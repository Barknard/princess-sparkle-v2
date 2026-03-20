/**
 * WorldLoader.js — Dynamic level loading for Princess Sparkle V2
 *
 * Uses dynamic import() to load level modules.
 * Caches loaded modules.
 * On load: passes data to TileMap, registers NPCs, loads quests.
 * Try/catch: failed loads show "That path is blocked today!" (never crash).
 */

export default class WorldLoader {
  constructor() {
    // Cache of loaded level modules
    /** @type {Map<string, object>} */
    this._cache = new Map();

    // Currently loaded level ID
    this.currentLevelId = null;

    // Callback for error display
    /** @type {Function|null} */
    this.onLoadError = null;
  }

  /**
   * Load a level by its module path.
   *
   * @param {string} levelId - Level identifier (e.g., 'sparkle-village')
   * @param {object} systems - Game systems to populate
   * @param {import('./TileMap.js').default} systems.tileMap
   * @param {import('./TileSet.js').default} systems.tileset
   * @param {import('../systems/CollisionSystem.js').default} systems.collision
   * @param {import('../systems/QuestSystem.js').default} systems.quests
   * @param {import('../systems/DialogueSystem.js').default} systems.dialogue
   * @returns {Promise<object|null>} The level data, or null on failure
   */
  async load(levelId, systems) {
    // Check cache first
    if (this._cache.has(levelId)) {
      const data = this._cache.get(levelId);
      this._applyLevel(data, systems);
      this.currentLevelId = levelId;
      return data;
    }

    // Build module path
    const modulePath = `../../levels/level-${levelId}.js`;

    try {
      const module = await import(modulePath);
      const data = module.default || module;

      // Validate minimal structure
      if (!data || !data.width || !data.height || !data.ground) {
        throw new Error(`Invalid level data for ${levelId}`);
      }

      // Cache it
      this._cache.set(levelId, data);

      // Apply to game systems
      this._applyLevel(data, systems);
      this.currentLevelId = levelId;

      return data;

    } catch (err) {
      // Never crash — show friendly message
      console.warn(`WorldLoader: Failed to load level "${levelId}":`, err);

      if (this.onLoadError) {
        this.onLoadError(levelId, 'That path is blocked today!');
      }

      return null;
    }
  }

  /**
   * Apply loaded level data to all game systems.
   *
   * @param {object} data - Level data module
   * @param {object} systems - Game systems
   */
  _applyLevel(data, systems) {
    // Set up tile map
    if (systems.tileMap && systems.tileset) {
      systems.tileMap.loadLevel(data, systems.tileset);
    }

    // Set up collision
    if (systems.collision && data.collision) {
      const collisionMap = data.collision instanceof Uint8Array
        ? data.collision
        : new Uint8Array(data.collision);
      systems.collision.setCollisionMap(collisionMap, data.width, data.height);
    }

    // Load quests
    if (systems.quests && data.quests) {
      systems.quests.loadQuests(data.quests);
    }

    // Load dialogues
    if (systems.dialogue && data.dialogues) {
      systems.dialogue.loadDialogues(data.dialogues);
    }
  }

  /**
   * Get the currently loaded level data from cache.
   * @returns {object|null}
   */
  getCurrentLevelData() {
    if (!this.currentLevelId) return null;
    return this._cache.get(this.currentLevelId) || null;
  }

  /**
   * Get NPC definitions from the current level.
   * @returns {Array<object>}
   */
  getNPCs() {
    const data = this.getCurrentLevelData();
    return (data && data.npcs) ? data.npcs : [];
  }

  /**
   * Get world object definitions from the current level.
   * @returns {Array<object>}
   */
  getWorldObjects() {
    const data = this.getCurrentLevelData();
    return (data && data.worldObjects) ? data.worldObjects : [];
  }

  /**
   * Get animal definitions from the current level.
   * @returns {Array<object>}
   */
  getAnimals() {
    const data = this.getCurrentLevelData();
    return (data && data.animals) ? data.animals : [];
  }

  /**
   * Get the player spawn position for the current level.
   * @returns {{x: number, y: number}}
   */
  getSpawnPoint() {
    const data = this.getCurrentLevelData();
    if (data && data.spawnX !== undefined && data.spawnY !== undefined) {
      return { x: data.spawnX, y: data.spawnY };
    }
    return { x: 5, y: 5 }; // Default fallback
  }

  /**
   * Clear the cache (e.g., on memory pressure).
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Check if a level is already cached.
   * @param {string} levelId
   * @returns {boolean}
   */
  isCached(levelId) {
    return this._cache.has(levelId);
  }
}
