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
 * ║  Col: 0123456789012345678901234567890                                ║
 * ║  Row 0:  TT.~..TT......PP..........TT~~  Tree border + flowers     ║
 * ║  Row 1:  TT..RRRRR.....PP..........TT..  Grandma cottage roof      ║
 * ║  Row 2:  ~~..WWDWW.....PP......~~..TT..  Walls+door, flowers E     ║
 * ║  Row 3:  ....FFFFF.....PP......~~.......  Fenced yard               ║
 * ║  Row 4:  ......G.B.....PP..............~  Garden, barrel, path      ║
 * ║  Row 5:  ..M.........PPP.......BN.......  Mailbox, plaza, bench     ║
 * ║  Row 6:  .TT...PPPPPPPP.PP.............  E-W path joins N-S        ║
 * ║  Row 7:  .TT...PP......PP....TT........  Path fork, trees E        ║
 * ║  Row 8:  ......PP..S...PP....TT........  Signpost, path            ║
 * ║  Row 9:  .~~...PP..W...PP..............  Well, flowers W           ║
 * ║  Row 10: .~~...PP..w...PP.....~~.......  Well base, flowers E      ║
 * ║  Row 11: ......PP......PP..RRRRR.......  Baker shop roof           ║
 * ║  Row 12: .TT.PPPPPPPPPPPP..SWDSW.......  E-W path, baker walls    ║
 * ║  Row 13: .TT.......PP.....FFFFF..~.....  Baker fenced yard        ║
 * ║  Row 14: ..........PP....BC....~~.......  Barrel, crate near baker ║
 * ║  Row 15: ....www...PP..............~....  Pond top                  ║
 * ║  Row 16: ....wWw...PP.....RRRRR........  Pond mid, Lily roof      ║
 * ║  Row 17: ....www...PP.....WWDWW..~.....  Pond bottom, Lily walls  ║
 * ║  Row 18: ...B......PP.....FFFFF.M.......  Bench@pond, Lily fence  ║
 * ║  Row 19: TT.~..b~......PP..........~.TT  Tree border, south exit  ║
 * ║                                                                      ║
 * ║  Key: T=tree trunk  P=path(2wide)  R=roof  W=wall  D=door          ║
 * ║       F=fence  ~=flowers  w=water  *=well  G=garden  B=bench/barrel ║
 * ║       S=signpost  M=mailbox  b=bush  N=lantern  C=crate            ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * DESIGN: ~89% green grass, ~11% path → OVERWHELMINGLY GREEN
 * Grass mix: 60% plain (tile 37), 30% variant (tile 38), 10% flower (tile 43)
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
// VERIFIED against TILE-REFERENCE.md — Tile ID = row * 12 + col
// All IDs cross-checked with tilemap_packed.png (192x176)

// GROUND TILES — fill every cell, grass dominant
const GR  = 1;    // plain green grass — Row 0, Col 1 (VISUALLY VERIFIED)
const GR2 = 2;    // grass with flowers — Row 0, Col 2 (VISUALLY VERIFIED)
const GF  = 2;    // alias for GR2

// PATH TILES — dirt, only 10-15% of ground
const DP  = 40;   // dirt path center — Row 3, Col 4
const DPE = 41;   // dirt path edge (right/bottom variant) — Row 3, Col 5
const DPV = 42;   // dirt path vertical edge — Row 3, Col 6
const DPL = 39;   // dirt path edge left/top — Row 3, Col 3

// Path edge tiles: use the path center (40) for interior,
// edges (39, 41, 42) for grass-to-path transitions.
// For a 2-wide N-S path, left col gets 39 (left edge), right col gets 41 (right edge).
// Interior path (both sides are path) uses 40.
// Top cap (grass above) = 39, Bottom cap (grass below) = 41.

// EMPTY (for object/foreground layers)
const E   = -1;

// TREE TILES (objects layer = trunks, foreground layer = canopies)
const CAN_L = 0;   // tree canopy top-left (large green) — Row 0, Col 0
const CAN_R = 1;   // tree canopy top-right (large green) — Row 0, Col 1
const CAN_F = 2;   // flowering tree canopy — Row 0, Col 2
const CAN_A = 3;   // autumn tree canopy — Row 0, Col 3
const CAN_P = 4;   // evergreen/pine tree top — Row 0, Col 4
const CAN_S = 5;   // small tree canopy — Row 0, Col 5
const TB1 = 12;    // tree trunk-left — Row 1, Col 0
const TB2 = 13;    // tree trunk-right — Row 1, Col 1

