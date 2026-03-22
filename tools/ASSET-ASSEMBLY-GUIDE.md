# Kenney Tiny Town — Complete Asset Assembly Guide

**Source**: Visual analysis of `tilemap_packed.png`, `tilemap.png` (spaced), and Kenney example scenes.
**Purpose**: This is the ground truth for how tiles combine into complete visual assets. The map builder MUST use these assemblies — never place individual tiles.

---

## How To Read This Guide

Each asset below shows:
- **Visual layout** as a grid (top row = top of asset)
- **Tile IDs** for each cell
- **Layer** each tile belongs to (G=ground, O=objects, C=collision, F=foreground)
- **Minimum size** — the smallest valid instance

**CRITICAL RULE**: These are ATOMIC units. You place the whole asset or nothing. Never place a roof without walls. Never place a trunk without canopy. Never place a single water edge without the full pond.

---

## Tile Roles: Border vs Continuance

Every tile in a multi-tile asset has one of two roles:

### BORDER tiles (use once, at the edge)
These define the boundary/end of a structure. They have visible edges, slopes, corners, or caps.
- Roof left slope (63), roof right slope (65) — angled edges
- Wall left edge (72), implied right edge — edge detail
- Fence left end (96), fence right end (98) — caps
- Water corners (109, 111, 120, 113) — corner curves
- Water N/S/E/W edges (110, 112, 121, 123) — straight edges
- Roof peak/chimney (67, 55) — top cap

### CONTINUANCE tiles (repeat to fill interior)
These are seamless center tiles that repeat to make an asset wider or taller.
- Roof middle (64) — flat roof surface, repeat for wider buildings
- Wall plain mid (73, 85) — plain wall, repeat horizontally for wider buildings
- Wall rows — repeat VERTICALLY to make taller buildings (stack 84/85 rows)
- Fence mid (97, 100) — repeat for longer fences
- Water center (122) — repeat for larger ponds
- Path center (40) — repeat to extend paths
- Grass tiles (1, 2, 43) — all continuance, fill everywhere

### How this applies to building width:

A **3-wide** building: `[BORDER_L] [CENTER] [BORDER_R]`
A **5-wide** building: `[BORDER_L] [CENTER] [CENTER] [CENTER] [BORDER_R]`
A **7-wide** building: `[BORDER_L] [CENTER] [CENTER] [CENTER] [CENTER] [CENTER] [BORDER_R]`

The border tiles go at the edges ONCE. The center tiles repeat to fill.

Same vertically for walls:
A **2-tall** wall: wall row repeated 2x (minimum for a building to read as a structure)
A **3-tall** wall: wall row repeated 3x (for larger buildings)

The roof is always 1 row. Walls stack below it.

---

## 1. TREES

### Green Round Tree (2 wide x 2 tall)
The most common tree. Canopy overlaps entities (foreground layer).

```
Row 0:  [ 4 ] [ 5 ]    ← Foreground layer (drawn OVER player)
Row 1:  [12 ] [13 ]    ← Objects layer (blocks movement)
```

| Cell | Tile | Layer | Collision |
|------|------|-------|-----------|
| (0,0) | 4 — canopy left | Foreground | 0 |
| (1,0) | 5 — canopy right | Foreground | 0 |
| (0,1) | 12 — trunk left | Objects | 1 |
| (1,1) | 13 — trunk right | Objects | 1 |

### Autumn Round Tree (2 wide x 2 tall)
Same structure, autumn palette.

```
Row 0:  [ 7 ] [ 8 ]    ← Foreground layer
Row 1:  [24 ] [25 ]    ← Objects layer
```

Note: Trunks are tiles 24/25 (autumn trunk), NOT 12/13 (green trunk).

### Pointed Pine Tree (1 wide x 2 tall)

```
Row 0:  [10 ]    ← Foreground layer
Row 1:  [22 ]    ← Objects layer
```

### Dense/Dark Pine Tree (1 wide x 2 tall)

```
Row 0:  [11 ]    ← Foreground layer
Row 1:  [23 ]    ← Objects layer
```

### Small Single Trees (1x1, objects layer only)
These are complete as single tiles — no foreground needed:
- Tile 6 — small round green tree
- Tile 9 — small round autumn tree
- Tile 16 — small tree with visible trunk
- Tile 17 — fruit/flowering tree (pink dots)

---

## 2. BUILDINGS

**CRITICAL**: Buildings are 3+ rows tall, not 2. Reference: `tiny_animalsanctuary.png` shows roof + 2 wall rows minimum.

### Small Wood House (3 wide x 3 tall)

```
Row 0:  [63 ] [67 ] [65 ]    ← Roof: left slope, chimney/peak, right slope
Row 1:  [72 ] [75 ] [73 ]    ← Upper wall: left edge, window, plain
Row 2:  [72 ] [74 ] [73 ]    ← Lower wall: left edge, DOOR, plain
```

