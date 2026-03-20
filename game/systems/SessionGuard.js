/**
 * SessionGuard.js — Anti-addiction timer for Princess Sparkle V2
 *
 * Tracks totalPlayMs using GameLoop elapsed time.
 * 15 min: sunset palette shift begins.
 * 18 min: evening mode (darker, calmer).
 * 20 min: triggers WindDownScene.
 * Companion gentle reminders if playing past 20min (every 3 min).
 * Configurable thresholds via localStorage key 'sparkle-session-config'.
 * Tracks daily session count — after 2 sessions, wind-down at 15min instead.
 * NOT a hard stop — just increasingly gentle encouragement.
 */

// Default thresholds in milliseconds
const DEFAULT_SUNSET_MS = 15 * 60 * 1000;      // 15 minutes
const DEFAULT_EVENING_MS = 18 * 60 * 1000;      // 18 minutes
const DEFAULT_WINDDOWN_MS = 20 * 60 * 1000;     // 20 minutes
const DEFAULT_REMINDER_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// After 2+ sessions in a day, reduce thresholds
const REDUCED_WINDDOWN_MS = 15 * 60 * 1000;     // 15 minutes
const REDUCED_SUNSET_MS = 12 * 60 * 1000;       // 12 minutes
const REDUCED_EVENING_MS = 14 * 60 * 1000;      // 14 minutes

/** Session phases */
export const SessionPhase = {
  MORNING: 'MORNING',
  SUNSET: 'SUNSET',
  EVENING: 'EVENING',
  WINDDOWN: 'WINDDOWN'
};

const STORAGE_KEY = 'sparkle-session-config';
const SESSION_TRACKING_KEY = 'sparkle-session-tracking';

export default class SessionGuard {
  constructor() {
    // Current play time in ms
    this.totalPlayMs = 0;

    // Current session phase
    this.phase = SessionPhase.MORNING;

    // Reminder tracking
    this.lastReminderMs = 0;
    this.reminderCount = 0;

    // Thresholds (may be adjusted based on config and session count)
    this.sunsetMs = DEFAULT_SUNSET_MS;
    this.eveningMs = DEFAULT_EVENING_MS;
    this.winddownMs = DEFAULT_WINDDOWN_MS;
    this.reminderIntervalMs = DEFAULT_REMINDER_INTERVAL_MS;

    // Daily session tracking
    this.todaySessions = 0;
    this.lastSessionDate = '';

    // Callbacks
    /** @type {Function|null} Called when phase changes */
    this.onPhaseChange = null;
    /** @type {Function|null} Called when companion should remind */
    this.onReminder = null;
    /** @type {Function|null} Called when wind-down should trigger */
    this.onWindDown = null;

    // Winddown triggered flag (only fire once)
    this._winddownTriggered = false;

    // Load config and session history
    this._loadConfig();
    this._loadSessionTracking();
  }

  /**
   * Start a new session. Call when game starts or resumes.
   */
  startSession() {
    this.totalPlayMs = 0;
    this.phase = SessionPhase.MORNING;
    this.lastReminderMs = 0;
    this.reminderCount = 0;
    this._winddownTriggered = false;

    // Track this session
    const today = new Date().toISOString().slice(0, 10);
    if (this.lastSessionDate !== today) {
      this.todaySessions = 0;
      this.lastSessionDate = today;
    }
    this.todaySessions++;
    this._saveSessionTracking();

    // Adjust thresholds if 2+ sessions today
    if (this.todaySessions >= 3) {
      this.sunsetMs = REDUCED_SUNSET_MS;
      this.eveningMs = REDUCED_EVENING_MS;
      this.winddownMs = REDUCED_WINDDOWN_MS;
    } else {
      this._loadConfig(); // reload defaults or custom config
    }
  }

  /**
   * Update the session guard with elapsed game time.
   * Call every frame with the GameLoop's totalElapsedMs delta.
   *
   * @param {number} dt - Delta time in seconds
   * @returns {{phaseChanged: boolean, shouldRemind: boolean, newPhase: string}}
   */
  update(dt) {
    this.totalPlayMs += dt * 1000;

    const result = {
      phaseChanged: false,
      shouldRemind: false,
      newPhase: this.phase
    };

    // Check phase transitions
    const prevPhase = this.phase;

    if (this.totalPlayMs >= this.winddownMs) {
      this.phase = SessionPhase.WINDDOWN;

      // Trigger wind-down once
      if (!this._winddownTriggered) {
        this._winddownTriggered = true;
        if (this.onWindDown) this.onWindDown();
      }

      // Check for reminders past wind-down
      if (this.totalPlayMs - this.lastReminderMs >= this.reminderIntervalMs) {
        this.lastReminderMs = this.totalPlayMs;
        this.reminderCount++;
        result.shouldRemind = true;
        if (this.onReminder) this.onReminder(this.reminderCount);
      }
    } else if (this.totalPlayMs >= this.eveningMs) {
      this.phase = SessionPhase.EVENING;
    } else if (this.totalPlayMs >= this.sunsetMs) {
      this.phase = SessionPhase.SUNSET;
    } else {
      this.phase = SessionPhase.MORNING;
    }

    if (this.phase !== prevPhase) {
      result.phaseChanged = true;
      result.newPhase = this.phase;
      if (this.onPhaseChange) this.onPhaseChange(this.phase, prevPhase);
    }

    return result;
  }

