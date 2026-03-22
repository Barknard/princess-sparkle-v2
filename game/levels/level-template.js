/**
 * level-template.js — Copy-paste starter for new Princess Sparkle V2 levels
 *
 * Instructions:
 * 1. Copy this file to level-YOUR-LEVEL-NAME.js
 * 2. Fill in the tile layers (ground, objects, collision, foreground)
 * 3. Add NPCs, world objects, animals, quests, and dialogues
 * 4. Register in game/world/LevelRegistry.js
 * 5. Add transitions from neighboring levels
 *
 * Tile IDs reference the tileset (see level-sparkle-village.js for examples).
 * Grid is 30 wide x 20 tall = 600 tiles per layer.
 * Use -1 for empty tiles in objects/foreground layers.
 */

// Helper: flatten a 2D array of rows into a flat array
function grid(rows) {
  const arr = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      arr.push(rows[y][x]);
    }
  }
  return arr;
}

// ── Tile layer constants ───────────────────────────────────────────────────
// Define shorthand constants for tile IDs used in your level.
// Example:
// const G = 0;  // grass
// const P = 2;  // path
// const E = -1; // empty

const G = 0;  // grass
const E = -1; // empty

// ── Ground layer (30x20, always filled — no -1) ───────────────────────────

const ground = grid([
  // 20 rows of 30 tiles each
  // Copy the pattern from sparkle-village or design your own
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
]);

// ── Objects layer (30x20, -1 = empty) ──────────────────────────────────────

const objects = new Array(600).fill(-1);
// Place objects by setting: objects[y * 30 + x] = tileId;

// ── Collision layer (30x20, 0=walk, 1=blocked) ────────────────────────────

const collision = new Array(600).fill(0);
// Block tiles by setting: collision[y * 30 + x] = 1;

// ── Foreground layer (30x20, -1 = empty) ───────────────────────────────────

const foreground = new Array(600).fill(-1);
// Place foreground tiles (treetops, etc.) above entities

// ── NPCs ───────────────────────────────────────────────────────────────────

const npcs = [
  // {
  //   id: 'npc-id',
  //   name: 'Display Name',
  //   spriteName: 'npc_sprite_key',
  //   homeX: 10,
  //   homeY: 10,
  //   personality: 'friendly',
  //   dialogueId: 'dialogue-tree-id',
  //   ambientLines: ['voice_npc_ambient_01'],
  //   sillyBehaviors: ['silly_type'],
  // },
];

// ── World Objects (tappable) ───────────────────────────────────────────────

const worldObjects = [
  // { type: 'FLOWER_SMALL', x: 5, y: 5, id: 'flower-01' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────

const animals = [
  // { type: 'BUTTERFLY', x: 10, y: 5, spriteName: 'butterfly' },
];

// ── Quests ─────────────────────────────────────────────────────────────────

const quests = [
  // {
  //   id: 'quest-id',
  //   name: 'Quest Name',
  //   giverNpcId: 'npc-id',
  //   value: 'kindness',
  //   heartReward: 3,
  //   pathColor: '#ff6b6b',
  //   stages: [
  //     { type: 'TALK_TO', targetId: 'npc-id', dialogueId: 'dialogue-id' },
  //   ],
  // },
];

// ── Dialogues ──────────────────────────────────────────────────────────────

const dialogues = {
  // 'dialogue-tree-id': {
  //   startId: 'node1',
  //   nodes: {
  //     node1: { id: 'node1', portrait: 'npc_sprite', name: 'NPC', voiceId: 'voice_id', next: null },
  //   },
  // },
};

// ── Level transitions ──────────────────────────────────────────────────────

const transitions = [
  // { edge: 'north', targetLevel: 'other-level', targetSpawnX: 15, targetSpawnY: 18 },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'your-level-id',
  name: 'Your Level Name',
  width: 30,
  height: 20,
  tileSize: 16,

  spawnX: 15,
  spawnY: 10,

  ground,
  objects,
  collision,
  foreground,

  npcs,
  worldObjects,
  animals,

  quests,
  dialogues,
  transitions,
};
