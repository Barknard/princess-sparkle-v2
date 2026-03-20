/**
 * level-sparkle-village.js — First playable level for Princess Sparkle V2
 *
 * 30x20 tile grid (480x320 pixels — exactly one screen).
 *
 * Tile IDs reference the Kenney Tiny Town tileset (tilemap_packed.png):
 *   192x176 PNG, 12 columns x 11 rows of 16x16 tiles = 132 tiles.
 *   Tile ID = row * 12 + col.
 *
 * ACCURATE Kenney Tiny Town tile reference (visually verified):
 *   Row 0 (0-11):   Star, grass, grass+flowers, path edge, green tree tops, orange tree tops, pine top
 *   Row 1 (12-23):  Green tree trunks, bushes, dark green tree tops, orange trunks, pine trunk, dead tree
 *   Row 2 (24-35):  Dirt path center, path edges (top/right/bottom/left), path corners, T-junctions, crossroads
 *   Row 3 (36-47):  More path corners/T-junctions, water edges top, dark grass, dirt/grass variants
 *   Row 4 (48-59):  Fence (horizontal/vertical), fence corners, fence gate, signs
 *   Row 5 (60-71):  Brown roof pieces, chimney, red roof pieces
 *   Row 6 (72-83):  Wood walls, door, window; stone walls, stone door, stone window
 *   Row 7 (84-95):  Castle/grey wall pieces, arches
 *   Row 8 (96-107): Well, barrel, crate, fountain, market stall, anvil, NPCs, bench, lamp post
 *   Row 9 (108-119): Water full, water edges (left/right/BL/bottom/BR), bridges, flowers (red/yellow/blue), rock
 *   Row 10 (120-131): Mushroom, pumpkin, hay, campfire, tombstone, chest, boat, dock, tools, wheelbarrow, cart, flag
 *
 * Building a house (3 wide x 2 tall):
 *   Roof:  60, 61, 62     (brown roof left, center, right)
 *   Walls: 72, 75, 74     (wall left, DOOR, wall right)
 *
 * Path connections:
 *   24=center, 25=grass-top, 26=grass-right, 28=grass-bottom, 32=grass-left
 *   27=corner TR, 29=corner BR, 33=corner TL, 36=corner BL
 *   30=T-right, 31=crossroads, 34=T-top, 35=T-left, 37=T-bottom
 *
 * Water pond (3x3):
 *   38,39,40 / 109,108,110 / 111,112,113
 *
 * Fence enclosure:
 *   50,48,48,51 / 49,_,_,49 / 52,48,54,53
 *
 * Layers:
 *   ground     — grass and paths (always filled, every cell)
 *   objects    — buildings, trees, furniture (-1 for empty)
 *   collision  — 0=walkable, 1=blocked
 *   foreground — treetops drawn above entities (-1 for empty)
 */

// Helper: generate a 30x20 flat array from 2D row arrays
function grid(rows) {
  const arr = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      arr.push(rows[y][x]);
    }
  }
  return arr;
}

// ── Tile ID aliases for readability ──────────────────────────────────────────

// Ground tiles
const G   = 1;    // plain grass (light green)
const G2  = 2;    // grass with tiny flowers
const G3  = 1;    // grass variant (same light green, for variety in code)

// Path tiles (dirt)
const P   = 24;   // dirt path center (plain)
const PT  = 25;   // path with grass edge on top
const PR  = 26;   // path with grass edge on right
const PB  = 28;   // path with grass edge on bottom
const PL  = 32;   // path with grass edge on left
const CTR = 27;   // path corner top-right (grass inside)
const CBR = 29;   // path corner bottom-right
const CTL = 33;   // path corner top-left
const CBL = 36;   // path corner bottom-left
const TJR = 30;   // path T-junction right
const TJT = 34;   // path T-junction top
const TJL = 35;   // path T-junction left
const TJB = 37;   // path T-junction bottom
const PX  = 31;   // path crossroads

// Empty (no object)
const E = -1;

// ── Object tile aliases ──

