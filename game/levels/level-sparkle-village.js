/**
 * level-sparkle-village.js — Sparkle Village for Princess Sparkle V2
 *
 * 30x20 tile grid (480x320 pixels — exactly one screen).
 *
 * Tile IDs reference the Kenney Tiny Town tileset (tilemap_packed.png):
 *   192x176 PNG, 12 columns x 11 rows of 16x16 tiles = 132 tiles.
 *   Tile ID = row * 12 + col.
 *
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — SPARKLE VILLAGE (30 wide x 20 tall)                ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  Row 0:  TTT.........PP..........TTT  Tree border staggered     ║
 * ║  Row 1:  T.~.RRRRR..PP..........TT.  Grandma cottage roof      ║
 * ║  Row 2:  ..~.WWWDW..PP.....~~...T..  Walls+door, flowers       ║
 * ║  Row 3:  ..~.FFFFF.PPP.....~~.......  Fenced yard, path widens ║
 * ║  Row 4:  ......G...PP...............  Garden plot, main path    ║
 * ║  Row 5:  ..........PP.......B.......  Path continues, bench     ║
 * ║  Row 6:  .TTT..PPPPPPPPPP...........  Tree grove, E-W path     ║
 * ║  Row 7:  .TTT..PP....PP....TTT......  Trees, path fork, trees  ║
 * ║  Row 8:  ......PP....PP....TTT......  Path continues            ║
 * ║  Row 9:  ..~...PP...*PP.............  Well at square center     ║
 * ║  Row 10: ..~...PP....PP.....~~......  Path, flowers             ║
 * ║  Row 11: ......PP....PP.RRRRR.......  Baker's shop roof         ║
 * ║  Row 12: .TTT..PPPPPPPP.WWWDW......  Trees, E-W path, walls   ║
 * ║  Row 13: .TTT........PP.FFFFF...~...  Fenced yard              ║
 * ║  Row 14: ............PP.........~...  Path south                ║
 * ║  Row 15: ....WWWW....PP.............  Pond area (W=water)       ║
 * ║  Row 16: ....WWWW....PP...RRRRR.....  Pond, Lily's house roof  ║
 * ║  Row 17: ....WWWW....PP...WWWDW.....  Water edges, walls       ║
 * ║  Row 18: ............PP...FFFFF.....  Fenced yard               ║
 * ║  Row 19: TTT.........PP..........TTT  Tree border, exit south  ║
 * ║                                                                  ║
 * ║  Key: T=trees P=path(2wide) R=roof W=wall D=door               ║
 * ║       F=fence ~=flowers *=well G=garden B=bench .=grass         ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * DESIGN: ~70% green grass, ~15% path, ~15% buildings/objects/water
 * Paths are THIN LINES through a GREEN WORLD.
 * Grass mix: 60% plain (37), 30% variant (38), 10% flower (43)
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
//
// GROUND TILES — fill every cell, grass dominant
// Verified against visual inspection of tilemap_packed.png
const GR  = 1;    // plain grass — Row 0, Col 1 (light green)
const GR2 = 2;    // grass with tiny flowers — Row 0, Col 2
const GF  = 2;    // same as GR2 (flower grass accent)
const DP  = 24;   // dirt path center — Row 2, Col 0
const DPT = 25;   // path edge top (grass above)
const DPR = 26;   // path edge right (grass right)
const DPB = 28;   // path edge bottom (grass below)
const DPL = 32;   // path edge left (grass left)
const CTL = 33;   // path corner top-left
const CTR = 27;   // path corner top-right
const CBL = 36;   // path corner bottom-left
const CBR = 29;   // path corner bottom-right
const TJR = 30;   // path T-junction (opening right)
const TJT = 34;   // path T-junction (opening top)
const TJL = 35;   // path T-junction (opening left)
const TJB = 37;   // path T-junction (opening bottom)
const CRS = 31;   // path crossroads

// EMPTY (for object/foreground layers)
const E   = -1;

// TREE TILES (objects layer = trunks, foreground layer = canopies)
// Row 0: canopy tops, Row 1: trunks/bottoms
const TT1 = 4;    // tree canopy top-left (round green) — Row 0, Col 4
const TT2 = 5;    // tree canopy top-right (round green) — Row 0, Col 5
const TT3 = 7;    // tree canopy top-left (orange/autumn) — Row 0, Col 7
const TT4 = 10;   // pine tree top — Row 0, Col 10
const TB1 = 12;   // tree trunk-left — Row 1, Col 0
const TB2 = 13;   // tree trunk-right — Row 1, Col 1

// BUSHES AND SMALL PLANTS
const BSH = 14;   // bush/shrub — Row 1, Col 2
const BS2 = 17;   // dark bush — Row 1, Col 5
const PLT = 6;    // small full tree (1 tile) — Row 0, Col 6
const PL2 = 9;    // small orange tree (1 tile) — Row 0, Col 9
const FLW = 116;  // red flowers — Row 9, Col 8

// ROOFS — BROWN (Row 5: IDs 60-71)
const RFL = 60;   // roof top-left — Row 5, Col 0
const RFM = 61;   // roof top-center — Row 5, Col 1
const RFR = 62;   // roof top-right — Row 5, Col 2
const RFK = 66;   // chimney — Row 5, Col 6

// WALLS — WOOD (Row 6: IDs 72-83)
const WLL = 72;   // wood wall left — Row 6, Col 0
const WLM = 73;   // wood wall center — Row 6, Col 1
const WLW = 76;   // wood wall with window — Row 6, Col 4
const WLD = 75;   // wood door — Row 6, Col 3

// WALLS — STONE (Row 7: IDs 84-95)
const SWL = 78;   // stone wall left — Row 6, Col 6
const SWM = 79;   // stone wall center — Row 6, Col 7
const SWW = 82;   // stone window — Row 6, Col 10
const SWD = 81;   // stone door — Row 6, Col 9

// FENCES (Row 4: IDs 48-59)
const FNH = 48;   // fence horizontal — Row 4, Col 0
const FNV = 49;   // fence vertical — Row 4, Col 1
const FCT = 50;   // fence corner top-left — Row 4, Col 2
const FCR = 51;   // fence corner top-right — Row 4, Col 3
const FCB = 52;   // fence corner bottom-left — Row 4, Col 4
const FCD = 53;   // fence corner bottom-right — Row 4, Col 5
const FGT = 54;   // fence gate — Row 4, Col 6
// Aliases for backward compat with old names used in grid
const FNL = FCT;  // fence left = corner TL
const FNM = FNH;  // fence mid = horizontal
const FNR = FCR;  // fence right = corner TR
const FNP = FNV;  // fence post = vertical

// WATER TILES (objects layer — drawn on top of grass ground)
const WTL = 109;  // water edge top-left
const WTM = 110;  // water edge top
const WTR = 111;  // water edge top-right
const WML = 121;  // water edge mid-left
const WMM = 122;  // water center (deep)
const WMR = 123;  // water edge mid-right
const WBL = 120;  // water edge bottom-left
const WBM = 112;  // water edge bottom
const WBR = 113;  // water edge bottom-right

// DECORATIONS & FURNITURE
const BNC = 105;  // bench (dark wood)
const WEL = 92;   // well top (peaked roof)
const WEB = 104;  // well base (blue bucket/stone)
const SGN = 116;  // lamp/sign post
const MLX = 93;   // lantern / mailbox / warm light
const BRL = 107;  // barrel (brown)
const STN = 106;  // stone/crate

// ── GROUND LAYER ──────────────────────────────────────────────────────────
// Every cell filled. ~70% grass (mix of GR/GR2/GF), ~15% path (DP), ~15% under buildings.
// Grass mix: 60% GR, 30% GR2, 10% GF — clustered in organic blobs, never checkerboarded.
// Paths are exactly 2 tiles wide, widening to 3 at the one intersection (row 6).
// Path runs N-S through cols 12-13, with one E-W branch at row 6 (cols 6-15).

// prettier-ignore
const ground = grid([
  // Row 0:  TTT.........PP..........TTT   — tree border, staggered
  [GR, GR2,GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, DP, DP, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 1:  T.~.RRRRR..PP..........TT.   — Grandma cottage roof row
  [GR, GR, GF, GR, GR, GR, GR, GR, GR, GR2,GR, GR, DP, DP, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR],
  // Row 2:  ..~.WWWDW..PP.....~~...T..   — walls + door, flowers east
  [GR2,GR, GF, GR, GR, GR, GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR2,GR, GR, GF, GF, GR, GR, GR, GR, GR2,GR, GR, GR, GR],
  // Row 3:  ..~.FFFFF.PPP.....~~.......   — fenced yard, path widens to 3
  [GR, GR, GF, GR, GR, GR, GR, GR, GR, GR, GR, DP, DP, DP, GR, GR, GR, GR, GR, GF, GF, GR, GR2,GR, GR, GR, GR, GR, GR2,GR],
  // Row 4:  ......G...PP...............   — garden plot, main path
  [GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, DP, DP, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR],
  // Row 5:  ..........PP.......B.......   — path continues, bench east
  [GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR2],
  // Row 6:  .TTT..PPPPPPPPPP...........   — tree grove left, E-W path joins
  [GR, GR, GR, GR, GR2,GR, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR],
  // Row 7:  .TTT..PP....PP....TTT......   — trees, path fork N-S + continuing S
  [GR, GR, GR, GR, GR, GR, DP, DP, GR, GR2,GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR],
  // Row 8:  ......PP....PP....TTT......   — path continues
  [GR, GR2,GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, DP, DP, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR],
  // Row 9:  ..~...PP...*PP.............   — well at village square, flower west
  [GR, GR, GF, GR, GR, GR, DP, DP, GR, GR2,GR, GR, DP, DP, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2],
  // Row 10: ..~...PP....PP.....~~......   — flowers east
  [GR, GR, GF, GR, GR2,GR, DP, DP, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GF, GF, GR, GR2,GR, GR, GR, GR, GR, GR, GR],
  // Row 11: ......PP....PP.RRRRR.......   — Baker's shop roof
  [GR, GR, GR2,GR, GR, GR, DP, DP, GR, GR, GR2,GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR],
  // Row 12: .TTT..PPPPPPPP.WWWDW......   — trees, E-W path connects to baker
  [GR, GR, GR, GR, GR, GR, DP, DP, DP, DP, DP, DP, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR2],
  // Row 13: .TTT........PP.FFFFF...~...   — fenced yard, flowers
  [GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR, GF, GR, GR2,GR, GR, GR, GR],
  // Row 14: ............PP.........~...   — path south
  [GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, DP, DP, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GF, GR, GR, GR, GR, GR2,GR],
  // Row 15: ....WWWW....PP.............   — pond (water in objects layer, grass underneath)
  [GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, DP, DP, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR],
  // Row 16: ....WWWW....PP...RRRRR.....   — pond continues, Lily's house roof
  [GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR],
  // Row 17: ....WWWW....PP...WWWDW.....   — water bottom, Lily's walls
  [GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, DP, DP, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR],
  // Row 18: ............PP...FFFFF.....   — Lily's fenced yard
  [GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR, GR2,GR, DP, DP, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR, GR, GR2,GR, GR, GR],
  // Row 19: TTT.........PP..........TTT   — tree border, south exit
  [GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR, DP, DP, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR, GR],
]);

// ── OBJECTS LAYER ─────────────────────────────────────────────────────────
// Buildings, tree trunks, fences, water, decorations.
// -1 = empty (E). Tree trunks go HERE; canopies go in foreground.
// Objects only on ~40% of tiles; the rest is open green.

// prettier-ignore
const objects = grid([
  // Row 0: tree border — staggered, mixed types, gaps for light
  //         TT at 0-1, bush at 3, gap, bush at 9, gap, path gap, sign at 14, gap, bush at 22, TT at 27-28
  [TB1,TB2,E,  BSH,E,  E,  E,  E,  E,  BS2,E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E,  E,  TB1,TB2,E  ],
  // Row 1: Grandma's cottage roof — T trunk left, flowers, roof at cols 4-8
  [TB1,TB2,PL2,E,  RFL,RFM,RFK,RFM,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E  ],
  // Row 2: Grandma's walls — windows + door at col 7, flowers east at 19-20
  [E,  E,  PL2,E,  WLL,WLW,WLM,WLD,WLW,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  PL2,PLT,E,  E,  E,  E,  E,  E,  TB1,TB2,E  ],
  // Row 3: Grandma's fenced yard — fence cols 4-8, path widens col 11-13
  [E,  E,  PLT,E,  FNL,FNM,FNM,FNM,FNR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  PL2,PLT,E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 4: garden plot at col 6, grass open, barrel at 8
  [E,  E,  E,  E,  E,  E,  PLT,E,  BRL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 5: bench at col 19, lantern at 17, mailbox at 3
  [E,  E,  E,  MLX,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 6: tree grove left (trunks at 1-2, 3-4), E-W path clear, bush at 17
  [E,  TB1,TB2,TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 7: tree trunks (lower halves visible), path fork, trees right at 18-19, 20-21
  [E,  TB1,TB2,TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 8: open grass, signpost at col 10
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  E,  TB1,TB2,TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 9: well at col 10-11 (top=WEL, base=WEB), village square area
  [E,  E,  PL2,E,  E,  E,  E,  E,  E,  E,  WEL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E  ],
  // Row 10: flowers at 2, well base at 10, bench at 15, flowers east 19-20
  [E,  E,  PLT,E,  E,  E,  E,  E,  E,  E,  WEB,E,  E,  E,  E,  BNC,E,  E,  E,  PL2,PLT,E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 11: Baker's shop roof at cols 15-19
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFK,RFM,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 12: tree grove left trunks, E-W path clear, Baker's walls at 15-19
  [E,  TB1,TB2,TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SWL,SWW,SWD,SWM,SWW,E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 13: tree trunks lower, Baker's fenced yard at 15-19, flowers at 23
  [E,  TB1,TB2,TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FNL,FNM,FNM,FNM,FNR,E,  E,  E,  PL2,E,  E,  E,  E,  E,  E  ],
  // Row 14: open grass, crate at 16 (near baker), flowers at 23, barrel at 15
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BRL,STN,E,  E,  E,  E,  E,  E,  PLT,E,  E,  E,  E,  E,  E  ],
  // Row 15: pond top row at cols 4-7 (3x3+1 wide), bush at 9
  [E,  E,  E,  E,  WTL,WTM,WTM,WTR,E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 16: pond mid row, Lily's roof at cols 18-22
  [E,  E,  E,  E,  WML,WMM,WMM,WMR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFK,RFM,RFR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 17: pond bottom row, Lily's walls at 18-22
  [E,  E,  E,  E,  WBL,WBM,WBM,WBR,E,  PLT,E,  E,  E,  E,  E,  E,  E,  E,  WLL,WLW,WLD,WLM,WLW,E,  E,  E,  E,  E,  E,  E  ],
  // Row 18: Lily's fenced yard at 18-22, mailbox at 17, bench facing pond at 3
  [E,  E,  E,  BNC,E,  E,  E,  E,  PLT,E,  E,  E,  E,  E,  E,  E,  E,  MLX,FNL,FNM,FNM,FNM,FNR,E,  E,  E,  E,  E,  E,  E  ],
  // Row 19: tree border south — staggered, with south exit gap at cols 12-13
  [TB1,TB2,E,  BS2,E,  E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  BS2,E,  E,  E,  TB1,TB2],
]);

// ── COLLISION LAYER ───────────────────────────────────────────────────────
// 0 = walkable, 1 = blocked
// Buildings, fences, tree trunks, well, water, benches = blocked
// Doors are walkable (collision = 0) so NPCs can stand near them
// All NPC home positions verified on walkable tiles

// prettier-ignore
const collision = grid([
  // Row 0: tree trunks blocked (0-1), bush(3), bush(9), sign(14), bush(22), trees(27-28)
  [1,1,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,1,0],
  // Row 1: tree trunks (0-1), plant(2), roof blocked (4-8), tree trunks (27-28)
  [1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0],
  // Row 2: plant(2), walls blocked (4-8), door at col 7 walkable, plants(19-20), tree(27-28)
  [0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0],
  // Row 3: plant(2), fence blocked (4-8), path
  [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 4: garden plant(6), barrel(8)
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 5: mailbox(3), sign(17), bench(19)
  [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0],
  // Row 6: tree trunks (1-2, 3-4), bush(17)
  [0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 7: tree trunks (1-2, 3-4), trees right (18-19, 20-21)
  [0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
  // Row 8: sign(10), trees right (18-19, 20-21)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
  // Row 9: plant(2), well top(10), bush(26)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  // Row 10: plant(2), well base(10), bench(15)
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 11: Baker's roof blocked (15-19)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
  // Row 12: tree trunks (1-2, 3-4), Baker walls blocked (15-19), door at 17 walkable
  [0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0],
  // Row 13: tree trunks (1-2, 3-4), Baker fence blocked (15-19)
  [0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
  // Row 14: barrel(15), crate(16)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 15: pond water blocked (4-7), bush(9)
  [0,0,0,0,1,1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 16: pond water blocked (4-7), Lily roof blocked (18-22)
  [0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
  // Row 17: pond water blocked (4-7), Lily walls blocked (18-22), door at 20 walkable
  [0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
  // Row 18: bench(3), mailbox(17), Lily fence blocked (18-22)
  [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0],
  // Row 19: tree trunks (0-1), bushes blocked, trees (28-29)
  [1,1,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,1,1],
]);

// ── FOREGROUND LAYER ──────────────────────────────────────────────────────
// Tree canopies drawn OVER entities. When the princess walks under a tree,
// the canopy covers her sprite — THIS is what makes the world feel 3D.
// Canopies placed ONE ROW ABOVE trunks so they overlap entities at trunk level.

// prettier-ignore
const foreground = grid([
  // Row 0: canopies for trees whose trunks are at rows 0-1
  [TT1,TT2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT1,TT2,E  ],
  // Row 1: canopy overlap — trunks below at row 1 get covered, Grandma trees right
  [TT3,TT4,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT1,TT2,E  ],
  // Row 2: tree canopy continues for right border trees
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT4,TT3,E  ],
  // Row 3-5: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 6: canopies for left grove (trunks at rows 6-7 cols 1-4) + right trees (trunks row 7-8)
  [E,  TT1,TT2,TT3,TT2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 7: canopy overlap for left grove + right grove canopies
  [E,  TT4,TT3,TT1,TT4,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT1,TT2,TT3,TT2,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 8: right grove canopy overlap
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT4,TT3,TT1,TT4,E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 9-11: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 12: canopies for left grove (trunks at rows 12-13 cols 1-4)
  [E,  TT1,TT2,TT3,TT2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 13: canopy overlap for bottom-left grove
  [E,  TT4,TT3,TT1,TT4,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 14-18: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E  ],
  // Row 19: canopies for south border trees (trunks at row 19 cols 0-1, 28-29)
  [TT1,TT2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TT1,TT2],
]);

// ── NPCs ──────────────────────────────────────────────────────────────────
// All homeX/homeY positions verified on walkable tiles (collision=0).

const npcs = [
  {
    id: 'grandma-rose',
    name: 'Grandma Rose',
    spriteName: 'npc_grandma',
    homeX: 7,       // in her yard below the door (col 7, row 4 — walkable)
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
    homeX: 17,      // on the walkable door tile of his shop (col 17, row 12)
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
  { type: 'FLOWER_BIG',    x: 2,  y: 2,  id: 'flower-big-01' },
  { type: 'FLOWER_BIG',    x: 2,  y: 3,  id: 'flower-big-02' },
  { type: 'MAILBOX',       x: 3,  y: 5,  id: 'mailbox-grandma' },

  // ── Village square / well area (center) — 5 objects ──
  { type: 'WELL',          x: 10, y: 9,  id: 'village-well' },
  { type: 'SIGNPOST',      x: 10, y: 8,  id: 'signpost-01' },
  { type: 'SIGNPOST',      x: 14, y: 0,  id: 'signpost-north' },
  { type: 'BENCH',         x: 19, y: 5,  id: 'bench-square-01' },
  { type: 'BENCH',         x: 15, y: 10, id: 'bench-square-02' },

  // ── East meadow flowers — 3 objects ──
  { type: 'FLOWER_SMALL',  x: 19, y: 2,  id: 'flower-east-01' },
  { type: 'FLOWER_SMALL',  x: 20, y: 2,  id: 'flower-east-02' },
  { type: 'FLOWER_SMALL',  x: 19, y: 10, id: 'flower-east-03' },

  // ── Baker's area (center-right) — 4 objects ──
  { type: 'APPLE_BASKET',  x: 16, y: 14, id: 'apple-basket-baker' },
  { type: 'FLOWER_SMALL',  x: 23, y: 13, id: 'flower-baker-01' },
  { type: 'DANDELION',     x: 23, y: 14, id: 'dandelion-baker' },
  { type: 'LANTERN',       x: 17, y: 5,  id: 'lantern-path-01' },

  // ── Lily's area (lower-right) — 3 objects ──
  { type: 'HANGING_LAUNDRY', x: 23, y: 17, id: 'laundry-lily' },
  { type: 'MAILBOX',       x: 17, y: 17, id: 'mailbox-lily' },
  { type: 'FLOWER_SMALL',  x: 9,  y: 17, id: 'flower-lily-area' },

  // ── Pond area (lower-left) — 3 objects ──
  { type: 'POND',          x: 5,  y: 16, id: 'village-pond' },
  { type: 'BENCH',         x: 3,  y: 18, id: 'bench-pond' },
  { type: 'FLOWER_SMALL',  x: 8,  y: 18, id: 'flower-pond-01' },

  // ── Scattered for discovery — 3 more ──
  { type: 'DANDELION',     x: 9,  y: 4,  id: 'dandelion-meadow' },
  { type: 'FLOWER_SMALL',  x: 2,  y: 9,  id: 'flower-west-01' },
  { type: 'FLOWER_SMALL',  x: 20, y: 10, id: 'flower-center-east' },
];

// ── Ambient Animals ───────────────────────────────────────────────────────
// 12 animals distributed to fill the world with life. Each has a roaming zone.

const animals = [
  // Butterflies — near flowers (3 total)
  { type: 'BUTTERFLY', x: 3,  y: 3,  spriteName: 'butterfly', zone: { x: 1, y: 1, w: 8, h: 5 } },
  { type: 'BUTTERFLY', x: 19, y: 3,  spriteName: 'butterfly', zone: { x: 17, y: 1, w: 6, h: 5 } },
  { type: 'BUTTERFLY', x: 9,  y: 17, spriteName: 'butterfly', zone: { x: 4, y: 15, w: 8, h: 4 } },

  // Birds — near trees (2 total)
  { type: 'BIRD', x: 2,  y: 6,  spriteName: 'bird', zone: { x: 0, y: 5, w: 6, h: 4 } },
  { type: 'BIRD', x: 19, y: 7,  spriteName: 'bird', zone: { x: 17, y: 6, w: 6, h: 4 } },

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
    // Transition zone: bottom row path gap at cols 12-13
    zoneStartX: 12,
    zoneEndX: 13,
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
  { baseTile: 122, frames: [122, 110, 122, 121] },  // water center shimmer
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
  spawnX: 12,
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
