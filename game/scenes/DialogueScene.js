/**
 * DialogueScene.js — Voice-driven dialogue overlay for Princess Sparkle V2
 *
 * Transparent overlay — the overworld renders behind it.
 * Rounded rectangle panel in the bottom third of the screen.
 * NPC portrait sprite (40x40) on the left.
 * Voice plays automatically via AudioManager (no text needed — pre-literate player).
 * Pulsing glow on dialogue box while voice plays.
 * Tap to advance OR auto-advance after voice + 2s pause.
 * Choice buttons shown as large icon buttons (80px min touch target).
 * Passes quest triggers to QuestSystem on completion.
 *
 * Canvas only. No DOM.
 */

import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from '../engine/Renderer.js';
import DialogueBox from '../ui/DialogueBox.js';

// ---- Constants --------------------------------------------------------------

const AUTO_ADVANCE_DELAY_S = 2.0;  // seconds after voice finishes before auto-advance
const VOICE_ESTIMATE_S = 3.0;      // estimated voice line duration (fallback)

// ---- DialogueScene ----------------------------------------------------------

export default class DialogueScene {
  constructor() {
    // Systems
    this._audioManager = null;
    this._sceneManager = null;
    this._questSystem = null;
    this._inputManager = null;
    this._assetLoader = null;

    // Dialogue box UI component
    this._dialogueBox = new DialogueBox();

    // Current dialogue sequence
    /** @type {Array<{voiceId: string, portrait: HTMLImageElement|null, portraitSrc: object|null, choices: Array|null, onComplete: Function|null}>} */
    this._lines = [];
    this._lineIndex = 0;

    // Timing
    this._voicePlaying = false;
    this._voiceDuration = 0;       // estimated duration of current voice line
    this._voiceTimer = 0;          // time since voice started
    this._waitTimer = 0;           // wait timer after voice ends
    this._autoAdvanceReady = false;

    // NPC data for this dialogue
    this._npcId = '';

    // Callback when entire dialogue is done
    /** @type {Function|null} */
    this._onDialogueComplete = null;

    // Whether this dialogue triggers a quest
    this._questTrigger = null;
  }

  // ---- Lifecycle ------------------------------------------------------------

  /**
   * @param {object} systems
   */
  init(systems) {
    this._audioManager = systems.audioManager || null;
    this._sceneManager = systems.sceneManager || null;
    this._questSystem = systems.questSystem || null;
    this._inputManager = systems.inputManager || null;
    this._assetLoader = systems.assetLoader || null;
  }

  /**
   * Enter the dialogue overlay.
   * @param {object} [params]
   * @param {string} params.npcId — which NPC is speaking
   * @param {Array<object>} params.lines — array of dialogue line objects
   * @param {object|null} params.questTrigger — quest data to fire on completion
   * @param {Function|null} params.onComplete — callback when dialogue ends
   */
  enter(params) {
    const p = params || {};
    this._npcId = p.npcId || '';
    this._lines = p.lines || [];
    this._questTrigger = p.questTrigger || null;
    this._onDialogueComplete = p.onComplete || null;
    this._lineIndex = 0;

    // Reset state
    this._voicePlaying = false;
    this._voiceTimer = 0;
    this._waitTimer = 0;
    this._autoAdvanceReady = false;

    // Show dialogue box
    this._dialogueBox.hideImmediate();

    // Start first line
    if (this._lines.length > 0) {
      this._startLine(0);
    }
  }

  exit() {
    this._dialogueBox.hideImmediate();
    this._lines = [];
  }

  // ---- Update ---------------------------------------------------------------

  /**
   * @param {number} dt — seconds
   */
  update(dt) {
    this._dialogueBox.update(dt);

    if (this._lineIndex >= this._lines.length) return;

    // Track voice playback timing
    if (this._voicePlaying) {
      this._voiceTimer += dt;

      // Check if voice has finished (estimated)
      if (this._voiceTimer >= this._voiceDuration) {
        this._voicePlaying = false;
        this._dialogueBox.setVoicePlaying(false);
        this._waitTimer = 0;
      }
    } else {
      // Wait period after voice ends
      this._waitTimer += dt;
      if (this._waitTimer >= AUTO_ADVANCE_DELAY_S) {
        this._autoAdvanceReady = true;
      }
    }

    // Auto-advance
    if (this._autoAdvanceReady && !this._hasChoices()) {
      this._advanceLine();
    }

    // Handle input
    this._handleInput();
  }