// BUSHES AND SMALL PLANTS
const BSH_L = 6;   // bush (large) — Row 0, Col 6
const BSH_S = 7;   // bush (small) — Row 0, Col 7
const FERN = 18;   // small fern/plant — Row 1, Col 6
const PFLWR = 19;  // purple flower bush — Row 1, Col 7
const PLT  = 16;   // small complete tree (1 tile) — Row 1, Col 4

// ROOFS — RED/ORANGE (Row 5: IDs 63-65, 67)
const RFL = 63;    // red roof left slope — Row 5, Col 3
const RFM = 64;    // red roof middle — Row 5, Col 4
const RFR = 65;    // red roof right slope — Row 5, Col 5
const RFP = 67;    // red roof peak/chimney — Row 5, Col 7

// WALLS — WOOD (Row 6: IDs 72-75)
const WLL = 72;    // wood wall left edge — Row 6, Col 0
const WLM = 73;    // wood wall plain mid — Row 6, Col 1
const WLD = 74;    // wood door — Row 6, Col 2
const WLW = 75;    // wood wall with window — Row 6, Col 3

// WALLS — DARK STONE (Row 7: IDs 84-87, for baker's shop)
const SWL = 84;    // dark stone wall left — Row 7, Col 0
const SWM = 85;    // dark stone wall mid — Row 7, Col 1
const SWD = 86;    // dark stone door — Row 7, Col 2
const SWW = 87;    // dark stone wall with window — Row 7, Col 3

// FENCES — WHITE PICKET (Row 8: IDs 96-98)
const FNL = 96;    // picket fence left end — Row 8, Col 0
const FNM = 97;    // picket fence mid section — Row 8, Col 1
const FNR = 98;    // picket fence right end — Row 8, Col 2

// WATER TILES — per TILE-REFERENCE Quick Reference
const WTL = 109;   // water edge top-left (NW corner) — Row 9, Col 1
const WTM = 110;   // water edge top (north) — Row 9, Col 2
const WTR = 111;   // water edge top-right (NE corner) — Row 9, Col 3
const WML = 121;   // water edge left (west) — Row 10, Col 1
const WMM = 122;   // water center (deep) — Row 10, Col 2
const WMR = 123;   // water edge right (east) — Row 10, Col 3
const WBL = 120;   // water edge bottom-left (SW corner) — Row 10, Col 0
const WBM = 112;   // water edge bottom (south) — Row 9, Col 4
const WBR = 113;   // water edge bottom-right (SE corner) — Row 9, Col 5

// DECORATIONS & FURNITURE — per TILE-REFERENCE
const WEL = 92;    // well top (peaked roof) — Row 7, Col 8
const WEB = 104;   // well base (bucket) — Row 8, Col 8
const BNC = 105;   // bench — Row 8, Col 9
const BRL = 107;   // barrel — Row 8, Col 11
const CRT = 106;   // stone/crate — Row 8, Col 10
const SGN = 116;   // sign/lamp post — Row 9, Col 8
const LNT = 93;    // lantern/mailbox — Row 7, Col 9
const MLX = 116;   // mailbox (use sign/lamp post) — Row 9, Col 8

// FLOWER DECORATIONS (objects layer)
const FLR = 19;    // purple flower bush (red-ish) — Row 1, Col 7
const FLY = 29;    // red flowers/berry bush — Row 2, Col 5
const FLB = 18;    // small fern (green accent) — Row 1, Col 6

// ── GROUND LAYER ──────────────────────────────────────────────────────────
// Every cell filled. ~89% grass (GR/GR2/GF), ~11% path (DP/DPL/DPE).
// Grass mix: 60% GR (plain green 37), 30% GR2 (variant 38), 10% GF (flowers 43).
// Clustered organically: GR2 in groups of 2-3, GF near buildings/paths.
// Never more than 4 of same tile in a row.
// N-S path at cols 14-15, E-W branches at rows 6 and 12.
// Path uses proper edge tiles:
//   N-S path: col 14 = DPL (left edge 39), col 15 = DPE (right edge 41)
//   Where path starts/ends: top cap row uses DPL/DPE, bottom cap uses DPL/DPE
//   E-W path: top row = DPL (top edge), bottom row = DPE (bottom edge)
//   Intersections: DP (center 40)
//   T-junctions: DP at junction point

