/**
 * QuestSystem.js — Quest state machine for Princess Sparkle V2
 *
 * Quest stages: TALK_TO, DELIVER, RETURN_TO, OBSERVE.
 * evaluate() after every interaction.
 * advance(stageId) moves to next stage.
 * complete() awards hearts, fires QuestCompleteScene.
 * Max 1 active quest (keeps focus simple for 4yo).
 * Quest definitions come from level data files.
 * Never marks quests as failed — NPCs just keep their "!" indicator.
 */

/** Quest stage types */
export const QuestStage = {
  TALK_TO: 'TALK_TO',       // Talk to a specific NPC
  DELIVER: 'DELIVER',       // Bring an item to an NPC
  RETURN_TO: 'RETURN_TO',   // Go back to original NPC
  OBSERVE: 'OBSERVE'        // Be near something / watch an event
};

/** Quest status */
export const QuestStatus = {
  AVAILABLE: 'AVAILABLE',   // Not yet started, NPC shows "!"
  ACTIVE: 'ACTIVE',         // In progress
  COMPLETE: 'COMPLETE'      // Done, rewards given
};

/**
 * @typedef {object} QuestStageDefinition
 * @property {string} type - QuestStage value
 * @property {string} targetId - NPC or object ID to interact with
 * @property {string} [itemId] - Item required for DELIVER stage
 * @property {string} [dialogueId] - Dialogue to trigger on this stage
 * @property {string} [description] - Narrator description (voice ID)
 */

/**
 * @typedef {object} QuestDefinition
 * @property {string} id - Unique quest ID
 * @property {string} name - Quest name (for debugging, not shown to player)
 * @property {string} giverNpcId - NPC who gives this quest
 * @property {string} value - Family value this teaches (sharing, kindness, etc.)
 * @property {number} heartReward - Hearts awarded on completion
 * @property {string} [bridgeColor] - Rainbow bridge color this unlocks
 * @property {QuestStageDefinition[]} stages - Ordered list of stages
 */

export default class QuestSystem {
  constructor() {
    // All quest definitions for the current level
    /** @type {Map<string, QuestDefinition>} */
    this.questDefs = new Map();

    // Quest status tracking
    /** @type {Map<string, string>} questId -> QuestStatus */
    this.questStatus = new Map();

    // Active quest
    /** @type {string|null} */
    this.activeQuestId = null;

    // Current stage index within active quest
    this.currentStageIndex = 0;

    // Inventory for quest items (simple set of item IDs)
    /** @type {Set<string>} */
    this.inventory = new Set();

    // Completed quests history
    /** @type {Array<{questId: string, value: string, heartReward: number}>} */
    this.completedQuests = [];

    // Total hearts earned
    this.totalHearts = 0;

    // Callbacks
    /** @type {Function|null} */
    this.onQuestComplete = null;

    /** @type {Function|null} */
    this.onStageAdvance = null;

    /** @type {Function|null} */
    this.onQuestStart = null;
  }

  /**
   * Load quest definitions for a level.
   * @param {QuestDefinition[]} quests
   */
  loadQuests(quests) {
    this.questDefs.clear();
    for (let i = 0; i < quests.length; i++) {
      const q = quests[i];
      this.questDefs.set(q.id, q);

      // Check if already completed (from save data)
      if (!this.questStatus.has(q.id)) {
        this.questStatus.set(q.id, QuestStatus.AVAILABLE);
      }
    }
  }

  /**
   * Check if an NPC has an available quest.
   * @param {string} npcId
   * @returns {string|null} Quest ID if available, null otherwise
   */
  getAvailableQuestForNPC(npcId) {
    // Only offer quests if no quest is currently active
    if (this.activeQuestId) return null;

    for (const [id, def] of this.questDefs) {
      if (def.giverNpcId === npcId &&
          this.questStatus.get(id) === QuestStatus.AVAILABLE) {
        return id;
      }
    }
    return null;
  }

  /**
   * Start a quest.
   * @param {string} questId
   * @returns {QuestStageDefinition|null} First stage, or null if can't start
   */
  startQuest(questId) {
    if (this.activeQuestId) return null; // already have an active quest

    const def = this.questDefs.get(questId);
    if (!def) return null;

    this.activeQuestId = questId;
    this.currentStageIndex = 0;
    this.questStatus.set(questId, QuestStatus.ACTIVE);

    if (this.onQuestStart) {
      this.onQuestStart(questId, def);
    }

    return def.stages[0] || null;
  }

