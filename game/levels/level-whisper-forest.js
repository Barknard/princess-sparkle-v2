/**
 * level-whisper-forest.js — Whisper Forest for Princess Sparkle V2
 *
 * 50x50 tile grid (800x800 pixels — camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Biome: deep-forest — very dense trees (55% coverage), mysterious, mist-like.
 * Role: destination — open arrival clearing, reward feeling.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — WHISPER FOREST (50 wide x 50 tall)                    ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║  Row 0:     North exit — path at cols 23-26 (from whisper-path)    ║
 * ║  Rows 0-6:  Dense tree border top, path enters at N cols 23-26     ║
 * ║  Rows 6-18: Path winds through deep forest, south toward clearing  ║
 * ║  Rows 19-28: Central clearing (10x10, cols 20-29) — open!          ║
 * ║  Rows 19-28: Elder Oak at col 25, row 25 (center of clearing)      ║
 * ║  Rows 19-28: Fairy ring mushrooms around clearing (tappable)       ║
 * ║  Rows 19-28: Return portal southwest clearing corner (col 21, 27)  ║
 * ║  Rows 28-38: Deep forest south of clearing                         ║
 * ║  Rows 38-49: Dense tree border south (dead end)                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * N-S PATH:
 *   Enters north edge cols 23-26 (row 0).
 *   Winds to clearing: approx cols 23-26 rows 0-18, then opens into clearing.
 *   Path: col 23 = DPL, cols 24-25 = DP, col 26 = DPR
 *
 * CLEARING (10x10): rows 19-28, cols 20-29. Entirely walkable (collision=0).
 * SPAWN: col 24, row 2 (just inside north entry)
 */

// ── Helper ──────────────────────────────────────────────────────────────────
function grid(rows) {
  const arr = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      arr.push(rows[y][x]);
    }
  }
  return arr;
}

// ── Tile ID aliases ─────────────────────────────────────────────────────────
const GR  = 1;    // plain green grass
const GR2 = 2;    // grass with flowers
const DP  = 40;   // dirt path center
const DPL = 39;   // dirt path left/top edge
const DPR = 41;   // dirt path right/bottom edge
const E   = -1;   // empty (objects/foreground layers)

// TREE TILES
const CAN_GL = 4;   // green canopy left
const CAN_GR = 5;   // green canopy right
const CAN_AL = 7;   // autumn canopy left
const CAN_AR = 8;   // autumn canopy right
const TB1 = 12;     // tree trunk left
const TB2 = 13;     // tree trunk right

// DECORATIONS
const BSH = 28;    // bush (green oval hedge)
const BBR = 29;    // berry bush (used for mushroom visual)
const FBL = 19;    // flower bush
const LNT = 93;    // lantern post

// ── GROUND LAYER (50x50 = 2500 tiles) ──────────────────────────────────────
// N-S path: cols 23-26, rows 0-18. Then opens into clearing rows 19-28.
// Clearing (rows 19-28, cols 20-29) = grass (walkable).
// Rest = dense grass forest floor.

// prettier-ignore
const ground = grid([
  // Row 0: north exit — path cols 23-26
  [GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 1: path + forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 2: path + deep forest
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 3: forest corridor
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 4: forest
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 5: forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 6: forest — path shifts slightly west (cols 22-25)
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 7: path cols 22-25
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2],
  // Row 8: path cols 22-25
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 9: path back to cols 23-26
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 10: forest — path at cols 23-26
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 11: forest
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2],
  // Row 12: forest — path shifts east slightly (cols 24-27)
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 13: path cols 24-27
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 14: path returns to cols 23-26
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 15: forest
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2],
  // Row 16: forest path
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 17: forest path
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 18: path widens — forest opens into clearing
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 19: CLEARING BEGINS — rows 19-28, cols 20-29 = open grass
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2, GR2, GR2, GR2, GR2, GR2, GR2, GR2, GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2],
  // Row 20: clearing
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 21: clearing
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 22: clearing — moonpetal flower location (tappable item for quest)
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 23: clearing
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2],
  // Row 24: clearing — Elder Oak home (col 25, row 25)
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 25: clearing center — Elder Oak here
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 26: clearing — fairy ring mushrooms scattered
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 27: clearing — return portal location (col 21, row 27)
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2, GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2],
  // Row 28: CLEARING ENDS — south forest wall begins
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 29: deep south forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR ],
  // Row 30: south forest
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 31: south forest
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 32: south forest
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 33: south forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 34: south forest
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 35: deep south forest border begins
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 36: south border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 37: south border
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 38: dense south border
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 39: south border
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 40: south border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 41: south border
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 42: south border
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 43: south border
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 44: south border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 45: south border
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 46: south border
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 47: south border
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 48: south border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 49: bottom border
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR ],
]);