// Trees (green round — 2-tile wide canopy over 2-tile wide trunk)
const GTL = 4;    // green tree canopy top-left
const GTR = 5;    // green tree canopy top-right
const GBL = 12;   // green tree trunk-left
const GBR = 13;   // green tree trunk-right

// Trees (orange/autumn)
const OTL = 7;    // orange tree canopy top-left
const OTR = 8;    // orange tree canopy top-right
const OBL = 18;   // orange tree trunk-left
const OBR = 19;   // orange tree trunk-right

// Small trees / bushes
const BSH = 14;   // green bush/shrub
const OBS = 20;   // orange bush
const DST = 23;   // dead tree/stump

// Pine tree (1 wide, 2 tall)
const PNT = 10;   // pine tree top
const PNB = 21;   // pine tree trunk

// Brown roof
const RBL = 60;   // brown roof top-left
const RBM = 61;   // brown roof top-center
const RBR = 62;   // brown roof top-right

// Red/dark roof
const RRL = 67;   // red roof top-left
const RRM = 68;   // red roof top-center
const RRR = 69;   // red roof top-right

// Chimney
const CHM = 66;   // chimney

// Wood walls
const WWL = 72;   // wood wall left
const WWC = 73;   // wood wall center
const WWR = 74;   // wood wall right
const WDR = 75;   // wood door
const WWN = 76;   // wood window

// Stone walls
const SWL = 78;   // stone wall left
const SWC = 79;   // stone wall center
const SWR = 80;   // stone wall right
const SDR = 81;   // stone door
const SWN = 82;   // stone window

// Fences
const FH  = 48;   // fence horizontal
const FV  = 49;   // fence vertical
const FCT = 50;   // fence corner top-left
const FCR = 51;   // fence corner top-right
const FBL = 52;   // fence corner bottom-left
const FBR = 53;   // fence corner bottom-right
const FGT = 54;   // fence gate/opening
const SGN = 55;   // sign post
const DSG = 56;   // directional sign

// Decorations / furniture
const WEL = 96;   // well
const BRL = 97;   // barrel
const CRT = 98;   // crate/box
const FTN = 99;   // fountain
const MKT = 100;  // market stall
const ANV = 101;  // anvil/workbench
const BNC = 106;  // bench
const LMP = 107;  // lamp post

// Flowers
const FLR = 116;  // flowers red
const FLY = 117;  // flowers yellow
const FLB = 118;  // flowers blue
const ROK = 119;  // small rock/stone

// Misc decorations
const MSH = 120;  // mushroom
const PMK = 121;  // pumpkin
const HAY = 122;  // hay bale
const CFR = 123;  // campfire
const CHT = 125;  // chest
const FLG = 131;  // flag

// Water tiles (for objects layer pond)
const WTL = 38;   // water edge top-left
const WTT = 39;   // water edge top
const WTR = 40;   // water edge top-right
const WFL = 109;  // water edge left
const WFF = 108;  // water full tile
const WFR = 110;  // water edge right
const WBL = 111;  // water edge bottom-left
const WBB = 112;  // water edge bottom
const WBR = 113;  // water edge bottom-right

// Bridge
const BRH = 114;  // bridge horizontal
const BRV = 115;  // bridge vertical

// Characters (NPC sprites in tileset)
const NP1 = 102;  // character/NPC sprite 1
const NP2 = 103;  // character/NPC sprite 2

// Star
const STR = 0;    // yellow star/sparkle

// ── Ground Layer ─────────────────────────────────────────────────────────────
// Base terrain: grass everywhere, with properly-connected dirt paths.
// The village has a main north-south path (cols 14-15) and an east-west path (rows 9-10).
// Paths curve and have proper edge tiles where path meets grass.
//
// Layout concept (30 wide x 20 tall):
//   - Main N-S path runs through center, widening at village square
//   - Main E-W path crosses at rows 9-10
//   - Branching paths lead to houses and points of interest
//   - Winding path to pond in lower-left

