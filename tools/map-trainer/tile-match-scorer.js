/**
 * tile-match-scorer.js — Score maps by exact tile-by-tile match to a target
 *
 * Instead of heuristic design quality checks, this compares each tile position
 * directly against a known-good target map. Score = % of tiles that match exactly.
 *
 * 99.9999% match = near-perfect reproduction of the target.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load the target map from a level JS file
 * @param {string} levelPath - path to level-*.js file
 * @returns {{ width, height, ground: number[], objects: number[], foreground: number[] }}
 */
function loadTargetMap(levelPath) {
  // The level files export a default object with ground, objects, foreground as flat arrays
  // They use `export default { ... }` (ES module) but we need CommonJS
  // Read the file and eval it to extract the data
  let source = fs.readFileSync(levelPath, 'utf8');

  // Convert ES module export to something we can eval
  source = source.replace(/export\s+default\s+/, 'module.exports = ');
  // Remove any import statements
  source = source.replace(/import\s+.*?from\s+['"].*?['"]\s*;?/g, '');

  // Write temp file and require it
  const tmpPath = path.join(__dirname, '_tmp_target_level.js');
  fs.writeFileSync(tmpPath, source);
  delete require.cache[require.resolve(tmpPath)];
  const level = require(tmpPath);
  fs.unlinkSync(tmpPath);

  return {
    width: level.width || 60,
    height: level.height || 40,
    ground: Array.isArray(level.ground) ? level.ground : [],
    objects: Array.isArray(level.objects) ? level.objects : [],
    foreground: Array.isArray(level.foreground) ? level.foreground : []
  };
}

/**
 * Score a generated map against a target by exact tile matching
 * @param {Object} generated - { width, height, ground, objects, foreground }
 * @param {Object} target - { width, height, ground, objects, foreground }
 * @returns {{
 *   score: number,          // 0-100 overall match percentage
 *   groundMatch: number,    // 0-100 ground layer match
 *   objectsMatch: number,   // 0-100 objects layer match
 *   foregroundMatch: number, // 0-100 foreground layer match
 *   totalTiles: number,
 *   matchedTiles: number,
 *   mismatchedPositions: Array<{x, y, layer, expected, got}>, // first 50 mismatches
 *   details: string[]
 * }}
 */
function scoreTileMatch(generated, target) {
  const w = Math.min(generated.width, target.width);
  const h = Math.min(generated.height, target.height);
  const total = w * h;

  let groundMatched = 0, objectsMatched = 0, foregroundMatched = 0;
  const mismatches = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gi = y * generated.width + x;
      const ti = y * target.width + x;

      // Ground layer
      const gg = generated.ground[gi] ?? -1;
      const tg = target.ground[ti] ?? -1;
      if (gg === tg) groundMatched++;
      else if (mismatches.length < 50) mismatches.push({ x, y, layer: 'ground', expected: tg, got: gg });

      // Objects layer
      const go = generated.objects[gi] ?? -1;
      const to = target.objects[ti] ?? -1;
      if (go === to) objectsMatched++;
      else if (mismatches.length < 50) mismatches.push({ x, y, layer: 'objects', expected: to, got: go });

      // Foreground layer
      const gf = generated.foreground[gi] ?? -1;
      const tf = target.foreground[ti] ?? -1;
      if (gf === tf) foregroundMatched++;
      else if (mismatches.length < 50) mismatches.push({ x, y, layer: 'foreground', expected: tf, got: gf });
    }
  }

  const totalAll = total * 3; // 3 layers
  const matchedAll = groundMatched + objectsMatched + foregroundMatched;
  const score = totalAll > 0 ? (matchedAll / totalAll) * 100 : 0;

  const groundPct = total > 0 ? (groundMatched / total) * 100 : 0;
  const objectsPct = total > 0 ? (objectsMatched / total) * 100 : 0;
  const foregroundPct = total > 0 ? (foregroundMatched / total) * 100 : 0;

  const details = [
    `Overall: ${score.toFixed(4)}% (${matchedAll}/${totalAll} tiles)`,
    `Ground: ${groundPct.toFixed(2)}% (${groundMatched}/${total})`,
    `Objects: ${objectsPct.toFixed(2)}% (${objectsMatched}/${total})`,
    `Foreground: ${foregroundPct.toFixed(2)}% (${foregroundMatched}/${total})`,
  ];

  return {
    score,
    groundMatch: groundPct,
    objectsMatch: objectsPct,
    foregroundMatch: foregroundPct,
    totalTiles: totalAll,
    matchedTiles: matchedAll,
    mismatchedPositions: mismatches,
    details
  };
}

/**
 * Combined scorer: tile match (weighted 70%) + design quality (weighted 30%)
 * This lets the evolution optimize for exact match while still encouraging good design
 */
function combinedScore(generated, target, auditResult) {
  const match = scoreTileMatch(generated, target);
  const designScore = auditResult ? auditResult.score : 0;
  const combined = match.score * 0.7 + designScore * 0.3;
  return {
    combined,
    tileMatch: match.score,
    designQuality: designScore,
    details: match.details
  };
}

module.exports = { loadTargetMap, scoreTileMatch, combinedScore };

// ── Self-test ───────────────────────────────────────────────────────────
if (require.main === module) {
  const levelPath = path.join(__dirname, '..', '..', 'game', 'levels', 'level-sparkle-village.js');

  console.log('Loading target map from:', levelPath);
  const target = loadTargetMap(levelPath);
  console.log(`Target: ${target.width}x${target.height}`);
  console.log(`Ground tiles: ${target.ground.length}`);
  console.log(`Objects tiles: ${target.objects.length}`);
  console.log(`Foreground tiles: ${target.foreground.length}`);

  // Score the target against itself (should be 100%)
  const selfScore = scoreTileMatch(target, target);
  console.log('\nSelf-match:', selfScore.score.toFixed(4) + '%');

  // Score a random map against it
  const { GeneticEvolver } = require('./genetic-evolver');
  const evolver = new GeneticEvolver({ populationSize: 1, mapSize: { width: target.width, height: target.height } });
  const pop = evolver.initPopulation();
  const randomMap = evolver.generateFromDNA(pop[0]);
  const randomScore = scoreTileMatch(randomMap, target);
  console.log('Random map match:', randomScore.score.toFixed(4) + '%');
  randomScore.details.forEach(d => console.log('  ', d));

  console.log('\nFirst 10 mismatches:');
  randomScore.mismatchedPositions.slice(0, 10).forEach(m => {
    console.log(`  (${m.x},${m.y}) ${m.layer}: expected ${m.expected}, got ${m.got}`);
  });

  // Load learned knowledge and show stats
  const knowledgePath = path.join(__dirname, 'learned-tile-knowledge.json');
  if (fs.existsSync(knowledgePath)) {
    const { TileRelationshipLearner } = require('./tile-relationship-learner');
    const learner = new TileRelationshipLearner();
    learner.loadFromFile(knowledgePath);
    console.log('\nLearned knowledge:', learner.getStats());
  }
}
