/**
 * level-sparkle-village.js — First playable level for Princess Sparkle V2
 *
 * 30x20 tile grid (480x320 pixels — exactly one screen).
 * Tile IDs reference a tileset where:
 *   0  = grass
 *   1  = grass variant
 *   2  = dirt path
 *   3  = path cross
 *   4  = water
 *   5  = flowers (red)
 *   6  = flowers (yellow)
 *   7  = flowers (purple)
 *   8  = house wall
 *   9  = house roof
 *   10 = door
 *   11 = window
 *   12 = fence horizontal
 *   13 = fence vertical
 *   14 = tree trunk
 *   15 = tree canopy (foreground)
 *   16 = well base
 *   17 = bench
 *   18 = mailbox
 *   19 = stone
 *   20 = bush
 *   -1 = empty (transparent)
 *
 * Layers:
 *   ground     — grass and paths (always filled)
 *   objects    — buildings, trees, furniture (-1 for empty)
 *   collision  — 0=walkable, 1=blocked
 *   foreground — treetops drawn above entities (-1 for empty)
 */

// Helper: generate a 30x20 flat array
function grid(rows) {
  const arr = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      arr.push(rows[y][x]);
    }
  }
  return arr;
}

// G = grass(0), g = grass variant(1), P = path(2), X = cross(3), W = water(4)
const G = 0, g = 1, P = 2, X = 3, W = 4;

// prettier-ignore
const ground = grid([
  // Row 0-3: top area (grass + path)
  [G,g,G,G,g,G,G,G,g,G,G,G,G,G,P,P,G,G,g,G,G,G,G,g,G,G,G,G,g,G],
  [g,G,G,g,G,G,G,g,G,G,g,G,G,G,P,P,G,G,G,G,G,g,G,G,G,G,g,G,G,G],
  [G,G,g,G,G,G,g,G,G,G,G,G,G,G,P,P,G,G,G,g,G,G,G,G,G,G,G,G,G,g],
  [G,g,G,G,G,g,G,G,G,g,G,G,G,G,P,P,G,G,G,G,G,g,G,G,G,g,G,G,G,G],
  // Row 4-5: houses row top
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,P,P,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,P,P,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  // Row 6-8: houses
  [G,G,G,G,G,G,G,G,G,G,G,G,G,G,P,P,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,P,P,X,X,P,P,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,G,G,G,G,G,G,G,G,G,G,G,P,P,P,P,P,P,G,G,G,G,G,G,G,G,G,G,G,G],
  // Row 9-10: main path
  [P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P],
  [P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P,P],
  // Row 11-12: below path
  [G,G,G,G,G,G,G,G,G,G,G,G,P,P,P,P,P,P,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,g,G,G,G,G,G,g,G,G,G,G,G,G,P,P,G,G,G,G,G,G,g,G,G,G,G,G,g,G],
  // Row 13-15: lower village
  [G,G,G,g,G,G,G,G,G,G,G,G,G,G,P,P,G,G,G,g,G,G,G,G,G,G,G,g,G,G],
  [G,G,G,G,G,G,G,G,g,G,G,G,G,G,P,P,G,G,G,G,G,G,G,G,g,G,G,G,G,G],
  [g,G,G,G,G,g,G,G,G,G,G,G,G,G,P,P,G,G,G,G,G,g,G,G,G,G,G,G,G,g],
  // Row 16-17: pond area
  [G,G,G,G,G,G,G,G,G,G,W,W,W,G,P,P,G,G,G,G,G,G,G,G,G,G,G,G,G,G],
  [G,g,G,G,G,G,G,g,G,W,W,W,W,W,P,P,G,G,g,G,G,G,G,G,g,G,G,G,G,G],
  // Row 18-19: bottom edge (transition zone)
  [G,G,G,G,G,G,G,G,G,G,W,W,W,G,P,P,G,G,G,G,G,G,G,G,G,G,G,G,G,g],
  [G,G,g,G,G,G,G,G,G,G,G,G,G,G,P,P,G,G,G,G,G,g,G,G,G,G,G,G,G,G],
]);

// E = empty(-1), H = house wall(8), R = roof(9), D = door(10), Wi = window(11)
// F = fence_h(12), Fv = fence_v(13), T = trunk(14), We = well(16), B = bench(17)
// M = mailbox(18), S = stone(19), Bu = bush(20), f5 = flowers(5), f6 = flowers(6), f7 = flowers(7)
const E = -1;

