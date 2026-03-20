/**
 * AssetLoader.js — Asset loading system for Princess Sparkle V2
 *
 * Queues images and audio, loads in parallel with Promise.all.
 * Reports progress 0-1 via callback.
 * Returns an assets registry keyed by name.
 * Error-tolerant: missing assets log a warning, don't crash.
 */

export default class AssetLoader {
  /**
   * @param {import('./AudioManager.js').default} audioManager
   */
  constructor(audioManager) {
    this._audioManager = audioManager;

    /** @type {Array<{name: string, url: string, type: 'image'|'audio'}>} */
    this._queue = [];

    /** @type {Map<string, HTMLImageElement|AudioBuffer>} */
    this._assets = new Map();
  }

  /**
   * Queue an image for loading.
   * @param {string} name - Key to retrieve the asset by
   * @param {string} url - Path to the image file
   * @returns {this} For chaining
   */
  addImage(name, url) {
    this._queue.push({ name, url, type: 'image' });
    return this;
  }

  /**
   * Queue an audio file for loading.
   * @param {string} name - Key to retrieve the asset by
   * @param {string} url - Path to the audio file (MP3 for iOS compatibility)
   * @returns {this} For chaining
   */
  addAudio(name, url) {
    this._queue.push({ name, url, type: 'audio' });
    return this;
  }

  /**
   * Load all queued assets in parallel.
   * @param {Function} [onProgress] - Called with (progress: number) where 0-1
   * @returns {Promise<Map<string, HTMLImageElement|AudioBuffer>>} Assets registry
   */
  async loadAll(onProgress) {
    const total = this._queue.length;
    if (total === 0) {
      if (onProgress) onProgress(1);
      return this._assets;
    }

    let loaded = 0;

    const reportProgress = () => {
      loaded++;
      if (onProgress) {
        onProgress(loaded / total);
      }
    };

    const promises = this._queue.map((item) => {
      if (item.type === 'image') {
        return this._loadImage(item.name, item.url).then(reportProgress);
      } else {
        return this._loadAudio(item.name, item.url).then(reportProgress);
      }
    });

    // Wait for all — errors are caught individually so one failure
    // doesn't block the rest
    await Promise.all(promises);

    // Clear the queue
    this._queue.length = 0;

    return this._assets;
  }

  /**
   * Get a loaded asset by name.
   * @param {string} name
   * @returns {HTMLImageElement|AudioBuffer|undefined}
   */
  get(name) {
    return this._assets.get(name);
  }

  /**
   * Check if an asset is loaded.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._assets.has(name);
  }

  /**
   * Load a single image.
   * @param {string} name
   * @param {string} url
   * @returns {Promise<void>}
   */
  _loadImage(name, url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this._assets.set(name, img);
        resolve();
      };
      img.onerror = () => {
        console.warn(`AssetLoader: Failed to load image "${name}" from ${url}`);
        resolve(); // Don't reject — error-tolerant
      };
      img.src = url;
    });
  }

  /**
   * Load a single audio file, decode it, and register with AudioManager.
   * @param {string} name
   * @param {string} url
   * @returns {Promise<void>}
   */
  async _loadAudio(name, url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`AssetLoader: HTTP ${response.status} loading audio "${name}" from ${url}`);
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this._audioManager.decodeAudio(arrayBuffer);
      if (audioBuffer) {
        this._assets.set(name, audioBuffer);
        this._audioManager.registerBuffer(name, audioBuffer);
      }
    } catch (err) {
      console.warn(`AssetLoader: Failed to load audio "${name}" from ${url}:`, err.message);
    }
  }
}
