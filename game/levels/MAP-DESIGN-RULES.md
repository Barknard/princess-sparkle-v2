# Map Design Rules — Permanent Reference

Research-backed visual design rules for building tile maps.
The map-builder agent MUST follow these on every level build.

## Ground Layer Rules
- **60% primary grass (1) / 30% variant grass (2) / 10% flower grass (43)**
- Never place more than 4 of the same grass tile in a row
- Cluster variants in organic blobs (2-3 together), not checkerboard
- Flower grass goes near points of interest (paths, well, buildings)

## Path Rules
- 2 tiles wide, connecting all buildings and exits
- **Paths are NARROW LINES through GREEN GRASS** — NOT the dominant ground type
- At intersections, widen to 3x3 for a small plaza effect
- Stagger edges — occasional single dirt tile offset for worn-edge look
- Paths connect DIRECTLY to building doors
- Use proper edge/transition tiles at grass-to-path boundaries
- T-junctions over crossroads (more natural)

## Tree Border Rules
- Map edges framed with trees but NEVER a uniform wall
- Mix tree types: round green (4/5), autumn (7/8), pine (10/11)
- Max 2 same tree type adjacent
- Stagger depth: some at row 0, some at row 1, with gaps
- Leave 1-2 tile gaps for transition points
- Always add understory (bushes, plants, flowers at tree bases)
- Canopies in FOREGROUND layer for depth

## Building Rules
- 3-5 buildings per map
- NOT axis-aligned — stagger positions
- 8-10 tiles apart center-to-center minimum
- 3-4 tiles of yard grass around each building
- Each building needs a "yard zone" with fence + 2-3 decorations
- Face entrances toward the main path
- Vary materials: wood walls for homes, stone for shops

## Open Space Rules
- **60% open/walkable, 40% filled** (buildings, trees, water, objects)
- On 30x20 (600 tiles): ~360 walkable, ~240 objects
- Village square = largest open area (6x4 to 8x6 tiles)
- Never more than 6x6 unbroken grass without a decoration
- Each zone needs a landmark visible within 5-6 tiles

## Decoration Rules
- Flowers cluster in groups of 2-4, never singles
- Place flowers near: building entrances, fences, pond, paths
- Bushes serve as soft barriers (2-3 with 1-tile gaps)
- Every path intersection needs a point of interest within 2 tiles
- Benches face open areas, never walls
- Wells/fountains at path intersections or square centers
- Mailboxes 1 tile in front of building fences
- Barrels/crates near shops, not homes
- Signs at path forks

## Water Rules
- Ponds at least 3x3 with proper 9 edge tiles
- In open clearings, never adjacent to buildings (2+ tiles gap)
- Surround with flower tiles, bushes on 1-2 sides, bench facing water

## Visual Zones (5 distinct areas)
- Each zone has different decoration density and ground mix
- Separate zones with: path width changes, object density shifts, bush lines
- 3 anchors: trade/shop, home/residential, entrance/gathering

## Rhythm
- Alternate dense and sparse areas
- No two buildings in same 10x10 tile area
- Decoration density radiates from points of interest
- Every 5-tile walk along a path reveals something new

## Quick Reference
| Rule | Value |
|------|-------|
| Grass ratio | 60% / 30% / 10% |
| Path width | 2 tiles |
| Building spacing | 8-10 tiles center-to-center |
| Open vs filled | 60% / 40% |
| Max empty grass | 6x6 before decoration |
| Tree border | Staggered, irregular, mixed types |
| Flower clusters | 2-4 tiles |
| Yard around buildings | 3-4 tiles |
| Pond minimum | 3x3 with edges |
| Landmark visibility | Every 5-6 tiles |
| Zones per map | 4-5 distinct areas |