// prettier-ignore
const objects = grid([
  // Row 0
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,20,E,E,E,E, E,E,E,E],
  // Row 1
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E,E,E,E, E,E,E,E],
  // Row 2
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E,E,E,E, E,E,E,E],
  // Row 3  — Grandma Rose's house (left) and roofs
  [E,E,E, 9, 9, 9, 9, 9,E,E, E,E,E, E,E,E, E,E,E, E, 9, 9, 9, 9, 9,E,E, E,E,E],
  // Row 4
  [E,E,E, 8,11, 8,11, 8,E,E, E,E,E, E,E,E, E,E,E, E, 8,11, 8,11, 8,E,E, E,E,E],
  // Row 5
  [E,E,E, 8, 8,10, 8, 8,E,E, E,E,E, E,E,E, E,E,E, E, 8, 8,10, 8, 8,E,E, E,E,E],
  // Row 6 — fences along houses
  [E,E,12,12,12,12,12,12,12,E, E,E,E, E,E,E, E,E,E,12,12,12,12,12,12,12,E, E,E,E],
  // Row 7 — mailbox, well, bench area
  [E,18,E,E, E,E,E, E,E,14, E,E,E, E,E,E, E,E,14, E,E,E, E,E,E, E,18,E,E,E],
  // Row 8
  [E,E,E, 5, E,E, 6, E,E,E, E,E,E, E,E,E, E,E,E, E,E, 7, E,E, 5, E,E,E,E,E],
  // Row 9 — main path (no objects)
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E,E],
  // Row 10
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E,E],
  // Row 11
  [E,E,E,E, E,17,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,16,E, E,E,E,E,E],
  // Row 12
  [E,E, 5, E,E,E, E, 6,E,E, E,E,E, E,E,E, E,E,E, E,E, 7, E,E,E, E, 5,E,E,E],
  // Row 13 — lower area (Finn's play area)
  [E,E,E,E, E,E,E, E,E,14, E,E,E, E,E,E, E,E,E, E,E,E, E,14,E, E,E,E,E,E],
  // Row 14
  [E,E,E,E,E,E,E, E,E,E, 19,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
  // Row 15
  [E,E,E,E, 6,E,E, E,E,E, E,E,E, E,E,E, E,E,E, 5,E,E, E,E,E,E, 7,E,E,E],
  // Row 16 — pond area
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
  // Row 17
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
  // Row 18
  [E,E,E,E, E,E, 6,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
  // Row 19
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
]);

// Collision: 1=blocked, 0=walkable
// Houses, fences, water, trees are blocked
// prettier-ignore
const collision = grid([
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
]);

// Foreground: treetops above entities
// prettier-ignore
const foreground = grid([
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,15,E,E,E,E,E,E,E,E,15,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,15,E,E,E,E,E,E,E,E,E,E,E,E,E,15,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
]);

// ── NPCs ───────────────────────────────────────────────────────────────────

const npcs = [
  {
    id: 'grandma-rose',
    name: 'Grandma Rose',
    spriteName: 'npc_grandma',
    homeX: 5,
    homeY: 8,
    personality: 'warm',
    dialogueId: 'grandma-rose-greeting',
    ambientLines: ['voice_grandma_ambient_01', 'voice_grandma_ambient_02'],
    sillyBehaviors: ['loses_glasses', 'hums_tune'],
  },
  {
    id: 'neighbor-lily',
    name: 'Neighbor Lily',
    spriteName: 'npc_lily',
    homeX: 22,
    homeY: 8,
    personality: 'cheerful',
    dialogueId: 'lily-greeting',
    ambientLines: ['voice_lily_ambient_01', 'voice_lily_ambient_02'],
    sillyBehaviors: ['waters_wrong_plant', 'talks_to_flowers'],
  },
  {
    id: 'little-finn',
    name: 'Little Finn',
    spriteName: 'npc_finn',
    homeX: 14,
    homeY: 14,
    personality: 'playful',
    dialogueId: 'finn-greeting',
    ambientLines: ['voice_finn_ambient_01'],
    sillyBehaviors: ['chases_butterfly', 'trips_over_rock', 'draws_in_dirt'],
  },
];

// ── World Objects (tappable) ───────────────────────────────────────────────