// ── OBJECTS LAYER (50x50 = 2500 tiles, -1 = empty) ──────────────────────────
// Very dense trees. Skip path cols 23-26 for rows 0-18. Skip clearing rows 19-28 cols 20-29.

const objects = new Array(2500).fill(E);
function placeO(x, y, t) { objects[y * 50 + x] = t; }

// Helper: place tree (canopy at cr, trunks at tr) at x position
function plantTree(x, cr, tr, type) {
  if (x < 0 || x > 48) return;
  const cL = type === 'autumn' ? CAN_AL : CAN_GL;
  const cR = type === 'autumn' ? CAN_AR : CAN_GR;
  placeO(x, cr, cL); placeO(x + 1, cr, cR);
  placeO(x, tr, TB1); placeO(x + 1, tr, TB2);
}

// ── TOP TREE BORDER rows 0-5 ──
// Path cols 23-26 must stay clear
const topBorderData = [
  [0,  1,  [0,3,7,11,15,19,27,31,35,39,43,47]],
  [1,  2,  [1,5,9,13,17,21,29,33,37,41,45,48]],
  [2,  3,  [0,4,8,12,16,20,28,32,36,40,44]],
  [3,  4,  [2,6,10,14,18,22,30,34,38,42,46]],
  [4,  5,  [0,3,7,11,15,19,27,31,35,39,43,47]],
];
topBorderData.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    if (x >= 22 && x <= 27) return; // skip path
    plantTree(x, cr, tr, i % 2 === 0 ? 'green' : 'autumn');
  });
});

// ── FOREST CORRIDOR rows 5-18 (both sides of path) ──
// Left side: cols 0-21, right side: cols 27-49
const corridorRows = [
  [5,  6,  [0,4,8,12,16,28,32,36,40,44,48]],
  [6,  7,  [1,5,9,13,17,21,29,33,37,41,45]],
  [7,  8,  [0,3,7,11,15,19,27,31,35,39,43,47]],
  [8,  9,  [2,6,10,14,18,20,28,32,36,40,44,48]],
  [9,  10, [0,4,8,12,16,30,34,38,42,46]],
  [10, 11, [1,5,9,13,17,21,29,33,37,41,45]],
  [11, 12, [0,3,7,11,15,19,27,31,35,39,43,47]],
  [12, 13, [2,6,10,14,18,20,28,32,36,40,44,48]],
  [13, 14, [0,4,8,12,16,30,34,38,42,46]],
  [14, 15, [1,5,9,13,17,21,29,33,37,41,45]],
  [15, 16, [0,3,7,11,15,19,27,31,35,39,43,47]],
  [16, 17, [2,6,10,14,18,20,28,32,36,40,44,48]],
  [17, 18, [0,4,8,12,16,30,34,38,42,46]],
];
corridorRows.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    if (x >= 21 && x <= 28) return; // skip path zone
    plantTree(x, cr, tr, i % 2 === 0 ? 'green' : 'autumn');
  });
});

// ── CLEARING BORDER rows 18-19 (north wall of clearing) ──
// Dense trees surrounding clearing (cols 0-19 and 30-49)
[[18, 19, [0,4,8,12,16,30,34,38,42,46]],
 [19, 20, [0,3,7,11,15,31,35,39,43,47]]].forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    plantTree(x, cr, tr, i % 2 === 0 ? 'green' : 'autumn');
  });
});

