/**
 * DialogueSystem.js — Voice-driven dialogue trees for Princess Sparkle V2
 *
 * Dialogue nodes: { id, portrait, name, voiceId, next, choices }
 * choices: [{ icon, next, questTrigger }] — icons not text (pre-literate)
 * Resolves next by string ID.
 * Voice plays via AudioManager.
 * Auto-advance after voice ends + 2s pause.
 * Tap to advance to next node.
 */

// Auto-advance delay after voice finishes (ms)
const AUTO_ADVANCE_DELAY = 2000;

// Fallback: if no voice, auto-advance after this many ms
const NO_VOICE_ADVANCE_DELAY = 4000;

/**
 * @typedef {object} DialogueNode
 * @property {string} id - Unique node ID
 * @property {string} [portrait] - Sprite name for character portrait
 * @property {string} [name] - Character name (for debugging; not shown to player)
 * @property {string} [voiceId] - Audio file ID for voice line
 * @property {string|null} [next] - ID of next node, or null for end
 * @property {Array<{icon: string, next: string, questTrigger?: string}>} [choices] - Choice options
 * @property {string} [expression] - NPC expression to set during this node
 */

/**
 * @typedef {object} DialogueTree
 * @property {string} startId - ID of first node
 * @property {Object<string, DialogueNode>} nodes - Map of node ID to node
 */

export default class DialogueSystem {
  constructor() {
    // All loaded dialogue trees
    /** @type {Map<string, DialogueTree>} */
    this.trees = new Map();

    // Active dialogue state
    this.active = false;
    this.currentTreeId = null;
    this.currentNodeId = null;

    // Timing
    this.voicePlaying = false;
    this.voiceEndedAt = 0;  // timestamp when voice finished
    this.waitingForAdvance = false;
    this.advanceTimer = 0;

    // Choice state
    this.showingChoices = false;
    /** @type {Array<{icon: string, next: string, questTrigger?: string}>|null} */
    this.currentChoices = null;

    // Callbacks
    /** @type {Function|null} Called with (node) when a new node starts */
    this.onNodeStart = null;
    /** @type {Function|null} Called when dialogue ends */
    this.onDialogueEnd = null;
    /** @type {Function|null} Called with (voiceId) to play voice */
    this.onPlayVoice = null;
    /** @type {Function|null} Called with (questTriggerId) when choice triggers quest */
    this.onQuestTrigger = null;
    /** @type {Function|null} Called with (expression) to set NPC expression */
    this.onSetExpression = null;

    // Reference to audio manager for voice playback tracking
    /** @type {object|null} */
    this.audioManager = null;
  }

  /**
   * Load dialogue trees for a level.
   * @param {Object<string, DialogueTree>} dialogues - Map of tree ID to tree
   */
  loadDialogues(dialogues) {
    for (const [id, tree] of Object.entries(dialogues)) {
      this.trees.set(id, tree);
    }
  }

  /**
   * Start a dialogue.
   * @param {string} treeId - Dialogue tree ID
   * @returns {boolean} True if started successfully
   */
  start(treeId) {
    const tree = this.trees.get(treeId);
    if (!tree) return false;

    this.active = true;
    this.currentTreeId = treeId;
    this.showingChoices = false;
    this.currentChoices = null;

    this._goToNode(tree.startId);
    return true;
  }

  /**
   * Advance dialogue (tap to continue).
   * Called by input handler when player taps during dialogue.
   */
  advance() {
    if (!this.active) return;

    // If choices are showing, don't advance by tap (must pick a choice)
    if (this.showingChoices) return;

    // If voice is still playing, skip to end of voice (queue next)
    if (this.voicePlaying) {
      this.voicePlaying = false;
      this.waitingForAdvance = true;
      this.advanceTimer = 0; // advance immediately on next update
      return;
    }

    // If waiting for auto-advance, advance now
    if (this.waitingForAdvance) {
      this._advanceToNext();
      return;
    }
  }

