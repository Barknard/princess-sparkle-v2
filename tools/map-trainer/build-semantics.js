#!/usr/bin/env node
/**
 * build-semantics.js — Generates tile-semantics.json from tile-catalog.json
 * Enriches each tile with: visual description, edgeCompatibility, semanticRole,
 * layer assignment, and placementRules.
 *
 * Run: node tools/map-trainer/build-semantics.js
 */

const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'tile-catalog.json');
const outputPath = path.join(__dirname, 'tile-semantics.json');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// ─── Visual descriptions sourced from ASSET-VISUAL-AUDIT.md ─────────────
// These are verified by actually viewing each tile PNG individually.
const VISUAL_DESCRIPTIONS = {
  0: "Yellow 4-pointed sparkle/star on transparent bg — decorative overlay",
  1: "Solid green grass tile (medium green, uniform) — primary ground fill",
  2: "Green grass with tiny yellow flower specks — variant ground fill",
  3: "Light tan/beige block — grass-to-dirt transition edge",
  4: "Green round tree canopy — top-left quadrant. Pairs with 5,12,13 for 2x2 tree",
  5: "Green round tree canopy — top-right quadrant. Pairs with 4,12,13 for 2x2 tree",
  6: "Small single-tile round green tree/bush — standalone",
  7: "Orange/autumn tree canopy — top-left quadrant. Pairs with 8,24,25 for 2x2 autumn tree",
  8: "Orange/autumn tree canopy — top-right quadrant. Pairs with 7,24,25",
  9: "Small single-tile orange/autumn tree — standalone",
  10: "Tall dark green pine/conifer tree top — pairs with 22 (trunk below)",
  11: "Dark green dense tree top variant — pairs with 23 (trunk below)",
  12: "Brown tree trunk with green leaves — bottom-left of 2x2 green tree (with 4,5,13)",
  13: "Brown tree trunk with green leaves — bottom-right of 2x2 green tree (with 4,5,12)",
  14: "Light peach/cream solid block — NOT a bush. Sand or light dirt fill. DEPRECATED for village.",
  15: "Orange-red flower or torch flame on stem — warm decorative accent",
  16: "Small green tree on brown trunk — complete standalone small tree with visible trunk",
  17: "Green canopy with pink/red spot — fruit or flowering tree, standalone",
  18: "Small green fern/leaf sprite — ground-level plant decoration",
  19: "Purple/pink flowers on green base — small flower bush decoration",
  20: "Green cactus — left half. Pairs with 21 (right half) for 2-tile cactus",
  21: "Green cactus — right half. Pairs with 20 (left half)",
  22: "Dark green dense shrub / pine trunk — below tile 10 (pine top)",
  23: "Orange-brown autumn bush — standalone shrub, or trunk below tile 11",
  24: "Light brown wood block — autumn tree trunk bottom-left (with 7,8,25), or wood fill",
  25: "Darker brown wood block — autumn tree trunk bottom-right (with 7,8,24), or wood fill",
  26: "Gray-brown block — stone or dirt solid block",
  27: "White picket fence section (alt pattern) — alternate fence piece",
  28: "Green oval bush/hedge — small decorative hedge, clearly identifiable",
  29: "Red dots on green — berry bush or red flower cluster",
  30: "Brown-gray solid block — dirt/mud solid fill",
  31: "Light tan/sand block — sandy ground fill",
  32: "Medium gray stone block — stone wall or ground fill",
  33: "Dark gray stone block — dark stone wall fill",
  34: "Blue-gray slate block — slate or cool-toned stone",
  35: "Dark brown/chocolate block — dark wood fill",
  36: "Light tan/sand ground tile — sand or dry ground fill",
  37: "Medium green grass (slightly different shade from tile 1) — secondary grass fill",
  38: "Lighter green grass variant — third grass variant for variety",
  39: "Tan dirt with left/top edge detail — path edge left or top border",
  40: "Tan dirt center — uniform main walkable path center fill",
  41: "Tan dirt with right/bottom edge detail — path edge right or bottom border",
  42: "Tan dirt with vertical edge — path vertical edge piece",
  43: "Green grass with white flower dots — decorative grass accent with daisies",
  44: "Light gray cobblestone pattern — cobblestone path/plaza fill",
  45: "Darker gray cobblestone — cobblestone variant for variety",
  46: "Light gray smooth stone floor — interior stone floor",
  47: "Dark gray smooth stone floor — dark interior or shadow floor",
  48: "Blue-tinted gray stone wall — stone building wall segment",
  49: "Stone wall with dark window opening — wall with window",
  50: "Plain stone wall block — stone wall mid section",
  51: "Blue roof — left slope. Pairs with 52 (mid), 53 (right) for blue roof",
  52: "Blue roof — middle section, repeatable center",
  53: "Blue roof — right slope. Right cap of blue roof",
  54: "Light blue/ice block — light stone or ice wall",
  55: "Blue roof peak/chimney cap — top accent for blue roofed building",
  56: "Gray stone arch — top portion of doorway arch. Pairs with 57",
  57: "Gray stone arch — middle/base of doorway arch. Pairs with 56",
  58: "Dark gray stone block — dark stone wall fill",
  59: "Very dark/black block — shadow or void fill",
  60: "Orange-red brick wall left — brick building wall left edge",
  61: "Red brick wall center — repeatable brick wall fill",
  62: "Red-orange brick wall right — brick wall right edge",
  63: "Red/orange roof — left slope. Pairs with 64 (mid), 65 (right) for red roof",
  64: "Red/orange roof — middle section, repeatable center",
  65: "Red/orange roof — right slope. Right cap of red roof",
  66: "Dark red/maroon block — dark brick accent",
  67: "Red roof peak with chimney cap — top accent for red roofed building",
  68: "Gray stone arch variant — building archway element",
  69: "Blue character sprite (facing forward) — NPC blue-robed figure",
  70: "Small character figure variant — NPC smaller character",
  71: "Dark solid block — dark wall fill",
  72: "Brown wood plank wall — left edge with dark left border",
  73: "Brown wood plank wall — plain center, repeatable seamless fill",
  74: "Brown wood door — dark center opening with lighter frame",
  75: "Brown wood wall with window opening — wood wall with window cutout",
  76: "Blue-gray stone/wood panel — cool-toned wall section",
  77: "Light wood/stone panel — light interior or exterior panel",
  78: "Dark wood panel — dark interior panel",
  79: "Gray wall panel — generic gray wall section",
  80: "Dark archway opening — dark doorway or passage",
  81: "Medium gray stone wall — generic stone wall",
  82: "Dark stone wall — dark stone fill",
  83: "Very dark block — shadow or void",
  84: "Dark stone wall — left edge of dark/dungeon building wall",
  85: "Dark stone wall — center, repeatable dark building wall fill",
  86: "Dark stone door — door in dark stone wall, arched entrance",
  87: "Dark stone wall with window — dark wall with window cutout",
  88: "Dark interior fill — dark room floor/fill",
  89: "Red/warm interior tile — carpet or warm floor",
  90: "Dark furniture block — dark bookcase or cabinet",
  91: "Dark brown rectangular shape — bookshelf, cabinet, or chest",
  92: "Well structure with peaked roof — well top. Pairs with 104 (base below)",
  93: "Orange/warm lantern on post — lamp post or mailbox with warm glow",
  94: "Small golden key or item — collectible key",
  95: "Bright golden coin/gem — collectible coin or gem",
  96: "White picket fence — left end/post",
  97: "White picket fence — middle section, repeatable",
  98: "White picket fence — right end/post",
  99: "Blue/cool fence — left end (blue fence variant)",
  100: "Blue/cool fence — middle section, repeatable",
  101: "Blue/cool fence — right end",
  102: "Small round decorative object — mushroom, pebble, or ornament",
  103: "Small round ball/stone — decorative ball or pebble",
  104: "Blue well bucket/base — well base. Pairs with 92 (well top above)",
  105: "Dark wood bench (side view) — WARNING: reads as dark bomb at 16px. DEPRECATED.",
  106: "Gray stone/crate — WARNING: dark rounded shape reads as bomb. DEPRECATED. Use 107.",
  107: "Brown wooden barrel — clearly identifiable barrel container",
  108: "Vertical fence post (brown) — standalone fence post or connector",
  109: "Water edge — northwest corner (grass-to-water transition)",
  110: "Water edge — north (grass-to-water top edge)",
  111: "Water edge — northeast corner",
  112: "Water edge — south (bottom edge of water body)",
  113: "Water edge — southeast corner",
  114: "Medium blue water block — deep water fill variant",
  115: "Light blue/shallow water — shallow water or water highlight",
  116: "Wooden sign post / lamp post — WARNING: cross/trident reads as weapon. DEPRECATED. Use 93.",
  117: "Cross/plus shaped sign marker — signpost or cross marker",
  118: "Arrow directional sign — pointing sign",
  119: "Small wooden sign — small sign post",
  120: "Water edge — southwest corner (bottom-left of water body)",
  121: "Water edge — west (left edge of water body)",
  122: "Water center — deep blue, center fill of water body",
  123: "Water edge — east (right edge of water body)",
  124: "Dark blue water variant — deep water or shadow on water",
  125: "Water with ripple/fish detail — animated water accent or fish",
  126: "Blue-gray stone underwater — submerged stone decoration",
  127: "Dark blue deep water — very deep water fill",
  128: "Treasure chest — closed (brown with gold trim). Collectible.",
  129: "Treasure chest — open (showing contents). Animation pair with 128.",
  130: "Red heart pickup — health/life collectible",
  131: "Yellow star pickup — score/bonus collectible"
};

