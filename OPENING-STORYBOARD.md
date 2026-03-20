# Princess Sparkle V2 — Opening Storyboard

Every moment from app open to first quest completion, frame by frame.
This is what your daughter experiences. Nothing is built yet — this is
the blueprint we agree on before writing code.

---

## MOMENT 0: App Opens (0-3 seconds)

**Screen:** Solid soft pink (#ffe0ec) fills the screen.
**Audio:** Silence. Then a single, soft wind chime.
**Action:** A tiny sparkle appears in the center and gently pulses.
**Feel:** Calm. Like opening a picture book.

> No loading bar. No logos. No text. Just warmth.

---

## MOMENT 1: The Sky (3-10 seconds)

**Screen:** The pink fades into a pixel art sky. Soft blue at the top,
pale pink and peach at the horizon. Three or four fluffy pixel clouds
drift very slowly from right to left.
**Audio:** Gentle ambient sound — soft breeze, a single bird chirp
(not many — just one, like a hello).
**Action:** Nothing to tap. She just watches.
**Feel:** Wonder. "What is this?"

**Visual details:**
- Sky is gradient: #aaddff (top) → #ffd6e8 (horizon)
- Clouds are 3-4 pixel puffs, white with soft shadow
- They drift at ~0.3 pixels per frame (very slow)
- Stars twinkle gently in the upper sky (even though it's daytime —
  these are magic sparkle stars, not real stars)

---

## MOMENT 2: The Rainbow (10-20 seconds)

**Screen:** From the left side of the sky, a rainbow begins to arc
across the screen. It builds piece by piece — one color at a time.
Not fast. Each color band takes about 1.5 seconds to sweep across.
**Audio:** Each color adds a gentle ascending chime note:
- Red: soft C note
- Orange: D note
- Yellow: E note
- Green: G note
- Blue: A note
- Purple: high C note
Together they form a simple ascending melody.
**Action:** Nothing to tap yet. She watches the rainbow build.
**Feel:** Delight. Magic is happening.

**Visual details:**
- Rainbow is 6 colors (no indigo — keep it simple for a 4yo)
- Each band is ~4px wide at this zoom
- Arc follows a gentle curve from lower-left to upper-right
- Each band trails sparkle particles as it draws across
- Once complete, the full rainbow glows softly

---

## MOMENT 3: Camera Pans Down (20-28 seconds)

**Screen:** The camera slowly pans downward, following the rainbow.
The sky scrolls up and out of view. Below the rainbow, a pixel art
village comes into view — little houses with colorful roofs, a path,
trees, flowers, a small pond.
**Audio:** The ambient breeze continues. A soft, gentle music track
begins to fade in (the Sparkle Village theme — Eddie creates this
in Suno). It should be a warm, simple melody. Pentatonic. Think:
a music box playing in a garden.
**Action:** Still no interaction. The pan is automatic.
**Feel:** "I want to go there."

**Visual details:**
- Camera pans at ~1 pixel per frame (smooth, not jerky)
- Village is revealed from rooftops down
- Flowers in the village gently sway (2-frame animation, 800ms cycle)
- Smoke curls from one chimney (4-frame animation, very slow)
- The Rainbow Bridge is visible at the far edge — but it's grey/broken
  (only the arch shape, no color yet)

---

## MOMENT 4: The Princess Appears (28-33 seconds)

**Screen:** Camera stops. The village fills the screen. In the center
of the village square, a soft sparkle gathers (same sparkle from
the very first moment). It grows brighter for 2 seconds, then gently
pops — and the Princess is standing there.
**Audio:** Soft "shimmer" sound effect when she appears. Like tiny
bells ringing.
**Action:** Still no interaction yet.
**Feel:** "That's me!"

**Visual details:**
- Princess is 16x16 pixel sprite, drawn at 2x or 3x scale
- She has a small idle animation (gentle breathing/swaying, 2 frames)
- Crown glints once (small white pixel flashes for 1 frame)
- She faces downward (toward the player/camera)

---

## MOMENT 5: Narrator Welcome (33-42 seconds)

**Screen:** A soft, rounded dialogue box fades in at the bottom of
the screen. No text — just the audio plays. A small narrator icon
(a sparkle or open book) sits to the left of the dialogue area.
**Audio:**
> "Welcome to Princess Sparkle!" (narrator_title_01)
> [1 second pause]
> "A world full of kindness is waiting for you." (narrator_title_02)

**Action:** Nothing to tap yet. Let her absorb.
**Feel:** She's being spoken to directly. She's the princess.

**Important:** The dialogue box has no text — or very minimal
decorative text as visual accent. The voice does all the work.
A visual waveform or gentle pulsing glow on the dialogue box
shows when the voice is speaking.

---

## MOMENT 6: First Tap Prompt (42-50 seconds)

**Screen:** The narrator dialogue box fades out. In its place, a
large, gently pulsing sparkle appears in the center of the screen.
It's big (at least 64x64 CSS pixels) and unmistakable.
**Audio:**
> "Tap the sparkle to begin your adventure." (narrator_title_03)
**Action:** SHE TAPS THE SPARKLE. This is her first interaction.
**Feel:** Agency. "I did that!"

**On tap:**
- The sparkle bursts into a shower of tiny rainbow particles
- A soft, satisfying "pop-chime" plays
- The particles drift outward and fade over 1.5 seconds
- Screen gently fades to soft white (600ms)

---

## MOMENT 7: Companion Selection — Intro (50-60 seconds)

**Screen:** Fades in from white. A soft, rounded stage/clearing.
Five pedestals or patches of light in a gentle arc. Each has a
companion standing on it, doing their idle animation. They're
slightly transparent/ghostly until tapped.
**Audio:**
> "Every princess needs a special friend." (narrator_companion_intro_01)
> [pause]
> "Five friends are here to meet you." (narrator_companion_intro_02)
> [pause]
> "Tap on each one to say hello." (narrator_companion_intro_03)

**Action:** She can now tap on companions.
**Feel:** Excitement. Curiosity. "Who are they?"

**Visual details:**
- Background: soft gradient clearing, maybe a meadow
- Each companion has a subtle colored glow matching their personality:
  - Shimmer: soft rainbow/pink glow
  - Ember: warm orange glow
  - Petal: gentle green glow
  - Breeze: light blue glow
  - Pip: golden glow
- Companions do tiny idle animations (bobbing, blinking)
- Touch targets are LARGE — each companion sits in a ~80x80px zone

---

## MOMENT 8: Meeting Each Companion (player-driven, ~2 min)

**When she taps a companion:**
- That companion's glow brightens
- They grow slightly (1.0 → 1.2 scale, 400ms ease)
- Their intro voice lines play:
  - Shimmer: "Hello, Princess. I am Shimmer. I love to help others
    and make rainbows."
  - Ember: "Hi hi hi! I am Ember! I am a baby dragon and I love
    adventures!"
  - Petal: "Oh... hello. I am Petal. I like flowers... and being kind."
  - Breeze: "Hellooo, lovely Princess. I dream of dancing in the sky
    with you."
  - Pip: "Hey there! I am Pip! Let us go explore together! It will be
    so fun!"
- Their special particle effect plays briefly (rainbow trail, sparks, etc.)
- The other companions stay visible but slightly dimmed

**She can tap as many as she wants, in any order. No rush. No timer.**

**When she taps the same companion twice** (indicating her choice):
- That companion does a happy animation (jump, twirl, sparkle)
- A soft "confirm" glow pulses around them

**A "Choose [Name]" prompt appears** — a large, glowing, friendly
button below the selected companion. Big enough for small fingers
(at least 80px tall).

---

## MOMENT 9: Companion Chosen (5 seconds)

**When she taps the "Choose" button:**
**Audio:**
> "You chose Shimmer! What a wonderful friend." (narrator_companion_confirm)
> [pause]
> "Together, you will help so many people." (narrator_companion_confirm_02)

**Visual:**
- The chosen companion leaps joyfully
- A burst of their signature particles fills the screen
- The other four companions wave goodbye and gently fade out
- The chosen companion moves to stand beside the princess

**Transition:** Gentle iris wipe (circle closes from edges to center,
soft purple, 800ms) → opens onto the village

---

## MOMENT 10: First Steps in the Village (player-driven, ~1 min)

**Screen:** The village from the pan-down earlier, but now at ground
level. The princess stands in the center square. Her companion is
beside her. NPCs are visible walking slowly around.
**Audio:**
> "This is Sparkle Village." (narrator_village_arrive_01)
> "A sweet little town where everyone helps each other."
> (narrator_village_arrive_02)
> [companion reacts — e.g., Shimmer: "Oh, what a lovely village.
> I can feel the kindness here."]
> "But the Rainbow Bridge is broken." (narrator_village_arrive_03)
> "When people are happy, the bridge gets a little brighter."
> (narrator_village_arrive_04)
> "Can you help make everyone happy?" (narrator_village_arrive_05)

Then the tutorial voice lines:
> "Tap anywhere to walk there." (narrator_village_tutorial_01)

**Action:** A gentle pulsing indicator appears on the ground ~3 tiles
away from the princess. It's a soft golden circle, pulsing slowly.
This is the "tap here" hint.

**When she taps:**
- The princess walks to that spot (2 tiles/second)
- Companion follows with their trail
- A gentle footstep sound plays with each step
- Tiny flowers might bloom briefly where she walks

**Feel:** "I can move! My friend follows me!"

---

## MOMENT 11: The Tutorial — Tapping an NPC (30 seconds)

After she walks for the first time:
**Audio:**
> "See that little sparkle? Tap on it to say hello."
> (narrator_village_tutorial_02)

**Visual:** Grandma Rose is standing near a cottage with a soft
glowing "!" star above her head. The star gently pulses.

**Audio:**
> "When someone needs help, you will see a little star."
> (narrator_village_tutorial_03)

Companion says:
> [Shimmer: "Go ahead, Princess. I am right beside you."]

**Action:** She taps Grandma Rose (or walks near and taps).

---

## MOMENT 12: First Quest — Grandma Rose's Cookies

**Quest: "Sharing is Caring"**
**Value: Sharing**
**Duration: ~5-7 minutes**

### Part A: The Request

Dialogue box appears (bottom of screen, no text, voice only):

> Grandma: "Oh, hello there, little Princess!"
> Grandma: "And you brought your friend too! How nice."
> Grandma: "I baked some cookies for my neighbor, Lily."
> Grandma: "But my legs are tired today."
> Grandma: "Could you bring the cookies to Lily for me?"

Each line plays after a tap (or after a 4-second auto-advance timer
if she doesn't tap — research says 4yo attention may not understand
"tap to advance" immediately).

> Narrator: "Tap the cookies to pick them up!"

A plate of cookies appears next to Grandma with a gentle golden glow.

**She taps the cookies:**
- Satisfying "pickup" chime
- Cookies float up to a small inventory indicator in the corner
  (just a tiny cookie icon — no complex UI)
- Grandma smiles (sprite changes to happy frame)

> Narrator: "Now let us bring them to Lily's house."

A soft golden sparkle trail appears on the path leading toward
Lily's house. It's not an arrow — it's just sparkles on the ground
that make the path feel inviting.

### Part B: The Walk

She walks along the path. The companion comments:
> [Companion: personality-specific line about the flowers/journey]

The walk is ~10-15 tiles. Short enough to not lose her, long enough
to feel like an adventure.

**Ambient details during walk:**
- Flowers sway as she passes near them
- A butterfly crosses the path
- Her companion's trail follows behind
- Gentle footstep sounds on grass

### Part C: The Delivery

She reaches Lily's house. Lily stands outside with a soft glow.
She taps Lily:

> Lily: "Oh, hello there! What do you have?"
> Narrator: "Tap the cookies to share them with Lily."

She taps the cookie icon (or Lily):
- Cookie icon animates from the HUD to Lily's hands
- A warm golden glow surrounds them both

> Lily: "Cookies from Grandma Rose? How wonderful!"
> Lily: "Thank you for bringing them to me, Princess."
> Lily: "Sharing makes the world brighter!"

**Visual:** A small heart floats up from Lily and drifts toward the
Rainbow Bridge in the distance. The bridge glows slightly.

### Part D: Return to Grandma

> Narrator: "Grandma will want to know Lily is happy."

Sparkle trail appears back toward Grandma. She walks back.

> Grandma: "Did Lily like the cookies?"
> Grandma: "You are so kind to help me."
> Grandma: "That is what sharing is all about."

### Part E: Quest Complete!

**Celebration screen (3 seconds, no skip):**
- Soft golden light fills the screen edges
- Three hearts float up, one at a time (staggered 400ms)
- The companion does their happy animation
- A warm completion chime plays (ascending 3-note chord)

> Narrator: "You helped Grandma Rose share her cookies!"
> Narrator: "That was so kind of you."

**Visual:** The Rainbow Bridge in the distance — one band of color
(red) lights up with a gentle glow and a chime.

> Narrator: "Look! The Rainbow Bridge is getting brighter!"

**Back to the village.** The "!" appears above another NPC (Little
Finn), but no rush. She can explore, walk around, tap flowers,
enjoy the world.

---

## MOMENT 13: Free Exploration Between Quests

After the first quest, the game does NOT immediately push her toward
the next one. She has time to:

- Walk around the village freely
- Tap on flowers (they bloom with a chime)
- Tap on the pond (a fish jumps with a splash sound)
- Walk near other NPCs who say friendly ambient lines
- Discover that her companion says things when they're idle
- Notice the "!" on Little Finn when she's ready

**This is intentional dead time.** Research says children need
processing time between structured activities. Let her explore.
The companion might say an idle line after 30 seconds:
> [Shimmer: "I wonder if anyone else needs our help today."]

This gentle nudge acknowledges the next quest exists without
pressuring her.

---

## MOMENT 14: The Second Quest — Helping Little Finn

**Quest: "Being Brave Together"**
**Value: Kindness / Encouragement**
**Duration: ~5-7 minutes**

She walks to Finn (has "!" above his head). He's sitting alone
near the village playground.

> Companion: "Oh look, that boy looks a little sad."
> Finn: "Hi... I am Finn."
> Finn: "I want to try the swing. But I am scared."
> Companion: [personality-specific encouragement]
> Narrator: "Can you help Finn be brave?"

She taps the swing → Finn walks to it slowly → hesitates → she
taps again (or the companion gives another encouraging line) →
Finn swings and laughs.

> Finn: "I did it! Thank you, Princess!"
> Finn: "You helped me be brave!"

Quest complete celebration. Another heart. Another piece of the
Rainbow Bridge lights up (orange).

---

## SESSION PACING (20-minute overview)

```
0:00-0:45  — Opening cinematic (sky, rainbow, pan, princess appears)
0:45-1:00  — Narrator welcome
1:00-1:10  — First tap (sparkle)
1:10-3:30  — Companion selection
3:30-5:00  — Village arrival, tutorial, first steps
5:00-10:00 — Quest 1: Grandma's cookies (sharing)
10:00-11:00 — Free exploration
11:00-16:00 — Quest 2: Helping Finn (encouragement)
16:00-17:00 — Free exploration / kindness encounter
17:00-18:00 — Sunset begins (visual + audio shift)
18:00-19:00 — Companion wind-down comment
19:00-20:00 — Wind-down screen, goodnight, auto-save
```

---

## RETURNING PLAYER FLOW (subsequent sessions)

When she opens the app again:

1. **Skip the full cinematic** — show a shortened version (3 seconds):
   - Quick sky with rainbow already formed
   - Camera is already on the village
2. **Companion greets her:**
   > "Welcome back, Princess! Your friends missed you."
3. **Resume where she left off** — she's in the village (or forest),
   her quest progress is intact, her hearts are shown
4. **Morning resets** — the world is back to morning time
5. **New quests available** or continued quest from last time

---

## KEY INTERACTION PATTERNS

### Tap to Move
- Tap anywhere walkable → princess walks there
- Path is calculated automatically (no complex input)
- Touch target: entire walkable ground is valid

### Tap to Interact
- Tap an NPC with "!" → dialogue starts
- Tap a quest object (cookies, etc.) → picks it up
- Tap a decorative object (flower, pond) → fun animation + sound

### Dialogue Advancement
- Voice plays automatically
- Tap anywhere to advance to next line
- OR auto-advances after the voice finishes + 2 second pause
- No "wrong" input — tapping during voice just queues the next line

### Quest Acceptance
- Quests auto-accept. There is no "decline" option.
- Why: A 4yo doesn't understand accept/decline UI. If she walked
  up to the NPC, she wants to engage. Let her.

### Navigation Help
- If she hasn't moved for 30 seconds, the companion gives a hint
- If she's lost, a gentle sparkle trail appears toward the objective
- The trail is never forceful — it's just soft sparkles on the ground

---

## EMOTIONAL ARC OF THE OPENING

```
Wonder    ████████░░  (sky, rainbow, village reveal)
Curiosity ██████████  (companion selection)
Agency    ████████░░  (first steps, first tap)
Purpose   ██████████  (the bridge is broken, can you help?)
Warmth    ██████████  (Grandma quest, sharing cookies)
Pride     ██████████  (quest complete, bridge glowing)
Freedom   ████████░░  (free exploration)
Empathy   ██████████  (Finn is scared, helping him)
Pride     ██████████  (second quest complete)
Calm      ██████████  (sunset, wind-down, goodnight)
```

The arc goes: wonder → agency → purpose → warmth → pride → calm.
It never hits fear, frustration, urgency, or pressure.
