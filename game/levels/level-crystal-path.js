/**
 * level-crystal-path.js — Crystal Path for Princess Sparkle V2
 *
 * 40x40 tile grid (640x640 pixels — camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Biome: mountain — rocky, rugged, fewer flowers, pine trees only.
 * Role: path — north spoke connecting sparkle-village to crystal-cave.
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — CRYSTAL PATH (40 wide x 40 tall)          ║
 * ╠══════════════════════════════════════════════════════════╣
 * ║  Rows 0-3:   Open mountain meadow — NORTH EXIT here    ║
 * ║              N exit at cols 18-21, rows 0-3            ║
 * ║  Rows 4-14:  Northern mountain terrain, pine trees     ║
 * ║  Rows 11-14: Crystal-rock landmark (cols 20-21, r12)   ║
 * ║  Cols 18-21: N-S path spine runs rows 0-39             ║
 * ║  Rows 25-35: Rocky mountain terrain south              ║
 * ║  Rows 36-39: SOUTH EXIT — path connects to village     ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * GROUND MIX (mountain biome):
 *   tile 1 (plain green) = 35%
 *   tile 2 (flowers)     = 15%
 *   tile 44 (stone/gray) = 25%
 *   tile 45 (dirt/brown) = 20%
 *   tile 43 (dark dirt)  =  5%
 *
 * MOUNTAIN TILE ALIASES:
 *   44 = stone gray ground (rocky patches)
 *   45 = brown dirt ground
 *   43 = dark dirt ground
 *   44 used for path center instead of 40 (mountain path = stone)
 *
 * CONNECTIONS:
 *   SOUTH edge, cols 18-21 → sparkle-village NORTH edge (tiles 28-31)
 *   NORTH edge, cols 18-21 → crystal-cave SOUTH edge (tiles 23-26)
 *
 * SPAWN: col 19, row 37 (near south exit, player walks north)
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
const ST  = 44;   // stone/gray ground (25%)
const DT  = 45;   // brown dirt ground (20%)
const DDT = 43;   // dark dirt (5%)
const MPL = 39;   // mountain path left/top edge
const MPC = 44;   // mountain path center = stone (re-using ST for natural rocky path)
const MPR = 41;   // mountain path right/bottom edge
const E   = -1;

// NOTE: Mountain N-S path uses stone (44) as center — matches rocky terrain feel.
// Path edges still use 39/41 for visual clarity.

const CAN_GL = 4;   // green canopy left (pine only in mountains)
const CAN_GR = 5;   // green canopy right
const TB1 = 12;     // tree trunk left
const TB2 = 13;     // tree trunk right

const BSH = 28;    // bush
const BBR = 29;    // berry bush
const FBL = 19;    // flower bush (rare in mountains)
const LNT = 93;    // lantern
const CRT = 107;   // barrel/crate (used as crystal boulder stand-in cluster)

// ── GROUND LAYER (40x40 = 1600 tiles) ──────────────────────────────────────
// Mountain biome: 35% GR, 15% GR2, 25% ST, 20% DT, 5% DDT
// N-S path at cols 18-21, full height (rows 0-39).
// Path: col 18 = MPL (left edge), col 19-20 = MPC (stone center), col 21 = MPR (right edge)

// prettier-ignore
const ground = grid([
  // Row 0: north exit — path cols 18-21, mountain ground elsewhere
  [GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  MPL, MPC, MPC, MPR, ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR ],
  // Row 1: mountain terrain
  [ST,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  ST,  GR,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  MPL, MPC, MPC, MPR, GR,  DT,  ST,  GR,  DT,  GR,  GR2, ST,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  GR,  ST ],
  // Row 2: rocky mountain
  [GR,  DT,  ST,  GR2, ST,  GR,  ST,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  ST,  GR,  DT,  GR,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  ST,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  ST,  GR,  DT,  GR ],
  // Row 3: mountain approach
  [DT,  ST,  GR,  DT,  GR,  GR2, GR,  ST,  GR,  DT,  ST,  GR,  GR2, ST,  GR,  GR,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  GR,  DT,  GR2, GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  GR,  DT,  ST,  GR,  DT ],
  // Row 4: mountain meadow
  [GR,  GR,  DT,  GR,  ST,  GR,  DT,  GR2, GR,  ST,  GR,  DT,  GR,  GR,  GR2, ST,  GR,  DT,  MPL, MPC, MPC, MPR, GR,  GR,  DT,  GR,  ST,  GR,  GR,  DT,  GR2, GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR ],
  // Row 5: rocky terrain
  [ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST ],
  // Row 6: mountain
  [GR,  ST,  GR2, GR,  DT,  GR,  GR,  ST,  GR,  GR2, DT,  GR,  ST,  GR,  GR2, GR,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  ST,  GR,  GR2, DT,  GR,  ST,  GR,  GR2, DT,  GR,  ST,  GR,  GR,  DT,  GR,  GR ],
  // Row 7: rocky
  [DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  MPL, MPC, MPC, MPR, ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR ],
  // Row 8: mountain meadow
  [GR,  GR2, GR,  GR,  ST,  GR,  GR2, DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  ST,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  GR,  GR2, DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  GR2, ST,  GR,  GR,  DT,  GR ],
  // Row 9: rocky terrain
  [ST,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT ],
  // Row 10: mountain
  [GR,  GR,  DT,  GR,  GR2, DT,  GR,  ST,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  ST,  MPL, MPC, MPC, MPR, ST,  GR,  DT,  GR,  GR2, DT,  GR,  ST,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  ST ],
  // Row 11: crystal-rock landmark area
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  DT,  ST ],
  // Row 12: crystal-rock landmark (objects layer has barrels at 23-24, 11-12)
  [GR,  GR,  ST,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  GR ],
  // Row 13: rocky
  [ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST ],
  // Row 14: mountain meadow
  [GR,  GR2, DT,  GR,  ST,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR ],
  // Row 15: rocky
  [DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  MPL, MPC, MPC, MPR, ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST ],
  // Row 16: mountain
  [GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR2, DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  ST,  GR,  DT,  GR,  GR2, ST,  GR,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST ],
  // Row 17: rocky terrain
  [ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT ],
  // Row 18: open mountain meadow
  [GR,  GR2, DT,  GR,  GR,  ST,  GR,  DT,  GR2, GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  DT,  GR2, ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  GR ],
  // Row 19: rocky
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  MPL, MPC, MPC, MPR, ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR ],
  // Row 20: mountain
  [GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR ],
  // Row 21: rocky terrain
  [ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  MPL, MPC, MPC, MPR, DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  ST ],
  // Row 22: mountain meadow
  [GR,  GR2, GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR,  DT,  GR,  GR2, ST,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR2, GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR ],
  // Row 23: rocky
  [DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  ST,  GR,  DT,  GR,  DT,  ST,  MPL, MPC, MPC, MPR, ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  ST,  DT,  GR ],
  // Row 24: mountain
  [GR,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST ],
  // Row 25: rocky terrain south section
  [ST,  DT,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT ],
  // Row 26: mountain meadow
  [GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR2, DT,  GR,  GR,  DT,  GR2, DT,  GR,  GR,  DT ],
  // Row 27: rocky
  [DT,  ST,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR ],
  // Row 28: mountain
  [GR,  GR,  DT,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR ],
  // Row 29: rocky terrain
  [ST,  DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  MPL, MPC, MPC, MPR, ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST ],
  // Row 30: mountain meadow
  [GR,  GR2, GR,  GR,  DT,  GR,  GR2, DT,  GR,  GR2, DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR2, DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR ],
  // Row 31: rocky
  [DT,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  MPL, MPC, MPC, MPR, ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR ],
  // Row 32: mountain
  [GR,  GR,  ST,  GR,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR2, ST,  GR,  GR,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR ],
  // Row 33: rocky terrain approaching south
  [ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  MPL, MPC, MPC, MPR, DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST ],
  // Row 34: mountain south
  [GR,  GR2, DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  DT,  GR,  GR,  DT,  GR,  GR,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  GR,  DT,  GR,  GR2, DT,  GR,  DT,  GR,  GR,  DT,  GR2, GR,  DT,  GR,  GR ],
  // Row 35: rocky south
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR ],
  // Row 36: approaching south exit
  [GR,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  ST ],
  // Row 37: south exit zone
  [ST,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  MPL, MPC, MPC, MPR, GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  DT,  ST,  GR,  DT,  ST,  GR ],
  // Row 38: south exit
  [GR,  GR2, DT,  GR,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR,  GR2, ST,  GR,  DT,  GR,  GR,  MPL, MPC, MPC, MPR, GR,  GR,  DT,  GR,  ST,  GR,  DT,  GR,  GR,  DT,  GR2, ST,  GR,  DT,  GR,  GR,  DT,  GR ],
  // Row 39: bottom border / south exit
  [DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  ST,  GR,  DT,  GR,  ST,  DT,  GR,  ST,  MPL, MPC, MPC, MPR, ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR,  ST,  DT,  GR ],
]);

// ── OBJECTS LAYER (40x40 = 1600 tiles, -1 = empty) ──────────────────────────
// Pine trees only (CAN_GL/CAN_GR — no autumn trees in mountains).
// Crystal-rock landmark: barrels at rows 11-12, cols 23-24 (east of path).

const objects = new Array(1600).fill(E);
function place(layer, w, x, y, tile) { layer[y * w + x] = tile; }
const P40 = (x, y, t) => place(objects, 40, x, y, t);

// ── Dense pine corridor left of path (cols 0-15) ──
// NW corner pines
P40(0,  1, CAN_GL); P40(1,  1, CAN_GR);
P40(0,  2, TB1);    P40(1,  2, TB2);
P40(4,  1, CAN_GL); P40(5,  1, CAN_GR);
P40(4,  2, TB1);    P40(5,  2, TB2);
P40(8,  0, CAN_GL); P40(9,  0, CAN_GR);
P40(8,  1, TB1);    P40(9,  1, TB2);
P40(13, 1, CAN_GL); P40(14, 1, CAN_GR);
P40(13, 2, TB1);    P40(14, 2, TB2);

// West pine rows (scattered through map)
P40(0,  4, CAN_GL); P40(1,  4, CAN_GR);
P40(0,  5, TB1);    P40(1,  5, TB2);
P40(5,  5, CAN_GL); P40(6,  5, CAN_GR);
P40(5,  6, TB1);    P40(6,  6, TB2);
P40(2,  8, CAN_GL); P40(3,  8, CAN_GR);
P40(2,  9, TB1);    P40(3,  9, TB2);
P40(9,  7, CAN_GL); P40(10, 7, CAN_GR);
P40(9,  8, TB1);    P40(10, 8, TB2);
P40(0,  10, CAN_GL); P40(1, 10, CAN_GR);
P40(0,  11, TB1);   P40(1,  11, TB2);
P40(6,  11, CAN_GL); P40(7, 11, CAN_GR);
P40(6,  12, TB1);   P40(7,  12, TB2);
P40(12, 10, CAN_GL); P40(13, 10, CAN_GR);
P40(12, 11, TB1);   P40(13, 11, TB2);
P40(2,  14, CAN_GL); P40(3, 14, CAN_GR);
P40(2,  15, TB1);   P40(3,  15, TB2);
P40(8,  14, CAN_GL); P40(9, 14, CAN_GR);
P40(8,  15, TB1);   P40(9,  15, TB2);
P40(0,  17, CAN_GL); P40(1, 17, CAN_GR);
P40(0,  18, TB1);   P40(1,  18, TB2);
P40(5,  19, CAN_GL); P40(6, 19, CAN_GR);
P40(5,  20, TB1);   P40(6,  20, TB2);
P40(12, 18, CAN_GL); P40(13, 18, CAN_GR);
P40(12, 19, TB1);   P40(13, 19, TB2);
P40(2,  22, CAN_GL); P40(3, 22, CAN_GR);
P40(2,  23, TB1);   P40(3,  23, TB2);
P40(9,  21, CAN_GL); P40(10, 21, CAN_GR);
P40(9,  22, TB1);   P40(10, 22, TB2);
P40(0,  25, CAN_GL); P40(1, 25, CAN_GR);
P40(0,  26, TB1);   P40(1,  26, TB2);
P40(6,  26, CAN_GL); P40(7, 26, CAN_GR);
P40(6,  27, TB1);   P40(7,  27, TB2);
P40(13, 25, CAN_GL); P40(14, 25, CAN_GR);
P40(13, 26, TB1);   P40(14, 26, TB2);
P40(2,  29, CAN_GL); P40(3, 29, CAN_GR);
P40(2,  30, TB1);   P40(3,  30, TB2);
P40(8,  30, CAN_GL); P40(9, 30, CAN_GR);
P40(8,  31, TB1);   P40(9,  31, TB2);
P40(0,  33, CAN_GL); P40(1, 33, CAN_GR);
P40(0,  34, TB1);   P40(1,  34, TB2);
P40(5,  34, CAN_GL); P40(6, 34, CAN_GR);
P40(5,  35, TB1);   P40(6,  35, TB2);
P40(12, 33, CAN_GL); P40(13, 33, CAN_GR);
P40(12, 34, TB1);   P40(13, 34, TB2);

// ── Dense pine corridor right of path (cols 23-39) ──
P40(25, 1, CAN_GL); P40(26, 1, CAN_GR);
P40(25, 2, TB1);    P40(26, 2, TB2);
P40(30, 0, CAN_GL); P40(31, 0, CAN_GR);
P40(30, 1, TB1);    P40(31, 1, TB2);
P40(35, 1, CAN_GL); P40(36, 1, CAN_GR);
P40(35, 2, TB1);    P40(36, 2, TB2);
P40(39, 1, CAN_GL); // edge pine (col 39, paired left only)
P40(39, 2, TB1);

P40(24, 4, CAN_GL); P40(25, 4, CAN_GR);
P40(24, 5, TB1);    P40(25, 5, TB2);
P40(30, 5, CAN_GL); P40(31, 5, CAN_GR);
P40(30, 6, TB1);    P40(31, 6, TB2);
P40(36, 4, CAN_GL); P40(37, 4, CAN_GR);
P40(36, 5, TB1);    P40(37, 5, TB2);
P40(27, 7, CAN_GL); P40(28, 7, CAN_GR);
P40(27, 8, TB1);    P40(28, 8, TB2);
P40(34, 8, CAN_GL); P40(35, 8, CAN_GR);
P40(34, 9, TB1);    P40(35, 9, TB2);
P40(23, 10, CAN_GL); P40(24, 10, CAN_GR);
P40(23, 11, TB1);   P40(24, 11, TB2);
P40(29, 10, CAN_GL); P40(30, 10, CAN_GR);
P40(29, 11, TB1);   P40(30, 11, TB2);
P40(36, 11, CAN_GL); P40(37, 11, CAN_GR);
P40(36, 12, TB1);   P40(37, 12, TB2);
P40(25, 13, CAN_GL); P40(26, 13, CAN_GR);
P40(25, 14, TB1);   P40(26, 14, TB2);
P40(32, 14, CAN_GL); P40(33, 14, CAN_GR);
P40(32, 15, TB1);   P40(33, 15, TB2);
P40(24, 17, CAN_GL); P40(25, 17, CAN_GR);
P40(24, 18, TB1);   P40(25, 18, TB2);
P40(30, 18, CAN_GL); P40(31, 18, CAN_GR);
P40(30, 19, TB1);   P40(31, 19, TB2);
P40(37, 17, CAN_GL); P40(38, 17, CAN_GR);
P40(37, 18, TB1);   P40(38, 18, TB2);
P40(26, 21, CAN_GL); P40(27, 21, CAN_GR);
P40(26, 22, TB1);   P40(27, 22, TB2);
P40(33, 22, CAN_GL); P40(34, 22, CAN_GR);
P40(33, 23, TB1);   P40(34, 23, TB2);
P40(23, 25, CAN_GL); P40(24, 25, CAN_GR);
P40(23, 26, TB1);   P40(24, 26, TB2);
P40(29, 26, CAN_GL); P40(30, 26, CAN_GR);
P40(29, 27, TB1);   P40(30, 27, TB2);
P40(36, 25, CAN_GL); P40(37, 25, CAN_GR);
P40(36, 26, TB1);   P40(37, 26, TB2);
P40(25, 29, CAN_GL); P40(26, 29, CAN_GR);
P40(25, 30, TB1);   P40(26, 30, TB2);
P40(33, 29, CAN_GL); P40(34, 29, CAN_GR);
P40(33, 30, TB1);   P40(34, 30, TB2);
P40(23, 32, CAN_GL); P40(24, 32, CAN_GR);
P40(23, 33, TB1);   P40(24, 33, TB2);
P40(30, 33, CAN_GL); P40(31, 33, CAN_GR);
P40(30, 34, TB1);   P40(31, 34, TB2);
P40(37, 33, CAN_GL); P40(38, 33, CAN_GR);
P40(37, 34, TB1);   P40(38, 34, TB2);

// ── CRYSTAL ROCK LANDMARK — 2x2 barrel cluster east of path, rows 11-12 ──
// 4 barrels forming a sparkling crystal rock shape
P40(23, 11, CRT);
P40(24, 11, CRT);
P40(23, 12, CRT);
P40(24, 12, CRT);

// ── Sparse decorations ──
// Rocky bushes flanking path
P40(16, 9,  BSH); P40(22, 9,  BSH);
P40(15, 18, BSH); P40(23, 18, BSH);
P40(16, 28, FBL); P40(22, 28, BSH);
P40(15, 35, BSH); P40(23, 35, BSH);
// Berry bushes scattered
P40(7,  16, BBR); P40(32, 16, BBR);
P40(4,  27, BBR); P40(35, 27, BBR);
// Lanterns marking path milestones
P40(17, 15, LNT);
P40(17, 25, LNT);

// ── COLLISION LAYER ──────────────────────────────────────────────────────────
const collision = new Array(1600).fill(0);
function block(x, y) { collision[y * 40 + x] = 1; }

// Collect all tree trunk positions for blocking
const trunks = [
  // NW top area
  [0,2],[1,2],[4,2],[5,2],[8,1],[9,1],[13,2],[14,2],
  // West pines
  [0,5],[1,5],[5,6],[6,6],[2,9],[3,9],[9,8],[10,8],
  [0,11],[1,11],[6,12],[7,12],[12,11],[13,11],
  [2,15],[3,15],[8,15],[9,15],
  [0,18],[1,18],[5,20],[6,20],[12,19],[13,19],
  [2,23],[3,23],[9,22],[10,22],
  [0,26],[1,26],[6,27],[7,27],[13,26],[14,26],
  [2,30],[3,30],[8,31],[9,31],
  [0,34],[1,34],[5,35],[6,35],[12,34],[13,34],
  // East top area
  [25,2],[26,2],[30,1],[31,1],[35,2],[36,2],[39,2],
  // East pines
  [24,5],[25,5],[30,6],[31,6],[36,5],[37,5],
  [27,8],[28,8],[34,9],[35,9],
  [23,11],[24,11],[29,11],[30,11],[36,12],[37,12],
  [25,14],[26,14],[32,15],[33,15],
  [24,18],[25,18],[30,19],[31,19],[37,18],[38,18],
  [26,22],[27,22],[33,23],[34,23],
  [23,26],[24,26],[29,27],[30,27],[36,26],[37,26],
  [25,30],[26,30],[33,30],[34,30],
  [23,33],[24,33],[30,34],[31,34],[37,34],[38,34],
];
trunks.forEach(([x, y]) => block(x, y));

// Crystal rock blocks
block(23, 11); block(24, 11); block(23, 12); block(24, 12);

// Decoration blocks
const decorBlocks = [
  [16,9],[22,9],[15,18],[23,18],[16,28],[22,28],[15,35],[23,35],
  [7,16],[32,16],[4,27],[35,27],[17,15],[17,25],
];
decorBlocks.forEach(([x, y]) => block(x, y));

// N-S path cols 18-21 always walkable (entire height)
for (let y = 0; y < 40; y++) {
  collision[y * 40 + 18] = 0;
  collision[y * 40 + 19] = 0;
  collision[y * 40 + 20] = 0;
  collision[y * 40 + 21] = 0;
}

// ── FOREGROUND LAYER (40x40 = 1600 tiles, -1 = empty) ──────────────────────
const foreground = new Array(1600).fill(E);
function fg(x, y, t) { foreground[y * 40 + x] = t; }

// NW top canopies
fg(0,  1, CAN_GL); fg(1,  1, CAN_GR);
fg(4,  1, CAN_GL); fg(5,  1, CAN_GR);
fg(8,  0, CAN_GL); fg(9,  0, CAN_GR);
fg(13, 1, CAN_GL); fg(14, 1, CAN_GR);
// West pines canopies
fg(0,  4, CAN_GL); fg(1,  4, CAN_GR);
fg(5,  5, CAN_GL); fg(6,  5, CAN_GR);
fg(2,  8, CAN_GL); fg(3,  8, CAN_GR);
fg(9,  7, CAN_GL); fg(10, 7, CAN_GR);
fg(0,  10, CAN_GL); fg(1,  10, CAN_GR);
fg(6,  11, CAN_GL); fg(7,  11, CAN_GR);
fg(12, 10, CAN_GL); fg(13, 10, CAN_GR);
fg(2,  14, CAN_GL); fg(3,  14, CAN_GR);
fg(8,  14, CAN_GL); fg(9,  14, CAN_GR);
fg(0,  17, CAN_GL); fg(1,  17, CAN_GR);
fg(5,  19, CAN_GL); fg(6,  19, CAN_GR);
fg(12, 18, CAN_GL); fg(13, 18, CAN_GR);
fg(2,  22, CAN_GL); fg(3,  22, CAN_GR);
fg(9,  21, CAN_GL); fg(10, 21, CAN_GR);
fg(0,  25, CAN_GL); fg(1,  25, CAN_GR);
fg(6,  26, CAN_GL); fg(7,  26, CAN_GR);
fg(13, 25, CAN_GL); fg(14, 25, CAN_GR);
fg(2,  29, CAN_GL); fg(3,  29, CAN_GR);
fg(8,  30, CAN_GL); fg(9,  30, CAN_GR);
fg(0,  33, CAN_GL); fg(1,  33, CAN_GR);
fg(5,  34, CAN_GL); fg(6,  34, CAN_GR);
fg(12, 33, CAN_GL); fg(13, 33, CAN_GR);
// East top canopies
fg(25, 1, CAN_GL); fg(26, 1, CAN_GR);
fg(30, 0, CAN_GL); fg(31, 0, CAN_GR);
fg(35, 1, CAN_GL); fg(36, 1, CAN_GR);
// East pines canopies
fg(24, 4, CAN_GL); fg(25, 4, CAN_GR);
fg(30, 5, CAN_GL); fg(31, 5, CAN_GR);
fg(36, 4, CAN_GL); fg(37, 4, CAN_GR);
fg(27, 7, CAN_GL); fg(28, 7, CAN_GR);
fg(34, 8, CAN_GL); fg(35, 8, CAN_GR);
fg(23, 10, CAN_GL); fg(24, 10, CAN_GR);
fg(29, 10, CAN_GL); fg(30, 10, CAN_GR);
fg(36, 11, CAN_GL); fg(37, 11, CAN_GR);
fg(25, 13, CAN_GL); fg(26, 13, CAN_GR);
fg(32, 14, CAN_GL); fg(33, 14, CAN_GR);
fg(24, 17, CAN_GL); fg(25, 17, CAN_GR);
fg(30, 18, CAN_GL); fg(31, 18, CAN_GR);
fg(37, 17, CAN_GL); fg(38, 17, CAN_GR);
fg(26, 21, CAN_GL); fg(27, 21, CAN_GR);
fg(33, 22, CAN_GL); fg(34, 22, CAN_GR);
fg(23, 25, CAN_GL); fg(24, 25, CAN_GR);
fg(29, 26, CAN_GL); fg(30, 26, CAN_GR);
fg(36, 25, CAN_GL); fg(37, 25, CAN_GR);
fg(25, 29, CAN_GL); fg(26, 29, CAN_GR);
fg(33, 29, CAN_GL); fg(34, 29, CAN_GR);
fg(23, 32, CAN_GL); fg(24, 32, CAN_GR);
fg(30, 33, CAN_GL); fg(31, 33, CAN_GR);
fg(37, 33, CAN_GL); fg(38, 33, CAN_GR);

// ── NPCs ──────────────────────────────────────────────────────────────────
const npcs = [];

// ── World Objects ─────────────────────────────────────────────────────────
const worldObjects = [
  // Crystal rock landmark — tappable
  { type: 'CRYSTAL_ROCK', x: 23, y: 12, id: 'crystal-rock-01' },

  // Scattered flowers (sparse — mountain biome)
  { type: 'FLOWER_SMALL', x: 8,  y: 6,  id: 'mtn-flower-01' },
  { type: 'FLOWER_SMALL', x: 30, y: 7,  id: 'mtn-flower-02' },
  { type: 'FLOWER_SMALL', x: 4,  y: 15, id: 'mtn-flower-03' },
  { type: 'FLOWER_SMALL', x: 35, y: 14, id: 'mtn-flower-04' },
  { type: 'FLOWER_SMALL', x: 10, y: 24, id: 'mtn-flower-05' },
  { type: 'FLOWER_SMALL', x: 30, y: 25, id: 'mtn-flower-06' },
  { type: 'DANDELION',    x: 15, y: 20, id: 'mtn-dandelion-01' },
  { type: 'DANDELION',    x: 25, y: 32, id: 'mtn-dandelion-02' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────
const animals = [
  // Birds in pine trees
  { type: 'BIRD',   x: 5,  y: 4,  spriteName: 'bird',   zone: { x: 0,  y: 2,  w: 15, h: 8 } },
  { type: 'BIRD',   x: 32, y: 4,  spriteName: 'bird',   zone: { x: 23, y: 2,  w: 15, h: 8 } },
  { type: 'BIRD',   x: 7,  y: 14, spriteName: 'bird',   zone: { x: 0,  y: 10, w: 16, h: 8 } },
  { type: 'BIRD',   x: 35, y: 15, spriteName: 'bird',   zone: { x: 23, y: 10, w: 16, h: 8 } },
  // Bunny on rocky trail
  { type: 'BUNNY',  x: 15, y: 12, spriteName: 'bunny',  zone: { x: 10, y: 8,  w: 8,  h: 8 } },
  // Butterfly (rare in mountains — just one)
  { type: 'BUTTERFLY', x: 20, y: 10, spriteName: 'butterfly', zone: { x: 15, y: 6, w: 10, h: 8 } },
];

// ── Quests ─────────────────────────────────────────────────────────────────
const quests = [];

// ── Dialogues ──────────────────────────────────────────────────────────────
const dialogues = {};

// ── Level Transitions ──────────────────────────────────────────────────────
// SOUTH exit: player returns to sparkle-village north edge (tiles 28-31)
// NORTH exit: player advances to crystal-cave south edge (tiles 23-26)
const transitions = [
  {
    edge: 'south',
    tileStart: 18,
    tileEnd: 21,
    targetLevel: 'sparkle-village',
    targetSpawnX: 29,
    targetSpawnY: 1,
    transition: { type: 'iris', duration: 700 },
    marker: 'stone-gate',
  },
  {
    edge: 'north',
    tileStart: 18,
    tileEnd: 21,
    targetLevel: 'crystal-cave',
    targetSpawnX: 24,
    targetSpawnY: 47,
    transition: { type: 'iris', duration: 700 },
    marker: 'cave-mouth',
  },
];

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'crystal-path',
  name: 'Crystal Path',
  width: 40,
  height: 40,
  tileSize: 16,

  spawnX: 19,
  spawnY: 37,

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