  /**
   * Select a choice option.
   * @param {number} choiceIndex - Index of the chosen option
   */
  selectChoice(choiceIndex) {
    if (!this.active || !this.showingChoices || !this.currentChoices) return;
    if (choiceIndex < 0 || choiceIndex >= this.currentChoices.length) return;

    const choice = this.currentChoices[choiceIndex];

    // Trigger quest if applicable
    if (choice.questTrigger && this.onQuestTrigger) {
      this.onQuestTrigger(choice.questTrigger);
    }

    this.showingChoices = false;
    this.currentChoices = null;

    if (choice.next) {
      this._goToNode(choice.next);
    } else {
      this._endDialogue();
    }
  }

  /**
   * Update dialogue system each frame.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    if (!this.active) return;

    // Check if voice has finished playing
    if (this.voicePlaying) {
      // Check audio manager for voice completion
      if (this.audioManager && !this.audioManager.isVoicePlaying()) {
        this.voicePlaying = false;
        this.waitingForAdvance = true;
        this.advanceTimer = AUTO_ADVANCE_DELAY;
      }
    }

    // Auto-advance countdown
    if (this.waitingForAdvance && !this.showingChoices) {
      this.advanceTimer -= dt * 1000;
      if (this.advanceTimer <= 0) {
        this._advanceToNext();
      }
    }
  }

  /**
   * Navigate to a dialogue node.
   * @param {string} nodeId
   */
  _goToNode(nodeId) {
    const tree = this.trees.get(this.currentTreeId);
    if (!tree || !tree.nodes[nodeId]) {
      this._endDialogue();
      return;
    }

    const node = tree.nodes[nodeId];
    this.currentNodeId = nodeId;
    this.waitingForAdvance = false;
    this.showingChoices = false;
    this.currentChoices = null;

    // Set expression
    if (node.expression && this.onSetExpression) {
      this.onSetExpression(node.expression);
    }

    // Play voice
    if (node.voiceId) {
      this.voicePlaying = true;
      if (this.onPlayVoice) {
        this.onPlayVoice(node.voiceId);
      }
    } else {
      // No voice — auto advance after delay
      this.voicePlaying = false;
      this.waitingForAdvance = true;
      this.advanceTimer = NO_VOICE_ADVANCE_DELAY;
    }

    // Show choices if this node has them
    if (node.choices && node.choices.length > 0) {
      // Choices appear after voice finishes
      this.currentChoices = node.choices;
      // Don't show yet — wait for voice to finish
    }

    // Notify listeners
    if (this.onNodeStart) {
      this.onNodeStart(node);
    }
  }

  /**
   * Advance to the next node in the dialogue.
   */
  _advanceToNext() {
    this.waitingForAdvance = false;

    const tree = this.trees.get(this.currentTreeId);
    if (!tree) {
      this._endDialogue();
      return;
    }

    const node = tree.nodes[this.currentNodeId];
    if (!node) {
      this._endDialogue();
      return;
    }

    // If choices are pending, show them now instead of auto-advancing
    if (this.currentChoices && this.currentChoices.length > 0) {
      this.showingChoices = true;
      return;
    }

    // Go to next node
    if (node.next) {
      this._goToNode(node.next);
    } else {
      this._endDialogue();
    }
  }

  /**
   * End the dialogue.
   */
  _endDialogue() {
    this.active = false;
    this.currentTreeId = null;
    this.currentNodeId = null;
    this.voicePlaying = false;
    this.waitingForAdvance = false;
    this.showingChoices = false;
    this.currentChoices = null;

    if (this.onDialogueEnd) {
      this.onDialogueEnd();
    }
  }

  /**
   * Get the current dialogue node for rendering.
   * @returns {DialogueNode|null}
   */
  getCurrentNode() {
    if (!this.active || !this.currentTreeId || !this.currentNodeId) return null;
    const tree = this.trees.get(this.currentTreeId);
    if (!tree) return null;
    return tree.nodes[this.currentNodeId] || null;
  }

  /**
   * Check if dialogue is currently active.
   * @returns {boolean}
   */
  isActive() {
    return this.active;
  }

  /**
   * Check if choices are currently being shown.
   * @returns {boolean}
   */
  isShowingChoices() {
    return this.showingChoices;
  }
}