// prettier-ignore
const ground = grid([
  // Row 0: top edge — mostly grass, N-S path enters from north
  [G, G2, G,  G,  G,  G,  G,  G,  G,  G2, G,  G,  G, CTL,PT, CTR, G,  G,  G2, G,  G,  G,  G,  G2, G,  G,  G,  G,  G2, G ],
  // Row 1: path continues south, small branch east to right house area
  [G2, G,  G,  G2, G,  G,  G,  G2, G,  G,  G2, G,  G, PL, P,  PR,  G,  G,  G,  G,  G,  G2, G,  G,  G,  G,  G2, G,  G,  G ],
  // Row 2: path continues, branch west starts toward left house
  [G,  G,  G2, G,  G,  G,  G2, G,  G,  G,  G,  G,  G, PL, P,  PR,  G,  G,  G,  G2, G,  G,  G,  G,  G,  G,  G,  G,  G,  G2],
  // Row 3: paths branch to houses. Left branch goes cols 3-7, right branch cols 20-24
  [G,  G2, G, CTL,PT, PT, PT, PT, PT, PT, PT, PT, PT,TJL, P, TJR, PT, PT, PT, PT, PT, PT, PT, PT, CTR, G,  G,  G,  G,  G ],
  // Row 4: left path up to house, vertical center path, right path up to house
  [G,  G,  G, PL, P,  P,  P,  PR, G,  G,  G,  G,  G, PL, P,  PR,  G,  G,  G,  G, PL,  P,  P,  P,  PR, G,  G,  G,  G,  G ],
  // Row 5: house doors face the path — grass behind houses
  [G,  G,  G, PL, P,  P,  P,  PR, G,  G,  G,  G,  G, PL, P,  PR,  G,  G,  G,  G, PL,  P,  P,  P,  PR, G,  G,  G,  G,  G ],
  // Row 6: path continues south from houses to main E-W, fence areas on grass
  [G,  G,  G, CBL,PB, PB, PB, CBR,G,  G,  G,  G,  G, PL, P,  PR,  G,  G,  G,  G, CBL, PB, PB, PB, CBR,G,  G,  G,  G,  G ],
  // Row 7: center path continues, approaching main crossroads
  [G,  G2, G,  G,  G,  G,  G,  G,  G,  G,  G2, G,  G, PL, P,  PR,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G2, G,  G,  G ],
  // Row 8: path widens for crossroads approach
  [G,  G,  G2, G,  G,  G,  G2, G,  G,  G,  G,  G,  G, PL, P,  PR,  G,  G,  G,  G2, G,  G,  G2, G,  G,  G,  G,  G,  G,  G2],
  // Row 9: main east-west path with crossroads at center (properly edged)
  [CTL,PT, PT, PT, PT, PT, PT, PT, PT, PT, PT, PT, PT,TJL, PX, TJR, PT, PT, PT, PT, PT, PT, PT, PT, PT, PT, PT, PT, PT, CTR],
  // Row 10: main east-west path bottom edge
  [CBL,PB, PB, PB, PB, PB, PB, PB, PB, PB, PB, PB, PB,TJL, P, TJR, PB, PB, PB, PB, PB, PB, PB, PB, PB, PB, PB, PB, PB, CBR],
  // Row 11: below main path — south path continues, branch to pond
  [G,  G,  G,  G,  G2, G,  G,  G,  G,  G,  G,  G,  G, PL, P,  PR,  G,  G,  G,  G,  G,  G,  G2, G,  G,  G,  G,  G,  G,  G ],
  // Row 12: path bends southwest toward pond and southeast toward garden
  [G,  G2, G,  G,  G,  G,  G,  G,  G,  G,  G,  G, CTL,TJL, P, TJR, CTR, G,  G,  G,  G,  G,  G,  G,  G,  G2, G,  G,  G2, G ],
  // Row 13: left branch to pond area, right branch to lower-right
  [G,  G,  G,  G2, G,  G,  G,  G,  G,  G, CTL, PT, TJT, P,  P,  P, TJT, PT, CTR, G,  G2, G,  G,  G,  G,  G,  G,  G2, G,  G ],
  // Row 14: path to pond bends down-left
  [G,  G,  G,  G,  G,  G,  G,  G,  G,  G, PL,  P,  P,  P, PB, P,  P,   P, PR,  G,  G,  G,  G,  G,  G2, G,  G,  G,  G,  G ],
  // Row 15: path reaches pond area
  [G2, G,  G,  G,  G,  G2, G,  G,  G,  G, CBL, PB, CBR, G,  G,  G, CTL, PB, CBR, G,  G,  G2, G,  G,  G,  G,  G,  G,  G,  G2],
  // Row 16: pond is below-left, grass around it
  [G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G, PL,  P,  PR,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G ],
  // Row 17: pond row — water tiles are in objects layer, ground is grass
  [G,  G2, G,  G,  G,  G,  G,  G2, G,  G,  G,  G,  G,  G,  G,  G, CBL, PB, CBR,  G,  G,  G,  G,  G,  G2, G,  G,  G,  G,  G ],
  // Row 18
  [G,  G,  G,  G,  G2, G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G,  G2, G,  G,  G,  G,  G,  G,  G,  G2],
  // Row 19: bottom edge — path exits south
  [G,  G,  G2, G,  G,  G,  G,  G,  G,  G,  G,  G,  G, CTL,PT, CTR, G,  G,  G,  G,  G,  G2, G,  G,  G,  G,  G,  G,  G,  G ],
]);

