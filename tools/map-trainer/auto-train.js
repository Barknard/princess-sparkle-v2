#!/usr/bin/env node
/**
 * auto-train.js — Fully automated tile map evolution
 *
 * Runs until maps match the reference image at the target score.
 * No human intervention needed. Learns tile relationships automatically.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node tools/map-trainer/auto-train.js
 *   ANTHROPIC_API_KEY=sk-... node tools/map-trainer/auto-train.js --target=90 --max-gens=5000
 *
 * What it does:
 *   1. Loads reference image (Kenney Tiny Town sample village)
 *   2. Loads any prior learned tile knowledge
 *   3. Runs genetic evolution with vision scoring EVERY generation
 *   4. Evolves map generation parameters (DNA) toward reference match
 *   5. Feeds high-scoring maps into tile relationship learner
 *   6. Saves tile knowledge + session logs + best maps
 *   7. Stops when: target score reached OR diminishing returns OR max gens
 *   8. Prints summary and recommendations for next run
 *
 * The learned tile knowledge persists across runs. Each run starts
 * smarter than the last.
 */

const fs = require('fs');
const path = require('path');

// ── Parse args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let TARGET_SCORE = 90;
let MAX_GENS = 5000;
let POP_SIZE = 16;
let MAP_W = 60, MAP_H = 40;

for (const arg of args) {
  if (arg.startsWith('--target=')) TARGET_SCORE = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--max-gens=')) MAX_GENS = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--pop=')) POP_SIZE = parseInt(arg.split('=')[1]);
}

// ── Verify API key ──────────────────────────────────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('\n  ERROR: Set ANTHROPIC_API_KEY environment variable.\n');
  process.exit(1);
}

// ── Load modules ────────────────────────────────────────────────────────
const TRAINER_DIR = __dirname;
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TILESET_PATH = path.join(PROJECT_ROOT, 'sprites', 'town', 'tilemap_packed.png');
const KNOWLEDGE_PATH = path.join(TRAINER_DIR, 'learned-tile-knowledge.json');
const RESULTS_DIR = path.join(TRAINER_DIR, 'batch-results');
const LOGS_DIR = path.join(TRAINER_DIR, 'logs');

if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const { GeneticEvolver } = require('./genetic-evolver');
const { auditMap } = require('./self-audit');
const { renderMapToPng } = require('./tile-renderer');
const { scoreMapWithVision, extractRulesFromCritique } = require('./vision-scorer');
const { TileRelationshipLearner } = require('./tile-relationship-learner');
const { EvolutionLogger } = require('./evolution-logger');

// ── Load reference image ────────────────────────────────────────────────
const refPath = path.join(TRAINER_DIR, 'reference-images', 'kenney-tiny-town-sample.png');
if (!fs.existsSync(refPath)) {
  console.error('  ERROR: Reference image not found:', refPath);
  process.exit(1);
}
const refImageBuf = fs.readFileSync(refPath);

