# Complete Visual Asset Audit -- Princess Sparkle V2

**Audited**: 2026-03-20
**Total image files**: 1,615 across all sprite packs
**Tilesets audited**: 4 packed tilemaps + 6 spritesheets + individual frame packs

---

## 1. Kenney Tiny Town Tileset (132 tiles)

**File**: `sprites/town/tilemap_packed.png` (192x176 px)
**Layout**: 12 columns x 11 rows, 16x16 px per tile
**Individual tiles**: `sprites/town/tiles/tile_0000.png` through `tile_0131.png`
**Tile ID formula**: `row * 12 + col` (zero-indexed)

### Row 0 (IDs 0-11): Ground Base and Tree Canopies

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 0 | Yellow 4-pointed sparkle/star on transparent bg | decoration | Standalone decorative overlay |
| 1 | Solid green grass tile (medium green, uniform) | ground | Primary ground -- use as base fill |
| 2 | Green grass with tiny yellow flower specks | ground | Variant of 1 -- mix for visual interest |
| 3 | Light tan/beige block -- grass-to-dirt transition | ground/edge | Use at border of grass and path areas |
| 4 | Green round tree canopy -- top-left quadrant | nature/tree | Pairs with 5 (top-right), 12 (bottom-left), 13 (bottom-right) for 2x2 tree |
| 5 | Green round tree canopy -- top-right quadrant | nature/tree | Pairs with 4 (top-left) |
| 6 | Small single-tile round green tree/bush | nature/tree | Standalone small tree |
| 7 | Orange/autumn tree canopy -- top-left quadrant | nature/tree | Pairs with 8 (top-right), 24 (bottom-left), 25 (bottom-right) for autumn 2x2 tree |
| 8 | Orange/autumn tree canopy -- top-right quadrant | nature/tree | Pairs with 7 (top-left) |
| 9 | Small single-tile orange/autumn tree | nature/tree | Standalone small autumn tree |
| 10 | Tall dark green pine/conifer tree top | nature/tree | Pairs with 22 (trunk below) |
| 11 | Dark green dense tree top variant | nature/tree | Pairs with 23 (trunk below) |

### Row 1 (IDs 12-23): Tree Trunks, Plants, Vegetation

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 12 | Brown tree trunk with green leaves -- bottom-left | nature/tree | Bottom-left of 2x2 green tree (with 4,5,13) |
| 13 | Brown tree trunk with green leaves -- bottom-right | nature/tree | Bottom-right of 2x2 green tree (with 4,5,12) |
| 14 | Light peach/cream solid block | ground | Sand or light dirt fill |
| 15 | Orange-red flower or torch flame on stem | nature/decoration | Warm decorative accent -- torch or tall flower |
| 16 | Small green tree on brown trunk -- complete | nature/tree | Standalone complete small tree with visible trunk |
| 17 | Green canopy with pink/red spot -- fruit tree | nature/tree | Standalone fruit or flowering tree |
| 18 | Small green fern/leaf sprite | nature/plant | Small ground-level plant decoration |
| 19 | Purple/pink flowers on green base | nature/plant | Small flower bush decoration |
| 20 | Green cactus -- left half | nature/plant | Pairs with 21 (right half) for 2-tile cactus |
| 21 | Green cactus -- right half | nature/plant | Pairs with 20 (left half) |
| 22 | Dark green dense shrub / pine trunk | nature/tree | Trunk below tile 10 (pine top) |
| 23 | Orange-brown autumn bush | nature/plant | Standalone autumn shrub, or trunk below tile 11 |

### Row 2 (IDs 24-35): Trunks, Solid Blocks, Terrain Fills

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 24 | Light brown wood block | building/wood | Autumn tree trunk bottom-left (with 7,8,25), or wood block |
| 25 | Darker brown wood block | building/wood | Autumn tree trunk bottom-right (with 7,8,24), or wood block |
| 26 | Gray-brown block | ground/stone | Stone or dirt solid block |
| 27 | White picket fence section (alt pattern) | decoration/fence | Alternate fence piece |
| 28 | Green oval bush/hedge | nature/plant | Small decorative hedge |
| 29 | Red dots on green -- berry bush | nature/plant | Berry bush or red flower cluster |
| 30 | Brown-gray solid block | ground | Dirt/mud solid fill |
| 31 | Light tan/sand block | ground | Sandy ground fill |
| 32 | Medium gray stone block | building/stone | Stone wall or ground fill |
| 33 | Dark gray stone block | building/stone | Dark stone wall fill |
| 34 | Blue-gray slate block | building/stone | Slate or cool-toned stone |
| 35 | Dark brown/chocolate block | building/wood | Dark wood fill |

### Row 3 (IDs 36-47): Path System and Ground Variants

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 36 | Light tan/sand ground tile | ground | Sand or dry ground fill |
| 37 | Medium green grass (slightly different shade from 1) | ground | Secondary grass fill |
| 38 | Lighter green grass variant | ground | Third grass variant for variety |
| 39 | Tan dirt with left/top edge detail | ground/path | Path edge -- left or top border |
| 40 | Tan dirt center -- uniform | ground/path | Main walkable path center fill |
| 41 | Tan dirt with right/bottom edge detail | ground/path | Path edge -- right or bottom border |
| 42 | Tan dirt with vertical edge | ground/path | Path vertical edge piece |
| 43 | Green grass with white flower dots | ground | Decorative grass accent with daisies |
| 44 | Light gray cobblestone pattern | ground | Cobblestone path/plaza fill |
| 45 | Darker gray cobblestone | ground | Cobblestone variant for variety |
| 46 | Light gray smooth stone floor | ground | Interior stone floor |
| 47 | Dark gray smooth stone floor | ground | Dark interior or shadow floor |

