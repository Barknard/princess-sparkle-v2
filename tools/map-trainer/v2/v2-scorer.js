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
// Tile ID Sets — calibrated to user's painted map tile vocabulary
// Paths: user uses 25 (cobblestone) + 13,14,24,36,37,38 as ground variation near paths
const PATH_TILES = new Set([25, 39, 40, 41, 13, 14, 24, 36, 37, 38]);
const COBBLE_TILES = new Set([25, 44, 45]);
const GRASS_TILES = new Set([0, 1, 2, 43]); // tile 0 (sparkle) is user's primary ground
// Roofs — catalog verified: red(63-65), blue(51-53), peak/chimney(55,67)
const ROOF_TILES = new Set([51, 52, 53, 55, 63, 64, 65, 67]);
// Mid-row overhang — brick(60-62), stone(48-50)
const MID_TILES = new Set([48, 49, 50, 60, 61, 62]);
// Walls — wood(72-75), dark stone(84-87), gray(76,79,81,82), stone arch(56-58,68)
const WALL_TILES = new Set([56, 57, 58, 68, 72, 73, 74, 75, 76, 79, 81, 82, 84, 85, 86, 87]);
// Doors — catalog: 74(Wood Door), 86(Dark Stone Door)
const DOOR_TILES = new Set([74, 86]);
// Fences — white(96-98), brown(99-101), post(108)
const FENCE_TILES = new Set([96, 97, 98, 99, 100, 101, 108]);
// Trees/vegetation — ALL on FOREGROUND layer (user's style)
// Canopy tops: green(4), pine(7), autumn(3), dark(6), bush-canopy(28,20)
const CANOPY_TILES = new Set([3, 4, 6, 7, 28, 20]);
// Trunk bottoms: green(16), pine(19), autumn(15), dark(18)
const TRUNK_TILES = new Set([15, 16, 18, 19]);
// Small standalone trees/bushes (no trunk needed)
const SMALL_TREES = new Set([17, 27, 31, 32, 34]);
// Decorations — user puts these on FOREGROUND layer, not objects
const DECO_TILES = new Set([3, 15, 18, 19, 20, 27, 28, 29, 31, 32, 34, 93, 102, 103, 107]);
const WATER_TILES = new Set([109, 110, 111, 112, 113, 120, 121, 122, 123, 124]);
const WATER_EDGE = new Set([109, 110, 111, 112, 113, 120, 121, 123]);
const WELL_TILES = new Set([92, 104]);
const LANTERN_BARREL = new Set([93, 94, 95, 102, 107]);
// ALL vegetation/decoration on foreground (user's layer choice)
const FG_VEGETATION = new Set([3, 4, 6, 7, 15, 16, 17, 18, 19, 20, 27, 28, 29, 31, 32, 34, 103]);

// Load tile catalog for tag-based validation
let TILE_CATALOG = null;
try {
  const catalogPath = require('path').join(__dirname, '..', '..', 'tools', 'tile-catalog.json');
  if (require('fs').existsSync(catalogPath)) {
    TILE_CATALOG = require(catalogPath).tiles;
  }
} catch (e) { /* catalog optional */ }

// Build lookup: tile ID → tags set
const TILE_TAGS = {};
if (TILE_CATALOG) {
  TILE_CATALOG.forEach(t => { TILE_TAGS[t.id] = new Set(t.tags || []); });
}

// Load learned adjacency rules for compliance scoring
let ADJACENCY_RULES = null;
try {
  const adjPath = require('path').join(__dirname, 'learned-knowledge-v2.json');
  if (require('fs').existsSync(adjPath)) {
    const knowledge = JSON.parse(require('fs').readFileSync(adjPath, 'utf8'));
    ADJACENCY_RULES = knowledge.adjacency || null;
  }
} catch (e) { /* adjacency rules optional */ }

