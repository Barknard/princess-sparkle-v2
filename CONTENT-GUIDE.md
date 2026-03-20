# Princess Sparkle V2 — Content Creation Guide

How to add new levels, areas, quests, NPCs, animals, and objects.
Zero build tools required. Just write a JS file and push to GitHub.

---

## Adding a New Level

### Step 1: Copy the template
```bash
cp levels/level-template.js levels/level-rainbow-meadow.js
```

### Step 2: Fill in the level data

```js
// levels/level-rainbow-meadow.js
export default {
  // === METADATA ===
  id: 'rainbow-meadow',
  name: 'Rainbow Meadow',
  bgm: 'bgm-meadow',           // audio file in audio/bgm/
  weather: 'sunny',              // sunny | light_rain | breezy

  // === MAP SIZE ===
  width: 30,                     // tiles wide
  height: 20,                    // tiles tall

  // === PLAYER START ===
  playerStart: { x: 5, y: 10 },

  // === TILE LAYERS ===
  // Each layer is a flat array: [row0col0, row0col1, ..., row19col29]
  // Tile IDs reference the tileset image (0 = empty/transparent)
  layers: {
    ground: [
      // 30 × 20 = 600 tile IDs
      // grass=1, path=2, water=3, flowers=4, etc.
      1,1,1,1,2,2,1,1,1,1, /* ... */
    ],
    objects: [
      // Houses, trees, fences, etc. (0 = nothing)
      0,0,0,64,0,0,0,65,0,0, /* ... */
    ],
    foreground: [
      // Drawn ABOVE entities (treetops, awnings, etc.)
      0,0,0,0,0,0,0,128,0,0, /* ... */
    ],
    collision: [
      // 0 = walkable, 1 = blocked
      0,0,0,1,0,0,0,1,0,0, /* ... */
    ],
  },

  // === TRANSITIONS (connections to other levels) ===
  transitions: [
    {
      // When player steps on these tiles, load the target level
      tiles: [{ x: 0, y: 10 }, { x: 0, y: 11 }],  // left edge
      targetLevel: 'sparkle-village',
      targetSpawn: { x: 28, y: 10 },                 // where to appear
      transitionType: 'fade',                         // fade | iris
    },
    {
      tiles: [{ x: 29, y: 10 }, { x: 29, y: 11 }], // right edge
      targetLevel: 'crystal-mountain',
      targetSpawn: { x: 1, y: 10 },
    },
  ],

  // === NPCs ===
  npcs: [
    {
      id: 'farmer-daisy',
      name: 'Farmer Daisy',
      sprite: 'npc-farmer',
      portrait: 'portrait-farmer',
      startTile: { x: 12, y: 8 },
      wanderRadius: 3,
      facing: 'down',
      // Ambient lines (said randomly when player is nearby)
      ambientVoice: ['npc_daisy_ambient_01', 'npc_daisy_ambient_02'],
      // Quest reference (if this NPC gives a quest)
      questId: 'quest-water-garden',
      // Personality for silly moments
      sillyBehavior: 'drops_watering_can',
    },
    {
      id: 'baby-goat',
      name: 'Baby Goat',
      sprite: 'animal-goat-baby',
      startTile: { x: 15, y: 12 },
      wanderRadius: 2,
      type: 'animal',              // NPC type: 'character' | 'animal'
      petSound: 'animal-goat-baa',
      followAfterHelp: true,
    },
  ],

  // === WORLD OBJECTS (tappable things) ===
  objects: [
    { type: 'FLOWER',    x: 8,  y: 6  },
    { type: 'FLOWER',    x: 9,  y: 7  },
    { type: 'BIG_FLOWER',x: 10, y: 5  },
    { type: 'POND',      x: 20, y: 14, w: 3, h: 2 },
    { type: 'TREE',      x: 5,  y: 3  },
    { type: 'TREE',      x: 7,  y: 3  },
    { type: 'WELL',      x: 14, y: 10 },
    { type: 'MUSHROOM',  x: 22, y: 6  },
    { type: 'GARDEN_PLOT', x: 11, y: 9 },
    // Custom object with unique behavior:
    { type: 'CUSTOM', x: 18, y: 4,
      sprite: 'obj-windmill',
      tapAnimation: 'spin',
      tapSound: 'windmill-creak',
      tapParticle: 'sparkle',
    },
  ],

  // === AMBIENT ANIMALS ===
  animals: [
    { type: 'BUTTERFLY', count: 3, zone: { x: 5, y: 3, w: 10, h: 6 } },
    { type: 'BIRD',      count: 2, zone: { x: 0, y: 0, w: 30, h: 5 } },
    { type: 'FROG',      count: 2, zone: { x: 19, y: 13, w: 5, h: 4 } },
    { type: 'RABBIT',    count: 2, zone: { x: 20, y: 0, w: 10, h: 10 } },
  ],

  // === QUESTS ===
  quests: [
    {
      id: 'quest-water-garden',
      title: 'Growing Together',
      familyValue: 'patience',
      giver: 'farmer-daisy',
      stages: [
        {
          type: 'TALK_TO',
          npcId: 'farmer-daisy',
          dialogueId: 'daisy-intro',
        },
        {
          type: 'INTERACT',
          objectType: 'WELL',
          description: 'Get water from the well',
          voiceHint: 'narrator_quest_water_hint',
        },
        {
          type: 'INTERACT',
          objectType: 'GARDEN_PLOT',
          description: 'Water the garden',
          voiceHint: 'narrator_quest_garden_hint',
        },
        {
          type: 'RETURN_TO',
          npcId: 'farmer-daisy',
          dialogueId: 'daisy-thanks',
        },
      ],
      reward: {
        hearts: 3,
        accessory: 'hat-flower-crown',  // optional unlock
        voiceLine: 'narrator_quest_water_complete',
        message: 'You helped Farmer Daisy grow her garden!',
      },
    },
  ],

  // === DIALOGUES ===
  dialogues: {
    'daisy-intro': [
      {
        id: 'daisy-intro-1',
        speaker: 'farmer-daisy',
        portrait: 'portrait-farmer',
        voiceId: 'npc_daisy_quest_01',
        // No text needed — voice does the work
        // But you CAN add text for older kids or accessibility:
        text: 'Oh hello! My garden is so dry today.',
      },
      {
        id: 'daisy-intro-2',
        speaker: 'farmer-daisy',
        voiceId: 'npc_daisy_quest_02',
        text: 'Could you get some water from the well?',
      },
      {
        id: 'daisy-intro-3',
        speaker: 'narrator',
        voiceId: 'narrator_quest_water_accept',
        text: 'Let us help Farmer Daisy water her garden!',
        questTrigger: 'quest-water-garden:start',
      },
    ],
    'daisy-thanks': [
      {
        id: 'daisy-thanks-1',
        speaker: 'farmer-daisy',
        voiceId: 'npc_daisy_thanks_01',
        text: 'The flowers are so happy now!',
      },
      {
        id: 'daisy-thanks-2',
        speaker: 'farmer-daisy',
        voiceId: 'npc_daisy_thanks_02',
        text: 'Thank you for being so patient.',
        questTrigger: 'quest-water-garden:complete',
      },
    ],
  },

  // === KINDNESS ENCOUNTERS (random, optional) ===
  kindnessEncounters: [
    {
      id: 'lost-ladybug',
      triggerZone: { x: 10, y: 10, w: 5, h: 5 },
      chance: 0.3,  // 30% chance per walk-through
      sprite: 'animal-ladybug',
      voiceLines: ['encounter_ladybug_01', 'encounter_ladybug_02'],
      reward: { hearts: 1 },
    },
  ],

  // === SECRETS (hidden discoveries) ===
  secrets: [
    {
      id: 'hidden-fairy-ring',
      triggerTile: { x: 25, y: 3 },
      triggerAction: 'walk_circle',  // walk in a circle here
      revealAnimation: 'sparkle_burst',
      voiceLine: 'secret_fairy_ring',
      reward: { accessory: 'wand-fairy' },
    },
  ],
};
```

