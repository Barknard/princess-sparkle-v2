# Princess Sparkle V2 — Project Bible

**The single source of truth.** Read this first when returning to the project.
Everything you need to get back up to speed in 5 minutes.

**Last Updated**: 2026-04-05
**Repo**: https://github.com/Barknard/princess-sparkle-v2 (public)
**Live URL**: https://barknard.github.io/princess-sparkle-v2/
**Platform**: iPad PWA (GitHub Pages, auto-updates via service worker)

---

## What Is This?

A **Pokemon-esque educational RPG** for Eddie's 4.5-year-old daughter.
She plays as a princess who chooses a companion creature and spreads
happiness through a pixel art world by helping people and learning
family values (sharing, kindness, helping, empathy, patience, cooperation).

**The game is specifically designed to be anti-addictive** using
peer-reviewed child psychology research. No flashing lights, no
variable rewards, no FOMO, no fail states, no combat.

---

## Quick Links to All Design Docs

| Doc | What It Contains |
|-----|-----------------|
| [GAME-DESIGN.md](GAME-DESIGN.md) | Full game design document: rules, mechanics, companions, quests, session flow, tech architecture, build phases |
| [OPENING-STORYBOARD.md](OPENING-STORYBOARD.md) | Moment-by-moment first 20 minutes: cinematic opening, companion selection, first quest, wind-down. Frame-by-frame with timings. |
| [WORLD-LIFE.md](WORLD-LIFE.md) | Everything that makes the world alive: 30+ tappable objects, 12+ animal types, silly NPC behaviors, music/rhythm moments, companion care, dress-up, garden system, weather, hidden discoveries, complete SFX table with Hz ranges and volume levels |
| [CONTENT-GUIDE.md](CONTENT-GUIDE.md) | How to add new levels, quests, NPCs, companions, objects, sounds, music, voice lines. Copy-paste templates. |
| [voice-script/SCRIPT.md](voice-script/SCRIPT.md) | Complete voice script: ~272 lines across 10 scenes with character, text, voice direction, and filenames. Recording guide for Eddie. |
| [audio/sfx/SOURCES.md](audio/sfx/SOURCES.md) | Attribution and licensing for all sound effects |

---

## The Player

- **Age**: 4.5 years old
- **Pre-literate**: Cannot read. ALL game info delivered via voice narration, icons, animation
- **Device**: iPad (touchscreen)
- **Session length**: ~20 minutes per quest cycle
- **Reading level**: None. Max 10 words per spoken sentence. Simple, concrete vocabulary.

---

## Core Design Rules (Non-Negotiable)

1. No required reading (voice + icons only)
2. No variable rewards (always predictable)
3. No combat (creatures collaborate, never fight)
4. No fail states (gentle redirection, never "game over")
5. No FOMO (nothing time-limited, no daily streaks)
6. No competitive elements (no leaderboards)
7. Finite sessions with natural endpoints (20 min quest cycle)
8. Positive goodbye ritual (stopping feels warm)
9. Max 5-6 colors per scene (pastels, 60-70% saturation)
10. 80% success rate (quietly adaptive, never announced)
11. Every tap produces a visible + audible response
12. 3-5 interactive objects visible on every screen
13. Sound: never more than 1 SFX at a time + ambient music
14. Transitions: minimum 400-800ms, always ease-in-out
15. No sounds above 4000 Hz with sharp attack

---

## The 5 Companions

| Name | Creature | Trail Effect | Personality | Voice |
|------|----------|-------------|-------------|-------|
| **Shimmer** | Unicorn | Rainbow sparkle stars | Gentle, wise, encouraging | Warm, melodic, kind older sister |
| **Ember** | Baby Dragon | Warm golden sparks | Playful, curious, brave | Excited whisper, giggly |
| **Petal** | Bunny | Flowers blooming | Shy, sweet, caring | Very soft, tender, almost whispering |
| **Breeze** | Butterfly | Glowing wish-dust | Dreamy, poetic, free-spirited | Airy, whimsical, sing-song |
| **Pip** | Fox Cub | Musical notes | Cheerful, loyal, adventurous | Bright, peppy, enthusiastic |

