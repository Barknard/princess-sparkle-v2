# Agent Learnings — Mistakes Made, Lessons Learned

This file captures every mistake made during development so agents don't repeat them.
Every agent should read this before starting work.

---

## TILE ID MISTAKES (Critical — caused wrong visuals)

### Lesson 1: Grass is tile 1/2, NOT 37/38
- **Mistake**: Multiple agents used tiles 37/38 for grass (they're path/dirt tiles)
- **Root cause**: TILE-REFERENCE.md had wrong descriptions for Row 0 vs Row 3
- **Fix**: Always VIEW the tilemap_packed.png image before using tile IDs
- **Rule**: If unsure about a tile ID, READ the PNG — never trust text descriptions alone

### Lesson 2: Building roofs are 63/64/65, NOT 60/61/62
- **Mistake**: Early builds used 60/61/62 for roofs (wrong tiles)
- **Root cause**: Tile reference doc was inaccurate
- **Fix**: Verified from visual inspection — 63=left slope, 64=mid, 65=right slope
- **Rule**: TILE-BUILDING-RULES.md is the authority, not TILE-REFERENCE.md

### Lesson 3: Bush tile is 28, NOT 14
- **Mistake**: Tile 14 renders as a peach/cream block, not a green bush
- **Root cause**: Assumed tile 14 = bush from text description without visual verification
- **Fix**: Changed to tile 28 (actual green oval bush)
- **Rule**: Every decoration tile must be visually verified before use

### Lesson 4: Decoration tiles may be dungeon items
- **Mistake**: Some tile IDs (barrel=107, crate=106, signpost=116) may render as bombs/forks/dungeon items
- **Root cause**: Tile IDs were assigned from text descriptions without viewing the tilemap
- **Fix**: Every decoration tile must be compared to the actual tilemap PNG
- **Rule**: Before placing ANY tile, look at what it actually IS in the image

---

## CODE WIRING MISTAKES (Critical — caused broken features)

### Lesson 5: _loadWorldObjects() was a stub
- **Mistake**: The overworld was an empty tile viewer for hours because _loadWorldObjects() loaded nothing from the level data
- **Root cause**: The stub said "This would be populated from level data files" and nobody implemented it
- **Fix**: Rewrote to actually read NPCs, objects, animals from level data
- **Rule**: ALWAYS verify that data-loading methods actually load data — stubs are invisible bugs

### Lesson 6: SFX files were never loaded into AudioManager
- **Mistake**: 39 SFX MP3 files on disk but AudioManager.playSFX() couldn't find them
- **Root cause**: main.js created AssetLoader but never called it to load SFX
- **Fix**: Added fetch+decode loop in boot() to load all SFX from sfxIndex.js
- **Rule**: If a system has assets on disk, verify they're being LOADED at startup

### Lesson 7: Voice system needed AudioContext wiring
- **Mistake**: Voice files existed but never played because voiceIndex.js had no AudioContext
- **Root cause**: main.js never called setAudioContext() or unlockVoiceAudio()
- **Fix**: Added both calls in main.js init
- **Rule**: Every audio subsystem needs explicit wiring to the shared AudioContext

### Lesson 8: InputManager not passed to scenes
- **Mistake**: TitleScene._inputManager was null because SceneManager didn't pass it
- **Root cause**: The game object has inputManager, but some scenes check it differently
- **Fix**: Made voice playback unconditional (voice system handles blocking internally)
- **Rule**: Don't assume scene init() receives all system references — verify

---

## COORDINATE SYSTEM MISTAKES

### Lesson 9: Tile coords vs pixel coords
- **Mistake**: Player, Companion, and NPCs were mixing tile coordinates and pixel coordinates
- **Root cause**: Some code used tile units (x=5) and some used pixel units (x=80) without consistency
- **Fix**: Standardized everything to pixel coordinates (tile * 16)
- **Rule**: The game uses PIXEL coordinates everywhere. Level data specifies TILE positions that must be multiplied by 16.

### Lesson 10: Playwright click coordinates
- **Mistake**: Playwright tests clicked wrong positions because viewport→logical scaling was wrong
- **Root cause**: Scale factor calculation didn't account for letterboxing offset
- **Fix**: Read actual companion positions from game state via page.evaluate()
- **Rule**: Never hardcode click coordinates — read them from the game's runtime state

---

## DESIGN MISTAKES

### Lesson 11: 30x20 map is too small
- **Mistake**: First village was crammed into one screen (30x20 = exactly one viewport)
- **Fix**: Expanded to 60x40 with camera scrolling
- **Rule**: Maps should be 2-4x the viewport size minimum

### Lesson 12: Intro was 58 seconds
- **Mistake**: A 4.5yo doesn't wait 58 seconds to play
- **Fix**: Compress to 15-20 seconds total
- **Rule**: First gameplay interaction must happen within 15-20 seconds of opening the app

### Lesson 13: Art style mismatch in walk animation
- **Mistake**: Princess walk used RPG 8-bit sheet (different art style from Kenney idle sprite)
- **Fix**: Removed RPG 8-bit fallback — use Superdark sheets or static Kenney sprite only
- **Rule**: Never mix art styles from different packs in the same character

### Lesson 14: Text buttons for pre-literate child
- **Mistake**: "Choose Shimmer" text button, "Back to Adventure" text, etc.
- **Fix**: Replaced all text with visual icons (glowing hearts, sparkle portals, moon icon)
- **Rule**: Zero text that the player needs to read. All communication through visuals and voice.

### Lesson 15: No auto-advance on non-choice screens
- **Mistake**: Game waited for tap on the sparkle prompt forever
- **Fix**: Auto-advance after timeout on non-choice screens
- **Rule**: Non-choice screens auto-advance. Choice screens (companion select) wait forever but nudge.

---

## PROCESS MISTAKES

### Lesson 16: Building the map before researching how
- **Mistake**: Built the village map before studying how Pokemon/Stardew villages are composed
- **Fix**: Research first → design rules → then build
- **Rule**: ALWAYS research before building. Read examples. Study the masters.

### Lesson 17: Not screenshotting during build
- **Mistake**: Map builder wrote tile arrays without ever seeing the result
- **Fix**: Added Playwright self-review to map builder workflow
- **Rule**: Every visual change must be screenshotted and reviewed before committing

### Lesson 18: Downloaded sprite files that were HTML pages
- **Mistake**: curl saved itch.io HTML download pages as .png files
- **Root cause**: itch.io requires browser-based download, not direct curl
- **Fix**: Detected and deleted HTML-as-PNG fakes
- **Rule**: After downloading any asset, verify it with `file` command — check it's actually an image
