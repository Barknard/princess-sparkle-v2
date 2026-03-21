/**
 * level-sparkle-village.js — Sparkle Village for Princess Sparkle V2
 *
 * 60x40 tile grid (960x640 pixels — 4x the viewport, camera scrolls).
 * Viewport is 30x20 tiles (480x320 pixels).
 *
 * Tile IDs reference the Kenney Tiny Town tileset (tilemap_packed.png):
 *   192x176 PNG, 12 columns x 11 rows of 16x16 tiles = 132 tiles.
 *   Tile ID = row * 12 + col.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ASCII MAP — SPARKLE VILLAGE (60 wide x 40 tall)                       ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                         ║
 * ║  Rows 0-2:   Tree border top (staggered, natural gaps)                 ║
 * ║  Rows 3-7:   Open meadow with scattered flowers                       ║
 * ║  Rows 8-15:  Grandma's area (cols 5-20) — cottage, yard, garden       ║
 * ║  Rows 14-17: N-S path connecting to village square                     ║
 * ║  Rows 18-25: Village Square (cols 20-40) — well, benches, hub         ║
 * ║  Rows 25-32: Baker's area (cols 5-15) — shop, barrels, cat            ║
 * ║  Rows 28-35: Pond & Nature (cols 35-50) — large pond, frogs           ║
 * ║  Rows 30-38: Lily's area (cols 20-35) — house, laundry, flowers       ║
 * ║  Rows 35-39: Finn's playground (cols 42-55)                           ║
 * ║  Rows 38-39: Tree border bottom, south exit cols 28-31                ║
 * ║                                                                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * DESIGN: ~90% green grass, ~10% paths → OVERWHELMINGLY GREEN
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
const BSH = 28;    // bush (green oval hedge — tile 28, NOT 14 which is peach block)

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
const BNC = 19;    // bench → purple/pink flower bush (tile 19) — tile 105 was too dark, read as "bomb" in QA
const CRT = 107;   // crate → barrel (tile 107) — tile 106 was dark/round, read as "bomb" in QA
const BRL = 107;   // barrel
const SGN = 93;    // signpost → lantern post (tile 93) — tile 116 had fork/trident shape, read as "weapon" in QA
const LNT = 93;    // lantern

// ── HELPER: make a row of 60 tiles ──────────────────────────────────────────
// r() fills a 60-wide row. Pass an array of 60 values.
// For ground: every cell must be GR or GR2 or a path tile.

// ── GROUND LAYER (60x40 = 2400 tiles) ──────────────────────────────────────
// Every cell filled. ~90% grass, ~10% path.
// N-S main path at cols 29-30 (runs rows 8 to 39).
// E-W path at rows 20-21 (runs cols 8-50, village square crossroads).
// Secondary paths branch to each building.
//
// Path layout:
//   N-S: col 29 = DPL, col 30 = DPR (except at intersections = DP)
//   E-W: row 20 = DPL (top), row 21 = DPR (bottom) for the branch
//   Intersections at row 20-21, cols 29-30 = DP

// prettier-ignore
const ground = grid([
  // Row 0: top tree border
  [GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR],
  // Row 1: tree border
  [GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 2: tree border thinning
  [GR, GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR],
  // Row 3: open meadow
  [GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, GR, GR2,GR],
  // Row 4: meadow with flowers
  [GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR],
  // Row 5: meadow
  [GR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2],
  // Row 6: meadow
  [GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR],
  // Row 7: meadow, path starts going south from row 8
  [GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 8: path starts, goes south to village square. Also path branch east to Grandma's
  [GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 9: N-S path + branch west to Grandma (E-W at cols 12-29)
  [GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DP, DPR,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 10: E-W path bottom edge (cols 12-29) + N-S continues
  [GR,GR,GR2,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DP,DPR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2],
  // Row 11: Grandma's cottage area — roof row. N-S path continues.
  [GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 12: Grandma's walls row
  [GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,DPL,DPR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR],
  // Row 13: Grandma's fence row
  [GR2,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,DPL,DPR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 14: below Grandma's, yard area
  [GR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR],
  // Row 15: open grass, path south
  [GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,DPL,DPR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 16: open grass
  [GR,GR,GR2,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,DPL,DPR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2],
  // Row 17: open grass, approaching village square
  [GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR],
  // Row 18: approaching village square
  [GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,DPL,DPR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 19: E-W path top edge (village square, cols 10-48)
  [GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DP, DP, DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 20: E-W path center (village square main road, cols 10-48)
  [GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, DP, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 21: E-W path bottom edge (cols 10-48)
  [GR, GR2,GR, GR, GR, GR, GR2,GR, GR, GR, DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DP, DP, DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 22: below village square path, N-S continues south. Branch paths to Baker (west) and Pond (east).
  [GR, GR, GR2,GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, DPL,DPR,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 23: branch path west to Baker (cols 10-29)
  [GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR, DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DP, DPR,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR],
  // Row 24: branch path bottom edge west + N-S + branch east to pond (cols 29-42)
  [GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DP, DP, DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DPL,GR, GR2,GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR],
  // Row 25: below branches, path continues south. Branch east bottom edge.
  [GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, DPL,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,GR, GR, GR2,GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR],
  // Row 26: Baker's area starts. Path south.
  [GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, DPL,DPR,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR],
  // Row 27: Baker's roof row
  [GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR, GR2,GR, GR, GR2,GR, GR, DPL,DPR,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR, GR, GR, GR2,GR, GR, GR2,GR],
  // Row 28: Baker's walls row
  [GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,DPL,DPR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 29: Baker's fence row. Pond area to the east.
  [GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 30: Below baker. Lily's area + pond area. Path south continues.
  [GR,GR,GR2,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR],
  // Row 31: path south + branch east to Lily (cols 29-26... wait, Lily at cols 22-26)
  [GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,DPL,DPL,DPL,DPL,DPL,DPL,DPL,DP,DPR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR],
  // Row 32: branch bottom edge + Lily roof row
  [GR,GR,GR2,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR,DPR,DPR,DPR,DPR,DPR,DPR,DPR,DP,DPR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 33: Lily walls row
  [GR2,GR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR,GR,GR2,GR,GR,GR,DPL,DPR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR],
  // Row 34: Lily fence row
  [GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,DPL,DPR,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR],
  // Row 35: Finn playground area, path continues south
  [GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR,GR2,GR,GR,GR2,GR,DPL,DPR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR],
  // Row 36: path continues, approaching south border
  [GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,DPL,DPR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 37: approaching tree border
  [GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR],
  // Row 38: tree border
  [GR,GR,GR2,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR],
  // Row 39: bottom tree border — exit at cols 28-31
  [GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,DPL,DPR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR,GR,GR2,GR,GR,GR2,GR,GR],
]);

// ── OBJECTS LAYER (60x40 = 2400 tiles) ─────────────────────────────────────
// Buildings, tree trunks, fences, water, decorations.
// -1 = empty (E). Tree trunks go HERE; canopies go in foreground.
//
// Building layouts:
//   Grandma's Cottage (5-wide, cols 7-11, rows 11-13):
//     Row 11: RFL, RFM, RFM, RFM, RFR         (roof)
//     Row 12: WLL, WLW, WLD, WLW, WLM         (walls, door at col 9)
//     Row 13: FNL, FNM, E,   FNM, FNR         (fence, gate at col 9)
//
//   Baker's Shop (4-wide, cols 10-13, rows 27-29):
//     Row 27: RFL, RFP, RFM, RFR              (roof with chimney)
//     Row 28: SWL, SWW, SWD, SWM              (stone walls, door at col 12)
//     Row 29: FNL, FNM, E,   FNR              (fence, gate at col 12)
//
//   Lily's House (5-wide, cols 23-27, rows 32-34):
//     Row 32: RFL, RFM, RFM, RFM, RFR         (roof)
//     Row 33: WLL, WLW, WLD, WLW, WLM         (walls, door at col 25)
//     Row 34: FNL, FNM, E,   FNM, FNR         (fence, gate at col 25)
//
// Water pond (5x4 at cols 38-42, rows 29-32)
// Trees: staggered at edges, with gaps

// prettier-ignore
const objects = grid([
  // Row 0: top tree border — canopy-only row (canopies for row 1 trunks)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 1: tree trunks — staggered, with gaps for light
  [TB1,TB2,E,  E,  BSH,E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 2: more staggered trunks + sparse bushes
  [E,  E,  E,  TB1,TB2,E,  E,  TB1,TB2,E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  BSH,E,  E,  E,  TB1,TB2,E,  E,  E],
  // Row 3: open meadow — mostly empty with a bush
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 4: meadow with trees on sides
  [TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 5: meadow, scattered bushes
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 6: meadow, trees on east side
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E],
  // Row 7: open
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 8: signpost near path start
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 9: E-W path to Grandma — no objects on path
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 10: below path, Grandma's signpost/mailbox area
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 11: Grandma's cottage ROOF (cols 7-11)
  [E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 12: Grandma's WALLS (cols 7-11): WLL, WLW, WLD, WLW, WLM — door at col 9
  [E,  E,  E,  E,  E,  E,  E,  WLL,WLW,WLD,WLW,WLM,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 13: Grandma's FENCE (cols 7-11): FNL, FNM, gate, FNM, FNR — gate at col 9
  [E,  E,  E,  E,  E,  E,  E,  FNL,FNM,E,  FNM,FNR,E,  E,  E,  E,  BRL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 14: Grandma's yard — garden plot, bench
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 15: open with bush
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 16: trees on west side
  [TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 17: trees staggered
  [E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E],
  // Row 18: approaching village square, trees on sides
  [TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2],
  // Row 19: village square — well top, signpost
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  E,  WEL,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 20: village square main road — well base, benches
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BNC,E,  E,  E,  E,  WEB,E,  E,  E,  E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 21: below path — signpost, bench
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SGN,E,  E,  E,  E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 22: open, path south
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 23: branch path west — no objects on path itself
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 24: branch path east to pond + crates near baker approach
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 25: below branch path
  [E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 26: Baker area approach, barrels/crates near shop
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BRL,CRT,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 27: Baker's ROOF (cols 10-13): RFL, RFP, RFM, RFR
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFP,RFM,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 28: Baker's WALLS (cols 10-13): SWL, SWW, SWD, SWM — door at col 12
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  SWL,SWW,SWD,SWM,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 29: Baker's FENCE (cols 10-13): FNL, FNM, gate, FNR — gate at col 12. POND NW area starts (cols 38-42)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FNL,FNM,E,  FNR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  WTL,WTM,WTM,WTM,WTR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 30: pond west edge + center. Baker's yard below.
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,WML,WMM,WMM,WMM,WMR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 31: pond continues. Path branch to Lily.
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  WML,WMM,WMM,WMM,WMR,E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 32: Lily's ROOF (cols 23-27). Pond bottom.
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  RFL,RFM,RFM,RFM,RFR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  WBL,WBM,WBM,WBM,WBR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 33: Lily's WALLS (cols 23-27): WLL, WLW, WLD, WLW, WLM — door at col 25
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  WLL,WLW,WLD,WLW,WLM,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 34: Lily's FENCE (cols 23-27): FNL, FNM, gate, FNM, FNR — gate at col 25
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  FNL,FNM,E,  FNM,FNR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 35: Lily's yard area. Finn playground on east. Trees.
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BNC,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 36: open, scattered bushes
  [E,  E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  BSH,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 37: approaching south border
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 38: tree border south — staggered trunks
  [TB1,TB2,E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  TB1,TB2,E,  E,  TB1,TB2],
  // Row 39: south border trunks — exit gap at cols 28-31
  [E,  E,  E,  TB1,TB2,E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  TB1,TB2,E,  E,  BSH,E,  E,  E,  E,  BSH,E,  TB1,TB2,E,  E,  E,  E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  E,  TB1,TB2,E,  E,  E,  E,  TB1,TB2,E],
]);

// ── COLLISION LAYER (60x40 = 2400 tiles) ───────────────────────────────────
// 0 = walkable, 1 = blocked
// Buildings (roof+walls), fences (except gate gaps), tree trunks, well, water, some decorations = blocked

// prettier-ignore
const collision = grid([
  // Row 0: empty (no trunks at row 0, canopy-only row)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 1: trees at 0-1, bush at 4, trees at 8-9, 16-17, 24-25, 34-35, 42-43, 50-51, 58-59
  [1,1,0,0,1,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1],
  // Row 2: trees at 3-4, 7-8, 12-13, 21-22, 33-34, 39-40, 47-48, 55-56, bush at 51
  [0,0,0,1,1,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,0,0,0,1,1,0,0,0],
  // Row 3: open
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 4: trees at 0-1, 58-59
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 5: bush at 27
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 6: trees at 55-56
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0],
  // Row 7: open
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 8: signpost at 27
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 9: path row, no collision on path
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 10: signpost at 14
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 11: Grandma roof blocked (7-11)
  [0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 12: Grandma walls blocked (7-11), door at 9 blocked (visual)
  [0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 13: fence(7-8, 10-11) blocked, gate at 9 walkable, barrel at 16
  [0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 14: bench at 13
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 15: bush at 18
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 16: trees at 0-1, 58-59
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 17: trees at 3-4, 55-56
  [0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0],
  // Row 18: trees at 0-1, 58-59
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 19: signpost at 21, well top at 28
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 20: bench at 23, well base at 28, bench at 34
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 21: signpost at 36, bench at 42
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 22: open
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 23: path row
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 24: path row
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 25: bush at 8
  [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 26: barrel at 14, crate at 15
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 27: Baker roof blocked (10-13)
  [0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 28: Baker walls blocked (10-13)
  [0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 29: Baker fence (10-11, 13), gate at 12 walkable. Pond water blocked (38-42)
  [0,0,0,0,0,0,0,0,0,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 30: pond water blocked (38-42), bush at 37
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 31: pond water blocked (38-42), bench at 45
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 32: Lily roof blocked (23-27), pond water blocked (38-42)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 33: Lily walls blocked (23-27)
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 34: Lily fence (23-24, 26-27), gate at 25 walkable
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 35: bench at 43
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 36: bush at 4, bush at 47
  [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 37: open
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  // Row 38: south tree border trunks
  [1,1,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,1,1],
  // Row 39: south border trunks — exit gap at cols 28-31
  [0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,1,0,0,0,0,1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,1,1,0],
]);

// ── FOREGROUND LAYER (60x40 = 2400 tiles) ──────────────────────────────────
// Tree canopies drawn OVER entities. Canopies placed ONE ROW ABOVE trunks.
// Green canopy: CAN_GL(4), CAN_GR(5). Autumn canopy: CAN_AL(7), CAN_AR(8).

// prettier-ignore
const foreground = grid([
  // Row 0: canopies for row 1 trunks (canopy one row ABOVE trunk)
  [CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 1: canopies for row 2 trunks
  [E,  E,  E,  CAN_AL,CAN_AR,E,  E,  CAN_GL,CAN_GR,E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E],
  // Row 2: no canopies needed (row 2 trunks have canopies at row 1)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 3: canopies for row 4 trunks (0-1, 58-59)
  [CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 4: empty — canopies for row 4 trunks are at row 3
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 5: canopy for row 6 trunks (55-56)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E],
  // Row 6: empty — canopies for row 6 trunks are at row 5
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 7-10: no foreground
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 11-14: no foreground (building area, no trees)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 15: canopies for row 16 trunks (0-1, 58-59)
  [CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 16: canopies for row 17 trunks (3-4, 55-56). Row 16 trunks (0-1, 58-59) have canopies at row 15.
  [E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E],
  // Row 17: canopies for row 18 trunks (0-1, 58-59). Row 17 trunks (3-4, 55-56) have canopies at row 16.
  [CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR],
  // Row 18: empty — row 18 trunks (0-1, 58-59) have canopies at row 17
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 19-36: no foreground (village area, buildings)
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  // Row 37: canopies for row 38 south border trunks
  [CAN_GL,CAN_GR,E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  CAN_GL,CAN_GR],
  // Row 38: canopies for row 39 trunks + trunk-row canopy for row 38 trunks
  [CAN_AL,CAN_AR,E,  CAN_GL,CAN_GR,E,  CAN_GL,CAN_GR,E,  CAN_AL,CAN_AR,E,  E,  CAN_AL,CAN_AR,E,  CAN_GL,CAN_GR,E,  E,  CAN_GL,CAN_GR,E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  CAN_GL,CAN_GR,E,  E,  CAN_AL,CAN_AR,E,  CAN_AL,CAN_AR,E,  CAN_GL,CAN_GR,E,  CAN_AL,CAN_AR,E],
  // Row 39: trunk-row canopy for south border trees
  [E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  E,  E,  E,  E,  CAN_AL,CAN_AR,E,  E,  E,  E,  E,  CAN_GL,CAN_GR,E,  E,  E,  E,  CAN_AL,CAN_AR,E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
  [E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E,  E],
]);

// ── NPCs ──────────────────────────────────────────────────────────────────
// All homeX/homeY positions verified on walkable tiles (collision=0).
// NPCs positioned near village square so they're visible from spawn (30,20).

const npcs = [
  {
    id: 'grandma-rose',
    name: 'Grandma Rose',
    spriteName: 'npc_grandma',
    homeX: 17,      // south of cottage, on path toward village square (walkable)
    homeY: 17,      // visible from spawn — within initial camera viewport
    wanderRadius: 4,
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
    homeX: 25,      // near her house area, moved north toward village square
    homeY: 28,      // visible from spawn — within initial camera viewport
    wanderRadius: 3,
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
    homeX: 38,      // east side of village square, near playground path
    homeY: 22,      // visible from spawn — within initial camera viewport
    wanderRadius: 4,
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
    homeX: 17,      // near baker's area, moved north toward village square
    homeY: 24,      // visible from spawn — within initial camera viewport
    wanderRadius: 3,
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
// 35 objects distributed across the 60x40 map. Each area has multiple tappable things.

const worldObjects = [
  // ── Grandma's area (upper area, cols 5-20, rows 8-15) — 6 objects ──
  { type: 'WIND_CHIMES',   x: 8,  y: 11, id: 'wind-chimes-01' },
  { type: 'GARDEN_PLOT',   x: 11, y: 14, id: 'garden-plot-01' },
  { type: 'FLOWER_BIG',    x: 6,  y: 14, id: 'flower-big-01' },
  { type: 'FLOWER_BIG',    x: 15, y: 13, id: 'flower-big-02' },
  { type: 'MAILBOX',       x: 14, y: 10, id: 'mailbox-grandma' },
  { type: 'LANTERN',       x: 6,  y: 12, id: 'lantern-grandma' },

  // ── Meadow flowers (top area, rows 3-7) — 4 objects ──
  { type: 'FLOWER_SMALL',  x: 10, y: 4,  id: 'flower-meadow-01' },
  { type: 'FLOWER_SMALL',  x: 20, y: 5,  id: 'flower-meadow-02' },
  { type: 'FLOWER_SMALL',  x: 35, y: 3,  id: 'flower-meadow-03' },
  { type: 'DANDELION',     x: 45, y: 6,  id: 'dandelion-meadow-01' },

  // ── Village square / well area (center, rows 18-22) — 7 objects ──
  { type: 'WELL',          x: 28, y: 19, id: 'village-well' },
  { type: 'SIGNPOST',      x: 21, y: 19, id: 'signpost-square-01' },
  { type: 'SIGNPOST',      x: 36, y: 21, id: 'signpost-square-02' },
  { type: 'BENCH',         x: 23, y: 20, id: 'bench-square-01' },
  { type: 'BENCH',         x: 34, y: 20, id: 'bench-square-02' },
  { type: 'BENCH',         x: 42, y: 21, id: 'bench-square-03' },
  { type: 'LANTERN',       x: 26, y: 19, id: 'lantern-square' },

  // ── Baker's area (cols 8-16, rows 25-31) — 5 objects ──
  { type: 'APPLE_BASKET',  x: 15, y: 26, id: 'apple-basket-baker' },
  { type: 'FLOWER_SMALL',  x: 8,  y: 28, id: 'flower-baker-01' },
  { type: 'DANDELION',     x: 16, y: 29, id: 'dandelion-baker' },
  { type: 'LANTERN',       x: 9,  y: 27, id: 'lantern-baker' },
  { type: 'FLOWER_SMALL',  x: 7,  y: 30, id: 'flower-baker-02' },

  // ── Lily's area (cols 20-30, rows 31-36) — 4 objects ──
  { type: 'HANGING_LAUNDRY', x: 28, y: 33, id: 'laundry-lily' },
  { type: 'MAILBOX',       x: 22, y: 34, id: 'mailbox-lily' },
  { type: 'FLOWER_SMALL',  x: 21, y: 35, id: 'flower-lily-01' },
  { type: 'FLOWER_BIG',    x: 27, y: 35, id: 'flower-lily-02' },

  // ── Pond area (cols 36-45, rows 28-33) — 4 objects ──
  { type: 'POND',          x: 40, y: 30, id: 'village-pond' },
  { type: 'BENCH',         x: 45, y: 31, id: 'bench-pond' },
  { type: 'FLOWER_SMALL',  x: 37, y: 33, id: 'flower-pond-01' },
  { type: 'FLOWER_SMALL',  x: 43, y: 28, id: 'flower-pond-02' },

  // ── Finn's playground (cols 40-55, rows 34-38) — 2 objects ──
  { type: 'BENCH',         x: 43, y: 35, id: 'bench-finn' },
  { type: 'DANDELION',     x: 48, y: 36, id: 'dandelion-finn' },

  // ── Scattered for discovery — 3 more ──
  { type: 'FLOWER_SMALL',  x: 52, y: 5,  id: 'flower-east-01' },
  { type: 'FLOWER_SMALL',  x: 3,  y: 37, id: 'flower-south-01' },
  { type: 'SIGNPOST',      x: 27, y: 8,  id: 'signpost-north' },
];

// ── Ambient Animals ───────────────────────────────────────────────────────
// 16 animals distributed across the large map. Each has a roaming zone.

const animals = [
  // Butterflies — near flowers (4 total)
  { type: 'BUTTERFLY', x: 10,  y: 5,   spriteName: 'butterfly', zone: { x: 5,  y: 3,  w: 15, h: 6 } },
  { type: 'BUTTERFLY', x: 36,  y: 4,   spriteName: 'butterfly', zone: { x: 30, y: 2,  w: 15, h: 6 } },
  { type: 'BUTTERFLY', x: 22,  y: 35,  spriteName: 'butterfly', zone: { x: 20, y: 33, w: 10, h: 5 } },
  { type: 'BUTTERFLY', x: 48,  y: 36,  spriteName: 'butterfly', zone: { x: 43, y: 34, w: 12, h: 5 } },

  // Birds — near trees (3 total)
  { type: 'BIRD', x: 3,   y: 3,   spriteName: 'bird', zone: { x: 0,  y: 1,  w: 10, h: 6 } },
  { type: 'BIRD', x: 55,  y: 5,   spriteName: 'bird', zone: { x: 50, y: 3,  w: 10, h: 6 } },
  { type: 'BIRD', x: 5,   y: 18,  spriteName: 'bird', zone: { x: 2,  y: 16, w: 8,  h: 5 } },

  // Cat — sleeping near baker's shop
  { type: 'CAT', x: 15,  y: 30,  spriteName: 'cat', zone: { x: 10, y: 28, w: 10, h: 5 } },

  // Frogs — near pond (2 total)
  { type: 'FROG', x: 37,  y: 31,  spriteName: 'frog', zone: { x: 35, y: 29, w: 10, h: 5 } },
  { type: 'FROG', x: 43,  y: 32,  spriteName: 'frog', zone: { x: 38, y: 30, w: 8,  h: 4 } },

  // Ducks — on/near pond
  { type: 'DUCK', x: 40,  y: 30,  spriteName: 'duck', zone: { x: 38, y: 29, w: 6,  h: 4 } },

  // Dog — near Finn / playground
  { type: 'DOG', x: 46,  y: 37,  spriteName: 'dog', zone: { x: 42, y: 35, w: 10, h: 4 } },

  // Squirrel — near tree groves
  { type: 'SQUIRREL', x: 5,  y: 17, spriteName: 'squirrel', zone: { x: 2, y: 15, w: 8, h: 5 } },

  // Ladybug — near Lily's flowers
  { type: 'LADYBUG', x: 26,  y: 36, spriteName: 'ladybug', zone: { x: 22, y: 33, w: 8, h: 5 } },

  // Bunny — in meadow
  { type: 'BUNNY', x: 25,  y: 5,  spriteName: 'bunny', zone: { x: 20, y: 3, w: 12, h: 5 } },

  // Extra bird near south trees
  { type: 'BIRD', x: 50,  y: 37, spriteName: 'bird', zone: { x: 45, y: 35, w: 10, h: 4 } },
];

// ── Quests ────────────────────────────────────────────────────────────────
// Two full quests with multi-stage dialogue trees. Positions updated for 60x40 map.

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
        pickupX: 11,
        pickupY: 14,
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
  // Find Little Finn sitting near the playground. Talk to him,
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
        targetId: 'bench-finn',
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
    // Transition zone: bottom row path gap at cols 28-31
    zoneStartX: 28,
    zoneEndX: 31,
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
  width: 60,
  height: 40,
  tileSize: 16,
  tilesetPath: './sprites/town/tilemap_packed.png',

  // Player spawn — center of village square
  spawnX: 30,
  spawnY: 20,

  // Tile layers (each exactly 2400 values for 60x40)
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
