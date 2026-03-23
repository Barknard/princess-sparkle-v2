/**
 * v2-scorer.js — Consolidated map quality scorer for V2 map trainer
 *
 * Returns a detailed breakdown with 0-100 total score across 8 dimensions.
 * Violations are reported separately — they do NOT wipe out dimension scores.
 *
 * Scoring dimensions (100 total):
 *   Path Network:    0-10    Ground Texture: 0-10
 *   Buildings:       0-10    Composition:    0-10
 *   Tree Quality:    0-10    Water Feature:  0-5
 *   Decorations:     0-10    Village Feel:   0-5
 *   Tile Match:      0-30 (only when target provided)
 */
// Tile ID Sets
const PATH_TILES = new Set([39, 40, 41]);
const COBBLE_TILES = new Set([44, 45]);
const GRASS_TILES = new Set([1, 2, 43]);
const ROOF_TILES = new Set([63, 64, 65, 66, 67]);
const WALL_TILES = new Set();
for (let i = 72; i <= 87; i++) WALL_TILES.add(i);
const DOOR_TILES = new Set([74, 86]);
const FENCE_TILES = new Set([96, 97, 98]);
const CANOPY_TILES = new Set([4, 5, 7, 8, 10, 11]);
const TRUNK_TILES = new Set([12, 13, 22, 23, 24, 25]);
const SMALL_TREES = new Set([6, 9, 16, 17]);
const DECO_TILES = new Set([15, 18, 19, 28, 29, 107, 93]);
const WATER_TILES = new Set([109, 110, 111, 112, 113, 120, 121, 122, 123]);
const WATER_EDGE = new Set([109, 110, 111, 112, 113, 120, 121, 123]);
const WELL_TILES = new Set([92, 104]);
const LANTERN_BARREL = new Set([93, 107]);

class V2Scorer {
  constructor(targetMap) {
    this.target = targetMap || null;
  }

  /** Score a generated map. Returns { total, tileMatch, design, breakdown, violations, details } */
  score(mapData) {
    const W = mapData.width;
    const H = mapData.height;
    const size = W * H;
    const ground = mapData.ground || [];
    const objects = mapData.objects || [];
    const foreground = mapData.foreground || [];
    const breakdown = {};
    const violations = [];
    const details = [];
    breakdown.pathNetwork = this._scorePaths(ground, W, H, details, violations);
    breakdown.buildings = this._scoreBuildings(ground, objects, W, H, details, violations);
    breakdown.treeQuality = this._scoreTrees(objects, foreground, W, H, details, violations);
    breakdown.decorations = this._scoreDecorations(objects, W, H, details);
    breakdown.groundTexture = this._scoreGround(ground, W, H, details);
    breakdown.composition = this._scoreComposition(ground, objects, W, H, details);
    breakdown.waterFeature = this._scoreWater(objects, W, H, details);
    breakdown.villageFeel = this._scoreVillageFeel(ground, objects, W, H, details);
    let tileMatch = 0;
    if (this.target) {
      tileMatch = this._scoreTileMatch(mapData, this.target);
      details.push(`Tile match: ${tileMatch.toFixed(1)}% → ${(tileMatch * 0.3).toFixed(1)}/30 pts`);
    }

    const designScore = breakdown.pathNetwork + breakdown.buildings +
      breakdown.treeQuality + breakdown.decorations + breakdown.groundTexture +
      breakdown.composition + breakdown.waterFeature + breakdown.villageFeel;
    const tileMatchPts = this.target ? tileMatch * 0.3 : 0;
    const maxDesign = this.target ? 70 : 100;
    const scaledDesign = this.target ? designScore : (designScore / 70 * 100);
    const total = this.target
      ? Math.min(100, Math.round(designScore + tileMatchPts))
      : Math.min(100, Math.round(scaledDesign));
    return {
      total,
      tileMatch: this.target ? +tileMatch.toFixed(1) : null,
      design: Math.round(designScore),
      breakdown,
      violations,
      details,
    };
  }

