#!/usr/bin/env node
/**
 * Map Generation Training Server
 *
 * Evolutionary map generation with human-in-the-loop feedback.
 * Runs 3 candidates per generation (Conservative/Exploratory/Creative),
 * user votes on best, feedback accumulates, system improves autonomously.
 *
 * Usage: ANTHROPIC_API_KEY=sk-... node tools/map-trainer/server.js
 * Then open http://localhost:3456
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk').default;

const app = express();
app.use(cors());

// Serve static image files BEFORE json body parser
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const trainerDir = path.resolve(__dirname);
  const dirs = {
    '/reference-images/': path.join(trainerDir, 'reference-images'),
    '/batch-results/': path.join(trainerDir, 'batch-results')
  };
  for (const [prefix, dir] of Object.entries(dirs)) {
    if (req.url.startsWith(prefix)) {
      const filename = decodeURIComponent(req.url.slice(prefix.length).split('?')[0]);
      const filepath = path.join(dir, filename);
      if (fs.existsSync(filepath)) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        const data = fs.readFileSync(filepath);
        res.setHeader('Content-Length', data.length);
        return res.end(data);
      }
    }
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

const PORT = process.env.MAP_TRAINER_PORT || 3456;
const TRAINER_DIR = __dirname;
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ── Verify API key ─────────────────────────────────────────────────────
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('\n  ERROR: ANTHROPIC_API_KEY environment variable is not set.');
  console.error('  Set it before running: ANTHROPIC_API_KEY=sk-... node tools/map-trainer/server.js\n');
  process.exit(1);
}
const anthropic = new Anthropic({ apiKey });

// ── Load modules ────────────────────────────────────────────────────────
const { expandBlueprint } = require('./blueprint-expander');
const { auditMap } = require('./self-audit');
const { buildPrompt } = require('./prompt-builder');
let renderMapToPng, renderMapToBase64;
let scoreMapWithVision, extractRulesFromCritique;
try {
  ({ renderMapToPng, renderMapToBase64 } = require('./tile-renderer'));
  ({ scoreMapWithVision, extractRulesFromCritique } = require('./vision-scorer'));
} catch (e) {
  console.warn('  Warning: tile-renderer or vision-scorer not loaded:', e.message);
}

// ── Data paths ──────────────────────────────────────────────────────────
const MEMORY_PATH = path.join(TRAINER_DIR, 'evolution-memory.json');
const SEMANTICS_PATH = path.join(TRAINER_DIR, 'tile-semantics.json');
const REFERENCE_DIR = path.join(TRAINER_DIR, 'reference-images');
const BATCH_RESULTS_DIR = path.join(TRAINER_DIR, 'batch-results');
const TILESET_PATH = path.join(PROJECT_ROOT, 'sprites', 'town', 'tilemap_packed.png');

// Ensure directories exist
if (!fs.existsSync(REFERENCE_DIR)) fs.mkdirSync(REFERENCE_DIR, { recursive: true });
if (!fs.existsSync(BATCH_RESULTS_DIR)) fs.mkdirSync(BATCH_RESULTS_DIR, { recursive: true });

function loadMemory() {
  return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
}
function saveMemory(mem) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(mem, null, 2), 'utf8');
}
function loadSemantics() {
  return JSON.parse(fs.readFileSync(SEMANTICS_PATH, 'utf8'));
}

// ── In-memory state ─────────────────────────────────────────────────────
let currentCandidates = null; // { generationId, candidates: [{id, blueprint, tileData, audit, variation}] }
let isGenerating = false;

// ── Batch mode state ────────────────────────────────────────────────────
let batchState = {
  running: false,
  totalGenerations: 0,
  completedGenerations: 0,
  currentGeneration: 0,
  startTime: null,
  topResults: [],      // top N results by vision score
  keepTopN: 20,        // keep top 20 for final human vote
  referenceImage: null, // base64 PNG of reference image
  errors: 0,
  log: [],             // running log of batch progress
  aborted: false
};

// ── Static file serving ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(TRAINER_DIR, 'trainer-ui.html'));
});
app.get('/tilemap', (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'sprites', 'town', 'tilemap_packed.png'));
});
// Serve reference images
// (static image serving handled by early middleware above)

// ── API: Get current state ──────────────────────────────────────────────
app.get('/api/state', (req, res) => {
  const memory = loadMemory();
  res.json({
    currentGeneration: memory.currentGeneration,
    learnedRules: memory.learnedRules,
    generationCount: memory.generations.length,
    isGenerating,
    hasCandidates: currentCandidates !== null,
    candidates: currentCandidates ? currentCandidates.candidates.map(c => ({
      id: c.id,
      variation: c.variation,
      auditScore: c.audit.score,
      auditPassed: c.audit.passed,
      rationale: c.blueprint.rationale,
      violations: c.audit.violations.length
    })) : null
  });
});

// ── API: Get full evolution log ─────────────────────────────────────────
app.get('/api/log', (req, res) => {
  const memory = loadMemory();
  res.json({
    generations: memory.generations.map(g => ({
      id: g.id,
      timestamp: g.timestamp,
      winner: g.vote ? g.vote.winner : null,
      feedback: g.feedback,
      diffSummary: g.diffFromPrevious,
      candidates: g.candidates.map(c => ({
        id: c.candidateId,
        variation: c.variationStrategy,
        auditScore: c.auditScore
      }))
    })),
    learnedRules: memory.learnedRules
  });
});

// ── API: Get tile data for candidates ───────────────────────────────────
app.get('/api/candidates/:genId', (req, res) => {
  // Accept both numeric "1" and string "gen1" formats
  const rawId = req.params.genId;
  const genId = parseInt(rawId.replace(/^gen/i, ''), 10);
  if (!currentCandidates || (genId && currentCandidates.generationId !== genId) || (!genId && !currentCandidates)) {
    return res.status(404).json({ error: 'No candidates for this generation' });
  }
  // Send tile arrays as JSON-serializable arrays
  res.json({
    generationId: currentCandidates.generationId,
    candidates: currentCandidates.candidates.map(c => ({
      id: c.id,
      variation: c.variation,
      blueprint: c.blueprint,
      audit: c.audit,
      tileData: {
        width: c.tileData.width,
        height: c.tileData.height,
        ground: Array.from(c.tileData.ground),
        objects: Array.from(c.tileData.objects),
        foreground: Array.from(c.tileData.foreground),
        collision: Array.from(c.tileData.collision)
      }
    }))
  });
});

// ── API: Generate 3 candidates ──────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  if (isGenerating) {
    return res.status(409).json({ error: 'Generation already in progress' });
  }
  isGenerating = true;

  try {
    const memory = loadMemory();
    const semantics = loadSemantics();
    const genId = memory.currentGeneration + 1;
    const mapParams = req.body.mapParams || { width: 60, height: 40, theme: 'village', buildingCount: 3, treeDensity: 'medium' };

    console.log(`\n[Gen ${genId}] Starting generation with 3 candidates...`);

    const variations = ['conservative', 'exploratory', 'creative'];
    const temperatures = { conservative: 0.7, exploratory: 0.7, creative: 0.9 };

    // Build prompts and call Claude API in parallel
    const candidatePromises = variations.map(async (variation, idx) => {
      const candidateId = `gen${genId}_${String.fromCharCode(97 + idx)}`; // gen1_a, gen1_b, gen1_c
      const { system, user } = buildPrompt({
        variation,
        generationNumber: genId,
        evolutionMemory: memory,
        tileSemantics: semantics,
        mapParams
      });

      console.log(`  [${candidateId}] Calling Claude API (${variation}, temp=${temperatures[variation]})...`);

      let blueprint;
      let retries = 0;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            temperature: temperatures[variation],
            system,
            messages: [{ role: 'user', content: user }]
          });

          const text = response.content[0].text.trim();
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
          blueprint = JSON.parse(jsonMatch[1].trim());
          break;
        } catch (parseErr) {
          retries++;
          if (retries > maxRetries) {
            console.error(`  [${candidateId}] Failed after ${maxRetries + 1} attempts:`, parseErr.message);
            // Generate a fallback blueprint
            blueprint = generateFallbackBlueprint(mapParams);
          } else {
            console.warn(`  [${candidateId}] Parse error, retrying (${retries}/${maxRetries})...`);
          }
        }
      }

      console.log(`  [${candidateId}] Expanding blueprint to tiles...`);
      const tileData = expandBlueprint(blueprint);

      console.log(`  [${candidateId}] Running self-audit...`);
      const audit = auditMap(tileData);

      console.log(`  [${candidateId}] Audit score: ${audit.score}/100 (${audit.passed ? 'PASSED' : 'FAILED'})`);

      return { id: candidateId, blueprint, tileData, audit, variation };
    });

    const candidates = await Promise.all(candidatePromises);

    currentCandidates = { generationId: genId, candidates };

    // Compute what changed from previous generation
    let diffSummary = null;
    if (memory.generations.length > 0) {
      const prevGen = memory.generations[memory.generations.length - 1];
      diffSummary = computeDiff(prevGen, candidates);
    }

    console.log(`[Gen ${genId}] All 3 candidates ready. Waiting for vote...`);

    res.json({
      generationId: genId,
      diffSummary,
      candidates: candidates.map(c => ({
        id: c.id,
        variation: c.variation,
        auditScore: c.audit.score,
        auditPassed: c.audit.passed,
        rationale: c.blueprint.rationale,
        violationCount: c.audit.violations.length,
        violations: c.audit.violations.slice(0, 5) // top 5 violations
      }))
    });
  } catch (err) {
    console.error('[Generate] Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    isGenerating = false;
  }
});

// ── API: Vote on a candidate ────────────────────────────────────────────
app.post('/api/vote', async (req, res) => {
  const { winnerId, feedback } = req.body;

  if (!currentCandidates) {
    return res.status(400).json({ error: 'No candidates to vote on' });
  }

  const winner = currentCandidates.candidates.find(c => c.id === winnerId);
  if (!winner) {
    return res.status(400).json({ error: `Candidate ${winnerId} not found` });
  }

  const memory = loadMemory();
  const genId = currentCandidates.generationId;

  // Store generation results
  const genRecord = {
    id: genId,
    timestamp: new Date().toISOString(),
    candidates: currentCandidates.candidates.map(c => ({
      candidateId: c.id,
      blueprint: c.blueprint,
      auditScore: c.audit.score,
      variationStrategy: c.variation,
      violations: c.audit.violations.map(v => v.rule)
    })),
    vote: { winner: winnerId, timestamp: new Date().toISOString() },
    feedback: feedback || '',
    diffFromPrevious: computeDiff(
      memory.generations.length > 0 ? memory.generations[memory.generations.length - 1] : null,
      currentCandidates.candidates
    ),
    parameterSnapshot: {
      temperatures: { conservative: 0.7, exploratory: 0.7, creative: 0.9 },
      groundMix: winner.blueprint.groundMix
    }
  };

  memory.generations.push(genRecord);
  memory.currentGeneration = genId;

  // Update best maps (keep last 5)
  memory.bestMaps.push({
    generationId: genId,
    candidateId: winnerId,
    blueprint: winner.blueprint,
    auditScore: winner.audit.score
  });
  if (memory.bestMaps.length > 5) {
    memory.bestMaps = memory.bestMaps.slice(-5);
  }

  // Extract learned rules from feedback
  if (feedback && feedback.trim()) {
    const newRules = extractRulesFromFeedback(feedback, genId, memory.learnedRules);
    memory.learnedRules = newRules;
  }

  saveMemory(memory);

  console.log(`[Gen ${genId}] Vote: ${winnerId} (${winner.variation})`);
  console.log(`[Gen ${genId}] Feedback: ${feedback || '(none)'}`);
  console.log(`[Gen ${genId}] Learned rules: ${memory.learnedRules.length} total`);

  currentCandidates = null;

  res.json({
    success: true,
    generationId: genId,
    winner: winnerId,
    learnedRulesCount: memory.learnedRules.length,
    nextGeneration: genId + 1
  });
});

// ── API: Export winning map as game level file ──────────────────────────
app.post('/api/export', (req, res) => {
  const { generationId, candidateId } = req.body;
  const memory = loadMemory();

  const gen = memory.generations.find(g => g.id === generationId);
  if (!gen) return res.status(404).json({ error: 'Generation not found' });

  const candidate = gen.candidates.find(c => c.candidateId === candidateId);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  // Re-expand the blueprint to get tile data
  const tileData = expandBlueprint(candidate.blueprint);
  const levelJs = formatAsLevelJs(tileData, candidate.blueprint, generationId);

  const outputName = `level-trained-gen${generationId}.js`;
  const outputPath = path.join(PROJECT_ROOT, 'game', 'levels', outputName);
  fs.writeFileSync(outputPath, levelJs, 'utf8');

  console.log(`[Export] Written ${outputPath}`);
  res.json({ success: true, path: `game/levels/${outputName}` });
});

// ── Helper: Generate fallback blueprint when LLM fails ──────────────────
function generateFallbackBlueprint(params) {
  const w = params.width || 60;
  const h = params.height || 40;
  return {
    mapSize: { width: w, height: h },
    seed: Math.floor(Math.random() * 99999),
    zones: [
      { type: "forest", bounds: { x: 0, y: 0, w, h: 3 }, density: "dense", treeTypes: ["green_tree", "autumn_tree", "pine_tree"] },
      { type: "forest", bounds: { x: 0, y: h - 3, w, h: 3 }, density: "dense", treeTypes: ["green_tree", "pine_tree"] },
      { type: "building-zone", template: "medium_house", position: { x: 10, y: 8 }, material: "wood", fenced: true, fenceType: "white" },
      { type: "building-zone", template: "stone_shop", position: { x: 40, y: 8 }, material: "stone", fenced: false },
      { type: "building-zone", template: "small_house", position: { x: 10, y: 28 }, material: "wood", fenced: true, fenceType: "white" },
      { type: "path", waypoints: [{ x: 12, y: 11 }, { x: 12, y: 20 }, { x: 30, y: 20 }, { x: 42, y: 20 }, { x: 42, y: 11 }], width: 2 },
      { type: "path", waypoints: [{ x: 12, y: 20 }, { x: 12, y: 31 }], width: 2 },
      { type: "water", bounds: { x: 44, y: 18, w: 4, h: 3 } },
      { type: "village-square", bounds: { x: 26, y: 17, w: 8, h: 6 } },
      { type: "decoration", subtype: "well", position: { x: 30, y: 19 } },
      { type: "decoration", subtype: "lantern", position: { x: 14, y: 11 } },
      { type: "decoration", subtype: "barrel", position: { x: 43, y: 9 } },
      { type: "tree-cluster", position: { x: 20, y: 25 }, count: 3, treeTypes: ["green_tree", "autumn_tree"] },
      { type: "tree-cluster", position: { x: 48, y: 30 }, count: 4, treeTypes: ["pine_tree", "dense_tree"] },
      { type: "garden", center: { x: 10, y: 10 }, radius: 3 },
      { type: "garden", center: { x: 40, y: 10 }, radius: 2 }
    ],
    groundMix: { plain: 0.60, variant: 0.30, flower: 0.10 },
    rationale: "Fallback layout: standard village with cross-shaped paths, 3 buildings, pond, and balanced tree coverage."
  };
}

// ── Helper: Compute diff between generations ────────────────────────────
function computeDiff(prevGen, currentCandidates) {
  if (!prevGen) return 'First generation — no previous comparison.';

  const prev = prevGen.candidates.find(c => c.candidateId === prevGen.vote?.winner);
  if (!prev) return 'No previous winner to compare against.';

  const changes = [];
  const prevZones = prev.blueprint.zones || [];
  const avgBuildings = currentCandidates.reduce((sum, c) => {
    return sum + (c.blueprint.zones || []).filter(z => z.type === 'building-zone').length;
  }, 0) / currentCandidates.length;
  const prevBuildings = prevZones.filter(z => z.type === 'building-zone').length;

  if (Math.abs(avgBuildings - prevBuildings) >= 1) {
    changes.push(`Building count: ${prevBuildings} → ~${Math.round(avgBuildings)}`);
  }

  const prevPaths = prevZones.filter(z => z.type === 'path').length;
  const avgPaths = currentCandidates.reduce((sum, c) => {
    return sum + (c.blueprint.zones || []).filter(z => z.type === 'path').length;
  }, 0) / currentCandidates.length;

  if (Math.abs(avgPaths - prevPaths) >= 1) {
    changes.push(`Path segments: ${prevPaths} → ~${Math.round(avgPaths)}`);
  }

  const prevHasWater = prevZones.some(z => z.type === 'water');
  const candidatesWithWater = currentCandidates.filter(c =>
    (c.blueprint.zones || []).some(z => z.type === 'water')
  ).length;

  if (!prevHasWater && candidatesWithWater > 0) {
    changes.push('Added water feature');
  } else if (prevHasWater && candidatesWithWater === 0) {
    changes.push('Removed water feature');
  }

  // Check rationale for hints
  for (const c of currentCandidates) {
    if (c.blueprint.rationale) {
      changes.push(`${c.variation}: "${c.blueprint.rationale}"`);
    }
  }

  return changes.length > 0 ? changes.join(' | ') : 'Minor variations from previous generation.';
}

// ── Helper: Extract rules from feedback text ────────────────────────────
function extractRulesFromFeedback(feedback, genId, existingRules) {
  const rules = [...existingRules];
  const text = feedback.toLowerCase();

  // Simple keyword-based rule extraction
  // Look for patterns like "too many X", "not enough X", "X should be Y", "move X closer/farther"
  const patterns = [
    { pattern: /too many ([\w\s]+)/g, template: (m) => `Reduce ${m[1].trim()}` },
    { pattern: /not enough ([\w\s]+)/g, template: (m) => `Increase ${m[1].trim()}` },
    { pattern: /too (close|far|big|small|dense|sparse|uniform|repetitive)/g, template: (m) => `Avoid being too ${m[1]}` },
    { pattern: /(move|put|place) ([\w\s]+?) (closer|farther|near|away)/g, template: (m) => `${m[1]} ${m[2].trim()} ${m[3]}` },
    { pattern: /(more|less) ([\w\s]+)/g, template: (m) => `Use ${m[1]} ${m[2].trim()}` },
    { pattern: /(need|want|should have) ([\w\s]+)/g, template: (m) => `Should have ${m[2].trim()}` },
  ];

  for (const { pattern, template } of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const rule = template(match);
      // Check if similar rule already exists
      const isDuplicate = rules.some(r =>
        r.rule.toLowerCase().includes(rule.toLowerCase().slice(0, 20)) ||
        rule.toLowerCase().includes(r.rule.toLowerCase().slice(0, 20))
      );
      if (!isDuplicate) {
        rules.push({
          id: `lr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          rule,
          source: `user-feedback-gen-${genId}`,
          confidence: 0.7,
          createdAt: new Date().toISOString()
        });
      } else {
        // Reinforce existing similar rule
        const existing = rules.find(r =>
          r.rule.toLowerCase().includes(rule.toLowerCase().slice(0, 20)) ||
          rule.toLowerCase().includes(r.rule.toLowerCase().slice(0, 20))
        );
        if (existing && existing.confidence < 1.0) {
          existing.confidence = Math.min(1.0, existing.confidence + 0.1);
        }
      }
    }
  }

  // Also store the raw feedback as a rule if it's short and actionable
  if (feedback.length < 100 && feedback.length > 10) {
    const isDuplicate = rules.some(r => r.rule === feedback.trim());
    if (!isDuplicate) {
      rules.push({
        id: `lr_raw_${Date.now()}`,
        rule: feedback.trim(),
        source: `user-feedback-gen-${genId}`,
        confidence: 0.8,
        createdAt: new Date().toISOString()
      });
    }
  }

  return rules;
}

// ── Helper: Format tile data as game-compatible level JS ────────────────
function formatAsLevelJs(tileData, blueprint, genId) {
  const { width, height, ground, objects, foreground, collision } = tileData;

  function formatLayer(arr, name) {
    let lines = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        row.push(arr[y * width + x]);
      }
      lines.push('    ' + JSON.stringify(row));
    }
    return lines.join(',\n');
  }

  return `/**
 * Auto-generated level from Map Trainer Generation ${genId}
 * Generated: ${new Date().toISOString()}
 * Rationale: ${blueprint.rationale || 'N/A'}
 */

