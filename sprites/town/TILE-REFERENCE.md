# Kenney Tiny Town - Tile ID Visual Reference

**Tileset**: `tilemap_packed.png`
**Dimensions**: 192x176 pixels
**Grid**: 12 columns x 11 rows of 16x16 tiles = 132 tiles total
**Tile ID formula**: `row * 12 + col`

---

## Row 0 (IDs 0-11)
| ID | Visual | Description |
|----|--------|-------------|
| 0 | Star | Yellow star/sparkle |
| 1 | Grass | Light green grass (plain) |
| 2 | Grass+ | Grass with tiny flowers |
| 3 | Path edge | Grass-to-dirt transition, top |
| 4 | Tree TL | Green round tree canopy top-left |
| 5 | Tree TR | Green round tree canopy top-right |
| 6 | Tree sm | Green round tree (full small, 1 tile) |
| 7 | Autumn TL | Orange/autumn tree canopy top-left |
| 8 | Autumn TR | Orange/autumn tree canopy top-right |
| 9 | Autumn sm | Orange tree (full small, 1 tile) |
| 10 | Pine top | Tall pine tree top |
| 11 | Tree var | Another tree variant top |

## Row 1 (IDs 12-23)
| ID | Visual | Description |
|----|--------|-------------|
| 12 | Trunk L | Green tree trunk-left |
| 13 | Trunk R | Green tree trunk-right |
| 14 | Bush | Green bush/shrub |
| 15 | DkTree TL | Dark green tree canopy top-left |
| 16 | DkTree TR | Dark green tree canopy top-right |
| 17 | DkBush | Dark green bush |
| 18 | OTrunk L | Orange tree trunk-left |
| 19 | OTrunk R | Orange tree trunk-right |
| 20 | OBush | Orange bush |
| 21 | PineTrunk | Pine tree trunk |
| 22 | Trunk var | Tree trunk variant |
| 23 | Stump | Dead tree/stump |

## Row 2 (IDs 24-35) - PATH TILES
| ID | Visual | Description |
|----|--------|-------------|
| 24 | Path | Dirt/path center (plain) |
| 25 | Path-T | Path with grass edge on top |
| 26 | Path-R | Path with grass edge on right |
| 27 | Corner TR | Path corner top-right (grass inside) |
| 28 | Path-B | Path with grass edge on bottom |
| 29 | Corner BR | Path corner bottom-right |
| 30 | T-Right | Path T-junction (right side) |
| 31 | Cross | Path crossroads |
| 32 | Path-L | Path with grass edge on left |
| 33 | Corner TL | Path corner top-left |
| 34 | T-Top | Path T-junction (top) |
| 35 | T-Left | Path T-junction (left side) |

## Row 3 (IDs 36-47)
| ID | Visual | Description |
|----|--------|-------------|
| 36 | Corner BL | Path corner bottom-left |
| 37 | T-Bottom | Path T-junction (bottom) |
| 38 | Water TL | Water edge top-left |
| 39 | Water T | Water edge top |
| 40 | Water TR | Water edge top-right |
| 41 | DkGrass | Dark grass/shadow |
| 42 | Lt Dirt | Lighter dirt |
| 43 | Grass var | Grass variant |
| 44 | Dirt var | Dirt variant |
| 45-47 | Terrain | More terrain variants |

## Row 4 (IDs 48-59) - FENCES
| ID | Visual | Description |
|----|--------|-------------|
| 48 | Fence H | Fence horizontal |
| 49 | Fence V | Fence vertical |
| 50 | Fence TL | Fence corner top-left |
| 51 | Fence TR | Fence corner top-right |
| 52 | Fence BL | Fence corner bottom-left |
| 53 | Fence BR | Fence corner bottom-right |
| 54 | Gate | Fence gate/opening |
| 55 | Sign | Sign post |
| 56 | DirSign | Directional sign |
| 57-59 | Fence+ | More fence/sign variants |

## Row 5 (IDs 60-71) - ROOFS
| ID | Visual | Description |
|----|--------|-------------|
| 60 | BrRoof L | Brown roof top-left |
| 61 | BrRoof M | Brown roof top-center |
| 62 | BrRoof R | Brown roof top-right |
| 63 | BrRoof eL | Brown roof left edge |
| 64 | BrRoof eM | Brown roof center fill |
| 65 | BrRoof eR | Brown roof right edge |
| 66 | Chimney | Chimney |
| 67 | RdRoof L | Red/dark roof top-left |
| 68 | RdRoof M | Red roof top-center |
| 69 | RdRoof R | Red roof top-right |
| 70 | RdRoof eL | Red roof left edge |
| 71 | RdRoof eR | Red roof right edge |

## Row 6 (IDs 72-83) - WALLS
| ID | Visual | Description |
|----|--------|-------------|
| 72 | Wood L | Wood wall left |
| 73 | Wood C | Wood wall center |
| 74 | Wood R | Wood wall right |
| 75 | WoodDoor | Wood door (brown) |
| 76 | WoodWin | Wood window |
| 77 | Wall var | Wall variant |
| 78 | Stone L | Stone wall left |
| 79 | Stone C | Stone wall center |
| 80 | Stone R | Stone wall right |
| 81 | StoneDoor | Stone door |
| 82 | StoneWin | Stone window |
| 83 | Wall var | Wall variant |