// ─── Semantic roles ─────────────────────────────────────────────────────
const SEMANTIC_ROLES = {
  0: "overlay-decoration",
  1: "ground-fill", 2: "ground-variant", 3: "ground-transition",
  4: "tree-canopy", 5: "tree-canopy", 6: "standalone-tree",
  7: "tree-canopy", 8: "tree-canopy", 9: "standalone-tree",
  10: "tree-canopy", 11: "tree-canopy",
  12: "tree-trunk", 13: "tree-trunk",
  14: "deprecated", 15: "accent-flower",
  16: "standalone-tree", 17: "standalone-tree",
  18: "accent-vegetation", 19: "accent-flower",
  20: "standalone-vegetation", 21: "standalone-vegetation",
  22: "tree-trunk", 23: "tree-trunk",
  24: "tree-trunk", 25: "tree-trunk",
  26: "building-material", 27: "fence-material",
  28: "barrier-bush", 29: "accent-bush",
  30: "ground-fill-alt", 31: "ground-fill-alt",
  32: "building-material", 33: "building-material",
  34: "building-material", 35: "building-material",
  36: "ground-fill-alt",
  37: "ground-variant", 38: "ground-variant",
  39: "path-edge", 40: "path-center", 41: "path-edge", 42: "path-edge",
  43: "ground-accent",
  44: "path-plaza", 45: "path-plaza",
  46: "interior-floor", 47: "interior-floor",
  48: "building-wall", 49: "building-wall-window", 50: "building-wall",
  51: "building-roof", 52: "building-roof", 53: "building-roof",
  54: "building-material", 55: "building-roof-accent",
  56: "building-arch", 57: "building-arch",
  58: "building-wall", 59: "void-shadow",
  60: "building-wall", 61: "building-wall", 62: "building-wall",
  63: "building-roof", 64: "building-roof", 65: "building-roof",
  66: "building-material", 67: "building-roof-accent",
  68: "building-arch", 69: "npc-sprite", 70: "npc-sprite",
  71: "building-wall",
  72: "building-wall", 73: "building-wall", 74: "building-door", 75: "building-wall-window",
  76: "building-wall", 77: "building-wall", 78: "building-wall", 79: "building-wall",
  80: "building-door", 81: "building-wall", 82: "building-wall", 83: "void-shadow",
  84: "building-wall", 85: "building-wall", 86: "building-door", 87: "building-wall-window",
  88: "interior-floor", 89: "interior-floor",
  90: "interior-furniture", 91: "interior-furniture",
  92: "decoration-functional", 93: "decoration-functional",
  94: "collectible", 95: "collectible",
  96: "fence-end", 97: "fence-mid", 98: "fence-end",
  99: "fence-end", 100: "fence-mid", 101: "fence-end",
  102: "accent-ground", 103: "accent-ground",
  104: "decoration-functional",
  105: "deprecated", 106: "deprecated",
  107: "decoration-functional",
  108: "fence-post",
  109: "water-corner", 110: "water-edge", 111: "water-corner",
  112: "water-edge", 113: "water-corner",
  114: "water-variant", 115: "water-variant",
  116: "deprecated",
  117: "decoration-sign", 118: "decoration-sign", 119: "decoration-sign",
  120: "water-corner", 121: "water-edge", 122: "water-center", 123: "water-edge",
  124: "water-variant", 125: "water-animated", 126: "water-variant", 127: "water-variant",
  128: "collectible-container", 129: "collectible-container",
  130: "collectible", 131: "collectible"
};