const WIDTH = ${width};
const HEIGHT = ${height};

export default {
  id: 'trained-gen${genId}',
  name: 'Trained Village (Gen ${genId})',
  width: WIDTH,
  height: HEIGHT,
  tileSize: 16,
  spawnPoint: { x: ${Math.floor(width / 2)}, y: ${Math.floor(height / 2)} },

  ground: [
${formatLayer(ground, 'ground')}
  ].flat(),

  objects: [
${formatLayer(objects, 'objects')}
  ].flat(),

  foreground: [
${formatLayer(foreground, 'foreground')}
  ].flat(),

  collision: [
${formatLayer(collision, 'collision')}
  ].flat(),

  npcs: [],
  worldObjects: [],
  animals: [],
  quests: [],
  dialogues: {},
  transitions: []
};
`;
}

// ══════════════════════════════════════════════════════════════════════════
// BATCH MODE — Automated vision-scored evolution
// ══════════════════════════════════════════════════════════════════════════

// ── API: Upload reference image ─────────────────────────────────────────
app.post('/api/reference-image', express.raw({ type: 'image/*', limit: '10mb' }), (req, res) => {
  const filename = 'reference-' + Date.now() + '.png';
  const filepath = path.join(REFERENCE_DIR, filename);
  fs.writeFileSync(filepath, req.body);
  batchState.referenceImage = req.body.toString('base64');
  console.log(`[Reference] Saved ${filepath} (${req.body.length} bytes)`);
  res.json({ success: true, filename, path: `/reference-images/${filename}` });
});

// ── API: Upload reference via multipart form ────────────────────────────
app.post('/api/reference-upload', express.urlencoded({ extended: true, limit: '10mb' }), (req, res) => {
  // Handle base64 data URL from file reader
  const dataUrl = req.body.image;
  if (!dataUrl) return res.status(400).json({ error: 'No image data' });
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const filename = 'reference-' + Date.now() + '.png';
  const filepath = path.join(REFERENCE_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  batchState.referenceImage = base64;
  console.log(`[Reference] Saved ${filepath} (${buffer.length} bytes)`);
  res.json({ success: true, filename, path: `/reference-images/${filename}`, size: buffer.length });
});
// Also accept JSON
app.post('/api/reference-upload-json', (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image data' });
  const base64 = image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const filename = 'reference-' + Date.now() + '.png';
  const filepath = path.join(REFERENCE_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  batchState.referenceImage = base64;
  console.log(`[Reference] Saved ${filepath} (${buffer.length} bytes)`);
  res.json({ success: true, filename, path: `/reference-images/${filename}`, size: buffer.length });
});

// ── API: List reference images ──────────────────────────────────────────
app.get('/api/reference-images', (req, res) => {
  const files = fs.readdirSync(REFERENCE_DIR).filter(f => /\.(png|jpg|jpeg|gif)$/i.test(f));
  res.json({ images: files.map(f => ({ filename: f, path: `/reference-images/${f}` })) });
});

// ── API: Get batch status ───────────────────────────────────────────────
app.get('/api/batch/status', (req, res) => {
  res.json({
    running: batchState.running,
    totalGenerations: batchState.totalGenerations,
    completedGenerations: batchState.completedGenerations,
    currentGeneration: batchState.currentGeneration,
    elapsed: batchState.startTime ? Date.now() - batchState.startTime : 0,
    errors: batchState.errors,
    topResultsCount: batchState.topResults.length,
    hasReferenceImage: !!batchState.referenceImage,
    bestVisionScore: batchState.bestVisionScore || 0,
    targetVisionScore: batchState.targetVisionScore || 60,
    log: batchState.log.slice(-50), // last 50 log entries
    aborted: batchState.aborted
  });
});

// ── API: Get batch top results (for final human vote) ───────────────────
app.get('/api/batch/results', (req, res) => {
  res.json({
    results: batchState.topResults.map(r => ({
      generationId: r.generationId,
      candidateId: r.candidateId,
      variation: r.variation,
      visionScore: r.visionScore,
      auditScore: r.auditScore,
      combinedScore: r.combinedScore,
      rationale: r.rationale,
      critique: r.critique,
      strengths: r.strengths,
      weaknesses: r.weaknesses,
      imagePath: r.imagePath,
      blueprint: r.blueprint
    }))
  });
});

// ── API: Start batch run ────────────────────────────────────────────────
app.post('/api/batch/start', async (req, res) => {
  if (batchState.running) {
    return res.status(409).json({ error: 'Batch already running' });
  }
  if (!batchState.referenceImage) {
    return res.status(400).json({ error: 'Upload a reference image first' });
  }
  if (!renderMapToPng || !scoreMapWithVision) {
    return res.status(500).json({ error: 'tile-renderer or vision-scorer modules not loaded' });
  }

  const maxGens = Math.max(10, Math.min(10000, parseInt(req.body.generations) || 1000));
  const targetVisionScore = parseInt(req.body.targetVisionScore) || 60; // stop when vision score reaches this
  const mapParams = req.body.mapParams || { width: 60, height: 40, theme: 'village', buildingCount: 3, treeDensity: 'medium' };

  batchState.running = true;
  batchState.aborted = false;
  batchState.totalGenerations = maxGens;
  batchState.completedGenerations = 0;
  batchState.currentGeneration = 0;
  batchState.startTime = Date.now();
  batchState.topResults = [];
  batchState.errors = 0;
  batchState.log = [];
  batchState.targetVisionScore = targetVisionScore;
  batchState.bestVisionScore = 0;

  const addLog = (msg) => {
    const entry = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    batchState.log.push(entry);
    console.log(`[Batch] ${msg}`);
  };

  addLog(`Starting batch: up to ${maxGens} gens, target vision score: ${targetVisionScore}`);
  res.json({ success: true, totalGenerations: maxGens, targetVisionScore });

  // Run batch asynchronously
  runBatch(totalGens, mapParams, addLog).catch(err => {
    addLog(`FATAL ERROR: ${err.message}`);
    batchState.running = false;
  });
});

// ── API: Abort batch run ────────────────────────────────────────────────
app.post('/api/batch/abort', (req, res) => {
  if (!batchState.running) {
    return res.status(400).json({ error: 'No batch running' });
  }
  batchState.aborted = true;
  res.json({ success: true, message: 'Abort signal sent' });
});

// ── Batch runner ────────────────────────────────────────────────────────
async function runBatch(totalGens, mapParams, addLog) {
  const memory = loadMemory();
  const semantics = loadSemantics();
  const refImageBase64 = batchState.referenceImage;
  const WAVE_SIZE = parseInt(process.env.WAVE_SIZE) || 5; // parallel generations per wave

  // ── Optimization settings ──────────────────────────────────────────
  const VISION_EVERY_N = 2;      // Vision score every Nth wave (more frequent since vision is target metric)
  const PLATEAU_WINDOW = 20;     // Check last N scores for plateau
  const PLATEAU_THRESHOLD = 3;   // Score improvement less than this = plateau
  const recentBestScores = [];

  addLog(`Parallel mode: ${WAVE_SIZE} gens/wave | Vision every ${VISION_EVERY_N}th gen | Early stop after ${PLATEAU_WINDOW} plateau`);

  // ── Simulated annealing: temperature decays over time ─────────────
  function getTemperatures(gen, maxGen) {
    const progress = gen / maxGen;
    return {
      conservative: 0.3 + 0.4 * (1 - progress),  // 0.7 → 0.3
      exploratory: 0.4 + 0.5 * (1 - progress),    // 0.9 → 0.4
      creative: Math.min(1.0, 0.5 + 0.5 * (1 - progress))  // 1.0 → 0.5 (capped at 1.0)
    };
  }

  // ── Helper: run a single generation, return its winner ────────────
  async function runOneGeneration(gen, genId, memorySnapshot, useVision) {
    const variations = ['conservative', 'exploratory', 'creative'];
    const temperatures = getTemperatures(gen, totalGens);

    // Generate 3 candidates in parallel
    const candidateResults = await Promise.all(variations.map(async (variation, idx) => {
      const candidateId = `gen${genId}_${String.fromCharCode(97 + idx)}`;
      const { system, user } = buildPrompt({
        variation,
        generationNumber: genId,
        evolutionMemory: memorySnapshot,
        tileSemantics: semantics,
        mapParams
      });

      let blueprint;
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          temperature: temperatures[variation],
          system,
          messages: [{ role: 'user', content: user }]
        });
        const text = response.content[0].text.trim();
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
        blueprint = JSON.parse(jsonMatch[1].trim());
      } catch (e) {
        addLog(`  gen${genId}_${String.fromCharCode(97 + idx)} LLM error: ${e.message.slice(0, 60)}`);
        blueprint = generateFallbackBlueprint(mapParams);
      }

      const tileData = expandBlueprint(blueprint);
      const audit = auditMap(tileData);

      let mapPngBuffer;
      try {
        mapPngBuffer = await renderMapToPng(tileData, TILESET_PATH);
      } catch (e) {
        return null;
      }

      // Vision scoring is expensive — skip it unless this is a vision generation
      // Use audit score as primary fitness; vision only validates periodically
      let visionResult = { score: 0, critique: '', strengths: [], weaknesses: [], suggestions: [] };
      let combinedScore = audit.score; // audit-only by default

      return {
        candidateId, generationId: genId, variation, blueprint, audit,
        visionScore: visionResult.score, auditScore: audit.score, combinedScore,
        rationale: blueprint.rationale,
        critique: visionResult.critique,
        strengths: visionResult.strengths || [],
        weaknesses: visionResult.weaknesses || [],
        suggestions: visionResult.suggestions || [],
        mapPngBuffer
      };
    }));

    const valid = candidateResults.filter(Boolean);
    if (valid.length === 0) return null;

    valid.sort((a, b) => b.combinedScore - a.combinedScore);
    return valid[0]; // return the winner
  }

  // ── Main loop: process in waves ───────────────────────────────────
  let gensCompleted = 0;
  const baseGenId = memory.currentGeneration;

  while (gensCompleted < totalGens && !batchState.aborted) {
    const waveSize = Math.min(WAVE_SIZE, totalGens - gensCompleted);
    const waveStart = gensCompleted + 1;
    const waveEnd = gensCompleted + waveSize;

    addLog(`Wave: Gen ${waveStart}-${waveEnd} of ${totalGens} (${waveSize} parallel)...`);

    // Snapshot current memory state for all gens in this wave
    const memorySnapshot = JSON.parse(JSON.stringify({
      currentGeneration: memory.currentGeneration,
      learnedRules: memory.learnedRules,
      generations: memory.generations.slice(-5),
      bestMaps: memory.bestMaps
    }));

    // Determine if this wave gets vision scoring
    const isVisionWave = (gensCompleted === 0) || ((gensCompleted / WAVE_SIZE) % VISION_EVERY_N === 0);
    if (isVisionWave) addLog(`  (Vision scoring enabled for this wave)`);

    // Launch wave — all generations in parallel
    const wavePromises = [];
    for (let i = 0; i < waveSize; i++) {
      const gen = gensCompleted + i + 1;
      const genId = baseGenId + gen;
      wavePromises.push(
        runOneGeneration(gen, genId, memorySnapshot, false).catch(err => {
          addLog(`  Gen ${gen} ERROR: ${err.message.slice(0, 60)}`);
          batchState.errors++;
          if (err.status === 429) return 'RATE_LIMITED';
          return null;
        })
      );
    }

    const waveResults = await Promise.all(wavePromises);

    // Check for rate limiting
    if (waveResults.includes('RATE_LIMITED')) {
      addLog(`  Rate limited! Waiting 30s before next wave...`);
      await new Promise(r => setTimeout(r, 30000));
    }

    // Process wave results — find the wave winner and update memory
    const waveWinners = waveResults.filter(r => r && r !== 'RATE_LIMITED');

    for (const winner of waveWinners) {
      // Save winner PNG
      const pngFilename = `gen${winner.generationId}_${winner.variation}_score${winner.combinedScore}.png`;
      const pngPath = path.join(BATCH_RESULTS_DIR, pngFilename);
      fs.writeFileSync(pngPath, winner.mapPngBuffer);

      // Add to top results
      const resultEntry = { ...winner, imagePath: `/batch-results/${pngFilename}` };
      delete resultEntry.mapPngBuffer;
      batchState.topResults.push(resultEntry);

      addLog(`  Gen ${winner.generationId}: Winner=${winner.candidateId} (${winner.variation}) vision=${winner.visionScore} audit=${winner.auditScore} combined=${winner.combinedScore}`);
    }

    // Sort and trim top results
    batchState.topResults.sort((a, b) => b.combinedScore - a.combinedScore);
    if (batchState.topResults.length > batchState.keepTopN) {
      batchState.topResults = batchState.topResults.slice(0, batchState.keepTopN);
    }

    // Pick the BEST winner from this wave to update memory
    if (waveWinners.length > 0) {
      waveWinners.sort((a, b) => b.combinedScore - a.combinedScore);
      const bestOfWave = waveWinners[0];

      // Tournament: vision-score ONLY the wave winner, and only on vision waves
      if (isVisionWave && scoreMapWithVision && bestOfWave.mapPngBuffer) {
        try {
          const visionResult = await scoreMapWithVision({
            apiKey,
            generatedMapPng: bestOfWave.mapPngBuffer,
            referenceImagePng: Buffer.from(refImageBase64, 'base64'),
            generationNumber: bestOfWave.generationId,
            candidateId: bestOfWave.candidateId,
            variation: bestOfWave.variation,
            rationale: bestOfWave.rationale || '',
            learnedRules: memory.learnedRules
          });
          bestOfWave.visionScore = visionResult.score;
          bestOfWave.combinedScore = Math.round(visionResult.score * 0.6 + bestOfWave.auditScore * 0.4);
          bestOfWave.critique = visionResult.critique;
          bestOfWave.strengths = visionResult.strengths || [];
          bestOfWave.weaknesses = visionResult.weaknesses || [];
          bestOfWave.suggestions = visionResult.suggestions || [];
          bestOfWave.tilePlacementRules = visionResult.tilePlacementRules || [];
          addLog(`  Vision score for wave winner: ${visionResult.score} → combined ${bestOfWave.combinedScore}`);
          // Track best vision score
          if (visionResult.score > batchState.bestVisionScore) {
            batchState.bestVisionScore = visionResult.score;
            addLog(`  New best vision score: ${visionResult.score}!`);
          }
          // Check if target reached
          if (visionResult.score >= (batchState.targetVisionScore || 60)) {
            addLog(`TARGET REACHED! Vision score ${visionResult.score} >= ${batchState.targetVisionScore}. Stopping.`);
            // Save memory before stopping
            saveMemory(memory);
            batchState.running = false;
            const elapsed = Math.round((Date.now() - batchState.startTime) / 1000);
            addLog(`Batch complete: ${gensCompleted + waveSize} gens in ${elapsed}s. Target achieved!`);
            batchState.completedGenerations = gensCompleted + waveSize;
            return; // exit the entire batch
          }
        } catch (e) {
          addLog(`  Vision scoring error: ${e.message.slice(0, 60)}`);
        }
      }

      const visionFeedback = bestOfWave.critique + ' ' + (bestOfWave.suggestions || []).join('. ');
      const genRecord = {
        id: bestOfWave.generationId,
        timestamp: new Date().toISOString(),
        candidates: waveWinners.map(c => ({
          candidateId: c.candidateId, blueprint: c.blueprint,
          auditScore: c.auditScore, visionScore: c.visionScore,
          combinedScore: c.combinedScore, variationStrategy: c.variation
        })),
        vote: { winner: bestOfWave.candidateId, method: 'vision-auto-wave', timestamp: new Date().toISOString() },
        feedback: visionFeedback,
        diffFromPrevious: null
      };

      memory.generations.push(genRecord);
      memory.currentGeneration = bestOfWave.generationId;
      memory.bestMaps.push({
        generationId: bestOfWave.generationId,
        candidateId: bestOfWave.candidateId,
        blueprint: bestOfWave.blueprint,
        auditScore: bestOfWave.auditScore,
        visionScore: bestOfWave.visionScore
      });
      if (memory.bestMaps.length > 5) memory.bestMaps = memory.bestMaps.slice(-5);

      // Extract learned rules from wave winner
      if (extractRulesFromCritique) {
        // Pass the full vision result (with tilePlacementRules) for high-quality rule extraction
        const visionData = {
          critique: bestOfWave.critique,
          suggestions: bestOfWave.suggestions,
          weaknesses: bestOfWave.weaknesses,
          tilePlacementRules: bestOfWave.tilePlacementRules || []
        };
        const newRules = extractRulesFromCritique(visionData, bestOfWave.generationId);
        for (const rule of newRules) {
          const existing = memory.learnedRules.find(r =>
            r.rule.toLowerCase().includes(rule.rule.toLowerCase().slice(0, 20))
          );
          if (existing) {
            existing.confidence = Math.min(1.0, existing.confidence + 0.05);
          } else {
            memory.learnedRules.push(rule);
          }
        }
        if (memory.learnedRules.length > 50) {
          memory.learnedRules.sort((a, b) => b.confidence - a.confidence);
          memory.learnedRules = memory.learnedRules.slice(0, 50);
        }
      }

      // Trim old generations
      if (memory.generations.length > 100) {
        memory.generations = memory.generations.slice(-100);
      }

      saveMemory(memory);
    }

    gensCompleted += waveSize;
    batchState.completedGenerations = gensCompleted;
    batchState.currentGeneration = gensCompleted;

    // Track best score for early stopping
    if (waveWinners.length > 0) {
      recentBestScores.push(waveWinners[0].combinedScore);
    }

    // Early stopping: if scores plateaued over last N waves, stop
    if (recentBestScores.length >= PLATEAU_WINDOW) {
      const window = recentBestScores.slice(-PLATEAU_WINDOW);
      const maxScore = Math.max(...window);
      const minScore = Math.min(...window);
      if (maxScore - minScore < PLATEAU_THRESHOLD) {
        addLog(`Early stopping: scores plateaued (range ${minScore}-${maxScore} over last ${PLATEAU_WINDOW} waves)`);
        break;
      }
    }

    // Brief pause between waves
    if (gensCompleted < totalGens && !batchState.aborted) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  batchState.running = false;
  const elapsed = Math.round((Date.now() - batchState.startTime) / 1000);
  addLog(`Batch complete: ${batchState.completedGenerations} generations in ${elapsed}s. Top score: ${batchState.topResults[0]?.combinedScore || 'N/A'}`);
  addLog(`${batchState.topResults.length} results saved for final human vote.`);
}

// ── Start server ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
// LOCAL MODE — WFC + optional Ollama
// ══════════════════════════════════════════════════════════════════════════

let generateWithWFC, buildWFCRules, generateBlueprintLocal, checkOllamaStatus;
try {
  ({ generateWithWFC, buildWFCRules } = require('./wfc-generator'));
  console.log('  WFC generator loaded');
} catch (e) { console.warn('  WFC generator not loaded:', e.message); }
try {
  ({ generateBlueprintLocal, checkOllamaStatus } = require('./local-llm'));
  console.log('  Local LLM module loaded');
} catch (e) { console.warn('  Local LLM not loaded:', e.message); }

// ── API: WFC batch (pure local, no API calls) ──────────────────────────
app.post('/api/batch/wfc', async (req, res) => {
  if (!generateWithWFC) return res.status(500).json({ error: 'WFC generator not loaded' });
  if (batchState.running) return res.status(409).json({ error: 'Batch already running' });

  const totalGens = Math.max(10, Math.min(100000, parseInt(req.body.generations) || 1000));
  const mapParams = req.body.mapParams || { width: 60, height: 40, theme: 'village', buildingCount: 3, treeDensity: 'medium' };

  batchState.running = true;
  batchState.aborted = false;
  batchState.totalGenerations = totalGens;
  batchState.completedGenerations = 0;
  batchState.startTime = Date.now();
  batchState.topResults = [];
  batchState.errors = 0;
  batchState.log = [];

  const addLog = (msg) => {
    batchState.log.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
    console.log(`[WFC Batch] ${msg}`);
  };

  addLog(`Starting WFC batch: ${totalGens} maps (pure local, no API)`);
  res.json({ success: true, totalGenerations: totalGens, mode: 'wfc-local' });

  // Run WFC batch async
  (async () => {
    try {
      const refImageBase64 = batchState.referenceImage;
      const WAVE_SIZE = 50; // WFC is so fast we can do 50 at a time
      const VISION_EVERY = 50; // Vision-check every 50th map

      for (let i = 0; i < totalGens && !batchState.aborted; i += WAVE_SIZE) {
        const waveSize = Math.min(WAVE_SIZE, totalGens - i);
        const waveResults = [];

        for (let j = 0; j < waveSize; j++) {
          const gen = i + j + 1;
          const seed = Date.now() + gen * 7919; // unique seed per map
          const result = generateWithWFC({
            width: mapParams.width || 60,
            height: mapParams.height || 40,
            theme: mapParams.theme || 'village',
            seed
          });

          if (!result.success) { batchState.errors++; continue; }

          const audit = auditMap(result);
          waveResults.push({ gen, result, audit, seed });
        }

        // Pick top result from wave by audit score
        waveResults.sort((a, b) => b.audit.score - a.audit.score);
        const best = waveResults[0];

        if (best) {
          // Render best to PNG
          let mapPngBuffer;
          try {
            mapPngBuffer = await renderMapToPng(best.result, TILESET_PATH);
          } catch (e) {
            addLog(`  Render error: ${e.message.slice(0, 60)}`);
            batchState.errors++;
            batchState.completedGenerations = i + waveSize;
            continue;
          }

          // Vision score periodically
          let visionScore = 0;
          let combinedScore = best.audit.score;
          let critique = '';

          if (scoreMapWithVision && refImageBase64 && (i === 0 || (i % (VISION_EVERY * WAVE_SIZE) === 0))) {
            try {
              const visionResult = await scoreMapWithVision({
                apiKey,
                generatedMapPng: mapPngBuffer,
                referenceImagePng: Buffer.from(refImageBase64, 'base64'),
                generationNumber: best.gen,
                candidateId: `wfc_${best.gen}`,
                variation: 'wfc-local',
                rationale: 'WFC generated',
                learnedRules: []
              });
              visionScore = visionResult.score;
              combinedScore = Math.round(visionScore * 0.6 + best.audit.score * 0.4);
              critique = visionResult.critique || '';
              addLog(`  Vision check: ${visionScore} → combined ${combinedScore}`);
            } catch (e) {
              // Vision scoring optional for WFC mode
            }
          }

          const pngFilename = `wfc_gen${best.gen}_audit${best.audit.score}_seed${best.seed}.png`;
          fs.writeFileSync(path.join(BATCH_RESULTS_DIR, pngFilename), mapPngBuffer);

          batchState.topResults.push({
            generationId: best.gen,
            candidateId: `wfc_${best.gen}`,
            variation: 'wfc-local',
            visionScore,
            auditScore: best.audit.score,
            combinedScore,
            rationale: `WFC seed=${best.seed}`,
            critique,
            strengths: [],
            weaknesses: [],
            imagePath: `/batch-results/${pngFilename}`
          });
          batchState.topResults.sort((a, b) => b.combinedScore - a.combinedScore);
          if (batchState.topResults.length > batchState.keepTopN) {
            batchState.topResults = batchState.topResults.slice(0, batchState.keepTopN);
          }

          addLog(`  Wave ${Math.floor(i/WAVE_SIZE)+1}: ${waveSize} maps, best audit=${best.audit.score}, top overall=${batchState.topResults[0]?.combinedScore || best.audit.score}`);
        }

        batchState.completedGenerations = Math.min(i + waveSize, totalGens);
        batchState.currentGeneration = batchState.completedGenerations;
      }

      batchState.running = false;
      const elapsed = Math.round((Date.now() - batchState.startTime) / 1000);
      addLog(`WFC batch complete: ${batchState.completedGenerations} maps in ${elapsed}s. Top: ${batchState.topResults[0]?.combinedScore || 'N/A'}`);
    } catch (err) {
      addLog(`WFC FATAL: ${err.message}`);
      batchState.running = false;
    }
  })();
});

// ── API: Genetic Evolution (fully automated, like AI learning to walk) ──
let GeneticEvolver;
try {
  ({ GeneticEvolver } = require('./genetic-evolver'));
  console.log('  Genetic evolver loaded');
} catch (e) { console.warn('  Genetic evolver not loaded:', e.message); }

let TileRelationshipLearner, tileLearner;
const KNOWLEDGE_PATH = path.join(TRAINER_DIR, 'learned-tile-knowledge.json');
try {
  ({ TileRelationshipLearner } = require('./tile-relationship-learner'));
  tileLearner = new TileRelationshipLearner();
  // Load existing knowledge if available
  if (fs.existsSync(KNOWLEDGE_PATH)) {
    tileLearner.loadFromFile(KNOWLEDGE_PATH);
    const stats = tileLearner.getStats();
    console.log(`  Tile learner loaded: ${stats.totalMapsLearned} maps, ${stats.totalRelationships} relationships`);
  } else {
    console.log('  Tile learner ready (no prior knowledge)');
  }
} catch (e) { console.warn('  Tile relationship learner not loaded:', e.message); }

app.post('/api/batch/evolve', async (req, res) => {
  if (!GeneticEvolver) return res.status(500).json({ error: 'Genetic evolver not loaded' });
  if (batchState.running) return res.status(409).json({ error: 'Batch already running' });
  if (!batchState.referenceImage) return res.status(400).json({ error: 'Upload a reference image first' });

  const maxGens = Math.min(10000, parseInt(req.body.generations) || 500);
  const popSize = Math.min(30, parseInt(req.body.populationSize) || 12);
  const targetScore = parseInt(req.body.targetVisionScore) || 65;
  const mapW = 60, mapH = 40;

  batchState.running = true;
  batchState.aborted = false;
  batchState.totalGenerations = maxGens;
  batchState.completedGenerations = 0;
  batchState.startTime = Date.now();
  batchState.topResults = [];
  batchState.errors = 0;
  batchState.log = [];
  batchState.targetVisionScore = targetScore;
  batchState.bestVisionScore = 0;

  const addLog = (msg) => {
    batchState.log.push(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
    console.log(`[Evolve] ${msg}`);
  };

  addLog(`Genetic evolution: pop=${popSize}, max=${maxGens} gens, target vision=${targetScore}`);
  res.json({ success: true, mode: 'genetic-evolve', totalGenerations: maxGens, populationSize: popSize });

  // Run evolution async
  (async () => {
    try {
      const evolver = new GeneticEvolver({ populationSize: popSize, mapSize: { width: mapW, height: mapH } });
      let population = evolver.initPopulation();
      const refImageBuf = Buffer.from(batchState.referenceImage, 'base64');
      const VISION_EVERY = 3; // vision-score best organism every Nth generation

      for (let gen = 1; gen <= maxGens && !batchState.aborted; gen++) {
        batchState.currentGeneration = gen;

        // Generate maps from all DNA, get audit scores (fast, local)
        const scored = [];
        for (const dna of population) {
          const mapData = evolver.generateFromDNA(dna);
          const audit = auditMap(mapData);
          scored.push({ dna, fitness: audit.score, mapData, audit });
        }
        scored.sort((a, b) => b.fitness - a.fitness);

        const bestOrganism = scored[0];
        const stats = evolver.getStats(scored);

        // Vision-score the best organism periodically
        let visionScore = 0;
        let critique = '';
        let tilePlacementRules = [];

        if (scoreMapWithVision && renderMapToPng && (gen === 1 || gen % VISION_EVERY === 0)) {
          try {
            const pngBuf = await renderMapToPng(bestOrganism.mapData, TILESET_PATH);
            const visionResult = await scoreMapWithVision({
              apiKey,
              generatedMapPng: pngBuf,
              referenceImagePng: refImageBuf,
              generationNumber: gen,
              candidateId: `evo_gen${gen}`,
              variation: 'genetic',
              rationale: `Gen ${gen} best (audit=${bestOrganism.fitness})`,
              learnedRules: []
            });
            visionScore = visionResult.score || 0;
            critique = visionResult.critique || '';
            tilePlacementRules = visionResult.tilePlacementRules || [];

            if (visionScore > batchState.bestVisionScore) {
              batchState.bestVisionScore = visionScore;
            }

            // Save the best map image
            const pngFilename = `evo_gen${gen}_audit${bestOrganism.fitness}_vision${visionScore}.png`;
            fs.writeFileSync(path.join(BATCH_RESULTS_DIR, pngFilename), pngBuf);

            const combinedScore = Math.round(visionScore * 0.6 + bestOrganism.fitness * 0.4);
            batchState.topResults.push({
              generationId: gen,
              candidateId: `evo_gen${gen}`,
              variation: 'genetic',
              visionScore,
              auditScore: bestOrganism.fitness,
              combinedScore,
              rationale: `Gen ${gen}: ${JSON.stringify(stats)}`,
              critique,
              strengths: [],
              weaknesses: [],
              imagePath: `/batch-results/${pngFilename}`,
              dna: bestOrganism.dna
            });
            batchState.topResults.sort((a, b) => b.combinedScore - a.combinedScore);
            if (batchState.topResults.length > 20) batchState.topResults = batchState.topResults.slice(0, 20);

            addLog(`Gen ${gen}: best=${stats.best.toFixed(0)} avg=${stats.avg.toFixed(0)} diversity=${stats.diversity.toFixed(1)} | VISION=${visionScore}`);

            // LEARN: Feed high-scoring maps into tile relationship learner
            if (tileLearner && bestOrganism.fitness >= 50) {
              tileLearner.learnFromMap(bestOrganism.mapData, bestOrganism.fitness);
              // Save knowledge periodically (every 10 vision-checked gens)
              if (gen % (VISION_EVERY * 10) === 0) {
                tileLearner.saveToFile(KNOWLEDGE_PATH);
                const lStats = tileLearner.getStats();
                addLog(`  Tile knowledge saved: ${lStats.totalMapsLearned} maps, ${lStats.totalRelationships} relationships`);
              }
            }

            // Check target
            if (visionScore >= targetScore) {
              addLog(`TARGET REACHED! Vision ${visionScore} >= ${targetScore}`);
              break;
            }
          } catch (e) {
            addLog(`Gen ${gen} vision error: ${e.message.slice(0, 60)}`);
          }
        } else {
          addLog(`Gen ${gen}: best=${stats.best.toFixed(0)} avg=${stats.avg.toFixed(0)} diversity=${stats.diversity.toFixed(1)}`);
        }

        // Diminishing returns detection — stop if scores plateau
        if (!recentBestScores) var recentBestScores = [];
        recentBestScores.push(stats.best);
        if (recentBestScores.length >= 30) {
          const window = recentBestScores.slice(-30);
          const maxW = Math.max(...window), minW = Math.min(...window);
          if (maxW - minW < 2) {
            addLog(`Diminishing returns: audit scores plateaued (${minW.toFixed(0)}-${maxW.toFixed(0)}) over 30 gens. Stopping.`);
            break;
          }
        }
        // Also stop if diversity collapses (all organisms converged)
        if (stats.diversity < 0.5 && gen > 20) {
          addLog(`Convergence: population diversity collapsed (${stats.diversity.toFixed(2)}). Stopping.`);
          break;
        }

        // Evolve to next generation
        population = evolver.evolveGeneration(scored);
        batchState.completedGenerations = gen;

        // Rate limit pause on vision generations
        if (gen % VISION_EVERY === 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      batchState.running = false;
      const elapsed = Math.round((Date.now() - batchState.startTime) / 1000);
      addLog(`Evolution complete: ${batchState.completedGenerations} gens in ${elapsed}s. Best vision: ${batchState.bestVisionScore}`);

      // Save all learned tile knowledge
      if (tileLearner) {
        tileLearner.extractComposites();
        tileLearner.saveToFile(KNOWLEDGE_PATH);
        const lStats = tileLearner.getStats();
        addLog(`Tile knowledge saved: ${lStats.totalMapsLearned} maps, ${lStats.uniqueTiles} unique tiles, ${lStats.totalRelationships} relationships`);
        if (lStats.topComposites && lStats.topComposites.length > 0) {
          addLog(`Learned composites: ${lStats.topComposites.map(c => c.id + '(x' + c.count + ')').join(', ')}`);
        }
      }
    } catch (err) {
      addLog(`FATAL: ${err.message}`);
      batchState.running = false;
    }
  })();
});

// ── API: Tile Knowledge ─────────────────────────────────────────────────
app.get('/api/knowledge', (req, res) => {
  if (!tileLearner) return res.json({ available: false });
  const stats = tileLearner.getStats();
  const knowledge = tileLearner.exportKnowledge();
  // Summarize top adjacency rules for display
  const topRules = [];
  for (const [tileA, dirs] of Object.entries(knowledge.adjacency || {})) {
    for (const [dir, neighbors] of Object.entries(dirs)) {
      const sorted = Object.entries(neighbors).sort((a, b) => b[1] - a[1]).slice(0, 3);
      for (const [tileB, count] of sorted) {
        if (count >= 3 && parseInt(tileB) >= 0) {
          topRules.push({ tileA: parseInt(tileA), direction: dir, tileB: parseInt(tileB), count });
        }
      }
    }
  }
  topRules.sort((a, b) => b.count - a.count);
  res.json({
    available: true,
    stats,
    topRules: topRules.slice(0, 50),
    composites: Object.values(knowledge.composites || {}).sort((a, b) => b.count - a.count).slice(0, 20)
  });
});

// ── API: Check local capabilities ───────────────────────────────────────
app.get('/api/local/status', async (req, res) => {
  const wfcAvailable = !!generateWithWFC;
  let ollamaStatus = { running: false, models: [], recommended: null };
  if (checkOllamaStatus) {
    try { ollamaStatus = await checkOllamaStatus(); } catch (e) {}
  }
  res.json({ wfc: wfcAvailable, ollama: ollamaStatus });
});

// ── Auto-load default reference image ────────────────────────────────────
const defaultRefPath = path.join(REFERENCE_DIR, 'kenney-tiny-town-sample.png');
if (fs.existsSync(defaultRefPath) && !batchState.referenceImage) {
  batchState.referenceImage = fs.readFileSync(defaultRefPath).toString('base64');
  console.log('  Default reference image loaded: kenney-tiny-town-sample.png');
}

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║     Map Generation Training Tool v1.0            ║
  ║     http://localhost:${PORT}                       ║
  ╠══════════════════════════════════════════════════╣
  ║  API Key: ${'*'.repeat(8)}...${apiKey.slice(-4).padStart(8)}           ║
  ║  Memory:  ${MEMORY_PATH.split(path.sep).slice(-2).join('/')}     ║
  ║  Model:   claude-sonnet-4-20250514               ║
  ╚══════════════════════════════════════════════════╝
  `);
});
