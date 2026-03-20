# Kenney Tiny Town — Tile ID Reference

Tileset: `tilemap_packed.png` (192x176 pixels)
Layout: **12 columns x 11 rows** of 16x16 tiles = **132 tiles total**
Tile ID formula: `row * 12 + col` (row-major, zero-indexed)

---

## Row 0 (IDs 0-11): Tree Canopies & Bushes

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 0  | 0   | Large green circle (left half) | Tree canopy top-left |
| 1  | 1   | Large green circle (right half) | Tree canopy top-right |
| 2  | 2   | Green with yellow dots | Flowering tree canopy |
| 3  | 3   | Orange/autumn tree top | Autumn tree canopy |
| 4  | 4   | Dark green triangle | Evergreen/pine tree top |
| 5  | 5   | Light green round | Small tree canopy |
| 6  | 6   | Round green bush | Bush (large) |
| 7  | 7   | Small dark green dome | Bush (small) |
| 8  | 8   | Green with brown base | Tree trunk with leaves (left) |
| 9  | 9   | Orange with brown base | Autumn tree trunk |
| 10 | 10  | Dark shape with eyes | Penguin / dark creature |
| 11 | 11  | Orange flame shape | Fire / torch flame |

## Row 1 (IDs 12-23): Tree Trunks & Plants

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 12 | 0   | Brown trunk, green leaves left | Tree bottom-left (trunk+leaves) |
| 13 | 1   | Brown trunk, green leaves right | Tree bottom-right (trunk+leaves) |
| 14 | 2   | Light orange/peach block | Sand/dirt block |
| 15 | 3   | Orange flower/torch | Warm decorative light |
| 16 | 4   | Green tree with trunk | Small complete tree |
| 17 | 5   | Green with pink spot | Fruit tree / flowering plant |
| 18 | 6   | Green fern/leaf | Small plant (fern) |
| 19 | 7   | Purple flowers on green | Small flower bush |
| 20 | 8   | Cactus (left) | Cactus left half |
| 21 | 9   | Cactus (right) | Cactus right half |
| 22 | 10  | Small dark plant | Dark shrub |
| 23 | 11  | Orange-brown shape | Autumn bush |

## Row 2 (IDs 24-35): Trunks, Fences, Terrain

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 24 | 0   | Brown square (light) | Tree trunk / wood block left |
| 25 | 1   | Brown square (darker) | Tree trunk / wood block right |
| 26 | 2   | Gray-brown block | Stone/dirt block |
| 27 | 3   | White picket section | Fence section (alt) |
| 28 | 4   | Green oval | Small bush / hedge |
| 29 | 5   | Red dots on green | Red flowers / berry bush |
| 30 | 6   | Brown-gray block | Dirt/path edge |
| 31 | 7   | Light brown block | Sand block |
| 32 | 8   | Gray stone block | Stone wall |
| 33 | 9   | Dark gray block | Dark stone |
| 34 | 10  | Blue-gray block | Slate/stone variant |
| 35 | 11  | Dark brown block | Dark wood |

## Row 3 (IDs 36-47): Ground Tiles & Terrain

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 36 | 0   | Light tan/sand | Sand / light dirt ground |
| 37 | 1   | Green | **GRASS (plain)** -- primary ground tile |
| 38 | 2   | Lighter green | **GRASS variant** -- secondary ground tile |
| 39 | 3   | Tan/dirt | Dirt path edge (left/top) |
| 40 | 4   | Tan/dirt (center) | **DIRT PATH center** -- main walkway |
| 41 | 5   | Tan/dirt (edge) | Dirt path edge (right/bottom) |
| 42 | 6   | Tan/dirt (vertical) | Dirt path vertical edge |
| 43 | 7   | Green with white dots | **GRASS with flowers** -- decorative ground |
| 44 | 8   | Gray cobble | Cobblestone ground |
| 45 | 9   | Darker cobble | Cobblestone variant |
| 46 | 10  | Light gray | Stone floor |
| 47 | 11  | Dark gray | Dark stone floor |

## Row 4 (IDs 48-59): Stone Walls & Blue Roofs

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 48 | 0   | Blue-gray block | Stone wall (blue tint) |
| 49 | 1   | Stone with window | Stone wall with window |
| 50 | 2   | Stone block plain | Stone wall mid |
| 51 | 3   | Blue-gray roof left | Blue roof left slope |
| 52 | 4   | Red brick pattern | Brick wall / blue roof mid |
| 53 | 5   | Red-orange block | Brick wall / blue roof right |
| 54 | 6   | Light blue block | Light stone |
| 55 | 7   | Blue roof peak | Blue roof peak / chimney |
| 56 | 8   | Gray arch top | Arch/doorway top |
| 57 | 9   | Gray arch mid | Arch/doorway mid |
| 58 | 10  | Dark gray block | Dark stone wall |
| 59 | 11  | Very dark block | Shadow / void |

## Row 5 (IDs 60-71): Red Roofs & Building Elements

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 60 | 0   | Orange-red block | Brick wall left |
| 61 | 1   | Red brick | Brick wall center |
| 62 | 2   | Red-orange block | Brick wall right |
| 63 | 3   | **Red roof left slope** | Roof left (red/orange) |
| 64 | 4   | **Red roof middle** | Roof mid tile |
| 65 | 5   | **Red roof right slope** | Roof right (red/orange) |
| 66 | 6   | Dark red block | Dark brick |
| 67 | 7   | **Red roof peak** | Roof peak / chimney cap |
| 68 | 8   | Gray stone arch | Building arch |
| 69 | 9   | Blue character | NPC / character sprite |
| 70 | 10  | Small figure | Character variant |
| 71 | 11  | Dark block | Dark wall |