// ── CLEARING SIDE TREES rows 20-28 (east and west walls) ──
const clearingSide = [
  [20, 21, [0,4,8,12,16,31,35,39,43,47]],
  [21, 22, [1,5,9,13,17,30,34,38,42,46]],
  [22, 23, [0,3,7,11,15,32,36,40,44,48]],
  [23, 24, [2,6,10,14,18,31,35,39,43,47]],
  [24, 25, [0,4,8,12,16,30,34,38,42,46]],
  [25, 26, [1,5,9,13,17,32,36,40,44,48]],
  [26, 27, [0,3,7,11,15,31,35,39,43,47]],
  [27, 28, [2,6,10,14,18,30,34,38,42,46]],
];
clearingSide.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    if (x >= 19 && x <= 30) return; // skip clearing
    plantTree(x, cr, tr, i % 2 === 0 ? 'green' : 'autumn');
  });
});

// ── CLEARING SOUTH WALL row 28-29 ──
[[28, 29, [0,4,8,12,16,20,24,28,32,36,40,44,48]]].forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    plantTree(x, cr, tr, i % 2 === 0 ? 'green' : 'autumn');
  });
});

// ── SOUTH FOREST rows 29-49 (very dense) ──
const southForest = [
  [29, 30, [0,3,7,11,15,19,23,27,31,35,39,43,47]],
  [30, 31, [1,5,9,13,17,21,25,29,33,37,41,45,48]],
  [31, 32, [0,4,8,12,16,20,24,28,32,36,40,44]],
  [32, 33, [2,6,10,14,18,22,26,30,34,38,42,46]],
  [33, 34, [0,3,7,11,15,19,23,27,31,35,39,43,47]],
  [34, 35, [1,5,9,13,17,21,25,29,33,37,41,45,48]],
  [35, 36, [0,4,8,12,16,20,24,28,32,36,40,44]],
  [36, 37, [2,6,10,14,18,22,26,30,34,38,42,46]],
  [37, 38, [0,3,7,11,15,19,23,27,31,35,39,43,47]],
  [38, 39, [1,5,9,13,17,21,25,29,33,37,41,45]],
  [39, 40, [0,4,8,12,16,20,24,28,32,36,40,44,48]],
  [40, 41, [2,6,10,14,18,22,26,30,34,38,42,46]],
  [41, 42, [0,3,7,11,15,19,23,27,31,35,39,43,47]],
  [42, 43, [1,5,9,13,17,21,25,29,33,37,41,45,48]],
  [43, 44, [0,4,8,12,16,20,24,28,32,36,40,44]],
  [44, 45, [2,6,10,14,18,22,26,30,34,38,42,46]],
  [45, 46, [0,3,7,11,15,19,23,27,31,35,39,43,47]],
  [46, 47, [1,5,9,13,17,21,25,29,33,37,41,45,48]],
  [47, 48, [0,4,8,12,16,20,24,28,32,36,40,44]],
  [48, 49, [2,6,10,14,18,22,26,30,34,38,42,46]],
];
southForest.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    if (x >= 49) return;
    plantTree(x, cr, tr, i % 2 === 0 ? 'green' : 'autumn');
  });
});

// ── Clearing decorations ──
// Fairy ring mushrooms around clearing center — ring at radius ~5 from center (25,24)
const fairyRing = [
  [21, 22], [23, 21], [25, 20], [27, 21], [29, 22],   // north arc
  [30, 24], [29, 26], [28, 27],                         // east arc
  [26, 28], [24, 28], [22, 27], [21, 26], [20, 24],    // south/west arc
];
fairyRing.forEach(([x, y]) => placeO(x, y, BBR));  // mushroom visual (berry bush proxy)

// Moonpetal healing flower (quest item for elder-oak-remedy)
placeO(27, 23, FBL);  // glowing flower east of Elder Oak

// Return portal lantern markers (portal is worldObject)
placeO(21, 27, LNT); placeO(22, 27, LNT);