### Row 4 (IDs 48-59): Stone Walls and Blue Roofs

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 48 | Blue-tinted gray stone wall | building/wall | Stone building wall segment |
| 49 | Stone wall with dark window opening | building/wall | Wall with window -- pairs with other stone walls |
| 50 | Plain stone wall block | building/wall | Stone wall mid section |
| 51 | Blue roof -- left slope | building/roof | Pairs with 52 (mid), 53 (right) for blue roof |
| 52 | Blue roof -- middle section | building/roof | Repeatable blue roof center |
| 53 | Blue roof -- right slope | building/roof | Right cap of blue roof |
| 54 | Light blue/ice block | building/wall | Light stone or ice wall |
| 55 | Blue roof peak/chimney cap | building/roof | Top accent for blue roofed building |
| 56 | Gray stone arch -- top portion | building/arch | Top of doorway arch (pairs with 57) |
| 57 | Gray stone arch -- middle/base | building/arch | Bottom of doorway arch (pairs with 56) |
| 58 | Dark gray stone block | building/wall | Dark stone wall fill |
| 59 | Very dark/black block | building/shadow | Shadow or void fill |

### Row 5 (IDs 60-71): Red/Brick Walls and Red Roofs

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 60 | Orange-red brick wall left | building/wall | Brick building wall left edge |
| 61 | Red brick wall center | building/wall | Repeatable brick wall fill |
| 62 | Red-orange brick wall right | building/wall | Brick wall right edge |
| 63 | Red/orange roof -- left slope | building/roof | Pairs with 64 (mid), 65 (right) for red roof |
| 64 | Red/orange roof -- middle section | building/roof | Repeatable red roof center |
| 65 | Red/orange roof -- right slope | building/roof | Right cap of red roof |
| 66 | Dark red/maroon block | building/wall | Dark brick accent |
| 67 | Red roof peak with chimney cap | building/roof | Top accent for red roofed building |
| 68 | Gray stone arch variant | building/arch | Building archway element |
| 69 | Blue character sprite (facing forward) | character | NPC -- blue-robed figure |
| 70 | Small character figure variant | character | NPC -- smaller character |
| 71 | Dark solid block | building/wall | Dark wall fill |

### Row 6 (IDs 72-83): Wood Walls, Doors, Panels

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 72 | Brown wood plank wall -- left edge | building/wall | Wood building left wall |
| 73 | Brown wood plank wall -- plain center | building/wall | Repeatable wood wall fill |
| 74 | Brown wood door (dark center opening) | building/door | Door in wood wall -- place between 72/73 walls |
| 75 | Brown wood wall with window opening | building/wall | Window in wood wall |
| 76 | Blue-gray stone/wood panel | building/wall | Cool-toned wall section |
| 77 | Light wood/stone panel | building/wall | Light interior or exterior panel |
| 78 | Dark wood panel | building/wall | Dark interior panel |
| 79 | Gray wall panel | building/wall | Gray wall section |
| 80 | Dark archway opening | building/door | Dark doorway or passage |
| 81 | Medium gray stone wall | building/wall | Generic stone wall |
| 82 | Dark stone wall | building/wall | Dark stone fill |
| 83 | Very dark block | building/shadow | Shadow or void |

### Row 7 (IDs 84-95): Dark Building Walls, Furniture, Items

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 84 | Dark stone wall -- left edge | building/wall | Dark/dungeon building left wall |
| 85 | Dark stone wall -- center | building/wall | Dark building wall fill |
| 86 | Dark stone door | building/door | Door in dark stone wall |
| 87 | Dark stone wall with window | building/wall | Window in dark stone wall |
| 88 | Dark interior fill | building/interior | Dark room floor/fill |
| 89 | Red/warm interior tile | building/interior | Carpet or warm floor |
| 90 | Dark furniture block | decoration | Dark bookcase or cabinet |
| 91 | Dark brown rectangular shape | decoration | Bookshelf, cabinet, or chest |
| 92 | Well structure with peaked roof | decoration | Well top -- pairs with 104 (well base below) |
| 93 | Orange/warm lantern on post | decoration | Lamp post or mailbox -- warm glow |
| 94 | Small golden key or item | decoration/item | Collectible key |
| 95 | Bright golden coin/gem | decoration/item | Collectible coin or gem |

### Row 8 (IDs 96-107): Fences, Benches, Containers

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 96 | White picket fence -- left end/post | decoration/fence | Left end of white fence (with 97, 98) |
| 97 | White picket fence -- middle section | decoration/fence | Repeatable fence middle |
| 98 | White picket fence -- right end/post | decoration/fence | Right end of white fence |
| 99 | Blue/cool fence -- left end | decoration/fence | Left end of blue fence variant (with 100, 101) |
| 100 | Blue/cool fence -- middle section | decoration/fence | Repeatable blue fence middle |
| 101 | Blue/cool fence -- right end | decoration/fence | Right end of blue fence |
| 102 | Small round decorative object | decoration | Small decoration/ornament |
| 103 | Small round ball/stone | decoration | Decorative ball or pebble |
| 104 | Blue well bucket/base | decoration | Well base -- pairs with 92 (well top above) |
| 105 | Dark wood bench (side view) | decoration | Bench furniture piece |
| 106 | Gray stone/crate | decoration | Rock, supply crate, or stone block |
| 107 | Brown wooden barrel | decoration | Barrel container |

