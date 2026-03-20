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
 * Grass mix: 60% plain (tile 1), 30% variant with flowers (tile 2)
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
// VERIFIED by visual inspection of tilemap_packed.png (192x176)
// Tile ID = row * 12 + col

// GROUND TILES — fill every cell, grass dominant
const GR  = 1;    // plain green grass — Row 0, Col 1
const GR2 = 2;    // grass with tiny flowers — Row 0, Col 2
const GF  = 2;    // alias for GR2 (flower grass accent)

// PATH TILES — dirt, only 10-15% of ground
const DP  = 24;   // dirt path center — Row 2, Col 0
const DPT = 25;   // path edge top (grass above)
const DPR = 26;   // path edge right (grass right)
const CTR = 27;   // path corner top-right
const DPB = 28;   // path edge bottom (grass below)
const CBR = 29;   // path corner bottom-right
const DPL = 32;   // path edge left (grass left)
const CTL = 33;   // path corner top-left
const CBL = 36;   // path corner bottom-left

// EMPTY (for object/foreground layers)
const E   = -1;

// TREE TILES (objects layer = trunks, foreground layer = canopies)
const TT1 = 4;    // tree canopy top-left (round green) — Row 0, Col 4
const TT2 = 5;    // tree canopy top-right (round green) — Row 0, Col 5
const TT3 = 7;    // tree canopy top-left (autumn) — Row 0, Col 7
const TT4 = 10;   // pine tree top — Row 0, Col 10
const TB1 = 12;   // tree trunk-left — Row 1, Col 0
const TB2 = 13;   // tree trunk-right — Row 1, Col 1

// BUSHES AND SMALL PLANTS
const BSH = 14;   // bush/shrub — Row 1, Col 2
const PLT = 6;    // small full tree (1 tile) — Row 0, Col 6

// ROOFS — BROWN (Row 5: IDs 60-71)
const RFL = 60;   // roof top-left — Row 5, Col 0
const RFM = 61;   // roof top-center — Row 5, Col 1
const RFR = 62;   // roof top-right — Row 5, Col 2

// WALLS — WOOD (Row 6: IDs 72-83)
const WLL = 72;   // wood wall left — Row 6, Col 0
const WLM = 73;   // wood wall center — Row 6, Col 1
const WLD = 75;   // wood door — Row 6, Col 3
const WLW = 76;   // wood wall with window — Row 6, Col 4

// WALLS — STONE (for baker's shop)
const SWL = 72;   // stone wall left (reuse wood for consistency)
const SWM = 73;   // stone wall center
const SWD = 75;   // stone door
const SWW = 76;   // stone window

// FENCES (Row 4: IDs 48-59)
const FNH = 48;   // fence horizontal — Row 4, Col 0
const FNV = 49;   // fence vertical — Row 4, Col 1
const FCT = 50;   // fence corner top-left — Row 4, Col 2
const FCR = 51;   // fence corner top-right — Row 4, Col 3
const FCB = 52;   // fence corner bottom-left — Row 4, Col 4
const FCD = 53;   // fence corner bottom-right — Row 4, Col 5
const FGT = 54;   // fence gate — Row 4, Col 6
// Aliases
const FNL = FCT;  // fence left = corner TL
const FNM = FNH;  // fence mid = horizontal
const FNR = FCR;  // fence right = corner TR

// WATER TILES — CORRECTED per visual inspection
const WTL = 38;   // water edge top-left — Row 3, Col 2
const WTM = 39;   // water edge top — Row 3, Col 3
const WTR = 40;   // water edge top-right — Row 3, Col 4
const WMM = 108;  // water center (full) — Row 9, Col 0
const WML = 109;  // water edge left — Row 9, Col 1
const WMR = 110;  // water edge right — Row 9, Col 2
const WBL = 111;  // water edge bottom-left — Row 9, Col 3
const WBM = 112;  // water edge bottom — Row 9, Col 4
const WBR = 113;  // water edge bottom-right — Row 9, Col 5

// DECORATIONS & FURNITURE — CORRECTED per visual inspection
const WEL = 96;   // well — Row 8, Col 0
const WEB = 96;   // well (single tile, use same for top/bottom display)
const BRL = 97;   // barrel — Row 8, Col 1
const BNC = 106;  // bench — Row 8, Col 10
const FLR = 116;  // red flowers — Row 9, Col 8
const FLY = 117;  // yellow flowers — Row 9, Col 9
const FLB = 118;  // blue flowers — Row 9, Col 10
const SGN = 55;   // signpost — Row 4, Col 7
const STN = 97;   // crate/barrel (reuse barrel)
const MLX = 55;   // mailbox (signpost variant)

// ── GROUND LAYER ──────────────────────────────────────────────────────────
// Every cell filled. ~89% grass (GR/GR2), ~11% path (DP).
// Grass mix: 60% GR (plain green), 30% GR2 (green+flowers), clustered organically.
// N-S path at cols 14-15, E-W branches at rows 6 and 12.
// Path only 2 tiles wide. Ground under buildings/water is STILL grass.

