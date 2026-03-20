/**
 * AudioManager.js — Web Audio API wrapper for Princess Sparkle V2
 *
 * Two gain nodes: bgmGain (0.35) and sfxGain (0.6).
 * iOS audio unlock pattern: resume AudioContext on first TAP.
 * BGM crossfade over 1500ms.
 * SFX: one-shot plays, max 1 simultaneous (queue, don't layer).
 * Never more than 1 SFX + ambient music playing.
 * Master mute. Format: MP3 for Safari/iOS.
 */

const DEFAULT_BGM_VOLUME = 0.35;
const DEFAULT_SFX_VOLUME = 0.6;
const BGM_CROSSFADE_MS = 1500;

export default class AudioManager {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;

    /** @type {GainNode|null} */
    this._masterGain = null;
    /** @type {GainNode|null} */
    this._bgmGain = null;
    /** @type {GainNode|null} */
    this._sfxGain = null;

    // BGM state
    /** @type {AudioBufferSourceNode|null} */
    this._currentBgmSource = null;
    this._currentBgmName = '';

    // SFX state — max 1 simultaneous
    /** @type {AudioBufferSourceNode|null} */
    this._currentSfxSource = null;
    this._sfxQueue = [];
    this._sfxPlaying = false;

    // Audio buffer cache (keyed by asset name)
    /** @type {Map<string, AudioBuffer>} */
    this._buffers = new Map();

    // iOS unlock state
    this._unlocked = false;
    this._muted = false;

