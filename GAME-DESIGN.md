# Princess Sparkle V2 — Game Design Document

**Version**: 1.0
**Target Player**: Girl, age 4.5
**Platform**: iPad (PWA via GitHub Pages)
**Genre**: Educational RPG (Pokemon-inspired, anti-addictive)

---

## Vision Statement

A gentle, colorful overhead RPG where a princess and her chosen companion
spread happiness through a world that needs kindness. Every interaction
teaches family values through play — not quizzes. The game is specifically
designed with child psychology research to be engaging without being addictive.

---

## Core Design Rules (Non-Negotiable)

1. **No required reading.** Player is pre-literate (4.5). ALL information
   delivered through voice narration, icons, and animation.
2. **No variable rewards.** Rewards are always predictable and earned.
3. **No combat.** Creatures collaborate, never fight.
4. **No fail states.** Gentle redirection, never "game over."
5. **No FOMO.** Nothing is time-limited. No daily streaks. No expiring content.
6. **No competitive elements.** No leaderboards, no rankings.
7. **Finite sessions with natural endpoints.** Each quest is ~20 minutes.
8. **Positive goodbye ritual.** Stopping always feels warm and satisfying.
9. **Max 5-6 colors per scene.** Pastels at 60-70% saturation.
10. **80% success rate.** Quietly adaptive difficulty — never announced.

---

## Gameplay Overview

### The World
- **Overhead pixel art** (16x16 tiles, 480x320 logical resolution scaled up)
- Two starting areas: **Sparkle Village** (home) and **Whisper Forest**
- Tap-to-move navigation, tap-to-interact with NPCs and objects
- The world has a day cycle tied to session time (starts morning, ends sunset)

### The Princess
- Player character — walks around the world
- Levels up by completing quests and helping others
- Has a Friendship Journal tracking companions and good deeds
- Walk animation: 4 directions, 3 frames each

### Companions (Choose 1 at start)
| Name | Creature | Trail Effect | Personality | Voice Type |
|------|----------|-------------|-------------|------------|
| **Shimmer** | Unicorn | Rainbow sparkles | Gentle, wise, encouraging | Warm, melodic, like a kind older sister |
| **Ember** | Baby Dragon | Warm golden sparks | Playful, curious, brave | Excited whisper, giggly |
| **Petal** | Bunny | Flowers blooming | Shy, sweet, caring | Soft, quiet, tender |
| **Breeze** | Butterfly | Glowing wish-dust | Dreamy, poetic, free-spirited | Airy, whimsical, sing-song |
| **Pip** | Fox Cub | Musical notes | Cheerful, loyal, adventurous | Bright, peppy, enthusiastic |

**Companion mechanics:**
- Follows the princess with a gentle trail effect
- Provides hints when the player is stuck (after ~30 seconds of no action)
- Levels up alongside the princess
- **Evolves** at level milestones (visual transformation, predictable)
  - Level 1-3: Baby form
  - Level 4-6: Young form (slightly larger, more detail)
  - Level 7+: Full form (beautiful, more elaborate trail)
- Each companion has a unique ability used in quests

### Encounters (Two Types)

**Walk-Up Encounters:**
- NPCs in the world have a soft glowing "!" when they need help
- Player walks up and taps to start the interaction
- A voice-narrated dialogue begins with the NPC explaining their problem

**Kindness Encounters (Random):**
- While exploring, gentle encounters appear naturally
- A lost butterfly, a sad flower, a dropped basket of apples
- Signaled by a soft chime + visual sparkle on the map
- Player walks to the sparkle to help
- These are NOT startling — they fade in gently over 2 seconds

### Leveling System
- **Princess Level**: Goes up by completing quests and kindness encounters
- **Companion Level**: Goes up alongside princess (always same level)
- **XP Source**: Helping, sharing, being kind (fixed amounts, never random)
- **Level display**: Hearts collected (not a number — more visual/tangible)
- Levels are shown as a flower growing: seed → sprout → bud → bloom → full garden

### Quest System

**Overall Quest:**
- Each area has a "big problem" that takes multiple mini-quests to solve
- Village: "The Rainbow Bridge is broken! Help everyone so they smile,
  and their happiness will rebuild it piece by piece."
- Forest: "The forest is losing its color! Spread kindness to bring it back."