// prettier-ignore
const ground = grid([
  // Row 0: tree border top
  [GR, GR2,GR, GF, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR, GF, GR],
  // Row 1: Grandma's roof area
  [GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, DP, DP, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR],
  // Row 2: Grandma's walls
  [GF, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, DP, DP, GR, GR, GR, GR, GR, GR, GF, GR2,GR, GR, GR, GR, GR, GR],
  // Row 3: Grandma's fenced yard
  [GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GF, GR2,GR, GR, GR, GR, GR, GR2],
  // Row 4: garden area, path continues
  [GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, DP, DP, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR, GF],
  // Row 5: mailbox, path widens to 3 at plaza
  [GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, DP, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR],
  // Row 6: E-W path branch
  [GR, GR, GR, GR2,GR, GR, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR],
  // Row 7: path fork, trees east
  [GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR],
  // Row 8: signpost area
  [GR, GR2,GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR],
  // Row 9: well, village square — flowers west
  [GR, GF, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, DP, DP, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR2],
  // Row 10: well base, flowers east
  [GR, GF, GR2,GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GF, GR2,GR, GR, GR, GR, GR, GR, GR],
  // Row 11: Baker's roof
  [GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR],
  // Row 12: E-W path to baker, baker walls
  [GR, GR, GR, GR, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR],
  // Row 13: baker fenced yard
  [GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GF, GR, GR, GR2,GR, GR, GR],
  // Row 14: barrel/crate near baker
  [GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GF, GR2,GR, GR, GR, GR, GR, GR],
  // Row 15: pond top row
  [GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GF, GR, GR, GR],
  // Row 16: pond mid, Lily's roof
  [GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR],
  // Row 17: pond bottom, Lily's walls
  [GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GF, GR, GR, GR, GR, GR, GR],
  // Row 18: bench at pond, Lily's fenced yard
  [GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR],
  // Row 19: tree border south, exit gap at 14-15
  [GR, GR, GR2,GF, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GF, GR, GR, GR],
]);

// ── OBJECTS LAYER ─────────────────────────────────────────────────────────
// Buildings, tree trunks, fences, water, decorations.
// -1 = empty (E). Tree trunks go HERE; canopies go in foreground.
// Objects on ~35% of tiles; the rest is open green grass.