// ── Objects Layer ────────────────────────────────────────────────────────────
// Houses, trees, fences, decorations, water features, furniture
// -1 (E) = empty/transparent

// prettier-ignore
const objects = grid([
  // Row 0: tree canopies at top edge (in objects — trunks below, canopies in foreground)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  PNT,E,  E,  E ],
  // Row 1: tree trunks for top-edge trees, birds sit here
  [GTL,GTR,E,  E,  E,  E,  E,  E,  E,  OTL,OTR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  PNB,E,  GTL,GTR],
  // Row 2: tree trunks row
  [GBL,GBR,E,  E,  E,  E,  E,  E,  E,  OBL,OBR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  GBL,GBR],
  // Row 3: Grandma's house ROOF (brown, 4 wide) left side + Lily's house ROOF (red, 4 wide) right side
  [E,  E,  E, RBL,RBM,RBM,RBR,CHM, E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E, RRL,RRM,RRM,RRR, E,  E,  E,  E,  E,  E ],
  // Row 4: Grandma's WALLS (window, wall, window, wall) + Lily's WALLS
  [E,  E,  E, WWN,WWC,WWC,WWN,E,   E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E, SWN,SWC,SWC,SWN, E,  E,  E,  E,  E,  E ],
  // Row 5: Grandma's DOOR ROW + Lily's DOOR ROW
  [E,  E,  E, WWL,WWC,WDR,WWR,E,   E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  BSH,E, SWL,SWC,SDR,SWR, E,  E,  E,  E,  E,  E ],
  // Row 6: Fences around Grandma's yard + Lily's yard
  [E, FCT, FH, FH, FH, FGT, FH, FH, FCR, E,  E,  E,  E,  E,  E,  E,  E,  E,  E, FCT, FH, FH, FGT, FH, FH, FCR, E,  E,  E,  E ],
  // Row 7: Fence sides + decorations inside yards
  [E, FV,  E, FLY,E,  E,  E, BRL, FV,  E,  E,  LMP,E,  E,  E,  E,  E,  LMP,E,  FV,  E,  E,  E,  FLR, E,  FV,  E,  E,  E,  E ],
  // Row 8: Bottom fence + gate, flowers outside
  [E, FBL, FH, FH, FH, FGT, FH, FH, FBR, E,  E,  E,  E,  E,  E,  E,  E,  E,  E, FBL, FH, FH, FGT, FH, FH, FBR, E,  E,  E,  E ],
  // Row 9: main path — mostly clear, sign post at west entry, lamp at east
  [E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E ],
  // Row 10: main path — bench and well along south side
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E ],
  // Row 11: south of path — village square features
  [E,  E,  E,  BNC,E,  E,  FLB,E,  E,  E,  E,  FTN,E,  E,  E,  E,  E,  E,  WEL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E ],
  // Row 12: scattered flowers and decorations
  [E,  E,  FLR,E,  E,  E,  E,  FLY,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FLB,E,  E,  E,  E,  FLR,E,  E,  E ],
  // Row 13: trees and Finn's play area, lower area
  [E,  E,  E,  E,  E,  E,  E,  E,  GTL,GTR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E, OTL,OTR,E,  E,  E,  E,  E,  E ],
  // Row 14: tree trunks + rocks
  [E,  E,  E,  E,  E,  E,  E,  E,  GBL,GBR,ROK,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E, OBL,OBR,E,  E,  E,  E,  E,  E ],
  // Row 15: flowers, mushrooms near pond path
  [E,  E,  E,  E,  FLY,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  MSH,E,  E,  E,  E,  E,  E,  FLB,E,  E,  E ],
  // Row 16: pond top row (water tiles) + objects near pond
  [E,  E,  E, WTL,WTT,WTT,WTR, E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  HAY,E,  E,  E,  E,  E,  E ],
  // Row 17: pond middle
  [E,  E,  E, WFL,WFF,WFF,WFR, E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  HAY,E,  E,  E,  E,  E ],
  // Row 18: pond bottom row
  [E,  E,  E, WBL,WBB,WBB,WBR, E,  E,  E,  FLR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E ],
  // Row 19: bottom edge — bushes, exit path area
  [E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E ],
]);