// ─── Layer assignments ──────────────────────────────────────────────────
function getLayer(tile) {
  const id = tile.id;
  // Canopy tiles go on foreground layer
  if ([4, 5, 7, 8, 10, 11].includes(id)) return "foreground";
  // Ground/terrain tiles
  if (tile.category === "terrain" || tile.category === "path") return "ground";
  // Water, buildings, fences, decoration, vegetation trunks → objects
  return "objects";
}

// ─── Edge compatibility (Wang-tile style semantic labels) ────────────────
// Defines what semantic edge types each tile can connect to on each side
const EDGE_TYPES = {
  // Ground tiles — connect to anything ground-level
  grass: ["grass", "grass-variant", "flower-grass", "path-edge", "vegetation-base", "decoration-base", "fence-base", "water-edge"],
  path: ["path", "path-edge", "grass"],
  water: ["water", "water-edge"],
  building_top: ["sky", "building-roof", "roof-edge"],
  building_wall: ["building-wall", "building-door", "building-window"],
};

function getEdgeCompatibility(tile) {
  const id = tile.id;
  const role = SEMANTIC_ROLES[id] || "unknown";

  // Ground tiles
  if ([1, 2, 37, 38, 43].includes(id)) {
    return {
      north: ["grass", "grass-variant", "flower-grass", "path-edge", "building-base", "fence-base", "water-edge", "vegetation-base"],
      south: ["grass", "grass-variant", "flower-grass", "path-edge", "building-base", "fence-base", "water-edge", "vegetation-base"],
      east: ["grass", "grass-variant", "flower-grass", "path-edge", "building-base", "fence-base", "water-edge", "vegetation-base"],
      west: ["grass", "grass-variant", "flower-grass", "path-edge", "building-base", "fence-base", "water-edge", "vegetation-base"]
    };
  }

  // Path tiles
  if ([39, 40, 41, 42].includes(id)) {
    return {
      north: ["path", "path-edge", "grass"],
      south: ["path", "path-edge", "grass"],
      east: ["path", "path-edge", "grass"],
      west: ["path", "path-edge", "grass"]
    };
  }

  // Roof tiles — sky above, walls below
  if (role === "building-roof" || role === "building-roof-accent") {
    return {
      north: ["sky", "empty"],
      south: ["building-wall", "building-door", "building-window"],
      east: ["building-roof", "sky", "empty"],
      west: ["building-roof", "sky", "empty"]
    };
  }

  // Wall tiles — roof above, ground below
  if (role === "building-wall" || role === "building-door" || role === "building-wall-window") {
    return {
      north: ["building-roof", "building-wall"],
      south: ["grass", "path-edge", "fence-base"],
      east: ["building-wall", "building-door", "building-window", "grass"],
      west: ["building-wall", "building-door", "building-window", "grass"]
    };
  }

  // Fence tiles — grass on all sides
  if (role === "fence-end" || role === "fence-mid" || role === "fence-post") {
    return {
      north: ["grass", "building-wall", "building-base"],
      south: ["grass", "path-edge"],
      east: ["fence-mid", "fence-end", "grass", "gate-gap"],
      west: ["fence-mid", "fence-end", "grass", "gate-gap"]
    };
  }

  // Water tiles
  if (tile.category === "water") {
    return {
      north: ["water", "water-edge", "grass"],
      south: ["water", "water-edge", "grass"],
      east: ["water", "water-edge", "grass"],
      west: ["water", "water-edge", "grass"]
    };
  }

  // Tree canopy (foreground layer — doesn't constrain ground)
  if (role === "tree-canopy") {
    return {
      north: ["any-foreground", "empty"],
      south: ["tree-trunk", "any-foreground", "empty"],
      east: ["tree-canopy", "any-foreground", "empty"],
      west: ["tree-canopy", "any-foreground", "empty"]
    };
  }

  // Tree trunk (objects layer)
  if (role === "tree-trunk") {
    return {
      north: ["tree-canopy"],
      south: ["grass", "grass-variant"],
      east: ["tree-trunk", "grass", "empty"],
      west: ["tree-trunk", "grass", "empty"]
    };
  }

  // Small vegetation / decorations — surrounded by grass
  if (role.startsWith("accent-") || role.startsWith("standalone-") || role === "barrier-bush") {
    return {
      north: ["grass", "grass-variant", "flower-grass", "vegetation-base"],
      south: ["grass", "grass-variant", "flower-grass", "vegetation-base"],
      east: ["grass", "grass-variant", "flower-grass", "vegetation-base"],
      west: ["grass", "grass-variant", "flower-grass", "vegetation-base"]
    };
  }

  // Collectibles — on grass or path
  if (role === "collectible" || role === "collectible-container") {
    return {
      north: ["grass", "path", "any"],
      south: ["grass", "path", "any"],
      east: ["grass", "path", "any"],
      west: ["grass", "path", "any"]
    };
  }

  // Default: no strong constraints
  return {
    north: ["any"], south: ["any"], east: ["any"], west: ["any"]
  };
}