    // Pre-bind
    this._onSfxEnded = this._onSfxEnded.bind(this);
  }

  /**
   * Initialize the AudioContext. Call once on startup.
   * Does NOT resume yet — that happens on first user interaction (iOS requirement).
   */
  init() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn('AudioManager: Web Audio API not supported');
      return;
    }

    this._ctx = new AudioCtx();

    // Build gain node chain: source → bgm/sfx gain → master gain → destination
    this._masterGain = this._ctx.createGain();
    this._masterGain.connect(this._ctx.destination);

    this._bgmGain = this._ctx.createGain();
    this._bgmGain.gain.value = DEFAULT_BGM_VOLUME;
    this._bgmGain.connect(this._masterGain);

    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = DEFAULT_SFX_VOLUME;
    this._sfxGain.connect(this._masterGain);
  }

  /**
   * iOS audio unlock — call this on the first user TAP.
   * Resumes the AudioContext which iOS suspends until user gesture.
   */
  unlock() {
    if (this._unlocked || !this._ctx) return;
    this._unlocked = true;

    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {
        // Silently handle — will retry on next interaction
        this._unlocked = false;
      });
    }
  }

  /**
   * Register a decoded AudioBuffer by name.
   * Called by AssetLoader after decoding audio files.
   * @param {string} name
   * @param {AudioBuffer} buffer
   */
  registerBuffer(name, buffer) {
    this._buffers.set(name, buffer);
  }

  /**
   * Decode an ArrayBuffer into an AudioBuffer.
   * @param {ArrayBuffer} arrayBuffer
   * @returns {Promise<AudioBuffer>}
   */
  async decodeAudio(arrayBuffer) {
    if (!this._ctx) return null;
    return this._ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * Play background music with crossfade.
   * If another BGM is playing, it fades out while the new one fades in.
   * @param {string} name - Asset name of the BGM
   * @param {boolean} [loop=true]
   */
  playBGM(name, loop = true) {
    if (!this._ctx || !this._bgmGain) return;
    if (this._currentBgmName === name) return; // already playing

    const buffer = this._buffers.get(name);
    if (!buffer) {
      console.warn(`AudioManager: BGM "${name}" not found`);
      return;
    }

    const now = this._ctx.currentTime;
    const fadeDuration = BGM_CROSSFADE_MS / 1000;

    // Fade out current BGM
    if (this._currentBgmSource) {
      const oldSource = this._currentBgmSource;
      const oldGain = this._ctx.createGain();
      // Reconnect old source through a temporary fade gain
      // (we can't disconnect easily, so we just ramp the bgmGain
      // and swap it; instead, use per-source gains)
      // Simpler approach: ramp bgmGain down, swap, ramp up
      this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, now);
      this._bgmGain.gain.linearRampToValueAtTime(0, now + fadeDuration / 2);

      // Stop old source after fadeout
      try { oldSource.stop(now + fadeDuration / 2); } catch (_) { /* already stopped */ }
    }

    // Create new source
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(this._bgmGain);

    // Schedule fade in
    const now2 = this._ctx.currentTime;
    const startDelay = this._currentBgmSource ? fadeDuration / 2 : 0;

    if (startDelay > 0) {
      // Wait for old BGM to fade out, then ramp in
      this._bgmGain.gain.setValueAtTime(0, now2 + startDelay);
      this._bgmGain.gain.linearRampToValueAtTime(
        this._muted ? 0 : DEFAULT_BGM_VOLUME,
        now2 + startDelay + fadeDuration / 2
      );
      source.start(now2 + startDelay * 0.8); // slight overlap for smooth crossfade
    } else {
      this._bgmGain.gain.setValueAtTime(this._muted ? 0 : DEFAULT_BGM_VOLUME, now2);
      source.start(0);
    }

    this._currentBgmSource = source;
    this._currentBgmName = name;
  }

  /**
   * Stop the current BGM with a fade out.
   * @param {number} [fadeMs=800]
   */
  stopBGM(fadeMs = 800) {
    if (!this._ctx || !this._currentBgmSource) return;

    const now = this._ctx.currentTime;
    const fadeDuration = fadeMs / 1000;

    this._bgmGain.gain.setValueAtTime(this._bgmGain.gain.value, now);
    this._bgmGain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    const source = this._currentBgmSource;
    try { source.stop(now + fadeDuration + 0.05); } catch (_) {}

    this._currentBgmSource = null;
    this._currentBgmName = '';
  }

  /**
   * Play a sound effect. Max 1 simultaneous SFX — queues if one is playing.
   * @param {string} name - Asset name of the SFX
   */
  playSFX(name) {
    if (!this._ctx || !this._sfxGain) return;

    const buffer = this._buffers.get(name);
    if (!buffer) {
      console.warn(`AudioManager: SFX "${name}" not found`);
      return;
    }

    if (this._sfxPlaying) {
      // Queue it (max queue size = 4 to prevent buildup)
      if (this._sfxQueue.length < 4) {
        this._sfxQueue.push(name);
      }
      return;
    }

    this._playOneSFX(buffer);
  }

  /**
   * Internal: play a single SFX buffer.
   * @param {AudioBuffer} buffer
   */
  _playOneSFX(buffer) {
    this._sfxPlaying = true;
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this._sfxGain);
    source.onended = this._onSfxEnded;
    source.start(0);
    this._currentSfxSource = source;
  }

  /** Called when a SFX finishes. Plays next in queue if any. */
  _onSfxEnded() {
    this._sfxPlaying = false;
    this._currentSfxSource = null;

    if (this._sfxQueue.length > 0) {
      const nextName = this._sfxQueue.shift();
      const buffer = this._buffers.get(nextName);
      if (buffer) {
        this._playOneSFX(buffer);
      }
    }
  }

  /**
   * Set BGM volume (0-1).
   * @param {number} vol
   */
  setBGMVolume(vol) {
    if (this._bgmGain) {
      this._bgmGain.gain.value = this._muted ? 0 : vol;
    }
  }

  /**
   * Set SFX volume (0-1).
   * @param {number} vol
   */
  setSFXVolume(vol) {
    if (this._sfxGain) {
      this._sfxGain.gain.value = this._muted ? 0 : vol;
    }
  }

  /**
   * Toggle master mute.
   * @param {boolean} [muted] - Force muted state, or toggle if undefined
   */
  mute(muted) {
    this._muted = muted !== undefined ? muted : !this._muted;
    if (this._masterGain) {
      this._masterGain.gain.value = this._muted ? 0 : 1;
    }
  }

  /** @returns {boolean} */
  get isMuted() {
    return this._muted;
  }

  /** @returns {AudioContext|null} */
  get context() {
    return this._ctx;
  }

  /** Clean up. */
  destroy() {
    this.stopBGM(0);
    if (this._ctx) {
      this._ctx.close().catch(() => {});
    }
  }
}