### Row 9 (IDs 108-119): Water Edges, Signs, Posts

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 108 | Vertical fence post (brown) | decoration/fence | Standalone fence post or connector |
| 109 | Water edge -- northwest corner (grass-to-water) | water/edge | Top-left of water body |
| 110 | Water edge -- north (grass-to-water top) | water/edge | Top edge of water body |
| 111 | Water edge -- northeast corner | water/edge | Top-right of water body |
| 112 | Water edge -- south (bottom edge) | water/edge | Bottom edge of water body |
| 113 | Water edge -- southeast corner | water/edge | Bottom-right of water body |
| 114 | Medium blue water block | water | Deep water fill variant |
| 115 | Light blue/shallow water | water | Shallow water or water highlight |
| 116 | Wooden sign post / lamp post | decoration | Sign or lamp on wooden post |
| 117 | Cross/plus shaped sign marker | decoration | Signpost or cross marker |
| 118 | Arrow directional sign | decoration | Pointing sign |
| 119 | Small wooden sign | decoration | Small sign post |

### Row 10 (IDs 120-131): Water Body, Treasure, Pickups

| ID | Visual Description | Category | Pairs With |
|----|-------------------|----------|------------|
| 120 | Water edge -- southwest corner | water/edge | Bottom-left of water body |
| 121 | Water edge -- west (left edge) | water/edge | Left edge of water body |
| 122 | Water center -- deep blue | water | Center fill of water body |
| 123 | Water edge -- east (right edge) | water/edge | Right edge of water body |
| 124 | Dark blue water variant | water | Deep water or shadow on water |
| 125 | Water with ripple/fish detail | water | Animated water accent or fish |
| 126 | Blue-gray stone underwater | water/decoration | Submerged stone |
| 127 | Dark blue deep water | water | Very deep water fill |
| 128 | Treasure chest -- closed (brown with gold trim) | decoration/item | Collectible -- closed chest |
| 129 | Treasure chest -- open (showing contents) | decoration/item | Animation pair with 128 (open state) |
| 130 | Red heart pickup | decoration/item | Health/life pickup |
| 131 | Yellow star pickup | decoration/item | Score/bonus pickup |

---

## 2. Kenney Tiny Dungeon Tileset (132 tiles)

**File**: `sprites/dungeon/tilemap_packed.png` (192x176 px)
**Layout**: 12 columns x 11 rows, 16x16 px per tile
**Individual tiles**: `sprites/dungeon/tiles/tile_0000.png` through `tile_0131.png`

### Tile Categories (by visual inspection of tilemap_packed.png)

#### Row 0-1 (IDs 0-23): Dungeon Floors and Walls
- 0-2: Dark stone floor variants (gray textured)
- 3-5: Wall top sections (dark gray with edge detail)
- 6-8: Wall face sections (darker, front-facing)
- 9-11: Wall corner and edge pieces
- 12-17: Additional wall variants and transitions
- 18-23: Floor patterns, grates, carpet/rug tiles

#### Row 2-3 (IDs 24-47): Doors, Stairs, Furniture
- 24-26: Door frames and door (wooden with arch)
- 27-29: Staircase tiles (going up/down)
- 30-35: Dungeon furniture (tables, shelves, barrels)
- 36-41: Torches, candles, light sources
- 42-47: Chains, cages, prison bars

#### Row 4-5 (IDs 48-71): Objects and Decorations
- 48-53: Chests (open/closed), crates, barrels
- 54-59: Potions, scrolls, books, items
- 60-65: Weapons rack, shields, armor stands
- 66-68: Additional dungeon decor
- 69-71: Small character/creature sprites in tileset

#### Row 6-7 (IDs 72-95): More Walls, Lava, Water
- 72-77: Alternative wall styles (brick, mossy)
- 78-83: Lava/magma tiles (orange-red glow)
- 84-89: Dungeon water tiles (dark blue-green)
- 90-95: Pit/hole tiles, trapdoors

#### Row 8 (IDs 96-107): Characters
- 96: Knight character (silver armor, front-facing) -- small pixel character
- 97: Knight variant or walking frame
- 98: Wizard/mage character (robed, hat)
- 99: Wizard variant or walking frame
- 100: Rogue/thief character (dark outfit)
- 101: Rogue variant
- 102-103: Additional character variants or items

#### Row 9 (IDs 104-119): Creatures and Monsters
- 104-107: Skeleton sprites (bone-white, humanoid)
- 108: Green slime/blob creature
- 109: Brown/tan humanoid (bandit or goblin)
- 110: Red demon/imp creature
- 111: Red creature variant (animation frame)
- 112-113: Additional creature sprites
- 114-115: Item pickups (potion, key)

#### Row 10 (IDs 120-131): More Creatures, Items, UI Elements
- 120: Chest mimic or large creature
- 121: Ghost/spirit (translucent white)
- 122: Shield/armor item
- 123: Brown creature (rat or small beast)
- 124-127: Skull, bone, death-related decor
- 128-131: UI elements (hearts, stars, coins, gems)

---

## 3. Kenney Tiny Creatures Tileset (180 tiles)

**File**: `sprites/creatures/tiny-creatures/tiny-creatures/Tilemap/tilemap_packed.png`
**Layout**: 20 columns x 9 rows, 16x16 px per tile
**Individual tiles**: `sprites/creatures/tiny-creatures/tiny-creatures/Tiles/tile_0001.png` through `tile_0180.png`
**NOTE**: Tile numbering starts at 1 (not 0) in this pack.

### Creature Catalog (identified from individual tile inspection)

Each creature has 2 animation frames (idle pose A, idle pose B) arranged as consecutive tiles.

#### Row 1 (tiles 1-20): Frogs, Owls, Crabs, Bugs, Mushrooms

