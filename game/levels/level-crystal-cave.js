/**
 * level-crystal-cave.js — Crystal Cave for Princess Sparkle V2
 *
 * 50x50 tile grid (800x800 pixels — camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Biome: mountain — rocky, rugged, final destination.
 * Role: destination — culmination of Act 3 adventure.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — CRYSTAL CAVE (50 wide x 50 tall)              ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Rows 0-2:   Dense pine tree border — NORTH wall           ║
 * ║  Rows 3-7:   Rocky mountain terrain, crystal formations    ║
 * ║  Rows 5-8:   CAVE ENTRANCE landmark (cols 21-28) — north   ║
 * ║  Rows 8-19:  Wooded approach from south, path leads north  ║
 * ║  Rows 20-30: CENTRAL CLEARING 10x10 (cols 20-30)          ║
 * ║              Return portal at clearing center (col 24, r25) ║
 * ║  Rows 20-30: Crystal formations east/west of clearing      ║
 * ║  Rows 31-44: Southern mountain approach, pine trees        ║
 * ║  Cols 23-26: N-S stone path, full height (rows 0-49)      ║
 * ║  Rows 45-49: SOUTH EXIT — connects to crystal-path north   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * GROUND MIX (mountain biome):
 *   tile 1  (plain green) = 35%
 *   tile 2  (flowers)     = 15%
 *   tile 44 (stone/gray)  = 25%
 *   tile 45 (brown dirt)  = 20%
 *   tile 43 (dark dirt)   =  5%
 *
 * CONNECTIONS:
 *   SOUTH edge, cols 23-26 → crystal-path NORTH edge (tiles 23-26)
 *
 * SPAWN: col 24, row 47 (near south entrance, player walks north into cave)
 *
 * DESIGN: Mysterious, grand, final area. The culmination of the adventure.
 * Crystal cave mouth in the north section. Glowing clearing in center.
 * Dense pines form natural walls. Crystal pillar clusters flank the path.
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
const GR  = 1;    // plain green grass (35%)
const GR2 = 2;    // grass with flowers (15% — sparse in mountains)
const ST  = 44;   // stone/gray ground (25%) — also mountain path center
const DT  = 45;   // brown dirt ground (20%)
const DDT = 43;   // dark dirt (5%)
const MPL = 39;   // mountain path left edge
const MPC = 44;   // mountain path center = stone (rocky mountain path)
const MPR = 41;   // mountain path right edge
const E   = -1;   // empty (objects/foreground layers)

// PINE TREES (mountain only — no autumn trees here)
const CAN_GL = 4;   // green canopy left
const CAN_GR = 5;   // green canopy right
const TB1 = 12;     // tree trunk left
const TB2 = 13;     // tree trunk right

// STONE WALLS — used for cave entrance & crystal formations
const SW_L  = 84;   // stone wall left edge
const SW_M  = 85;   // stone wall middle
const SW_D  = 86;   // stone wall door
const SW_W  = 87;   // stone wall window

// DECORATIONS
const BSH = 28;    // bush
const BBR = 29;    // berry bush
const LNT = 93;    // lantern

// ── GROUND LAYER (50x50 = 2500 tiles) ──────────────────────────────────────
// Mountain biome: 35% GR, 15% GR2, 25% ST, 20% DT, 5% DDT
// N-S path at cols 23-26, full height.
// Path: col 23 = MPL, col 24-25 = MPC, col 26 = MPR
// Clearing rows 20-30, cols 20-30: stone ground (ST dominant, feels ancient)

// prettier-ignore
const ground = grid([
  // Row 0: top border — pine line, path at cols 23-26
  [ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST ],
  // Row 1: rocky top
  [GR,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  DT,  GR,  ST,  DT,  GR,  GR2, ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  GR ],
  // Row 2: mountain top border
  [DT,  ST,  GR,  DT,  GR2, GR,  GR,  ST,  GR,  DT,  ST,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  ST,  GR,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  DT,  ST,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR ],
  // Row 3: cave approach — rocky
  [GR,  GR,  DT,  GR,  ST,  DT,  ST,  GR,  DT,  GR,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  GR,  DT,  ST,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  DT,  GR,  GR,  ST,  GR,  DT,  ST,  DT ],
  // Row 4: cave approach — stone heavy
  [ST,  DT,  ST,  GR,  DT,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, ST,  GR,  DT,  ST,  DT,  GR,  ST,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  ST,  DT,  ST,  GR,  DT,  ST ],
  // Row 5: cave entrance row — stone wall placed in objects layer at 21-28
  [GR,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR2, DT,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  ST,  GR,  ST,  MPL, MPC, MPC, MPR, ST,  GR,  ST,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  ST,  GR,  DT,  GR,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  GR ],
  // Row 6: cave entrance base
  [DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  DT ],
  // Row 7: just below cave entrance
  [GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  ST,  DT,  GR,  GR,  ST,  MPL, MPC, MPC, MPR, ST,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR,  DT,  ST,  GR,  GR,  DT,  GR ],
  // Row 8: mountain approach
  [ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  ST,  DT ],
  // Row 9: rocky
  [GR,  GR2, DT,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  ST,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  GR ],
  // Row 10: mountain meadow
  [DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  DT,  MPL, MPC, MPC, MPR, ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  DT,  GR,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST ],
  // Row 11: rocky
  [GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR2, DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  ST,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR2, DT,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR ],
  // Row 12: mountain
  [ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  MPL, MPC, MPC, MPR, DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT ],
  // Row 13: rocky
  [GR,  GR2, DT,  GR,  GR,  ST,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  DT,  GR,  DT,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR ],
  // Row 14: mountain approach
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  GR,  ST,  DT,  MPL, MPC, MPC, MPR, ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST ],
  // Row 15: open mountain
  [GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  GR,  DT,  GR,  GR,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR ],
  // Row 16: rocky
  [ST,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  DT,  GR,  MPL, MPC, MPC, MPR, DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR ],
  // Row 17: mountain meadow, crystal cluster zones
  [GR,  GR2, GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  DT,  GR,  GR,  GR,  DT,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT ],
  // Row 18: approach to clearing
  [DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT ],
  // Row 19: clearing threshold — stone pavement begins
  [GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  ST,  ST,  ST,  MPL, MPC, MPC, MPR, ST,  ST,  ST,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR ],
  // Row 20: CLEARING START — ancient stone ground
  [ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT ],
  // Row 21: clearing — center
  [GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  DT,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT ],
  // Row 22: clearing — center
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR ],
  // Row 23: clearing — center
  [GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR ],
  // Row 24: clearing — portal row
  [ST,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST ],
  // Row 25: clearing — PORTAL CENTER ROW
  [GR,  GR,  DT,  GR,  GR2, DT,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  ST,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR ],
  // Row 26: clearing — center
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR ],
  // Row 27: clearing — center
  [GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR ],
  // Row 28: clearing — center
  [ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST ],
  // Row 29: clearing — center
  [GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  DT,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT ],
  // Row 30: clearing END — transition back to rocky terrain
  [DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  ST,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT ],
  // Row 31: southern mountain terrain resumes
  [GR,  GR2, DT,  GR,  GR,  GR,  DT,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  DT,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT ],
  // Row 32: rocky south
  [ST,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  ST ],
  // Row 33: mountain
  [GR,  GR,  DT,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  DT,  GR,  GR ],
  // Row 34: rocky
  [DT,  ST,  GR,  DT,  ST,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT ],
  // Row 35: mountain meadow
  [GR,  GR2, DT,  GR,  GR,  GR,  DT,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, DT,  GR,  GR ],
  // Row 36: rocky south approach
  [ST,  DT,  ST,  DT,  GR,  ST,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  ST,  DT,  MPL, MPC, MPC, MPR, DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST ],
  // Row 37: mountain
  [GR,  GR,  DT,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  DT,  GR,  GR ],
  // Row 38: rocky
  [DT,  ST,  GR,  DT,  ST,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST ],
  // Row 39: mountain
  [GR,  GR2, DT,  GR,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT ],
  // Row 40: approaching south exit — more open
  [ST,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR ],
  // Row 41: open mountain south
  [GR,  GR,  DT,  GR,  GR2, DT,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, DT,  GR,  GR,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT ],
  // Row 42: rocky south
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR ],
  // Row 43: mountain
  [GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT ],
  // Row 44: approaching south exit — open
  [ST,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST ],
  // Row 45: south exit zone — open for player
  [GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR ],
  // Row 46: south exit
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  MPL, MPC, MPC, MPR, ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR ],
  // Row 47: spawn row — open near south path
  [GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR ],
  // Row 48: near south exit
  [ST,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR ],
  // Row 49: south border / exit row
  [GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR ],
]);

// ── OBJECTS LAYER (50x50 = 2500 tiles, -1 = empty) ──────────────────────────
// Layout:
//   - Pine tree border: dense 3-tile-depth ring around edges (rows 0-3, 46-49, cols 0-3, 46-49)
//   - Cave entrance: stone wall structure at rows 3-6, cols 20-29 (cave mouth in north section)
//   - Crystal formation pillars: SW_L/SW_M/SW_W clusters flanking the clearing
//   - Interior pine trees: scattered through approach zones
//   - NOTE: canopy always at row Y, trunk at row Y+1 (canopy ABOVE trunk per TILE-BUILDING-RULES.md)

const objects = new Array(2500).fill(E);
function place(layer, w, x, y, tile) { layer[y * w + x] = tile; }
const P = (x, y, t) => place(objects, 50, x, y, t);

// Helper: place a 2x2 pine tree (canopy row Y, trunk row Y+1)
function pine(x, y) {
  P(x,   y,   CAN_GL);
  P(x+1, y,   CAN_GR);
  P(x,   y+1, TB1);
  P(x+1, y+1, TB2);
}

// ── NORTH PINE BORDER (rows 1-3) — dense wall of pines ──
// Row 0 would put canopy at row -1, so first trunks start at row 1 (canopy at row 0).
// Left sector (cols 0-21)
pine(0,  0); pine(3,  0); pine(6,  0); pine(9,  0); pine(12, 0); pine(15, 0); pine(18, 0);
// Right sector (cols 27-49)
pine(27, 0); pine(30, 0); pine(33, 0); pine(36, 0); pine(39, 0); pine(42, 0); pine(45, 0); pine(48, 0);

// Second row of north pines (offset stagger, canopy row 2, trunks row 3)
pine(1,  2); pine(4,  2); pine(7,  2); pine(10, 2); pine(13, 2); pine(16, 2); pine(19, 2);
pine(28, 2); pine(31, 2); pine(34, 2); pine(37, 2); pine(40, 2); pine(43, 2); pine(46, 2);

// Third row of north pines — slightly sparser (canopy row 4, trunks row 5)
pine(0,  4); pine(5,  4); pine(9,  4); pine(14, 4); pine(17, 4);
pine(32, 4); pine(36, 4); pine(40, 4); pine(44, 4); pine(47, 4);

// ── CAVE ENTRANCE (rows 3-6, cols 20-29) ──
// Stone wall arch structure — the glowing cave mouth
// Roof layer: row 3 cols 20-29 (stone wall tops)
P(20, 3, SW_L); P(21, 3, SW_M); P(22, 3, SW_M); P(23, 3, SW_M);
                                                                  P(26, 3, SW_M); P(27, 3, SW_M); P(28, 3, SW_M); P(29, 3, SW_L);
// Left pillar: rows 4-6 col 20-21
P(20, 4, SW_L); P(21, 4, SW_W);
P(20, 5, SW_L); P(21, 5, SW_W);
P(20, 6, SW_L); P(21, 6, SW_M);
// Right pillar: rows 4-6 cols 28-29
P(28, 4, SW_W); P(29, 4, SW_L);
P(28, 5, SW_W); P(29, 5, SW_L);
P(28, 6, SW_M); P(29, 6, SW_L);
// Cave floor arch decoration: row 6, between pillars
P(22, 6, SW_M); P(23, 6, SW_D); P(24, 6, SW_D); P(25, 6, SW_D); P(26, 6, SW_D); P(27, 6, SW_M);

// ── CRYSTAL FORMATION PILLARS (flanking the clearing) ──
// West crystal cluster — cols 14-16, rows 19-23 (left of clearing)
P(14, 19, SW_M);  P(15, 19, SW_W);
P(14, 20, SW_L);  P(15, 20, SW_M);
P(13, 22, SW_M);  P(14, 22, SW_W);
P(16, 21, SW_M);  P(17, 21, SW_W);

// East crystal cluster — cols 33-36, rows 19-23 (right of clearing)
P(33, 19, SW_W);  P(34, 19, SW_M);
P(34, 20, SW_M);  P(35, 20, SW_L);
P(33, 22, SW_W);  P(34, 22, SW_M);
P(32, 21, SW_W);  P(33, 21, SW_M);

// North crystal pillars — rows 8-12, flanking path approach
P(10, 8,  SW_M);  P(11, 8,  SW_W);
P(10, 9,  SW_L);  P(11, 9,  SW_M);
P(38, 8,  SW_W);  P(39, 8,  SW_M);
P(38, 9,  SW_M);  P(39, 9,  SW_L);

// Solitary crystal pillars — scattered for atmosphere
P(5,  14, SW_M);
P(7,  17, SW_W);
P(42, 14, SW_M);
P(44, 17, SW_W);
P(16, 32, SW_M);
P(33, 32, SW_W);

// ── WEST PINE BORDER (cols 0-3) — tree wall flanking left edge ──
// Staggered vertically through map (skipping clearing rows 20-30)
pine(0,  6);  pine(0,  9);  pine(1,  12); pine(0,  15); pine(1,  17);
// Resume below clearing
pine(0,  31); pine(1,  34); pine(0,  37); pine(1,  40); pine(0,  43);

// ── EAST PINE BORDER (cols 47-49) — tree wall flanking right edge ──
pine(47, 6);  pine(47, 9);  pine(47, 12); pine(47, 15); pine(47, 17);
pine(47, 31); pine(47, 34); pine(47, 37); pine(47, 40); pine(47, 43);

// ── INTERIOR PINES — mountain approach feel (mid-map, not in clearing) ──
// NW interior cluster
pine(5,  7);  pine(8,  9);  pine(3,  11); pine(6,  13); pine(2,  16);
// NE interior cluster
pine(42, 7);  pine(39, 9);  pine(44, 11); pine(41, 13); pine(45, 16);
// SW interior cluster
pine(4,  33); pine(7,  36); pine(2,  39); pine(5,  42); pine(8,  45);
// SE interior cluster
pine(43, 33); pine(40, 36); pine(45, 39); pine(42, 42); pine(46, 45);
// Mid-south approach (cols away from path)
pine(10, 35); pine(15, 38); pine(35, 35); pine(38, 38);

// ── SOUTH PINE BORDER (rows 46-49) — sparse, keeps exit open ──
// Left of exit (cols 0-20)
pine(0,  47); pine(3,  47); pine(6,  47); pine(9,  47); pine(13, 47); pine(17, 47); pine(20, 47);
// Right of exit (cols 27-49)
pine(27, 47); pine(30, 47); pine(34, 47); pine(38, 47); pine(41, 47); pine(44, 47); pine(47, 47);

// ── DECORATIONS — lanterns near cave entrance ──
P(22, 7, LNT);
P(27, 7, LNT);
// Bushes near clearing edges
P(19, 25, BSH);
P(31, 25, BSH);
P(19, 22, BBR);
P(31, 28, BBR);
// Berry bush clusters near south entry
P(18, 40, BBR);
P(30, 40, BSH);
P(12, 44, BSH);
P(37, 44, BBR);

// ── FOREGROUND LAYER (50x50 = 2500 tiles) ──────────────────────────────────
// Tree canopies drawn OVER the player for depth. Canopy is ALWAYS one row ABOVE the trunk.

const foreground = new Array(2500).fill(E);
const FG = (x, y, t) => place(foreground, 50, x, y, t);

// Helper: place canopy in foreground (canopy at row Y, trunk at row Y+1 in objects)
function fgCanopy(x, y) {
  FG(x,   y, CAN_GL);
  FG(x+1, y, CAN_GR);
}

// North border canopies (match pine() calls above — canopies go in foreground)
// Row 0 canopies (for trunks at row 1)
fgCanopy(0,  0); fgCanopy(3,  0); fgCanopy(6,  0); fgCanopy(9,  0); fgCanopy(12, 0); fgCanopy(15, 0); fgCanopy(18, 0);
fgCanopy(27, 0); fgCanopy(30, 0); fgCanopy(33, 0); fgCanopy(36, 0); fgCanopy(39, 0); fgCanopy(42, 0); fgCanopy(45, 0); fgCanopy(48, 0);

// Row 2 canopies (for trunks at row 3)
fgCanopy(1,  2); fgCanopy(4,  2); fgCanopy(7,  2); fgCanopy(10, 2); fgCanopy(13, 2); fgCanopy(16, 2); fgCanopy(19, 2);
fgCanopy(28, 2); fgCanopy(31, 2); fgCanopy(34, 2); fgCanopy(37, 2); fgCanopy(40, 2); fgCanopy(43, 2); fgCanopy(46, 2);

// Row 4 canopies (for trunks at row 5)
fgCanopy(0,  4); fgCanopy(5,  4); fgCanopy(9,  4); fgCanopy(14, 4); fgCanopy(17, 4);
fgCanopy(32, 4); fgCanopy(36, 4); fgCanopy(40, 4); fgCanopy(44, 4); fgCanopy(47, 4);

// West border canopies
fgCanopy(0,  6);  fgCanopy(0,  9);  fgCanopy(1,  12); fgCanopy(0,  15); fgCanopy(1,  17);
fgCanopy(0,  31); fgCanopy(1,  34); fgCanopy(0,  37); fgCanopy(1,  40); fgCanopy(0,  43);

// East border canopies
fgCanopy(47, 6);  fgCanopy(47, 9);  fgCanopy(47, 12); fgCanopy(47, 15); fgCanopy(47, 17);
fgCanopy(47, 31); fgCanopy(47, 34); fgCanopy(47, 37); fgCanopy(47, 40); fgCanopy(47, 43);

// NW interior canopies
fgCanopy(5,  7);  fgCanopy(8,  9);  fgCanopy(3,  11); fgCanopy(6,  13); fgCanopy(2,  16);
// NE interior canopies
fgCanopy(42, 7);  fgCanopy(39, 9);  fgCanopy(44, 11); fgCanopy(41, 13); fgCanopy(45, 16);
// SW interior canopies
fgCanopy(4,  33); fgCanopy(7,  36); fgCanopy(2,  39); fgCanopy(5,  42); fgCanopy(8,  45);
// SE interior canopies
fgCanopy(43, 33); fgCanopy(40, 36); fgCanopy(45, 39); fgCanopy(42, 42); fgCanopy(46, 45);
// Mid-south canopies
fgCanopy(10, 35); fgCanopy(15, 38); fgCanopy(35, 35); fgCanopy(38, 38);

// South border canopies (for trunks at row 48)
fgCanopy(0,  47); fgCanopy(3,  47); fgCanopy(6,  47); fgCanopy(9,  47); fgCanopy(13, 47); fgCanopy(17, 47); fgCanopy(20, 47);
fgCanopy(27, 47); fgCanopy(30, 47); fgCanopy(34, 47); fgCanopy(38, 47); fgCanopy(41, 47); fgCanopy(44, 47); fgCanopy(47, 47);

// ── COLLISION LAYER (50x50 = 2500 tiles, 0=walkable, 1=blocked) ─────────────
// Blocked: tree trunks, stone wall segments, crystal formation pillars
// Walkable: all ground, path, clearing center, cave door tiles (SW_D)
// NOTE: door tile cells (SW_D) in the cave entrance remain walkable (collision=0)

const collision = new Array(2500).fill(0);
const BLK = (x, y) => { collision[y * 50 + x] = 1; };

// ── Block tree trunks (all pine trunk rows from objects layer) ──
// Trunks are at the Y+1 row from each pine() call above:
// North border — trunks at row 1
[0,3,6,9,12,15,18,27,30,33,36,39,42,45,48].forEach(x => { BLK(x,1); BLK(x+1,1); });
// North border — trunks at row 3
[1,4,7,10,13,16,19,28,31,34,37,40,43,46].forEach(x => { BLK(x,3); BLK(x+1,3); });
// North border — trunks at row 5
[0,5,9,14,17,32,36,40,44,47].forEach(x => { BLK(x,5); BLK(x+1,5); });

// West border trunks
[[0,7],[0,10],[1,13],[0,16],[1,18],[0,32],[1,35],[0,38],[1,41],[0,44]].forEach(([x,y]) => { BLK(x,y); BLK(x+1,y); });
// East border trunks
[[47,7],[47,10],[47,13],[47,16],[47,18],[47,32],[47,35],[47,38],[47,41],[47,44]].forEach(([x,y]) => { BLK(x,y); BLK(x+1,y); });

// NW interior trunks
[[5,8],[8,10],[3,12],[6,14],[2,17]].forEach(([x,y]) => { BLK(x,y); BLK(x+1,y); });
// NE interior trunks
[[42,8],[39,10],[44,12],[41,14],[45,17]].forEach(([x,y]) => { BLK(x,y); BLK(x+1,y); });
// SW interior trunks
[[4,34],[7,37],[2,40],[5,43],[8,46]].forEach(([x,y]) => { BLK(x,y); BLK(x+1,y); });
// SE interior trunks
[[43,34],[40,37],[45,40],[42,43],[46,46]].forEach(([x,y]) => { BLK(x,y); BLK(x+1,y); });
// Mid-south trunks
[[10,36],[15,39],[35,36],[38,39]].forEach(([x,y]) => { BLK(x,y); BLK(x+1,y); });

// South border trunks (at row 48)
[0,3,6,9,13,17,20,27,30,34,38,41,44,47].forEach(x => { BLK(x,48); BLK(x+1,48); });

// ── Block cave entrance stone walls (NOT the door tiles — those stay walkable) ──
// Row 3 cave roof
[20,21,22,23,26,27,28,29].forEach(x => BLK(x,3));
// Left pillar rows 4-6
[[20,4],[21,4],[20,5],[21,5],[20,6],[21,6]].forEach(([x,y]) => BLK(x,y));
// Right pillar rows 4-6
[[28,4],[29,4],[28,5],[29,5],[28,6],[29,6]].forEach(([x,y]) => BLK(x,y));
// Cave arch floor row 6 — non-door segments blocked
[22,27].forEach(x => BLK(x,6));
// Door tiles at 23-26 row 6 are WALKABLE (collision=0) — player walks through cave

// ── Block crystal formation pillars ──
// West cluster
[[14,19],[15,19],[14,20],[15,20],[13,22],[14,22],[16,21],[17,21]].forEach(([x,y]) => BLK(x,y));
// East cluster
[[33,19],[34,19],[34,20],[35,20],[33,22],[34,22],[32,21],[33,21]].forEach(([x,y]) => BLK(x,y));
// North pillars
[[10,8],[11,8],[10,9],[11,9],[38,8],[39,8],[38,9],[39,9]].forEach(([x,y]) => BLK(x,y));
// Solitary crystal pillars
[[5,14],[7,17],[42,14],[44,17],[16,32],[33,32]].forEach(([x,y]) => BLK(x,y));

// ── Bushes are walkable — no collision needed ──

// ── NPCs ──────────────────────────────────────────────────────────────────
// Act 3 — no named NPC yet. Crystal guardian placeholder for future Act 3 quests.
const npcs = [
  // Crystal Guardian — will be fleshed out in Act 3 quest design
  {
    id: 'crystal-guardian',
    name: 'Crystal Guardian',
    spriteName: 'guardian',
    x: 24,
    y: 18,
    homeX: 24,
    homeY: 18,
    dialogue: 'guardian-welcome',
    quests: [],
    roamZone: { x: 22, y: 16, w: 6, h: 6 },
  },
];

// ── World Objects ─────────────────────────────────────────────────────────
const worldObjects = [
  // RETURN PORTAL — center of clearing (col 24-25, row 24-25)
  { type: 'RETURN_PORTAL', x: 24, y: 24, id: 'crystal-cave-portal' },

  // Crystal cave landmark — tappable cave entrance
  { type: 'CRYSTAL_CAVERN', x: 24, y: 6,  id: 'crystal-cavern-entrance' },

  // Crystal formation landmarks — tappable decoration clusters
  { type: 'CRYSTAL_FORMATION', x: 14, y: 19, id: 'crystal-west-01' },
  { type: 'CRYSTAL_FORMATION', x: 34, y: 19, id: 'crystal-east-01' },
  { type: 'CRYSTAL_FORMATION', x: 10, y: 8,  id: 'crystal-north-01' },
  { type: 'CRYSTAL_FORMATION', x: 38, y: 8,  id: 'crystal-north-02' },

  // Flowers — sparse mountain variety
  { type: 'FLOWER_SMALL', x: 8,  y: 12, id: 'cave-flower-01' },
  { type: 'FLOWER_SMALL', x: 41, y: 12, id: 'cave-flower-02' },
  { type: 'FLOWER_SMALL', x: 6,  y: 28, id: 'cave-flower-03' },
  { type: 'FLOWER_SMALL', x: 43, y: 28, id: 'cave-flower-04' },
  { type: 'FLOWER_SMALL', x: 14, y: 36, id: 'cave-flower-05' },
  { type: 'FLOWER_SMALL', x: 35, y: 36, id: 'cave-flower-06' },
  { type: 'DANDELION',    x: 19, y: 16, id: 'cave-dandelion-01' },
  { type: 'DANDELION',    x: 30, y: 16, id: 'cave-dandelion-02' },
  { type: 'DANDELION',    x: 12, y: 42, id: 'cave-dandelion-03' },
  { type: 'DANDELION',    x: 37, y: 42, id: 'cave-dandelion-04' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────
const animals = [
  // Birds in northern pines
  { type: 'BIRD',      x: 6,  y: 2,  spriteName: 'bird',      zone: { x: 0,  y: 0,  w: 20, h: 8 } },
  { type: 'BIRD',      x: 40, y: 2,  spriteName: 'bird',      zone: { x: 28, y: 0,  w: 20, h: 8 } },
  { type: 'BIRD',      x: 3,  y: 10, spriteName: 'bird',      zone: { x: 0,  y: 7,  w: 12, h: 8 } },
  { type: 'BIRD',      x: 46, y: 10, spriteName: 'bird',      zone: { x: 38, y: 7,  w: 12, h: 8 } },

  // Birds in southern pines
  { type: 'BIRD',      x: 7,  y: 38, spriteName: 'bird',      zone: { x: 0,  y: 34, w: 18, h: 10 } },
  { type: 'BIRD',      x: 42, y: 38, spriteName: 'bird',      zone: { x: 30, y: 34, w: 18, h: 10 } },

  // Bunnies — rocky mountain bunnies
  { type: 'BUNNY',     x: 12, y: 15, spriteName: 'bunny',     zone: { x: 6,  y: 12, w: 10, h: 6 } },
  { type: 'BUNNY',     x: 38, y: 15, spriteName: 'bunny',     zone: { x: 34, y: 12, w: 10, h: 6 } },
  { type: 'BUNNY',     x: 16, y: 33, spriteName: 'bunny',     zone: { x: 12, y: 30, w: 8,  h: 6 } },

  // Butterfly — magical, near portal clearing
  { type: 'BUTTERFLY', x: 22, y: 22, spriteName: 'butterfly', zone: { x: 20, y: 20, w: 10, h: 10 } },
  { type: 'BUTTERFLY', x: 28, y: 27, spriteName: 'butterfly', zone: { x: 20, y: 20, w: 10, h: 10 } },
];

// ── Quests ─────────────────────────────────────────────────────────────────
const quests = [];

// ── Dialogues ──────────────────────────────────────────────────────────────
const dialogues = {
  'guardian-welcome': {
    id: 'guardian-welcome',
    npcId: 'crystal-guardian',
    stages: [
      {
        id: 'guardian-welcome-1',
        text: 'You made it to the Crystal Cave! This is the most magical place in all the Sparkle Kingdom.',
        voice: 'guardian-welcome-1',
        next: 'guardian-welcome-2',
      },
      {
        id: 'guardian-welcome-2',
        text: 'The crystals here glow with ancient magic. Touch the portal when you are ready to return home.',
        voice: 'guardian-welcome-2',
        next: null,
      },
    ],
  },
};

// ── Level Transitions ──────────────────────────────────────────────────────
// SOUTH exit: player returns to crystal-path (north edge, tiles 23-26)
// Connection: crystal-path NORTH edge → crystal-cave SOUTH edge (tiles 23-26)
const transitions = [
  {
    edge: 'south',
    tileStart: 23,
    tileEnd: 26,
    targetLevel: 'crystal-path',
    targetSpawnX: 24,
    targetSpawnY: 1,
    transition: { type: 'iris', duration: 700 },
    marker: 'cave-mouth',
  },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'crystal-cave',
  name: 'Crystal Cave',
  width: 50,
  height: 50,
  tileSize: 16,

  // Player spawn — near south entrance, faces north into the cave
  spawnX: 24,
  spawnY: 47,

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