  /**
   * Get the current stage of the active quest.
   * @returns {QuestStageDefinition|null}
   */
  getCurrentStage() {
    if (!this.activeQuestId) return null;
    const def = this.questDefs.get(this.activeQuestId);
    if (!def) return null;
    return def.stages[this.currentStageIndex] || null;
  }

  /**
   * Evaluate an interaction against the current quest stage.
   * Call this after every NPC talk, item pickup, or position change.
   *
   * @param {string} interactionType - 'talk', 'pickup', 'deliver', 'observe'
   * @param {string} targetId - ID of the NPC/object interacted with
   * @param {string} [itemId] - ID of item involved (for pickup/deliver)
   * @returns {{advanced: boolean, completed: boolean, stage: QuestStageDefinition|null}}
   */
  evaluate(interactionType, targetId, itemId) {
    const result = { advanced: false, completed: false, stage: null };

    if (!this.activeQuestId) return result;

    const def = this.questDefs.get(this.activeQuestId);
    if (!def) return result;

    const stage = def.stages[this.currentStageIndex];
    if (!stage) return result;

    let matches = false;

    switch (stage.type) {
      case QuestStage.TALK_TO:
        matches = interactionType === 'talk' && targetId === stage.targetId;
        break;

      case QuestStage.DELIVER:
        matches = interactionType === 'deliver' &&
                  targetId === stage.targetId &&
                  (!stage.itemId || itemId === stage.itemId || this.inventory.has(stage.itemId));
        if (matches && stage.itemId) {
          this.inventory.delete(stage.itemId); // consume the item
        }
        break;

      case QuestStage.RETURN_TO:
        matches = interactionType === 'talk' && targetId === stage.targetId;
        break;

      case QuestStage.OBSERVE:
        matches = interactionType === 'observe' && targetId === stage.targetId;
        break;
    }

    if (!matches) return result;

    // Advance to next stage
    this.currentStageIndex++;
    result.advanced = true;

    if (this.currentStageIndex >= def.stages.length) {
      // Quest complete!
      result.completed = true;
      result.stage = null;
      this._completeQuest(def);
    } else {
      result.stage = def.stages[this.currentStageIndex];
      if (this.onStageAdvance) {
        this.onStageAdvance(this.activeQuestId, this.currentStageIndex, result.stage);
      }
    }

    return result;
  }

  /**
   * Pick up a quest item.
   * @param {string} itemId
   */
  pickupItem(itemId) {
    this.inventory.add(itemId);
  }

  /**
   * Check if player has a quest item.
   * @param {string} itemId
   * @returns {boolean}
   */
  hasItem(itemId) {
    return this.inventory.has(itemId);
  }

  /**
   * Complete the active quest and award rewards.
   * @param {QuestDefinition} def
   */
  _completeQuest(def) {
    this.questStatus.set(def.id, QuestStatus.COMPLETE);
    this.totalHearts += def.heartReward;

    this.completedQuests.push({
      questId: def.id,
      value: def.value,
      heartReward: def.heartReward
    });

    const completedId = this.activeQuestId;
    this.activeQuestId = null;
    this.currentStageIndex = 0;

    if (this.onQuestComplete) {
      this.onQuestComplete(completedId, def);
    }
  }

  /**
   * Get the number of quests completed.
   * @returns {number}
   */
  getCompletedCount() {
    return this.completedQuests.length;
  }

  /**
   * Get all NPCs that should show quest indicators.
   * @returns {string[]} Array of NPC IDs with available quests
   */
  getNPCsWithQuests() {
    const npcs = [];
    if (this.activeQuestId) return npcs; // No new quests while one is active

    for (const [id, def] of this.questDefs) {
      if (this.questStatus.get(id) === QuestStatus.AVAILABLE) {
        npcs.push(def.giverNpcId);
      }
    }
    return npcs;
  }

  /**
   * Serialize quest state for saving.
   * @returns {object}
   */
  serialize() {
    return {
      questStatus: Object.fromEntries(this.questStatus),
      activeQuestId: this.activeQuestId,
      currentStageIndex: this.currentStageIndex,
      inventory: Array.from(this.inventory),
      completedQuests: this.completedQuests,
      totalHearts: this.totalHearts
    };
  }

  /**
   * Restore quest state from save data.
   * @param {object} data
   */
  deserialize(data) {
    if (!data) return;

    if (data.questStatus) {
      this.questStatus = new Map(Object.entries(data.questStatus));
    }
    this.activeQuestId = data.activeQuestId || null;
    this.currentStageIndex = data.currentStageIndex || 0;
    if (data.inventory) {
      this.inventory = new Set(data.inventory);
    }
    this.completedQuests = data.completedQuests || [];
    this.totalHearts = data.totalHearts || 0;
  }
}