| Tiles | Creature | Description |
|-------|----------|-------------|
| 1, 2 | Green Frog | Bright green frog, frame 1 (sitting) and frame 2 (slight shift) |
| 3, 4 | Red Crab | Red/orange crab with claws |
| 5, 6 | Purple Bat | Dark purple bat with spread wings |
| 7, 8 | Blue Jellyfish / Sea creature | Blue blob-like aquatic creature |
| 9, 10 | Green Turtle | Green turtle with brown shell |
| 11, 12 | Dark Beetle / Bug | Dark green-black beetle/insect |
| 13, 14 | Butterfly | Colorful butterfly with spread wings |
| 15, 16 | Bear Cub | Small brown bear, standing |
| 17, 18 | Frog variant (blue/teal) | Teal-colored frog variant |
| 19, 20 | Mouse / Hamster | Small gray/white rodent |

#### Row 2 (tiles 21-40): Farm and Forest Animals

| Tiles | Creature | Description |
|-------|----------|-------------|
| 21, 22 | Chicken / Hen | Brown-red chicken |
| 23, 24 | Dog (tan) | Small tan/brown dog |
| 25, 26 | Owl (purple) | Purple-gray owl |
| 27-28 | Fish | Small fish sprite |
| 29-30 | Snail | Brown/green snail with shell |
| 31-32 | Worm / Caterpillar | Green caterpillar |
| 33, 34 | Bat (dark) | Dark bat variant |
| 35, 36 | Frog (green variant) | Another green frog type |
| 37-38 | Spider | Dark spider |
| 39-40 | Bee / Wasp | Yellow and black flying insect |

#### Row 3 (tiles 41-60): More Animals

| Tiles | Creature | Description |
|-------|----------|-------------|
| 41, 42 | Seahorse | Green/teal seahorse |
| 43, 44 | Penguin | Black and white penguin |
| 45-46 | Rabbit / Bunny (white) | White bunny |
| 47-48 | Snake | Green snake |
| 49-50 | Squirrel | Brown squirrel |
| 51-52 | Bird (blue) | Small blue bird |
| 53, 54 | Cow / Horse (white) | White horse or unicorn base |
| 55, 56 | Parrot / Tropical bird | Colorful bird |
| 57-58 | Cat (gray) | Gray cat |
| 59-60 | Pig | Pink pig |

#### Row 4 (tiles 61-80): Fantasy Creatures

| Tiles | Creature | Description |
|-------|----------|-------------|
| 61, 62 | Fish (blue) | Blue tropical fish |
| 63-64 | Octopus | Purple/pink octopus |
| 65-66 | Seal / Sea lion | Gray seal |
| 67-68 | Shark fin / Sea creature | Blue sea creature |
| 69-70 | Crab (blue) | Blue crab variant |
| 71-72 | Whale / Large fish | Blue whale |
| 73, 74 | Duck (brown) | Brown duck sitting on water |
| 75, 76 | Duck (swimming) | Brown duck variant |
| 77-78 | Flamingo | Pink flamingo |
| 79-80 | Swan | White swan |

#### Row 5 (tiles 81-100): Exotic and Fantasy Creatures

| Tiles | Creature | Description |
|-------|----------|-------------|
| 81, 82 | Robot / Mechanical creature | Teal/green boxy mechanical creature |
| 83-84 | Alien / Slime | Green blob creature |
| 85-86 | Dragon (small) | Small winged dragon |
| 87-88 | Ghost | White translucent ghost |
| 89-90 | Skeleton | Small bone-white skeleton |
| 91-92 | Goblin | Green goblin |
| 93, 94 | Monkey | Brown monkey |
| 95, 96 | Spider (purple) | Purple/dark spider |
| 97-98 | Wolf | Gray wolf |
| 99-100 | Fox | Orange-red fox |

#### Row 6 (tiles 101-120): More Fantasy Creatures

| Tiles | Creature | Description |
|-------|----------|-------------|
| 101, 102 | Fox / Red Panda | Orange-brown fox variant |
| 103-104 | Deer / Doe | Brown deer |
| 105-106 | Cat (orange) | Orange tabby cat |
| 107-108 | Dog (brown) | Brown dog variant |
| 109-110 | Panda | Black and white panda |
| 111-112 | Koala | Gray koala |
| 113, 114 | Seahorse (green) | Green seahorse variant |
| 115, 116 | Turtle (green) | Green sea turtle |
| 117-118 | Elephant (small) | Gray elephant |
| 119-120 | Lion | Yellow/tan lion |

#### Row 7 (tiles 121-140): Large/Special Creatures

| Tiles | Creature | Description |
|-------|----------|-------------|
| 121, 122 | Eye / Eyeball creature | Dark eyeball monster |
| 123-124 | Imp / Demon | Red imp creature |
| 125-126 | Mushroom creature | Walking mushroom |
| 127-128 | Slime (green) | Green slime blob |
| 129-130 | Bat (large) | Large dark bat |
| 131-132 | Phoenix / Fire bird | Orange-red fire bird |
| 133, 134 | Butterfly (orange) | Orange butterfly |
| 135, 136 | Deer / Reindeer | Brown deer with antlers |
| 137-138 | Unicorn (pink) | Pink/white unicorn |
| 139-140 | Dragon (large) | Larger dragon sprite |

#### Row 8 (tiles 141-160): Domestic Animals and Variants

