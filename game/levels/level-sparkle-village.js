/**
 * level-sparkle-village.js — First playable level for Princess Sparkle V2
 *
 * 30x20 tile grid (480x320 pixels — exactly one screen).
 *
 * Tile IDs reference the Kenney Tiny Town tileset (tilemap_packed.png):
 *   192x176 PNG, 12 columns x 11 rows of 16x16 tiles = 132 tiles.
 *   Tile ID = row * 12 + col.
 *
 * Kenney Tiny Town tile reference (from visual inspection):
 *   Row 0 (0-11):   Tree canopies (green variants), bushes, cacti
 *   Row 1 (12-23):  More tree/bush variants, small plants
 *   Row 2 (24-35):  Tree trunks, fence sections, path edges
 *   Row 3 (36-47):  Dirt/sand ground, grass tiles, flowers, fence posts
 *   Row 4 (48-59):  Stone cobble, blue-gray building walls, windows
 *   Row 5 (60-71):  Brick/red walls, rooftops (orange/red), doors
 *   Row 6 (72-83):  Wood walls, doors, windows, water edge pieces
 *   Row 7 (84-95):  Dark interiors, furniture, signs, lanterns, well
 *   Row 8 (96-107): White picket fences, window shutters, benches
 *   Row 9 (108-119): Water tiles, lamp posts, signs, blue tiles
 *   Row 10 (120-131): More water, barrels, chests, special objects
 *
 * Key tiles used in this level:
 *   GRASS:       37 (plain grass), 38 (grass variant), 43 (grass+flower)
 *   DIRT PATH:   39 (horizontal path), 40 (path center), 41 (vertical path)
 *   WATER:       109 (water top-left), 110 (water top), 111 (water top-right)
 *               121 (water left), 122 (water center), 123 (water right)
 *   TREE TOP:    0 (canopy TL), 1 (canopy TR), 2 (canopy alt)
 *   TREE TRUNK:  24 (trunk left), 25 (trunk right)
 *   ROOF:        63 (roof left), 64 (roof mid), 65 (roof right), 67 (roof peak)
 *   WALL:        72 (wood wall), 73 (wall plain), 75 (wall+window)
 *   DOOR:        74 (wood door)
 *   FENCE:       96 (fence left), 97 (fence mid), 98 (fence right)
 *               108 (fence post)
 *   FLOWERS:     43 (grass+flower), 19 (small bush/flower)
 *   WELL:        92 (well top), 104 (well bottom)  -- approximation
 *   BENCH:       105 (bench)
 *   SIGN/POST:   116 (lamp/sign post)
 *
 * Layers:
 *   ground     — grass and paths (always filled)
 *   objects    — buildings, trees, furniture (-1 for empty)
 *   collision  — 0=walkable, 1=blocked
 *   foreground — treetops drawn above entities (-1 for empty)
 */

// Helper: generate a 30x20 flat array
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
const GR  = 37;   // grass (plain green)
const GR2 = 38;   // grass variant (slightly different)
const GF  = 43;   // grass with small flower
const DP  = 40;   // dirt path center
const DPH = 39;   // dirt path horizontal edge left
const DPR = 41;   // dirt path horizontal edge right
const DPV = 42;   // dirt path vertical

// Water ground (beneath water objects)
const WG  = 109;  // water body

// Empty
const E = -1;

// Object tiles
const TT1 = 0;    // tree canopy top-left (large green)
const TT2 = 1;    // tree canopy top-right
const TT3 = 2;    // tree canopy alt
const TT4 = 3;    // tree canopy variant
const TB1 = 12;   // tree bottom-left / trunk+leaves
const TB2 = 13;   // tree bottom-right
const TK  = 24;   // tree trunk
const TK2 = 25;   // tree trunk variant

// Bushes and small plants
const BSH = 6;    // bush (round green)
const BSH2 = 7;   // bush variant
const PLT = 18;   // small plant/flower
const PLT2 = 19;  // small plant variant
const FLR = 43;   // flower on grass

// Roofs (red/orange)
const RFL = 63;   // roof left slope
const RFM = 64;   // roof mid
const RFR = 65;   // roof right slope
const RFK = 67;   // roof peak/cap

// Walls
const WLL = 72;   // wood wall left
const WLM = 73;   // wood wall mid / plain
const WLW = 75;   // wall with window
const WLD = 74;   // wall with door

// Fences (white picket)
const FNL = 96;   // fence left end
const FNM = 97;   // fence mid section
const FNR = 98;   // fence right end
const FNP = 108;  // fence post / vertical