  _scorePaths(ground, W, H, details, violations) {
    let pathCount = 0;
    let edgeCorrect = 0;
    let edgeTotal = 0;
    let twoWide = 0;
    let twoWideChecks = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = ground[y * W + x];
        if (!PATH_TILES.has(t)) continue;
        pathCount++;
        // Check 2-wide: if this is path, is the tile below also path?
        if (y + 1 < H) {
          twoWideChecks++;
          if (PATH_TILES.has(ground[(y + 1) * W + x])) twoWide++;
        }

        // Edge tile correctness: left edge should be 39, right edge should be 41
        const leftIsPath = x > 0 && PATH_TILES.has(ground[y * W + x - 1]);
        const rightIsPath = x + 1 < W && PATH_TILES.has(ground[y * W + x + 1]);
        if (!leftIsPath || !rightIsPath) {
          edgeTotal++;
          if ((!leftIsPath && t === 39) || (!rightIsPath && t === 41)) edgeCorrect++;
          else if (leftIsPath && rightIsPath && t === 40) edgeCorrect++;
        }
      }
    }

    const coverage = pathCount / (W * H);
    let score = 0;
    if (coverage >= 0.05 && coverage <= 0.15) score += 3;
    else if (coverage >= 0.02 && coverage <= 0.25) score += 1;
    details.push(`Path coverage: ${(coverage * 100).toFixed(1)}%`);
    // 2-wide paths
    const twoWideRatio = twoWideChecks > 0 ? twoWide / twoWideChecks : 0;
    score += Math.min(3, Math.round(twoWideRatio * 4));
    const edgeRatio = edgeTotal > 0 ? edgeCorrect / edgeTotal : 1;
    score += Math.min(2, Math.round(edgeRatio * 2));
    if (pathCount > 0) {
      const connected = this._floodCount(ground, W, H, PATH_TILES);
      const connectRatio = connected / pathCount;
      score += connectRatio > 0.8 ? 2 : (connectRatio > 0.5 ? 1 : 0);
      if (connectRatio < 0.5) violations.push(`Path network fragmented: only ${(connectRatio * 100).toFixed(0)}% connected`);
    }

    if (pathCount === 0) violations.push('No path tiles found');
    return Math.min(10, score);
  }

  _scoreBuildings(ground, objects, W, H, details, violations) {
    const buildings = [];
    const visited = new Set();
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        if (visited.has(`${x},${y}`)) continue;
        if (!ROOF_TILES.has(objects[y * W + x])) continue;
        // Scan roof width
        let endX = x;
        while (endX + 1 < W && ROOF_TILES.has(objects[y * W + endX + 1])) endX++;
        const bw = endX - x + 1;
        // Mark visited
        for (let dx = 0; dx < bw; dx++) visited.add(`${x + dx},${y}`);
        // Check wall below
        let hasWall = true;
        let hasDoor = false;
        for (let dx = 0; dx < bw; dx++) {
          const wt = objects[(y + 1) * W + x + dx];
          if (!WALL_TILES.has(wt)) hasWall = false;
          if (DOOR_TILES.has(wt)) hasDoor = true;
        }

        buildings.push({ x, y, w: bw, hasWall, hasDoor });
      }
    }

    details.push(`Buildings found: ${buildings.length}`);
    if (buildings.length === 0) { violations.push('No buildings found'); return 0; }

    let score = 0;
    if (buildings.length >= 2 && buildings.length <= 6) score += 2;
    else if (buildings.length >= 1) score += 1;
    const structurallySound = buildings.filter(b => b.hasWall).length;
    score += Math.min(3, Math.round((structurallySound / buildings.length) * 3));
    if (structurallySound < buildings.length) {
      violations.push(`${buildings.length - structurallySound} buildings missing walls below roof`);
    }

    const withDoors = buildings.filter(b => b.hasDoor).length;
    score += Math.min(2, Math.round((withDoors / buildings.length) * 2));
    let doorsNearPath = 0;
    for (const b of buildings) {
      if (!b.hasDoor) continue;
      let nearPath = false;
      for (let dy = 1; dy <= 5; dy++) {
        for (let dx = -1; dx <= b.w; dx++) {
          const px = b.x + dx, py = b.y + 1 + dy;
          if (px >= 0 && px < W && py >= 0 && py < H) {
            if (PATH_TILES.has(ground[py * W + px])) { nearPath = true; break; }
          }
        }
        if (nearPath) break;
      }
      if (nearPath) doorsNearPath++;
    }
    score += doorsNearPath >= withDoors * 0.7 ? 2 : (doorsNearPath > 0 ? 1 : 0);
    const widths = new Set(buildings.map(b => b.w));
    score += widths.size >= 2 ? 1 : 0;
    return Math.min(10, score);
  }

  _scoreTrees(objects, foreground, W, H, details, violations) {
    let canopyCount = 0, trunkCount = 0, smallTreeCount = 0;
    let canopyAboveTrunk = 0;
    const treeTypes = new Set();
    for (let i = 0; i < foreground.length; i++) {
      if (CANOPY_TILES.has(foreground[i])) {
        canopyCount++;
        const tid = foreground[i];
        if (tid === 4 || tid === 5) treeTypes.add('green');
        if (tid === 7 || tid === 8) treeTypes.add('autumn');
        if (tid === 10 || tid === 11) treeTypes.add('pine');
      }
    }
    for (let i = 0; i < objects.length; i++) {
      if (TRUNK_TILES.has(objects[i])) trunkCount++;
      if (SMALL_TREES.has(objects[i])) smallTreeCount++;
    }

    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        if (CANOPY_TILES.has(foreground[y * W + x]) && TRUNK_TILES.has(objects[(y + 1) * W + x])) {
          canopyAboveTrunk++;
        }
      }
    }

    const totalTrees = trunkCount + smallTreeCount;
    details.push(`Trees: ${totalTrees} (${trunkCount} trunks, ${canopyCount} canopies, ${smallTreeCount} small)`);
    let score = 0;
    if (totalTrees >= 20) score += 3;
    else if (totalTrees >= 8) score += 2;
    else if (totalTrees >= 3) score += 1;
    score += Math.min(2, treeTypes.size);
    const pairRatio = trunkCount > 0 ? canopyAboveTrunk / trunkCount : 0;
    score += pairRatio > 0.6 ? 2 : (pairRatio > 0.3 ? 1 : 0);
    let borderTrees = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const borderDist = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (borderDist < 4 && (TRUNK_TILES.has(objects[y * W + x]) || CANOPY_TILES.has(foreground[y * W + x]))) {
          borderTrees++;
        }
      }
    }
    score += borderTrees >= 20 ? 2 : (borderTrees >= 8 ? 1 : 0);
    let interiorTrees = 0;
    for (let y = 5; y < H - 5; y++) {
      for (let x = 5; x < W - 5; x++) {
        if (TRUNK_TILES.has(objects[y * W + x])) interiorTrees++;
      }
    }
    score += interiorTrees >= 4 ? 1 : 0;
    if (totalTrees === 0) violations.push('No trees found');
    return Math.min(10, score);
  }

  _scoreDecorations(objects, W, H, details) {
    let decoCount = 0;
    let fenceRuns = 0;
    let inFence = false;
    const decoTypes = new Set();
    for (let i = 0; i < objects.length; i++) {
      if (DECO_TILES.has(objects[i])) { decoCount++; decoTypes.add(objects[i]); }
      if (FENCE_TILES.has(objects[i])) {
        if (!inFence) { fenceRuns++; inFence = true; }
      } else {
        inFence = false;
      }
    }

    details.push(`Decorations: ${decoCount} items, ${decoTypes.size} types, ${fenceRuns} fence runs`);
    let score = 0;
    if (decoCount >= 10) score += 3;
    else if (decoCount >= 4) score += 2;
    else if (decoCount >= 1) score += 1;
    score += Math.min(3, decoTypes.size); // variety
    score += Math.min(2, fenceRuns); // fence runs
    score += decoCount > 0 && fenceRuns > 0 ? 2 : 0; // both present
    return Math.min(10, score);
  }

  _scoreGround(ground, W, H, details) {
    const counts = {};
    for (const t of ground) {
      if (GRASS_TILES.has(t)) counts[t] = (counts[t] || 0) + 1;
    }
    const totalGrass = Object.values(counts).reduce((s, c) => s + c, 0);
    if (totalGrass === 0) { details.push('No grass tiles'); return 0; }

    const ratios = {};
    for (const [t, c] of Object.entries(counts)) ratios[t] = c / totalGrass;
    details.push(`Grass mix: plain=${(ratios[1] || 0).toFixed(2)} flowers=${(ratios[2] || 0).toFixed(2)} white=${(ratios[43] || 0).toFixed(2)}`);
    let score = 0;
    const grassTypes = Object.keys(counts).length;
    score += Math.min(3, grassTypes * 1.5);
    const maxRatio = Math.max(...Object.values(ratios));
    if (maxRatio < 0.8) score += 2;
    else if (maxRatio < 0.9) score += 1;
    let maxRun = 0;
    for (let y = 0; y < H; y++) {
      let run = 1;
      for (let x = 1; x < W; x++) {
        if (ground[y * W + x] === ground[y * W + x - 1] && GRASS_TILES.has(ground[y * W + x])) {
          run++;
          maxRun = Math.max(maxRun, run);
        } else {
          run = 1;
        }
      }
    }
    if (maxRun < 10) score += 3;
    else if (maxRun < 20) score += 2;
    else if (maxRun < 30) score += 1;
    details.push(`Max grass run: ${maxRun}`);
    const coverage = totalGrass / (W * H);
    score += (coverage >= 0.4 && coverage <= 0.85) ? 2 : 1;
    return Math.min(10, score);
  }

  _scoreComposition(ground, objects, W, H, details) {
    const qw = Math.floor(W / 2), qh = Math.floor(H / 2);
    const quadrants = [
      { x: 0, y: 0, w: qw, h: qh },
      { x: qw, y: 0, w: W - qw, h: qh },
      { x: 0, y: qh, w: qw, h: H - qh },
      { x: qw, y: qh, w: W - qw, h: H - qh },
    ];
    let activeQuadrants = 0;
    for (const q of quadrants) {
      let hasContent = false;
      for (let dy = 0; dy < q.h && !hasContent; dy++) {
        for (let dx = 0; dx < q.w && !hasContent; dx++) {
          const i = (q.y + dy) * W + (q.x + dx);
          if (objects[i] !== -1 || PATH_TILES.has(ground[i]) || COBBLE_TILES.has(ground[i])) {
            hasContent = true;
          }
        }
      }
      if (hasContent) activeQuadrants++;
    }

    details.push(`Active quadrants: ${activeQuadrants}/4`);
    let score = 0;
    score += activeQuadrants * 2; // 0-8 pts for quadrant activity
    const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
    let centerActivity = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const i = (cy + dy) * W + (cx + dx);
        if (i >= 0 && i < W * H) {
          if (PATH_TILES.has(ground[i]) || COBBLE_TILES.has(ground[i]) || objects[i] !== -1) {
            centerActivity++;
          }
        }
      }
    }
    score += centerActivity > 10 ? 2 : (centerActivity > 3 ? 1 : 0);
    return Math.min(10, score);
  }

  _scoreWater(objects, W, H, details) {
    let waterCount = 0;
    let edgeCount = 0;
    let centerCount = 0;
    for (const t of objects) {
      if (WATER_TILES.has(t)) {
        waterCount++;
        if (t === 122) centerCount++;
        else edgeCount++;
      }
    }

    if (waterCount === 0) { details.push('No water feature'); return 0; }
    details.push(`Water: ${waterCount} tiles (${edgeCount} edge, ${centerCount} center)`);
    let score = 0;
    score += waterCount >= 6 ? 2 : 1; // Size
    score += edgeCount > 0 && centerCount > 0 ? 2 : (edgeCount > 0 ? 1 : 0); // Proper edges
    score += waterCount >= 9 ? 1 : 0; // Full 3x3 minimum
    return Math.min(5, score);
  }

  _scoreVillageFeel(ground, objects, W, H, details) {
    let hasWell = false, hasCobble = false, hasLantern = false, hasBarrel = false;
    let materialTypes = new Set(); // wood vs stone buildings
    for (let i = 0; i < objects.length; i++) {
      if (WELL_TILES.has(objects[i])) hasWell = true;
      if (LANTERN_BARREL.has(objects[i])) {
        if (objects[i] === 93) hasLantern = true;
        if (objects[i] === 107) hasBarrel = true;
      }
      if (objects[i] >= 72 && objects[i] <= 75) materialTypes.add('wood');
      if (objects[i] >= 84 && objects[i] <= 87) materialTypes.add('stone');
    }
    for (const t of ground) {
      if (COBBLE_TILES.has(t)) { hasCobble = true; break; }
    }

    const features = [hasWell, hasCobble, hasLantern || hasBarrel, materialTypes.size >= 2];
    const featureCount = features.filter(Boolean).length;
    details.push(`Village features: well=${hasWell} cobble=${hasCobble} lantern=${hasLantern} barrel=${hasBarrel} materials=${materialTypes.size}`);
    let score = 0;
    score += hasWell ? 1 : 0;
    score += hasCobble ? 1 : 0;
    score += (hasLantern || hasBarrel) ? 1 : 0;
    score += materialTypes.size >= 2 ? 1 : 0;
    score += featureCount >= 3 ? 1 : 0; // bonus for having most features
    return Math.min(5, score);
  }

  _scoreTileMatch(generated, target) {
    let matches = 0;
    let total = 0;
    const layers = ['ground', 'objects', 'foreground'];
    for (const layer of layers) {
      const gen = generated[layer] || [];
      const tgt = target[layer] || [];
      const len = Math.min(gen.length, tgt.length);
      for (let i = 0; i < len; i++) {
        total++;
        if (gen[i] === tgt[i]) matches++;
      }
    }

    return total > 0 ? (matches / total) * 100 : 0;
  }

  /** Flood fill — returns size of largest connected component of matching tiles. */
  _floodCount(layer, W, H, tileSet) {
    const visited = new Set();
    let maxComponent = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!tileSet.has(layer[y * W + x])) continue;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        // BFS from this tile
        const queue = [[x, y]];
        let size = 0;
        visited.add(key);
        while (queue.length > 0) {
          const [cx, cy] = queue.shift();
          size++;
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            const nk = `${nx},${ny}`;
            if (visited.has(nk)) continue;
            if (!tileSet.has(layer[ny * W + nx])) continue;
            visited.add(nk);
            queue.push([nx, ny]);
          }
        }
        maxComponent = Math.max(maxComponent, size);
      }
    }
    return maxComponent;
  }
}