All tiles in Objects layer. Collision = 1 for all EXCEPT door (74) = 0.

Door (row 2 center) must face a path within 1-2 tiles.

### Medium Wood House (4 wide x 3 tall)

```
Row 0:  [63 ] [64 ] [67 ] [65 ]    ← Roof with chimney
Row 1:  [72 ] [75 ] [73 ] [75 ]    ← Upper wall: windows on sides
Row 2:  [72 ] [73 ] [74 ] [73 ]    ← Lower wall: door in center
```

### Large Wood House (5 wide x 3 tall)

```
Row 0:  [63 ] [64 ] [67 ] [64 ] [65 ]    ← Wide roof with chimney
Row 1:  [72 ] [75 ] [73 ] [75 ] [73 ]    ← Upper wall: windows
Row 2:  [72 ] [73 ] [74 ] [73 ] [73 ]    ← Lower wall: door
```

### Small Stone Shop (3 wide x 3 tall)

```
Row 0:  [63 ] [67 ] [65 ]    ← Red roof (same roof tiles for all buildings)
Row 1:  [84 ] [87 ] [85 ]    ← Dark stone upper wall: window
Row 2:  [84 ] [86 ] [85 ]    ← Dark stone lower wall: door
```

### Medium Stone Shop (5 wide x 3 tall)

```
Row 0:  [63 ] [64 ] [67 ] [64 ] [65 ]    ← Red roof with chimney
Row 1:  [84 ] [87 ] [85 ] [87 ] [85 ]    ← Stone upper wall: windows
Row 2:  [84 ] [85 ] [86 ] [85 ] [85 ]    ← Stone lower wall: door
```

### Blue Roof Stone Building (3 wide x 3 tall)
From the `tiny_animalsanctuary.png` example.

```
Row 0:  [51 ] [55 ] [53 ]    ← Blue roof: left slope, peak, right slope
Row 1:  [48 ] [49 ] [50 ]    ← Stone upper wall
Row 2:  [48 ] [49 ] [50 ]    ← Stone lower wall (49 may have door/window)
```

Note: Tiles 48-50 may need visual verification. Tile 49 appears to function as both window and door for stone buildings.

### Brick Building (3 wide x 3 tall)

```
Row 0:  [63 ] [67 ] [65 ]    ← Red roof
Row 1:  [60 ] [61 ] [62 ]    ← Brick upper wall
Row 2:  [60 ] [61 ] [62 ]    ← Brick lower wall (need to identify brick door tile)
```

Note: Brick walls (60-62) may not have a dedicated door tile. Consider using stone arch (56/57) or wood door (74) as the entrance.

### Stone Arch Entrance (1 wide x 2 tall)
A standalone doorway, can be added to any building front.

```
Row 0:  [56 ]    ← Arch top (curved stone)
Row 1:  [57 ]    ← Arch base (open passage)
```

Collision: top = 1, base = 0 (walkable passage).

---

## 3. FENCES

Fences are 1 tile tall, variable width. Gate gaps use -1 (empty).

### White Picket Fence

```
[96] [97] [97] [-1] [97] [97] [98]
 ↑    ↑    ↑    ↑    ↑    ↑    ↑
left  mid  mid  GATE mid  mid  right
```

- 96 = left end cap
- 97 = middle section (repeat as needed)
- 98 = right end cap
- -1 = gate opening (align with building door!)
- All fence tiles: collision = 1. Gate: collision = 0.

### Brown Wood Fence

```
[99] [100] [100] [-1] [100] [100] [101]
```

- 99 = left end
- 100 = middle
- 101 = right end
- Same gate pattern as white fence

### Vertical Fence Post
- Tile 108 = standalone vertical post
- Use at fence corners or as standalone markers

---

## 4. WATER

Water uses a 9-tile edge system. Minimum size is 3x3.

### Pond (3x3 minimum)

```
Row 0:  [109] [110] [111]    ← NW corner, N edge, NE corner
Row 1:  [121] [122] [123]    ← W edge, CENTER, E edge
Row 2:  [120] [112] [113]    ← SW corner, S edge, SE corner
```