// Water tiles
const WTL = 109;  // water top-left corner
const WTM = 110;  // water top edge
const WTR = 111;  // water top-right corner
const WML = 121;  // water mid-left
const WMM = 122;  // water center
const WMR = 123;  // water mid-right
const WBL = 120;  // water bottom-left
const WBM = 126;  // water bottom edge -- approximate with stone/blue
const WBR = 112;  // water bottom-right -- approximate

// Decorations / furniture
const BNC = 105;  // bench
const WEL = 92;   // well top
const WEB = 104;  // well base (using similar tile)
const SGN = 116;  // sign/lamp post
const MLX = 93;   // mailbox / lantern (warm-colored item)
const BRL = 107;  // barrel
const STN = 106;  // stone/rock

// ── Ground Layer ─────────────────────────────────────────────────────────────
// All grass base with dirt paths running through the village

// prettier-ignore
const ground = grid([
  // Row 0: top grass
  [GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR],
  // Row 1
  [GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR],
  // Row 2
  [GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR2,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR2],
  // Row 3: house row (grass under houses)
  [GR,GR2,GR,GR,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR],
  // Row 4: houses
  [GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR],
  // Row 5: house bottom / door level
  [GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR],
  // Row 6: fence + yard
  [GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR],
  // Row 7: path junction approaching
  [GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,DP,DP,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR],
  // Row 8: flowers & decorations
  [GR,GR,GR,GF,GR,GR,GF,GR,GR,GR,GR,GR,DP,DP,DP,DP,DP,DP,GR,GR,GR,GF,GR,GR,GF,GR,GR,GR,GR,GR],
  // Row 9: main east-west path
  [DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP],
  // Row 10: main east-west path
  [DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP,DP],
  // Row 11: below path
  [GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,DP,DP,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR],
  // Row 12: scattered flowers
  [GR,GR2,GF,GR,GR,GR,GR,GF,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR,GR2,GR],
  // Row 13: lower village
  [GR,GR,GR,GR2,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR2,GR,GR,GR,GR,GR,GR,GR,GR2,GR,GR],
  // Row 14
  [GR,GR,GR,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR],
  // Row 15
  [GR2,GR,GR,GR,GF,GR2,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GF,GR,GR2,GR,GR,GR,GR,GF,GR,GR,GR2],
  // Row 16: pond area
  [GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR],
  // Row 17: pond
  [GR,GR2,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR2,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR],
  // Row 18
  [GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR2],
  // Row 19: bottom edge
  [GR,GR,GR2,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,GR,DP,DP,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR,GR,GR,GR],
]);

// ── Objects Layer ────────────────────────────────────────────────────────────
// Houses, trees, fences, decorations, water features