const worldObjects = [
  { type: 'FLOWER_SMALL', x: 3,  y: 8,  id: 'flower-01' },
  { type: 'FLOWER_SMALL', x: 24, y: 8,  id: 'flower-02' },
  { type: 'FLOWER_BIG',   x: 6,  y: 8,  id: 'flower-03' },
  { type: 'FLOWER_SMALL', x: 21, y: 12, id: 'flower-04' },
  { type: 'FLOWER_SMALL', x: 2,  y: 12, id: 'flower-05' },
  { type: 'POND',         x: 11, y: 17, id: 'village-pond' },
  { type: 'TREE',         x: 9,  y: 7,  id: 'tree-01' },
  { type: 'TREE',         x: 18, y: 7,  id: 'tree-02' },
  { type: 'TREE',         x: 9,  y: 13, id: 'tree-03' },
  { type: 'TREE',         x: 23, y: 13, id: 'tree-04' },
  { type: 'WELL',         x: 23, y: 11, id: 'village-well' },
  { type: 'BENCH',        x: 5,  y: 11, id: 'village-bench' },
  { type: 'MAILBOX',      x: 1,  y: 7,  id: 'mailbox-01' },
  { type: 'MAILBOX',      x: 26, y: 7,  id: 'mailbox-02' },
  { type: 'DANDELION',    x: 19, y: 15, id: 'dandelion-01' },
  { type: 'FLOWER_SMALL', x: 26, y: 15, id: 'flower-06' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────

const animals = [
  { type: 'BUTTERFLY', x: 8,  y: 3,  spriteName: 'butterfly' },
  { type: 'BUTTERFLY', x: 22, y: 5,  spriteName: 'butterfly' },
  { type: 'BIRD',      x: 12, y: 2,  spriteName: 'bird' },
  { type: 'BIRD',      x: 25, y: 1,  spriteName: 'bird' },
  { type: 'CAT',       x: 7,  y: 11, spriteName: 'cat' },
  { type: 'FROG',      x: 11, y: 18, spriteName: 'frog' },
  { type: 'DUCK',      x: 12, y: 17, spriteName: 'duck' },
];

// ── Quests ─────────────────────────────────────────────────────────────────

const quests = [
  {
    id: 'grandma-cookies',
    name: "Grandma's Cookies",
    giverNpcId: 'grandma-rose',
    value: 'sharing',
    heartReward: 3,
    bridgeColor: '#ff6b6b',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'grandma-rose',
        dialogueId: 'grandma-cookies-start',
        description: 'voice_quest_grandma_cookies_start',
      },
      {
        type: 'DELIVER',
        targetId: 'little-finn',
        itemId: 'cookies',
        dialogueId: 'grandma-cookies-deliver',
        description: 'voice_quest_grandma_cookies_deliver',
      },
      {
        type: 'RETURN_TO',
        targetId: 'grandma-rose',
        dialogueId: 'grandma-cookies-complete',
        description: 'voice_quest_grandma_cookies_complete',
      },
    ],
  },
  {
    id: 'helping-finn',
    name: 'Helping Finn',
    giverNpcId: 'little-finn',
    value: 'helpfulness',
    heartReward: 3,
    bridgeColor: '#77dd77',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'little-finn',
        dialogueId: 'finn-kite-start',
        description: 'voice_quest_finn_kite_start',
      },
      {
        type: 'OBSERVE',
        targetId: 'tree-03',
        dialogueId: 'finn-kite-observe',
        description: 'voice_quest_finn_kite_observe',
      },
      {
        type: 'RETURN_TO',
        targetId: 'little-finn',
        dialogueId: 'finn-kite-complete',
        description: 'voice_quest_finn_kite_complete',
      },
    ],
  },
];

// ── Dialogues ──────────────────────────────────────────────────────────────

const dialogues = {
  'grandma-rose-greeting': {
    startId: 'g1',
    nodes: {
      g1: { id: 'g1', portrait: 'npc_grandma', name: 'Grandma Rose', voiceId: 'voice_grandma_greeting', next: null, expression: 'happy' },
    },
  },
  'grandma-cookies-start': {
    startId: 'gc1',
    nodes: {
      gc1: { id: 'gc1', portrait: 'npc_grandma', name: 'Grandma Rose', voiceId: 'voice_grandma_cookies_01', next: 'gc2', expression: 'happy' },
      gc2: { id: 'gc2', portrait: 'npc_grandma', name: 'Grandma Rose', voiceId: 'voice_grandma_cookies_02', next: null, expression: 'happy' },
    },
  },
  'grandma-cookies-deliver': {
    startId: 'gd1',
    nodes: {
      gd1: { id: 'gd1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_cookies_receive', next: null, expression: 'happy' },
    },
  },
  'grandma-cookies-complete': {
    startId: 'gf1',
    nodes: {
      gf1: { id: 'gf1', portrait: 'npc_grandma', name: 'Grandma Rose', voiceId: 'voice_grandma_cookies_done', next: null, expression: 'grateful' },
    },
  },
  'lily-greeting': {
    startId: 'l1',
    nodes: {
      l1: { id: 'l1', portrait: 'npc_lily', name: 'Neighbor Lily', voiceId: 'voice_lily_greeting', next: null, expression: 'happy' },
    },
  },
  'finn-greeting': {
    startId: 'f1',
    nodes: {
      f1: { id: 'f1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_greeting', next: null, expression: 'happy' },
    },
  },
  'finn-kite-start': {
    startId: 'fk1',
    nodes: {
      fk1: { id: 'fk1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_kite_01', next: 'fk2', expression: 'sad' },
      fk2: { id: 'fk2', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_kite_02', next: null, expression: 'worried' },
    },
  },
  'finn-kite-observe': {
    startId: 'fo1',
    nodes: {
      fo1: { id: 'fo1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_kite_observe', next: null, expression: 'happy' },
    },
  },
  'finn-kite-complete': {
    startId: 'fc1',
    nodes: {
      fc1: { id: 'fc1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_kite_done', next: null, expression: 'happy' },
    },
  },
};

// ── Level transitions ──────────────────────────────────────────────────────

const transitions = [
  {
    edge: 'south',
    targetLevel: 'whisper-forest',
    targetSpawnX: 15,
    targetSpawnY: 1,
    label: 'Whisper Forest',
  },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'sparkle-village',
  name: 'Sparkle Village',
  width: 30,
  height: 20,
  tileSize: 16,

  // Player spawn
  spawnX: 14,
  spawnY: 10,

  // Tile layers
  ground,
  objects,
  collision,
  foreground,

  // Entities
  npcs,
  worldObjects,
  animals,

  // Systems
  quests,
  dialogues,
  transitions,
};