## Row 7 (IDs 84-95) - CASTLE/ARCHITECTURE
| ID | Visual | Description |
|----|--------|-------------|
| 84-87 | Castle | Grey/castle wall pieces |
| 88 | Arch TL | Arch/gate top-left |
| 89 | Arch TC | Arch top-center |
| 90 | Arch TR | Arch top-right |
| 91-95 | Arch+ | More architecture pieces |

## Row 8 (IDs 96-107) - OBJECTS & NPCs
| ID | Visual | Description |
|----|--------|-------------|
| 96 | Well | Well |
| 97 | Barrel | Barrel |
| 98 | Crate | Crate/box |
| 99 | Fountain | Fountain |
| 100 | Market | Market stall |
| 101 | Anvil | Anvil/workbench |
| 102 | NPC 1 | Character/NPC sprite 1 |
| 103 | NPC 2 | Character/NPC sprite 2 |
| 104 | NPC blue | Character blue |
| 105 | NPC var | Character variant |
| 106 | Bench | Bench |
| 107 | Lamp | Lamp post |

## Row 9 (IDs 108-119) - WATER & FLOWERS
| ID | Visual | Description |
|----|--------|-------------|
| 108 | Water | Water full tile |
| 109 | Water L | Water edge left |
| 110 | Water R | Water edge right |
| 111 | Water BL | Water edge bottom-left |
| 112 | Water B | Water edge bottom |
| 113 | Water BR | Water edge bottom-right |
| 114 | Bridge H | Bridge horizontal |
| 115 | Bridge V | Bridge vertical |
| 116 | FlowerR | Flowers red |
| 117 | FlowerY | Flowers yellow |
| 118 | FlowerB | Flowers blue |
| 119 | Rock | Small rock/stone |

## Row 10 (IDs 120-131) - DECORATIONS
| ID | Visual | Description |
|----|--------|-------------|
| 120 | Mushroom | Mushroom |
| 121 | Pumpkin | Pumpkin |
| 122 | Hay | Hay bale |
| 123 | Campfire | Campfire |
| 124 | Tombstone | Tombstone |
| 125 | Chest | Chest |
| 126 | Boat | Boat |
| 127 | Dock | Dock piece |
| 128 | Tools | Tools |
| 129 | Wheelbarrow | Wheelbarrow |
| 130 | Cart | Cart |
| 131 | Flag | Flag |

---

## BUILDING PATTERNS

### House (3 wide x 2 tall)
```
Roof:   60, 61, 62      (brown roof L, M, R)
Walls:  72, 75, 74      (wall L, DOOR, wall R)
```

### House with windows (4 wide x 2 tall)
```
Roof:   60, 61, 61, 62
Walls:  76, 73, 75, 74   (window, wall, door, wall R)
```

### Stone house (3 wide x 2 tall)
```
Roof:   67, 68, 69      (red roof L, M, R)
Walls:  78, 81, 80      (stone L, stone DOOR, stone R)
```

### Fence enclosure
```
50, 48, 48, 51          (corner TL, horiz, horiz, corner TR)
49,  _,  _, 49          (vert, open, open, vert)
52, 48, 54, 53          (corner BL, horiz, GATE, corner BR)
```

### Pond (4 wide x 3 tall)
```
38, 39, 39, 40          (water TL, top, top, TR)
109, 108, 108, 110      (water L, full, full, R)
111, 112, 112, 113      (water BL, bottom, bottom, BR)
```

### Path that turns (with grass borders)
```
 G, 33, 25, 27,  G     (grass, corner TL, top edge, corner TR, grass)
 G, 32, 24, 26,  G     (grass, left edge, center, right edge, grass)
 G, 36, 28, 29,  G     (grass, corner BL, bottom edge, corner BR, grass)
```

### Tree with depth (2 layers)
```
Objects layer:     12, 13    (trunk left, trunk right)
Foreground layer:   4,  5    (canopy left, canopy right — drawn OVER entities)
```

---

## PATH CONNECTION RULES

Path edges face the direction of the grass (not the path):
- **25** (PT): grass is on TOP of the path tile
- **26** (PR): grass is on the RIGHT
- **28** (PB): grass is on the BOTTOM
- **32** (PL): grass is on the LEFT

Corners are where two edges meet:
- **33** (CTL): grass on top AND left (path goes right and down)
- **27** (CTR): grass on top AND right (path goes left and down)
- **36** (CBL): grass on bottom AND left (path goes right and up)
- **29** (CBR): grass on bottom AND right (path goes left and up)

T-junctions:
- **34** (TJT): path splits upward (three-way, opening on top)
- **37** (TJB): path splits downward
- **30** (TJR): path splits rightward
- **35** (TJL): path splits leftward

Crossroads:
- **31** (PX): four-way intersection

---

## LAYER SYSTEM

1. **Ground layer**: Always fully filled. Grass (1, 2) and path tiles (24-37). Every cell has a tile.
2. **Objects layer**: Buildings, trees (trunks), fences, furniture, water. Use -1 for empty cells.
3. **Collision layer**: 0 = walkable, 1 = blocked. Buildings, tree trunks, fences (not gates), water, wells, fountains block.
4. **Foreground layer**: Tree canopies only. Drawn OVER entities so player walks "under" trees. Use -1 for empty.
