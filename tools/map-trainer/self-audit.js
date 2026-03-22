/**
 * self-audit.js
 *
 * Validates a generated map against hard rules and returns a score + violations.
 * Used by the map-trainer pipeline to reject or accept generated maps.
 */

// ── Tile ID constants ──────────────────────────────────────────────────────────

const CANOPY_TO_TRUNK = { 4: 12, 5: 13, 7: 24, 8: 25, 10: 22, 11: 23 };
const TRUNK_TO_CANOPY = { 12: 4, 13: 5, 22: 10, 23: 11, 24: 7, 25: 8 };

const CANOPY_TILES = new Set([4, 5, 7, 8, 10, 11]);
const TRUNK_TILES  = new Set([12, 13, 22, 23, 24, 25]);

const ROOF_TILES = new Set([51, 52, 53, 55, 63, 64, 65, 67]);
const WALL_TILES = new Set([
  48, 49, 50,
  60, 61, 62,
  72, 73, 74, 75,
  84, 85, 86, 87
]);

const DEPRECATED_TILES = new Set([14, 105, 106, 116]);

const DOOR_TILES = new Set([74, 86]);
const PATH_TILES = new Set([39, 40, 41, 42, 44, 45]);

// Water tiles range 109-127
const WATER_TILES = new Set();
for (let i = 109; i <= 127; i++) WATER_TILES.add(i);
const WATER_CENTER = 122;

// Tree type groupings for variety check
const TREE_TYPE_GREEN  = new Set([4, 5]);
const TREE_TYPE_AUTUMN = new Set([7, 8]);
const TREE_TYPE_PINE   = new Set([10]);
const TREE_TYPE_DENSE  = new Set([11]);
const TREE_TYPE_SMALL  = new Set([6, 9, 16, 17]);

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convert (x, y) to flat index in a row-major grid. */
function idx(x, y, width) {
  return y * width + x;
}

/** Check if (x, y) is inside the map bounds. */
function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

/** Collect (x, y) positions of the first few matches for a readable message. */
function formatPositions(positions, max) {
  const shown = positions.slice(0, max || 5);
  const parts = shown.map(p => `(${p[0]},${p[1]})`);
  if (positions.length > shown.length) {
    parts.push(`... and ${positions.length - shown.length} more`);
  }
  return parts.join(', ');
}

// ── Rule implementations ───────────────────────────────────────────────────────

/**
 * Rule 1: ground-fill (critical)
 * Every cell in the ground layer must be >= 0 (not -1).
 */
function checkGroundFill(mapData) {
  const { width, height, ground } = mapData;
  const empty = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ground[idx(x, y, width)] < 0) {
        empty.push([x, y]);
      }
    }
  }

  if (empty.length === 0) return null;
  return {
    rule: 'ground-fill',
    severity: 'critical',
    message: `${empty.length} empty cells in ground layer at ${formatPositions(empty)}`,
    count: empty.length
  };
}

/**
 * Rule 2: canopy-trunk (critical)
 * Every tree canopy on the foreground layer must have its matching trunk
 * on the objects layer directly below (y+1).
 */
function checkCanopyTrunk(mapData) {
  const { width, height, foreground, objects } = mapData;
  const violations = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = foreground[idx(x, y, width)];
      if (!CANOPY_TILES.has(tile)) continue;

      const expectedTrunk = CANOPY_TO_TRUNK[tile];
      const belowY = y + 1;

      if (!inBounds(x, belowY, width, height)) {
        violations.push([x, y]);
        continue;
      }

      const trunkTile = objects[idx(x, belowY, width)];
      if (trunkTile !== expectedTrunk) {
        violations.push([x, y]);
      }
    }
  }

  if (violations.length === 0) return null;
  return {
    rule: 'canopy-trunk',
    severity: 'critical',
    message: `Canopy at ${formatPositions(violations)} has no matching trunk below`,
    count: violations.length
  };
}

/**
 * Rule 3: trunk-canopy (critical)
 * Every tree trunk on the objects layer must have its matching canopy
 * on the foreground layer directly above (y-1).
 */
function checkTrunkCanopy(mapData) {
  const { width, height, foreground, objects } = mapData;
  const violations = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = objects[idx(x, y, width)];
      if (!TRUNK_TILES.has(tile)) continue;

      const expectedCanopy = TRUNK_TO_CANOPY[tile];
      const aboveY = y - 1;

      if (!inBounds(x, aboveY, width, height)) {
        violations.push([x, y]);
        continue;
      }

      const canopyTile = foreground[idx(x, aboveY, width)];
      if (canopyTile !== expectedCanopy) {
        violations.push([x, y]);
      }
    }
  }

  if (violations.length === 0) return null;
  return {
    rule: 'trunk-canopy',
    severity: 'critical',
    message: `Trunk at ${formatPositions(violations)} has no matching canopy above`,
    count: violations.length
  };
}

/**
 * Rule 4: roof-wall (critical)
 * Every roof tile on the objects layer must have a wall tile directly below (y+1).
 */
function checkRoofWall(mapData) {
  const { width, height, objects } = mapData;
  const violations = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = objects[idx(x, y, width)];
      if (!ROOF_TILES.has(tile)) continue;

      const belowY = y + 1;
      if (!inBounds(x, belowY, width, height)) {
        violations.push([x, y]);
        continue;
      }

      const wallTile = objects[idx(x, belowY, width)];
      if (!WALL_TILES.has(wallTile)) {
        violations.push([x, y]);
      }
    }
  }

  if (violations.length === 0) return null;
  return {
    rule: 'roof-wall',
    severity: 'critical',
    message: `Roof at ${formatPositions(violations)} has no wall tile below`,
    count: violations.length
  };
}