// ── Collision Layer ──────────────────────────────────────────────────────────
// 1 = blocked, 0 = walkable
// Houses, fences (except gates), water, trees, well, fountain are blocked

// prettier-ignore
const collision = grid([
  // Row 0
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  // Row 1: tree canopies (walkable under in foreground, trunks block)
  [1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 2: tree trunks block
  [1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 3: house roofs block
  [0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  // Row 4: house walls block
  [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  // Row 5: house walls + doors (doors walkable for entry trigger)
  [0,0,0,1,1,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,1,1,0,1,0,0,0,0,0,0],
  // Row 6: fences block (gates open)
  [0,1,1,1,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,1,1,0,0,0,0],
  // Row 7: fence sides block, inside yard walkable
  [0,1,0,0,0,0,0,1,1,0,0,1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,0],
  // Row 8: fence bottom block (gates open)
  [0,1,1,1,1,0,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,1,1,0,0,0,0],
  // Row 9: main path — sign blocks
  [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 10: main path clear
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 11: bench, fountain, well block
  [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  // Row 12: flowers walkable
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 13: tree canopies (foreground), trunks below block
  [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0],
  // Row 14: tree trunks + rock block
  [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0],
  // Row 15: flowers/mushrooms walkable
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 16: pond top blocks
  [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  // Row 17: pond middle blocks
  [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],
  // Row 18: pond bottom blocks
  [0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 19: bottom edge
  [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
]);

// ── Foreground Layer ─────────────────────────────────────────────────────────
// Tree canopies drawn ABOVE entities so player walks "under" them

// prettier-ignore
const foreground = grid([
  // Row 0: tree canopies drawn on top (player can walk under)
  [GTL,GTR,E,  E,  E,  E,  E,  E,  E, OTL,OTR, E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E, GTL,GTR],
  // Row 1: more canopy coverage (lower half of big trees)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E ],
  // Rows 2-11: empty
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  // Row 12: canopies for lower trees (drawn on row above trunks)
  [E,  E,  E,  E,  E,  E,  E,  E, GTL,GTR, E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E, OTL,OTR, E,  E,  E,  E,  E,  E ],
  // Rows 13-19: empty
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
]);

// ── NPCs ───────────────────────────────────────────────────────────────────

const npcs = [
  {
    id: 'grandma-rose',
    name: 'Grandma Rose',
    spriteName: 'npc_grandma',
    homeX: 5,
    homeY: 7,
    personality: 'warm',
    dialogueId: 'grandma-rose-greeting',
    ambientLines: ['voice_grandma_ambient_01', 'voice_grandma_ambient_02'],
    sillyBehaviors: ['loses_glasses', 'hums_tune'],
  },
  {
    id: 'neighbor-lily',
    name: 'Neighbor Lily',
    spriteName: 'npc_lily',
    homeX: 22,
    homeY: 7,
    personality: 'cheerful',
    dialogueId: 'lily-greeting',
    ambientLines: ['voice_lily_ambient_01', 'voice_lily_ambient_02'],
    sillyBehaviors: ['waters_wrong_plant', 'talks_to_flowers'],
  },
  {
    id: 'little-finn',
    name: 'Little Finn',
    spriteName: 'npc_finn',
    homeX: 14,
    homeY: 14,
    personality: 'playful',
    dialogueId: 'finn-greeting',
    ambientLines: ['voice_finn_ambient_01'],
    sillyBehaviors: ['chases_butterfly', 'trips_over_rock', 'draws_in_dirt'],
  },
  {
    id: 'merchant-boris',
    name: 'Merchant Boris',
    spriteName: 'npc_boris',
    homeX: 11,
    homeY: 11,
    personality: 'jovial',
    dialogueId: 'boris-greeting',
    ambientLines: ['voice_boris_ambient_01'],
    sillyBehaviors: ['polishes_fountain', 'counts_coins'],
  },
];

// ── World Objects (tappable) ───────────────────────────────────────────────

const worldObjects = [
  // Flowers
  { type: 'FLOWER_RED',    x: 2,  y: 12, id: 'flower-01' },
  { type: 'FLOWER_YELLOW', x: 3,  y: 7,  id: 'flower-02' },
  { type: 'FLOWER_YELLOW', x: 7,  y: 12, id: 'flower-03' },
  { type: 'FLOWER_BLUE',   x: 6,  y: 11, id: 'flower-04' },
  { type: 'FLOWER_RED',    x: 23, y: 7,  id: 'flower-05' },
  { type: 'FLOWER_BLUE',   x: 21, y: 12, id: 'flower-06' },
  { type: 'FLOWER_RED',    x: 26, y: 12, id: 'flower-07' },
  { type: 'FLOWER_YELLOW', x: 4,  y: 15, id: 'flower-08' },
  { type: 'FLOWER_BLUE',   x: 26, y: 15, id: 'flower-09' },
  { type: 'FLOWER_RED',    x: 10, y: 18, id: 'flower-10' },

  // Major structures
  { type: 'POND',          x: 4,  y: 17, id: 'village-pond' },
  { type: 'FOUNTAIN',      x: 11, y: 11, id: 'village-fountain' },
  { type: 'WELL',          x: 18, y: 11, id: 'village-well' },
  { type: 'BENCH',         x: 3,  y: 11, id: 'village-bench' },

  // Fence yard items
  { type: 'BARREL',        x: 7,  y: 7,  id: 'barrel-01' },
  { type: 'SIGN',          x: 4,  y: 9,  id: 'village-sign' },

  // Trees (for interaction — actual tiles in objects/foreground layers)
  { type: 'TREE',          x: 0,  y: 2,  id: 'tree-01' },
  { type: 'TREE',          x: 9,  y: 2,  id: 'tree-02' },
  { type: 'TREE',          x: 8,  y: 14, id: 'tree-03' },
  { type: 'TREE',          x: 22, y: 14, id: 'tree-04' },
  { type: 'TREE',          x: 28, y: 2,  id: 'tree-05' },

  // Lamp posts
  { type: 'LAMP',          x: 11, y: 7,  id: 'lamp-01' },
  { type: 'LAMP',          x: 17, y: 7,  id: 'lamp-02' },

  // Miscellaneous
  { type: 'MUSHROOM',      x: 19, y: 15, id: 'mushroom-01' },
  { type: 'HAY_BALE',      x: 23, y: 16, id: 'hay-01' },
  { type: 'HAY_BALE',      x: 24, y: 17, id: 'hay-02' },
  { type: 'ROCK',          x: 10, y: 14, id: 'rock-01' },
  { type: 'BUSH',          x: 10, y: 5,  id: 'bush-01' },
  { type: 'BUSH',          x: 18, y: 5,  id: 'bush-02' },
  { type: 'BUSH',          x: 1,  y: 19, id: 'bush-03' },
  { type: 'BUSH',          x: 27, y: 19, id: 'bush-04' },
  { type: 'DANDELION',     x: 4,  y: 15, id: 'dandelion-01' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────

const animals = [
  { type: 'BUTTERFLY', x: 8,  y: 3,  spriteName: 'butterfly' },
  { type: 'BUTTERFLY', x: 22, y: 5,  spriteName: 'butterfly' },
  { type: 'BIRD',      x: 1,  y: 0,  spriteName: 'bird' },
  { type: 'BIRD',      x: 28, y: 0,  spriteName: 'bird' },
  { type: 'CAT',       x: 7,  y: 11, spriteName: 'cat' },
  { type: 'FROG',      x: 3,  y: 18, spriteName: 'frog' },
  { type: 'DUCK',      x: 5,  y: 17, spriteName: 'duck' },
  { type: 'SQUIRREL',  x: 9,  y: 13, spriteName: 'squirrel' },
];

// ── Quests ─────────────────────────────────────────────────────────────────

const quests = [
  {
    id: 'grandma-cookies',
    name: "Grandma's Cookies",
    giverNpcId: 'grandma-rose',
    value: 'sharing',
    heartReward: 3,
    bridgeColor: '#ff6b6b',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'grandma-rose',
        dialogueId: 'grandma-cookies-start',
        description: 'voice_quest_grandma_cookies_start',
      },
      {
        type: 'DELIVER',
        targetId: 'little-finn',
        itemId: 'cookies',
        dialogueId: 'grandma-cookies-deliver',
        description: 'voice_quest_grandma_cookies_deliver',
      },
      {
        type: 'RETURN_TO',
        targetId: 'grandma-rose',
        dialogueId: 'grandma-cookies-complete',
        description: 'voice_quest_grandma_cookies_complete',
      },
    ],
  },
  {
    id: 'helping-finn',
    name: 'Helping Finn',
    giverNpcId: 'little-finn',
    value: 'helpfulness',
    heartReward: 3,
    bridgeColor: '#77dd77',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'little-finn',
        dialogueId: 'finn-kite-start',
        description: 'voice_quest_finn_kite_start',
      },
      {
        type: 'OBSERVE',
        targetId: 'tree-03',
        dialogueId: 'finn-kite-observe',
        description: 'voice_quest_finn_kite_observe',
      },
      {
        type: 'RETURN_TO',
        targetId: 'little-finn',
        dialogueId: 'finn-kite-complete',
        description: 'voice_quest_finn_kite_complete',
      },
    ],
  },
  {
    id: 'lily-garden',
    name: "Lily's Garden",
    giverNpcId: 'neighbor-lily',
    value: 'patience',
    heartReward: 2,
    bridgeColor: '#ffb347',
    stages: [
      {
        type: 'TALK_TO',
        targetId: 'neighbor-lily',
        dialogueId: 'lily-garden-start',
        description: 'voice_quest_lily_garden_start',
      },
      {
        type: 'COLLECT',
        targetIds: ['flower-01', 'flower-04', 'flower-09'],
        dialogueId: 'lily-garden-collect',
        description: 'voice_quest_lily_garden_collect',
      },
      {
        type: 'RETURN_TO',
        targetId: 'neighbor-lily',
        dialogueId: 'lily-garden-complete',
        description: 'voice_quest_lily_garden_complete',
      },
    ],
  },
];

// ── Dialogues ──────────────────────────────────────────────────────────────

const dialogues = {
  'grandma-rose-greeting': {
    startId: 'g1',
    nodes: {
      g1: { id: 'g1', portrait: 'npc_grandma', name: 'Grandma Rose', voiceId: 'voice_grandma_greeting', next: null, expression: 'happy' },
    },
  },
  'grandma-cookies-start': {
    startId: 'gc1',
    nodes: {
      gc1: { id: 'gc1', portrait: 'npc_grandma', name: 'Grandma Rose', voiceId: 'voice_grandma_cookies_01', next: 'gc2', expression: 'happy' },
      gc2: { id: 'gc2', portrait: 'npc_grandma', name: 'Grandma Rose', voiceId: 'voice_grandma_cookies_02', next: null, expression: 'happy' },
    },
  },
  'grandma-cookies-deliver': {
    startId: 'gd1',
    nodes: {
      gd1: { id: 'gd1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_cookies_receive', next: null, expression: 'happy' },
    },
  },
  'grandma-cookies-complete': {
    startId: 'gf1',
    nodes: {
      gf1: { id: 'gf1', portrait: 'npc_grandma', name: 'Grandma Rose', voiceId: 'voice_grandma_cookies_done', next: null, expression: 'grateful' },
    },
  },
  'lily-greeting': {
    startId: 'l1',
    nodes: {
      l1: { id: 'l1', portrait: 'npc_lily', name: 'Neighbor Lily', voiceId: 'voice_lily_greeting', next: null, expression: 'happy' },
    },
  },
  'lily-garden-start': {
    startId: 'lg1',
    nodes: {
      lg1: { id: 'lg1', portrait: 'npc_lily', name: 'Neighbor Lily', voiceId: 'voice_lily_garden_01', next: 'lg2', expression: 'worried' },
      lg2: { id: 'lg2', portrait: 'npc_lily', name: 'Neighbor Lily', voiceId: 'voice_lily_garden_02', next: null, expression: 'hopeful' },
    },
  },
  'lily-garden-collect': {
    startId: 'lgc1',
    nodes: {
      lgc1: { id: 'lgc1', portrait: 'npc_lily', name: 'Neighbor Lily', voiceId: 'voice_lily_garden_collect', next: null, expression: 'happy' },
    },
  },
  'lily-garden-complete': {
    startId: 'lgd1',
    nodes: {
      lgd1: { id: 'lgd1', portrait: 'npc_lily', name: 'Neighbor Lily', voiceId: 'voice_lily_garden_done', next: null, expression: 'grateful' },
    },
  },
  'finn-greeting': {
    startId: 'f1',
    nodes: {
      f1: { id: 'f1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_greeting', next: null, expression: 'happy' },
    },
  },
  'finn-kite-start': {
    startId: 'fk1',
    nodes: {
      fk1: { id: 'fk1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_kite_01', next: 'fk2', expression: 'sad' },
      fk2: { id: 'fk2', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_kite_02', next: null, expression: 'worried' },
    },
  },
  'finn-kite-observe': {
    startId: 'fo1',
    nodes: {
      fo1: { id: 'fo1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_kite_observe', next: null, expression: 'happy' },
    },
  },
  'finn-kite-complete': {
    startId: 'fc1',
    nodes: {
      fc1: { id: 'fc1', portrait: 'npc_finn', name: 'Little Finn', voiceId: 'voice_finn_kite_done', next: null, expression: 'happy' },
    },
  },
  'boris-greeting': {
    startId: 'b1',
    nodes: {
      b1: { id: 'b1', portrait: 'npc_boris', name: 'Merchant Boris', voiceId: 'voice_boris_greeting', next: null, expression: 'happy' },
    },
  },
};

// ── Level transitions ──────────────────────────────────────────────────────

const transitions = [
  {
    edge: 'south',
    targetLevel: 'whisper-forest',
    targetSpawnX: 15,
    targetSpawnY: 1,
    label: 'Whisper Forest',
  },
];

// ── Tileset configuration ──────────────────────────────────────────────────

const tilesetConfig = {
  town: './sprites/town/tilemap_packed.png',
  dungeon: './sprites/dungeon/tilemap_packed.png',
};

// ── Export ──────────────────────────────────────────────────────────────────

export default {
  id: 'sparkle-village',
  name: 'Sparkle Village',
  width: 30,
  height: 20,
  tileSize: 16,
  tilesetPath: './sprites/town/tilemap_packed.png',

  // Player spawn — center of village square at crossroads
  spawnX: 14,
  spawnY: 10,

  // Tile layers
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
};
