/**
 * level-sparkle-village.js — Sparkle Village for Princess Sparkle V2
 *
 * 30x20 tile grid (480x320 pixels — exactly one screen).
 *
 * Tile IDs reference the Kenney Tiny Town tileset (tilemap_packed.png):
 *   192x176 PNG, 12 columns x 11 rows of 16x16 tiles = 132 tiles.
 *   Tile ID = row * 12 + col.
 *
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — SPARKLE VILLAGE (30 wide x 20 tall)                    ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║                                                                      ║
 * ║  Col: 0         1         2         3                                ║
 * ║       0123456789012345678901234567890                                ║
 * ║  Row 0:  TT..~.......TT....PP..........TT  Tree border top         ║
 * ║  Row 1:  TT..........TT....PP..........TT  Trees + path            ║
 * ║  Row 2:  ...RRRRR.........PP..........~~  Grandma roof             ║
 * ║  Row 3:  ...WWDWW.........PP..........~~  Grandma walls            ║
 * ║  Row 4:  ...FF-FF...M.....PP..............  Grandma fence          ║
 * ║  Row 5:  .......G..B......PP..............  Garden, barrel         ║
 * ║  Row 6:  TT...............PP..........TT  Trees, path             ║
 * ║  Row 7:  TT...............PP..........TT  Trees, path             ║
 * ║  Row 8:  ........S..W.PPPPPPPPPP..........  Sign, well, E-W path  ║
 * ║  Row 9:  PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP   E-W path row            ║
 * ║  Row 10: ........S..w.PPPPPPPPPP..........  Sign, well base       ║
 * ║  Row 11: ...RcR.......PP......B...........  Baker roof, bench     ║
 * ║  Row 12: ...SDS.......PP..............TT  Baker walls             ║
 * ║  Row 13: ...F-F.......PP......RRRR....TT  Baker fence, Lily roof ║
 * ║  Row 14: .............PP......WWDW........  Lily walls             ║
 * ║  Row 15: ......BC..wwwPP......FF-F........  Barrel,crate,pond     ║
 * ║  Row 16: ..........wWwPP......................  Pond mid           ║
 * ║  Row 17: ..........wwwPP......B...........  Pond bottom, bench    ║
 * ║  Row 18: ...b..........PP..b..............  Bushes, path          ║
 * ║  Row 19: TT..~.........PP..........~..TT  South border, exit     ║
 * ║                                                                      ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * DESIGN: ~89% green grass, ~11% path → OVERWHELMINGLY GREEN
 * Grass mix: 60% plain (tile 1), 30% variant (tile 2)
 * Paths are THIN 2-tile LINES through a GREEN WORLD.
 *
 * DEPTH LAYERS:
 *   ground     — Every cell filled: grass varieties + dirt paths
 *   objects    — Buildings, fences, tree trunks, furniture (-1 = empty)
 *   collision  — 0 = walkable, 1 = blocked
 *   foreground — Tree canopies drawn OVER entities for depth (-1 = empty)
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
// VERIFIED against TILE-BUILDING-RULES.md — research-verified IDs

// GROUND TILES — fill every cell, grass dominant
const GR  = 1;    // plain green grass (60%)
const GR2 = 2;    // grass with flowers (30%)

// PATH TILES — dirt, only 10-15% of ground
const DP  = 40;   // dirt path center
const DPL = 39;   // dirt path left/top edge
const DPR = 41;   // dirt path right/bottom edge

// EMPTY (for object/foreground layers)
const E   = -1;

// TREE TILES (objects layer = trunks, foreground layer = canopies)
const CAN_GL = 4;  // green canopy left
const CAN_GR = 5;  // green canopy right
const CAN_AL = 7;  // autumn canopy left
const CAN_AR = 8;  // autumn canopy right
const TB1 = 12;    // tree trunk left
const TB2 = 13;    // tree trunk right

// BUSHES AND SMALL PLANTS
const BSH = 14;    // bush

// ROOFS — RED/ORANGE
const RFL = 63;    // red roof left slope
const RFM = 64;    // red roof middle
const RFR = 65;    // red roof right slope
const RFP = 67;    // red roof chimney/peak

// WALLS — WOOD
const WLL = 72;    // wood wall left edge
const WLM = 73;    // wood wall plain mid
const WLD = 74;    // wood door
const WLW = 75;    // wood wall with window

// WALLS — DARK STONE (baker's shop)
const SWL = 84;    // dark stone wall left
const SWM = 85;    // dark stone wall mid
const SWD = 86;    // dark stone door
const SWW = 87;    // dark stone wall with window

// FENCES — WHITE PICKET
const FNL = 96;    // picket fence left end
const FNM = 97;    // picket fence mid section
const FNR = 98;    // picket fence right end

// WATER TILES — 9-tile edge system
const WTL = 109;   // NW corner
const WTM = 110;   // N edge
const WTR = 111;   // NE corner
const WML = 121;   // W edge
const WMM = 122;   // center
const WMR = 123;   // E edge
const WBL = 120;   // SW corner
const WBM = 112;   // S edge
const WBR = 113;   // SE corner

// DECORATIONS & FURNITURE
const WEL = 92;    // well top
const WEB = 104;   // well base
const BNC = 105;   // bench
const CRT = 106;   // crate
const BRL = 107;   // barrel
const SGN = 116;   // signpost

// ── GROUND LAYER ──────────────────────────────────────────────────────────
// Every cell filled. ~89% grass (GR/GR2), ~11% path (DP/DPL/DPR).
// Grass mix: 60% GR (plain green 1), 30% GR2 (variant 2).
// N-S path at cols 14-15 (full length).
// E-W path at row 9 (full width).
// N-S: col 14 = DPL (left edge), col 15 = DPR (right edge).
// E-W: row 8 = DPL (top edge), row 9 = DP center pair, row 10 = DPR (bottom edge) — but only where E-W branch runs.
// Actually: E-W path is a single row (row 9), 2 tiles tall not needed. Use row 9 as center.
// For simplicity: row 9 all DP. N-S cols 14=DPL, 15=DPR except at intersection (row 9) = DP.

// prettier-ignore
const ground = grid([
  // Row 0: tree border top
  [GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, DPL,DPR,GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 1: trees + path
  [GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, DPL,DPR,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 2: Grandma roof area
  [GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR2,GR, GR, GR, DPL,DPR,GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 3: Grandma walls
  [GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR2,GR, DPL,DPR,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2],
  // Row 4: Grandma fence + garden
  [GR, GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, GR2,GR, GR, DPL,DPR,GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 5: garden / open grass
  [GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,DPL,DPR,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 6: trees left/right, path
  [GR, GR, GR2,GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, DPL,DPR,GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR],
  // Row 7: trees, path
  [GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, DPL,DPR,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR2,GR, GR],
  // Row 8: E-W path top edge (cols 6-21), well area
  [GR, GR2,GR, GR, GR2,GR, DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DP, DP, DPL,DPL,DPL,DPL,DPL,DPL,GR, GR2,GR, GR2,GR, GR, GR2,GR],
  // Row 9: E-W path center (cols 6-21) + N-S intersection
  [GR, GR2,GR, GR2,GR, GR, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, GR, GR, GR2,GR, GR2,GR, GR, GR2],
  // Row 10: E-W path bottom edge (cols 6-21)
  [GR, GR, GR2,GR, GR, GR2,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DP, DP, DPR,DPR,DPR,DPR,DPR,DPR,GR, GR, GR2,GR, GR2,GR, GR, GR2],
  // Row 11: Baker roof area
  [GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, DPL,DPR,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 12: Baker walls
  [GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,DPL,DPR,GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR],
  // Row 13: Baker fence, Lily roof area
  [GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, DPL,DPR,GR, GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 14: Lily walls
  [GR, GR, GR2,GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, DPL,DPR,GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 15: Pond top, Lily fence
  [GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR, DPL,DPR,GR, GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 16: Pond mid
  [GR, GR, GR2,GR, GR2,GR, GR, GR2,GR, GR, GR, GR, GR2,GR, DPL,DPR,GR, GR2,GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 17: Pond bottom, bench
  [GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR, GR2,DPL,DPR,GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 18: bushes, path
  [GR, GR, GR2,GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, DPL,DPR,GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR],
  // Row 19: tree border south, exit at 14-15
  [GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, DPL,DPR,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR2,GR, GR],
]);

// ── OBJECTS LAYER ─────────────────────────────────────────────────────────
// Buildings, tree trunks, fences, water, decorations.
// -1 = empty (E). Tree trunks go HERE; canopies go in foreground.
//
// Building layouts (per user-specified templates):
//   Grandma's Cottage (5-wide, cols 3-7):
//     Row 2: RFL, RFM, RFM, RFM, RFR         (roof)
//     Row 3: WLL, WLW, WLD, WLW, WLM         (walls, door at col 5)
//     Row 4: FNL, FNM, E,   FNM, FNR         (fence, gate at col 5)
//
//   Baker's Shop (3-wide, cols 3-5):
//     Row 11: RFL, RFP, RFR                   (roof with chimney)
//     Row 12: SWL, SWD, SWM                   (stone walls, door at col 4)
//     Row 13: FNL, E,   FNR                   (fence, gate at col 4)
//
//   Lily's House (4-wide, cols 20-23):
//     Row 13: RFL, RFM, RFM, RFR             (roof)
//     Row 14: WLL, WLW, WLD, WLM             (walls, door at col 22)
//     Row 15: FNL, FNM, E,   FNR             (fence, gate at col 22)
//
// Water pond (3x3 at cols 10-12, rows 15-17)
// Trees: staggered at edges, canopy/trunk pairs

// prettier-ignore
const objects = grid([
  // Row 0: tree border — staggered, mixed types with gaps and bushes
  [TB1,TB2,E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 1: more trees at edges
  [TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 2: Grandma's cottage roof (cols 3-7)
  [E,  E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E,  E  ],
  // Row 3: Grandma's walls (cols 3-7): WLL, WLW, WLD, WLW, WLM — door at col 5
  [E,  E,  E,  WLL,WLW,WLD,WLW,WLM,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E  ],
  // Row 4: Grandma's fence (cols 3-7): FNL, FNM, gate(-1), FNM, FNR — gate at col 5
  [E,  E,  E,  FNL,FNM,E,  FNM,FNR,E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 5: garden plot at col 7, barrel at col 8, bench nearby
  [E,  E,  E,  E,  E,  E,  E,  E,  BRL,E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 6: tree trunks left side
  [TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 7: tree trunks left side (staggered)
  [TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 8: well top at col 13, signpost at col 9
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  WEL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 9: E-W path row — mostly clear, well base at col 13, bench at col 17
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  WEB,E,  E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 10: below path — bench at col 12
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 11: Baker's shop roof (cols 3-5): RFL, RFP, RFR
  [E,  E,  E,  RFL,RFP,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 12: Baker's walls (cols 3-5): SWL, SWD, SWM — door at col 4, trees right
  [E,  E,  E,  SWL,SWD,SWM,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 13: Baker's fence (cols 3-5): FNL, gate, FNR. Lily's roof (cols 20-23): RFL, RFM, RFM, RFR. Trees right.
  [E,  E,  E,  FNL,E,  FNR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFM,RFR,E,  E,  E,  E,  TB1,TB2],
  // Row 14: Lily's walls (cols 20-23): WLL, WLW, WLD, WLM — door at col 22
  [E,  E,  E,  E,  E,  E,  BRL,CRT,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  WLL,WLW,WLD,WLM,E,  E,  E,  E,  E,  E  ],
  // Row 15: Lily's fence (cols 20-23): FNL, FNM, gate, FNR. Pond top (cols 10-12).
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  WTL,WTM,WTR,E,  E,  E,  E,  E,  E,  E,  FNL,FNM,E,  FNR,E,  E,  E,  E,  E,  E  ],
  // Row 16: Pond mid (cols 10-12), bench at col 15 facing pond
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,WML,WMM,WMR,E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 17: Pond bottom (cols 10-12), bench at col 15
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  WBL,WBM,WBR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  E,  E  ],
  // Row 18: bushes scattered, open
  [E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 19: tree border south — exit gap at cols 14-15
  [TB1,TB2,E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  TB1,TB2],
]);

// ── COLLISION LAYER ───────────────────────────────────────────────────────
// 0 = walkable, 1 = blocked
// Buildings (roof+walls), fences (except gate gaps), tree trunks, well, water, some decorations = blocked
// Doors have collision=1 (visual only per TILE-BUILDING-RULES), gates in fences are walkable (0)

// prettier-ignore
const collision = grid([
  // Row 0: trees(0-1), bush(4), trees(12-13), trees(28-29)
  [1,1,0,0,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 1: trees(0-1), trees(12-13), trees(28-29)
  [1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 2: Grandma roof blocked(3-7), bush(25)
  [0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
  // Row 3: Grandma walls blocked(3-7), door at 5 blocked (visual only), bush(26)
  [0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  // Row 4: fence(3-4,6-7) blocked, gate at 5 walkable, signpost(11)
  [0,0,0,1,1,0,1,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 5: barrel(8) blocked, bench(10)
  [0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 6: trees(0-1), trees(28-29)
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 7: trees(0-1), trees(28-29)
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 8: signpost(9), well top(13)
  [0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 9: well base(13), bench(17)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 10: bench(12)
  [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 11: Baker roof blocked(3-5)
  [0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 12: Baker walls blocked(3-5), door at 4 blocked, trees(28-29)
  [0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 13: Baker fence(3,5) gate at 4 walkable, Lily roof blocked(20-23), trees(28-29)
  [0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1],
  // Row 14: barrel(6), crate(7), Lily walls blocked(20-23), door at 22 blocked
  [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  // Row 15: pond water blocked(10-12), Lily fence(20-21,23) gate at 22 walkable
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0],
  // Row 16: bush(9), pond water blocked(10-12), bench(15)
  [0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 17: pond water blocked(10-12), signpost(24)
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],
  // Row 18: bush(3), bush(18)
  [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  // Row 19: trees(0-1), bush(4), bush(25), trees(28-29)
  [1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,1],
]);

// ── FOREGROUND LAYER ──────────────────────────────────────────────────────
// Tree canopies drawn OVER entities. When the princess walks under a tree,
// the canopy covers her sprite — THIS is what makes the world feel 3D.
// Canopies placed ONE ROW ABOVE trunks so they overlap entities at trunk level.
// Green canopy: CAN_GL(4), CAN_GR(5). Autumn canopy: CAN_AL(7), CAN_AR(8).

// prettier-ignore
const foreground = grid([
  // Row 0: canopies for row 0 trunks (cols 0-1, 12-13, 28-29) — placed ON trunk row since no row above
  [CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR],
  // Row 1: canopies for row 1 trunks (cols 0-1, 12-13, 28-29)
  [CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 2-5: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 5: canopies for row 6 trunks (cols 0-1, 28-29)
  [CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 6: canopies for row 7 trunks (cols 0-1, 28-29)
  [CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR],
  // Row 7: canopies for row 7 trunks overlap
  [CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 8-10: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 11: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 12: canopy for row 12 trees (cols 28-29) — placed on trunk row
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR],
  // Row 13: canopy for row 13 trees (cols 28-29)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 14-18: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 18: canopies for row 19 trunks (cols 0-1, 28-29)
  [CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 19: canopy on trunk row for south border trees
  [CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR],
]);

// ── NPCs ──────────────────────────────────────────────────────────────────
// All homeX/homeY positions verified on walkable tiles (collision=0).
// Updated to match new building positions.

const npcs = [
  {
    id: 'grandma-rose',
    name: 'Grandma Rose',
    spriteName: 'npc_grandma',
    homeX: 5,       // at her door (col 5, row 5 — walkable via gate)
    homeY: 5,       // yard grass below fence gate
    wanderRadius: 3,
    personality: 'warm',
    dialogueId: 'grandma-rose-greeting',
    ambientLines: [
      'voice_grandma_ambient_01',
      'voice_grandma_ambient_02',
      'voice_grandma_ambient_03',
    ],
    sillyBehaviors: ['loses_glasses', 'hums_tune', 'talks_to_flowers'],
  },
  {
    id: 'neighbor-lily',
    name: 'Neighbor Lily',
    spriteName: 'npc_lily',
    homeX: 22,      // at her door (col 22, row 16 — walkable via gate)
    homeY: 16,      // below fence gate on walkable ground
    wanderRadius: 2,
    personality: 'cheerful',
    dialogueId: 'lily-greeting',
    ambientLines: [
      'voice_lily_ambient_01',
      'voice_lily_ambient_02',
    ],
    sillyBehaviors: ['waters_wrong_plant', 'talks_to_flowers', 'hangs_laundry'],
  },
  {
    id: 'little-finn',
    name: 'Little Finn',
    spriteName: 'npc_finn',
    homeX: 16,      // near the village square, on walkable ground
    homeY: 16,      // near the pond / playground area
    wanderRadius: 3,
    personality: 'playful',
    dialogueId: 'finn-greeting',
    ambientLines: [
      'voice_finn_ambient_01',
      'voice_finn_ambient_02',
    ],
    sillyBehaviors: ['chases_butterfly', 'trips_over_rock', 'draws_in_dirt', 'kite_stuck'],
  },
  {
    id: 'baker-maple',
    name: 'Baker Maple',
    spriteName: 'npc_baker',
    homeX: 4,       // at his door (col 4, row 14 — walkable via gate)
    homeY: 14,      // below fence gate on walkable ground
    wanderRadius: 2,
    personality: 'jolly',
    dialogueId: 'baker-maple-greeting',
    ambientLines: [
      'voice_baker_ambient_01',
      'voice_baker_ambient_02',
    ],
    sillyBehaviors: ['drops_pie', 'sleeping_standing', 'flour_sneeze'],
  },
];

// ── World Objects (tappable) ──────────────────────────────────────────────
// 24 objects distributed so every screen area has 3-5 tappable things.
// Positions updated for new layout.

const worldObjects = [
  // ── Grandma's area (upper-left) — 5 objects ──
  { type: 'WIND_CHIMES',   x: 4,  y: 2,  id: 'wind-chimes-01' },
  { type: 'GARDEN_PLOT',   x: 7,  y: 5,  id: 'garden-plot-01' },
  { type: 'FLOWER_BIG',    x: 25, y: 2,  id: 'flower-big-01' },
  { type: 'FLOWER_BIG',    x: 26, y: 3,  id: 'flower-big-02' },
  { type: 'MAILBOX',       x: 11, y: 4,  id: 'mailbox-grandma' },

  // ── Village square / well area (center) — 5 objects ──
  { type: 'WELL',          x: 13, y: 8,  id: 'village-well' },
  { type: 'SIGNPOST',      x: 9,  y: 8,  id: 'signpost-01' },
  { type: 'SIGNPOST',      x: 11, y: 4,  id: 'signpost-north' },
  { type: 'BENCH',         x: 17, y: 9,  id: 'bench-square-01' },
  { type: 'BENCH',         x: 12, y: 10, id: 'bench-square-02' },

  // ── East meadow flowers — 3 objects ──
  { type: 'FLOWER_SMALL',  x: 25, y: 2,  id: 'flower-east-01' },
  { type: 'FLOWER_SMALL',  x: 26, y: 3,  id: 'flower-east-02' },
  { type: 'FLOWER_SMALL',  x: 24, y: 17, id: 'flower-east-03' },

  // ── Baker's area (left-center) — 4 objects ──
  { type: 'APPLE_BASKET',  x: 7,  y: 14, id: 'apple-basket-baker' },
  { type: 'FLOWER_SMALL',  x: 2,  y: 13, id: 'flower-baker-01' },
  { type: 'DANDELION',     x: 8,  y: 14, id: 'dandelion-baker' },
  { type: 'LANTERN',       x: 2,  y: 11, id: 'lantern-path-01' },

  // ── Lily's area (right-center) — 3 objects ──
  { type: 'HANGING_LAUNDRY', x: 24, y: 14, id: 'laundry-lily' },
  { type: 'MAILBOX',       x: 24, y: 17, id: 'mailbox-lily' },
  { type: 'FLOWER_SMALL',  x: 19, y: 15, id: 'flower-lily-area' },

  // ── Pond area (lower-center) — 3 objects ──
  { type: 'POND',          x: 11, y: 16, id: 'village-pond' },
  { type: 'BENCH',         x: 15, y: 16, id: 'bench-pond' },
  { type: 'FLOWER_SMALL',  x: 9,  y: 17, id: 'flower-pond-01' },

  // ── Scattered for discovery — 3 more ──
  { type: 'DANDELION',     x: 9,  y: 5,  id: 'dandelion-meadow' },
  { type: 'FLOWER_SMALL',  x: 4,  y: 0,  id: 'flower-west-01' },
  { type: 'FLOWER_SMALL',  x: 25, y: 19, id: 'flower-center-east' },
];

// ── Ambient Animals ───────────────────────────────────────────────────────
// 12 animals distributed to fill the world with life. Each has a roaming zone.

const animals = [
  // Butterflies — near flowers (3 total)
  { type: 'BUTTERFLY', x: 3,  y: 3,  spriteName: 'butterfly', zone: { x: 1, y: 1, w: 8, h: 5 } },
  { type: 'BUTTERFLY', x: 22, y: 3,  spriteName: 'butterfly', zone: { x: 20, y: 1, w: 6, h: 5 } },
  { type: 'BUTTERFLY', x: 9,  y: 17, spriteName: 'butterfly', zone: { x: 8, y: 15, w: 8, h: 4 } },

  // Birds — near trees (2 total)
  { type: 'BIRD', x: 2,  y: 6,  spriteName: 'bird', zone: { x: 0, y: 5, w: 6, h: 4 } },
  { type: 'BIRD', x: 27, y: 7,  spriteName: 'bird', zone: { x: 25, y: 6, w: 5, h: 4 } },

  // Cat — sleeping near village square
  { type: 'CAT', x: 11, y: 8,  spriteName: 'cat', zone: { x: 9, y: 7, w: 6, h: 5 } },

  // Frogs — near pond (2 total)
  { type: 'FROG', x: 9,  y: 16, spriteName: 'frog', zone: { x: 8, y: 15, w: 6, h: 4 } },
  { type: 'FROG', x: 13, y: 17, spriteName: 'frog', zone: { x: 10, y: 16, w: 6, h: 3 } },

  // Ducks — on/near pond
  { type: 'DUCK', x: 11, y: 15, spriteName: 'duck', zone: { x: 10, y: 15, w: 4, h: 3 } },

  // Dog — near Finn / village square
  { type: 'DOG', x: 16, y: 17, spriteName: 'dog', zone: { x: 14, y: 16, w: 6, h: 3 } },

  // Squirrel — near tree groves
  { type: 'SQUIRREL', x: 3, y: 12, spriteName: 'squirrel', zone: { x: 1, y: 11, w: 5, h: 4 } },

  // Ladybug — near Lily's flowers
  { type: 'LADYBUG', x: 24, y: 16, spriteName: 'ladybug', zone: { x: 20, y: 14, w: 6, h: 4 } },
];

// ── Quests ────────────────────────────────────────────────────────────────
// Two full quests with multi-stage dialogue trees.

const quests = [
  // QUEST 1: "Sharing is Caring"
  // Grandma Rose baked cookies. Deliver them to Neighbor Lily (who is lonely).
  // Then return to Grandma to tell her about Lily's smile.
  {
    id: 'sharing-is-caring',
    name: 'Sharing is Caring',
    giverNpcId: 'grandma-rose',
    value: 'sharing',
    heartReward: 3,
    bridgeColor: '#ff9ec4',   // soft pink
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'grandma-rose',
        dialogueId: 'sharing-start',
        description: 'voice_quest_sharing_start',
      },
      {
        type: 'PICKUP',
        targetId: 'cookies-item',
        pickupX: 7,
        pickupY: 5,
        itemId: 'cookies',
        dialogueId: 'sharing-pickup',
        description: 'voice_quest_sharing_pickup',
      },
      {
        type: 'DELIVER',
        targetId: 'neighbor-lily',
        itemId: 'cookies',
        dialogueId: 'sharing-deliver',
        description: 'voice_quest_sharing_deliver',
      },
      {
        type: 'RETURN_TO',
        targetId: 'grandma-rose',
        dialogueId: 'sharing-complete',
        description: 'voice_quest_sharing_complete',
      },
    ],
  },

  // QUEST 2: "Being Brave Together"
  // Find Little Finn sitting near the well. Talk to him,
  // encourage him, and he tries climbing the big rock. Bravery + empathy.
  {
    id: 'being-brave-together',
    name: 'Being Brave Together',
    giverNpcId: 'little-finn',
    value: 'bravery',
    heartReward: 3,
    bridgeColor: '#7ec8e3',   // soft blue
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'little-finn',
        dialogueId: 'brave-start',
        description: 'voice_quest_brave_start',
      },
      {
        type: 'ENCOURAGE',
        targetId: 'little-finn',
        dialogueId: 'brave-encourage',
        description: 'voice_quest_brave_encourage',
      },
      {
        type: 'OBSERVE',
        targetId: 'bench-square-01',
        dialogueId: 'brave-observe',
        description: 'voice_quest_brave_observe',
      },
      {
        type: 'RETURN_TO',
        targetId: 'little-finn',
        dialogueId: 'brave-complete',
        description: 'voice_quest_brave_complete',
      },
    ],
  },
];

// ── Dialogues ─────────────────────────────────────────────────────────────
// Full dialogue trees for greetings and both quests.
// Every node has a voiceId for narration (pre-literate player).

const dialogues = {
  // ─── NPC Greetings ───
  'grandma-rose-greeting': {
    startId: 'g1',
    nodes: {
      g1: {
        id: 'g1',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_greeting',
        text: 'Oh hello, dear Princess! My, what a beautiful day for a visit. My garden is blooming so nicely today!',
        next: null,
        expression: 'happy',
      },
    },
  },

  'lily-greeting': {
    startId: 'l1',
    nodes: {
      l1: {
        id: 'l1',
        portrait: 'npc_lily',
        name: 'Neighbor Lily',
        voiceId: 'voice_lily_greeting',
        text: 'Well hello there, Princess! Oh, your companion is so cute! Come visit anytime, my door is always open!',
        next: null,
        expression: 'happy',
      },
    },
  },

  'finn-greeting': {
    startId: 'f1',
    nodes: {
      f1: {
        id: 'f1',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_greeting',
        text: 'Hi Princess! Want to play? I like climbing and running and... oh look, a butterfly!',
        next: null,
        expression: 'excited',
      },
    },
  },

  'baker-maple-greeting': {
    startId: 'b1',
    nodes: {
      b1: {
        id: 'b1',
        portrait: 'npc_baker',
        name: 'Baker Maple',
        voiceId: 'voice_baker_greeting',
        text: 'Welcome to my bakery, little one! The whole village loves my fresh bread. Would you like to smell? Mmm, doesn\'t that smell yummy?',
        next: null,
        expression: 'happy',
      },
    },
  },

  // ─── Quest 1: Sharing is Caring ───
  'sharing-start': {
    startId: 'sc1',
    nodes: {
      sc1: {
        id: 'sc1',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_sharing_01',
        text: 'Princess, I just baked the most wonderful cookies! They are warm and golden and smell like sunshine.',
        next: 'sc2',
        expression: 'happy',
      },
      sc2: {
        id: 'sc2',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_sharing_02',
        text: 'But you know what makes cookies even more special? Sharing them! My neighbor Lily has been feeling a little lonely. Could you bring her some cookies from my garden table?',
        next: 'sc3',
        expression: 'gentle',
      },
      sc3: {
        id: 'sc3',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_sharing_01',
        text: 'Ooh, cookies! Let\'s go get them from the garden! Look, they\'re right there on the table!',
        next: null,
        expression: 'excited',
      },
    },
  },

  'sharing-pickup': {
    startId: 'sp1',
    nodes: {
      sp1: {
        id: 'sp1',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_sharing_02',
        text: 'You got the cookies! They smell so good. Now let\'s find Lily! She lives in the house down south, past the pond.',
        next: null,
        expression: 'happy',
      },
    },
  },

  'sharing-deliver': {
    startId: 'sd1',
    nodes: {
      sd1: {
        id: 'sd1',
        portrait: 'npc_lily',
        name: 'Neighbor Lily',
        voiceId: 'voice_lily_cookies_01',
        text: 'Oh! Are those... cookies? For me?',
        next: 'sd2',
        expression: 'surprised',
      },
      sd2: {
        id: 'sd2',
        portrait: 'npc_lily',
        name: 'Neighbor Lily',
        voiceId: 'voice_lily_cookies_02',
        text: 'How sweet of Grandma Rose to think of me! And how kind of you to bring them all the way here! You made my whole day brighter, Princess.',
        next: 'sd3',
        expression: 'grateful',
      },
      sd3: {
        id: 'sd3',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_sharing_03',
        text: 'Look how happy she is! Sharing really does make everyone smile. Let\'s go tell Grandma Rose!',
        next: null,
        expression: 'happy',
      },
    },
  },

  'sharing-complete': {
    startId: 'sf1',
    nodes: {
      sf1: {
        id: 'sf1',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_sharing_done_01',
        text: 'You gave the cookies to Lily? Oh, I bet she smiled so big! You know what, Princess?',
        next: 'sf2',
        expression: 'happy',
      },
      sf2: {
        id: 'sf2',
        portrait: 'npc_grandma',
        name: 'Grandma Rose',
        voiceId: 'voice_grandma_sharing_done_02',
        text: 'When we share something with someone, we don\'t have less — we have MORE. Because now we have cookies AND a happy friend! That\'s the magic of sharing.',
        next: 'sf3',
        expression: 'wise',
      },
      sf3: {
        id: 'sf3',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_sharing_done',
        text: 'We did it! We made two people happy with one plate of cookies! You\'re such a kind princess.',
        next: null,
        expression: 'proud',
      },
    },
  },

  // ─── Quest 2: Being Brave Together ───
  'brave-start': {
    startId: 'bs1',
    nodes: {
      bs1: {
        id: 'bs1',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_01',
        text: '... oh, hi Princess. I\'m just... sitting here.',
        next: 'bs2',
        expression: 'sad',
      },
      bs2: {
        id: 'bs2',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_01',
        text: 'Finn looks a little sad. Maybe we should ask what\'s wrong?',
        next: 'bs3',
        expression: 'concerned',
      },
      bs3: {
        id: 'bs3',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_02',
        text: 'I want to climb on the big rock over there but... what if I fall? What if it\'s too high? Everyone else can do it but me...',
        next: 'bs4',
        expression: 'worried',
      },
      bs4: {
        id: 'bs4',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_02',
        text: 'Hey Finn, being scared doesn\'t mean you can\'t be brave! Brave means trying even when you\'re a little scared. We\'ll be right here with you!',
        next: null,
        expression: 'encouraging',
      },
    },
  },

  'brave-encourage': {
    startId: 'be1',
    nodes: {
      be1: {
        id: 'be1',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_03',
        text: 'You... you\'ll stay right here? You won\'t leave?',
        next: 'be2',
        expression: 'hopeful',
      },
      be2: {
        id: 'be2',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_03',
        text: 'Of course! Friends stay together. You try the rock, and we\'ll cheer you on! Ready? You can do it!',
        next: 'be3',
        expression: 'encouraging',
      },
      be3: {
        id: 'be3',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_04',
        text: 'Okay... okay! I\'m going to try! Here I go!',
        next: null,
        expression: 'determined',
      },
    },
  },

  'brave-observe': {
    startId: 'bo1',
    nodes: {
      bo1: {
        id: 'bo1',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_04',
        text: 'Look! Finn is climbing! He\'s doing it! Go Finn, go!',
        next: 'bo2',
        expression: 'excited',
      },
      bo2: {
        id: 'bo2',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_05',
        text: 'I... I DID IT! I\'m on top! I can see the whole village from up here! WOOOO!',
        next: null,
        expression: 'thrilled',
      },
    },
  },

  'brave-complete': {
    startId: 'bc1',
    nodes: {
      bc1: {
        id: 'bc1',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_06',
        text: 'Princess! Princess! I did it! I was so scared but I tried anyway and I DID IT!',
        next: 'bc2',
        expression: 'happy',
      },
      bc2: {
        id: 'bc2',
        portrait: 'companion',
        name: 'Companion',
        voiceId: 'voice_companion_brave_05',
        text: 'See, Finn? That\'s what being brave means. It doesn\'t mean you\'re not scared. It means you try anyway, especially when friends are there to help.',
        next: 'bc3',
        expression: 'proud',
      },
      bc3: {
        id: 'bc3',
        portrait: 'npc_finn',
        name: 'Little Finn',
        voiceId: 'voice_finn_brave_07',
        text: 'Thank you, Princess! You\'re the bravest friend ever. Next time I\'m scared, I\'ll remember — brave means trying! Want to climb together next time?',
        next: null,
        expression: 'grateful',
      },
    },
  },
};

// ── Level Transitions ─────────────────────────────────────────────────────

const transitions = [
  {
    edge: 'south',
    targetLevel: 'whisper-forest',
    targetSpawnX: 15,
    targetSpawnY: 1,
    label: 'Whisper Forest',
    // Transition zone: bottom row path gap at cols 14-15
    zoneStartX: 14,
    zoneEndX: 15,
  },
];

// ── Tileset Configuration ─────────────────────────────────────────────────

const tilesetConfig = {
  town: './sprites/town/tilemap_packed.png',
  dungeon: './sprites/dungeon/tilemap_packed.png',
};

// ── Animated Tile Definitions ─────────────────────────────────────────────
// Water tiles shimmer by cycling through slight variations.

const animatedTiles = [
  { baseTile: 122, frames: [122, 121, 122, 123] },  // water center shimmer
];

// ── Export ─────────────────────────────────────────────────────────────────

export default {
  id: 'sparkle-village',
  name: 'Sparkle Village',
  width: 30,
  height: 20,
  tileSize: 16,
  tilesetPath: './sprites/town/tilemap_packed.png',

  // Player spawn — on the main path near the village square
  spawnX: 14,
  spawnY: 9,

  // Tile layers (each exactly 600 values for 30x20)
  ground,
  objects,
  collision,
  foreground,

  // Entities
  npcs,
  worldObjects,
  animals,

  // Systems
  quests,
  dialogues,
  transitions,
  tilesetConfig,
  animatedTiles,
};