| Tiles | Creature | Description |
|-------|----------|-------------|
| 141, 142 | Rooster / Bird (colorful) | Colorful crested bird |
| 143-144 | Crow / Raven | Black crow |
| 145-146 | Eagle | Brown eagle |
| 147-148 | Duck (white) | White duck |
| 149-150 | Goose | White/gray goose |
| 151-152 | Horse | Brown horse |
| 153, 154 | Sheep / Lamb | White sheep |
| 155, 156 | Cow (brown) | Brown spotted cow |
| 157-158 | Bull / Ox | Dark bull |
| 159-160 | Pig (pink) | Pink pig variant |

#### Row 9 (tiles 161-180): Remaining Creatures

| Tiles | Creature | Description |
|-------|----------|-------------|
| 161, 162 | Bear (brown) | Large brown bear |
| 163, 164 | Bear (grizzly) | Dark brown/grizzly bear |
| 165-166 | Wolf (dark) | Dark gray wolf |
| 167-168 | Raccoon | Gray raccoon |
| 169-170 | Hedgehog | Brown hedgehog |
| 171-172 | Skunk | Black and white skunk |
| 173, 174 | Rat (dark) | Dark gray rat |
| 175, 176 | Rat variant | Brown/gray rat |
| 177, 178 | Squirrel (red) | Red squirrel |
| 179, 180 | Chipmunk | Striped chipmunk |

---

## 4. Superdark Enchanted Forest Characters

**Spritesheet**: `sprites/creatures/superdark-forest/Enchanted Forest Characters with animations.png`
**Individual frames**: `sprites/creatures/superdark-forest/Enchanted Forest - Individual Frames/`
**Style**: Larger pixel art (approx 32x32 per frame), dark fantasy aesthetic
**Animation format**: Each character has 4 Idle frames + 4 Walk frames

### Character/Creature List

| Character | Frames | Type | Visual Description |
|-----------|--------|------|-------------------|
| Bandit | Idle x4, Walk x4 | Humanoid/Enemy | Hooded figure with weapon |
| Bear | Idle x4, Walk x4 | Beast | Large brown bear, lumbering |
| Centaur (Female) | Idle x4, Walk x4 | Fantasy | Female centaur with bow |
| Centaur (Male) | Idle x4, Walk x4 | Fantasy | Male centaur with weapon |
| Elf (Female) | Idle x4, Walk x4 | Humanoid/NPC | Pointed ears, slender build |
| Elf (Male) | Idle x4, Walk x4 | Humanoid/NPC | Pointed ears, male variant |
| Elven Knight | Idle x4, Walk x4 | Humanoid/NPC | Armored elf with sword |
| Ent | Idle x4, Walk x4 | Fantasy/Nature | Living tree creature -- large green tree-person |
| Fairy | Idle+Walk x4 | Fantasy | Tiny winged fairy with red cap -- very small |
| Fat Cleric | Idle+Walk x4 | Humanoid/NPC | Portly cleric in robes |
| Forest Guardian | Idle x4, Walk x4 | Fantasy | Nature spirit/protector |
| Gnoll Brute | Idle x4, Walk x4 | Monster/Enemy | Large hyena-humanoid |
| Gnoll Overseer | Idle x4, Walk x4 | Monster/Enemy | Gnoll with commanding pose |
| Gnoll Scout | Idle x4, Walk x4 | Monster/Enemy | Lighter gnoll with speed build |
| Gnoll Shaman | Idle x4, Walk x4 | Monster/Enemy | Gnoll with magic staff |
| Golem | Idle x4, Walk x4 | Fantasy/Enemy | Large stone construct -- bulky gray figure |
| High Elf (Female) | Idle x4, Walk x4 | Humanoid/NPC | Regal elf |
| High Elf (Male) | Idle+Walk x4 | Humanoid/NPC | Regal male elf |
| Large Mushroom | Idle x4, Walk x4 | Fantasy/Creature | Walking large mushroom |
| Normal Cleric | Idle+Walk x4 | Humanoid/NPC | Standard cleric |
| Normal Mushroom | Idle x4, Walk x4 | Fantasy/Creature | Medium walking mushroom |
| Ranger | Idle x4, Walk x4 | Humanoid/NPC | Forest ranger with bow |
| Small Mushroom | Idle x4, Walk x4 | Fantasy/Creature | Tiny walking mushroom |
| Tall Cleric | Idle+Walk x4 | Humanoid/NPC | Tall thin cleric |
| Troll | Idle x4, Walk x4 | Monster/Enemy | Large green troll with club |
| Wizard | Idle+Walk x4 | Humanoid/NPC | Robed wizard with staff |
| Wolf | Idle x4, Walk x4 | Beast | Dark gray/black wolf |

---

## 5. Superdark Fantasy RPG NPCs

**Spritesheet**: `sprites/characters/superdark-fantasy/knights.png` (main sheet with all knight variants)
**Individual frames**: `sprites/characters/superdark-fantasy/Fantasy RPG NPCs - Individuel Frames/`
**Style**: ~32x32 pixel art, medieval/fantasy town NPCs
**Animation format**: Each character has 4 Idle frames + 4 Walk frames

### NPC List