// Flower bushes around clearing edge
placeO(20, 20, FBL); placeO(29, 20, FBL);
placeO(20, 28, BSH); placeO(29, 28, BSH);
placeO(20, 24, FBL); placeO(29, 24, FBL);

// ── COLLISION LAYER (50x50 = 2500 tiles) ──────────────────────────────────
const collision = new Array(2500).fill(0);
function blockW(x, y) {
  if (x >= 0 && x < 50 && y >= 0 && y < 50) collision[y * 50 + x] = 1;
}

// Block all trunk positions programmatically
function blockTrunks(xs, tr) {
  xs.forEach(x => {
    if (x >= 0 && x < 49) {
      blockW(x, tr); blockW(x + 1, tr);
    }
  });
}

topBorderData.forEach(([cr, tr, xs]) => {
  xs.filter(x => !(x >= 22 && x <= 27)).forEach(x => { blockW(x, tr); blockW(x+1, tr); });
});
corridorRows.forEach(([cr, tr, xs]) => {
  xs.filter(x => !(x >= 21 && x <= 28)).forEach(x => { blockW(x, tr); blockW(x+1, tr); });
});
[[18, 19, [0,4,8,12,16,30,34,38,42,46]],
 [19, 20, [0,3,7,11,15,31,35,39,43,47]]].forEach(([cr, tr, xs]) => {
  xs.forEach(x => { blockW(x, tr); blockW(x+1, tr); });
});
clearingSide.forEach(([cr, tr, xs]) => {
  xs.filter(x => !(x >= 19 && x <= 30)).forEach(x => { blockW(x, tr); blockW(x+1, tr); });
});
[[28, 29, [0,4,8,12,16,20,24,28,32,36,40,44,48]]].forEach(([cr, tr, xs]) => {
  xs.forEach(x => { blockW(x, tr); blockW(x+1, tr); });
});
southForest.forEach(([cr, tr, xs]) => {
  xs.filter(x => x < 49).forEach(x => { blockW(x, tr); blockW(x+1, tr); });
});

// Block fairy ring mushrooms (collision around edges of clearing, not center)
fairyRing.forEach(([x, y]) => blockW(x, y));

// Block decorations outside clearing
[[20, 20],[29, 20],[20, 28],[29, 28],[20, 24],[29, 24]].forEach(([x,y]) => blockW(x,y));
[[21, 27],[22, 27]].forEach(([x,y]) => blockW(x,y));  // lanterns

// Block moonpetal flower — player must tap/interact, not walk through
// Actually keep walkable so player can reach it: leave collision[27,23] = 0

// Ensure path cols 23-26 rows 0-18 are always walkable
for (let y = 0; y <= 18; y++) {
  for (let x = 23; x <= 26; x++) {
    collision[y * 50 + x] = 0;
  }
}

// Ensure clearing rows 19-28, cols 20-29 fully walkable
for (let y = 19; y <= 28; y++) {
  for (let x = 20; x <= 29; x++) {
    collision[y * 50 + x] = 0;
  }
}

// ── FOREGROUND LAYER (50x50 = 2500 tiles) ──────────────────────────────────
const foreground = new Array(2500).fill(E);
function fgW(x, y, t) { if (x >= 0 && x < 50 && y >= 0 && y < 50) foreground[y * 50 + x] = t; }

// Place canopies in foreground for all planted trees
function fgTree(x, cr, type) {
  if (x < 0 || x > 48) return;
  const cL = type === 'autumn' ? CAN_AL : CAN_GL;
  const cR = type === 'autumn' ? CAN_AR : CAN_GR;
  fgW(x, cr, cL); fgW(x + 1, cr, cR);
}