**Companions level up** alongside the princess and **evolve** at milestones:
- Level 1-3: Baby form
- Level 4-6: Young form (larger, more detail)
- Level 7+: Full form (elaborate trail)

---

## World Areas

| Area | Status | Theme | BGM |
|------|--------|-------|-----|
| **Sparkle Village** | Designed | Home town, NPCs, Rainbow Bridge | Eddie creates with Suno |
| **Whisper Forest** | Designed | Magic forest, Owl Sage, nature | Eddie creates with Suno |
| *(future areas)* | Not started | Add via CONTENT-GUIDE.md | — |

---

## Key NPCs

### Sparkle Village
- **Grandma Rose** — warm grandmother, first quest giver (sharing cookies)
- **Neighbor Lily** — cheerful, receives cookies, grateful
- **Little Finn** — 5yo boy, scared of swing, needs encouragement
- **Baker Maple** — jolly, drops pies (silly moment)
- **Mayor Clover** — kind but worried, village-scale problems
- **Melody the Cricket** — musician NPC, rhythm interactions

### Whisper Forest
- **Owl Sage** — wise, gentle riddles, explains the forest needs kindness
- **Squirrel Dash** — fast-talking, always losing things
- **Deer Dawn** — graceful, helps lost creatures
- **Firefly Flicker** — tiny voice, lights up when happy

---

## Quest System

**Overall quest per area:**
- Village: "The Rainbow Bridge is broken! Spread happiness to rebuild it."
- Forest: "The forest is losing its color! Spread kindness to bring it back."

