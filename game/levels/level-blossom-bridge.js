/**
 * level-blossom-bridge.js — Blossom Bridge for Princess Sparkle V2
 *
 * 40x40 tile grid (640x640 pixels — camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Biome: meadow — bright, celebratory, flower-heavy (~40% tile 2).
 * Role: path — journey feel, unlocks Act 2 east spoke.
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — BLOSSOM BRIDGE (40 wide x 40 tall)        ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  Rows 0-2:   Tree border top (staggered, sparse)       ║
 * ║  Rows 3-9:   Open flower meadow north half             ║
 * ║  Rows 10-12: Flower arch landmark (col 18-21)          ║
 * ║  Rows 13-17: E-W path approach, flanked by flowers     ║
 * ║  Rows 18-21: E-W path — WEST exit cols 0-3, row 19-20 ║
 * ║              EAST exit cols 36-39, row 19-20           ║
 * ║  Rows 22-30: Southern flower meadow, dense flowers     ║
 * ║  Rows 31-39: Tree border south                        ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * CONNECTIONS:
 *   WEST edge, rows 18-21 → sparkle-village EAST edge (tiles 18-21)
 *   EAST edge, rows 18-21 → rainbow-garden WEST edge (tiles 23-26)
 *
 * SPAWN: col 2, row 19 (near west exit — player walks east from village)
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
const GR  = 1;    // plain green grass (55%)
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
const FBL = 19;    // flower bush (purple/pink) — used for flower arch flanking
const LNT = 93;    // lantern post

// ── GROUND LAYER (40x40 = 1600 tiles) ──────────────────────────────────────
// Every cell filled. Meadow biome: ~40% GR2 (flowers), ~55% GR, ~5% path.
// E-W path at rows 18-20 running full width (west exit → east exit).
// Path: row 18 = DPL (top edge), row 19 = DP (center), row 20 = DPR (bottom)
// West exit: col 0-3, rows 18-20. East exit: col 36-39, rows 18-20.

// prettier-ignore
const ground = grid([
  // Row 0: sparse tree border top
  [GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 1: tree border
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2],
  // Row 2: tree border thinning
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 3: open flower meadow — high flower density (celebration biome)
  [GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2],
  // Row 4: flower field
  [GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR ],
  // Row 5: flower field
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2],
  // Row 6: open meadow
  [GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 7: meadow approaching arch
  [GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 8: flower dense — near arch
  [GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR ],
  // Row 9: open flower meadow
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 10: flower arch area — very dense flowers flanking path
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 11: flower arch row (objects: FBL flanking, path center open)
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR2, GR2, GR2, GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2],
  // Row 12: below arch — path corridor starts
  [GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR ],
  // Row 13: meadow north of path
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 14: approach north of path
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR ],
  // Row 15: meadow just north of path
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 16: approaching path
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 17: meadow just north of path
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 18: E-W path TOP edge — full width, west+east exits
  [DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL],
  // Row 19: E-W path CENTER
  [DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP ],
  // Row 20: E-W path BOTTOM edge
  [DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR],
  // Row 21: meadow south of path
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 22: flower meadow south
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 23: dense flowers south
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2],
  // Row 24: southern meadow
  [GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR ],
  // Row 25: more flowers south
  [GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR2],
  // Row 26: open flower south
  [GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 27: flowers scattered south
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 28: southern meadow
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 29: flower field south (approaching tree border)
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
// Tree trunks, bushes, flower bushes.
// Flower arch: flower bushes (FBL) flanking path at rows 10-12, cols 16-17 and 22-23.

const objects = new Array(1600).fill(E);
function place(layer, w, x, y, tile) { layer[y * w + x] = tile; }
const P40 = (x, y, t) => place(objects, 40, x, y, t);

// ── Tree border TOP (rows 0-2) ──
P40(1,  0, CAN_GL); P40(2,  0, CAN_GR);
P40(7,  0, CAN_AL); P40(8,  0, CAN_AR);
P40(15, 0, CAN_GL); P40(16, 0, CAN_GR);
P40(23, 0, CAN_AL); P40(24, 0, CAN_AR);
P40(31, 0, CAN_GL); P40(32, 0, CAN_GR);
P40(37, 0, CAN_AL); P40(38, 0, CAN_AR);
P40(1,  1, TB1);    P40(2,  1, TB2);
P40(7,  1, TB1);    P40(8,  1, TB2);
P40(15, 1, TB1);    P40(16, 1, TB2);
P40(23, 1, TB1);    P40(24, 1, TB2);
P40(31, 1, TB1);    P40(32, 1, TB2);
P40(37, 1, TB1);    P40(38, 1, TB2);

// Row 1: canopies for row 2 trunks (staggered)
P40(11, 1, CAN_GL); P40(12, 1, CAN_GR);
P40(27, 1, CAN_AL); P40(28, 1, CAN_AR);
P40(11, 2, TB1);    P40(12, 2, TB2);
P40(27, 2, TB1);    P40(28, 2, TB2);

// ── NW grove (rows 3-6, cols 0-4) ──
P40(0,  3, CAN_GL); P40(1,  3, CAN_GR);
P40(0,  4, TB1);    P40(1,  4, TB2);
P40(3,  5, CAN_AL); P40(4,  5, CAN_AR);
P40(3,  6, TB1);    P40(4,  6, TB2);

// ── NE grove (rows 3-7, cols 35-39) ──
P40(35, 3, CAN_GL); P40(36, 3, CAN_GR);
P40(35, 4, TB1);    P40(36, 4, TB2);
P40(38, 6, CAN_AL); P40(39, 6, CAN_AR);
P40(38, 7, TB1);    P40(39, 7, TB2);

// ── West edge trees (rows 8-16, cols 0-2) — do not block west exit rows 18-20 ──
P40(0,  8,  CAN_GL); P40(1,  8,  CAN_GR);
P40(0,  9,  TB1);    P40(1,  9,  TB2);
P40(2,  12, CAN_AL); P40(3,  12, CAN_AR);
P40(2,  13, TB1);    P40(3,  13, TB2);
P40(0,  15, CAN_GL); P40(1,  15, CAN_GR);
P40(0,  16, TB1);    P40(1,  16, TB2);

// ── East edge trees (rows 8-16, cols 37-39) — do not block east exit rows 18-20 ──
P40(37, 8,  CAN_AL); P40(38, 8,  CAN_AR);
P40(37, 9,  TB1);    P40(38, 9,  TB2);
P40(38, 12, CAN_GL); P40(39, 12, CAN_GR);
P40(38, 13, TB1);    P40(39, 13, TB2);
P40(37, 15, CAN_AL); P40(38, 15, CAN_AR);
P40(37, 16, TB1);    P40(38, 16, TB2);

// ── FLOWER ARCH LANDMARK (rows 10-12, flanking path center cols 19-20) ──
// Pink flower bushes stand like pillars forming a natural archway
P40(15, 10, FBL);  // left arch pillar top-left
P40(16, 10, FBL);  // left arch pillar top-right
P40(23, 10, FBL);  // right arch pillar top-left
P40(24, 10, FBL);  // right arch pillar top-right
P40(15, 11, FBL);  // left arch pillar mid-left
P40(16, 11, FBL);  // left arch pillar mid-right
P40(23, 11, FBL);  // right arch pillar mid-left
P40(24, 11, FBL);  // right arch pillar mid-right
P40(14, 12, FBL);  // left arch base
P40(17, 12, BSH);  // left arch edge bush
P40(22, 12, BSH);  // right arch edge bush
P40(25, 12, FBL);  // right arch base

// ── Flower bushes lining the path (north and south edges of path rows 17/21) ──
P40(5,  17, FBL); P40(9,  17, FBL); P40(13, 17, FBL);
P40(20, 17, FBL); P40(26, 17, FBL); P40(32, 17, FBL);
P40(5,  21, FBL); P40(10, 21, BSH); P40(15, 21, FBL);
P40(22, 21, FBL); P40(28, 21, BSH); P40(34, 21, FBL);

// ── Scattered bushes / decorations in meadow ──
P40(7,  5,  FBL); P40(19, 4,  FBL); P40(30, 5,  BSH);
P40(12, 8,  FBL); P40(26, 7,  FBL); P40(33, 8,  BSH);
P40(6,  24, FBL); P40(18, 25, FBL); P40(31, 23, BSH);
P40(11, 27, BSH); P40(25, 28, FBL); P40(36, 26, FBL);
P40(3,  28, BBR); P40(20, 29, BBR); P40(38, 29, BBR);

// Lantern at arch entrance (south approach from path)
P40(19, 13, LNT); P40(20, 13, LNT);

// ── Southern meadow trees ──
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

// ── South tree border — dense rows (rows 31-39) ──
// Row 31 canopies / row 32 trunks
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
// Row 33 canopies / row 34 trunks
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
// Row 35 canopies / row 36 trunks
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
// Row 37 canopies / row 38 trunks
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
// Row 38 canopies / row 39 trunks
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

// ── COLLISION LAYER ──────────────────────────────────────────────────────────
const collision = new Array(1600).fill(0);
function block(x, y) { collision[y * 40 + x] = 1; }

// Top tree border (rows 0-2)
for (let x = 0; x < 40; x++) { block(x, 0); block(x, 1); block(x, 2); }

// Tree trunk collisions
const trunkPositions = [
  // Top border row 1
  [1,1],[2,1],[7,1],[8,1],[15,1],[16,1],[23,1],[24,1],[31,1],[32,1],[37,1],[38,1],
  // Top border row 2
  [11,2],[12,2],[27,2],[28,2],
  // NW grove
  [0,4],[1,4],[3,6],[4,6],
  // NE grove
  [35,4],[36,4],[38,7],[39,7],
  // West edge
  [0,9],[1,9],[2,13],[3,13],[0,16],[1,16],
  // East edge (don't block exit zone rows 17-21)
  [37,9],[38,9],[38,13],[39,13],[37,16],[38,16],
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

// Flower arch blocks
const archBlocks = [
  [15,10],[16,10],[23,10],[24,10],
  [15,11],[16,11],[23,11],[24,11],
  [14,12],[17,12],[22,12],[25,12],
];
archBlocks.forEach(([x, y]) => block(x, y));

// Decoration blocks
const decorBlocks = [
  [5,17],[9,17],[13,17],[20,17],[26,17],[32,17],
  [5,21],[10,21],[15,21],[22,21],[28,21],[34,21],
  [7,5],[19,4],[30,5],[12,8],[26,7],[33,8],
  [6,24],[18,25],[31,23],[11,27],[25,28],[36,26],
  [3,28],[20,29],[38,29],[19,13],[20,13],
];
decorBlocks.forEach(([x, y]) => block(x, y));

// Path rows 18-20 always walkable
for (let x = 0; x < 40; x++) {
  collision[18 * 40 + x] = 0;
  collision[19 * 40 + x] = 0;
  collision[20 * 40 + x] = 0;
}

// ── FOREGROUND LAYER (40x40 = 1600 tiles, -1 = empty) ──────────────────────
const foreground = new Array(1600).fill(E);
function fg(x, y, t) { foreground[y * 40 + x] = t; }

// Top border canopies (row 0)
fg(1,  0, CAN_GL); fg(2,  0, CAN_GR);
fg(7,  0, CAN_AL); fg(8,  0, CAN_AR);
fg(15, 0, CAN_GL); fg(16, 0, CAN_GR);
fg(23, 0, CAN_AL); fg(24, 0, CAN_AR);
fg(31, 0, CAN_GL); fg(32, 0, CAN_GR);
fg(37, 0, CAN_AL); fg(38, 0, CAN_AR);
fg(11, 1, CAN_GL); fg(12, 1, CAN_GR);
fg(27, 1, CAN_AL); fg(28, 1, CAN_AR);
// NW/NE groves
fg(0,  3, CAN_GL); fg(1,  3, CAN_GR);
fg(3,  5, CAN_AL); fg(4,  5, CAN_AR);
fg(35, 3, CAN_GL); fg(36, 3, CAN_GR);
fg(38, 6, CAN_AL); fg(39, 6, CAN_AR);
// West edge canopies
fg(0,  8,  CAN_GL); fg(1,  8,  CAN_GR);
fg(2,  12, CAN_AL); fg(3,  12, CAN_AR);
fg(0,  15, CAN_GL); fg(1,  15, CAN_GR);
// East edge canopies
fg(37, 8,  CAN_AL); fg(38, 8,  CAN_AR);
fg(38, 12, CAN_GL); fg(39, 12, CAN_GR);
fg(37, 15, CAN_AL); fg(38, 15, CAN_AR);
// South meadow canopies
fg(2,  22, CAN_GL); fg(3,  22, CAN_GR);
fg(8,  24, CAN_AL); fg(9,  24, CAN_AR);
fg(32, 22, CAN_GL); fg(33, 22, CAN_GR);
fg(36, 25, CAN_AL); fg(37, 25, CAN_AR);
fg(15, 27, CAN_GL); fg(16, 27, CAN_GR);
fg(24, 26, CAN_AL); fg(25, 26, CAN_AR);
// South border canopies (same pattern as meadow-trail)
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
// No NPCs in blossom-bridge (transition/path area).
const npcs = [];

// ── World Objects ─────────────────────────────────────────────────────────
const worldObjects = [
  // Flower arch landmark — tappable center of the archway
  { type: 'FLOWER_ARCH',  x: 19, y: 11, id: 'flower-arch-center' },

  // Flowers scattered north of path
  { type: 'FLOWER_BIG',   x: 10, y: 5,  id: 'flower-north-01' },
  { type: 'FLOWER_BIG',   x: 20, y: 4,  id: 'flower-north-02' },
  { type: 'FLOWER_SMALL', x: 28, y: 6,  id: 'flower-north-03' },
  { type: 'FLOWER_SMALL', x: 6,  y: 8,  id: 'flower-north-04' },
  { type: 'DANDELION',    x: 33, y: 9,  id: 'dandelion-north-01' },
  { type: 'FLOWER_SMALL', x: 14, y: 7,  id: 'flower-north-05' },

  // Flowers scattered south of path
  { type: 'FLOWER_BIG',   x: 13, y: 23, id: 'flower-south-01' },
  { type: 'FLOWER_BIG',   x: 22, y: 25, id: 'flower-south-02' },
  { type: 'FLOWER_SMALL', x: 30, y: 24, id: 'flower-south-03' },
  { type: 'DANDELION',    x: 7,  y: 27, id: 'dandelion-south-01' },
  { type: 'FLOWER_SMALL', x: 35, y: 28, id: 'flower-south-04' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────
const animals = [
  { type: 'BUTTERFLY', x: 12, y: 5,  spriteName: 'butterfly', zone: { x: 8,  y: 3,  w: 12, h: 7 } },
  { type: 'BUTTERFLY', x: 26, y: 7,  spriteName: 'butterfly', zone: { x: 20, y: 4,  w: 14, h: 8 } },
  { type: 'BUTTERFLY', x: 8,  y: 24, spriteName: 'butterfly', zone: { x: 4,  y: 21, w: 14, h: 8 } },
  { type: 'BUTTERFLY', x: 30, y: 23, spriteName: 'butterfly', zone: { x: 24, y: 21, w: 12, h: 7 } },
  { type: 'BIRD',      x: 5,  y: 3,  spriteName: 'bird',      zone: { x: 0,  y: 2,  w: 12, h: 5 } },
  { type: 'BIRD',      x: 34, y: 4,  spriteName: 'bird',      zone: { x: 28, y: 2,  w: 12, h: 5 } },
  { type: 'BUNNY',     x: 20, y: 14, spriteName: 'bunny',     zone: { x: 14, y: 10, w: 12, h: 7 } },
  { type: 'BEE',       x: 16, y: 6,  spriteName: 'bee',       zone: { x: 12, y: 4,  w: 10, h: 6 } },
];

// ── Quests ─────────────────────────────────────────────────────────────────
const quests = [];

// ── Dialogues ──────────────────────────────────────────────────────────────
const dialogues = {};

// ── Level Transitions ──────────────────────────────────────────────────────
// WEST exit: player returns to sparkle-village east edge (tiles 18-21)
// EAST exit: player advances to rainbow-garden west edge (tiles 23-26)
const transitions = [
  {
    edge: 'west',
    tileStart: 18,
    tileEnd: 21,
    targetLevel: 'sparkle-village',
    targetSpawnX: 57,
    targetSpawnY: 19,
    transition: { type: 'iris', duration: 700 },
    marker: 'flower-arch',
  },
  {
    edge: 'east',
    tileStart: 18,
    tileEnd: 21,
    targetLevel: 'rainbow-garden',
    targetSpawnX: 2,
    targetSpawnY: 24,
    transition: { type: 'iris', duration: 700 },
    marker: 'rainbow-arch',
  },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'blossom-bridge',
  name: 'Blossom Bridge',
  width: 40,
  height: 40,
  tileSize: 16,

  spawnX: 2,
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