## Row 6 (IDs 72-83): Wood Walls & Doors

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 72 | 0   | **Wood wall (left edge)** | Brown wood plank wall |
| 73 | 1   | **Wood wall (plain)** | Wood wall mid section |
| 74 | 2   | **Wood door** | Brown door (dark center) |
| 75 | 3   | **Wood wall + window** | Wall with window opening |
| 76 | 4   | Blue/gray wall | Stone-blue wall section |
| 77 | 5   | Light panel | Light wood/stone panel |
| 78 | 6   | Dark panel | Dark wood panel |
| 79 | 7   | Gray panel | Gray wall section |
| 80 | 8   | Dark arch | Dark archway |
| 81 | 9   | Stone wall | Gray stone wall |
| 82 | 10  | Dark stone | Dark stone wall |
| 83 | 11  | Very dark | Shadow tile |

## Row 7 (IDs 84-95): Dark Walls, Furniture, Decorations

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 84 | 0   | **Dark stone wall left** | Dungeon/dark building wall |
| 85 | 1   | **Dark stone wall mid** | Dark wall section |
| 86 | 2   | **Dark stone door** | Dark building door |
| 87 | 3   | **Dark stone + window** | Dark wall with window |
| 88 | 4   | Dark interior | Dark room interior |
| 89 | 5   | Red interior | Carpet / warm interior |
| 90 | 6   | Dark block | Dark furniture |
| 91 | 7   | Dark brown shape | Bookshelf / cabinet |
| 92 | 8   | **Well top** | Well with peaked roof |
| 93 | 9   | **Lantern** | Orange/warm light (lantern/mailbox) |
| 94 | 10  | Small object | Key / small item |
| 95 | 11  | Shiny object | Coin / gem |

## Row 8 (IDs 96-107): Fences, Benches, Furniture

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 96 | 0   | **White fence left** | Picket fence left end |
| 97 | 1   | **White fence mid** | Picket fence section |
| 98 | 2   | **White fence right** | Picket fence right end |
| 99 | 3   | Blue/white fence | Fence variant |
| 100| 4   | Blue fence section | Fence variant mid |
| 101| 5   | Blue fence end | Fence variant right |
| 102| 6   | Small object | Decoration |
| 103| 7   | Small round | Ball / small item |
| 104| 8   | **Well base** | Blue bucket / well bottom |
| 105| 9   | **Bench** | Dark wood bench |
| 106| 10  | **Stone/crate** | Rock or supply crate |
| 107| 11  | **Barrel** | Brown wooden barrel |

## Row 9 (IDs 108-119): Water Edges, Lamps, Signs

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 108| 0   | **Fence post** | Vertical fence post |
| 109| 1   | **Water top-left** | Water edge (NW corner) |
| 110| 2   | **Water top** | Water edge (north) |
| 111| 3   | **Water top-right** | Water edge (NE corner) |
| 112| 4   | **Water bottom** | Water edge (south) |
| 113| 5   | **Water bottom-right** | Water edge (SE corner) |
| 114| 6   | Blue block | Deep water variant |
| 115| 7   | Light blue | Shallow water |
| 116| 8   | **Sign/lamp post** | Wooden post with sign/light |
| 117| 9   | Cross/plus | Signpost / cross marker |
| 118| 10  | Arrow sign | Directional sign |
| 119| 11  | Small sign | Small sign post |

## Row 10 (IDs 120-131): Water Body, Special Objects

| ID | Col | Visual | Description |
|----|-----|--------|-------------|
| 120| 0   | **Water bottom-left** | Water edge (SW corner) |
| 121| 1   | **Water mid-left** | Water edge (west) |
| 122| 2   | **Water center** | Deep water (center body) |
| 123| 3   | **Water mid-right** | Water edge (east) |
| 124| 4   | Blue/dark | Water dark variant |
| 125| 5   | Blue ripple | Water ripple / fish |
| 126| 6   | Stone blue | Stone underwater |
| 127| 7   | Dark blue | Deep water dark |
| 128| 8   | Chest closed | Treasure chest (closed) |
| 129| 9   | Chest open | Treasure chest (open) |
| 130| 10  | Heart | Heart pickup |
| 131| 11  | Star | Star pickup |

---

## Quick Reference: Most-Used Tiles

### Ground (fill every cell)
- `37` -- Grass (primary)
- `38` -- Grass (variant, for visual variety)
- `43` -- Grass with flowers
- `40` -- Dirt path center
- `39, 41, 42` -- Dirt path edges

### Buildings
- `63-65, 67` -- Red/orange roof (left, mid, right, peak)
- `72-75` -- Wood walls (left, mid, door, window)
- `84-87` -- Dark stone walls (left, mid, door, window)
- `96-98` -- White picket fence (left, mid, right)

### Trees (2x2 with depth)
- Object layer: `12, 13` (trunk+leaves bottom)
- Foreground layer: `0, 1` (canopy top -- drawn OVER entities!)
- Variants: `2` (flowering), `4` (evergreen)

### Water (3x3 pond)
- Top: `109, 110, 111`
- Mid: `121, 122, 123`
- Bottom: `120, 112, 113`

### Decorations
- `92` -- Well top, `104` -- Well base
- `105` -- Bench
- `116` -- Sign/lamp post
- `93` -- Lantern/mailbox
- `107` -- Barrel
- `106` -- Stone/crate
- `18, 19` -- Small plants/flowers (objects layer)
- `6, 7` -- Bushes