| Character | Type | Visual Description |
|-----------|------|-------------------|
| Alchemist | Town NPC | Figure with potion bottles |
| Archer | Military | Bow-wielding soldier |
| Bishop | Religious | Robed religious figure with mitre |
| Blacksmith | Town NPC | Burly figure at anvil |
| Butcher | Town NPC | Apron-wearing figure |
| Elite Knight | Military | Ornate heavy armor |
| Executioner | Military/Dark | Hooded figure with axe |
| Fat Nun | Religious | Portly nun |
| Heavy Knight | Military | Bulky armored knight |
| Herald | Town NPC | Figure with trumpet/banner |
| King | Royalty | Crown, robes, regal bearing |
| Knight (Standard) | Military | Standard armored knight |
| Large Elite Knight | Military | Oversized elite knight |
| Large Knight | Military | Oversized standard knight |
| Mage | Magic | Robed spellcaster |
| Magic Shopkeeper | Town NPC | Merchant with magic wares |
| Merchant | Town NPC | Trading figure |
| Mountain King | Royalty | Dwarf-like king figure |
| Normal Nun | Religious | Standard nun |
| Princess | Royalty | Royal dress, crown/tiara |
| Queen | Royalty | Regal gown, crown |
| Skinny Nun | Religious | Thin nun variant |
| Thief | Criminal | Dark-clothed sneaky figure |
| Townsfolk (Female) | Civilian | Common townsperson |
| Townsfolk (Male) | Civilian | Common townsperson |

---

## 6. Additional Character Assets

### Extracted Superdark Spritesheets (in sprites/sheets/)

| File | Character | Details |
|------|-----------|---------|
| `princess.png` | Princess | 4 idle + 4 walk frames extracted from superdark pack |
| `fairy.png` | Fairy | 4 combined idle+walk frames, tiny winged sprite |
| `wolf.png` | Wolf | 4 idle + 4 walk frames, dark gray wolf |
| `merchant.png` | Merchant | 4 idle + 4 walk frames, trading NPC |
| `townsfolk-female.png` | Female Townsfolk | 4 idle + 4 walk frames |
| `townsfolk-male.png` | Male Townsfolk | 4 idle + 4 walk frames |

### Anokolisa Pixel Crawler Pack

**Location**: `sprites/characters/anokolisa/Pixel Crawler - Free Pack/`
**Style**: 16x16 modular character system with directional animation sheets

**Player Character (Body_A)**:
- Carry_Idle (Down, Side, Up)
- Carry_Run (Down, Side, Up)
- Carry_Walk (Down, Side, Up)
- Collect, Crush, Death, Fishing, Hit
- Idle_Base (Down, Side, Up)
- Pierce, Run, Slice, Walk, Watering

**Mobs**:
- Orc Crew: Orc, Orc Rogue, Orc Shaman, Orc Warrior (each with Death, Idle, Run)
- Skeleton Crew: Skeleton Base, Skeleton Mage, Skeleton Rogue, Skeleton Warrior (each with Death, Idle, Run)

**NPCs**: Knight, Rogue, Wizard

### Other Character Sources

| File | Description |
|------|-------------|
| `sprites/characters/character_base_16x16.png` | Base 16x16 character template spritesheet |
| `sprites/characters/pokemon-esque-sprites.png` | Pokemon-style creature sprites |
| `sprites/characters/rpg_16x16_8bit.png` | 8-bit style RPG character set |
| `sprites/characters/top_down_girl/` | Top-down girl character with walk/idle animations (4 front, 4 back frames) |
| `sprites/characters/szym-tiny/TinyPackAddOn/Sprites-16x16.png` | Additional 16x16 tiles and sprites |
| `sprites/creatures/unicorn_running.png` | Unicorn running animation spritesheet |
| `sprites/creatures/duck_spritesheet.png` | Duck animation spritesheet |

### Kenney Tiny Dungeon Character Pack

**Location**: `sprites/characters/kenney-tiny-dungeon/`
**Tilemap**: Contains dungeon environment + characters in same sheet (visible in Preview.png)
- Same 12x11 grid as dungeon tileset
- Includes warrior, mage, rogue character sprites
- Dungeon environment tiles (walls, floors, doors, treasure)
- Monsters (slimes, skeletons, bats)

---

## 7. UI Assets

**Location**: `sprites/ui/`
**Style**: Kenney RPG UI pack, multi-color variants

### UI Elements

| Category | Assets | Colors Available |
|----------|--------|-----------------|
| Arrows | Left/Right | Beige, Blue, Brown, Silver |
| Bars (Horizontal) | Left/Mid/Right segments | Back, Blue, Green, Red, Yellow |
| Bars (Vertical) | Top/Mid/Bottom segments | Back, Blue, Green, Red, Yellow |
| Buttons (Long) | Normal + Pressed | Beige, Blue, Brown, Grey |
| Buttons (Round) | Single state | Beige, Blue, Brown, Grey |
| Buttons (Square) | Normal + Pressed | Beige, Blue, Brown, Grey |
| Cursors (Gauntlet) | Pointing hand | Blue, Bronze, Grey |
| Cursors (Hand) | Open hand | Beige, Blue, Grey |
| Cursors (Sword) | Sword pointer | Bronze, Gold, Silver |
| Icons (Check) | Checkmark | Beige, Blue, Bronze, Grey |
| Icons (Circle) | Circle | Beige, Blue, Brown, Grey |
| Icons (Cross) | X mark | Beige, Blue, Brown, Grey |
| Panels | Flat panels | Beige, Beige Light, Blue, Brown |
| Panels (Inset) | Inset/recessed panels | Beige, Beige Light, Blue, Brown |
| Full Sheet | `uipack_rpg_sheet.png` | All elements in one spritesheet |

---

## 8. Animation Pairs and Frame Groups

### Town Tileset Animation Pairs

| Tiles | Animation | Notes |
|-------|-----------|-------|
| 128, 129 | Chest closed / Chest open | State change animation (interact to open) |
| 69, 70 | Character facing variants | Two NPC character poses |
| 1, 2 | Grass / Grass with flowers | Not animation -- decorative variety |
| 37, 38 | Grass variant A / B | Not animation -- decorative variety |