/**
 * Rule 5: no-deprecated (critical)
 * No deprecated tiles (14, 105, 106, 116) on any layer.
 */
function checkNoDeprecated(mapData) {
  const { width, height, ground, objects, foreground } = mapData;
  const violations = [];
  const layers = [
    { name: 'ground', data: ground },
    { name: 'objects', data: objects },
    { name: 'foreground', data: foreground }
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      for (const layer of layers) {
        if (DEPRECATED_TILES.has(layer.data[i])) {
          violations.push([x, y]);
        }
      }
    }
  }

  if (violations.length === 0) return null;
  return {
    rule: 'no-deprecated',
    severity: 'critical',
    message: `Deprecated tiles found at ${formatPositions(violations)}`,
    count: violations.length
  };
}

/**
 * Rule 6: door-path (critical)
 * Every door tile must have a path tile within 3 rows below it (same x column).
 */
function checkDoorPath(mapData) {
  const { width, height, objects, ground } = mapData;
  const violations = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = objects[idx(x, y, width)];
      if (!DOOR_TILES.has(tile)) continue;

      let foundPath = false;
      for (let dy = 1; dy <= 3; dy++) {
        const checkY = y + dy;
        if (!inBounds(x, checkY, width, height)) continue;
        if (PATH_TILES.has(ground[idx(x, checkY, width)])) {
          foundPath = true;
          break;
        }
      }

      if (!foundPath) {
        violations.push([x, y]);
      }
    }
  }

  if (violations.length === 0) return null;
  return {
    rule: 'door-path',
    severity: 'critical',
    message: `Door at ${formatPositions(violations)} has no path tile within 3 rows below`,
    count: violations.length
  };
}

/**
 * Rule 7: walkable-ratio (major)
 * Walkable cells (collision=0) should be 55-65%. Violation if below 50% or above 70%.
 */
function checkWalkableRatio(mapData) {
  const { width, height, collision } = mapData;
  const total = width * height;
  let walkable = 0;

  for (let i = 0; i < total; i++) {
    if (collision[i] === 0) walkable++;
  }

  const ratio = walkable / total;
  const pct = Math.round(ratio * 100);

  if (ratio < 0.50) {
    return {
      rule: 'walkable-ratio',
      severity: 'major',
      message: `Walkable ratio is ${pct}%, below minimum 50%`,
      count: 1
    };
  }
  if (ratio > 0.70) {
    return {
      rule: 'walkable-ratio',
      severity: 'major',
      message: `Walkable ratio is ${pct}%, above maximum 70%`,
      count: 1
    };
  }

  return null;
}

/**
 * Rule 8: building-spacing (major)
 * Find building clusters (groups of roof tiles) and check that no two
 * building centers are within 8 tiles of each other.
 */
function checkBuildingSpacing(mapData) {
  const { width, height, objects } = mapData;

  // Find all roof tile positions
  const roofPositions = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ROOF_TILES.has(objects[idx(x, y, width)])) {
        roofPositions.push([x, y]);
      }
    }
  }

  if (roofPositions.length === 0) return null;

  // Flood-fill cluster roof tiles using 4-connected adjacency
  const visited = new Set();
  const clusters = [];

  for (const [rx, ry] of roofPositions) {
    const key = `${rx},${ry}`;
    if (visited.has(key)) continue;

    // BFS to find connected roof tiles
    const cluster = [];
    const queue = [[rx, ry]];
    visited.add(key);

    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      cluster.push([cx, cy]);

      const neighbors = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
      for (const [nx, ny] of neighbors) {
        const nk = `${nx},${ny}`;
        if (visited.has(nk)) continue;
        if (!inBounds(nx, ny, width, height)) continue;
        if (ROOF_TILES.has(objects[idx(nx, ny, width)])) {
          visited.add(nk);
          queue.push([nx, ny]);
        }
      }
    }

    // Compute cluster center
    let sumX = 0, sumY = 0;
    for (const [px, py] of cluster) { sumX += px; sumY += py; }
    clusters.push({
      cx: sumX / cluster.length,
      cy: sumY / cluster.length
    });
  }

  // Check pairwise distances between cluster centers
  const tooClose = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const dx = clusters[i].cx - clusters[j].cx;
      const dy = clusters[i].cy - clusters[j].cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 8) {
        tooClose.push([
          Math.round(clusters[i].cx), Math.round(clusters[i].cy),
          Math.round(clusters[j].cx), Math.round(clusters[j].cy)
        ]);
      }
    }
  }

  if (tooClose.length === 0) return null;

  const pairs = tooClose.slice(0, 3).map(
    p => `(${p[0]},${p[1]})-(${p[2]},${p[3]})`
  ).join(', ');

  return {
    rule: 'building-spacing',
    severity: 'major',
    message: `${tooClose.length} building pair(s) too close (<8 tiles): ${pairs}`,
    count: tooClose.length
  };
}

/**
 * Rule 9: water-edges (major)
 * Every water center tile (122) must have only appropriate water tiles
 * (109-127) in all 8 surrounding cells, or the neighbor is out-of-bounds.
 */
function checkWaterEdges(mapData) {
  const { width, height, ground } = mapData;
  const violations = [];

  const dirs = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1]
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ground[idx(x, y, width)] !== WATER_CENTER) continue;

      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, width, height)) continue;
        if (!WATER_TILES.has(ground[idx(nx, ny, width)])) {
          violations.push([x, y]);
          break; // one bad neighbor is enough to flag this cell
        }
      }
    }
  }

  if (violations.length === 0) return null;
  return {
    rule: 'water-edges',
    severity: 'major',
    message: `Water center at ${formatPositions(violations)} has non-water neighbors`,
    count: violations.length
  };
}