// ─── Placement rules ────────────────────────────────────────────────────
function getPlacementRules(tile) {
  const id = tile.id;
  const role = SEMANTIC_ROLES[id] || "unknown";

  // Ground tiles
  if (id === 1) return { frequency: "60%", maxConsecutive: 4, clustering: "organic-blobs", minGroupSize: 1 };
  if (id === 2) return { frequency: "30%", maxConsecutive: 3, clustering: "organic-blobs", minGroupSize: 2 };
  if (id === 43) return { frequency: "10%", maxConsecutive: 2, clustering: "near-poi", nearRequirement: ["building", "path", "water"], minGroupSize: 2, maxGroupSize: 4 };
  if ([37, 38].includes(id)) return { frequency: "rare", maxConsecutive: 3, clustering: "organic-blobs", notes: "Secondary grass variants, use sparingly" };

  // Path tiles
  if ([39, 40, 41, 42].includes(id)) return { frequency: "path-network", minWidth: 2, maxWidth: 3, connectsTo: ["building-door", "map-exit", "poi"], notes: "Always 2 tiles wide minimum. Edge tiles on sides, center tiles in middle." };

  // Trees
  if (role === "tree-canopy" || role === "tree-trunk") return { frequency: "border-and-groves", minSpacing: 1, clustering: "organic-groups", groupSize: "2-5", avoidZone: ["path:3", "building:4"], notes: "Composite: canopy ALWAYS directly above trunk. Mix tree types." };

  // Small vegetation
  if (role === "standalone-tree") return { frequency: "accent", minSpacing: 2, clustering: "scatter", avoidZone: ["path:2", "building:2"] };
  if (role.startsWith("accent-")) return { frequency: "accent", clustering: "near-poi", nearRequirement: ["building", "path", "fence"], minGroupSize: 1, maxGroupSize: 3 };
  if (role === "barrier-bush") return { frequency: "barrier", clustering: "rows-with-gaps", gapFrequency: "every-2-3", nearRequirement: ["path-edge", "zone-boundary"] };

  // Building components — placed as composites, not individually
  if (role.startsWith("building-")) return { frequency: "composite-only", notes: "Never placed individually. Always part of a building composite template." };

  // Fences
  if (role === "fence-end" || role === "fence-mid") return { frequency: "composite-only", notes: "Always part of fence segment. Gate gap (-1) aligns with building door." };

  // Water
  if (tile.category === "water") return { frequency: "composite-only", notes: "Always part of pond/water composite. Minimum 3x3. All 9 edge tiles required." };

  // Decorations
  if (role === "decoration-functional") {
    if (id === 92 || id === 104) return { frequency: "1-per-map", nearRequirement: ["path-intersection", "village-center"], notes: "Well: top (92) above base (104)." };
    if (id === 93) return { frequency: "2-4-per-map", nearRequirement: ["building", "path-intersection"], notes: "Warm lanterns near buildings and paths." };
    if (id === 107) return { frequency: "1-3-per-map", nearRequirement: ["building:shop", "path"], notes: "Barrels near shops/buildings." };
  }

  // Collectibles
  if (role === "collectible" || role === "collectible-container") return { frequency: "quest-placed", notes: "Placed by quest system, not random generation." };

  return { frequency: "contextual", notes: "Placement depends on map context." };
}