### Step 3: Register the level

Open `game/world/LevelRegistry.js` and add one line:

```js
// Just add the path — WorldLoader handles the rest
export const LEVELS = {
  'sparkle-village':   () => import('../../levels/level-sparkle-village.js'),
  'whisper-forest':    () => import('../../levels/level-whisper-forest.js'),
  'rainbow-meadow':    () => import('../../levels/level-rainbow-meadow.js'),  // ← new
};
```

### Step 4: Connect it to an existing level

In the existing level that should connect to your new one, add a transition:

```js
// In level-sparkle-village.js, add to the transitions array:
{
  tiles: [{ x: 29, y: 10 }, { x: 29, y: 11 }],
  targetLevel: 'rainbow-meadow',
  targetSpawn: { x: 1, y: 10 },
},
```

### Step 5: Push to GitHub

```bash
git add levels/level-rainbow-meadow.js game/world/LevelRegistry.js
git commit -m "Add Rainbow Meadow level"
git push
```

Your daughter gets a "New adventure ready!" banner within 5 minutes.

---

## Adding a New Quest (to an existing level)

Just add entries to the level's `quests` and `dialogues` objects. No other files need to change.

**Quest stage types:**
| Type | What the player does |
|------|---------------------|
| `TALK_TO` | Walk to NPC and tap them |
| `DELIVER` | Carry an item to an NPC |
| `RETURN_TO` | Walk back to quest giver |
| `INTERACT` | Tap a specific world object |
| `OBSERVE` | Walk to a location and watch something happen |