All water tiles: collision = 1 (can't walk on water).

### Larger Pond (4x3 or wider)
Repeat edge and center tiles to extend:

```
Row 0:  [109] [110] [110] [111]    ← N edge repeated
Row 1:  [121] [122] [122] [123]    ← Center repeated
Row 2:  [120] [112] [112] [113]    ← S edge repeated
```

### Taller Pond (3x4 or taller)

```
Row 0:  [109] [110] [111]
Row 1:  [121] [122] [123]    ← W/E edges repeated vertically
Row 2:  [121] [122] [123]
Row 3:  [120] [112] [113]
```

### Water Variant Tiles (for larger bodies)
- 114 — deep water variant / inner corner
- 115 — shallow water / light reflection
- 124-127 — additional water variants for large lakes
- 125 — water with ripple/lily pad detail

---

## 5. WELL (1 wide x 2 tall)

```
Row 0:  [92 ]    ← Well top (peaked roof structure)
Row 1:  [104]    ← Well base (stone base with blue water)
```

Both tiles: Objects layer, collision = 1.
Place near a path, often at village center/crossroads.

---

## 6. GROUND / TERRAIN

### Grass Tiles (fill every cell in ground layer)
- Tile 1 — plain green grass (use ~70%)
- Tile 2 — grass with small orange flowers (use ~15%)
- Tile 43 — grass with white daisies (use ~10%)
- Tile 37/38 — alternate green shades (use ~5% for subtle variation)

**IMPORTANT**: Tile 2 has prominent orange dots. Overusing it creates a wallpaper pattern. Keep usage LOW and clustered near points of interest, not evenly distributed.

### Dirt Path Tiles
- Tile 40 — path center (the main walkway surface)
- Tile 39 — path edge where grass is on LEFT or TOP
- Tile 41 — path edge where grass is on RIGHT or BOTTOM
- Tile 42 — path edge for vertical orientation

**Path construction**: Paths are 2+ tiles wide.

Horizontal path (E-W):
```
[39] [39] [39] [39]    ← Top edge (grass above)
[41] [41] [41] [41]    ← Bottom edge (grass below)
```

Vertical path (N-S):
```
[39] [41]    ← Left edge, right edge
[39] [41]
[39] [41]
```

Intersection (where paths cross):
```
[39] [40] [40] [41]    ← Transition row
[40] [40] [40] [40]    ← All center
[40] [40] [40] [40]    ← All center
[39] [40] [40] [41]    ← Transition row
```

### Other Ground Tiles
- Tile 36 — light sand/tan ground
- Tile 44 — light cobblestone
- Tile 45 — dark cobblestone
- Tile 46 — light stone floor (interior)
- Tile 47 — dark stone floor (interior)

---

## 7. BUSHES & PLANTS (1x1, Objects layer)

All placed as single tiles in the objects layer:
- Tile 28 — green oval bush/hedge
- Tile 29 — berry bush (green with red dots)
- Tile 19 — purple/pink flower bush
- Tile 18 — green fern/small plant
- Tile 15 — orange tulip flower (confirmed from example scenes)

Collision: bushes (28, 29) = 1 (block movement). Plants/flowers (15, 18, 19) = 0 (walkable).

### Cactus (2 wide x 1 tall)
```
[20] [21]    ← Left half, right half
```

---

## 8. DECORATIONS (1x1, Objects layer)

- Tile 93 — lantern/lamppost (warm orange glow)
- Tile 107 — wooden barrel
- Tile 128 — treasure chest (closed)
- Tile 129 — treasure chest (open)
- Tile 94 — golden key
- Tile 95 — golden coin/gem
- Tile 130 — heart pickup
- Tile 131 — star pickup

### DEPRECATED — DO NOT USE
- Tile 14 — renders as peach/cream block (not a bush)
- Tile 105 — renders as dark blob (looks like bomb)
- Tile 106 — renders as dark rounded shape (looks like bomb)
- Tile 116 — renders as cross/trident (looks like weapon)

---

## 9. SIGNS (1x1, Objects layer)

- Tile 117 — cross/directional signpost
- Tile 118 — arrow directional sign
- Tile 119 — small wooden sign

---

## 10. CHARACTERS (1x1, embedded in tileset)

- Tile 69 — blue-clothed NPC character
- Tile 70 — light-clothed NPC character

These are static sprites. For animated characters, use the separate character sprite sheets.

---

## ASSEMBLY ORDER

When building a map, assets are placed in this order:

1. **Ground layer**: Fill EVERY cell with grass/path tiles. No gaps.
2. **Water**: Place complete ponds (all 9+ tiles as a unit)
3. **Paths**: Draw 2-tile-wide paths connecting points of interest
4. **Buildings**: Place complete 3-row buildings as atomic units
5. **Fences**: Attach to buildings, gate aligned with door
6. **Trees**: Place as 2x2 or 1x2 units (foreground + objects layers together)
7. **Vegetation**: Bushes, flowers near buildings and paths
8. **Furniture**: Well, barrels, lanterns, signs
9. **Collectibles**: Chests, keys, hearts, stars (for gameplay)
10. **Collision**: Auto-fill from objects (buildings=1, doors=0, trees=1, water=1, fences=1)

---

## VALIDATION RULES

After placing any asset, verify:
- [ ] Every canopy tile (4,5,7,8,10,11) has its matching trunk directly below
- [ ] Every trunk tile (12,13,22,23,24,25) has its matching canopy directly above
- [ ] Every building has roof row directly above wall rows (no gap)
- [ ] Every building door faces a path within 2 tiles
- [ ] Every fence gate aligns with a building door
- [ ] Every pond has all edge tiles (no missing corners)
- [ ] No deprecated tiles (14, 105, 106, 116) used anywhere
- [ ] Ground layer has zero -1 gaps