// prettier-ignore
const objects = grid([
  // Row 0: tree border — staggered, mixed types, gaps for light, flowers
  [TB1,TB2,E,  FLR,E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,FLY,E  ],
  // Row 1: Grandma's cottage roof at cols 4-8
  [TB1,TB2,E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E  ],
  // Row 2: Grandma's walls — window, door at col 7, flowers east
  [FLR,FLB,E,  E,  WLW,WLM,WLM,WLD,WLW,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLY,FLR,E,  E,  E,  TB1,TB2,E  ],
  // Row 3: Grandma's fenced yard — fence cols 4-8
  [E,  E,  E,  E,  FNL,FNM,FNM,FGT,FNR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLB,FLY,E,  E,  E,  E,  E,  E  ],
  // Row 4: garden plot at col 6, barrel at col 8
  [E,  E,  E,  E,  E,  E,  PLT,E,  BRL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLR],
  // Row 5: mailbox at col 3, lantern at 17, bench at 21
  [E,  E,  MLX,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 6: tree grove left (trunks at 1-2), E-W path clear
  [E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 7: tree trunks left (1-2), trees right (20-21)
  [E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 8: signpost at col 10, trees right (20-21)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 9: well top at col 10, flowers west at 1-2
  [E,  FLR,FLY,E,  E,  E,  E,  E,  E,  E,  WEL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E  ],
  // Row 10: well base at 10, bench at 16, flowers east 21-22
  [E,  FLB,FLR,E,  E,  E,  E,  E,  E,  E,  WEB,E,  E,  E,  E,  E,  BNC,E,  E,  E,  E,  FLY,FLR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 11: Baker's shop roof at cols 18-22
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 12: tree grove left trunks, E-W path clear, Baker walls 18-22
  [E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SWL,SWW,SWD,SWM,SWW,E,  E,  E,  E,  E,  E,  E  ],
  // Row 13: tree trunks lower, Baker fenced yard 18-22, flowers at 23
  [E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FNL,FNM,FGT,FNM,FNR,FLR,E,  E,  E,  E,  E,  E  ],
  // Row 14: barrel(18), crate(19), flowers east at 22-23
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BRL,STN,E,  E,  FLY,FLB,E,  E,  E,  E,  E,  E  ],
  // Row 15: pond top row at cols 4-6 (3 wide), bush at 8, flower at 26
  [E,  E,  E,  E,  WTL,WTM,WTR,E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLR,E,  E,  E  ],
  // Row 16: pond mid row, Lily's roof at cols 18-22
  [E,  E,  E,  E,  WML,WMM,WMR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 17: pond bottom row, Lily's walls at 18-22, flower at 23
  [E,  E,  E,  E,  WBL,WBM,WBR,E,  E,  PLT,E,  E,  E,  E,  E,  E,  E,  E,  WLL,WLW,WLD,WLM,WLW,FLY,E,  E,  E,  E,  E,  E  ],
  // Row 18: bench facing pond at 3, Lily fenced yard 18-22, mailbox 17
  [E,  E,  E,  BNC,E,  E,  E,  E,  PLT,E,  E,  E,  E,  E,  E,  E,  E,  MLX,FNL,FNM,FGT,FNM,FNR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 19: tree border south — staggered, south exit gap at cols 14-15
  [TB1,TB2,E,  BSH,E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLB,E,  TB1,TB2],
]);

// ── COLLISION LAYER ───────────────────────────────────────────────────────
// 0 = walkable, 1 = blocked
// Buildings, fences (except gates), tree trunks, well, water, benches = blocked
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
  // Row 3: fence blocked(4-8) gate at 7 walkable, flowers(22-23)
  [0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 4: garden(6), barrel(8), flower(29)
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 5: mailbox(2), sign(17), bench(21)
  [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0],
  // Row 6: tree trunks(1-2)
  [0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 7: tree trunks(1-2), trees right(20-21)
  [0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
  // Row 8: sign(10), trees right(20-21)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
  // Row 9: flowers(1-2), well(10), bush(26)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  // Row 10: flowers(1-2), well base(10), bench(16), flowers(21-22)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 11: Baker roof blocked(18-22)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
  // Row 12: tree trunks(1-2), Baker walls blocked(18-22) door at 20 walkable
  [0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 13: tree trunks(1-2), Baker fence blocked(18-22) gate at 20 walkable, flower(23)
  [0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 14: barrel(18), crate(19), flowers(22-23)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  // Row 15: pond water blocked(4-6), bush(8)
  [0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 16: pond water blocked(4-6), Lily roof blocked(18-22)
  [0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
  // Row 17: pond water blocked(4-6), Lily walls blocked(18-22) door at 20 walkable
  [0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 18: bench(3), plant(8), mailbox(17), Lily fence blocked(18-22) gate at 20 walkable
  [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 19: tree trunks(0-1), bushes(3,6), flower(26), trees(28-29)
  [1,1,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
]);

// ── FOREGROUND LAYER ──────────────────────────────────────────────────────
// Tree canopies drawn OVER entities. When the princess walks under a tree,
// the canopy covers her sprite — THIS is what makes the world feel 3D.
// Canopies placed ONE ROW ABOVE trunks so they overlap entities at trunk level.

// prettier-ignore
const foreground = grid([
  // Row 0: canopies for trees at rows 0-1 (cols 0-1, 6-7, 26-27)
  [TT1,TT2,E,  E,  E,  E,  TT1,TT2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT1,TT2,E,  E  ],
  // Row 1: canopy overlap for row 0/1 trees
  [TT3,TT4,E,  E,  E,  E,  TT3,TT4,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT3,TT4,E,  E  ],
  // Row 2: canopy for right border trees at row 2 (27-28)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT1,TT2,E  ],
  // Row 3-4: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 5: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 6: canopies for left grove (trunks rows 6-7 cols 1-2)
  [E,  TT1,TT2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 7: canopy overlap for left grove + right grove canopies (trunks rows 7-8 cols 20-21)
  [E,  TT3,TT4,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT1,TT2,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 8: right grove canopy overlap
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT3,TT4,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 9-11: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 12: canopies for left grove (trunks rows 12-13 cols 1-2)
  [E,  TT1,TT2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 13: canopy overlap for bottom-left grove
  [E,  TT3,TT4,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 14-18: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 19: canopies for south border trees (trunks row 19 cols 0-1, 28-29)
  [TT1,TT2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT1,TT2],
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
  { type: 'MAILBOX',       x: 2,  y: 5,  id: 'mailbox-grandma' },

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
  { type: 'LANTERN',       x: 17, y: 5,  id: 'lantern-path-01' },

  // ── Lily's area (lower-right) — 3 objects ──
  { type: 'HANGING_LAUNDRY', x: 23, y: 17, id: 'laundry-lily' },
  { type: 'MAILBOX',       x: 17, y: 18, id: 'mailbox-lily' },
  { type: 'FLOWER_SMALL',  x: 9,  y: 17, id: 'flower-lily-area' },

  // ── Pond area (lower-left) — 3 objects ──
  { type: 'POND',          x: 5,  y: 16, id: 'village-pond' },
  { type: 'BENCH',         x: 3,  y: 18, id: 'bench-pond' },
  { type: 'FLOWER_SMALL',  x: 8,  y: 18, id: 'flower-pond-01' },

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
  { baseTile: 108, frames: [108, 109, 108, 110] },  // water center shimmer
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