// ── Load prior knowledge ────────────────────────────────────────────────
const learner = new TileRelationshipLearner();
if (fs.existsSync(KNOWLEDGE_PATH)) {
  learner.loadFromFile(KNOWLEDGE_PATH);
  const stats = learner.getStats();
  console.log(`  Prior knowledge: ${stats.totalMapsLearned || 0} maps, ${stats.totalRelationships} relationships`);
} else {
  console.log('  No prior knowledge — starting fresh');
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║  AUTO-TRAIN — Fully Automated Tile Map Evolution            ║
  ╠══════════════════════════════════════════════════════════════╣
  ║  Target:     ${String(TARGET_SCORE).padEnd(4)} / 100 vision match                      ║
  ║  Max gens:   ${String(MAX_GENS).padEnd(5)}                                           ║
  ║  Population: ${String(POP_SIZE).padEnd(4)}                                            ║
  ║  Map size:   ${MAP_W}x${MAP_H}                                          ║
  ║  Reference:  kenney-tiny-town-sample.png                    ║
  ╚══════════════════════════════════════════════════════════════╝
  `);

  const evolver = new GeneticEvolver({ populationSize: POP_SIZE, mapSize: { width: MAP_W, height: MAP_H } });
  const logger = new EvolutionLogger();
  let population = evolver.initPopulation();

  let bestVisionScore = 0;
  let bestVisionGen = 0;
  let bestDna = null;
  let bestMapPng = null;
  const recentVisionScores = [];
  const PLATEAU_WINDOW = 30;
  const PLATEAU_THRESHOLD = 3;

  const startTime = Date.now();

  for (let gen = 1; gen <= MAX_GENS; gen++) {
    const genStart = Date.now();

    // ── Generate maps from all DNA ──────────────────────────────────
    const scored = [];
    for (const dna of population) {
      const mapData = evolver.generateFromDNA(dna);
      const audit = auditMap(mapData);
      // Fitness blends last known vision score with audit
      const fitness = audit.score * 0.3 + bestVisionScore * 0.7;
      scored.push({ dna, fitness, mapData, audit });
    }
    scored.sort((a, b) => b.fitness - a.fitness);
    const bestOrganism = scored[0];

    // ── Vision score the best organism ──────────────────────────────
    let visionScore = 0;
    let visionResult = null;
    try {
      const pngBuf = await renderMapToPng(bestOrganism.mapData, TILESET_PATH);
      visionResult = await scoreMapWithVision({
        apiKey,
        generatedMapPng: pngBuf,
        referenceImagePng: refImageBuf,
        generationNumber: gen,
        candidateId: `auto_gen${gen}`,
        variation: 'genetic',
        rationale: `Gen ${gen}`,
        learnedRules: []
      });
      visionScore = visionResult.score || 0;

      // Update fitness with REAL vision score
      bestOrganism.fitness = bestOrganism.audit.score * 0.3 + visionScore * 0.7;
      scored[0] = bestOrganism;

      // Track best ever
      if (visionScore > bestVisionScore) {
        bestVisionScore = visionScore;
        bestVisionGen = gen;
        bestDna = JSON.parse(JSON.stringify(bestOrganism.dna));
        bestMapPng = pngBuf;

        // Save best map
        const filename = `best_gen${gen}_vision${visionScore}_audit${bestOrganism.audit.score}.png`;
        fs.writeFileSync(path.join(RESULTS_DIR, filename), pngBuf);
      }

      // Save every vision-scored map
      const filename = `auto_gen${gen}_v${visionScore}_a${bestOrganism.audit.score}.png`;
      fs.writeFileSync(path.join(RESULTS_DIR, filename), pngBuf);

    } catch (e) {
      // Rate limit — wait and continue
      if (e.status === 429) {
        console.log(`  [Rate limited — waiting 30s]`);
        await new Promise(r => setTimeout(r, 30000));
      }
    }

    // ── Learn tile relationships from high-scoring maps ─────────────
    if (bestOrganism.audit.score >= 50) {
      learner.learnFromMap(bestOrganism.mapData, bestOrganism.audit.score);
    }

    // ── Extract tile placement rules from vision critique ───────────
    if (visionResult && visionResult.tilePlacementRules) {
      const rules = extractRulesFromCritique(visionResult, gen);
      // These rules could feed back into the prompt builder for LLM modes
    }

    // ── Log ─────────────────────────────────────────────────────────
    const stats = evolver.getStats(scored);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const genTime = ((Date.now() - genStart) / 1000).toFixed(1);

    const bar = '█'.repeat(Math.floor(visionScore / 5)) + '░'.repeat(20 - Math.floor(visionScore / 5));
    console.log(
      `  Gen ${String(gen).padStart(4)} | ${bar} ${String(visionScore).padStart(3)}/100 vision | ` +
      `audit ${String(bestOrganism.audit.score).padStart(2)} | ` +
      `best ever ${bestVisionScore} (gen ${bestVisionGen}) | ` +
      `${genTime}s | ${elapsed}s total`
    );

    if (visionResult?.critique) {
      console.log(`         └─ ${visionResult.critique.slice(0, 100)}`);
    }

    logger.logGeneration(gen, stats, scored, visionScore);
    if (visionResult) logger.logVisionResult(gen, visionResult);

    // ── Check target ────────────────────────────────────────────────
    if (visionScore >= TARGET_SCORE) {
      console.log(`\n  ✓ TARGET REACHED! Vision score ${visionScore} >= ${TARGET_SCORE} at gen ${gen}\n`);
      break;
    }

    // ── Check diminishing returns ───────────────────────────────────
    recentVisionScores.push(visionScore);
    if (recentVisionScores.length >= PLATEAU_WINDOW) {
      const window = recentVisionScores.slice(-PLATEAU_WINDOW);
      const maxW = Math.max(...window), minW = Math.min(...window);
      if (maxW - minW < PLATEAU_THRESHOLD) {
        console.log(`\n  ⚠ Diminishing returns: vision scores ${minW}-${maxW} over last ${PLATEAU_WINDOW} gens`);
        logger.logDiminishingReturns(gen, `Vision plateau ${minW}-${maxW}`);
        break;
      }
    }

    // ── Evolve ──────────────────────────────────────────────────────
    population = evolver.evolveGeneration(scored);

    // Save knowledge periodically
    if (gen % 20 === 0) {
      learner.extractComposites();
      learner.saveToFile(KNOWLEDGE_PATH);
    }

    // Small delay to avoid API rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  // ── Final save ────────────────────────────────────────────────────
  learner.extractComposites();
  learner.saveToFile(KNOWLEDGE_PATH);
  const kStats = learner.getStats();

  const summaryPath = logger.writeSummary();
  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║  COMPLETE                                                   ║
  ╠══════════════════════════════════════════════════════════════╣
  ║  Best vision score:  ${String(bestVisionScore).padEnd(3)} / 100 (gen ${String(bestVisionGen).padEnd(4)})              ║
  ║  Total time:         ${String(totalElapsed).padEnd(5)} minutes                           ║
  ║  Tile knowledge:     ${String(kStats.totalRelationships).padEnd(5)} relationships                     ║
  ║  Unique tiles:       ${String(kStats.uniqueTiles).padEnd(3)}                                        ║
  ║  Maps learned from:  ${String(kStats.totalMapsLearned || '?').padEnd(4)}                                       ║
  ║                                                              ║
  ║  Summary: ${summaryPath.split(path.sep).slice(-2).join('/').padEnd(47)} ║
  ║  Knowledge: learned-tile-knowledge.json                      ║
  ║  Best maps: batch-results/best_*.png                         ║
  ╚══════════════════════════════════════════════════════════════╝
  `);

  // Print top learned composites
  if (kStats.topComposites && kStats.topComposites.length > 0) {
    console.log('  Learned composites:');
    kStats.topComposites.slice(0, 10).forEach(c => {
      console.log(`    ${c.id} (seen ${c.count}x, avg score ${(c.avgScore || 0).toFixed(0)})`);
    });
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
