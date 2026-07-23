/**
 * level-rainbow-garden.js — Rainbow Garden for Princess Sparkle V2
 *
 * 50x50 tile grid (800x800 pixels — camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Biome: meadow — maximum flower density. The most beautiful map in the game.
 * Role: destination — grand open clearing, Daisy the fairy NPC, quest hub.
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — RAINBOW GARDEN (50 wide x 50 tall)        ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  Rows 0-3:   Tree border top (dense)                   ║
 * ║  Rows 4-11:  Northern flower fields — organized rows   ║
 * ║  Rows 12-18: W path approach (exit at west edge 23-26) ║
 * ║  Rows 17-35: Central clearing (12x12: cols 19-30)      ║
 * ║  Rows 18-21: E-W path rows through clearing            ║
 * ║  Rows 36-43: Southern flower fields                    ║
 * ║  Rows 44-49: Tree border south                         ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * CLEARING CENTER: cols 19-30, rows 17-28 (12x12 open area)
 * FOUNTAIN (well): center at cols 24-25, rows 21-22
 * RETURN PORTAL: col 24, row 26
 *
 * CONNECTION:
 *   WEST edge, rows 23-26 → blossom-bridge EAST edge (tiles 18-21)
 *
 * NPC: Daisy (homeX:25, homeY:24 — center of clearing)
 *
 * SPAWN: col 2, row 24 (near west exit, player walks east)
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
const GR2 = 2;    // grass with flowers (~45% in rainbow garden — maximum)
const DP  = 40;   // dirt path center
const DPL = 39;   // dirt path left/top edge
const DPR = 41;   // dirt path right/bottom edge
const E   = -1;

const CAN_GL = 4;
const CAN_GR = 5;
const CAN_AL = 7;
const CAN_AR = 8;
const TB1 = 12;
const TB2 = 13;

const BSH = 28;
const BBR = 29;
const FBL = 19;   // flower bush (purple/pink)
const LNT = 93;
const WEL = 92;   // well top (used as fountain)
const WEB = 104;  // well base

// ── GROUND LAYER (50x50 = 2500 tiles) ──────────────────────────────────────
// Meadow biome at max density: ~45% GR2, ~50% GR, ~5% path.
// E-W path at rows 23-25 running cols 0-18 (approaching clearing from west).
// Path: row 23 = DPL, row 24 = DP (center), row 25 = DPR
// West exit at col 0, rows 23-25. Clearing is open grass (no path tiles).

// prettier-ignore
const ground = grid([
  // Row 0: tree border top
  [GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 1: tree border
  [GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2],
  // Row 2: tree border
  [GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 3: tree border thinning
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 4: open flower meadow — organized flower rows
  [GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 5: flower row
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 6: open
  [GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 7: flower row
  [GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 8: meadow
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 9: flower row
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 10: meadow approach
  [GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR ],
  // Row 11: approaching path
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 12: meadow north of path
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 13: meadow north of path
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2],
  // Row 14: meadow
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 15: approaching clearing from north
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 16: edge of clearing north
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 17: clearing north edge — open grass (no path)
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 18: clearing top — all open grass in center cols 19-30
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 19: clearing
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2],
  // Row 20: clearing — fountain north
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 21: clearing — fountain row
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 22: clearing — fountain base
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 23: W path TOP edge (cols 0-18), clearing (cols 19-30), meadow (cols 31-49)
  [DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, DPL, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 24: W path CENTER (cols 0-18), clearing (cols 19-30), meadow (cols 31-49)
  [DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  DP,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 25: W path BOTTOM edge (cols 0-18), clearing (cols 19-30), meadow (cols 31-49)
  [DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, DPR, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 26: clearing — portal row
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR2],
  // Row 27: clearing south
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 28: clearing south edge
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 29: south of clearing
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR ],
  // Row 30: southern meadow, high flowers
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 31: organized flower row (south)
  [GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 32: meadow
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2],
  // Row 33: flower row
  [GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 34: meadow
  [GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 35: meadow south
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 36: south meadow
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 37: flower row south
  [GR,  GR2, GR,  GR2, GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 38: approach to south border
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 39: south meadow
  [GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 40: south meadow approach
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 41: south border approaching
  [GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
  // Row 42: south meadow
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 43: south border begins
  [GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR ],
  // Row 44: south tree border
  [GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 45: south tree border
  [GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR ],
  // Row 46: tree border
  [GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2],
  // Row 47: tree border
  [GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR ],
  // Row 48: tree border
  [GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR ],
  // Row 49: bottom border
  [GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR,  GR2, GR2, GR,  GR,  GR2, GR,  GR2, GR,  GR,  GR ],
]);

// ── OBJECTS LAYER (50x50 = 2500 tiles, -1 = empty) ──────────────────────────
const objects = new Array(2500).fill(E);
function place(layer, w, x, y, tile) { layer[y * w + x] = tile; }
const P50 = (x, y, t) => place(objects, 50, x, y, t);

// ── Tree border TOP (rows 0-3) ──
P50(1,  0, CAN_GL); P50(2,  0, CAN_GR);
P50(7,  0, CAN_AL); P50(8,  0, CAN_AR);
P50(14, 0, CAN_GL); P50(15, 0, CAN_GR);
P50(21, 0, CAN_AL); P50(22, 0, CAN_AR);
P50(28, 0, CAN_GL); P50(29, 0, CAN_GR);
P50(35, 0, CAN_AL); P50(36, 0, CAN_AR);
P50(42, 0, CAN_GL); P50(43, 0, CAN_GR);
P50(47, 0, CAN_AL); P50(48, 0, CAN_AR);
P50(1,  1, TB1);    P50(2,  1, TB2);
P50(7,  1, TB1);    P50(8,  1, TB2);
P50(14, 1, TB1);    P50(15, 1, TB2);
P50(21, 1, TB1);    P50(22, 1, TB2);
P50(28, 1, TB1);    P50(29, 1, TB2);
P50(35, 1, TB1);    P50(36, 1, TB2);
P50(42, 1, TB1);    P50(43, 1, TB2);
P50(47, 1, TB1);    P50(48, 1, TB2);
// Staggered second top row
P50(4,  1, CAN_GL); P50(5,  1, CAN_GR);
P50(11, 1, CAN_AL); P50(12, 1, CAN_AR);
P50(18, 1, CAN_GL); P50(19, 1, CAN_GR);
P50(25, 1, CAN_AL); P50(26, 1, CAN_AR);
P50(32, 1, CAN_GL); P50(33, 1, CAN_GR);
P50(39, 1, CAN_AL); P50(40, 1, CAN_AR);
P50(45, 1, CAN_GL); P50(46, 1, CAN_GR);
P50(4,  2, TB1);    P50(5,  2, TB2);
P50(11, 2, TB1);    P50(12, 2, TB2);
P50(18, 2, TB1);    P50(19, 2, TB2);
P50(25, 2, TB1);    P50(26, 2, TB2);
P50(32, 2, TB1);    P50(33, 2, TB2);
P50(39, 2, TB1);    P50(40, 2, TB2);
P50(45, 2, TB1);    P50(46, 2, TB2);

// ── NW/NE corner groves ──
P50(0,  4, CAN_GL); P50(1,  4, CAN_GR);
P50(0,  5, TB1);    P50(1,  5, TB2);
P50(3,  6, CAN_AL); P50(4,  6, CAN_AR);
P50(3,  7, TB1);    P50(4,  7, TB2);

P50(46, 4, CAN_GL); P50(47, 4, CAN_GR);
P50(46, 5, TB1);    P50(47, 5, TB2);
P50(48, 6, CAN_AL); P50(49, 6, CAN_AR);
P50(48, 7, TB1);    P50(49, 7, TB2);

// ── West edge trees (rows 8-22, cols 0-3) — don't block west exit rows 23-25 ──
P50(0,  8,  CAN_GL); P50(1,  8,  CAN_GR);
P50(0,  9,  TB1);    P50(1,  9,  TB2);
P50(2,  11, CAN_AL); P50(3,  11, CAN_AR);
P50(2,  12, TB1);    P50(3,  12, TB2);
P50(0,  14, CAN_GL); P50(1,  14, CAN_GR);
P50(0,  15, TB1);    P50(1,  15, TB2);
P50(2,  18, CAN_AL); P50(3,  18, CAN_AR);
P50(2,  19, TB1);    P50(3,  19, TB2);
P50(0,  21, CAN_GL); P50(1,  21, CAN_GR);
P50(0,  22, TB1);    P50(1,  22, TB2);

// ── East edge trees (rows 8-42) ──
P50(47, 8,  CAN_AL); P50(48, 8,  CAN_AR);
P50(47, 9,  TB1);    P50(48, 9,  TB2);
P50(48, 12, CAN_GL); P50(49, 12, CAN_GR);
P50(48, 13, TB1);    P50(49, 13, TB2);
P50(47, 16, CAN_AL); P50(48, 16, CAN_AR);
P50(47, 17, TB1);    P50(48, 17, TB2);
P50(48, 20, CAN_GL); P50(49, 20, CAN_GR);
P50(48, 21, TB1);    P50(49, 21, TB2);
P50(47, 26, CAN_AL); P50(48, 26, CAN_AR);
P50(47, 27, TB1);    P50(48, 27, TB2);
P50(48, 29, CAN_GL); P50(49, 29, CAN_GR);
P50(48, 30, TB1);    P50(49, 30, TB2);
P50(47, 32, CAN_AL); P50(48, 32, CAN_AR);
P50(47, 33, TB1);    P50(48, 33, TB2);
P50(48, 35, CAN_GL); P50(49, 35, CAN_GR);
P50(48, 36, TB1);    P50(49, 36, TB2);

// ── CLEARING BORDER TREES — frame the 12x12 clearing ──
// North edge of clearing (cols 13-17 and 31-35, rows 14-15)
P50(12, 14, CAN_GL); P50(13, 14, CAN_GR);
P50(12, 15, TB1);    P50(13, 15, TB2);
P50(16, 13, CAN_AL); P50(17, 13, CAN_AR);
P50(16, 14, TB1);    P50(17, 14, TB2);
P50(32, 14, CAN_GL); P50(33, 14, CAN_GR);
P50(32, 15, TB1);    P50(33, 15, TB2);
P50(35, 13, CAN_AL); P50(36, 13, CAN_AR);
P50(35, 14, TB1);    P50(36, 14, TB2);
// South edge of clearing (cols 13-17 and 31-35, rows 29-30)
P50(12, 29, CAN_GL); P50(13, 29, CAN_GR);
P50(12, 30, TB1);    P50(13, 30, TB2);
P50(16, 29, CAN_AL); P50(17, 29, CAN_AR);
P50(16, 30, TB1);    P50(17, 30, TB2);
P50(32, 29, CAN_GL); P50(33, 29, CAN_GR);
P50(32, 30, TB1);    P50(33, 30, TB2);
P50(35, 29, CAN_AL); P50(36, 29, CAN_AR);
P50(35, 30, TB1);    P50(36, 30, TB2);

// ── FOUNTAIN (well) at clearing center — cols 24-25, rows 21-22 ──
P50(24, 21, WEL);  // well top-left
P50(25, 21, WEL);  // well top-right
P50(24, 22, WEB);  // well base-left
P50(25, 22, WEB);  // well base-right

// ── Clearing entrance lanterns (path meets clearing) ──
P50(18, 22, LNT);
P50(18, 26, LNT);

// ── Scattered flower bushes ──
// North meadow flower rows
P50(5,  5,  FBL); P50(12, 4,  FBL); P50(20, 5,  FBL);
P50(30, 4,  FBL); P50(38, 5,  FBL); P50(45, 4,  FBL);
P50(8,  7,  BSH); P50(16, 8,  FBL); P50(24, 7,  FBL);
P50(35, 7,  BSH); P50(42, 8,  FBL);

// Clearing border flowers
P50(19, 16, FBL); P50(23, 16, FBL); P50(27, 16, FBL);
P50(19, 28, FBL); P50(23, 28, FBL); P50(27, 28, FBL);

// South meadow flowers
P50(5,  31, FBL); P50(14, 32, FBL); P50(22, 31, FBL);
P50(31, 32, FBL); P50(40, 31, FBL); P50(46, 32, BSH);
P50(9,  35, BBR); P50(20, 36, BBR); P50(37, 35, BBR);

// ── South meadow trees (rows 31-42) ──
P50(2,  32, CAN_GL); P50(3,  32, CAN_GR);
P50(2,  33, TB1);    P50(3,  33, TB2);
P50(6,  34, CAN_AL); P50(7,  34, CAN_AR);
P50(6,  35, TB1);    P50(7,  35, TB2);
P50(15, 33, CAN_GL); P50(16, 33, CAN_GR);
P50(15, 34, TB1);    P50(16, 34, TB2);
P50(24, 32, CAN_AL); P50(25, 32, CAN_AR);
P50(24, 33, TB1);    P50(25, 33, TB2);
P50(33, 34, CAN_GL); P50(34, 34, CAN_GR);
P50(33, 35, TB1);    P50(34, 35, TB2);
P50(40, 33, CAN_AL); P50(41, 33, CAN_AR);
P50(40, 34, TB1);    P50(41, 34, TB2);
P50(10, 37, CAN_GL); P50(11, 37, CAN_GR);
P50(10, 38, TB1);    P50(11, 38, TB2);
P50(28, 38, CAN_AL); P50(29, 38, CAN_AR);
P50(28, 39, TB1);    P50(29, 39, TB2);

// ── South tree border rows 44-49 ──
// Row 44 canopies / row 45 trunks
P50(0,  44, CAN_GL); P50(1,  44, CAN_GR);
P50(4,  44, CAN_AL); P50(5,  44, CAN_AR);
P50(8,  44, CAN_GL); P50(9,  44, CAN_GR);
P50(12, 44, CAN_AL); P50(13, 44, CAN_AR);
P50(16, 44, CAN_GL); P50(17, 44, CAN_GR);
P50(20, 44, CAN_AL); P50(21, 44, CAN_AR);
P50(24, 44, CAN_GL); P50(25, 44, CAN_GR);
P50(28, 44, CAN_AL); P50(29, 44, CAN_AR);
P50(32, 44, CAN_GL); P50(33, 44, CAN_GR);
P50(36, 44, CAN_AL); P50(37, 44, CAN_AR);
P50(40, 44, CAN_GL); P50(41, 44, CAN_GR);
P50(44, 44, CAN_AL); P50(45, 44, CAN_AR);
P50(48, 44, CAN_GL); P50(49, 44, CAN_GR);
P50(0,  45, TB1); P50(1,  45, TB2);
P50(4,  45, TB1); P50(5,  45, TB2);
P50(8,  45, TB1); P50(9,  45, TB2);
P50(12, 45, TB1); P50(13, 45, TB2);
P50(16, 45, TB1); P50(17, 45, TB2);
P50(20, 45, TB1); P50(21, 45, TB2);
P50(24, 45, TB1); P50(25, 45, TB2);
P50(28, 45, TB1); P50(29, 45, TB2);
P50(32, 45, TB1); P50(33, 45, TB2);
P50(36, 45, TB1); P50(37, 45, TB2);
P50(40, 45, TB1); P50(41, 45, TB2);
P50(44, 45, TB1); P50(45, 45, TB2);
P50(48, 45, TB1); P50(49, 45, TB2);
// Row 46 canopies / row 47 trunks
P50(2,  46, CAN_GL); P50(3,  46, CAN_GR);
P50(6,  46, CAN_AL); P50(7,  46, CAN_AR);
P50(10, 46, CAN_GL); P50(11, 46, CAN_GR);
P50(14, 46, CAN_AL); P50(15, 46, CAN_AR);
P50(18, 46, CAN_GL); P50(19, 46, CAN_GR);
P50(22, 46, CAN_AL); P50(23, 46, CAN_AR);
P50(26, 46, CAN_GL); P50(27, 46, CAN_GR);
P50(30, 46, CAN_AL); P50(31, 46, CAN_AR);
P50(34, 46, CAN_GL); P50(35, 46, CAN_GR);
P50(38, 46, CAN_AL); P50(39, 46, CAN_AR);
P50(42, 46, CAN_GL); P50(43, 46, CAN_GR);
P50(46, 46, CAN_AL); P50(47, 46, CAN_AR);
P50(2,  47, TB1); P50(3,  47, TB2);
P50(6,  47, TB1); P50(7,  47, TB2);
P50(10, 47, TB1); P50(11, 47, TB2);
P50(14, 47, TB1); P50(15, 47, TB2);
P50(18, 47, TB1); P50(19, 47, TB2);
P50(22, 47, TB1); P50(23, 47, TB2);
P50(26, 47, TB1); P50(27, 47, TB2);
P50(30, 47, TB1); P50(31, 47, TB2);
P50(34, 47, TB1); P50(35, 47, TB2);
P50(38, 47, TB1); P50(39, 47, TB2);
P50(42, 47, TB1); P50(43, 47, TB2);
P50(46, 47, TB1); P50(47, 47, TB2);
// Row 48 canopies / row 49 trunks
P50(0,  48, CAN_GL); P50(1,  48, CAN_GR);
P50(4,  48, CAN_AL); P50(5,  48, CAN_AR);
P50(8,  48, CAN_GL); P50(9,  48, CAN_GR);
P50(12, 48, CAN_AL); P50(13, 48, CAN_AR);
P50(16, 48, CAN_GL); P50(17, 48, CAN_GR);
P50(20, 48, CAN_AL); P50(21, 48, CAN_AR);
P50(24, 48, CAN_GL); P50(25, 48, CAN_GR);
P50(28, 48, CAN_AL); P50(29, 48, CAN_AR);
P50(32, 48, CAN_GL); P50(33, 48, CAN_GR);
P50(36, 48, CAN_AL); P50(37, 48, CAN_AR);
P50(40, 48, CAN_GL); P50(41, 48, CAN_GR);
P50(44, 48, CAN_AL); P50(45, 48, CAN_AR);
P50(48, 48, CAN_GL); P50(49, 48, CAN_GR);
P50(0,  49, TB1); P50(1,  49, TB2);
P50(4,  49, TB1); P50(5,  49, TB2);
P50(8,  49, TB1); P50(9,  49, TB2);
P50(12, 49, TB1); P50(13, 49, TB2);
P50(16, 49, TB1); P50(17, 49, TB2);
P50(20, 49, TB1); P50(21, 49, TB2);
P50(24, 49, TB1); P50(25, 49, TB2);
P50(28, 49, TB1); P50(29, 49, TB2);
P50(32, 49, TB1); P50(33, 49, TB2);
P50(36, 49, TB1); P50(37, 49, TB2);
P50(40, 49, TB1); P50(41, 49, TB2);
P50(44, 49, TB1); P50(45, 49, TB2);
P50(48, 49, TB1); P50(49, 49, TB2);

// ── COLLISION LAYER (50x50 = 2500 tiles) ──────────────────────────────────
const collision = new Array(2500).fill(0);
function block(x, y) { collision[y * 50 + x] = 1; }

// Top tree border
for (let x = 0; x < 50; x++) { block(x, 0); block(x, 1); block(x, 2); block(x, 3); }

// Tree trunks — top border rows 1-2
const trunkPositions50 = [
  [1,1],[2,1],[7,1],[8,1],[14,1],[15,1],[21,1],[22,1],[28,1],[29,1],[35,1],[36,1],[42,1],[43,1],[47,1],[48,1],
  [4,2],[5,2],[11,2],[12,2],[18,2],[19,2],[25,2],[26,2],[32,2],[33,2],[39,2],[40,2],[45,2],[46,2],
  // NW/NE groves
  [0,5],[1,5],[3,7],[4,7],
  [46,5],[47,5],[48,7],[49,7],
  // West edge (don't block exit rows 23-25)
  [0,9],[1,9],[2,12],[3,12],[0,15],[1,15],[2,19],[3,19],[0,22],[1,22],
  // East edge
  [47,9],[48,9],[48,13],[49,13],[47,17],[48,17],[48,21],[49,21],
  [47,27],[48,27],[48,30],[49,30],[47,33],[48,33],[48,36],[49,36],
  // Clearing border trees
  [12,15],[13,15],[16,14],[17,14],[32,15],[33,15],[35,14],[36,14],
  [12,30],[13,30],[16,30],[17,30],[32,30],[33,30],[35,30],[36,30],
  // South meadow trees
  [2,33],[3,33],[6,35],[7,35],[15,34],[16,34],[24,33],[25,33],
  [33,35],[34,35],[40,34],[41,34],[10,38],[11,38],[28,39],[29,39],
  // South border row 45
  [0,45],[1,45],[4,45],[5,45],[8,45],[9,45],[12,45],[13,45],[16,45],[17,45],
  [20,45],[21,45],[24,45],[25,45],[28,45],[29,45],[32,45],[33,45],[36,45],[37,45],
  [40,45],[41,45],[44,45],[45,45],[48,45],[49,45],
  // South border row 47
  [2,47],[3,47],[6,47],[7,47],[10,47],[11,47],[14,47],[15,47],[18,47],[19,47],
  [22,47],[23,47],[26,47],[27,47],[30,47],[31,47],[34,47],[35,47],[38,47],[39,47],
  [42,47],[43,47],[46,47],[47,47],
  // South border row 49
  [0,49],[1,49],[4,49],[5,49],[8,49],[9,49],[12,49],[13,49],[16,49],[17,49],
  [20,49],[21,49],[24,49],[25,49],[28,49],[29,49],[32,49],[33,49],[36,49],[37,49],
  [40,49],[41,49],[44,49],[45,49],[48,49],[49,49],
];
trunkPositions50.forEach(([x, y]) => block(x, y));

// Fountain blocks
block(24, 21); block(25, 21); block(24, 22); block(25, 22);

// Lantern blocks
block(18, 22); block(18, 26);

// Flower bush / decoration blocks (north meadow)
const decorBlocks50 = [
  [5,5],[12,4],[20,5],[30,4],[38,5],[45,4],
  [8,7],[16,8],[24,7],[35,7],[42,8],
  [19,16],[23,16],[27,16],[19,28],[23,28],[27,28],
  [5,31],[14,32],[22,31],[31,32],[40,31],[46,32],
  [9,35],[20,36],[37,35],
];
decorBlocks50.forEach(([x, y]) => block(x, y));

// Path rows 23-25 walkable at west approach (cols 0-18)
for (let x = 0; x <= 18; x++) {
  collision[23 * 50 + x] = 0;
  collision[24 * 50 + x] = 0;
  collision[25 * 50 + x] = 0;
}
// Clearing (cols 19-30, rows 17-28) is all walkable
for (let y = 17; y <= 28; y++) {
  for (let x = 19; x <= 30; x++) {
    collision[y * 50 + x] = 0;
  }
}

// ── FOREGROUND LAYER (50x50 = 2500 tiles, -1 = empty) ──────────────────────
const foreground = new Array(2500).fill(E);
function fg(x, y, t) { foreground[y * 50 + x] = t; }

// Top border canopies (row 0)
fg(1,  0, CAN_GL); fg(2,  0, CAN_GR);
fg(7,  0, CAN_AL); fg(8,  0, CAN_AR);
fg(14, 0, CAN_GL); fg(15, 0, CAN_GR);
fg(21, 0, CAN_AL); fg(22, 0, CAN_AR);
fg(28, 0, CAN_GL); fg(29, 0, CAN_GR);
fg(35, 0, CAN_AL); fg(36, 0, CAN_AR);
fg(42, 0, CAN_GL); fg(43, 0, CAN_GR);
fg(47, 0, CAN_AL); fg(48, 0, CAN_AR);
fg(4,  1, CAN_GL); fg(5,  1, CAN_GR);
fg(11, 1, CAN_AL); fg(12, 1, CAN_AR);
fg(18, 1, CAN_GL); fg(19, 1, CAN_GR);
fg(25, 1, CAN_AL); fg(26, 1, CAN_AR);
fg(32, 1, CAN_GL); fg(33, 1, CAN_GR);
fg(39, 1, CAN_AL); fg(40, 1, CAN_AR);
fg(45, 1, CAN_GL); fg(46, 1, CAN_GR);
// NW/NE groves
fg(0,  4, CAN_GL); fg(1,  4, CAN_GR);
fg(3,  6, CAN_AL); fg(4,  6, CAN_AR);
fg(46, 4, CAN_GL); fg(47, 4, CAN_GR);
fg(48, 6, CAN_AL); fg(49, 6, CAN_AR);
// West edge canopies
fg(0,  8,  CAN_GL); fg(1,  8,  CAN_GR);
fg(2,  11, CAN_AL); fg(3,  11, CAN_AR);
fg(0,  14, CAN_GL); fg(1,  14, CAN_GR);
fg(2,  18, CAN_AL); fg(3,  18, CAN_AR);
fg(0,  21, CAN_GL); fg(1,  21, CAN_GR);
// East edge canopies
fg(47, 8,  CAN_AL); fg(48, 8,  CAN_AR);
fg(48, 12, CAN_GL); fg(49, 12, CAN_GR);
fg(47, 16, CAN_AL); fg(48, 16, CAN_AR);
fg(48, 20, CAN_GL); fg(49, 20, CAN_GR);
fg(47, 26, CAN_AL); fg(48, 26, CAN_AR);
fg(48, 29, CAN_GL); fg(49, 29, CAN_GR);
fg(47, 32, CAN_AL); fg(48, 32, CAN_AR);
fg(48, 35, CAN_GL); fg(49, 35, CAN_GR);
// Clearing border canopies
fg(12, 14, CAN_GL); fg(13, 14, CAN_GR);
fg(16, 13, CAN_AL); fg(17, 13, CAN_AR);
fg(32, 14, CAN_GL); fg(33, 14, CAN_GR);
fg(35, 13, CAN_AL); fg(36, 13, CAN_AR);
fg(12, 29, CAN_GL); fg(13, 29, CAN_GR);
fg(16, 29, CAN_AL); fg(17, 29, CAN_AR);
fg(32, 29, CAN_GL); fg(33, 29, CAN_GR);
fg(35, 29, CAN_AL); fg(36, 29, CAN_AR);
// South meadow canopies
fg(2,  32, CAN_GL); fg(3,  32, CAN_GR);
fg(6,  34, CAN_AL); fg(7,  34, CAN_AR);
fg(15, 33, CAN_GL); fg(16, 33, CAN_GR);
fg(24, 32, CAN_AL); fg(25, 32, CAN_AR);
fg(33, 34, CAN_GL); fg(34, 34, CAN_GR);
fg(40, 33, CAN_AL); fg(41, 33, CAN_AR);
fg(10, 37, CAN_GL); fg(11, 37, CAN_GR);
fg(28, 38, CAN_AL); fg(29, 38, CAN_AR);
// South border canopies (rows 44/46/48)
fg(0,  44, CAN_GL); fg(1,  44, CAN_GR);
fg(4,  44, CAN_AL); fg(5,  44, CAN_AR);
fg(8,  44, CAN_GL); fg(9,  44, CAN_GR);
fg(12, 44, CAN_AL); fg(13, 44, CAN_AR);
fg(16, 44, CAN_GL); fg(17, 44, CAN_GR);
fg(20, 44, CAN_AL); fg(21, 44, CAN_AR);
fg(24, 44, CAN_GL); fg(25, 44, CAN_GR);
fg(28, 44, CAN_AL); fg(29, 44, CAN_AR);
fg(32, 44, CAN_GL); fg(33, 44, CAN_GR);
fg(36, 44, CAN_AL); fg(37, 44, CAN_AR);
fg(40, 44, CAN_GL); fg(41, 44, CAN_GR);
fg(44, 44, CAN_AL); fg(45, 44, CAN_AR);
fg(48, 44, CAN_GL); fg(49, 44, CAN_GR);
fg(2,  46, CAN_GL); fg(3,  46, CAN_GR);
fg(6,  46, CAN_AL); fg(7,  46, CAN_AR);
fg(10, 46, CAN_GL); fg(11, 46, CAN_GR);
fg(14, 46, CAN_AL); fg(15, 46, CAN_AR);
fg(18, 46, CAN_GL); fg(19, 46, CAN_GR);
fg(22, 46, CAN_AL); fg(23, 46, CAN_AR);
fg(26, 46, CAN_GL); fg(27, 46, CAN_GR);
fg(30, 46, CAN_AL); fg(31, 46, CAN_AR);
fg(34, 46, CAN_GL); fg(35, 46, CAN_GR);
fg(38, 46, CAN_AL); fg(39, 46, CAN_AR);
fg(42, 46, CAN_GL); fg(43, 46, CAN_GR);
fg(46, 46, CAN_AL); fg(47, 46, CAN_AR);
fg(0,  48, CAN_GL); fg(1,  48, CAN_GR);
fg(4,  48, CAN_AL); fg(5,  48, CAN_AR);
fg(8,  48, CAN_GL); fg(9,  48, CAN_GR);
fg(12, 48, CAN_AL); fg(13, 48, CAN_AR);
fg(16, 48, CAN_GL); fg(17, 48, CAN_GR);
fg(20, 48, CAN_AL); fg(21, 48, CAN_AR);
fg(24, 48, CAN_GL); fg(25, 48, CAN_GR);
fg(28, 48, CAN_AL); fg(29, 48, CAN_AR);
fg(32, 48, CAN_GL); fg(33, 48, CAN_GR);
fg(36, 48, CAN_AL); fg(37, 48, CAN_AR);
fg(40, 48, CAN_GL); fg(41, 48, CAN_GR);
fg(44, 48, CAN_AL); fg(45, 48, CAN_AR);
fg(48, 48, CAN_GL); fg(49, 48, CAN_GR);

// ── NPCs ──────────────────────────────────────────────────────────────────
const npcs = [
  {
    id: 'daisy',
    name: 'Daisy',
    sprite: 'fairy',
    x: 25,
    y: 24,
    wanderRadius: 5,
    dialogueId: 'daisy-greeting',
    ambientLines: ['voice_daisy_giggle_01'],
    sillyBehavior: 'sparkle-hiccup',
    questGiver: ['daisy-rainbow-seeds'],
  },
];

// ── World Objects ─────────────────────────────────────────────────────────
const worldObjects = [
  // Rainbow fountain (well stand-in) — tappable
  { type: 'FOUNTAIN',     x: 24, y: 21, id: 'rainbow-fountain' },

  // Return portal in clearing south
  { type: 'RETURN_PORTAL', x: 24, y: 26, id: 'rainbow-garden-portal' },

  // Quest item spawn — rainbow seed hidden in the garden
  { type: 'RAINBOW_SEED', x: 22, y: 20, id: 'rainbow-seed' },

  // Planted seed spot (OBSERVE target)
  { type: 'PLANTED_SEED', x: 28, y: 23, id: 'planted-seed' },

  // Flowers north
  { type: 'FLOWER_BIG',   x: 8,  y: 6,  id: 'flower-n-01' },
  { type: 'FLOWER_BIG',   x: 18, y: 5,  id: 'flower-n-02' },
  { type: 'FLOWER_BIG',   x: 28, y: 6,  id: 'flower-n-03' },
  { type: 'FLOWER_BIG',   x: 40, y: 7,  id: 'flower-n-04' },
  { type: 'FLOWER_SMALL', x: 13, y: 9,  id: 'flower-n-05' },
  { type: 'FLOWER_SMALL', x: 34, y: 8,  id: 'flower-n-06' },
  { type: 'DANDELION',    x: 23, y: 10, id: 'dandelion-n-01' },

  // Flowers south
  { type: 'FLOWER_BIG',   x: 10, y: 32, id: 'flower-s-01' },
  { type: 'FLOWER_BIG',   x: 22, y: 33, id: 'flower-s-02' },
  { type: 'FLOWER_BIG',   x: 36, y: 32, id: 'flower-s-03' },
  { type: 'FLOWER_SMALL', x: 16, y: 36, id: 'flower-s-04' },
  { type: 'DANDELION',    x: 30, y: 35, id: 'dandelion-s-01' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────
const animals = [
  { type: 'BUTTERFLY', x: 15, y: 6,  spriteName: 'butterfly', zone: { x: 8,  y: 4,  w: 16, h: 8 } },
  { type: 'BUTTERFLY', x: 30, y: 7,  spriteName: 'butterfly', zone: { x: 22, y: 4,  w: 16, h: 8 } },
  { type: 'BUTTERFLY', x: 22, y: 21, spriteName: 'butterfly', zone: { x: 19, y: 17, w: 12, h: 12 } },
  { type: 'BUTTERFLY', x: 28, y: 19, spriteName: 'butterfly', zone: { x: 19, y: 17, w: 12, h: 12 } },
  { type: 'BUTTERFLY', x: 8,  y: 32, spriteName: 'butterfly', zone: { x: 4,  y: 29, w: 14, h: 10 } },
  { type: 'BUTTERFLY', x: 38, y: 33, spriteName: 'butterfly', zone: { x: 30, y: 29, w: 16, h: 10 } },
  { type: 'BIRD',      x: 6,  y: 4,  spriteName: 'bird',      zone: { x: 0,  y: 3,  w: 14, h: 6 } },
  { type: 'BIRD',      x: 42, y: 4,  spriteName: 'bird',      zone: { x: 36, y: 3,  w: 14, h: 6 } },
  { type: 'BUNNY',     x: 20, y: 27, spriteName: 'bunny',     zone: { x: 15, y: 22, w: 12, h: 8 } },
  { type: 'BEE',       x: 25, y: 17, spriteName: 'bee',       zone: { x: 19, y: 15, w: 12, h: 8 } },
];

// ── Quests ─────────────────────────────────────────────────────────────────
const quests = [
  {
    id: 'daisy-rainbow-seeds',
    name: "Daisy's Rainbow Seeds",
    value: 'patience',
    heartReward: 5,
    giverNpcId: 'daisy',
    storyAct: 2,
    difficulty: 'mid',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'daisy',
        dialogueId: 'daisy-seeds-start',
        companionReminder: 'Daisy looks excited! Let\'s see what she found!',
      },
      {
        type: 'PICKUP',
        targetId: 'rainbow-seed',
        itemId: 'rainbow-seed',
        dialogueId: null,
        companionReminder: 'The rainbow seed is hiding in the garden!',
      },
      {
        type: 'OBSERVE',
        targetId: 'planted-seed',
        dialogueId: 'daisy-seeds-grow',
        companionReminder: 'Let\'s watch the seed grow! Let\'s wait together!',
      },
    ],
  },
];

// ── Dialogues ──────────────────────────────────────────────────────────────
const dialogues = {
  'daisy-greeting': {
    lines: [
      { speaker: 'Daisy', text: 'Oh! Oh! A visitor! *giggles* I love visitors!', voice: 'voice_daisy_giggle_01' },
      { speaker: 'Daisy', text: 'Welcome to Rainbow Garden! Isn\'t it beautiful? I made it beautiful!' },
    ],
  },
  'daisy-seeds-start': {
    lines: [
      { speaker: 'Daisy', text: 'Ohhhh! I have the most magical rainbow seed, but I lost it!' },
      { speaker: 'Daisy', text: 'It glows all the colors at once! Can you find it for me? Pleeeease?' },
    ],
  },
  'daisy-seeds-grow': {
    lines: [
      { speaker: 'Daisy', text: 'You found it! You\'re the best! *sparkle hiccup* Oops!' },
      { speaker: 'Daisy', text: 'Watch... watch watch watch... the seed needs patience...' },
      { speaker: 'Daisy', text: 'There! A rainbow flower! We grew it TOGETHER!' },
    ],
  },
};

// ── Level Transitions ──────────────────────────────────────────────────────
// WEST exit: player returns to blossom-bridge east edge (tiles 18-21)
const transitions = [
  {
    edge: 'west',
    tileStart: 23,
    tileEnd: 26,
    targetLevel: 'blossom-bridge',
    targetSpawnX: 37,
    targetSpawnY: 19,
    transition: { type: 'iris', duration: 700 },
    marker: 'rainbow-arch',
  },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'rainbow-garden',
  name: 'Rainbow Garden',
  width: 50,
  height: 50,
  tileSize: 16,

  spawnX: 2,
  spawnY: 24,

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