topBorderData.forEach(([cr, tr, xs]) => {
  xs.filter(x => !(x >= 22 && x <= 27)).forEach((x, i) => fgTree(x, cr, i % 2 === 0 ? 'green' : 'autumn'));
});
corridorRows.forEach(([cr, tr, xs]) => {
  xs.filter(x => !(x >= 21 && x <= 28)).forEach((x, i) => fgTree(x, cr, i % 2 === 0 ? 'green' : 'autumn'));
});
[[18, 19, [0,4,8,12,16,30,34,38,42,46]],
 [19, 20, [0,3,7,11,15,31,35,39,43,47]]].forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => fgTree(x, cr, i % 2 === 0 ? 'green' : 'autumn'));
});
clearingSide.forEach(([cr, tr, xs]) => {
  xs.filter(x => !(x >= 19 && x <= 30)).forEach((x, i) => fgTree(x, cr, i % 2 === 0 ? 'green' : 'autumn'));
});
[[28, 29, [0,4,8,12,16,20,24,28,32,36,40,44,48]]].forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => fgTree(x, cr, i % 2 === 0 ? 'green' : 'autumn'));
});
southForest.forEach(([cr, tr, xs]) => {
  xs.filter(x => x < 49).forEach((x, i) => fgTree(x, cr, i % 2 === 0 ? 'green' : 'autumn'));
});

// ── NPCs ──────────────────────────────────────────────────────────────────
const npcs = [
  {
    id: 'elder-oak',
    name: 'Elder Oak',
    spriteName: 'npc_elder',
    homeX: 25,    // center of clearing
    homeY: 25,    // per blueprint
    wanderRadius: 1,
    personality: 'gentle',
    dialogueId: 'elder-oak-greeting',
    ambientLines: [
      'voice_elder_oak_hum_01',
      'voice_elder_oak_ambient_01',
    ],
    sillyBehaviors: ['leaf_sneeze', 'talks_to_plants', 'very_slow_wave'],
  },
];