**Note**: The Kenney Tiny Town tileset does NOT contain traditional frame-based animations. It is a static tileset designed for map building. The only true state-pair is the chest (128/129). Visual variety comes from mixing similar tiles rather than frame animation.

### Tiny Creatures Animation Pairs

Every creature in the 180-tile set has exactly 2 frames. The pattern is:
- **Odd tile = Frame 1** (e.g., tile_0001)
- **Even tile = Frame 2** (e.g., tile_0002)

This gives 90 creatures x 2 frames = 180 tiles total.

Animation differences between frames are subtle:
- Slight body shift (breathing/bobbing)
- Leg position change (walk cycle)
- Wing position change (flying creatures)
- Tail/appendage movement

### Superdark Character Animations

All Superdark characters follow the same pattern:
- **4 Idle frames**: Subtle breathing/bobbing cycle
- **4 Walk frames**: Full walk cycle (step left, pass, step right, pass)
- Some simpler characters combine Idle+Walk into a single 4-frame sequence

### Anokolisa Animations

Full directional animation sheets:
- Each action has Down, Side, and Up variants
- Each sheet contains multiple frames (typically 4-8 per animation)
- Covers: Idle, Walk, Run, Attack (Slice/Pierce/Crush), Death, Carry, Fish, Water, Collect, Hit

---

## 9. Visual Harmony Groups

### WARM Palette (browns, oranges, reds, golds)

| Tile IDs (Town) | Elements |
|-----------------|----------|
| 24, 25, 35 | Wood blocks, dark wood |
| 63, 64, 65, 67 | Red/orange roofs |
| 60, 61, 62, 66 | Red/orange brick walls |
| 72, 73, 74, 75 | Brown wood plank walls |
| 7, 8, 9, 23 | Autumn trees and bushes |
| 15 | Orange torch/flower |
| 93 | Warm lantern |
| 107 | Brown barrel |
| 105 | Dark wood bench |
| 128, 129 | Brown treasure chest |
| 36, 39, 40, 41, 42 | Tan/sand path tiles |
| 95 | Gold coin |

**Good neighbors**: Wood walls (72-75) below red roofs (63-65). Autumn trees (7-9) near warm buildings. Barrels (107) and benches (105) on dirt paths (40).

### COOL Palette (grays, blues, dark stones)

| Tile IDs (Town) | Elements |
|-----------------|----------|
| 32, 33, 34 | Gray and blue-gray stone |
| 48, 49, 50 | Blue-tinted stone walls |
| 51, 52, 53, 55 | Blue roofs |
| 54 | Light blue/ice |
| 76, 79, 81, 82 | Gray wall panels |
| 84, 85, 86, 87 | Dark stone walls |
| 44, 45 | Gray cobblestone |
| 46, 47 | Stone floors |
| 56, 57 | Stone arches |
| 109-115, 120-127 | Water tiles |

**Good neighbors**: Stone walls (84-87) below blue roofs (51-53). Cobblestone (44) paths leading to stone buildings. Water (122) surrounded by stone edges.

### GREEN Palette (vegetation, nature)

| Tile IDs (Town) | Elements |
|-----------------|----------|
| 1, 2, 37, 38, 43 | Grass variants |
| 4, 5, 6, 12, 13 | Green tree parts |
| 16, 17 | Small trees |
| 18 | Fern |
| 19 | Purple flowers on green |
| 20, 21 | Cactus |
| 22 | Pine/dark shrub |
| 28 | Green hedge |
| 29 | Red berry bush on green |

**Good neighbors**: Trees (4,5,12,13) on grass (1). Bushes (28) near fences (96-98). Flowers (19) on grass with flowers (43).

### ACCENT Colors (stand-out elements)

| Tile IDs (Town) | Elements | Color |
|-----------------|----------|-------|
| 0, 131 | Stars/sparkles | Bright yellow |
| 130 | Heart pickup | Bright red |
| 95 | Gold coin | Gold |
| 15 | Torch flame | Orange |
| 93 | Lantern glow | Warm orange |
| 19 | Purple flowers | Purple |
| 29 | Red berries | Red on green |

---

## 10. Building Assembly Patterns

### Small Wood House (3 wide x 3 tall)

```
Row 1 (roof):    [63] [64] [65]     (red roof: left, mid, right)
Row 2 (walls):   [72] [75] [73]     (wood: left wall, window, right wall)
Row 3 (walls):   [72] [74] [73]     (wood: left wall, door, right wall)
```

Add `67` (chimney cap) centered above the roof for detail.

### Small Stone House (3 wide x 3 tall)

```
Row 1 (roof):    [51] [52] [53]     (blue roof: left, mid, right)
Row 2 (walls):   [48] [49] [50]     (stone: left, window, right)
Row 3 (walls):   [48] [74] [50]     (stone: left, door, right)
```

### Dark Stone Building (3 wide x 3 tall)

```
Row 1 (roof):    [63] [64] [65]     (red roof works with dark stone too)
Row 2 (walls):   [84] [87] [85]     (dark: left, window, mid)
Row 3 (walls):   [84] [86] [85]     (dark: left, door, mid)
```

### Wide Building (5 wide x 3 tall)

```
Row 1 (roof):    [63] [64] [64] [64] [65]
Row 2 (walls):   [72] [75] [73] [75] [73]
Row 3 (walls):   [72] [73] [74] [73] [73]
```

### Building with Fence Yard

```
Row 1: [63][64][65] [1 ] [1 ]
Row 2: [72][75][73] [1 ] [18]
Row 3: [72][74][73] [96][97][98]
```

---

## 11. Tree Assembly Patterns

### Large Green Tree (2x2)