// ─── Build the enriched tile array ──────────────────────────────────────
const enrichedTiles = catalog.tiles.map(tile => {
  return {
    id: tile.id,
    name: tile.name,
    visual: VISUAL_DESCRIPTIONS[tile.id] || `Tile ${tile.id} — no visual description available`,
    semanticRole: SEMANTIC_ROLES[tile.id] || "unknown",
    layer: getLayer(tile),
    category: tile.category,
    walkable: tile.walkable,
    verified: tile.verified,
    edgeCompatibility: getEdgeCompatibility(tile),
    placementRules: getPlacementRules(tile),
    compositeGroup: tile.compositeGroup,
    compositeRole: tile.compositeRole,
    compositeOffset: tile.compositeOffset,
    deprecated: tile.deprecated,
    neverUseReason: tile.deprecatedReason,
    tags: tile.tags
  };
});

// ─── Semantic zone definitions (what the LLM generates) ─────────────────
const semanticZones = {
  "grass": {
    description: "Open green space — primary ground fill",
    tileDistribution: { 1: "60%", 2: "30%", 43: "10%" },
    rules: ["Never >4 same tile in a row", "Cluster variants in organic blobs, not checkerboard", "Flower grass (43) only near POIs"]
  },
  "path": {
    description: "Dirt walkway connecting buildings and map features",
    tiles: { center: 40, edgeLeft: 39, edgeRight: 41, edgeVertical: 42 },
    rules: ["Always 2 tiles wide minimum", "Widen to 3x3 at intersections", "Must connect to every building door", "Use edge tiles on grass-path boundaries"]
  },
  "building-zone": {
    description: "Atomic building footprint — placed as complete template",
    templates: ["small_house", "medium_house", "large_house", "stone_shop", "stone_shop_large", "blue_roof_house", "brick_building"],
    rules: ["3-5 buildings per village map", "10+ tiles center-to-center", "3-4 tile grass yard around each", "Stagger placement, not grid-aligned", "Door must face path within 2 tiles"]
  },
  "fence-zone": {
    description: "Fence row below a building, with gate aligned to door",
    tiles: { leftEnd: 96, middle: 97, rightEnd: 98, gate: -1 },
    rules: ["Width matches building width + 2", "Gate (-1) aligned with door column above", "Placed 1 row below building wall row"]
  },
  "water": {
    description: "Pond or water feature with proper edge tiles",
    template: "pond",
    rules: ["Minimum 3x3", "All 9 edge tiles required", "2+ tile gap from buildings", "Surround with flowers/bushes on 1-2 sides"]
  },
  "forest": {
    description: "Dense tree border along map edges",
    treeTypes: ["green_tree", "autumn_tree", "pine_tree", "dense_tree"],
    rules: ["Mix at least 3 tree types", "Max 2 same type adjacent", "Stagger depth with gaps", "Add understory (ferns, small trees) at base", "NOT a uniform wall"]
  },
  "tree-cluster": {
    description: "Interior grove of 2-5 trees within the map",
    rules: ["3+ tiles from paths", "4+ tiles from buildings", "Mix 2+ tree types per cluster", "Add accent vegetation around base"]
  },
  "garden": {
    description: "Yard/buffer zone around buildings with flowers and bushes",
    decorations: [19, 15, 18, 28, 29, 17],
    rules: ["Flowers cluster 2-4 together", "Bushes as soft barriers", "Placed within 3-4 tiles of parent building"]
  },
  "decoration": {
    description: "Functional objects placed at points of interest",
    items: { well: [92, 104], lantern: 93, barrel: 107 },
    rules: ["Well at village center or path intersection", "Lanterns near buildings and paths", "Barrels near shops", "1-2 per building max"]
  },
  "village-square": {
    description: "Central open area where paths converge",
    size: "6x4 to 8x6 tiles",
    rules: ["Largest open area on map", "Well or fountain at center", "Benches/flowers around edges", "All main paths converge here"]
  },
  "collectible-zone": {
    description: "Areas where quest items / pickups are placed",
    items: { chest: 128, heart: 130, star: 131, key: 94, coin: 95 },
    rules: ["Placed by quest system", "Never random — always meaningful placement", "Chest near quest objective"]
  }
};