// ── World Objects (tappable) ──────────────────────────────────────────────
const worldObjects = [
  // Return portal — glowing circle in clearing SW
  { type: 'RETURN_PORTAL',   x: 21, y: 27, id: 'return-portal' },

  // Moonpetal healing flower (quest pickup for elder-oak-remedy)
  { type: 'HEALING_FLOWER',  x: 27, y: 23, id: 'healing-flower' },

  // Fairy ring — mushrooms arranged as a ring (tappable magical feature)
  { type: 'FAIRY_RING',      x: 25, y: 24, id: 'fairy-ring-center' },
  { type: 'MUSHROOM_PATCH',  x: 21, y: 22, id: 'fairy-ring-n1' },
  { type: 'MUSHROOM_PATCH',  x: 25, y: 20, id: 'fairy-ring-n2' },
  { type: 'MUSHROOM_PATCH',  x: 29, y: 22, id: 'fairy-ring-e1' },
  { type: 'MUSHROOM_PATCH',  x: 29, y: 26, id: 'fairy-ring-e2' },
  { type: 'MUSHROOM_PATCH',  x: 26, y: 28, id: 'fairy-ring-s1' },
  { type: 'MUSHROOM_PATCH',  x: 22, y: 27, id: 'fairy-ring-s2' },
  { type: 'MUSHROOM_PATCH',  x: 20, y: 24, id: 'fairy-ring-w1' },

  // Scattered flowers in clearing
  { type: 'FLOWER_BIG',      x: 22, y: 21, id: 'clearing-flower-01' },
  { type: 'FLOWER_BIG',      x: 28, y: 25, id: 'clearing-flower-02' },
  { type: 'FLOWER_SMALL',    x: 24, y: 27, id: 'clearing-flower-03' },
  { type: 'DANDELION',       x: 26, y: 22, id: 'clearing-dande-01' },

  // Forest entry marker
  { type: 'FLOWER_SMALL',    x: 22, y: 10, id: 'forest-marker-01' },
  { type: 'FLOWER_SMALL',    x: 27, y: 14, id: 'forest-marker-02' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────
const animals = [
  // Fireflies throughout forest — magical glow
  { type: 'FIREFLY', x: 10, y: 8,  spriteName: 'firefly', zone: { x: 5,  y: 4,  w: 14, h: 10 } },
  { type: 'FIREFLY', x: 38, y: 10, spriteName: 'firefly', zone: { x: 30, y: 6,  w: 15, h: 10 } },
  { type: 'FIREFLY', x: 15, y: 14, spriteName: 'firefly', zone: { x: 8,  y: 10, w: 12, h: 8  } },
  { type: 'FIREFLY', x: 35, y: 16, spriteName: 'firefly', zone: { x: 28, y: 12, w: 14, h: 8  } },
  // Fireflies in clearing — magical
  { type: 'FIREFLY', x: 23, y: 22, spriteName: 'firefly', zone: { x: 20, y: 19, w: 10, h: 10 } },
  // Birds
  { type: 'BIRD', x: 6,  y: 5,  spriteName: 'bird', zone: { x: 2,  y: 2,  w: 15, h: 6 } },
  { type: 'BIRD', x: 42, y: 7,  spriteName: 'bird', zone: { x: 35, y: 4,  w: 13, h: 6 } },
  // Deer near clearing
  { type: 'DEER', x: 18, y: 22, spriteName: 'deer', zone: { x: 12, y: 19, w: 8,  h: 6 } },
  // Squirrels
  { type: 'SQUIRREL', x: 10, y: 12, spriteName: 'squirrel', zone: { x: 5, y: 8,  w: 10, h: 8 } },
  { type: 'SQUIRREL', x: 38, y: 15, spriteName: 'squirrel', zone: { x: 32, y: 11, w: 10, h: 7 } },
];

// ── Quests ─────────────────────────────────────────────────────────────────
const quests = [
  {
    id: 'elder-oak-remedy',
    name: "Elder Oak's Remedy",
    giverNpcId: 'elder-oak',
    value: 'empathy',
    heartReward: 5,
    bridgeColor: '#a8e6cf',   // soft green
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'elder-oak',
        dialogueId: 'elder-remedy-start',
        description: 'voice_quest_elder_start',
      },
      {
        type: 'PICKUP',
        targetId: 'healing-flower',
        pickupX: 27,
        pickupY: 23,
        itemId: 'moonpetal',
        dialogueId: null,
        description: 'voice_quest_elder_pickup',
      },
      {
        type: 'RETURN_TO',
        targetId: 'elder-oak',
        dialogueId: 'elder-remedy-complete',
        description: 'voice_quest_elder_complete',
      },
    ],
  },
];

// ── Dialogues ──────────────────────────────────────────────────────────────
//
// Three trees cover the full quest arc for Elder Oak:
//
//   elder-oak-greeting   — ambient greeting when player taps Elder Oak
//   elder-remedy-start   — quest offer: a bird friend needs help
//   elder-remedy-complete — quest return: warm emotional payoff
//
// Choice nodes use icon-based selection (pre-literate design).
// Both choices in every node are positive — no wrong answer.
// Choice A on elder-remedy-start carries questTrigger to start the quest.
// Choice B (empathy path) leads to the same closing node — still starts quest
// because the TALK_TO stage completion fires on dialogue end, not choice pick.
//
// Text hard limit: 10 words per node (parent read-aloud pacing).
// voiceId: placeholder strings — map to audio files during production.