**Mini Quests (~5-7 min each, 3-4 per session):**
- Self-contained stories with beginning, middle, end
- Always about helping someone with a problem
- Family values integrated into the mechanic, not bolted on

**Example quest flow:**
1. Grandma Rose has a "!" above her head → tap to talk
2. Voice: "Oh Princess! My neighbor is feeling lonely today. Could you
   bring her some flowers from my garden?"
3. Walk to garden → tap flowers (companion helps gather them)
4. Walk to neighbor's house → tap door
5. Voice: "Oh how lovely! Thank you, Princess! Sharing makes everyone smile."
6. Quest complete → warm chime → 3 hearts earned
7. A piece of the Rainbow Bridge glows → overall progress visible

**Quest values mapping:**
| Value | Quest Examples |
|-------|--------------|
| Sharing | Bring flowers to neighbor, share cookies with friend |
| Kindness | Cheer up a sad creature, help someone who fell down |
| Helping | Carry groceries for grandma, water the community garden |
| Empathy | Notice someone is sad, ask what's wrong |
| Patience | Wait for a flower to grow, let a friend go first |
| Cooperation | Work with companion to solve a puzzle together |

### Reward System (Anti-Addictive)
- **Hearts**: Visual currency, always predictable (quest shows reward upfront)
- **Friendship Journal entries**: A page fills in showing what you did
- **Rainbow Bridge progress**: Visual meter showing overall quest completion
- **Companion evolution**: Happens at fixed, known milestones
- **NO**: Random drops, mystery boxes, gacha mechanics, variable rewards

---

## Session Flow (20 minutes)

```
0:00  — Game loads, warm "Welcome back!" from companion
0:01  — World is in MORNING (bright pastels, birds chirping)
0:02  — Player explores, finds first quest NPC
0:07  — First mini-quest complete (sharing)
0:08  — Brief celebration, hearts awarded
0:09  — Second quest available nearby
0:14  — Second mini-quest complete (kindness)
0:15  — SUNSET begins (sky warms, shadows lengthen, music slows)
        Companion: "The sun is getting sleepy! Let's do one more nice thing."
0:16  — Final mini-quest or kindness encounter
0:18  — Quest complete → Rainbow Bridge piece added
0:19  — EVENING (deep golds, soft purples, creatures yawn)
        Companion: "What a wonderful day! Everyone is so happy because of you."
0:20  — WIND-DOWN SCREEN:
        - Recap: "Today you helped 2 friends and found 6 hearts!"
        - Companion does their sleepy animation
        - "Your friends will be here when you come back!"
        - Gentle lullaby plays
        - "Goodnight" button (auto-save happens)
```

The game does NOT hard-stop at 20 minutes. The sunset/evening transition
is the natural signal. If she keeps playing past 20 min, the world stays
in evening mode and the companion gently reminds her every few minutes.

---

## Anti-Addiction Systems

### Session Timer
- 20-minute quest cycle tied to world day/night
- Sunset begins at 15 min (visual + audio cue)
- Evening at 18 min (world darkens, music slows)
- Wind-down screen at 20 min (soft, not abrupt)
- No hard stop — just increasingly gentle encouragement

### Pacing Controls
- Slow transitions everywhere (600-800ms minimum)
- Typewriter text speed: 1 character per 50ms
- No rapid tapping mechanics
- Walk speed: 2 tiles/second (calm, not rushing)
- Scene transitions: gentle fade through soft pink (800ms)

### Color Rules
- Pastel palette, 60-70% saturation max
- Max 5-6 dominant colors per scene
- NO neon, NO high-contrast flashing
- Sunset palette shifts to warm golds and lavenders
- Night palette is deep purples and soft blues

### Sound Rules
- All sounds gentle, nothing startling
- SFX at -6dB to -12dB normalized
- No sudden loud sounds ever
- BGM: soft, ambient, pentatonic melodies
- Wind-down: music tempo decreases, volume fades

### No "Just One More" Loops
- After wind-down screen, no prompt to play again
- Default state after session = warm goodbye
- Starting a new session requires deliberate action

---

## Technical Architecture