/**
 * Rule 10: path-connectivity (major)
 * All door tiles must be reachable from the map center via path tiles (BFS).
 */
function checkPathConnectivity(mapData) {
  const { width, height, objects, ground } = mapData;

  // Collect all door positions
  const doors = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (DOOR_TILES.has(objects[idx(x, y, width)])) {
        doors.push([x, y]);
      }
    }
  }

  if (doors.length === 0) return null;

  // BFS from map center on path tiles + door tiles
  const startX = Math.floor(width / 2);
  const startY = Math.floor(height / 2);

  const visited = new Uint8Array(width * height);
  const queue = [];

  // Seed the BFS: if map center is a path tile, start there.
  // Otherwise, find the nearest path tile to seed from.
  const centerIdx = idx(startX, startY, width);
  if (PATH_TILES.has(ground[centerIdx]) || DOOR_TILES.has(objects[centerIdx])) {
    queue.push([startX, startY]);
    visited[centerIdx] = 1;
  } else {
    // Spiral outward from center to find the first path tile
    let found = false;
    for (let r = 1; r < Math.max(width, height) && !found; r++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // perimeter only
          const sx = startX + dx;
          const sy = startY + dy;
          if (!inBounds(sx, sy, width, height)) continue;
          const si = idx(sx, sy, width);
          if (PATH_TILES.has(ground[si]) || DOOR_TILES.has(objects[si])) {
            queue.push([sx, sy]);
            visited[si] = 1;
            found = true;
          }
        }
      }
    }
  }

  // BFS: walk through path tiles and door tiles
  const dirs4 = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of dirs4) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny, width, height)) continue;
      const ni = idx(nx, ny, width);
      if (visited[ni]) continue;
      if (PATH_TILES.has(ground[ni]) || DOOR_TILES.has(objects[ni])) {
        visited[ni] = 1;
        queue.push([nx, ny]);
      }
    }
  }

  // Check which doors were reached
  const unreachable = [];
  for (const [dx, dy] of doors) {
    if (!visited[idx(dx, dy, width)]) {
      unreachable.push([dx, dy]);
    }
  }

  if (unreachable.length === 0) return null;
  return {
    rule: 'path-connectivity',
    severity: 'major',
    message: `${unreachable.length} door(s) unreachable from map center: ${formatPositions(unreachable)}`,
    count: unreachable.length
  };
}

/**
 * Rule 11: grass-variety (minor)
 * Sample 20 random 5x5 areas. Each should have more than 1 unique grass type.
 * Uses a seeded PRNG so results are deterministic for the same map.
 */
function checkGrassVariety(mapData) {
  const { width, height, ground } = mapData;
  const violations = [];

  // Simple deterministic PRNG (mulberry32)
  let seed = width * 31 + height * 17;
  function rand() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const sampleCount = 20;
  const sampleSize = 5;

  // Grass tiles: typical grass range 0-3 (common ground tiles)
  // We check for unique tile IDs in the ground layer within each sample
  for (let s = 0; s < sampleCount; s++) {
    const sx = Math.floor(rand() * (width - sampleSize));
    const sy = Math.floor(rand() * (height - sampleSize));

    const uniqueTiles = new Set();
    for (let dy = 0; dy < sampleSize; dy++) {
      for (let dx = 0; dx < sampleSize; dx++) {
        const tile = ground[idx(sx + dx, sy + dy, width)];
        if (tile >= 0) uniqueTiles.add(tile);
      }
    }

    if (uniqueTiles.size <= 1) {
      violations.push([sx, sy]);
    }
  }

  if (violations.length === 0) return null;
  return {
    rule: 'grass-variety',
    severity: 'minor',
    message: `${violations.length} sample area(s) have only 1 ground tile type: ${formatPositions(violations)}`,
    count: violations.length
  };
}

/**
 * Rule 12: object-density (minor)
 * Non-empty object tiles should be 15-40% of total. Violation if <10% or >50%.
 */
function checkObjectDensity(mapData) {
  const { width, height, objects } = mapData;
  const total = width * height;
  let filled = 0;

  for (let i = 0; i < total; i++) {
    if (objects[i] >= 0) filled++;
  }

  const ratio = filled / total;
  const pct = Math.round(ratio * 100);

  if (ratio < 0.10) {
    return {
      rule: 'object-density',
      severity: 'minor',
      message: `Object density is ${pct}%, too sparse (minimum 10%)`,
      count: 1
    };
  }
  if (ratio > 0.50) {
    return {
      rule: 'object-density',
      severity: 'minor',
      message: `Object density is ${pct}%, too dense (maximum 50%)`,
      count: 1
    };
  }

  return null;
}

/**
 * Rule 13: tree-variety (minor)
 * Should use at least 2 distinct tree type groups.
 * Groups: green (4/5), autumn (7/8), pine (10), dense (11), small (6/9/16/17)
 */