class V2Scorer {
  constructor(targetMap) {
    this.target = targetMap || null;
    // Pre-compute target tile frequencies for JSD scoring
    if (targetMap) {
      this._targetFreqs = {};
      for (const layer of ['ground', 'objects', 'foreground']) {
        const freq = {};
        (targetMap[layer] || []).forEach(t => { if (t >= 0) freq[t] = (freq[t] || 0) + 1; });
        const sum = Object.values(freq).reduce((a, b) => a + b, 0) || 1;
        for (const k of Object.keys(freq)) freq[k] /= sum;
        this._targetFreqs[layer] = freq;
      }
      // Pre-compute target 2x2 patterns
      this._target2x2 = new Set();
      const W = targetMap.width;
      for (let y = 0; y < targetMap.height - 1; y++) {
        for (let x = 0; x < W - 1; x++) {
          for (const arr of [targetMap.ground, targetMap.objects, targetMap.foreground]) {
            if (!arr) continue;
            this._target2x2.add([arr[y*W+x], arr[y*W+x+1], arr[(y+1)*W+x], arr[(y+1)*W+x+1]].join(','));
          }
        }
      }
    }
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
    breakdown.buildings = this._scoreBuildings(ground, objects, foreground, W, H, details, violations);
    breakdown.treeQuality = this._scoreTrees(objects, foreground, W, H, details, violations);
    breakdown.decorations = this._scoreDecorations(objects, foreground, W, H, details);
    breakdown.groundTexture = this._scoreGround(ground, W, H, details);
    breakdown.composition = this._scoreComposition(ground, objects, foreground, W, H, details);
    breakdown.waterFeature = this._scoreWater(objects, W, H, details);
    breakdown.villageFeel = this._scoreVillageFeel(ground, objects, foreground, W, H, details);

    // Best practice: adjacency compliance + frequency match + pattern coverage
    if (this.target) {
      breakdown.freqMatch = this._scoreFrequencyMatch(ground, objects, foreground, W, H, details);
      breakdown.patternCoverage = this._scorePatternCoverage(ground, objects, foreground, W, H, details);
    }
    if (ADJACENCY_RULES) {
      breakdown.adjCompliance = this._scoreAdjacencyCompliance(ground, W, H, details);
    }

    let tileMatch = 0;
    if (this.target) {
      tileMatch = this._scoreTileMatch(mapData, this.target);
      details.push(`Tile match: ${tileMatch.toFixed(1)}%`);
    }

    const designScore = breakdown.pathNetwork + breakdown.buildings +
      breakdown.treeQuality + breakdown.decorations + breakdown.groundTexture +
      breakdown.composition + breakdown.waterFeature + breakdown.villageFeel +
      (breakdown.freqMatch || 0) + (breakdown.patternCoverage || 0) + (breakdown.adjCompliance || 0);
    const tileMatchPts = this.target ? tileMatch * 0.2 : 0; // reduced from 0.3 since freq+pattern cover some of this
    const total = this.target
      ? Math.min(100, Math.round(designScore + tileMatchPts))
      : Math.min(100, Math.round(designScore / 85 * 100));
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

  _scoreBuildings(ground, objects, foreground, W, H, details, violations) {
    // Material sets for consistency checking
    const RED_SET = new Set([48,49,50,60,62,63,72,75,85,80]);
    const GRAY_SET = new Set([52,53,54,64,65,66,67,76,79,88,89,57]);
    const BLUE_SET = new Set([51,55,61,84]);
    const CASTLE_SET = new Set([92,96,98,102,104,111,112,120,122,123,124]);
    const STONE_SET = new Set([44,45,56,57,68,81,82,94]);
    const DOOR_SET = new Set([57, 80, 82, 94]);

    // Flood-fill to find connected object structures
    const buildings = [];
    const visited = new Set();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = `${x},${y}`;
        if (visited.has(k)) continue;
        const t = objects[y * W + x];
        if (t < 0) continue;
        const tiles = [];
        const queue = [{ x, y }];
        let minX = W, maxX = 0, minY = H, maxY = 0;
        while (queue.length) {
          const { x: cx, y: cy } = queue.shift();
          const kk = `${cx},${cy}`;
          if (visited.has(kk) || cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
          const tt = objects[cy * W + cx];
          if (tt < 0) continue;
          visited.add(kk);
          tiles.push({ x: cx, y: cy, tile: tt });
          minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
          queue.push({ x: cx + 1, y: cy }, { x: cx - 1, y: cy }, { x: cx, y: cy + 1 }, { x: cx, y: cy - 1 });
        }
        if (tiles.length >= 3) {
          buildings.push({ minX, minY, maxX, maxY, tiles, w: maxX - minX + 1, h: maxY - minY + 1 });
        }
      }
    }

    details.push(`Buildings found: ${buildings.length}`);
    if (buildings.length === 0) { violations.push('No buildings found'); return 0; }

    let score = 0;
    // Count
    if (buildings.length >= 2 && buildings.length <= 8) score += 2;
    else if (buildings.length >= 1) score += 1;

    // Structural validation per building
    let soundCount = 0, materialConsistent = 0, doorClearCount = 0, roofOnTopCount = 0;
    for (const b of buildings) {
      const tileIds = b.tiles.map(t => t.tile).filter(t => t < 200); // skip custom tiles for material check
      const topRowTiles = b.tiles.filter(t => t.y === b.minY).map(t => t.tile);
      const botRowTiles = b.tiles.filter(t => t.y === b.maxY).map(t => t.tile);

      // Rule 1: Roof tiles should be on TOP row, wall/base on bottom
      const roofOnTop = topRowTiles.some(t => ROOF_TILES.has(t) || CASTLE_SET.has(t));
      const wallOnBot = botRowTiles.some(t => WALL_TILES.has(t) || CASTLE_SET.has(t) || t >= 200);
      if (roofOnTop && wallOnBot) { soundCount++; roofOnTopCount++; }
      else if (b.h === 1) soundCount++; // fences are 1-tall, always valid

      // Rule 2: Material consistency — don't mix red roof with gray walls
      const matCounts = { red: 0, gray: 0, blue: 0, castle: 0, stone: 0 };
      for (const tid of tileIds) {
        if (RED_SET.has(tid)) matCounts.red++;
        if (GRAY_SET.has(tid)) matCounts.gray++;
        if (BLUE_SET.has(tid)) matCounts.blue++;
        if (CASTLE_SET.has(tid)) matCounts.castle++;
        if (STONE_SET.has(tid)) matCounts.stone++;
      }
      const mats = Object.entries(matCounts).filter(([, c]) => c > 0);
      // Allow stone to mix with anything (fences attach to buildings)
      const nonStoneMats = mats.filter(([k]) => k !== 'stone');
      if (nonStoneMats.length <= 1) materialConsistent++;
      else if (nonStoneMats.length === 2) {
        // Red+blue is OK (user's painted map has this), red+gray is bad
        const matNames = nonStoneMats.map(([k]) => k);
        if (matNames.includes('red') && matNames.includes('gray')) {
          violations.push(`Mixed materials at (${b.minX},${b.minY}): red+gray`);
        } else {
          materialConsistent++; // other combos are OK
        }
      }

      // Rule 3: Doors at ground level with clear exit below
      const doors = b.tiles.filter(t => DOOR_SET.has(t.tile));
      for (const door of doors) {
        let clear = true;
        for (let dy = 1; dy <= 2; dy++) {
          const by = door.y + dy;
          if (by >= H) continue;
          const bi = by * W + door.x;
          if (objects[bi] >= 0 || (foreground[bi] >= 0 && !SMALL_TREES.has(foreground[bi]))) {
            clear = false;
          }
        }
        if (clear) doorClearCount++;
        else violations.push(`Blocked door at (${door.x},${door.y})`);
      }
    }

    // Scoring
    score += Math.min(2, Math.round((soundCount / buildings.length) * 2));
    score += Math.min(2, Math.round((materialConsistent / buildings.length) * 2));
    if (soundCount < buildings.length) {
      violations.push(`${buildings.length - soundCount}/${buildings.length} buildings have structural issues (roof not on top or walls missing)`);
    }

    // Door accessibility to paths
    let doorsTotal = 0, doorsNearPath = 0;
    for (const b of buildings) {
      const doors = b.tiles.filter(t => DOOR_SET.has(t.tile));
      doorsTotal += doors.length;
      for (const door of doors) {
        for (let dy = 1; dy <= 3; dy++) {
          const py = door.y + dy;
          if (py >= 0 && py < H && PATH_TILES.has(ground[py * W + door.x])) { doorsNearPath++; break; }
        }
      }
    }
    score += doorsNearPath > 0 ? 2 : 0;

    // Size variety
    const sizes = new Set(buildings.map(b => `${b.w}x${b.h}`));
    score += sizes.size >= 3 ? 2 : (sizes.size >= 2 ? 1 : 0);

    details.push(`Structural: ${soundCount}/${buildings.length} sound, ${materialConsistent} consistent material, ${doorClearCount} clear doors, ${sizes.size} sizes`);
    return Math.min(10, score);
  }