// prettier-ignore
const ground = grid([
  // Row 0: tree border top — N-S path starts here, top edge caps
  [GR, GR2,GR, GF, GR, GR2,GR, GR2,GR, GR, GR2,GR, GR, GR, DPL,DPE,GR, GR2,GR2,GR, GR, GR2,GR, GR, GR2,GR, GR2,GR, GF, GR],
  // Row 1: Grandma's roof area — GR2 clusters near building
  [GR, GR2,GR2,GF, GR, GR, GR2,GR, GR, GR2,GR2,GR, GR, GR, DPL,DPE,GR, GR2,GR, GR, GR2,GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 2: Grandma's walls — flower grass near building & east meadow
  [GF, GR2,GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR2,GR, DPL,DPE,GR, GR, GR2,GR, GR, GR, GF, GR2,GR2,GR, GR, GR2,GR, GR],
  // Row 3: Grandma's fenced yard — GF cluster near fence
  [GR, GR2,GR2,GF, GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, DPL,DPE,GR, GR2,GR, GR, GR2,GR, GF, GR2,GR2,GR, GR, GR, GR, GR2],
  // Row 4: garden area — GR2 clusters near path & garden
  [GR, GR, GR2,GR2,GF, GR, GR, GR2,GR, GR, GR2,GR2,GR, GR, DPL,DPE,GR2,GR, GR, GR2,GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GF],
  // Row 5: plaza — path widens to 3 cols (13-15), T-junction top
  [GR, GR2,GR, GF, GR2,GR2,GR, GR2,GR, GF, GR2,GR, GR, DPL,DP, DPE,GR, GR2,GF, GR, GR2,GR, GR, GR2,GR2,GR, GR, GR2,GR, GR],
  // Row 6: E-W path (cols 6-15). DP center at intersection.
  [GR, GR2,GR, GR2,GR, GF, DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DP, DP, GF, GR, GR2,GR2,GR, GR2,GR, GR, GR2,GR, GR, GR2,GR2,GR],
  // Row 7: below E-W path — bottom edge of E-W at cols 6-13
  [GR, GR, GR2,GF, GR2,GR, DPE,DPE,DPE,DPE,DPE,DPE,DPE,DPE,DPL,DPE,GR2,GF, GR2,GR, GR, GR2,GR, GR2,GR, GR, GR2,GR, GR, GR2],
  // Row 8: signpost area — N-S path continues
  [GR, GR2,GR2,GF, GR, GR2,GR, GR, GR2,GF, GR2,GR, GR, GR, DPL,DPE,GR, GR2,GF, GR2,GR, GR, GR2,GR, GR2,GR, GR, GR2,GR, GR],
  // Row 9: well area — flower grass west near well, GR2 clusters
  [GR, GF, GR2,GR2,GR, GR2,GR, GR, GR2,GR, GR, GR2,GR2,GR, DPL,DPE,GR, GR2,GR, GR, GR2,GR2,GR, GR, GR2,GR, GR, GR2,GR, GR2],
  // Row 10: well base — flower grass east cluster
  [GR, GF, GR2,GR2,GR, GR2,GR, GR2,GR, GR, GR2,GR, GR, GR, DPL,DPE,GR, GR2,GR, GR2,GR, GF, GR2,GR2,GR, GR, GR2,GR, GR, GR],
  // Row 11: Baker's roof area — path edges, GR2 clusters near baker
  [GR, GR2,GR, GR2,GR, GR, GR2,GR, GR2,GR, GR, GR2,GR, GR, DPL,DPE,GR, GF, GR, GR2,GR, GR, GR2,GR2,GR, GR, GR2,GR, GR, GR2],
  // Row 12: E-W path to baker (cols 4-15). Full center at intersection.
  [GR, GR2,GR, GF, DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DP, DP, GF, GR, GR2,GR, GR2,GR, GR2,GR, GR, GR2,GR, GR2,GR, GR],
  // Row 13: below E-W path — bottom edge at cols 4-13
  [GR, GR, GR2,GR2,DPE,DPE,DPE,DPE,DPE,DPE,DPE,DPE,DPE,DPE,DPL,DPE,GR, GR2,GR, GR2,GR, GR2,GR, GF, GR2,GR, GR2,GR, GR2,GR],
  // Row 14: barrel/crate near baker — GR2/GF clusters
  [GR, GR2,GR2,GR, GR2,GR, GR, GR2,GR, GR2,GR, GR2,GR, GR, DPL,DPE,GR, GR2,GR, GR2,GR, GR, GF, GR2,GR2,GR, GR, GR2,GR, GR],
  // Row 15: pond top row — flower grass near pond
  [GR, GR2,GF, GR2,GR, GR, GR2,GF, GR, GR2,GR, GR2,GR, GR, DPL,DPE,GR, GR2,GR, GF, GR2,GR, GR2,GR, GR, GR2,GF, GR2,GR, GR],
  // Row 16: pond mid, Lily's roof — GR2 cluster near Lily
  [GR, GR, GR2,GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, DPL,DPE,GR, GF, GR, GR2,GR, GR, GR2,GR2,GR, GR, GR2,GR, GR, GR2],
  // Row 17: pond bottom, Lily's walls — flower grass near Lily
  [GR, GR2,GR, GR2,GR, GR, GR, GR2,GR, GR2,GR2,GR, GR, GR, DPL,DPE,GR, GR2,GR, GR2,GR, GR, GR2,GF, GR2,GR, GR, GR2,GR, GR],
  // Row 18: bench at pond, Lily's fenced yard — GF near pond & Lily
  [GR, GR2,GF, GR, GR2,GF, GR, GR2,GF, GR2,GR2,GR, GR2,GR, DPL,DPE,GR, GR2,GF, GR2,GR, GR2,GR, GF, GR2,GR2,GR, GR, GR2,GR],
  // Row 19: tree border south — exit gap at 14-15
  [GR, GR, GR2,GF, GR2,GR, GR, GR2,GR2,GR, GR2,GR, GR, GR, DPL,DPE,GR, GR2,GR, GR2,GR, GR, GR2,GR, GR2,GR, GF, GR2,GR, GR],
]);

// ── OBJECTS LAYER ─────────────────────────────────────────────────────────
// Buildings, tree trunks, fences, water, decorations.
// -1 = empty (E). Tree trunks go HERE; canopies go in foreground.
// Objects on ~35% of tiles; the rest is open green grass.
//
// Building composition (verified per TILE-REFERENCE):
//   Grandma (cols 4-8): Roof = 63,64,64,64,65 | Walls = 72,73,73,74,75
//   Baker (cols 18-22): Roof = 63,64,64,64,65 | Walls = 84,85,85,86,87
//   Lily (cols 18-22):  Roof = 63,64,64,64,65 | Walls = 72,73,73,74,75
//
// Fences: FNL(96) at left, FNM(97) mid, FNR(98) at right — no gate tile
//   in this tileset, so FNM with collision=0 acts as walkable gate opening.
//
// Water pond (3x3 at cols 4-6, rows 15-17):
//   109, 110, 111  (TL, T, TR)
//   121, 122, 123  (L, center, R)
//   120, 112, 113  (BL, B, BR)

// prettier-ignore
const objects = grid([
  // Row 0: tree border — staggered, mixed types, gaps, flowers
  [TB1,TB2,E,  FLR,E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,FLY,E  ],
  // Row 1: Grandma's cottage roof (cols 4-8): RFL, RFM, RFM, RFM, RFR
  [TB1,TB2,E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E  ],
  // Row 2: Grandma's walls (cols 4-8): WLL, WLW, WLM, WLD, WLW — door at col 7
  [FLR,FLB,E,  E,  WLL,WLW,WLM,WLD,WLW,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLY,FLR,E,  E,  E,  TB1,TB2,E  ],
  // Row 3: Grandma's fenced yard (cols 4-8): FNL, FNM, FNM, (gap=gate), FNR
  [E,  E,  BSH_S,E, FNL,FNM,FNM,E,  FNR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLB,FLY,E,  E,  E,  E,  E,  E  ],
  // Row 4: garden plot at col 6, barrel at col 8, bush understory
  [E,  E,  E,  E,  E,  E,  PLT,E,  BRL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLR],
  // Row 5: mailbox at col 3, signpost at 17, bench at 21, lantern at 22
  [E,  E,  E,  MLX,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  BNC,LNT,E,  E,  E,  E,  E,  E,  E  ],
  // Row 6: tree grove left (trunks at 1-2), E-W path clear
  [E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 7: tree trunks left (1-2), trees right (20-21), bush near right trees
  [E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH_S,TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 8: signpost at col 10, trees right (20-21), bush understory
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  E,  E,  BSH_L,TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 9: well top at col 10, flowers west at 1-2
  [E,  FLR,FLY,E,  E,  E,  E,  E,  E,  E,  WEL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH_S,E,  E,  E  ],
  // Row 10: well base at 10, bench at 16, flowers east 21-22
  [E,  FLB,FLR,E,  E,  E,  E,  E,  E,  E,  WEB,E,  E,  E,  E,  E,  BNC,E,  E,  E,  E,  FLY,FLR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 11: Baker's shop roof at cols 18-22: RFL, RFM, RFM, RFM, RFR
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 12: tree grove left trunks, Baker walls (18-22): SWL, SWW, SWD, SWM, SWW
  [E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SWL,SWW,SWD,SWM,SWW,E,  E,  E,  E,  E,  E,  E  ],
  // Row 13: tree trunks lower, Baker fenced yard (18-22): FNL, FNM, (gap=gate), FNM, FNR + flower
  [E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FNL,FNM,E,  FNM,FNR,FLR,E,  E,  E,  E,  E,  E  ],
  // Row 14: barrel(18), crate(19), flowers east at 22-23
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BRL,CRT,E,  E,  FLY,FLB,E,  E,  E,  E,  E,  E  ],
  // Row 15: pond top (cols 4-6): WTL, WTM, WTR — bush at 8, flower at 26
  [E,  E,  E,  E,  WTL,WTM,WTR,E,  BSH_L,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLR,E,  E,  E  ],
  // Row 16: pond mid (cols 4-6): WML, WMM, WMR — Lily's roof at 18-22
  [E,  E,  E,  E,  WML,WMM,WMR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 17: pond bottom (cols 4-6): WBL, WBM, WBR — Lily's walls at 18-22, plant at 9
  [E,  E,  E,  E,  WBL,WBM,WBR,E,  E,  PLT,E,  E,  E,  E,  E,  E,  E,  E,  WLL,WLW,WLD,WLM,WLW,FLY,E,  E,  E,  E,  E,  E  ],
  // Row 18: bench facing pond at 3, Lily fenced yard 18-22, mailbox 17
  [E,  E,  E,  BNC,E,  FLR,E,  E,  FERN,E,  E,  E,  E,  E,  E,  E,  E,  MLX,FNL,FNM,E,  FNM,FNR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 19: tree border south — staggered, south exit gap at cols 14-15
  [TB1,TB2,E,  BSH_S,E,  E,  BSH_L,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLB,E,  TB1,TB2],
]);

// ── COLLISION LAYER ───────────────────────────────────────────────────────
// 0 = walkable, 1 = blocked
// Buildings, fences (except gate gaps), tree trunks, well, water, benches = blocked
// Doors are walkable (collision = 0) so NPCs can stand near them
// All NPC home positions verified on walkable tiles

// prettier-ignore
const collision = grid([
  // Row 0: trees(0-1), flower(3), trees(6-7), trees(26-27), flower(28)
  [1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
  // Row 1: trees(0-1), roof blocked(4-8), trees(26-27)
  [1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0],
  // Row 2: flowers(0-1), walls blocked(4-8) door at 7 walkable, flowers(22-23), tree(27-28)
  [0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0],
  // Row 3: bush(2), fence blocked(4-6,8) gate at 7 walkable, flowers(22-23)
  [0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 4: garden(6), barrel(8), flower(29)
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 5: mailbox(3), sign(17), bench(21), lantern(22)
  [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0],
  // Row 6: tree trunks(1-2)
  [0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 7: tree trunks(1-2), bush(19), trees right(20-21)
  [0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0],
  // Row 8: sign(10), bush(19), trees right(20-21)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0],
  // Row 9: flowers(1-2), well(10), bush(26)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  // Row 10: flowers(1-2), well base(10), bench(16), flowers(21-22)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 11: Baker roof blocked(18-22)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
  // Row 12: tree trunks(1-2), Baker walls blocked(18-22) door at 20 walkable
  [0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 13: tree trunks(1-2), Baker fence blocked(18-19,21-22) gate at 20 walkable
  [0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 14: barrel(18), crate(19), flowers(22-23)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  // Row 15: pond water blocked(4-6), bush(8)
  [0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 16: pond water blocked(4-6), Lily roof blocked(18-22)
  [0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
  // Row 17: pond water blocked(4-6), plant(9), Lily walls blocked(18-22) door at 20 walkable
  [0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 18: bench(3), flower(5), fern(8), mailbox(17), Lily fence blocked(18-19,21-22) gate at 20 walkable
  [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 19: tree trunks(0-1), bushes(3,6), flower(26), trees(28-29)
  [1,1,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
]);

// ── FOREGROUND LAYER ──────────────────────────────────────────────────────
// Tree canopies drawn OVER entities. When the princess walks under a tree,
// the canopy covers her sprite — THIS is what makes the world feel 3D.
// Canopies placed ONE ROW ABOVE trunks so they overlap entities at trunk level.
// Mixed canopy types: CAN_L/CAN_R (green), CAN_A (autumn), CAN_P (pine), CAN_S (small)

// prettier-ignore
const foreground = grid([
  // Row 0: canopies for trees whose trunks are at row 0 (cols 0-1, 6-7, 26-27)
  // Also canopies for row 1 trunks (cols 0-1, 26-27) overlap here
  [CAN_L,CAN_R,E,  E,  E,  E,  CAN_L,CAN_R,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_P,CAN_S,E,  E  ],
  // Row 1: second row of canopy for row 0 trunks + canopy for row 1 trunks
  [CAN_A,CAN_S,E,  E,  E,  E,  CAN_A,CAN_S,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_L,CAN_R,E,  E  ],
  // Row 2: canopy for right border trees at row 2 (trunks 27-28)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_L,CAN_R,E  ],
  // Row 3-4: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 5: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 6: canopies for left grove (trunks rows 6-7 cols 1-2)
  [E,  CAN_L,CAN_R,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 7: canopy overlap for left grove + right grove canopies (trunks rows 7-8 cols 20-21)
  [E,  CAN_A,CAN_S,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_L,CAN_R,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 8: right grove canopy overlap
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_A,CAN_S,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 9-11: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 12: canopies for left grove (trunks rows 12-13 cols 1-2)
  [E,  CAN_L,CAN_R,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 13: canopy overlap for bottom-left grove
  [E,  CAN_P,CAN_S,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 14-18: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 19: canopies for south border trees (trunks row 19 cols 0-1, 28-29)
  [CAN_L,CAN_R,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_P,CAN_S],
]);

// ── NPCs ──────────────────────────────────────────────────────────────────
// All homeX/homeY positions verified on walkable tiles (collision=0).

const npcs = [
  {
    id: 'grandma-rose',
    name: 'Grandma Rose',
    spriteName: 'npc_grandma',
    homeX: 7,       // at her door (col 7, row 4 — walkable via gate)
    homeY: 4,       // yard grass between fence and garden
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
    homeX: 20,      // on the walkable door tile of her house (col 20, row 17)
    homeY: 17,      // at her door (collision=0)
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
    homeX: 8,       // near the village square, on the grass east of the west path
    homeY: 9,       // on walkable ground near the well area
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
    homeX: 20,      // on the walkable door tile of his shop (col 20, row 12)
    homeY: 14,      // in front of his shop, on walkable ground near barrels
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
// Positions verified on walkable tiles OR intentionally decorative.

const worldObjects = [
  // ── Grandma's area (upper-left) — 5 objects ──
  { type: 'WIND_CHIMES',   x: 5,  y: 1,  id: 'wind-chimes-01' },
  { type: 'GARDEN_PLOT',   x: 6,  y: 4,  id: 'garden-plot-01' },
  { type: 'FLOWER_BIG',    x: 0,  y: 2,  id: 'flower-big-01' },
  { type: 'FLOWER_BIG',    x: 1,  y: 2,  id: 'flower-big-02' },
  { type: 'MAILBOX',       x: 3,  y: 5,  id: 'mailbox-grandma' },

  // ── Village square / well area (center) — 5 objects ──
  { type: 'WELL',          x: 10, y: 9,  id: 'village-well' },
  { type: 'SIGNPOST',      x: 10, y: 8,  id: 'signpost-01' },
  { type: 'SIGNPOST',      x: 17, y: 5,  id: 'signpost-north' },
  { type: 'BENCH',         x: 21, y: 5,  id: 'bench-square-01' },
  { type: 'BENCH',         x: 16, y: 10, id: 'bench-square-02' },

  // ── East meadow flowers — 3 objects ──
  { type: 'FLOWER_SMALL',  x: 22, y: 2,  id: 'flower-east-01' },
  { type: 'FLOWER_SMALL',  x: 23, y: 2,  id: 'flower-east-02' },
  { type: 'FLOWER_SMALL',  x: 21, y: 10, id: 'flower-east-03' },

  // ── Baker's area (center-right) — 4 objects ──
  { type: 'APPLE_BASKET',  x: 19, y: 14, id: 'apple-basket-baker' },
  { type: 'FLOWER_SMALL',  x: 23, y: 13, id: 'flower-baker-01' },
  { type: 'DANDELION',     x: 22, y: 14, id: 'dandelion-baker' },
  { type: 'LANTERN',       x: 22, y: 5,  id: 'lantern-path-01' },

  // ── Lily's area (lower-right) — 3 objects ──
  { type: 'HANGING_LAUNDRY', x: 23, y: 17, id: 'laundry-lily' },
  { type: 'MAILBOX',       x: 17, y: 18, id: 'mailbox-lily' },
  { type: 'FLOWER_SMALL',  x: 9,  y: 17, id: 'flower-lily-area' },

  // ── Pond area (lower-left) — 3 objects ──
  { type: 'POND',          x: 5,  y: 16, id: 'village-pond' },
  { type: 'BENCH',         x: 3,  y: 18, id: 'bench-pond' },
  { type: 'FLOWER_SMALL',  x: 5,  y: 18, id: 'flower-pond-01' },

  // ── Scattered for discovery — 3 more ──
  { type: 'DANDELION',     x: 9,  y: 4,  id: 'dandelion-meadow' },
  { type: 'FLOWER_SMALL',  x: 1,  y: 9,  id: 'flower-west-01' },
  { type: 'FLOWER_SMALL',  x: 22, y: 10, id: 'flower-center-east' },
];

// ── Ambient Animals ───────────────────────────────────────────────────────
// 12 animals distributed to fill the world with life. Each has a roaming zone.

const animals = [
  // Butterflies — near flowers (3 total)
  { type: 'BUTTERFLY', x: 3,  y: 3,  spriteName: 'butterfly', zone: { x: 1, y: 1, w: 8, h: 5 } },
  { type: 'BUTTERFLY', x: 22, y: 3,  spriteName: 'butterfly', zone: { x: 20, y: 1, w: 6, h: 5 } },
  { type: 'BUTTERFLY', x: 9,  y: 17, spriteName: 'butterfly', zone: { x: 4, y: 15, w: 8, h: 4 } },

  // Birds — near trees (2 total)
  { type: 'BIRD', x: 2,  y: 6,  spriteName: 'bird', zone: { x: 0, y: 5, w: 6, h: 4 } },
  { type: 'BIRD', x: 21, y: 7,  spriteName: 'bird', zone: { x: 19, y: 6, w: 6, h: 4 } },

  // Cat — sleeping near village square
  { type: 'CAT', x: 8,  y: 10, spriteName: 'cat', zone: { x: 6, y: 8, w: 6, h: 5 } },

  // Frogs — near pond (2 total)
  { type: 'FROG', x: 3,  y: 16, spriteName: 'frog', zone: { x: 2, y: 15, w: 6, h: 4 } },
  { type: 'FROG', x: 8,  y: 17, spriteName: 'frog', zone: { x: 4, y: 16, w: 6, h: 3 } },

  // Ducks — on/near pond
  { type: 'DUCK', x: 5,  y: 15, spriteName: 'duck', zone: { x: 4, y: 15, w: 4, h: 3 } },

  // Dog — near Finn / village square
  { type: 'DOG', x: 9,  y: 9,  spriteName: 'dog', zone: { x: 7, y: 8, w: 6, h: 4 } },

  // Squirrel — near tree groves
  { type: 'SQUIRREL', x: 3, y: 12, spriteName: 'squirrel', zone: { x: 1, y: 11, w: 5, h: 4 } },

  // Ladybug — near Lily's flowers
  { type: 'LADYBUG', x: 22, y: 18, spriteName: 'ladybug', zone: { x: 18, y: 17, w: 6, h: 3 } },
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
        pickupX: 6,
        pickupY: 4,
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
