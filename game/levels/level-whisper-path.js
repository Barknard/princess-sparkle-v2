/**
 * level-whisper-path.js — Whisper Path for Princess Sparkle V2
 *
 * 40x40 tile grid (640x640 pixels — camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Biome: forest-edge — dense trees, dappled light, mysterious feel.
 * Role: path — connects sparkle-village (north) to whisper-forest (south).
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — WHISPER PATH (40 wide x 40 tall)                  ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Row 0:     North exit, path at cols 18-21 (from village)      ║
 * ║  Rows 0-5:  Dense tree border top, path enters at N center     ║
 * ║  Rows 5-15: North forest corridor, trees crowd the path        ║
 * ║  Rows 14-17: Ancient tree landmark (2x2 cluster, col 5-9)      ║
 * ║  Rows 16-24: Winding N-S path continues, mushroom patches      ║
 * ║  Rows 24-32: Southern forest — dense on both sides of path     ║
 * ║  Rows 32-39: Dense tree border south                           ║
 * ║  Row 39:    South exit, path at cols 18-21 (to whisper-forest) ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * N-S PATH:
 *   Enters at north edge cols 18-21 (row 0).
 *   Winds slightly but stays roughly centered cols 17-22.
 *   Exits at south edge cols 18-21 (row 39).
 *   Path: col 18 = DPL, cols 19-20 = DP, col 21 = DPR (when vertical)
 *
 * SPAWN: col 19, row 2 (just inside north entry, walking south)
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
const GR2 = 2;    // grass with flowers (less frequent in deep forest)
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
const BBR = 29;    // berry bush
const FBL = 19;    // flower bush (purple/pink)
const LNT = 93;    // lantern post

// ── GROUND LAYER (40x40 = 1600 tiles) ──────────────────────────────────────
// N-S path: cols 18-21, running rows 0-39.
// Row 0: path at cols 18-21, rest = grass (tree roots/border)
// Rows 1-38: path at cols 18=DPL, 19=DP, 20=DP, 21=DPR, sides = grass
// Row 39: path exits at south, cols 18-21

// prettier-ignore
const ground = grid([
  // Row 0: north exit — path at cols 18-21, tree border either side
  [GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 1: path continues south, dense trees both sides
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 2: forest corridor
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 3: dense forest either side
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 4: forest
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 5: forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 6: mushroom patch area to the west
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 7: forest corridor narrow
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 8: forest
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 9: forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 10: forest — path widens slightly (mushroom clearing east side)
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 11: ancient tree landmark area (cols 5-9 = massive old tree)
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 12: ancient tree area
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 13: forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 14: ancient tree trunk row (landmark is 2x2 trunks at cols 6-9)
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 15: forest
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 16: path widens — slight bend west (path at cols 17-20)
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 17: path at cols 17-20
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 18: path straightens back to cols 18-21
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 19: cols 18-21 path (Finn the Fox home at col 20, row 20 — just off path)
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 20: Finn the Fox area — slight clearing east of path (cols 22-28)
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 21: forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 22: forest
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 23: forest — path bends east slightly
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  DPL, DP,  DP,  DPR, GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 24: path at cols 19-22
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 25: path back to cols 18-21
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 26: deep forest south section
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 27: forest
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 28: forest
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 29: forest
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 30: approaching south border
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 31: south border begins
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 32: south tree border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 33: south tree border
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 34: south tree border
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 35: dense south border
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
  // Row 36: south border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 37: south border
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 38: south border dense
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, DPL, DP,  DP,  DPR, GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 39: south exit — path at cols 18-21
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  DPL, DP,  DP,  DPR, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR2],
]);

// ── OBJECTS LAYER (40x40 = 1600 tiles, -1 = empty) ──────────────────────────
// Dense forest: trees on both sides of path. ~40% tree coverage.
// Ancient tree landmark: 2x2 trunk cluster at cols 6-9, rows 13-14.

const objects = new Array(1600).fill(E);
function place(x, y, t) { objects[y * 40 + x] = t; }

// ── NORTH tree corridor — dense rows 0-5 ──
// Left side (west of path, cols 0-17)
place(0,  0, TB1); place(1,  0, TB2);   // trunk — canopy will be offscreen (row -1), skip
place(4,  0, TB1); place(5,  0, TB2);
place(10, 0, TB1); place(11, 0, TB2);
place(14, 0, TB1); place(15, 0, TB2);
// Right side (east of path, cols 22-39)
place(23, 0, TB1); place(24, 0, TB2);
place(28, 0, TB1); place(29, 0, TB2);
place(34, 0, TB1); place(35, 0, TB2);
place(38, 0, TB1); place(39, 0, TB2);

// Row 0 canopies for row 1 trunks
place(1,  0, CAN_GL); place(2,  0, CAN_GR);   // canopy at row 0 for trunks at row 1
place(6,  0, CAN_AL); place(7,  0, CAN_AR);
place(12, 0, CAN_GL); place(13, 0, CAN_GR);
place(25, 0, CAN_AL); place(26, 0, CAN_AR);
place(30, 0, CAN_GL); place(31, 0, CAN_GR);
place(36, 0, CAN_AL); place(37, 0, CAN_AR);

// Row 1 trunks (canopies are at row 0 above)
place(1,  1, TB1); place(2,  1, TB2);
place(6,  1, TB1); place(7,  1, TB2);
place(12, 1, TB1); place(13, 1, TB2);
place(25, 1, TB1); place(26, 1, TB2);
place(30, 1, TB1); place(31, 1, TB2);
place(36, 1, TB1); place(37, 1, TB2);

// Row 1 canopies for row 2 trunks
place(3,  1, CAN_GL); place(4,  1, CAN_GR);
place(8,  1, CAN_AL); place(9,  1, CAN_AR);
place(15, 1, CAN_GL); place(16, 1, CAN_GR);
place(23, 1, CAN_AL); place(24, 1, CAN_AR);
place(28, 1, CAN_GL); place(29, 1, CAN_GR);
place(33, 1, CAN_AL); place(34, 1, CAN_AR);
place(38, 1, CAN_GL); place(39, 1, CAN_GR);

// Row 2 trunks
place(3,  2, TB1); place(4,  2, TB2);
place(8,  2, TB1); place(9,  2, TB2);
place(15, 2, TB1); place(16, 2, TB2);
place(23, 2, TB1); place(24, 2, TB2);
place(28, 2, TB1); place(29, 2, TB2);
place(33, 2, TB1); place(34, 2, TB2);
place(38, 2, TB1); place(39, 2, TB2);

// Row 2 canopies for row 3 trunks
place(0,  2, CAN_AL); place(1,  2, CAN_AR);
place(5,  2, CAN_GL); place(6,  2, CAN_GR);
place(11, 2, CAN_AL); place(12, 2, CAN_AR);
place(14, 2, CAN_GL); place(15, 2, CAN_GR);
place(25, 2, CAN_AL); place(26, 2, CAN_AR);
place(31, 2, CAN_GL); place(32, 2, CAN_GR);
place(35, 2, CAN_AL); place(36, 2, CAN_AR);

// Row 3 trunks
place(0,  3, TB1); place(1,  3, TB2);
place(5,  3, TB1); place(6,  3, TB2);
place(11, 3, TB1); place(12, 3, TB2);
place(14, 3, TB1); place(15, 3, TB2);
place(25, 3, TB1); place(26, 3, TB2);
place(31, 3, TB1); place(32, 3, TB2);
place(35, 3, TB1); place(36, 3, TB2);

// Row 3 canopies for row 4 trunks
place(2,  3, CAN_GL); place(3,  3, CAN_GR);
place(7,  3, CAN_AL); place(8,  3, CAN_AR);
place(9,  3, CAN_GL); place(10, 3, CAN_GR);
place(16, 3, CAN_AL); place(17, 3, CAN_AR);
place(22, 3, CAN_GL); place(23, 3, CAN_GR);
place(27, 3, CAN_AL); place(28, 3, CAN_AR);
place(33, 3, CAN_GL); place(34, 3, CAN_GR);
place(37, 3, CAN_AL); place(38, 3, CAN_AR);

// Row 4 trunks
place(2,  4, TB1); place(3,  4, TB2);
place(7,  4, TB1); place(8,  4, TB2);
place(9,  4, TB1); place(10, 4, TB2);
place(16, 4, TB1); place(17, 4, TB2);
place(22, 4, TB1); place(23, 4, TB2);
place(27, 4, TB1); place(28, 4, TB2);
place(33, 4, TB1); place(34, 4, TB2);
place(37, 4, TB1); place(38, 4, TB2);

// Rows 5-10: alternating tree placement (forest corridor, both sides)
// Pattern: stagger trees so no two are perfectly aligned horizontally
const forestRows = [
  // [canopyRow, trunkRow, xPositions (left and right halves)]
  [4,  5,  [0,4,9,13,24,29,35]],
  [5,  6,  [2,6,11,15,23,27,32,38]],
  [6,  7,  [0,3,7,12,16,25,30,36]],
  [7,  8,  [1,5,10,14,22,28,33,37]],
  [8,  9,  [0,4,8,13,17,24,29,34,39]],
  [9,  10, [2,6,11,15,23,27,32,36]],
];
forestRows.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    const ctype = i % 2 === 0 ? CAN_GL : CAN_AL;
    const ctype2 = i % 2 === 0 ? CAN_GR : CAN_AR;
    place(x, cr, ctype); place(x + 1, cr, ctype2);
    place(x, tr, TB1);   place(x + 1, tr, TB2);
  });
});

// ── ANCIENT TREE LANDMARK — massive 2x2 trunk cluster cols 6-9, rows 13-14 ──
// Four trees packed together = ancient massive tree feel
// Canopies at row 11-12, trunks at rows 13-14
// 2x2 cluster = 4 tree pairs
place(5,  11, CAN_AL); place(6,  11, CAN_AR);
place(7,  11, CAN_GL); place(8,  11, CAN_GR);
place(5,  12, TB1);    place(6,  12, TB2);
place(7,  12, TB1);    place(8,  12, TB2);
// Second canopy row
place(5,  12, CAN_AL); // overwrite — canopy ABOVE trunk row 13
place(6,  12, CAN_AR);
place(7,  12, CAN_GL);
place(8,  12, CAN_GR);
place(5,  13, TB1); place(6,  13, TB2);
place(7,  13, TB1); place(8,  13, TB2);
place(5,  14, TB1); place(6,  14, TB2);
place(7,  14, TB1); place(8,  14, TB2);
// Correct approach: ancient tree landmark = 3 rows of trunks with 2 rows of canopy above
// Row 11: canopies spanning 4 tiles
place(5,  11, CAN_AL); place(6,  11, CAN_AR); place(7,  11, CAN_GL); place(8,  11, CAN_GR);
// Row 12: more canopies (dense tree = tall)
place(5,  12, CAN_AL); place(6,  12, CAN_AR); place(7,  12, CAN_GL); place(8,  12, CAN_GR);
// Row 13: trunk row
place(5,  13, TB1); place(6,  13, TB2); place(7,  13, TB1); place(8,  13, TB2);
// Row 14: trunk row (thick base)
place(5,  14, TB1); place(6,  14, TB2); place(7,  14, TB1); place(8,  14, TB2);

// Companion trees to ancient landmark (east side, rows 12-14, cols 26-28)
place(26, 11, CAN_AL); place(27, 11, CAN_AR);
place(26, 12, TB1);    place(27, 12, TB2);
place(29, 12, CAN_GL); place(30, 12, CAN_GR);
place(29, 13, TB1);    place(30, 13, TB2);

// Rows 15-30: forest corridor — staggered trees both sides
const forestRows2 = [
  [14, 15, [0,3,11,16,24,31,36]],
  [15, 16, [1,4,9,14,23,28,33,39]],
  [16, 17, [0,3,7,13,25,29,35,38]],
  [17, 18, [1,5,10,15,23,27,32,37]],
  [18, 19, [0,4,8,14,24,30,34,38]],
  [19, 20, [2,6,11,16,22,27,33,39]],
  [20, 21, [0,3,9,13,24,29,36,38]],
  [21, 22, [1,5,10,15,23,28,34,37]],
  [22, 23, [0,4,8,13,25,30,35,39]],
  [23, 24, [2,6,11,16,22,27,32,36]],
  [24, 25, [0,3,7,13,24,29,35,38]],
  [25, 26, [1,5,10,15,23,28,33,39]],
  [26, 27, [0,4,8,14,24,30,36,38]],
  [27, 28, [2,6,11,16,22,27,32,37]],
  [28, 29, [0,3,9,13,25,30,35,39]],
  [29, 30, [1,5,10,15,23,28,34,36]],
];
forestRows2.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    // Skip path columns (17-22 roughly)
    if (x >= 16 && x <= 23) return;
    const ctype  = i % 2 === 0 ? CAN_GL : CAN_AL;
    const ctype2 = i % 2 === 0 ? CAN_GR : CAN_AR;
    place(x, cr, ctype); place(x + 1, cr, ctype2);
    place(x, tr, TB1);   place(x + 1, tr, TB2);
  });
});

// South border trees — dense rows 31-39
const southBorder = [
  [30, 31, [0,4,9,13,23,28,33,38]],
  [31, 32, [1,5,10,14,22,27,32,36,39]],
  [32, 33, [0,3,8,12,24,29,34,37]],
  [33, 34, [2,6,11,15,23,28,33,38]],
  [34, 35, [0,4,9,13,22,27,32,36]],
  [35, 36, [1,5,10,14,24,29,35,39]],
  [36, 37, [0,3,8,12,23,28,34,37]],
  [37, 38, [2,6,11,15,22,27,33,38]],
];
southBorder.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    if (x >= 16 && x <= 23) return;  // skip path
    const ctype  = i % 2 === 0 ? CAN_GL : CAN_AL;
    const ctype2 = i % 2 === 0 ? CAN_GR : CAN_AR;
    place(x, cr, ctype); place(x + 1, cr, ctype2);
    place(x, tr, TB1);   place(x + 1, tr, TB2);
  });
});

// Row 38 canopies for row 39 trunks
[[0,39],[4,39],[9,39],[13,39],[22,39],[27,39],[32,39],[36,39]].forEach(([x]) => {
  const cr = 38;
  const tr = 39;
  place(x, cr, CAN_AL); place(x+1, cr, CAN_AR);
  place(x, tr, TB1);    place(x+1, tr, TB2);
});

// ── Decorations — mushroom patches, bushes ──
// Mushroom patches (use berry bush as visual proxy = BBR tile 29)
place(10, 7, BBR); place(13, 9, BBR); place(10, 15, BBR);
place(14, 20, BBR); place(11, 25, BBR); place(10, 29, BBR);
// East side mushroom patches
place(27, 6, BBR); place(31, 10, BBR);
place(30, 16, BBR); place(27, 22, BBR);
// Bushes near path
place(16, 4, BSH); place(16, 12, BSH); place(16, 22, BSH); place(16, 30, BSH);
place(23, 7, BSH); place(23, 14, BSH); place(23, 24, BSH);
// Flower bush near Finn's area (east of path row 20)
place(24, 20, FBL); place(25, 22, FBL);
// Lantern near ancient tree
place(10, 14, LNT);

// ── COLLISION LAYER (40x40 = 1600 tiles) ──────────────────────────────────
const collision = new Array(1600).fill(0);
function blockC(x, y) { collision[y * 40 + x] = 1; }

// Helper to block trunk positions automatically
// All tree trunks are blocked
const allTrunks = [];

// Collect trunks from all forestRows
[[1,1],[2,1],[6,1],[7,1],[12,1],[13,1],[25,1],[26,1],[30,1],[31,1],[36,1],[37,1]].forEach(([x,y]) => allTrunks.push([x,y]));
[[3,2],[4,2],[8,2],[9,2],[15,2],[16,2],[23,2],[24,2],[28,2],[29,2],[33,2],[34,2],[38,2],[39,2]].forEach(([x,y]) => allTrunks.push([x,y]));
[[0,3],[1,3],[5,3],[6,3],[11,3],[12,3],[14,3],[15,3],[25,3],[26,3],[31,3],[32,3],[35,3],[36,3]].forEach(([x,y]) => allTrunks.push([x,y]));
[[2,4],[3,4],[7,4],[8,4],[9,4],[10,4],[16,4],[17,4],[22,4],[23,4],[27,4],[28,4],[33,4],[34,4],[37,4],[38,4]].forEach(([x,y]) => allTrunks.push([x,y]));

forestRows.forEach(([cr, tr, xs]) => {
  xs.forEach(x => {
    if (x >= 16 && x <= 23) return;
    allTrunks.push([x, tr], [x+1, tr]);
  });
});
forestRows2.forEach(([cr, tr, xs]) => {
  xs.forEach(x => {
    if (x >= 16 && x <= 23) return;
    allTrunks.push([x, tr], [x+1, tr]);
  });
});
southBorder.forEach(([cr, tr, xs]) => {
  xs.forEach(x => {
    if (x >= 16 && x <= 23) return;
    allTrunks.push([x, tr], [x+1, tr]);
  });
});
// Ancient tree trunks
[[5,13],[6,13],[7,13],[8,13],[5,14],[6,14],[7,14],[8,14]].forEach(([x,y]) => allTrunks.push([x,y]));
[[26,12],[27,12],[29,13],[30,13]].forEach(([x,y]) => allTrunks.push([x,y]));
// Row 39 trunks
[[0,39],[1,39],[4,39],[5,39],[9,39],[10,39],[13,39],[14,39],[22,39],[23,39],[27,39],[28,39],[32,39],[33,39],[36,39],[37,39]].forEach(([x,y]) => allTrunks.push([x,y]));

allTrunks.forEach(([x,y]) => {
  if (x >= 0 && x < 40 && y >= 0 && y < 40) blockC(x, y);
});

// Block decorations
[[10,7],[13,9],[10,15],[14,20],[11,25],[10,29],
 [27,6],[31,10],[30,16],[27,22],
 [16,4],[16,12],[16,22],[16,30],[23,7],[23,14],[23,24],
 [24,20],[25,22],[10,14]].forEach(([x,y]) => blockC(x,y));

// Ensure path columns 18-21 are always walkable throughout
for (let y = 0; y < 40; y++) {
  for (let x = 18; x <= 21; x++) {
    collision[y * 40 + x] = 0;
  }
}
// Also clear path-adjacent bend cols 17-22 for bend rows
[[17,16],[17,17],[17,18],[22,23],[22,24],[22,25]].forEach(([x,y]) => {
  collision[y*40+x] = 0;
});

// ── FOREGROUND LAYER (40x40 = 1600 tiles) ──────────────────────────────────
// Canopies only — drawn over player.
const foreground = new Array(1600).fill(E);
function fgPlace(x, y, t) { foreground[y * 40 + x] = t; }

// All canopy positions mirror the objects layer canopies
// Row 0 canopies (for row 1 trunks)
[[1,0,CAN_GL],[2,0,CAN_GR],[6,0,CAN_AL],[7,0,CAN_AR],[12,0,CAN_GL],[13,0,CAN_GR],
 [25,0,CAN_AL],[26,0,CAN_AR],[30,0,CAN_GL],[31,0,CAN_GR],[36,0,CAN_AL],[37,0,CAN_AR]].forEach(([x,y,t]) => fgPlace(x,y,t));

// Row 1 canopies (for row 2 trunks)
[[3,1,CAN_GL],[4,1,CAN_GR],[8,1,CAN_AL],[9,1,CAN_AR],[15,1,CAN_GL],[16,1,CAN_GR],
 [23,1,CAN_AL],[24,1,CAN_AR],[28,1,CAN_GL],[29,1,CAN_GR],[33,1,CAN_AL],[34,1,CAN_AR],[38,1,CAN_GL],[39,1,CAN_GR]].forEach(([x,y,t]) => fgPlace(x,y,t));

// Row 2 canopies (for row 3 trunks)
[[0,2,CAN_AL],[1,2,CAN_AR],[5,2,CAN_GL],[6,2,CAN_GR],[11,2,CAN_AL],[12,2,CAN_AR],
 [14,2,CAN_GL],[15,2,CAN_GR],[25,2,CAN_AL],[26,2,CAN_AR],[31,2,CAN_GL],[32,2,CAN_GR],[35,2,CAN_AL],[36,2,CAN_AR]].forEach(([x,y,t]) => fgPlace(x,y,t));

// Row 3 canopies (for row 4 trunks)
[[2,3,CAN_GL],[3,3,CAN_GR],[7,3,CAN_AL],[8,3,CAN_AR],[9,3,CAN_GL],[10,3,CAN_GR],
 [16,3,CAN_AL],[17,3,CAN_AR],[22,3,CAN_GL],[23,3,CAN_GR],[27,3,CAN_AL],[28,3,CAN_AR],[33,3,CAN_GL],[34,3,CAN_GR],[37,3,CAN_AL],[38,3,CAN_AR]].forEach(([x,y,t]) => fgPlace(x,y,t));

// forestRows canopies → foreground
forestRows.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    if (x >= 16 && x <= 23) return;
    const ctype  = i % 2 === 0 ? CAN_GL : CAN_AL;
    const ctype2 = i % 2 === 0 ? CAN_GR : CAN_AR;
    fgPlace(x, cr, ctype); fgPlace(x + 1, cr, ctype2);
  });
});

forestRows2.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    if (x >= 16 && x <= 23) return;
    const ctype  = i % 2 === 0 ? CAN_GL : CAN_AL;
    const ctype2 = i % 2 === 0 ? CAN_GR : CAN_AR;
    fgPlace(x, cr, ctype); fgPlace(x + 1, cr, ctype2);
  });
});

southBorder.forEach(([cr, tr, xs]) => {
  xs.forEach((x, i) => {
    if (x >= 16 && x <= 23) return;
    const ctype  = i % 2 === 0 ? CAN_GL : CAN_AL;
    const ctype2 = i % 2 === 0 ? CAN_GR : CAN_AR;
    fgPlace(x, cr, ctype); fgPlace(x + 1, cr, ctype2);
  });
});

// Ancient tree canopies
[[5,11,CAN_AL],[6,11,CAN_AR],[7,11,CAN_GL],[8,11,CAN_GR],
 [5,12,CAN_AL],[6,12,CAN_AR],[7,12,CAN_GL],[8,12,CAN_GR]].forEach(([x,y,t]) => fgPlace(x,y,t));
// Companion trees
[[26,11,CAN_AL],[27,11,CAN_AR],[29,12,CAN_GL],[30,12,CAN_GR]].forEach(([x,y,t]) => fgPlace(x,y,t));

// Row 38 canopies for row 39 trunks
[[0,38,CAN_AL],[1,38,CAN_AR],[4,38,CAN_AL],[5,38,CAN_AR],[9,38,CAN_GL],[10,38,CAN_GR],
 [13,38,CAN_AL],[14,38,CAN_AR],[22,38,CAN_GL],[23,38,CAN_GR],[27,38,CAN_AL],[28,38,CAN_AR],
 [32,38,CAN_GL],[33,38,CAN_GR],[36,38,CAN_AL],[37,38,CAN_AR]].forEach(([x,y,t]) => fgPlace(x,y,t));

// ── NPCs ──────────────────────────────────────────────────────────────────
// Finn the Fox: shy, hides behind trees, peeks out curiously.
// Placed east of path at row 20, homeX:20 homeY:20 per blueprint.
const npcs = [
  {
    id: 'finn',
    name: 'Finn the Fox',
    spriteName: 'npc_finn',
    homeX: 24,    // east side of path, near bushes — walkable tile
    homeY: 20,    // mid-map, just past ancient tree landmark
    wanderRadius: 4,
    personality: 'shy',
    dialogueId: 'finn-greeting',
    ambientLines: [
      'voice_finn_curious_01',
      'voice_finn_ambient_01',
    ],
    sillyBehaviors: ['tail_chase', 'peeks_from_tree', 'dashes_behind_bush'],
  },
];

// ── World Objects (tappable) ──────────────────────────────────────────────
const worldObjects = [
  // Ancient tree landmark — interactable (glowing moss)
  { type: 'ANCIENT_TREE',    x: 6,  y: 14, id: 'ancient-tree-01' },

  // Mushroom patches (interactable)
  { type: 'MUSHROOM_PATCH',  x: 10, y: 7,  id: 'mushroom-01' },
  { type: 'MUSHROOM_PATCH',  x: 13, y: 9,  id: 'mushroom-02' },
  { type: 'MUSHROOM_PATCH',  x: 27, y: 6,  id: 'mushroom-03' },
  { type: 'MUSHROOM_PATCH',  x: 31, y: 10, id: 'mushroom-04' },
  { type: 'MUSHROOM_PATCH',  x: 11, y: 25, id: 'mushroom-05' },

  // Golden acorn quest item (Finn's lost acorn — from blueprint quest finn-lost-acorn)
  { type: 'GOLDEN_ACORN',    x: 12, y: 15, id: 'golden-acorn' },

  // Flowers near Finn
  { type: 'FLOWER_SMALL',    x: 25, y: 21, id: 'flower-finn-01' },
  { type: 'FLOWER_SMALL',    x: 23, y: 18, id: 'flower-finn-02' },

  // Paw prints (story beat landmark from blueprint)
  { type: 'PAW_PRINTS',      x: 12, y: 15, id: 'paw-prints-01' },

  // Path markers
  { type: 'FLOWER_SMALL',    x: 17, y: 10, id: 'flower-path-n' },
  { type: 'FLOWER_SMALL',    x: 22, y: 28, id: 'flower-path-s' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────
const animals = [
  // Fireflies — deep forest feel
  { type: 'FIREFLY', x: 8,  y: 8,  spriteName: 'firefly', zone: { x: 5,  y: 5,  w: 10, h: 8 } },
  { type: 'FIREFLY', x: 30, y: 12, spriteName: 'firefly', zone: { x: 25, y: 8,  w: 10, h: 8 } },
  { type: 'FIREFLY', x: 12, y: 22, spriteName: 'firefly', zone: { x: 8,  y: 18, w: 8,  h: 8 } },
  // Birds in tree corridor
  { type: 'BIRD', x: 4,  y: 4,  spriteName: 'bird', zone: { x: 0,  y: 2,  w: 14, h: 6 } },
  { type: 'BIRD', x: 35, y: 6,  spriteName: 'bird', zone: { x: 28, y: 3,  w: 12, h: 5 } },
  // Squirrel near ancient tree
  { type: 'SQUIRREL', x: 9, y: 16, spriteName: 'squirrel', zone: { x: 4, y: 12, w: 10, h: 6 } },
  // Bunny near path
  { type: 'BUNNY', x: 16, y: 18, spriteName: 'bunny', zone: { x: 13, y: 15, w: 6, h: 8 } },
];

// ── Quests ─────────────────────────────────────────────────────────────────
const quests = [
  {
    id: 'finn-lost-acorn',
    name: "Finn's Lost Acorn",
    giverNpcId: 'finn',
    value: 'kindness',
    heartReward: 4,
    bridgeColor: '#ff9f43',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'finn',
        dialogueId: 'finn-acorn-start',
        description: 'voice_quest_finn_start',
      },
      {
        type: 'PICKUP',
        targetId: 'golden-acorn',
        pickupX: 12,
        pickupY: 15,
        itemId: 'acorn',
        dialogueId: null,
        description: 'voice_quest_finn_pickup',
        trailStoryBeats: [
          { tileX: 12, tileY: 15, type: 'animal-tracks', companionReaction: "Look, little paw prints!" },
        ],
      },
      {
        type: 'RETURN_TO',
        targetId: 'finn',
        dialogueId: 'finn-acorn-complete',
        description: 'voice_quest_finn_complete',
      },
    ],
  },
];

// ── Dialogues ──────────────────────────────────────────────────────────────
const dialogues = {

  // finn-greeting — 4 nodes
  // Finn peeks from behind a tree. Shy, uses ellipses, slowly warms up.
  // Choice at node 2: player picks an encouraging response.
  'finn-greeting': {
    startId: 'fg1',
    nodes: {
      fg1: {
        id: 'fg1',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_greeting_01',
        text: '...oh! Um. Someone is on the path.',
        expression: 'shy',
        next: 'fg2',
        choices: null,
      },
      fg2: {
        id: 'fg2',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_greeting_02',
        text: 'Um... h-hello. I am Finn. Sorry.',
        expression: 'shy',
        next: null,
        choices: [
          { label: 'Hi little fox!', icon: 'wave',  next: 'fg3' },
          { label: "Don't be shy!", icon: 'smile', next: 'fg3' },
        ],
      },
      fg3: {
        id: 'fg3',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_greeting_03',
        text: 'Oh... you are nice. Um. Thank you.',
        expression: 'neutral',
        next: 'fg4',
        choices: null,
      },
      fg4: {
        id: 'fg4',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_greeting_04',
        text: 'I like it here. The trees feel... safe.',
        expression: 'happy',
        next: null,
        choices: null,
      },
    },
  },

  // finn-acorn-start — 4 nodes
  // Finn explains his lost golden acorn. Sad, nervous, asks for help.
  // Choice at node 3: both options are warm and encouraging.
  'finn-acorn-start': {
    startId: 'fa1',
    nodes: {
      fa1: {
        id: 'fa1',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_acorn_start_01',
        text: 'Um... I lost something. Something special.',
        expression: 'sad',
        next: 'fa2',
        choices: null,
      },
      fa2: {
        id: 'fa2',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_acorn_start_02',
        text: 'My golden acorn. The wind... blew it away.',
        expression: 'sad',
        next: 'fa3',
        choices: null,
      },
      fa3: {
        id: 'fa3',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_acorn_start_03',
        text: 'It went near the big old tree. I think.',
        expression: 'worried',
        next: null,
        choices: [
          { label: "I'll help you!", icon: 'star',  next: 'fa4' },
          { label: "We'll find it!", icon: 'heart', next: 'fa4' },
        ],
      },
      fa4: {
        id: 'fa4',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_acorn_start_04',
        text: 'Oh! Um... r-really? Thank you so much.',
        expression: 'happy',
        next: null,
        choices: null,
      },
    },
  },

  // finn-acorn-complete — 3 nodes
  // Player returns with the acorn. Finn is overjoyed. Emotional payoff.
  // Tail wag and happy spin are handled by sillyBehavior trigger 'found_acorn_spin'.
  'finn-acorn-complete': {
    startId: 'fc1',
    nodes: {
      fc1: {
        id: 'fc1',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_acorn_complete_01',
        text: 'My acorn! You found it! You found it!',
        expression: 'happy',
        next: 'fc2',
        choices: null,
      },
      fc2: {
        id: 'fc2',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_acorn_complete_02',
        text: 'I am doing a happy spin. Look at me!',
        expression: 'happy',
        next: 'fc3',
        choices: null,
      },
      fc3: {
        id: 'fc3',
        portrait: 'wolf',
        name: 'Finn',
        speaker: 'Finn',
        voiceId: 'voice_finn_acorn_complete_03',
        text: 'You are my very first friend. Thank you.',
        expression: 'grateful',
        next: null,
        choices: null,
      },
    },
  },

};

// ── Level Transitions ──────────────────────────────────────────────────────
const transitions = [
  // North: to sparkle-village south edge, path at cols 28-31 (village) = rows 18-21 on whisper side
  {
    edge: 'north',
    tileStart: 18,
    tileEnd: 21,
    targetLevel: 'sparkle-village',
    targetSpawnX: 29,
    targetSpawnY: 38,
    transition: { type: 'iris', duration: 700 },
    marker: 'wooden-arch',
  },
  // South: to whisper-forest north edge, path at cols 23-26 (forest)
  {
    edge: 'south',
    tileStart: 18,
    tileEnd: 21,
    targetLevel: 'whisper-forest',
    targetSpawnX: 24,
    targetSpawnY: 2,
    transition: { type: 'iris', duration: 700 },
    marker: 'tree-gap',
  },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'whisper-path',
  name: 'Whisper Path',
  width: 40,
  height: 40,
  tileSize: 16,

  spawnX: 19,
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