**Mini quests** (~5-7 min each, 3-4 per session):
- TALK_TO → DELIVER → RETURN_TO (Grandma's cookies)
- TALK_TO → OBSERVE → TALK_TO (Helping Finn)
- INTERACT → INTERACT → RETURN_TO (Water the garden)

**Values taught**: sharing, kindness, helping, empathy, patience, cooperation

**Rewards**: Hearts (predictable, fixed), accessories (cosmetic), Rainbow Bridge progress, Friendship Journal entries

---

## Session Flow (20 minutes)

```
0:00-0:45   Opening cinematic (sky, rainbow, village, princess)
0:45-1:00   Narrator welcome
1:00-1:10   First tap (sparkle burst)
1:10-3:30   Companion selection
3:30-5:00   Village arrival + tutorial
5:00-10:00  Quest 1 (sharing)
10:00-11:00 Free exploration (tap flowers, pet animals)
11:00-16:00 Quest 2 (kindness)
16:00-17:00 Exploration / kindness encounter
17:00-18:00 Sunset begins (sky warms, music slows)
18:00-19:00 Companion wind-down comment
19:00-20:00 Wind-down screen, goodnight, auto-save
```

---

## Technical Architecture

### Engine (Vanilla JS, no frameworks)
- **Renderer**: 480x320 logical resolution, integer-scaled to fill any screen, letterboxed, imageSmoothingEnabled=false
- **Game Loop**: requestAnimationFrame, 30fps target, fixed timestep accumulator
- **Scene Manager**: Stack-based (push/pop). Transparent overlays for dialogue.
- **Input**: Touch-first (TAP, SWIPE, HOLD). Min 48px touch targets (75px preferred). Mouse fallback for testing.
- **Audio**: Web Audio API. BGM crossfade 1500ms. Max 1 SFX at a time. iOS unlock on first tap.
- **Camera**: Smooth lerp follow (factor 0.08), clamped to world bounds
- **Save**: Auto-save to localStorage on quest complete and scene change
- **Transitions**: Fade (soft pink), iris (dark purple), white. 800ms default.

### Performance (Hard Rules)
- Object pooling for particles (200), events (32), indicators (16)
- Zero allocations in game loop hot path
- Integer coordinates throughout (bitwise `| 0`)
- Only render visible tiles (camera culling)
- Typed arrays for collision maps (Uint8Array)
- No DOM manipulation per frame

### File Structure
```
princess-sparkle-v2/
├── index.html                 # Canvas bootstrap + PWA meta
├── sw.js                      # Service worker (network-first)
├── update-checker.js          # Auto-update polling
├── manifest.json              # PWA manifest
├── game/
│   ├── main.js                # Entry point
│   ├── engine/                # Core systems (9 files)
│   │   ├── GameLoop.js
│   │   ├── Renderer.js        # 480x320, any-screen scaling
│   │   ├── SceneManager.js
│   │   ├── InputManager.js
│   │   ├── AudioManager.js
│   │   ├── AssetLoader.js
│   │   ├── Camera.js
│   │   ├── SaveManager.js
│   │   └── TransitionOverlay.js
│   ├── scenes/                # Game screens (6 files)
│   │   ├── TitleScene.js      # 7-phase cinematic opening
│   │   ├── CompanionSelectScene.js
│   │   ├── OverworldScene.js  # Main gameplay
│   │   ├── DialogueScene.js   # Voice-driven overlay
│   │   ├── QuestCompleteScene.js
│   │   └── WindDownScene.js
│   ├── entities/              # Game objects
│   │   ├── Player.js
│   │   ├── Companion.js
│   │   ├── NPC.js
│   │   ├── Animal.js
│   │   ├── WorldObject.js
│   │   └── ParticleSystem.js
│   ├── companions/            # 5 companion subclasses
│   │   ├── Shimmer.js, Ember.js, Petal.js, Breeze.js, Pip.js
│   ├── systems/               # Game logic
│   │   ├── MovementSystem.js  # BFS pathfinding
│   │   ├── CollisionSystem.js
│   │   ├── QuestSystem.js
│   │   ├── SessionGuard.js    # Anti-addiction timer
│   │   ├── DialogueSystem.js
│   │   └── WeatherSystem.js
│   ├── world/
│   │   ├── TileMap.js, TileSet.js, WorldLoader.js, LevelRegistry.js
│   ├── ui/
│   │   ├── DialogueBox.js, HUD.js, QuestIndicator.js, TransitionOverlay.js
│   └── data/
│       ├── companions.js, familyValues.js, spriteIndex.js, sfxIndex.js
├── levels/                    # Level data (add new levels here)
│   ├── level-sparkle-village.js
│   ├── level-whisper-forest.js
│   └── level-template.js      # Copy this to make new levels
├── sprites/                   # Pixel art assets
├── audio/
│   ├── sfx/                   # 39 CC0 sound effects organized by category
│   ├── bgm/                   # Eddie's Suno music
│   └── voice/                 # Eddie's recorded voice lines
├── voice-script/
│   └── SCRIPT.md              # 272+ voice lines with direction
└── images/                    # V1 assets (princess portraits for title)
```

---

## Assets

### Pixel Art (Open Source)
- **Recommended**: Pocket Creature Tamer Adventure Kit (itch.io, $6.99 commercial)
- **Alternative**: Kenney Tiny Town + Tiny Dungeon (CC0, free)
- **Alternative**: Monster Taming Game Essentials (CC BY 4.0, free)
- **Characters**: Kenmi Cute Fantasy RPG (itch.io)
- **Status**: Need to purchase/download and integrate

### Sound Effects (39 files, mostly CC0)
- Kenney UI Audio + RPG Audio (CC0)
- OpenGameArt contributions (CC0/CC-BY)
- Freesound.org (CC0)
- All normalized to -12dB, band-pass 80-4000 Hz
- See `audio/sfx/SOURCES.md` for full attribution

### Music
- Eddie creates with **Suno**
- Engine supports BGM with 1500ms crossfade
- Save to `audio/bgm/bgm-area-name.mp3`
- Reference in level data: `bgm: 'bgm-area-name'`

### Voice
- Eddie records all voices himself (~350-370 lines total)
- Script at `voice-script/SCRIPT.md` with per-line direction
- Save to `audio/voice/[line_id].mp3`
- Recording rules: speak slowly, smile, 2-4 sec per line, quiet room

---

## Child Psychology Research Applied

Based on peer-reviewed research (full citations in the child psychology agent's reports):

### Fun Factor (what makes it FUN, not just educational)
- **Effectance motivation** (White, 1959): Every tap = visible + audible result
- **Physical comedy** (McGhee, 1979; Loizou, 2005): Silly NPC moments, clumsy animals
- **Cause and effect discovery**: 30+ tappable world objects with unique responses
- **Animal interaction** (DeLoache et al., 2011): 12+ animal types, pettable, followable
- **Music/rhythm** (Kirschner & Tomasello, 2010): Stepping stones, frog chorus, drum log
- **Pretend play** (Lillard et al., 2013): She IS the princess, making real choices
- **Mastery through repetition** (Piaget, 1962): Same mechanics, slight variation

### Anti-Addiction (what keeps it healthy)
- **Fixed rewards only** — no variable reinforcement schedules (Griffiths & Parke, 2005)
- **Session design** — complete story arcs, not infinite engagement loops
- **Sunset mechanic** — world visually winds down, not hard-stopped
- **No competitive elements** — cooperative play increases sharing (PMC research)
- **Companion attachment** — healthy relational return motivation (Kahn et al., 2012)
- **No FOMO** — all content always available, nothing expires

### Sound Design
- Mid-frequency range (300-3000 Hz) preferred by developing auditory systems (Werner, 2007)
- Ascending intervals = positive social approach (Juslin & Laukka, 2003)
- Warm timbres activate social engagement system (Porges, 2011)
- Quest complete sound = "proud parent smile," NOT "jackpot excitement"
- Heart earned sound = "hug feeling," NOT "score notification"
- NEVER: sharp high transients, sudden loud sounds, slot-machine patterns, layered SFX

### Age-Appropriate Design (4.5 years old)
- Pre-literate: voice + icons only (no text-dependent gameplay)
- Touch targets: 75px minimum for small fingers
- Attention span: 8-12 min per structured activity
- Navigation: tap and simple swipe only (no pinch/complex gestures)
- Adaptive difficulty: if she fails twice, quietly make it easier
- Immediate feedback on every action

---

## Deployment & Update Workflow

```
Eddie writes code → git push → GitHub Pages deploys (~30s) →
Service worker checks every 5 min → "New adventure ready!" banner →
She taps → latest version loads
```

She can also play **offline** — the service worker caches everything.

---

## Agents Available

| Agent | Purpose |
|-------|---------|
| **child-psychologist** | Research-backed child development guidance, game assessment, anti-addiction review. Peer-reviewed citations only. Has family context embedded. |

---

## Version History

### v2.0.0 (2026-03-20) — Project Kickoff
- Forked from princess-sparkle v1 (nighttime activity planner)
- Created new repo: princess-sparkle-v2 (public, GitHub Pages)
- Full game design document written
- Opening storyboard (20-min experience mapped moment by moment)
- World Life bible (tappable objects, animals, silly moments, SFX, etc.)
- Voice script: 272+ lines across 10 scenes
- Content creation guide with templates
- Child psychology research: anti-addiction, fun factor, sound design, age-appropriate mechanics
- SFX: 39 CC0 sound effects downloaded, organized, normalized
- Engine built: GameLoop, Renderer (any-screen scaling), SceneManager, InputManager, AudioManager, AssetLoader, Camera, SaveManager, TransitionOverlay
- Scenes built: TitleScene (7-phase cinematic), CompanionSelect, Overworld, Dialogue, QuestComplete, WindDown
- UI built: DialogueBox, HUD, QuestIndicator, TransitionOverlay
- Entities & Systems: building (Player, Companions, NPCs, Animals, Quests, Weather, etc.)
- PWA: service worker, auto-update, Add to Home Screen support

### DONE (Session 2 — 2026-03-20)
- [x] Full integration: all imports resolved, zero JS errors
- [x] Kenney Tiny Town + Dungeon tilesets wired into renderer
- [x] Sparkle Village level built with correct tile IDs (90% green grass)
- [x] Superdark Fantasy pack: 25 animated characters (princess, NPCs)
- [x] Superdark Enchanted Forest: 27 animated creatures (wolf, fairy, bear)
- [x] Anokolisa Pixel Crawler: heroes with 14 animation types
- [x] Szym Tiny Pack: 96 Kenney-style characters + creatures
- [x] 6 combined spritesheets built (princess, merchant, townsfolk, wolf, fairy)
- [x] Walk animations wired: 4-frame walk at 150ms, idle at 400ms, horizontal flip
- [x] Pre-literate UX: all text removed, visual affordance only, auto-advance
- [x] Companion select: auto-cycle showcase, escalating nudges, never auto-picks
- [x] 8 ambient world life systems (grass sway, sparkles, butterflies, bloom, shimmer, trail, tint)
- [x] SFX name mismatches fixed, voice routing through voiceIndex.js
- [x] Title cinematic: fluffy clouds, rainbow arc, gentle village pan
- [x] Auto-discovery for all assets (voice, SFX, sprites, levels)
- [x] Playwright test loops: 3 rounds, all critical errors resolved
- [x] 43+ narrator voice recordings wired in
- [x] 3 custom agents: child-psychologist, game-art-director, map-builder
- [x] MAP-DESIGN-RULES.md from research (Pokemon/Stardew analysis)

### v2.1.0 (2026-04-05) — Map Trainer V2 + Game Studio

**Map Trainer V2** — Full procedural village map generation system:
- [x] V2 engine: zone grammar + composite building placement
- [x] V2 learner: adjacency rules + cross-layer + layer-aware learning from training data
- [x] V2 scorer: 8-dimension scoring (paths, buildings, trees, decorations, ground, composition, water, village feel)
- [x] V2 structural scorer: local structural similarity comparing building positions, path networks, vegetation zones, composition (no API calls)
- [x] Painted map tool (v2-painter.html) with layers, custom tiles, selection, groups
- [x] Tile annotator/tagger tool (v2-annotator.html) with grid calibration
- [x] Training dashboard (v2-dashboard.html) with real-time radar chart, score history, heatmap, live log
- [x] Genetic evolution + simulated annealing for map optimization
- [x] 686 learned adjacency rules from 9 training maps (js13k-level1 through level8 + painted map)
- [x] Anti-stall: adaptive mutation scaling based on stagnation
- [x] Memory optimized: reusable buffers, Uint8Array lookups, periodic GC
- [x] Two castle styles: custom 204-based (compact) + tileset-based (repeating tower+arch sections)
- [x] Building materials derived from tile tags (gray/red roofs, wood/stone walls)
- [x] Foreground vegetation: frequency-weighted scatter, adjacency-aware placement, cross-layer relationships
- [x] Tree quality fixes: orphan canopy/trunk removal, edge validation, Dense2 block cleanup
- [x] Houses minimum 3 tiles wide (doors never cut off)
- [x] Best V1 saved: `v2-engine-best-v1-2026-04-05.js` (score 72%)
- [x] Best V2 saved: `v2-engine-v2-moderate-2026-04-05.js` (score 68%, cleaner trees)

**Game Studio** — Unified tool interface:
- [x] `tools/studio.html` — tab-based shell combining all editors
- [x] Sprite Viewer with animation preview, frame range editor, master override
- [x] Keyboard shortcuts: 1-6 for tabs, Alt+arrows for prev/next
- [x] Lazy-loading iframes preserve each tool's state

**Sprite System**:
- [x] 17 character/creature spritesheets (128x16, 8 frames each at 16x16)
- [x] `sprite-anims.json` — animation definitions with idle/walk frame ranges and speeds
- [x] Sprite viewer: per-sprite frame range editing, animation preview, scale/BG controls
- [x] Master override checkbox applies idle/walk settings to all sprites at once
- [x] Roles: player (princess), NPCs (merchant, townsfolk, queen, alchemist, blacksmith, knight, elf-female, elf-princess, ranger), creatures (wolf, fairy, bear, mushroom, ent, forest-guardian)

### TODO
- [ ] Eddie: Create BGM tracks in Suno (village theme, forest theme, lullaby)
- [ ] Eddie: Continue recording voice lines from SCRIPT.md
- [ ] Eddie: Download animated unicorn/dragon/bunny via PixelLab or PixelBox
- [ ] Test on physical iPad
- [ ] Build Whisper Forest level (use map trainer V2 with new target map)
- [ ] Wire Superdark princess walk animation into overworld (spritesheet ready)
- [ ] Add companion evolution visuals
- [ ] Add dress-up/accessory system
- [ ] Add garden system
- [ ] Add rainbow return portal mechanic
- [ ] Add kindness encounter random events
- [ ] Performance audit on iPad
- [ ] Run map trainer with more training maps for richer adjacency rules
- [ ] Integrate generated maps back into game levels
- [ ] Add level selection/world map screen

---

## Map Trainer V2

The procedural map generator lives in `tools/map-trainer/v2/`. It learns from example maps and evolves new villages.

### How to Run
```bash
cd princess-sparkle-v2

# Quick run (200 gens, good for testing changes)
node --max-old-space-size=8192 --expose-gc tools/map-trainer/v2/v2-server.js --target=99 --max-gens=200 --pop=20

# Full training run (2000+ gens)
node --max-old-space-size=8192 --expose-gc tools/map-trainer/v2/v2-server.js --target=99 --max-gens=5000 --pop=20

# Dashboard at http://localhost:3456
```

### Key Files
| File | Purpose |
|------|---------|
| `v2-engine.js` | Map generator: ground fill, building placement, paths, trees, decorations, water, collision |
| `v2-scorer.js` | 8-dimension quality scorer (0-100) |
| `v2-structural-scorer.js` | Structural similarity to target map (buildings, paths, vegetation, composition) |
| `v2-learner.js` | Learns adjacency + cross-layer rules from maps |
| `v2-server.js` | Express server + genetic evolution loop + simulated annealing |
| `v2-dashboard.html` | Real-time training monitor |
| `v2-painter.html` | Hand-paint reference maps for training |
| `v2-annotator.html` | Tag tiles with metadata (roof, wall, door, fence, etc.) |
| `learned-knowledge-v2.json` | 686 adjacency rules learned from 9 training maps |
| `tile-tags.json` | 120 tiles tagged with position/material/type metadata |
| `painted-map.json` | Eddie's hand-painted 24x14 reference village |
| `js13k-level1.json` | 36x24 training map (dense village, castle, fences) |

### Saved Engine Versions
| Version | File | Score | Notes |
|---------|------|-------|-------|
| V1 Best | `v2-engine-best-v1-2026-04-05.js` | 72% | Before tree/foreground fixes |
| V2 Moderate | `v2-engine-v2-moderate-2026-04-05.js` | 68% | Clean trees, frequency-weighted scatter, edge validation |

### Fitness Formula
```
fitness = design_quality * 0.4 + structural_match * 0.3 + tile_match * 0.3
```

---

## Game Studio

Unified editor interface at `tools/studio.html`. Serves from any HTTP server:

```bash
npx http-server . -p 3456 -c-1 --cors
# Then open http://localhost:3456/tools/studio.html
```

### Tabs
| # | Tab | Tool | Purpose |
|---|-----|------|---------|
| 1 | Sprites | `sprite-viewer.html` | View/edit character animations, set idle/walk frame ranges |
| 2 | Tile Catalog | `tile-viewer.html` | Browse all 132 Kenney Tiny Town tiles with tags |
| 3 | Map Painter | `v2-painter.html` | Hand-paint maps on 3 layers (ground/objects/foreground) |
| 4 | Tile Tagger | `v2-annotator.html` | Tag tiles with metadata for the engine |
| 5 | Map Trainer | `v2-dashboard.html` | Monitor evolution training in real-time |
| 6 | Trainer V1 | `trainer-ui.html` | Legacy trainer interface |

---

## How to Resume Work

1. Read this file (PROJECT-BIBLE.md)
2. Check the TODO list above
3. Open the Game Studio: `npx http-server . -p 3456 && open http://localhost:3456/tools/studio.html`
4. For game design questions → read GAME-DESIGN.md
5. For "what does the player experience" → read OPENING-STORYBOARD.md
6. For world interactivity details → read WORLD-LIFE.md
7. For adding content → read CONTENT-GUIDE.md
8. For voice recording → read voice-script/SCRIPT.md
9. For child psychology guidance → invoke child-psychologist agent
10. For map generation → run the map trainer (see Map Trainer V2 section above)
11. For code architecture → look at game/ directory structure above
