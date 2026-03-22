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

// ── Main audit function ────────────────────────────────────────────────────────

/**
 * Audit a generated map against all validation rules.
 *
 * @param {Object} mapData - Map data with width, height, ground, objects, foreground, collision
 * @returns {Object} Audit result with score, passed, violations, summary
 */
function auditMap(mapData) {
  const violations = [];

  // Run all 13 rules, collecting non-null violations
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

  // ── Scoring ──────────────────────────────────────────────────────────────
  // Deductions per severity:
  //   critical: -10 per violation count
  //   major:    -3  per violation count
  //   minor:    -1  per violation count

  const SEVERITY_COST = { critical: 10, major: 3, minor: 1 };

  let score = 100;
  let criticalCount = 0;
  let majorCount = 0;
  let minorCount = 0;

  for (const v of violations) {
    const cost = SEVERITY_COST[v.severity] || 0;
    score -= cost * v.count;

    if (v.severity === 'critical') criticalCount += v.count;
    else if (v.severity === 'major') majorCount += v.count;
    else minorCount += v.count;
  }

  // Cap score at 0 minimum
  score = Math.max(0, score);

  // Fail if score < 60 OR any single critical rule has count > 5
  let hasCriticalOverflow = false;
  for (const v of violations) {
    if (v.severity === 'critical' && v.count > 5) {
      hasCriticalOverflow = true;
      break;
    }
  }

  const passed = score >= 60 && !hasCriticalOverflow;

  // Build summary
  const summaryParts = [`Score ${score}/100.`];
  if (criticalCount > 0) summaryParts.push(`${criticalCount} critical`);
  if (majorCount > 0) summaryParts.push(`${majorCount} major`);
  if (minorCount > 0) summaryParts.push(`${minorCount} minor`);

  if (criticalCount === 0 && majorCount === 0 && minorCount === 0) {
    summaryParts.push('No violations.');
  } else {
    summaryParts.push(
      `violation${(criticalCount + majorCount + minorCount) > 1 ? 's' : ''}.`
    );
  }

  if (hasCriticalOverflow) {
    summaryParts.push('FAILED: critical rule exceeded 5 violations.');
  }

  return {
    score,
    passed,
    violations,
    summary: summaryParts.join(' ')
  };
}

// ── Export ──────────────────────────────────────────────────────────────────────

module.exports = { auditMap };