```
Foreground layer:  [4 ] [5 ]    (canopy, drawn OVER entities)
Object layer:      [12] [13]    (trunk + lower leaves)
```

Place on grass (1 or 37). The top tiles (4,5) should be on the foreground/overlay layer so characters walk behind the canopy.

### Large Autumn Tree (2x2)

```
Foreground layer:  [7 ] [8 ]    (orange canopy)
Object layer:      [24] [25]    (darker trunk)
```

### Single-Tile Trees

- `6` -- Small round green tree (good for sparse placement)
- `9` -- Small orange/autumn tree
- `16` -- Small tree with visible trunk
- `17` -- Fruit/flowering tree (pink accent)

### Pine/Conifer (1x2)

```
Top:     [10]    (pine top, dark green triangle)
Bottom:  [22]    (trunk/base)
```

### Tree variant (1x2)

```
Top:     [11]    (dense tree top)
Bottom:  [23]    (autumn bush/trunk)
```

---

## 12. Water Assembly Patterns

### 3x3 Pond

```
[109] [110] [111]    (NW corner, N edge, NE corner)
[121] [122] [123]    (W edge,   center, E edge)
[120] [112] [113]    (SW corner, S edge, SE corner)
```

### Wider Water Body (5x3)

```
[109] [110] [110] [110] [111]
[121] [122] [122] [122] [123]
[120] [112] [112] [112] [113]
```

Add `125` (ripple/fish) as an overlay on center water tiles for visual interest.

### Well Structure (1x2)

```
[92]     (well top with roof)
[104]    (well base/bucket)
```

---

## 13. Visual Clash Warnings

### Combinations to AVOID

| Combination | Problem |
|-------------|---------|
| Autumn trees (7-9) directly next to blue roofs (51-53) | Orange-blue clash at small scale |
| Dark stone walls (84-87) on grass with flowers (43) | Mood conflict -- grim walls on cheerful ground |
| Red brick (60-62) adjacent to red roofs (63-65) | Too much red, looks like a solid red blob |
| Cobblestone (44-45) touching water edges (109-113) | Edge detail conflict, looks unfinished |
| Cactus (20-21) next to snow/ice (54) | Biome mismatch |

### Combinations that Work Well

| Combination | Why |
|-------------|-----|
| Wood walls (72-75) + red roofs (63-65) + grass (1) | Classic warm village look |
| Stone walls (48-50) + blue roofs (51-53) + cobblestone (44) | Cohesive cool-toned district |
| Grass (1) + flower grass (43) + green trees (4-6) | Natural, organic forest edge |
| Dirt path (40) + fences (96-98) + barrels (107) | Lived-in village path |
| Water (122) + small plants (18,19) near edges + grass (1) | Peaceful pond scene |
| Dark walls (84-87) + cobblestone (44) + lanterns (93) | Atmospheric night/old district |

---

## 14. Complete Asset Inventory Summary

| Asset Pack | Tile Count | Style | Size | License |
|------------|-----------|-------|------|---------|
| Kenney Tiny Town | 132 tiles | 16x16 pixel art | 192x176 px | CC0 |
| Kenney Tiny Dungeon | 132 tiles | 16x16 pixel art | 192x176 px | CC0 |
| Kenney Tiny Creatures | 180 tiles (90 creatures) | 16x16 pixel art | 320x144 px | CC0 |
| Kenney Tiny Dungeon (characters pack) | 132 tiles | 16x16 pixel art | - | CC0 |
| Superdark Enchanted Forest | 27 characters | ~32x32 pixel art | Variable | Commercial |
| Superdark Fantasy RPG NPCs | 25 characters | ~32x32 pixel art | Variable | Commercial |
| Anokolisa Pixel Crawler | 1 PC + 8 mobs + 3 NPCs | 16x16 pixel art | Variable | Free Pack |
| Szym TinyPackAddOn | Add-on tiles | 16x16 pixel art | - | See license |
| Top Down Girl | 1 character | 16x16 pixel art | ~10 frames | - |
| Unicorn Running | 1 creature | Spritesheet | - | - |
| Duck Spritesheet | 1 creature | Spritesheet | - | - |
| Kenney RPG UI | ~90 elements | Variable | Variable | CC0 |
| Misc Spritesheets | 2 sheets (pokemon-esque, rpg 8-bit) | 16x16 | - | - |

**Grand Total**: ~1,615 image files across all packs

---

## 15. Key Corrections to Existing TILE-REFERENCE.md

After visual inspection, several discrepancies were found in the existing `sprites/town/TILE-REFERENCE.md`:

1. **Tile 0**: The existing doc says "Yellow star/sparkle" -- confirmed correct, it is a 4-pointed yellow sparkle
2. **Tile 1**: Confirmed as plain green grass (the primary ground tile)
3. **Tile 2**: Confirmed as grass with small yellow/white flowers
4. **Tiles 37-38**: The doc lists these as "Grass (plain)" and "Grass variant" but they visually appear as slightly different shades of green -- consistent with being secondary grass options
5. **Tile 43**: Listed as "Grass with flowers" -- confirmed, shows green with white dot pattern
6. **Quick Reference section**: Lists tile 37 as primary grass and tile 1 as something else. Based on visual inspection, BOTH tiles 1 and 37 are valid grass tiles. Tile 1 is in Row 0 and tile 37 is in Row 3 -- both read as uniform green. Either can serve as primary ground fill.

The existing TILE-REFERENCE.md header warning ("GRASS IS TILE 1, NOT TILE 37") is technically correct that tile 1 is grass, but tile 37 is ALSO grass. The Quick Reference at the bottom then contradicts the header by listing 37 as primary. Both are usable grass fills.