**Family values to tag:**
sharing, kindness, helping, empathy, patience, cooperation

---

## Adding a New NPC

Add to the level's `npcs` array:

```js
{
  id: 'unique-id',
  name: 'Display Name',
  sprite: 'sprite-sheet-id',     // from spriteIndex
  portrait: 'portrait-id',       // for dialogue box
  startTile: { x: 10, y: 8 },
  wanderRadius: 3,               // tiles
  ambientVoice: ['voice_id_1'],  // random nearby lines
  questId: 'quest-id',           // optional
  sillyBehavior: 'behavior_id',  // optional silly moment
}
```

---

## Adding a New Companion

1. Create `game/companions/NewCompanion.js`:

```js
import { Companion } from '../entities/Companion.js';

export class CloudBear extends Companion {
  getParticleConfig() {
    return {
      colors: ['#ffffff', '#aaddff', '#ddeeff'],
      shape: 'cloud',       // cloud | star | heart | flower | note | circle
      size: [4, 7],         // min-max px
      life: 1000,           // ms
      vx: [-0.2, 0.2],     // random range
      vy: -0.3,             // float up
      emitInterval: 8,      // frames between emissions
    };
  }

  getSillyIdle() {
    return 'sits_on_cloud_and_falls_through';
  }

  getEvolutionStages() {
    return {
      baby: { sprite: 'cloudbear-baby', levels: [1, 3] },
      young: { sprite: 'cloudbear-young', levels: [4, 6] },
      full:  { sprite: 'cloudbear-full', levels: [7, 99] },
    };
  }
}
```

2. Register in `game/data/companions.js`:

```js
export const COMPANIONS = {
  shimmer: { name: 'Shimmer', creature: 'Unicorn', /* ... */ },
  // ...
  cloudbear: { name: 'Cumulus', creature: 'Cloud Bear', module: './companions/CloudBear.js' },
};
```

---

## Adding New World Objects

Add a type handler in `game/entities/WorldObject.js`:

```js
OBJECT_TYPES.WINDMILL = {
  sprite: 'obj-windmill',
  tapAnimation: 'spin',          // built-in: bounce, spin, shake, bloom, splash
  tapSound: 'windmill-creak',    // SFX ID from sfxIndex.js
  tapParticle: 'sparkle',        // particle preset
  cooldown: 2000,                // ms between taps
};
```

Then use it in any level:
```js
objects: [
  { type: 'WINDMILL', x: 14, y: 6 },
],
```

---

## Adding New Sound Effects

1. Drop the MP3 into the appropriate `audio/sfx/` subfolder
2. Add the mapping in `game/data/sfxIndex.js`:
```js
windmillCreak: './audio/sfx/world/windmill-creak.mp3',
```
3. Document in `audio/sfx/SOURCES.md`

---

## Adding Voice Lines

1. Record the line following `voice-script/SCRIPT.md` format
2. Save as MP3 to `audio/voice/[line_id].mp3`
3. Reference by ID in dialogue data:
```js
{ speaker: 'narrator', voiceId: 'narrator_new_line_01' }
```

The AudioManager loads voice files on demand (not pre-cached).

---

## Adding Music Tracks

1. Create your track in Suno
2. Export as MP3
3. Save to `audio/bgm/bgm-area-name.mp3`
4. Reference in level data:
```js
bgm: 'bgm-area-name',
```

AudioManager crossfades between tracks over 1500ms.

---

## Quick Checklist for New Content

```
[ ] Level JS file created in levels/
[ ] Level registered in LevelRegistry.js
[ ] Connected via transitions in adjacent levels
[ ] NPCs have sprites in the spritesheet
[ ] Quest dialogues reference valid voice IDs
[ ] Voice lines recorded and saved to audio/voice/
[ ] BGM track created and saved to audio/bgm/
[ ] Push to GitHub
[ ] Wait 5 min → daughter gets update banner
```

---

## Tile Map Editing Tips

For now, levels are hand-coded arrays. To make this easier:

1. **Use Tiled** (free map editor: https://www.mapeditor.org/)
2. Export as CSV
3. Convert CSV to JS array (simple script)

Or just edit the arrays directly — a 30×20 map is only 600 numbers.

Later we can add a visual level editor as a parent-mode tool.