function checkTreeVariety(mapData) {
  const { width, height, foreground, objects } = mapData;
  const typesFound = new Set();

  const groups = [
    { name: 'green',  tiles: TREE_TYPE_GREEN },
    { name: 'autumn', tiles: TREE_TYPE_AUTUMN },
    { name: 'pine',   tiles: TREE_TYPE_PINE },
    { name: 'dense',  tiles: TREE_TYPE_DENSE },
    { name: 'small',  tiles: TREE_TYPE_SMALL }
  ];

  // Check both foreground (canopies) and objects (trunks, small trees)
  const layers = [foreground, objects];
  const total = width * height;

  for (const layer of layers) {
    for (let i = 0; i < total; i++) {
      const tile = layer[i];
      for (const group of groups) {
        if (group.tiles.has(tile)) {
          typesFound.add(group.name);
        }
      }
    }
  }

  // No trees at all is fine (might be a desert/town map), but if trees
  // exist there should be at least 2 types for visual variety
  if (typesFound.size === 1) {
    return {
      rule: 'tree-variety',
      severity: 'minor',
      message: `Only 1 tree type used (${[...typesFound][0]}), need at least 2 for variety`,
      count: 1
    };
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN QUALITY CHECKS (scored 0-50, measures visual quality not just validity)
// These differentiate good maps from boring ones.
// ══════════════════════════════════════════════════════════════════════════════

const DECORATION_TILES = new Set([15, 18, 19, 28, 29, 92, 93, 104, 107, 128]);
const BUILDING_ROOF_TILES = new Set([51, 52, 53, 55, 63, 64, 65, 67]);
const FENCE_TILES = new Set([96, 97, 98, 99, 100, 101, 108]);
const SMALL_TREE_TILES = new Set([6, 9, 16, 17]);

/**
 * Design quality scoring — returns a score 0-50 measuring visual design quality.
 * This is separate from structural validation and measures how good the map LOOKS.
 */
function scoreDesignQuality(mapData) {
  const { width, height, ground, objects, foreground, collision } = mapData;
  const total = width * height;
  let designScore = 0;
  const details = [];

  // ── DQ1: Path network quality (0-8) ──────────────────────────────────
  // Good paths: connected, 2-wide, reach multiple areas, not too sparse or dominant
  {
    let pathCells = 0;
    let pathClusters = 0;
    const visited = new Uint8Array(total);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (PATH_TILES.has(ground[i]) && !visited[i]) {
          pathClusters++;
          // BFS to mark connected path
          const queue = [{ x, y }];
          visited[i] = 1;
          while (queue.length > 0) {
            const { x: cx, y: cy } = queue.shift();
            pathCells++;
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const ni = ny * width + nx;
                if (PATH_TILES.has(ground[ni]) && !visited[ni]) {
                  visited[ni] = 1;
                  queue.push({ x: nx, y: ny });
                }
              }
            }
          }
        }
      }
    }
    const pathPct = pathCells / total;
    let pathScore = 0;
    // Good: 5-15% path coverage
    if (pathPct >= 0.05 && pathPct <= 0.15) pathScore += 3;
    else if (pathPct >= 0.02 && pathPct <= 0.25) pathScore += 1;
    // Good: 1-3 connected path clusters (not fragmented)
    if (pathClusters >= 1 && pathClusters <= 3) pathScore += 3;
    else if (pathClusters <= 5) pathScore += 1;
    // Bonus: paths exist at all
    if (pathCells > 10) pathScore += 2;
    designScore += Math.min(8, pathScore);
    details.push(`Paths: ${pathCells} cells (${(pathPct*100).toFixed(1)}%), ${pathClusters} clusters → ${Math.min(8, pathScore)}/8`);
  }

  // ── DQ2: Building quality & variety (0-8) ─────────────────────────────
  {
    // Find building clusters by grouping roof tiles
    const buildings = [];
    const roofVisited = new Uint8Array(total);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (BUILDING_ROOF_TILES.has(objects[i]) && !roofVisited[i]) {
          let minX = x, maxX = x, minY = y, maxY = y;
          const queue = [{ x, y }];
          roofVisited[i] = 1;
          while (queue.length > 0) {
            const { x: cx, y: cy } = queue.shift();
            minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
            minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const ni = ny * width + nx;
                if ((BUILDING_ROOF_TILES.has(objects[ni]) || WALL_TILES.has(objects[ni])) && !roofVisited[ni]) {
                  roofVisited[ni] = 1;
                  queue.push({ x: nx, y: ny });
                }
              }
            }
          }
          buildings.push({ cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX + 1 });
        }
      }
    }
    let bldgScore = 0;
    // Good: 3-5 buildings
    if (buildings.length >= 3 && buildings.length <= 5) bldgScore += 3;
    else if (buildings.length >= 2 && buildings.length <= 6) bldgScore += 1;
    else if (buildings.length === 0) bldgScore += 0;
    // Good: varied building sizes
    if (buildings.length >= 2) {
      const widths = new Set(buildings.map(b => b.w));
      if (widths.size >= 2) bldgScore += 2;
    }
    // Good: buildings spread across map (not all in one corner)
    if (buildings.length >= 2) {
      const xs = buildings.map(b => b.cx);
      const ys = buildings.map(b => b.cy);
      const xSpread = Math.max(...xs) - Math.min(...xs);
      const ySpread = Math.max(...ys) - Math.min(...ys);
      if (xSpread > width * 0.3 && ySpread > height * 0.3) bldgScore += 3;
      else if (xSpread > width * 0.2 || ySpread > height * 0.2) bldgScore += 1;
    }
    designScore += Math.min(8, bldgScore);
    details.push(`Buildings: ${buildings.length}, spread score → ${Math.min(8, bldgScore)}/8`);
  }

  // ── DQ3: Decoration density & placement (0-8) ─────────────────────────
  {
    let decoCount = 0;
    let decoNearBuilding = 0;
    let decoNearPath = 0;
    let fenceCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const tile = objects[i];
        if (DECORATION_TILES.has(tile)) {
          decoCount++;
          // Check if near a building (within 5 tiles)
          let nearBldg = false, nearPath = false;
          for (let dy = -5; dy <= 5 && !nearBldg; dy++) {
            for (let dx = -5; dx <= 5 && !nearBldg; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (BUILDING_ROOF_TILES.has(objects[ny * width + nx]) || WALL_TILES.has(objects[ny * width + nx])) nearBldg = true;
                if (PATH_TILES.has(ground[ny * width + nx])) nearPath = true;
              }
            }
          }
          if (nearBldg) decoNearBuilding++;
          if (nearPath) decoNearPath++;
        }
        if (FENCE_TILES.has(tile)) fenceCount++;
      }
    }
    let decoScore = 0;
    // Good: 10-40 decorations
    if (decoCount >= 10 && decoCount <= 40) decoScore += 2;
    else if (decoCount >= 5) decoScore += 1;
    // Good: decorations near buildings (not random scatter)
    if (decoCount > 0 && decoNearBuilding / decoCount > 0.5) decoScore += 3;
    else if (decoCount > 0 && decoNearBuilding > 2) decoScore += 1;
    // Good: fences present
    if (fenceCount >= 3) decoScore += 2;
    // Bonus: decorations near paths
    if (decoNearPath > 3) decoScore += 1;
    designScore += Math.min(8, decoScore);
    details.push(`Decorations: ${decoCount} (${decoNearBuilding} near buildings, ${fenceCount} fences) → ${Math.min(8, decoScore)}/8`);
  }

  // ── DQ4: Ground texture quality (0-8) ──────────────────────────────────
  {
    // Measure: organic variation, not monotonous
    let grassPlain = 0, grassVar = 0, grassFlower = 0;
    let maxSameRun = 0, currentRun = 0, lastTile = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = ground[y * width + x];
        if (t === 1) grassPlain++;
        else if (t === 2) grassVar++;
        else if (t === 43) grassFlower++;
        // Track monotony (longest run of same tile in a row)
        if (t === lastTile) { currentRun++; maxSameRun = Math.max(maxSameRun, currentRun); }
        else { currentRun = 1; lastTile = t; }
      }
    }
    const grassTotal = grassPlain + grassVar + grassFlower;
    let groundScore = 0;
    if (grassTotal > 0) {
      const plainPct = grassPlain / grassTotal;
      const varPct = grassVar / grassTotal;
      const flowerPct = grassFlower / grassTotal;
      // Good: 50-70% plain, 20-35% variant, 5-15% flower (target: 60/30/10)
      if (plainPct >= 0.45 && plainPct <= 0.75) groundScore += 2;
      if (varPct >= 0.15 && varPct <= 0.40) groundScore += 2;
      if (flowerPct >= 0.03 && flowerPct <= 0.20) groundScore += 2;
      // Bad: monotonous (long runs of same tile)
      if (maxSameRun <= 6) groundScore += 2;
      else if (maxSameRun <= 10) groundScore += 1;
    }
    designScore += Math.min(8, groundScore);
    details.push(`Ground: plain=${grassPlain} var=${grassVar} flower=${grassFlower}, max run=${maxSameRun} → ${Math.min(8, groundScore)}/8`);
  }

  // ── DQ5: Tree coverage & border quality (0-8) ─────────────────────────
  {
    let treeCanopies = 0;
    let borderTrees = 0; // trees in first/last 3 rows/cols
    let interiorTrees = 0;
    let treeTypes = new Set();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ft = foreground[y * width + x];
        if (CANOPY_TILES.has(ft)) {
          treeCanopies++;
          if (y < 3 || y >= height - 3 || x < 3 || x >= width - 3) borderTrees++;
          else interiorTrees++;
          if (TREE_TYPE_GREEN.has(ft)) treeTypes.add('green');
          if (TREE_TYPE_AUTUMN.has(ft)) treeTypes.add('autumn');
          if (TREE_TYPE_PINE.has(ft)) treeTypes.add('pine');
          if (TREE_TYPE_DENSE.has(ft)) treeTypes.add('dense');
        }
        if (SMALL_TREE_TILES.has(objects[y * width + x])) {
          treeTypes.add('small');
          interiorTrees++;
        }
      }
    }
    let treeScore = 0;
    // Good: tree border exists (>20 border canopies)
    if (borderTrees >= 20) treeScore += 2;
    else if (borderTrees >= 10) treeScore += 1;
    // Good: interior trees exist (groves, not empty)
    if (interiorTrees >= 5 && interiorTrees <= 60) treeScore += 2;
    else if (interiorTrees >= 2) treeScore += 1;
    // Good: 3+ tree types for variety
    if (treeTypes.size >= 3) treeScore += 2;
    else if (treeTypes.size >= 2) treeScore += 1;
    // Good: overall coverage 10-30% of map
    const treePct = treeCanopies / total;
    if (treePct >= 0.08 && treePct <= 0.30) treeScore += 2;
    else if (treePct >= 0.04) treeScore += 1;
    designScore += Math.min(8, treeScore);
    details.push(`Trees: ${treeCanopies} canopies (${borderTrees} border, ${interiorTrees} interior), ${treeTypes.size} types → ${Math.min(8, treeScore)}/8`);
  }

  // ── DQ6: Spatial composition (0-10) ────────────────────────────────────
  {
    // Divide map into 4 quadrants, check each has SOMETHING interesting
    const qw = Math.floor(width / 2), qh = Math.floor(height / 2);
    const quadrants = [
      { x0: 0, y0: 0, x1: qw, y1: qh },       // NW
      { x0: qw, y0: 0, x1: width, y1: qh },    // NE
      { x0: 0, y0: qh, x1: qw, y1: height },   // SW
      { x0: qw, y0: qh, x1: width, y1: height } // SE
    ];
    let occupiedQuadrants = 0;
    let quadrantDiversity = 0;
    for (const q of quadrants) {
      let hasBuilding = false, hasTree = false, hasPath = false, hasDeco = false;
      for (let y = q.y0; y < q.y1; y++) {
        for (let x = q.x0; x < q.x1; x++) {
          const i = y * width + x;
          if (BUILDING_ROOF_TILES.has(objects[i]) || WALL_TILES.has(objects[i])) hasBuilding = true;
          if (CANOPY_TILES.has(foreground[i])) hasTree = true;
          if (PATH_TILES.has(ground[i])) hasPath = true;
          if (DECORATION_TILES.has(objects[i])) hasDeco = true;
        }
      }
      const features = [hasBuilding, hasTree, hasPath, hasDeco].filter(Boolean).length;
      if (features >= 2) occupiedQuadrants++;
      quadrantDiversity += features;
    }
    let compScore = 0;
    // Good: all 4 quadrants have 2+ feature types
    if (occupiedQuadrants === 4) compScore += 4;
    else if (occupiedQuadrants >= 3) compScore += 2;
    else if (occupiedQuadrants >= 2) compScore += 1;
    // Good: high total diversity across quadrants (max 16)
    if (quadrantDiversity >= 12) compScore += 3;
    else if (quadrantDiversity >= 8) compScore += 2;
    else if (quadrantDiversity >= 5) compScore += 1;
    // Good: center area (middle 50%) has path intersection or village square
    let centerPaths = 0;
    const cx0 = Math.floor(width * 0.25), cx1 = Math.floor(width * 0.75);
    const cy0 = Math.floor(height * 0.25), cy1 = Math.floor(height * 0.75);
    for (let y = cy0; y < cy1; y++) {
      for (let x = cx0; x < cx1; x++) {
        if (PATH_TILES.has(ground[y * width + x])) centerPaths++;
      }
    }
    if (centerPaths >= 20) compScore += 3;
    else if (centerPaths >= 8) compScore += 2;
    designScore += Math.min(10, compScore);
    details.push(`Composition: ${occupiedQuadrants}/4 quadrants active, diversity=${quadrantDiversity}, center paths=${centerPaths} → ${Math.min(10, compScore)}/10`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TIER 2: GRANULAR QUALITY (0-50 additional points)
  // These keep differentiating at the top end where basic checks plateau
  // ══════════════════════════════════════════════════════════════════════

  let granularScore = 0;

  // ── GQ1: Building completeness (0-8) — every roof has walls, every door has path
  {
    let completeBuildings = 0, incompleteBuildings = 0;
    let doorsWithPath = 0, doorsTotal = 0;
    let roofWallPairs = 0, orphanRoofs = 0;
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (BUILDING_ROOF_TILES.has(objects[i])) {
          // Check wall below
          const below = objects[(y + 1) * width + x];
          if (WALL_TILES.has(below)) roofWallPairs++;
          else orphanRoofs++;
        }
        if (DOOR_TILES.has(objects[i])) {
          doorsTotal++;
          // Check path within 3 tiles below
          for (let dy = 1; dy <= 3; dy++) {
            if (y + dy < height && PATH_TILES.has(ground[(y + dy) * width + x])) { doorsWithPath++; break; }
          }
        }
      }
    }
    let gq1 = 0;
    if (roofWallPairs > 0 && orphanRoofs === 0) gq1 += 4; // perfect roof→wall
    else if (roofWallPairs > orphanRoofs) gq1 += 2;
    if (doorsTotal > 0 && doorsWithPath === doorsTotal) gq1 += 4; // all doors reach paths
    else if (doorsTotal > 0 && doorsWithPath > 0) gq1 += 2;
    granularScore += Math.min(8, gq1);
    details.push(`Building completeness: ${roofWallPairs} roof→wall, ${orphanRoofs} orphan, ${doorsWithPath}/${doorsTotal} doors→path → ${Math.min(8, gq1)}/8`);
  }

  // ── GQ2: Fence coherence (0-6) — fences should be continuous rows, not scattered
  {
    let fenceRuns = 0, fenceRunLengths = [];
    let inRun = false, runLen = 0;
    for (let y = 0; y < height; y++) {
      inRun = false; runLen = 0;
      for (let x = 0; x < width; x++) {
        const t = objects[y * width + x];
        if (FENCE_TILES.has(t)) {
          if (!inRun) { fenceRuns++; runLen = 0; }
          inRun = true; runLen++;
        } else {
          if (inRun) fenceRunLengths.push(runLen);
          inRun = false;
        }
      }
      if (inRun) fenceRunLengths.push(runLen);
    }
    let gq2 = 0;
    if (fenceRunLengths.length > 0) {
      const avgLen = fenceRunLengths.reduce((a, b) => a + b, 0) / fenceRunLengths.length;
      if (avgLen >= 3) gq2 += 3; // fences are proper runs, not scattered singles
      else if (avgLen >= 2) gq2 += 1;
      // Fences near buildings
      let fenceNearBldg = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (FENCE_TILES.has(objects[y * width + x])) {
            for (let dy = -2; dy <= 0; dy++) { // check above (fences go below buildings)
              if (y + dy >= 0 && WALL_TILES.has(objects[(y + dy) * width + x])) { fenceNearBldg++; break; }
            }
          }
        }
      }
      if (fenceNearBldg > 0) gq2 += 3;
    }
    granularScore += Math.min(6, gq2);
    details.push(`Fence coherence: ${fenceRuns} runs, avg len ${fenceRunLengths.length > 0 ? (fenceRunLengths.reduce((a,b)=>a+b,0)/fenceRunLengths.length).toFixed(1) : 0} → ${Math.min(6, gq2)}/6`);
  }

  // ── GQ3: Path edge correctness (0-6) — paths should have proper edge tiles
  {
    let correctEdges = 0, totalPathCells = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = ground[y * width + x];
        if (!PATH_TILES.has(t)) continue;
        totalPathCells++;
        // Check if edge tiles are used correctly
        // Tile 39 (left/top edge) should have grass to its left or above
        // Tile 41 (right/bottom edge) should have grass to its right or below
        // Tile 40 (center) should have path on both sides
        if (t === 39) { // left/top edge
          const left = x > 0 ? ground[y * width + (x - 1)] : -1;
          if (!PATH_TILES.has(left)) correctEdges++; // good: grass to the left
        } else if (t === 41) { // right/bottom edge
          const right = x < width - 1 ? ground[y * width + (x + 1)] : -1;
          if (!PATH_TILES.has(right)) correctEdges++; // good: grass to the right
        } else if (t === 40) { // center
          correctEdges++; // center is always fine
        }
      }
    }
    let gq3 = 0;
    if (totalPathCells > 0) {
      const ratio = correctEdges / totalPathCells;
      if (ratio >= 0.8) gq3 += 6;
      else if (ratio >= 0.6) gq3 += 4;
      else if (ratio >= 0.3) gq3 += 2;
    }
    granularScore += Math.min(6, gq3);
    details.push(`Path edges: ${correctEdges}/${totalPathCells} correct → ${Math.min(6, gq3)}/6`);
  }

  // ── GQ4: Tree layering correctness (0-6) — canopy on foreground, trunk on objects
  {
    let correctLayers = 0, wrongLayers = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const fg = foreground[y * width + x];
        const obj = objects[y * width + x];
        // Canopy should be on foreground, NOT on objects
        if (CANOPY_TILES.has(fg)) correctLayers++;
        if (CANOPY_TILES.has(obj)) wrongLayers++; // canopy on wrong layer
        // Trunk should be on objects, NOT on foreground
        if (TRUNK_TILES.has(obj)) correctLayers++;
        if (TRUNK_TILES.has(fg)) wrongLayers++; // trunk on wrong layer
      }
    }
    let gq4 = 0;
    if (correctLayers + wrongLayers > 0) {
      const ratio = correctLayers / (correctLayers + wrongLayers);
      if (ratio >= 0.95) gq4 += 6;
      else if (ratio >= 0.8) gq4 += 4;
      else if (ratio >= 0.5) gq4 += 2;
    } else if (correctLayers === 0 && wrongLayers === 0) {
      gq4 += 3; // no trees = neutral
    }
    granularScore += Math.min(6, gq4);
    details.push(`Tree layers: ${correctLayers} correct, ${wrongLayers} wrong → ${Math.min(6, gq4)}/6`);
  }

  // ── GQ5: Village "feel" metrics (0-8) — things that make it feel like a real village
  {
    let gq5 = 0;

    // Has a well or fountain (centerpiece)
    let hasWell = false;
    for (let i = 0; i < width * height; i++) {
      if (objects[i] === 92 || objects[i] === 104) { hasWell = true; break; }
    }
    if (hasWell) gq5 += 2;

    // Has cobblestone area (village square)
    let cobbleCount = 0;
    for (let i = 0; i < width * height; i++) {
      if (ground[i] === 44 || ground[i] === 45) cobbleCount++;
    }
    if (cobbleCount >= 12) gq5 += 2; // proper square
    else if (cobbleCount >= 4) gq5 += 1;

    // Mix of building materials (wood + stone)
    let hasWood = false, hasStone = false;
    for (let i = 0; i < width * height; i++) {
      if (objects[i] >= 72 && objects[i] <= 75) hasWood = true;
      if (objects[i] >= 84 && objects[i] <= 87) hasStone = true;
    }
    if (hasWood && hasStone) gq5 += 2;
    else if (hasWood || hasStone) gq5 += 1;

    // Has lanterns or barrels (lived-in feel)
    let hasLantern = false, hasBarrel = false;
    for (let i = 0; i < width * height; i++) {
      if (objects[i] === 93) hasLantern = true;
      if (objects[i] === 107) hasBarrel = true;
    }
    if (hasLantern && hasBarrel) gq5 += 2;
    else if (hasLantern || hasBarrel) gq5 += 1;

    granularScore += Math.min(8, gq5);
    details.push(`Village feel: well=${hasWell} cobble=${cobbleCount} materials=${hasWood?'wood':''}${hasStone?'+stone':''} lantern=${hasLantern} barrel=${hasBarrel} → ${Math.min(8, gq5)}/8`);
  }

  // ── GQ6: Adjacency rule compliance (0-8) — tiles follow learned relationships
  {
    let gq6 = 0;
    // Check roof→wall adjacency is correct type
    let roofWallTypeMatch = 0, roofWallTypeTotal = 0;
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width; x++) {
        const roof = objects[y * width + x];
        const wall = objects[(y + 1) * width + x];
        if (!BUILDING_ROOF_TILES.has(roof) || !WALL_TILES.has(wall)) continue;
        roofWallTypeTotal++;
        // Red roof (63-65,67) should have wood walls (72-75) or stone walls (84-87)
        // Blue roof (51-53,55) should have blue walls (48-50)
        if ((roof >= 63 && roof <= 67) && ((wall >= 72 && wall <= 75) || (wall >= 84 && wall <= 87))) roofWallTypeMatch++;
        else if ((roof >= 51 && roof <= 55) && (wall >= 48 && wall <= 50)) roofWallTypeMatch++;
      }
    }
    if (roofWallTypeTotal > 0) {
      const ratio = roofWallTypeMatch / roofWallTypeTotal;
      if (ratio >= 0.9) gq6 += 4;
      else if (ratio >= 0.5) gq6 += 2;
    }

    // Check fence ends: first fence in a row should be left-end (96/99), last should be right-end (98/101)
    let correctFenceEnds = 0, totalFenceRows = 0;
    for (let y = 0; y < height; y++) {
      let rowFences = [];
      for (let x = 0; x < width; x++) {
        if (FENCE_TILES.has(objects[y * width + x])) rowFences.push({ x, tile: objects[y * width + x] });
      }
      if (rowFences.length >= 2) {
        totalFenceRows++;
        const first = rowFences[0].tile;
        const last = rowFences[rowFences.length - 1].tile;
        if ((first === 96 || first === 99) && (last === 98 || last === 101)) correctFenceEnds++;
      }
    }
    if (totalFenceRows > 0 && correctFenceEnds === totalFenceRows) gq6 += 4;
    else if (totalFenceRows > 0 && correctFenceEnds > 0) gq6 += 2;

    granularScore += Math.min(8, gq6);
    details.push(`Adjacency rules: ${roofWallTypeMatch}/${roofWallTypeTotal} roof→wall type match, ${correctFenceEnds}/${totalFenceRows} fence ends correct → ${Math.min(8, gq6)}/8`);
  }

  // ── GQ7: Empty space quality (0-4) — no large barren areas, but also not overcrowded
  {
    let gq7 = 0;
    // Check for large empty rectangles (>8x8 with nothing but grass)
    let largeEmptyAreas = 0;
    const SAMPLE_SIZE = 8;
    for (let sy = 0; sy < height - SAMPLE_SIZE; sy += 4) {
      for (let sx = 0; sx < width - SAMPLE_SIZE; sx += 4) {
        let allEmpty = true;
        for (let y = sy; y < sy + SAMPLE_SIZE && allEmpty; y++) {
          for (let x = sx; x < sx + SAMPLE_SIZE && allEmpty; x++) {
            if (objects[y * width + x] !== -1 || foreground[y * width + x] !== -1 || PATH_TILES.has(ground[y * width + x])) {
              allEmpty = false;
            }
          }
        }
        if (allEmpty) largeEmptyAreas++;
      }
    }
    if (largeEmptyAreas <= 2) gq7 += 4; // minimal dead zones
    else if (largeEmptyAreas <= 5) gq7 += 2;
    granularScore += Math.min(4, gq7);
    details.push(`Empty space: ${largeEmptyAreas} barren 8x8 areas → ${Math.min(4, gq7)}/4`);
  }

  // ── GQ8: Water feature quality (0-4) — if water exists, it has proper edges
  {
    let gq8 = 0;
    let waterCenters = 0, waterEdges = 0;
    for (let i = 0; i < width * height; i++) {
      if (objects[i] === 122) waterCenters++;
      if (WATER_TILES.has(objects[i]) && objects[i] !== 122) waterEdges++;
    }
    if (waterCenters > 0 && waterEdges > 0) gq8 += 4; // water with edges = good
    else if (waterCenters === 0) gq8 += 2; // no water = neutral
    granularScore += Math.min(4, gq8);
    details.push(`Water: ${waterCenters} center, ${waterEdges} edge tiles → ${Math.min(4, gq8)}/4`);
  }

  const totalDesign = designScore + granularScore;
  return { designScore: Math.min(100, totalDesign), details };
}

