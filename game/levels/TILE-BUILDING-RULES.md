# Tile Building Rules — HARD RULES (Verified from Research + Visual Inspection)

## GROUND (always tile 1 or 2, NEVER empty)
- Tile 1 = plain green grass (60% of ground)
- Tile 2 = grass with flowers (30% of ground)
- NEVER use tile 37/38/43 for grass — those are path/dirt tiles

## BUILDINGS (2-row vertical stack: roof above, walls below)

### Red/Orange Roof
- 63 = left slope
- 64 = middle (repeat for wider buildings)
- 65 = right slope
- 67 = chimney/peak accent

### Wood Walls
- 72 = left edge
- 73 = plain middle
- 74 = DOOR
- 75 = window

### Dark Stone Walls (shops/important buildings)
- 84 = left edge
- 85 = plain middle
- 86 = DOOR
- 87 = window

### Building Template (5-wide house):
```
Objects layer:
  Row N:   63, 64, 64, 64, 65      ← roof
  Row N+1: 72, 75, 74, 75, 73      ← walls (window, door, window)

Collision:
  Row N:   1, 1, 1, 1, 1
  Row N+1: 1, 1, 1, 1, 1           ← door blocks too (visual only)
```

### Building Template (3-wide shop):
```
Objects layer:
  Row N:   63, 67, 65               ← roof with chimney
  Row N+1: 84, 86, 85               ← stone walls with door
```

### HARD RULES:
1. Roof row DIRECTLY above wall row, same columns, same width
2. Minimum building width: 3 tiles
3. Exactly ONE door per building
4. Door must face a path (within 1-3 tiles)
5. Ground under building = grass (tile 1), building on objects layer

## FENCES (below buildings, around yards)
- 96 = left end
- 97 = middle (repeat)
- 98 = right end
- 108 = vertical post
- Gap = -1 (empty) aligned with door above for entrance

### Fence Template:
```
  96, 97, -1, 97, 98     ← gap aligned with door
```

## PATHS (narrow lines through grass, 10-15% of ground)
- 40 = dirt center
- 39 = left/top edge (grass on left/top side)
- 41 = right/bottom edge (grass on right/bottom side)

### N-S path (2-wide):
  Left column: tile 39, Right column: tile 41

### E-W path (2-wide):
  Top row: tile 39, Bottom row: tile 41

### Intersections: use tile 40 (center) where paths cross

## TREES (2-layer depth system)
### Large tree (2x2):
```
FOREGROUND layer: 4, 5     ← canopy (drawn OVER player)
OBJECTS layer:    12, 13    ← trunk (blocks player)
```
Canopy row is ALWAYS one row ABOVE trunk row.

### Autumn tree (2x2):
```
FOREGROUND: 7, 8     ← autumn canopy
OBJECTS:    12, 13   ← same trunks
```

### Small trees (1 tile, objects layer only): 6, 16

### HARD TREE RULES:
1. Canopy row is ALWAYS row Y, trunk row is ALWAYS row Y+1 (canopy ABOVE trunk)
2. Canopy and trunk must be at the SAME X columns
3. NEVER place trunk at row 0 — the canopy would be off-map (row -1) and get cut off
4. Minimum trunk row = 1 (so canopy is at row 0, the top of the map)
5. NEVER place canopy without trunk below it (floating green blob)
6. NEVER place trunk without canopy above it (headless stump)
7. If a tree is near the bottom edge, trunk at row 18 max (canopy at 17), so nothing clips off screen
8. Trees at map edges should be placed so BOTH canopy and trunk are fully visible

## WATER (9-tile edge system, minimum 3x3)
```
109, 110, 111     ← NW corner, N edge, NE corner
121, 122, 123     ← W edge, CENTER, E edge
120, 112, 113     ← SW corner, S edge, SE corner
```
ALL 9 edge tiles required. Never water adjacent to buildings (2+ tiles gap).

## DECORATIONS
- 92 = well (top)
- 104 = well (bottom) — place directly below 92
- 19 = flower bush (purple/pink flowers) — village-friendly seating marker
- 107 = barrel (also used for crates — tile 106 was dark/round, looked like a bomb)
- 93 = lantern/signpost (warm orange post — tile 116 had fork shape, looked like a weapon)
- 28 = bush (green oval hedge)
- 29 = berry bush (red berries on green)

### DEPRECATED decoration tiles (DO NOT USE in village levels):
- 105 = bench — too dark at 16px, reads as "dark bomb" to young players
- 106 = crate — dark rounded shape, reads as "bomb" at small sizes
- 116 = signpost — cross/trident shape, reads as "fork/weapon" at small sizes
- 14 = peach block (NOT a bush despite old docs)
