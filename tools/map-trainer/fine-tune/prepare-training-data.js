#!/usr/bin/env node
/**
 * prepare-training-data.js
 *
 * Reads evolution-memory.json from completed batch runs and prepares
 * training data for fine-tuning a small language model on winning map blueprints.
 *
 * Supported formats:
 *   - gpt2:  text completion format for DistilGPT2 / GPT-2 Small
 *   - llama: instruction format for Llama/Mistral LoRA fine-tuning
 *   - both:  generate both formats
 *
 * Usage:
 *   node tools/map-trainer/fine-tune/prepare-training-data.js [--format=gpt2|llama|both] [--min-score=60]
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const BASE_DIR = path.resolve(__dirname);
const TRAINER_DIR = path.resolve(__dirname, '..');
const MEMORY_FILE = path.join(TRAINER_DIR, 'evolution-memory.json');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = { format: 'both', minScore: 60 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--format=')) {
      const val = arg.split('=')[1];
      if (!['gpt2', 'llama', 'both'].includes(val)) {
        console.error(`Invalid format "${val}". Use gpt2, llama, or both.`);
        process.exit(1);
      }
      args.format = val;
    } else if (arg.startsWith('--min-score=')) {
      args.minScore = parseInt(arg.split('=')[1], 10);
      if (isNaN(args.minScore)) {
        console.error('--min-score must be a number');
        process.exit(1);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: prepare-training-data.js [--format=gpt2|llama|both] [--min-score=60]');
      process.exit(0);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Seeded PRNG (Mulberry32) for reproducible shuffles
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seed = 42) {
  const rng = mulberry32(seed);
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ---------------------------------------------------------------------------
// Build a compact prompt string from a blueprint
// ---------------------------------------------------------------------------
function buildPrompt(blueprint) {
  const parts = [];
  if (blueprint.mapSize) {
    parts.push(`${blueprint.mapSize.width}x${blueprint.mapSize.height} map`);
  }
  if (blueprint.zones && blueprint.zones.length > 0) {
    const zoneTypes = blueprint.zones.map((z) => z.type || z.name || 'zone').filter(Boolean);
    const unique = [...new Set(zoneTypes)];
    parts.push(`zones: ${unique.join(', ')}`);
  }
  if (blueprint.groundMix) {
    const grounds = Object.keys(blueprint.groundMix);
    if (grounds.length > 0) {
      parts.push(`ground: ${grounds.join(', ')}`);
    }
  }
  return `Generate a ${parts.join(', ')}`;
}

// ---------------------------------------------------------------------------
// Canonical key for deduplication — deterministic JSON of zone definitions
// ---------------------------------------------------------------------------
function blueprintKey(blueprint) {
  // Use sorted zone data as the dedup key
  const zones = (blueprint.zones || []).map((z) => {
    const { type, name, x, y, width, height } = z;
    return JSON.stringify({ type, name, x, y, width, height });
  });
  zones.sort();
  return zones.join('|');
}

// ---------------------------------------------------------------------------
// System prompt (kept short — training data should be compact)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT =
  'You are a tile-based RPG map designer for a children\'s educational game. ' +
  'Given map parameters, output a JSON blueprint with mapSize, zones, groundMix, and rationale.';

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs();

  // 1. Load evolution memory
  if (!fs.existsSync(MEMORY_FILE)) {
    console.error(`evolution-memory.json not found at: ${MEMORY_FILE}`);
    console.error('Run the map evolution pipeline first to generate training data.');
    process.exit(1);
  }

  const memory = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  const generations = memory.generations || [];
  console.log(`Loaded ${generations.length} generation(s) from evolution memory.`);

  // 2. Extract winning blueprints that meet the minimum score
  const examples = [];
  for (const gen of generations) {
    if (!gen.vote || !gen.vote.winner) continue;
    const winnerId = gen.vote.winner;
    const winner = (gen.candidates || []).find((c) => c.candidateId === winnerId);
    if (!winner) continue;

    const score = winner.combinedScore ?? winner.auditScore ?? 0;
    if (score < args.minScore) continue;

    examples.push({
      blueprint: winner.blueprint,
      score,
      feedback: gen.feedback || '',
      generationId: gen.id,
    });
  }
  console.log(`Found ${examples.length} winning blueprint(s) with combinedScore >= ${args.minScore}.`);

  if (examples.length === 0) {
    console.log('No training examples to write. Lower --min-score or run more generations.');
    return;
  }

  // 3. Deduplicate — keep higher-scoring blueprint when zones are identical
  const deduped = new Map();
  for (const ex of examples) {
    const key = blueprintKey(ex.blueprint);
    const existing = deduped.get(key);
    if (!existing || ex.score > existing.score) {
      deduped.set(key, ex);
    }
  }
  const unique = [...deduped.values()];
  console.log(`After deduplication: ${unique.length} unique blueprint(s).`);

  // 4. Shuffle with fixed seed
  const shuffled = seededShuffle(unique, 42);

  // 5. Split 90/10
  const splitIdx = Math.max(1, Math.floor(shuffled.length * 0.9));
  const trainSet = shuffled.slice(0, splitIdx);
  const valSet = shuffled.slice(splitIdx);

  // If we only have 1 example, put it in both sets so validation isn't empty
  if (valSet.length === 0 && trainSet.length > 0) {
    valSet.push(trainSet[trainSet.length - 1]);
  }

  // 6. Build format-specific examples and write
  const formats = args.format === 'both' ? ['gpt2', 'llama'] : [args.format];

  for (const fmt of formats) {
    const trainLines = trainSet.map((ex) => formatExample(ex, fmt));
    const valLines = valSet.map((ex) => formatExample(ex, fmt));

    const trainFile = path.join(BASE_DIR, `training-data-${fmt}-train.jsonl`);
    const valFile = path.join(BASE_DIR, `training-data-${fmt}-val.jsonl`);
    const fullFile = path.join(BASE_DIR, `training-data-${fmt}.jsonl`);

    // Write combined file
    fs.writeFileSync(fullFile, [...trainLines, ...valLines].join('\n') + '\n', 'utf-8');
    // Write splits
    fs.writeFileSync(trainFile, trainLines.join('\n') + '\n', 'utf-8');
    fs.writeFileSync(valFile, valLines.join('\n') + '\n', 'utf-8');

    console.log(`\n[${fmt}]`);
    console.log(`  Full:       ${fullFile} (${trainLines.length + valLines.length} examples)`);
    console.log(`  Train:      ${trainFile} (${trainLines.length} examples)`);
    console.log(`  Validation: ${valFile} (${valLines.length} examples)`);
  }

  // 7. Summary statistics
  const scores = unique.map((e) => e.score);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);

  console.log('\n--- Statistics ---');
  console.log(`Total unique examples: ${unique.length}`);
  console.log(`Train / Val split:     ${trainSet.length} / ${valSet.length}`);
  console.log(`Score range:           ${minS} - ${maxS} (avg ${avgScore})`);
  console.log(`Formats written:       ${formats.join(', ')}`);
  console.log('Done.');
}

// ---------------------------------------------------------------------------
// Format a single example for the given format
// ---------------------------------------------------------------------------
function formatExample(ex, format) {
  const blueprintJson = JSON.stringify(ex.blueprint);
  const prompt = buildPrompt(ex.blueprint);

  if (format === 'gpt2') {
    const text =
      `<|system|>${SYSTEM_PROMPT}` +
      `<|user|>${prompt}` +
      `<|assistant|>${blueprintJson}`;
    return JSON.stringify({ text });
  }

  if (format === 'llama') {
    return JSON.stringify({
      instruction: prompt,
      input: '',
      output: blueprintJson,
    });
  }

  throw new Error(`Unknown format: ${format}`);
}

// ---------------------------------------------------------------------------
main();