### Engine
- Vanilla JS on HTML5 Canvas (no frameworks)
- 480x320 logical resolution, scaled up for crisp pixel art
- 30 FPS target (calmer, saves battery)
- Network-first service worker for auto-updates
- Auto-save to localStorage on every quest completion and scene change

### File Structure
```
princess-sparkle-v2/
├── index.html              # Canvas boot
├── sw.js                   # Service worker
├── update-checker.js       # Auto-update system
├── manifest.json           # PWA manifest
├── game/
│   ├── main.js             # Entry point
│   ├── engine/             # Core systems
│   │   ├── GameLoop.js
│   │   ├── SceneManager.js
│   │   ├── Renderer.js
│   │   ├── InputManager.js
│   │   ├── AudioManager.js
│   │   ├── AssetLoader.js
│   │   ├── Camera.js
│   │   └── SaveManager.js
│   ├── scenes/
│   │   ├── TitleScene.js
│   │   ├── CompanionSelectScene.js
│   │   ├── OverworldScene.js
│   │   ├── DialogueScene.js
│   │   ├── QuestCompleteScene.js
│   │   └── WindDownScene.js
│   ├── entities/
│   │   ├── Player.js
│   │   ├── Companion.js
│   │   ├── NPC.js
│   │   └── ParticleSystem.js
│   ├── systems/
│   │   ├── MovementSystem.js
│   │   ├── CollisionSystem.js
│   │   ├── QuestSystem.js
│   │   ├── SessionGuard.js
│   │   └── DialogueSystem.js
│   ├── companions/
│   │   ├── Shimmer.js
│   │   ├── Ember.js
│   │   ├── Petal.js
│   │   ├── Breeze.js
│   │   └── Pip.js
│   ├── world/
│   │   ├── TileMap.js
│   │   ├── TileSet.js
│   │   └── WorldLoader.js
│   ├── ui/
│   │   ├── DialogueBox.js
│   │   ├── QuestIndicator.js
│   │   ├── HUD.js
│   │   └── TransitionOverlay.js
│   └── data/
│       ├── companions.js
│       ├── familyValues.js
│       └── spriteIndex.js
├── levels/
│   ├── level-sparkle-village.js
│   ├── level-whisper-forest.js
│   └── level-template.js
├── sprites/                # Open source pixel art (Kenney + custom)
├── audio/
│   ├── sfx/               # Kenney CC0 sound effects
│   ├── bgm/               # Eddie's Suno-generated music
│   └── voice/             # Eddie's recorded voice lines
└── voice-script/
    └── SCRIPT.md          # Full voice script with direction
```

### Assets
- **Tiles**: Kenney Tiny Town + Tiny Dungeon (CC0)
- **SFX**: Kenney UI Audio + RPG Audio (CC0), Freesound.org for ambience
- **Music**: Created by Eddie with Suno
- **Voice**: Recorded by Eddie from script
- **Sprites**: Kenney base + custom companion sprites

### Save System
- Auto-saves to localStorage after every quest completion
- Save data: companion choice, level, hearts, quest progress, journal entries
- "Continue Adventure" on title screen if save exists
- No manual save needed — it just works

### Eddie's Content Workflow
1. Copy `levels/level-template.js` for new areas
2. Define tiles, NPCs, quests, and dialogue in the file
3. Record voice lines per the script guide
4. Push to GitHub — auto-deploys in ~30 seconds
5. Daughter gets "New adventure ready!" banner within 5 minutes

---

## Build Phases

### Phase 1: Playable Engine
- Canvas setup, game loop, scene manager
- Touch input (tap-to-move)
- Title screen with "tap to start"

### Phase 2: World & Movement
- Tile map renderer with Kenney assets
- Player sprite with walk animation
- Camera follow
- Collision detection

### Phase 3: Companions
- Companion selection screen
- Follow AI with particle trails
- All 5 companions with unique effects

### Phase 4: Quests & Dialogue
- Voice-driven dialogue system
- Quest state machine
- NPCs with interaction zones
- Quest completion celebration

### Phase 5: Session & Polish
- Session timer with sunset mechanic
- Wind-down screen
- Auto-save
- HUD (hearts, companion portrait)
- Audio manager with BGM crossfade

### Phase 6: Content
- Sparkle Village (full level with 8-10 quests)
- Whisper Forest (full level with 8-10 quests)
- All voice lines recorded
- All music tracks created