// ── Self-test ────────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('=== V2 Scorer Self-Test ===\n');
  const { V2Engine } = require('./v2-engine');
  const map = new V2Engine({ width: 60, height: 40 }).generate({}, 42);
  const scorer = new V2Scorer();
  const r = scorer.score(map);
  console.log(`Total: ${r.total}/100, Design: ${r.design}/70`);
  for (const [k, v] of Object.entries(r.breakdown)) console.log(`  ${k}: ${v}`);
  if (r.violations.length) console.log('Violations:', r.violations);
  for (const d of r.details) console.log(`  ${d}`);
  console.assert(r.total >= 0 && r.total <= 100, 'Score out of range');
  console.assert(r.tileMatch === null, 'tileMatch should be null without target');
  // Self-match should be 100%
  const sr = new V2Scorer(map).score(map);
  console.log(`\nSelf-match: ${sr.tileMatch}%`);
  console.assert(sr.tileMatch === 100, 'Self match should be 100%');
  // Empty map should score low
  const empty = { width: 60, height: 40, ground: new Array(2400).fill(-1), objects: new Array(2400).fill(-1), foreground: new Array(2400).fill(-1) };
  const er = scorer.score(empty);
  console.log(`Empty map: ${er.total}/100`);
  console.assert(er.total < 20, 'Empty map should score low');
  console.log('\nAll self-tests PASSED');
}

module.exports = { V2Scorer };