// ─── Assemble final output ──────────────────────────────────────────────
const output = {
  meta: {
    ...catalog.meta,
    version: "2.0.0",
    lastUpdated: new Date().toISOString().split('T')[0],
    description: "Deep semantic tile catalog for LLM-driven map generation. Each tile has visual descriptions, edge compatibility (Wang-tile style), semantic roles, and placement rules.",
    generatedBy: "build-semantics.js"
  },
  semanticZones,
  tiles: enrichedTiles,
  compositeObjects: catalog.compositeObjects,
  buildingTemplates: catalog.compositeObjects.filter(c => c.category === "building"),
  vegetationTemplates: catalog.compositeObjects.filter(c => c.category === "vegetation"),
  waterTemplates: catalog.compositeObjects.filter(c => c.category === "water"),
  fenceTemplates: catalog.compositeObjects.filter(c => c.category === "fence"),
  decorationTemplates: catalog.compositeObjects.filter(c => c.category === "decoration"),
  categories: catalog.categories,
  groundTruthNotes: catalog.groundTruthNotes,
  deprecatedTiles: enrichedTiles.filter(t => t.deprecated).map(t => ({
    id: t.id,
    name: t.name,
    reason: t.neverUseReason,
    replacement: t.id === 14 ? 28 : t.id === 105 ? null : t.id === 106 ? 107 : t.id === 116 ? 93 : null
  }))
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`tile-semantics.json written: ${enrichedTiles.length} tiles enriched`);
console.log(`  - ${enrichedTiles.filter(t => t.visual).length} visual descriptions`);
console.log(`  - ${enrichedTiles.filter(t => t.semanticRole !== 'unknown').length} semantic roles assigned`);
console.log(`  - ${Object.keys(semanticZones).length} semantic zone definitions`);
console.log(`  - ${output.deprecatedTiles.length} deprecated tiles flagged`);
console.log(`  - ${output.compositeObjects.length} composite object templates`);