const dialogues = {

  // ── elder-oak-greeting ───────────────────────────────────────────────────
  // 4 nodes. Gentle arrival. Calls player "little sprout". Nature metaphors.
  // Node eo3 has 2 choices; both converge at eo4 (warm close).
  'elder-oak-greeting': {
    startId: 'eo1',
    nodes: {
      eo1: {
        id: 'eo1',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_greeting_01',
        text: 'Ohhh... little sprout. The forest has been waiting.',
        expression: 'gentle',
        next: 'eo2',
        choices: null,
      },
      eo2: {
        id: 'eo2',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_greeting_02',
        text: 'Every leaf turned to watch you arrive today.',
        expression: 'gentle',
        next: 'eo3',
        choices: null,
      },
      eo3: {
        id: 'eo3',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_greeting_03',
        text: 'Are you happy to be here, little sprout?',
        expression: 'happy',
        next: null,
        // Icon keys: wave hand = hello / sparkle eyes = pretty forest
        choices: [
          { icon: 'icon_wave',    next: 'eo4' },
          { icon: 'icon_sparkle', next: 'eo4' },
        ],
      },
      eo4: {
        id: 'eo4',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_greeting_04',
        text: 'Yes. This forest is full of wonderful things.',
        expression: 'happy',
        next: null,
        choices: null,
      },
    },
  },

  // ── elder-remedy-start ───────────────────────────────────────────────────
  // 4 nodes. Elder Oak explains his bird friend is unwell.
  // Describes the glowing moonpetal flower. Presents choice to help.
  // Choice A (icon_yes — find it!) carries questTrigger.
  // Choice B (icon_heart — poor bird!) leads same closing node es4.
  // Quest stage TALK_TO completes when dialogue ends regardless of path.
  'elder-remedy-start': {
    startId: 'es1',
    nodes: {
      es1: {
        id: 'es1',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_remedy_start_01',
        text: 'Oh, little sprout... my dear bird friend feels unwell.',
        expression: 'worried',
        next: 'es2',
        choices: null,
      },
      es2: {
        id: 'es2',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_remedy_start_02',
        text: 'She rests quietly. Her wings are too tired to flutter.',
        expression: 'worried',
        next: 'es3',
        choices: null,
      },
      es3: {
        id: 'es3',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_remedy_start_03',
        text: 'A moonpetal flower glows softly nearby. Could you find it?',
        expression: 'hopeful',
        next: 'es4',
        choices: null,
      },
      es4: {
        id: 'es4',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_remedy_start_04',
        text: 'Will you help my little friend feel better?',
        expression: 'hopeful',
        next: null,
        // Icon keys: yes/thumbs-up = find it! / heart = poor little bird!
        choices: [
          { icon: 'icon_yes',   next: null, questTrigger: 'elder-oak-remedy' },
          { icon: 'icon_heart', next: null, questTrigger: 'elder-oak-remedy' },
        ],
      },
    },
  },

  // ── elder-remedy-complete ────────────────────────────────────────────────
  // 4 nodes. Player returns with the moonpetal. Pure warm payoff.
  // No choices needed — this is a celebration moment, not a decision.
  // "You have a gentle heart, little sprout." Value modeled through joy.
  'elder-remedy-complete': {
    startId: 'ec1',
    nodes: {
      ec1: {
        id: 'ec1',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_remedy_complete_01',
        text: 'Ohhhh. The moonpetal. You found it, little sprout!',
        expression: 'grateful',
        next: 'ec2',
        choices: null,
      },
      ec2: {
        id: 'ec2',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_remedy_complete_02',
        text: 'My bird friend will feel so much better now.',
        expression: 'grateful',
        next: 'ec3',
        choices: null,
      },
      ec3: {
        id: 'ec3',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_remedy_complete_03',
        text: 'You have a gentle heart, little sprout. Truly.',
        expression: 'happy',
        next: 'ec4',
        choices: null,
      },
      ec4: {
        id: 'ec4',
        portrait: 'alchemist',
        name: 'Elder Oak',
        speaker: 'Elder Oak',
        voiceId: 'voice_elder_oak_remedy_complete_04',
        text: 'The whole forest thanks you for your kindness.',
        expression: 'happy',
        next: null,
        choices: null,
      },
    },
  },

};

// ── Level Transitions ──────────────────────────────────────────────────────
const transitions = [
  // North: to whisper-path south edge, cols 18-21 (whisper-path south exit)
  {
    edge: 'north',
    tileStart: 23,
    tileEnd: 26,
    targetLevel: 'whisper-path',
    targetSpawnX: 19,
    targetSpawnY: 37,
    transition: { type: 'iris', duration: 700 },
    marker: 'tree-gap',
  },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'whisper-forest',
  name: 'Whisper Forest',
  width: 50,
  height: 50,
  tileSize: 16,

  spawnX: 24,
  spawnY: 2,

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