  _handleInput() {
    if (!this._inputManager || !this._inputManager.tapped) return;

    const tx = this._inputManager.x;
    const ty = this._inputManager.y;

    // Check choice buttons first
    if (this._hasChoices()) {
      const choiceId = this._dialogueBox.hitTestChoice(tx, ty);
      if (choiceId !== null) {
        this._onChoiceSelected(choiceId);
        return;
      }
    }

    // Tap anywhere to advance (if voice is done or playing)
    if (!this._hasChoices()) {
      this._advanceLine();
    }
  }

  // ---- Line management ------------------------------------------------------

  _startLine(index) {
    if (index >= this._lines.length) {
      this._endDialogue();
      return;
    }

    this._lineIndex = index;
    const line = this._lines[index];

    // Show dialogue box with portrait
    this._dialogueBox.show(line.portrait || null, line.portraitSrc || null);

    // Play voice
    this._voicePlaying = true;
    this._voiceTimer = 0;
    this._waitTimer = 0;
    this._autoAdvanceReady = false;
    this._dialogueBox.setVoicePlaying(true);

    // Estimate voice duration (real AudioManager would provide actual duration)
    this._voiceDuration = line.duration || VOICE_ESTIMATE_S;

    if (this._audioManager && line.voiceId) {
      this._audioManager.play(line.voiceId);
    }

    // Set up choices if this line has them
    if (line.choices && line.choices.length > 0) {
      this._dialogueBox.setChoices(line.choices);
    } else {
      this._dialogueBox.clearChoices();
    }
  }

  _advanceLine() {
    // If voice is still playing, skip to end of voice (queue next)
    if (this._voicePlaying) {
      this._voicePlaying = false;
      this._dialogueBox.setVoicePlaying(false);
      // Don't immediately advance — set up the wait timer
      this._waitTimer = AUTO_ADVANCE_DELAY_S; // skip wait
      this._autoAdvanceReady = true;
      return;
    }

    const currentLine = this._lines[this._lineIndex];
    if (currentLine && currentLine.onComplete) {
      currentLine.onComplete();
    }

    this._lineIndex++;
    this._autoAdvanceReady = false;

    if (this._lineIndex >= this._lines.length) {
      this._endDialogue();
    } else {
      this._startLine(this._lineIndex);
    }
  }

  _onChoiceSelected(choiceId) {
    const currentLine = this._lines[this._lineIndex];
    if (!currentLine || !currentLine.choices) return;

    const choice = currentLine.choices.find(c => c.id === choiceId);
    if (choice && choice.onSelect) {
      choice.onSelect();
    }

    this._dialogueBox.clearChoices();

    // Play choice feedback SFX
    if (this._audioManager) {
      this._audioManager.play('sfx_choice_select');
    }

    // Advance past this line
    this._advanceLine();
  }

  _hasChoices() {
    const line = this._lines[this._lineIndex];
    return line && line.choices && line.choices.length > 0;
  }

  _endDialogue() {
    // Fade out dialogue box
    this._dialogueBox.onHidden = () => {
      // Fire quest trigger if present
      if (this._questTrigger && this._questSystem) {
        this._questSystem.triggerQuest(this._questTrigger);
      }

      // Callback
      if (this._onDialogueComplete) {
        this._onDialogueComplete();
      }

      // Pop this overlay
      if (this._sceneManager) {
        this._sceneManager.popOverlay();
      }
    };
    this._dialogueBox.hide();
  }

  // ---- Draw -----------------------------------------------------------------

  /**
   * @param {import('../engine/Renderer.js').default} renderer
   */
  draw(renderer) {
    // The overworld scene renders behind us (this is an overlay).
    // We only draw the dialogue box and any choice buttons.

    // Semi-transparent dim at bottom of screen for readability
    const ctx = renderer.ctx;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, LOGICAL_HEIGHT * 0.6, LOGICAL_WIDTH, LOGICAL_HEIGHT * 0.4);
    ctx.restore();

    // Dialogue box
    this._dialogueBox.draw(renderer);
  }

  // ---- Public API for external dialogue setup -------------------------------

  /**
   * Convenience: set up a simple NPC dialogue with sequential voice lines.
   * @param {string} npcId
   * @param {Array<string>} voiceIds — array of voice line IDs
   * @param {HTMLImageElement|null} portrait
   * @param {object|null} portraitSrc — {sx, sy, sw, sh}
   * @param {object|null} questTrigger
   */
  setupSimpleDialogue(npcId, voiceIds, portrait, portraitSrc, questTrigger) {
    const lines = voiceIds.map(id => ({
      voiceId: id,
      portrait: portrait,
      portraitSrc: portraitSrc,
      duration: VOICE_ESTIMATE_S,
      choices: null,
      onComplete: null,
    }));

    this.enter({
      npcId: npcId,
      lines: lines,
      questTrigger: questTrigger,
    });
  }
}