  /**
   * Get the current palette tint for the session phase.
   * Used by the renderer to shift the world's color palette.
   *
   * @returns {{r: number, g: number, b: number, a: number}} Overlay tint
   */
  getPaletteTint() {
    switch (this.phase) {
      case SessionPhase.MORNING:
        return { r: 0, g: 0, b: 0, a: 0 }; // no tint
      case SessionPhase.SUNSET: {
        // Gradually warm tint (golden hour)
        const sunsetProgress = (this.totalPlayMs - this.sunsetMs) /
                               (this.eveningMs - this.sunsetMs);
        const t = Math.min(sunsetProgress, 1);
        return { r: 255, g: 180, b: 100, a: t * 0.12 };
      }
      case SessionPhase.EVENING:
      case SessionPhase.WINDDOWN: {
        // Deep warm / purple tint
        const eveningProgress = (this.totalPlayMs - this.eveningMs) /
                                (this.winddownMs - this.eveningMs);
        const t = Math.min(eveningProgress, 1);
        return { r: 100, g: 80, b: 160, a: 0.12 + t * 0.08 };
      }
      default:
        return { r: 0, g: 0, b: 0, a: 0 };
    }
  }

  /**
   * Get minutes played in current session.
   * @returns {number}
   */
  getMinutesPlayed() {
    return (this.totalPlayMs / 60000) | 0;
  }

  /**
   * Get progress toward wind-down (0 to 1).
   * @returns {number}
   */
  getSessionProgress() {
    return Math.min(this.totalPlayMs / this.winddownMs, 1);
  }

  /**
   * Load custom config from localStorage.
   */
  _loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const config = JSON.parse(raw);
        this.sunsetMs = config.sunsetMs || DEFAULT_SUNSET_MS;
        this.eveningMs = config.eveningMs || DEFAULT_EVENING_MS;
        this.winddownMs = config.winddownMs || DEFAULT_WINDDOWN_MS;
        this.reminderIntervalMs = config.reminderIntervalMs || DEFAULT_REMINDER_INTERVAL_MS;
      } else {
        this.sunsetMs = DEFAULT_SUNSET_MS;
        this.eveningMs = DEFAULT_EVENING_MS;
        this.winddownMs = DEFAULT_WINDDOWN_MS;
        this.reminderIntervalMs = DEFAULT_REMINDER_INTERVAL_MS;
      }
    } catch (e) {
      // localStorage may be unavailable — use defaults
      this.sunsetMs = DEFAULT_SUNSET_MS;
      this.eveningMs = DEFAULT_EVENING_MS;
      this.winddownMs = DEFAULT_WINDDOWN_MS;
      this.reminderIntervalMs = DEFAULT_REMINDER_INTERVAL_MS;
    }
  }

  /**
   * Load daily session tracking.
   */
  _loadSessionTracking() {
    try {
      const raw = localStorage.getItem(SESSION_TRACKING_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.lastSessionDate = data.date || '';
        this.todaySessions = data.count || 0;

        // Reset if it's a new day
        const today = new Date().toISOString().slice(0, 10);
        if (this.lastSessionDate !== today) {
          this.todaySessions = 0;
          this.lastSessionDate = today;
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Save daily session tracking.
   */
  _saveSessionTracking() {
    try {
      localStorage.setItem(SESSION_TRACKING_KEY, JSON.stringify({
        date: this.lastSessionDate,
        count: this.todaySessions
      }));
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Serialize session guard state.
   * @returns {object}
   */
  serialize() {
    return {
      totalPlayMs: this.totalPlayMs,
      todaySessions: this.todaySessions,
      lastSessionDate: this.lastSessionDate
    };
  }

  /**
   * Restore session guard state.
   * @param {object} data
   */
  deserialize(data) {
    if (!data) return;
    // Don't restore totalPlayMs — each session starts fresh
    this.todaySessions = data.todaySessions || 0;
    this.lastSessionDate = data.lastSessionDate || '';
  }
}