// ── Main audit function ────────────────────────────────────────────────────────

/**
 * Audit a generated map against all validation rules.
 *
 * @param {Object} mapData - Map data with width, height, ground, objects, foreground, collision
 * @returns {Object} Audit result with score, passed, violations, summary, designScore, designDetails
 */
function auditMap(mapData) {
  const violations = [];

  // Run all 13 structural rules, collecting non-null violations
  const checks = [
    // Critical rules
    checkGroundFill,
    checkCanopyTrunk,
    checkTrunkCanopy,
    checkRoofWall,
    checkNoDeprecated,
    checkDoorPath,
    // Major rules
    checkWalkableRatio,
    checkBuildingSpacing,
    checkWaterEdges,
    checkPathConnectivity,
    // Minor rules
    checkGrassVariety,
    checkObjectDensity,
    checkTreeVariety
  ];

  for (const check of checks) {
    const result = check(mapData);
    if (result !== null) {
      violations.push(result);
    }
  }

  // ── Design Quality Score (0-100) ─────────────────────────────────────
  const { designScore, details: designDetails } = scoreDesignQuality(mapData);

  // ── Structural violations (deductions from design score) ───────────
  const SEVERITY_COST = { critical: 5, major: 2, minor: 1 };

  let deductions = 0;
  let criticalCount = 0;
  let majorCount = 0;
  let minorCount = 0;

  for (const v of violations) {
    const cost = SEVERITY_COST[v.severity] || 0;
    deductions += cost * v.count;
    if (v.severity === 'critical') criticalCount += v.count;
    else if (v.severity === 'major') majorCount += v.count;
    else minorCount += v.count;
  }

  // Score = design quality (0-100) minus structural violations
  const structuralScore = Math.max(0, 50 - deductions); // legacy compat
  const score = Math.max(0, Math.min(100, designScore - deductions));

  let hasCriticalOverflow = false;
  for (const v of violations) {
    if (v.severity === 'critical' && v.count > 5) { hasCriticalOverflow = true; break; }
  }
  const passed = score >= 30 && !hasCriticalOverflow;

  const summaryParts = [`Score ${score}/100 (design: ${designScore}, deductions: -${deductions}).`];
  if (criticalCount > 0) summaryParts.push(`${criticalCount} critical`);
  if (majorCount > 0) summaryParts.push(`${majorCount} major`);
  if (minorCount > 0) summaryParts.push(`${minorCount} minor`);
  if (criticalCount + majorCount + minorCount === 0) summaryParts.push('No structural violations.');
  else summaryParts.push(`violation${(criticalCount + majorCount + minorCount) > 1 ? 's' : ''}.`);
  if (hasCriticalOverflow) summaryParts.push('FAILED: critical rule exceeded 5 violations.');

  return {
    score,
    structuralScore,
    designScore,
    designDetails,
    passed,
    violations,
    summary: summaryParts.join(' ')
  };
}

// ── Export ──────────────────────────────────────────────────────────────────────

module.exports = { auditMap };