  _scoreTrees(objects, foreground, W, H, details, violations) {
    // Trees are on FOREGROUND layer. Canopy tile above, trunk tile below.
    // Valid pairs: 4→16 (green), 7→19 (pine), 3→15 (autumn), 6→18 (dark)
    // Dense pine: 7 on top, 19 fills body — 19 above 19 is also valid (dense block)
    const VALID_PAIRS = { 4: 16, 7: 19, 3: 15, 6: 18, 19: 19 };
    let canopyCount = 0, trunkCount = 0, smallCount = 0;
    let validPairs = 0, orphanCanopies = 0, orphanTrunks = 0;
    const treeTypes = new Set();

    // Count all tree tiles on foreground
    for (let i = 0; i < foreground.length; i++) {
      if (CANOPY_TILES.has(foreground[i])) canopyCount++;
      if (TRUNK_TILES.has(foreground[i])) trunkCount++;
      if (SMALL_TREES.has(foreground[i])) smallCount++;
    }

    // Check canopy→trunk pairs (foreground layer, canopy at y, trunk at y+1)
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        const canopy = foreground[y * W + x];
        const below = foreground[(y + 1) * W + x];
        if (VALID_PAIRS[canopy] !== undefined) {
          if (VALID_PAIRS[canopy] === below) {
            validPairs++;
            if (canopy === 4) treeTypes.add('green');
            if (canopy === 7) treeTypes.add('pine');
            if (canopy === 3) treeTypes.add('autumn');
            if (canopy === 6) treeTypes.add('dark');
          } else if (!CANOPY_TILES.has(below)) {
            // Canopy without its matching trunk = orphan (bushes like 28,20 are OK without trunk)
            if (canopy !== 28 && canopy !== 20) orphanCanopies++;
          }
        }
      }
    }

    // Check for trunk tiles without canopy above
    for (let y = 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const trunk = foreground[y * W + x];
        if (!TRUNK_TILES.has(trunk)) continue;
        const above = foreground[(y - 1) * W + x];
        const expectedCanopy = Object.entries(VALID_PAIRS).find(([c, t]) => parseInt(t) === trunk);
        if (expectedCanopy && parseInt(expectedCanopy[0]) !== above) orphanTrunks++;
      }
    }

    // Cluster detection: count groups of 3+ adjacent tree tiles
    const fgTreeSet = new Set();
    for (let i = 0; i < foreground.length; i++) {
      if (CANOPY_TILES.has(foreground[i]) || TRUNK_TILES.has(foreground[i]) || SMALL_TREES.has(foreground[i])) {
        fgTreeSet.add(i);
      }
    }
    const visited = new Set();
    let clusters = 0;
    for (const idx of fgTreeSet) {
      if (visited.has(idx)) continue;
      const queue = [idx];
      let size = 0;
      while (queue.length) {
        const ci = queue.pop();
        if (visited.has(ci) || !fgTreeSet.has(ci)) continue;
        visited.add(ci);
        size++;
        const cx = ci % W, cy = Math.floor(ci / W);
        if (cx > 0) queue.push(ci - 1);
        if (cx < W - 1) queue.push(ci + 1);
        if (cy > 0) queue.push(ci - W);
        if (cy < H - 1) queue.push(ci + W);
      }
      if (size >= 3) clusters++;
    }

    const totalVeg = canopyCount + trunkCount + smallCount;
    details.push(`Trees: ${validPairs} pairs, ${orphanCanopies} orphan canopies, ${orphanTrunks} orphan trunks, ${clusters} clusters, ${smallCount} small, ${totalVeg} total fg vegetation`);

    let score = 0;
    // Has trees at all
    if (totalVeg >= 15) score += 2; else if (totalVeg >= 5) score += 1;
    // Valid canopy+trunk pairs (the KEY structural rule)
    if (validPairs >= 10) score += 3; else if (validPairs >= 5) score += 2; else if (validPairs >= 2) score += 1;
    // Penalty for orphans (canopies without trunks or trunks without canopies)
    if (orphanCanopies > validPairs) violations.push(`${orphanCanopies} canopies missing trunks`);
    if (orphanTrunks > 0) violations.push(`${orphanTrunks} trunks missing canopies above`);
    // Tree variety
    score += Math.min(2, treeTypes.size);
    // Dense clusters (like corners of reference map)
    if (clusters >= 2) score += 2; else if (clusters >= 1) score += 1;
    // Has both clusters AND scattered singles
    if (clusters >= 1 && smallCount >= 3) score += 1;

    if (totalVeg === 0) violations.push('No trees or vegetation found');
    return Math.min(10, score);
  }

  _scoreDecorations(objects, foreground, W, H, details) {
    let decoCount = 0;
    let fenceRuns = 0;
    let inFence = false;
    const decoTypes = new Set();
    // Check BOTH objects and foreground for decorations (user puts deco on foreground)
    for (let i = 0; i < objects.length; i++) {
      if (DECO_TILES.has(objects[i])) { decoCount++; decoTypes.add(objects[i]); }
      if (foreground && FG_VEGETATION.has(foreground[i])) { decoCount++; decoTypes.add(foreground[i]); }
      if (FENCE_TILES.has(objects[i])) {
        if (!inFence) { fenceRuns++; inFence = true; }
      } else {
        inFence = false;
      }
    }

    details.push(`Decorations: ${decoCount} items, ${decoTypes.size} types, ${fenceRuns} fence runs`);
    let score = 0;
    if (decoCount >= 20) score += 4;
    else if (decoCount >= 10) score += 3;
    else if (decoCount >= 4) score += 2;
    else if (decoCount >= 1) score += 1;
    score += Math.min(3, decoTypes.size); // variety
    score += Math.min(2, fenceRuns); // fence runs
    if (decoCount > 5) score += 1; // good density
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

  _scoreComposition(ground, objects, foreground, W, H, details) {
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

  _scoreVillageFeel(ground, objects, foreground, W, H, details) {
    let hasWell = false, hasCobble = false, hasItems = false, hasVegetation = false;
    let materialTypes = new Set();
    let buildingTiles = 0;
    for (let i = 0; i < objects.length; i++) {
      if (WELL_TILES.has(objects[i])) hasWell = true;
      if (LANTERN_BARREL.has(objects[i])) hasItems = true;
      if (objects[i] >= 72 && objects[i] <= 75) materialTypes.add('wood');
      if (objects[i] >= 84 && objects[i] <= 89) materialTypes.add('stone');
      if (objects[i] >= 48 && objects[i] <= 55) materialTypes.add('blue-stone');
      if (objects[i] >= 60 && objects[i] <= 62) materialTypes.add('brick');
      if (ROOF_TILES.has(objects[i]) || WALL_TILES.has(objects[i])) buildingTiles++;
    }
    for (const t of ground) { if (COBBLE_TILES.has(t)) { hasCobble = true; break; } }
    if (foreground) {
      for (const t of foreground) { if (FG_VEGETATION.has(t)) { hasVegetation = true; break; } }
    }

    details.push(`Village: well=${hasWell} cobble=${hasCobble} items=${hasItems} veg=${hasVegetation} materials=${materialTypes.size} bldgTiles=${buildingTiles}`);
    let score = 0;
    score += hasWell ? 1 : 0;
    score += hasCobble ? 1 : 0;
    score += hasItems ? 1 : 0;
    score += hasVegetation ? 1 : 0;
    score += materialTypes.size >= 2 ? 1 : 0;
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

  // ── Best Practice: Tile frequency divergence (Jensen-Shannon) ──────────
  // How closely do generated tile frequencies match the target? (0-5 pts)
  _scoreFrequencyMatch(ground, objects, foreground, W, H, details) {
    if (!this._targetFreqs) return 0;
    const size = W * H;
    let totalJSD = 0;
    for (const [layer, arr] of [['ground', ground], ['objects', objects], ['foreground', foreground]]) {
      const freq = {};
      let count = 0;
      arr.forEach(t => { if (t >= 0) { freq[t] = (freq[t] || 0) + 1; count++; } });
      if (count === 0) continue;
      for (const k of Object.keys(freq)) freq[k] /= count;
      // JSD between target and generated
      const target = this._targetFreqs[layer] || {};
      const allKeys = new Set([...Object.keys(target), ...Object.keys(freq)]);
      let jsd = 0;
      for (const k of allKeys) {
        const p = target[k] || 0.001;
        const q = freq[k] || 0.001;
        const m = (p + q) / 2;
        if (p > 0) jsd += p * Math.log2(p / m) / 2;
        if (q > 0) jsd += q * Math.log2(q / m) / 2;
      }
      totalJSD += jsd;
    }
    // JSD ranges 0 (identical) to 1 (completely different), avg across 3 layers
    const avgJSD = totalJSD / 3;
    const score = Math.round((1 - Math.min(1, avgJSD)) * 5);
    details.push(`Freq match: JSD=${avgJSD.toFixed(3)} → ${score}/5`);
    return score;
  }

  // ── Best Practice: 2x2 pattern coverage ────────────────────────────────
  // What % of target's 2x2 patterns appear in the generated map? (0-5 pts)
  _scorePatternCoverage(ground, objects, foreground, W, H, details) {
    if (!this._target2x2 || this._target2x2.size === 0) return 0;
    const genPatterns = new Set();
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        for (const arr of [ground, objects, foreground]) {
          if (!arr) continue;
          genPatterns.add([arr[y*W+x], arr[y*W+x+1], arr[(y+1)*W+x], arr[(y+1)*W+x+1]].join(','));
        }
      }
    }
    let covered = 0;
    for (const p of this._target2x2) {
      if (genPatterns.has(p)) covered++;
    }
    const coverage = covered / this._target2x2.size;
    const score = Math.round(coverage * 5);
    details.push(`Pattern coverage: ${(coverage * 100).toFixed(1)}% (${covered}/${this._target2x2.size}) → ${score}/5`);
    return score;
  }

  // ── Best Practice: Adjacency rule compliance ───────────────────────────
  // What % of tile adjacencies match learned rules? (0-5 pts)
  _scoreAdjacencyCompliance(ground, W, H, details) {
    if (!ADJACENCY_RULES) return 0;
    let valid = 0, total = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = ground[y * W + x];
        if (t < 0) continue;
        const rules = ADJACENCY_RULES[String(t)];
        if (!rules) continue;
        // Check east neighbor
        if (x + 1 < W) {
          const east = ground[y * W + x + 1];
          if (east >= 0) {
            total++;
            if (rules.east && rules.east[String(east)]) valid++;
          }
        }
        // Check south neighbor
        if (y + 1 < H) {
          const south = ground[(y + 1) * W + x];
          if (south >= 0) {
            total++;
            if (rules.south && rules.south[String(south)]) valid++;
          }
        }
      }
    }
    const compliance = total > 0 ? valid / total : 0;
    const score = Math.round(compliance * 5);
    details.push(`Adjacency compliance: ${(compliance * 100).toFixed(1)}% (${valid}/${total}) → ${score}/5`);
    return score;
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