// prettier-ignore
const objects = grid([
  // Row 0: tree canopies at top
  [E,E,E,E, E,E,E, E,TT1,TT2,E,E,E, E,E,E, E,TT1,TT2,E,E,BSH,E,E,E,E, E,E,E,E],
  // Row 1: tree lower parts
  [E,E,E,E, E,E,E, E,TB1,TB2,E,E,E, E,E,E, E,TB1,TB2,E,E,E,E,E,E,E, E,E,E,E],
  // Row 2: empty / spacing
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E,E,E,E, E,E,E,E],
  // Row 3: Grandma's house roof (left) + Lily's house roof (right)
  [E,E,E, RFL,RFM,RFK,RFM,RFR,E,E, E,E,E, E,E,E, E,E,E, E, RFL,RFM,RFK,RFM,RFR,E,E, E,E,E],
  // Row 4: house walls with windows
  [E,E,E, WLL,WLW,WLM,WLW,WLL,E,E, E,E,E, E,E,E, E,E,E, E, WLL,WLW,WLM,WLW,WLL,E,E, E,E,E],
  // Row 5: house walls with doors
  [E,E,E, WLM,WLM,WLD,WLM,WLM,E,E, E,E,E, E,E,E, E,E,E, E, WLM,WLM,WLD,WLM,WLM,E,E, E,E,E],
  // Row 6: fences along yards
  [E,E,FNL,FNM,FNM,FNM,FNM,FNM,FNR,E, E,E,E, E,E,E, E,E,E,FNL,FNM,FNM,FNM,FNM,FNM,FNR,E, E,E,E],
  // Row 7: mailbox, trees, decorations
  [E,MLX,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,MLX,E,E,E],
  // Row 8: flowers
  [E,E,E,PLT, E,E,PLT2,E,E,E, E,E,E, E,E,E, E,E,E, E,E,PLT, E,E,PLT2,E,E,E,E,E],
  // Row 9: main path (no objects)
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E,E],
  // Row 10: main path (no objects)
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E,E],
  // Row 11: bench, well area
  [E,E,E,E, E,BNC,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,WEL,E, E,E,E,E,E],
  // Row 12: scattered flowers
  [E,E,PLT, E,E,E, E,PLT2,E,E, E,E,E, E,E,E, E,E,E, E,E,PLT, E,E,E, E,PLT2,E,E,E],
  // Row 13: trees in lower area + Finn's play area
  [E,E,E,E, E,E,E, E,TT1,TT2,E,E,E, E,E,E, E,E,E, E,E,E, TT1,TT2,E, E,E,E,E,E],
  // Row 14: tree trunks + stones
  [E,E,E,E,E,E,E, E,TB1,TB2, STN,E,E, E,E,E, E,E,E, E,E,E, TB1,TB2,E,E, E,E,E,E],
  // Row 15: flowers
  [E,E,E,E,PLT2,E,E, E,E,E, E,E,E, E,E,E, E,E,E,PLT,E,E, E,E,E,E,PLT2,E,E,E],
  // Row 16: pond area - top row of water
  [E,E,E,E, E,E,E, E,E,E, WTL,WTM,WTR,E,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
  // Row 17: pond mid
  [E,E,E,E, E,E,E, E,E,WTL,WML,WMM,WMR,WTR,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
  // Row 18: pond bottom
  [E,E,E,E, E,E,PLT2,E,E,E, WBL,WMM,WBR,E,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
  // Row 19: bottom edge
  [E,E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E, E,E,E,E, E,E,E,E],
]);

// Collision: 1=blocked, 0=walkable
// Houses, fences, water, trees, well are blocked
// prettier-ignore
const collision = grid([
  [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
]);

// Foreground: treetops drawn above entities (so player walks "under" them)
// prettier-ignore
const foreground = grid([
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
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E,E],
  [E,E,E,E,E,E,E,E,TT1,TT2,E,E,E,E,E,E,E,E,E,E,E,E,TT1,TT2,E,E,E,E,E,E],
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
    homeY: 8,
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
    homeY: 8,
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
];

// ── World Objects (tappable) ───────────────────────────────────────────────

const worldObjects = [
  { type: 'FLOWER_SMALL', x: 3,  y: 8,  id: 'flower-01' },
  { type: 'FLOWER_SMALL', x: 24, y: 8,  id: 'flower-02' },
  { type: 'FLOWER_BIG',   x: 6,  y: 8,  id: 'flower-03' },
  { type: 'FLOWER_SMALL', x: 21, y: 12, id: 'flower-04' },
  { type: 'FLOWER_SMALL', x: 2,  y: 12, id: 'flower-05' },
  { type: 'POND',         x: 11, y: 17, id: 'village-pond' },
  { type: 'TREE',         x: 9,  y: 1,  id: 'tree-01' },
  { type: 'TREE',         x: 18, y: 1,  id: 'tree-02' },
  { type: 'TREE',         x: 9,  y: 14, id: 'tree-03' },
  { type: 'TREE',         x: 23, y: 14, id: 'tree-04' },
  { type: 'WELL',         x: 23, y: 11, id: 'village-well' },
  { type: 'BENCH',        x: 5,  y: 11, id: 'village-bench' },
  { type: 'MAILBOX',      x: 1,  y: 7,  id: 'mailbox-01' },
  { type: 'MAILBOX',      x: 26, y: 7,  id: 'mailbox-02' },
  { type: 'DANDELION',    x: 19, y: 15, id: 'dandelion-01' },
  { type: 'FLOWER_SMALL', x: 26, y: 15, id: 'flower-06' },
];

// ── Ambient Animals ────────────────────────────────────────────────────────

const animals = [
  { type: 'BUTTERFLY', x: 8,  y: 3,  spriteName: 'butterfly' },
  { type: 'BUTTERFLY', x: 22, y: 5,  spriteName: 'butterfly' },
  { type: 'BIRD',      x: 12, y: 2,  spriteName: 'bird' },
  { type: 'BIRD',      x: 25, y: 1,  spriteName: 'bird' },
  { type: 'CAT',       x: 7,  y: 11, spriteName: 'cat' },
  { type: 'FROG',      x: 11, y: 18, spriteName: 'frog' },
  { type: 'DUCK',      x: 12, y: 17, spriteName: 'duck' },
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

  // Player spawn
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
