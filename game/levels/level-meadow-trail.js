/**
 * level-meadow-trail.js — Meadow Trail for Princess Sparkle V2
 *
 * 40x40 tile grid (640x640 pixels — camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Biome: meadow — bright, open, flower-heavy (~40% tile 2).
 * Role: path — journey feel, moderate density, wide open sky.
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — MEADOW TRAIL (40 wide x 40 tall)          ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  Rows 0-2:   Tree border top (staggered, sparse)       ║
 * ║  Rows 3-8:   Open meadow, flower field, butterflies    ║
 * ║  Rows 9-16:  Central meadow — giant sunflower area     ║
 * ║  Rows 17-22: E-W path (exits east at cols 18-21)       ║
 * ║  Rows 23-30: Southern meadow with scattered flowers    ║
 * ║  Rows 31-39: Tree border south, butterfly clearing     ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * CONNECTION (east edge):
 *   Cols 18-21, rows 19-20 → sparkle-village WEST edge
 *   Path exits east: col 39 = path tiles at rows 18-21
 *
 * SPAWN: col 36, row 19 (near east exit, player walks west into meadow)
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

// ── Tile ID aliases (Kenney Tiny Town — 12 cols x 11 rows) ─────────────────
const GR  = 1;    // plain green grass (60%)
const GR2 = 2;    // grass with flowers (40% in meadow — flower-heavy biome)
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
// Every cell filled. Meadow biome: ~40% GR2 (flowers), ~55% GR, ~5% path.
// E-W path at rows 18-20 connecting east edge (exit to village).
// Path: row 18 = DPL (top edge), row 19 = DP (center), row 20 = DPR (bottom edge)
// Path runs cols 0-39 at rows 18-20, centering on row 19 for exit tiles at cols 18-21.

// prettier-ignore
const ground = grid([
  // Row 0: sparse tree border top
  [GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 1: tree border
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2],
  // Row 2: tree border thinning
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 3: open flower meadow begins (more GR2)
  [GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2],
  // Row 4: flower field
  [GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR ],
  // Row 5: flower field with scattered plain grass
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2],
  // Row 6: open meadow
  [GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 7: meadow
  [GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 8: butterfly clearing — more flowers
  [GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR ],
  // Row 9: approach to sunflower landmark
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 10: sunflower area (landmark at col 10, row 12 via worldObject)
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 11: sunflower meadow
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2],
  // Row 12: flower-heavy (near sunflower landmark)
  [GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR ],
  // Row 13: open meadow
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 14: meadow approaching path
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR ],
  // Row 15: approaching path
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 16: approaching path
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 17: meadow just north of path
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 18: E-W path TOP edge — runs full width (exit east at cols 18-21 = DPL)
  [DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL],
  // Row 19: E-W path CENTER — exit east at col 39 = DP
  [DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP ],
  // Row 20: E-W path BOTTOM edge
  [DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR],
  // Row 21: meadow south of path
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 22: southern meadow
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 23: southern meadow with flowers
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2],
  // Row 24: southern meadow
  [GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR ],
  // Row 25: flowers scattered
  [GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR2],
  // Row 26: butterfly clearing (south-west)
  [GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 27: open southern area
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 28: meadow south
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 29: flower field south
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 30: approach to south tree border
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 31: tree border begins
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 32: tree border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 33: tree border thickening
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2],
  // Row 34: tree border
  [GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR ],
  // Row 35: tree border
  [GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR ],
  // Row 36: tree border
  [GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 37: tree border
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 38: tree border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 39: bottom border
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2],
]);

// ── OBJECTS LAYER (40x40 = 1600 tiles, -1 = empty) ──────────────────────────
// Tree trunks, bushes, flower bushes, lanterns.
// Trees: 2x2 — canopy at (x, y), trunk at (x, y+1). Canopy row = y, trunk row = y+1.
// RULE: trunk row minimum = 1. No trunks at row 39 (canopy would be off bottom if rendered).

const objects = new Array(1600).fill(E);

// Helper to place objects by row/col
function place(layer, w, x, y, tile) { layer[y * w + x] = tile; }
const P40 = (x, y, t) => place(objects, 40, x, y, t);

// ── Tree border TOP (rows 0-2, trunks at row 1-2) ──
// Row 0: canopies for trunks at row 1
P40(1,  0, CAN_GL); P40(2,  0, CAN_GR);   // tree 1
P40(6,  0, CAN_AL); P40(7,  0, CAN_AR);   // tree 2 (autumn)
P40(14, 0, CAN_GL); P40(15, 0, CAN_GR);   // tree 3
P40(22, 0, CAN_AL); P40(23, 0, CAN_AR);   // tree 4
P40(30, 0, CAN_GL); P40(31, 0, CAN_GR);   // tree 5
P40(36, 0, CAN_AL); P40(37, 0, CAN_AR);   // tree 6
// Row 1: trunks
P40(1,  1, TB1); P40(2,  1, TB2);
P40(6,  1, TB1); P40(7,  1, TB2);
P40(14, 1, TB1); P40(15, 1, TB2);
P40(22, 1, TB1); P40(23, 1, TB2);
P40(30, 1, TB1); P40(31, 1, TB2);
P40(36, 1, TB1); P40(37, 1, TB2);

// Row 1: canopies for trunks at row 2
P40(10, 1, CAN_GL); P40(11, 1, CAN_GR);
P40(26, 1, CAN_AL); P40(27, 1, CAN_AR);
// Row 2: trunks
P40(10, 2, TB1); P40(11, 2, TB2);
P40(26, 2, TB1); P40(27, 2, TB2);

// ── Scattered trees — meadow edges and clusters ──
// NW grove (rows 3-6, cols 0-5)
P40(0,  3, CAN_GL); P40(1,  3, CAN_GR);
P40(0,  4, TB1);    P40(1,  4, TB2);
P40(3,  5, CAN_AL); P40(4,  5, CAN_AR);
P40(3,  6, TB1);    P40(4,  6, TB2);

// NE grove (rows 4-7, cols 34-39)
P40(35, 4, CAN_GL); P40(36, 4, CAN_GR);
P40(35, 5, TB1);    P40(36, 5, TB2);
P40(38, 6, CAN_AL); P40(39, 6, CAN_AR);
P40(38, 7, TB1);    P40(39, 7, TB2);

// West edge trees (rows 8-16, col 0-3) — sparse
P40(0,  8,  CAN_GL); P40(1,  8,  CAN_GR);
P40(0,  9,  TB1);    P40(1,  9,  TB2);
P40(2,  12, CAN_AL); P40(3,  12, CAN_AR);
P40(2,  13, TB1);    P40(3,  13, TB2);
P40(0,  15, CAN_GL); P40(1,  15, CAN_GR);
P40(0,  16, TB1);    P40(1,  16, TB2);

// East edge trees (rows 8-16, cols 37-39) — do not block path exit rows 18-20
P40(37, 8,  CAN_AL); P40(38, 8,  CAN_AR);
P40(37, 9,  TB1);    P40(38, 9,  TB2);
P40(38, 12, CAN_GL); P40(39, 12, CAN_GR);
P40(38, 13, TB1);    P40(39, 13, TB2);
P40(37, 15, CAN_AL); P40(38, 15, CAN_AR);
P40(37, 16, TB1);    P40(38, 16, TB2);

// Central sunflower landmark area trees (north of path, rows 9-13, cols 8-12)
// Two-tree cluster framing the sunflower landmark
P40(8,  10, CAN_GL); P40(9,  10, CAN_GR);
P40(8,  11, TB1);    P40(9,  11, TB2);
P40(12, 9,  CAN_AL); P40(13, 9,  CAN_AR);
P40(12, 10, TB1);    P40(13, 10, TB2);

// Southern meadow trees (rows 21-30, sparse)
P40(2,  22, CAN_GL); P40(3,  22, CAN_GR);
P40(2,  23, TB1);    P40(3,  23, TB2);
P40(8,  24, CAN_AL); P40(9,  24, CAN_AR);
P40(8,  25, TB1);    P40(9,  25, TB2);
P40(32, 22, CAN_GL); P40(33, 22, CAN_GR);
P40(32, 23, TB1);    P40(33, 23, TB2);
P40(36, 25, CAN_AL); P40(37, 25, CAN_AR);
P40(36, 26, TB1);    P40(37, 26, TB2);
P40(15, 27, CAN_GL); P40(16, 27, CAN_GR);
P40(15, 28, TB1);    P40(16, 28, TB2);
P40(24, 26, CAN_AL); P40(25, 26, CAN_AR);
P40(24, 27, TB1);    P40(25, 27, TB2);

// South tree border — dense rows (rows 31-39)
// Canopies at row 31, trunks at row 32
P40(0,  31, CAN_GL); P40(1,  31, CAN_GR);
P40(4,  31, CAN_AL); P40(5,  31, CAN_AR);
P40(8,  31, CAN_GL); P40(9,  31, CAN_GR);
P40(12, 31, CAN_AL); P40(13, 31, CAN_AR);
P40(16, 31, CAN_GL); P40(17, 31, CAN_GR);
P40(20, 31, CAN_AL); P40(21, 31, CAN_AR);
P40(24, 31, CAN_GL); P40(25, 31, CAN_GR);
P40(28, 31, CAN_AL); P40(29, 31, CAN_AR);
P40(32, 31, CAN_GL); P40(33, 31, CAN_GR);
P40(36, 31, CAN_AL); P40(37, 31, CAN_AR);
P40(0,  32, TB1); P40(1,  32, TB2);
P40(4,  32, TB1); P40(5,  32, TB2);
P40(8,  32, TB1); P40(9,  32, TB2);
P40(12, 32, TB1); P40(13, 32, TB2);
P40(16, 32, TB1); P40(17, 32, TB2);
P40(20, 32, TB1); P40(21, 32, TB2);
P40(24, 32, TB1); P40(25, 32, TB2);
P40(28, 32, TB1); P40(29, 32, TB2);
P40(32, 32, TB1); P40(33, 32, TB2);
P40(36, 32, TB1); P40(37, 32, TB2);

// Second south border row: canopies at row 33, trunks at row 34
P40(2,  33, CAN_GL); P40(3,  33, CAN_GR);
P40(6,  33, CAN_AL); P40(7,  33, CAN_AR);
P40(10, 33, CAN_GL); P40(11, 33, CAN_GR);
P40(14, 33, CAN_AL); P40(15, 33, CAN_AR);
P40(18, 33, CAN_GL); P40(19, 33, CAN_GR);
P40(22, 33, CAN_AL); P40(23, 33, CAN_AR);
P40(26, 33, CAN_GL); P40(27, 33, CAN_GR);
P40(30, 33, CAN_AL); P40(31, 33, CAN_AR);
P40(34, 33, CAN_GL); P40(35, 33, CAN_GR);
P40(38, 33, CAN_AL); P40(39, 33, CAN_AR);
P40(2,  34, TB1); P40(3,  34, TB2);
P40(6,  34, TB1); P40(7,  34, TB2);
P40(10, 34, TB1); P40(11, 34, TB2);
P40(14, 34, TB1); P40(15, 34, TB2);
P40(18, 34, TB1); P40(19, 34, TB2);
P40(22, 34, TB1); P40(23, 34, TB2);
P40(26, 34, TB1); P40(27, 34, TB2);
P40(30, 34, TB1); P40(31, 34, TB2);
P40(34, 34, TB1); P40(35, 34, TB2);
P40(38, 34, TB1); P40(39, 34, TB2);

// Third south border row: canopies at row 35, trunks at row 36
P40(0,  35, CAN_GL); P40(1,  35, CAN_GR);
P40(4,  35, CAN_AL); P40(5,  35, CAN_AR);
P40(8,  35, CAN_GL); P40(9,  35, CAN_GR);
P40(12, 35, CAN_AL); P40(13, 35, CAN_AR);
P40(16, 35, CAN_GL); P40(17, 35, CAN_GR);
P40(20, 35, CAN_AL); P40(21, 35, CAN_AR);
P40(24, 35, CAN_GL); P40(25, 35, CAN_GR);
P40(28, 35, CAN_AL); P40(29, 35, CAN_AR);
P40(32, 35, CAN_GL); P40(33, 35, CAN_GR);
P40(36, 35, CAN_AL); P40(37, 35, CAN_AR);
P40(0,  36, TB1); P40(1,  36, TB2);
P40(4,  36, TB1); P40(5,  36, TB2);
P40(8,  36, TB1); P40(9,  36, TB2);
P40(12, 36, TB1); P40(13, 36, TB2);
P40(16, 36, TB1); P40(17, 36, TB2);
P40(20, 36, TB1); P40(21, 36, TB2);
P40(24, 36, TB1); P40(25, 36, TB2);
P40(28, 36, TB1); P40(29, 36, TB2);
P40(32, 36, TB1); P40(33, 36, TB2);
P40(36, 36, TB1); P40(37, 36, TB2);

// Fourth south border row: canopies at row 37, trunks at row 38
P40(2,  37, CAN_GL); P40(3,  37, CAN_GR);
P40(6,  37, CAN_AL); P40(7,  37, CAN_AR);
P40(10, 37, CAN_GL); P40(11, 37, CAN_GR);
P40(14, 37, CAN_AL); P40(15, 37, CAN_AR);
P40(18, 37, CAN_GL); P40(19, 37, CAN_GR);
P40(22, 37, CAN_AL); P40(23, 37, CAN_AR);
P40(26, 37, CAN_GL); P40(27, 37, CAN_GR);
P40(30, 37, CAN_AL); P40(31, 37, CAN_AR);
P40(34, 37, CAN_GL); P40(35, 37, CAN_GR);
P40(38, 37, CAN_AL); P40(39, 37, CAN_AR);
P40(2,  38, TB1); P40(3,  38, TB2);
P40(6,  38, TB1); P40(7,  38, TB2);
P40(10, 38, TB1); P40(11, 38, TB2);
P40(14, 38, TB1); P40(15, 38, TB2);
P40(18, 38, TB1); P40(19, 38, TB2);
P40(22, 38, TB1); P40(23, 38, TB2);
P40(26, 38, TB1); P40(27, 38, TB2);
P40(30, 38, TB1); P40(31, 38, TB2);
P40(34, 38, TB1); P40(35, 38, TB2);
P40(38, 38, TB1); P40(39, 38, TB2);

// Fifth south border: canopies at row 38 for trunks at row 39
P40(0,  38, CAN_GL); P40(1,  38, CAN_GR);
P40(4,  38, CAN_AL); P40(5,  38, CAN_AR);
P40(8,  38, CAN_GL); P40(9,  38, CAN_GR);
P40(12, 38, CAN_AL); P40(13, 38, CAN_AR);
P40(16, 38, CAN_GL); P40(17, 38, CAN_GR);
P40(20, 38, CAN_AL); P40(21, 38, CAN_AR);
P40(24, 38, CAN_GL); P40(25, 38, CAN_GR);
P40(28, 38, CAN_AL); P40(29, 38, CAN_AR);
P40(32, 38, CAN_GL); P40(33, 38, CAN_GR);
P40(36, 38, CAN_AL); P40(37, 38, CAN_AR);
P40(0,  39, TB1); P40(1,  39, TB2);
P40(4,  39, TB1); P40(5,  39, TB2);
P40(8,  39, TB1); P40(9,  39, TB2);
P40(12, 39, TB1); P40(13, 39, TB2);
P40(16, 39, TB1); P40(17, 39, TB2);
P40(20, 39, TB1); P40(21, 39, TB2);
P40(24, 39, TB1); P40(25, 39, TB2);
P40(28, 39, TB1); P40(29, 39, TB2);
P40(32, 39, TB1); P40(33, 39, TB2);
P40(36, 39, TB1); P40(37, 39, TB2);

// ── Decorations — bushes and flower bushes scattered organically ──
// Flower bushes (FBL=19) near path north/south edges
P40(5,  17, FBL); P40(11, 17, FBL); P40(22, 17, BSH);
P40(5,  21, BSH); P40(14, 21, FBL); P40(27, 21, FBL);
// Bushes framing path on east approach
P40(32, 17, BSH); P40(32, 21, BSH);
// Scattered flower bushes in meadow
P40(10, 5,  FBL); P40(18, 7,  FBL); P40(28, 4,  BSH);
P40(6,  11, FBL); P40(20, 11, FBL); P40(30, 10, BSH);
P40(15, 24, FBL); P40(22, 28, BSH); P40(30, 26, FBL);
// Lantern at landmark area (near giant sunflower)
P40(10, 13, LNT);
// Berry bushes near butterfly clearing
P40(6,  25, BBR); P40(20, 24, BBR); P40(33, 29, BBR);

// ── COLLISION LAYER (40x40 = 1600 tiles) ──────────────────────────────────
// 0 = walkable, 1 = blocked
// Trees, bushes block. Path rows 18-20 are always walkable.
// Top/bottom tree borders block. Meadow is open.

const collision = new Array(1600).fill(0);
function block(x, y) { collision[y * 40 + x] = 1; }

// Block top tree border rows 0-2 (outside playable area)
for (let x = 0; x < 40; x++) {
  block(x, 0); block(x, 1); block(x, 2);
}
// Un-block the actual walkable part of row 1 (it's tree border, but some tiles are passable grass)
// Actually for a meadow approach, rows 0-2 are tree-dense — keep blocked.

// Block individual trees by trunk position
const trunkPositions = [
  // Top border trunks (row 1)
  [1,1],[2,1],[6,1],[7,1],[14,1],[15,1],[22,1],[23,1],[30,1],[31,1],[36,1],[37,1],
  // Row 2 trunks
  [10,2],[11,2],[26,2],[27,2],
  // NW grove
  [0,4],[1,4],[3,6],[4,6],
  // NE grove
  [35,5],[36,5],[38,7],[39,7],
  // West edge
  [0,9],[1,9],[2,13],[3,13],[0,16],[1,16],
  // East edge (don't block exit zone rows 17-21)
  [37,9],[38,9],[38,13],[39,13],[37,16],[38,16],
  // Central landmark
  [8,11],[9,11],[12,10],[13,10],
  // South meadow trees
  [2,23],[3,23],[8,25],[9,25],[32,23],[33,23],[36,26],[37,26],[15,28],[16,28],[24,27],[25,27],
  // South border row 32
  [0,32],[1,32],[4,32],[5,32],[8,32],[9,32],[12,32],[13,32],[16,32],[17,32],
  [20,32],[21,32],[24,32],[25,32],[28,32],[29,32],[32,32],[33,32],[36,32],[37,32],
  // South border row 34
  [2,34],[3,34],[6,34],[7,34],[10,34],[11,34],[14,34],[15,34],[18,34],[19,34],
  [22,34],[23,34],[26,34],[27,34],[30,34],[31,34],[34,34],[35,34],[38,34],[39,34],
  // South border row 36
  [0,36],[1,36],[4,36],[5,36],[8,36],[9,36],[12,36],[13,36],[16,36],[17,36],
  [20,36],[21,36],[24,36],[25,36],[28,36],[29,36],[32,36],[33,36],[36,36],[37,36],
  // South border row 38
  [2,38],[3,38],[6,38],[7,38],[10,38],[11,38],[14,38],[15,38],[18,38],[19,38],
  [22,38],[23,38],[26,38],[27,38],[30,38],[31,38],[34,38],[35,38],[38,38],[39,38],
  // South border row 39
  [0,39],[1,39],[4,39],[5,39],[8,39],[9,39],[12,39],[13,39],[16,39],[17,39],
  [20,39],[21,39],[24,39],[25,39],[28,39],[29,39],[32,39],[33,39],[36,39],[37,39],
];
trunkPositions.forEach(([x, y]) => block(x, y));

// Block decorations
const decorBlocks = [
  [5,17],[11,17],[22,17],[5,21],[14,21],[27,21],[32,17],[32,21],
  [10,5],[18,7],[28,4],[6,11],[20,11],[30,10],
  [15,24],[22,28],[30,26],[6,25],[20,24],[33,29],[10,13],
];
decorBlocks.forEach(([x, y]) => block(x, y));

// Path rows 18-20 are always walkable — ensure no accidental blocks
for (let x = 0; x < 40; x++) {
  collision[18 * 40 + x] = 0;
  collision[19 * 40 + x] = 0;
  collision[20 * 40 + x] = 0;
}

// ── FOREGROUND LAYER (40x40 = 1600 tiles, -1 = empty) ──────────────────────
// Only tree canopies go here (drawn over the player for depth).
// Canopy row is ABOVE trunk row. Copy canopy tiles from objects planning.

const foreground = new Array(1600).fill(E);
function fg(x, y, t) { foreground[y * 40 + x] = t; }

// Top border canopies (row 0)
fg(1,  0, CAN_GL); fg(2,  0, CAN_GR);
fg(6,  0, CAN_AL); fg(7,  0, CAN_AR);
fg(14, 0, CAN_GL); fg(15, 0, CAN_GR);
fg(22, 0, CAN_AL); fg(23, 0, CAN_AR);
fg(30, 0, CAN_GL); fg(31, 0, CAN_GR);
fg(36, 0, CAN_AL); fg(37, 0, CAN_AR);
fg(10, 1, CAN_GL); fg(11, 1, CAN_GR);
fg(26, 1, CAN_AL); fg(27, 1, CAN_AR);
// NW grove
fg(0,  3, CAN_GL); fg(1,  3, CAN_GR);
fg(3,  5, CAN_AL); fg(4,  5, CAN_AR);
// NE grove
fg(35, 4, CAN_GL); fg(36, 4, CAN_GR);
fg(38, 6, CAN_AL); fg(39, 6, CAN_AR);
// West edge canopies
fg(0,  8,  CAN_GL); fg(1,  8,  CAN_GR);
fg(2,  12, CAN_AL); fg(3,  12, CAN_AR);
fg(0,  15, CAN_GL); fg(1,  15, CAN_GR);
// East edge canopies
fg(37, 8,  CAN_AL); fg(38, 8,  CAN_AR);
fg(38, 12, CAN_GL); fg(39, 12, CAN_GR);
fg(37, 15, CAN_AL); fg(38, 15, CAN_AR);
// Central landmark trees
fg(8,  10, CAN_GL); fg(9,  10, CAN_GR);
fg(12, 9,  CAN_AL); fg(13, 9,  CAN_AR);
// South meadow canopies
fg(2,  22, CAN_GL); fg(3,  22, CAN_GR);
fg(8,  24, CAN_AL); fg(9,  24, CAN_AR);
fg(32, 22, CAN_GL); fg(33, 22, CAN_GR);
fg(36, 25, CAN_AL); fg(37, 25, CAN_AR);
fg(15, 27, CAN_GL); fg(16, 27, CAN_GR);
fg(24, 26, CAN_AL); fg(25, 26, CAN_AR);
// South border canopies (row 31)
fg(0,  31, CAN_GL); fg(1,  31, CAN_GR);
fg(4,  31, CAN_AL); fg(5,  31, CAN_AR);
fg(8,  31, CAN_GL); fg(9,  31, CAN_GR);
fg(12, 31, CAN_AL); fg(13, 31, CAN_AR);
fg(16, 31, CAN_GL); fg(17, 31, CAN_GR);
fg(20, 31, CAN_AL); fg(21, 31, CAN_AR);
fg(24, 31, CAN_GL); fg(25, 31, CAN_GR);
fg(28, 31, CAN_AL); fg(29, 31, CAN_AR);
fg(32, 31, CAN_GL); fg(33, 31, CAN_GR);
fg(36, 31, CAN_AL); fg(37, 31, CAN_AR);
// Row 33 canopies
fg(2,  33, CAN_GL); fg(3,  33, CAN_GR);
fg(6,  33, CAN_AL); fg(7,  33, CAN_AR);
fg(10, 33, CAN_GL); fg(11, 33, CAN_GR);
fg(14, 33, CAN_AL); fg(15, 33, CAN_AR);
fg(18, 33, CAN_GL); fg(19, 33, CAN_GR);
fg(22, 33, CAN_AL); fg(23, 33, CAN_AR);
fg(26, 33, CAN_GL); fg(27, 33, CAN_GR);
fg(30, 33, CAN_AL); fg(31, 33, CAN_AR);
fg(34, 33, CAN_GL); fg(35, 33, CAN_GR);
fg(38, 33, CAN_AL); fg(39, 33, CAN_AR);
// Row 35 canopies
fg(0,  35, CAN_GL); fg(1,  35, CAN_GR);
fg(4,  35, CAN_AL); fg(5,  35, CAN_AR);
fg(8,  35, CAN_GL); fg(9,  35, CAN_GR);
fg(12, 35, CAN_AL); fg(13, 35, CAN_AR);
fg(16, 35, CAN_GL); fg(17, 35, CAN_GR);
fg(20, 35, CAN_AL); fg(21, 35, CAN_AR);
fg(24, 35, CAN_GL); fg(25, 35, CAN_GR);
fg(28, 35, CAN_AL); fg(29, 35, CAN_AR);
fg(32, 35, CAN_GL); fg(33, 35, CAN_GR);
fg(36, 35, CAN_AL); fg(37, 35, CAN_AR);
// Row 37 canopies
fg(2,  37, CAN_GL); fg(3,  37, CAN_GR);
fg(6,  37, CAN_AL); fg(7,  37, CAN_AR);
fg(10, 37, CAN_GL); fg(11, 37, CAN_GR);
fg(14, 37, CAN_AL); fg(15, 37, CAN_AR);
fg(18, 37, CAN_GL); fg(19, 37, CAN_GR);
fg(22, 37, CAN_AL); fg(23, 37, CAN_AR);
fg(26, 37, CAN_GL); fg(27, 37, CAN_GR);
fg(30, 37, CAN_AL); fg(31, 37, CAN_AR);
fg(34, 37, CAN_GL); fg(35, 37, CAN_GR);
fg(38, 37, CAN_AL); fg(39, 37, CAN_AR);
// Row 38 canopies (for row 39 trunks)
fg(0,  38, CAN_GL); fg(1,  38, CAN_GR);
fg(4,  38, CAN_AL); fg(5,  38, CAN_AR);
fg(8,  38, CAN_GL); fg(9,  38, CAN_GR);
fg(12, 38, CAN_AL); fg(13, 38, CAN_AR);
fg(16, 38, CAN_GL); fg(17, 38, CAN_GR);
fg(20, 38, CAN_AL); fg(21, 38, CAN_AR);
fg(24, 38, CAN_GL); fg(25, 38, CAN_GR);
fg(28, 38, CAN_AL); fg(29, 38, CAN_AR);
fg(32, 38, CAN_GL); fg(33, 38, CAN_GR);
fg(36, 38, CAN_AL); fg(37, 38, CAN_AR);

// ── NPCs ──────────────────────────────────────────────────────────────────
// No NPCs in blueprint for meadow-trail (transition area).
const npcs = [];

// ── World Objects (tappable) ──────────────────────────────────────────────
const worldObjects = [
  // Giant sunflower landmark — north of path, center-west of map
  // All three tiles share the same dialogueId so any tap on the cluster triggers it.
  { type: 'FLOWER_BIG',    x: 10, y: 12, id: 'giant-sunflower-01', dialogueId: 'sunflower-tap' },
  { type: 'FLOWER_BIG',    x: 11, y: 12, id: 'giant-sunflower-02', dialogueId: 'sunflower-tap' },
  { type: 'FLOWER_BIG',    x: 10, y: 13, id: 'giant-sunflower-03', dialogueId: 'sunflower-tap' },

  // Scattered flowers across the open meadow
  { type: 'FLOWER_SMALL',  x: 15, y: 5,  id: 'flower-meadow-01', dialogueId: 'flower-tap' },
  { type: 'FLOWER_SMALL',  x: 25, y: 4,  id: 'flower-meadow-02', dialogueId: 'flower-tap' },
  { type: 'FLOWER_SMALL',  x: 20, y: 8,  id: 'flower-meadow-03', dialogueId: 'flower-tap' },
  { type: 'FLOWER_SMALL',  x: 7,  y: 7,  id: 'flower-meadow-04', dialogueId: 'flower-tap' },
  { type: 'DANDELION',     x: 30, y: 7,  id: 'dandelion-meadow-01', dialogueId: 'flower-tap' },
  { type: 'DANDELION',     x: 16, y: 12, id: 'dandelion-meadow-02', dialogueId: 'flower-tap' },
  { type: 'FLOWER_SMALL',  x: 33, y: 11, id: 'flower-meadow-05', dialogueId: 'flower-tap' },

  // Tappable butterfly objects — positioned near the ambient butterfly zones
  // (Ambient BUTTERFLY entries in the animals array are non-tappable wanderers;
  //  these worldObjects give the player something to tap in the same areas.)
  { type: 'BUTTERFLY',     x: 17, y: 5,  id: 'butterfly-tap-01', dialogueId: 'butterfly-tap' },
  { type: 'BUTTERFLY',     x: 14, y: 25, id: 'butterfly-tap-02', dialogueId: 'butterfly-tap' },

  // Butterfly clearing (south of path, cols 12-20)
  { type: 'FLOWER_BIG',    x: 13, y: 24, id: 'butterfly-clearing-flower-01', dialogueId: 'flower-tap' },
  { type: 'FLOWER_BIG',    x: 18, y: 26, id: 'butterfly-clearing-flower-02', dialogueId: 'flower-tap' },
  { type: 'FLOWER_SMALL',  x: 11, y: 26, id: 'butterfly-clearing-flower-03', dialogueId: 'flower-tap' },
  { type: 'DANDELION',     x: 16, y: 28, id: 'butterfly-clearing-dande-01',  dialogueId: 'flower-tap' },

  // South meadow
  { type: 'FLOWER_SMALL',  x: 28, y: 22, id: 'flower-south-01', dialogueId: 'flower-tap' },
  { type: 'FLOWER_SMALL',  x: 35, y: 24, id: 'flower-south-02', dialogueId: 'flower-tap' },
  { type: 'DANDELION',     x: 4,  y: 27, id: 'dandelion-south-01', dialogueId: 'flower-tap' },

  // Quest item spawn for future use — acorn near NW grove
  { type: 'FLOWER_SMALL',  x: 3,  y: 9,  id: 'flower-nw-grove', dialogueId: 'flower-tap' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────
const animals = [
  // Butterflies near flowers — 4 total
  { type: 'BUTTERFLY', x: 16, y: 5,  spriteName: 'butterfly', zone: { x: 10, y: 3,  w: 15, h: 6 } },
  { type: 'BUTTERFLY', x: 12, y: 25, spriteName: 'butterfly', zone: { x: 8,  y: 22, w: 14, h: 7 } },
  { type: 'BUTTERFLY', x: 27, y: 9,  spriteName: 'butterfly', zone: { x: 22, y: 6,  w: 12, h: 8 } },
  { type: 'BUTTERFLY', x: 20, y: 25, spriteName: 'butterfly', zone: { x: 15, y: 22, w: 10, h: 6 } },
  // Birds in north tree area
  { type: 'BIRD', x: 5,  y: 3,  spriteName: 'bird', zone: { x: 0,  y: 2,  w: 12, h: 5 } },
  { type: 'BIRD', x: 33, y: 4,  spriteName: 'bird', zone: { x: 28, y: 2,  w: 12, h: 5 } },
  // Bunny in meadow
  { type: 'BUNNY', x: 22, y: 14, spriteName: 'bunny', zone: { x: 16, y: 10, w: 12, h: 8 } },
  // Bee near flowers
  { type: 'BEE', x: 14, y: 6, spriteName: 'bee', zone: { x: 10, y: 4, w: 10, h: 6 } },
];

// ── Quests ─────────────────────────────────────────────────────────────────
// No quests in meadow-trail — it is a pure transition/path map.
const quests = [];

// ── Dialogues ──────────────────────────────────────────────────────────────
// Ambient tap dialogues for world objects. No named NPCs on this map.
// portrait: null renders the golden diamond sparkle (narrator indicator).
// All text is 10 words or fewer per node.
const dialogues = {

  // ── sunflower-tap ─────────────────────────────────────────────────────────
  // Triggered by tapping any giant-sunflower-* worldObject.
  // Node 1: Narrator describes the landmark.
  // Node 2: Companion reacts with wonder.
  'sunflower-tap': {
    startId: 'sf1',
    nodes: {
      sf1: {
        id: 'sf1',
        portrait: null,
        name: 'Narrator',
        speaker: '',
        voiceId: 'voice_narrator_sunflower_01',
        text: 'What a big, happy sunflower!',
        expression: 'happy',
        next: 'sf2',
        choices: null,
      },
      sf2: {
        id: 'sf2',
        portrait: null,
        name: 'Narrator',
        speaker: '',
        voiceId: 'voice_narrator_sunflower_02',
        text: 'It reaches all the way up to the sky!',
        expression: 'happy',
        next: null,
        choices: null,
      },
    },
  },

  // ── butterfly-tap ─────────────────────────────────────────────────────────
  // Triggered by tapping BUTTERFLY worldObjects.
  // Single node — a brief delightful observation.
  'butterfly-tap': {
    startId: 'bt1',
    nodes: {
      bt1: {
        id: 'bt1',
        portrait: null,
        name: 'Narrator',
        speaker: '',
        voiceId: 'voice_narrator_butterfly_01',
        text: 'A pretty butterfly dances in the breeze!',
        expression: 'happy',
        next: null,
        choices: null,
      },
    },
  },

  // ── flower-tap ────────────────────────────────────────────────────────────
  // Triggered by tapping FLOWER_SMALL, FLOWER_BIG, and DANDELION worldObjects.
  // Single node — sensory observation, no instruction.
  'flower-tap': {
    startId: 'fl1',
    nodes: {
      fl1: {
        id: 'fl1',
        portrait: null,
        name: 'Narrator',
        speaker: '',
        voiceId: 'voice_narrator_flower_01',
        text: 'The flowers smell so sweet!',
        expression: 'happy',
        next: null,
        choices: null,
      },
    },
  },

};

// ── Level Transitions ──────────────────────────────────────────────────────
// Connection: east edge, cols 18-21 → sparkle-village WEST edge cols 18-21
// Player exits at col 39 (east wall), row 19 (center of path).
// Arrives in sparkle-village at its west spawn.
const transitions = [
  {
    edge: 'east',
    tileStart: 18,
    tileEnd: 21,
    targetLevel: 'sparkle-village',
    targetSpawnX: 2,
    targetSpawnY: 19,
    transition: { type: 'iris', duration: 700 },
    marker: 'flower-gate',
  },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'meadow-trail',
  name: 'Meadow Trail',
  width: 40,
  height: 40,
  tileSize: 16,

  spawnX: 36,
  spawnY: 19,

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
