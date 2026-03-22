"use strict";

/**
 * prompt-builder.js
 *
 * Assembles Claude API prompts for map generation based on the current
 * evolution state. Builds system + user prompts for each of the 3 candidate
 * variations (Conservative, Exploratory, Creative) per generation.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compile a readable block for one semantic zone.
 */
function formatZone(name, zone) {
  const lines = [`ZONE: ${name}`];
  if (zone.description) {
    lines.push(`Description: ${zone.description}`);
  }
  if (zone.treeTypes) {
    lines.push(`Tree types available: ${zone.treeTypes.join(", ")}`);
  }
  if (zone.tileDistribution) {
    const dist = Object.entries(zone.tileDistribution)
      .map(([id, pct]) => `tile ${id} (${pct})`)
      .join(", ");
    lines.push(`Tile distribution: ${dist}`);
  }
  if (zone.tiles) {
    const parts = Object.entries(zone.tiles)
      .map(([role, id]) => `${role}=${id}`)
      .join(", ");
    lines.push(`Tiles: ${parts}`);
  }
  if (zone.templates) {
    lines.push(`Templates: ${zone.templates.join(", ")}`);
  }
  if (zone.items) {
    if (Array.isArray(zone.items)) {
      lines.push(`Items: ${zone.items.join(", ")}`);
    } else {
      const parts = Object.entries(zone.items)
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`)
        .join(", ");
      lines.push(`Items: ${parts}`);
    }
  }
  if (zone.decorations) {
    lines.push(`Decorations (tile IDs): ${zone.decorations.join(", ")}`);
  }
  if (zone.size) {
    lines.push(`Size: ${zone.size}`);
  }
  if (zone.rules && zone.rules.length) {
    lines.push(`Rules: ${zone.rules.join("; ")}`);
  }
  return lines.join("\n");
}

/**
 * Compile a readable line for one building template.
 */
function formatBuildingTemplate(tmpl) {
  return `- ${tmpl.id} (${tmpl.width}x${tmpl.height}): ${tmpl.name}`;
}

/**
 * Return a compact one-line summary of a winning blueprint (zones only).
 */
function compactBlueprintSummary(blueprint) {
  if (!blueprint) return "(none)";
  if (blueprint.zones) {
    const zoneSummary = blueprint.zones.map((z) => {
      if (z.type === "building-zone") {
        return `${z.template}@(${z.position.x},${z.position.y})`;
      }
      if (z.type === "path") {
        return `path[${z.waypoints.length}pts]`;
      }
      if (z.bounds) {
        return `${z.type}(${z.bounds.x},${z.bounds.y} ${z.bounds.w}x${z.bounds.h})`;
      }
      if (z.position) {
        return `${z.type}@(${z.position.x},${z.position.y})`;
      }
      if (z.center) {
        return `${z.type}@(${z.center.x},${z.center.y})`;
      }
      return z.type;
    });
    return zoneSummary.join(", ");
  }
  return JSON.stringify(blueprint).slice(0, 200);
}

/**
 * Summarize a generation entry into a single line.
 */
function summarizeGeneration(gen) {
  const winner = gen.winnerCandidate || "?";
  const feedback = gen.feedback || gen.humanFeedback || "";
  const short =
    feedback.length > 80 ? feedback.slice(0, 77) + "..." : feedback;
  return `Gen ${gen.generation}: Winner=${winner}, Feedback: "${short}"`;
}

/**
 * Auto-suggest an improvement area based on the last generation's audit
 * scores or feedback.
 */
function suggestImprovement(evolutionMemory) {
  const gens = evolutionMemory.generations || [];
  if (gens.length === 0) return "Follow all rules carefully";

  const last = gens[gens.length - 1];
  const audit = last.auditScores || last.audit || null;

  if (audit) {
    // Find lowest-scoring area
    let lowest = null;
    let lowestScore = Infinity;
    for (const [area, score] of Object.entries(audit)) {
      const num = typeof score === "number" ? score : parseFloat(score);
      if (!isNaN(num) && num < lowestScore) {
        lowestScore = num;
        lowest = area;
      }
    }
    if (lowest) {
      return `Improve ${lowest} (scored ${lowestScore} last generation)`;
    }
  }

  // Fallback: extract hint from feedback
  const feedback = last.feedback || last.humanFeedback || "";
  if (feedback) {
    return `Address feedback: "${feedback.slice(0, 80)}"`;
  }

  return "Refine overall layout quality";
}

/**
 * Get the previous winner blueprint from the last generation.
 */
function getPreviousWinner(evolutionMemory) {
  const gens = evolutionMemory.generations || [];
  if (gens.length === 0) return null;

  const last = gens[gens.length - 1];
  return last.winnerBlueprint || last.winner || null;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(tileSemantics, evolutionMemory) {
  const parts = [];

  // 1. Role
  parts.push(
    "You are a tile-based RPG map designer for a children's game called Princess Sparkle. " +
      "You design maps as semantic zone blueprints. You NEVER pick individual tile IDs — " +
      "you specify zones and the rule engine handles tile selection."
  );

  // 2. Semantic zone vocabulary
  const zones = tileSemantics.semanticZones || {};
  const zoneLines = Object.entries(zones).map(([name, zone]) =>
    formatZone(name, zone)
  );
  if (zoneLines.length) {
    parts.push("SEMANTIC ZONE VOCABULARY:\n" + zoneLines.join("\n\n"));
  }

  // 3. Building templates
  const templates = tileSemantics.buildingTemplates || [];
  if (templates.length) {
    const templateLines = templates.map(formatBuildingTemplate);
    parts.push("BUILDING TEMPLATES AVAILABLE:\n" + templateLines.join("\n"));
  }

  // 4. Hard rules (always verbatim)
  parts.push(
    [
      "HARD RULES (never violate):",
      "- Ground layer must be 100% filled — no empty cells",
      "- Buildings: 3-5 per village map, 10+ tiles center-to-center spacing",
      "- Paths: always 2 tiles wide, must connect to every building door",
      "- Water: minimum 3x3, 2+ tile gap from buildings",
      "- Trees: mix at least 2 types, canopy always above trunk",
      "- 55-65% of map should be walkable",
      "- Forest borders: NOT uniform walls — stagger depth, vary types, leave gaps",
      "- Flower grass only near POIs (buildings, water, path intersections)",
      "- Village square: 6x4 to 8x6 largest open area",
      "- Never place buildings in same 10x10 area",
    ].join("\n")
  );

  // 5. Learned rules (confidence >= 0.5)
  const learnedRules = (evolutionMemory.learnedRules || []).filter(
    (r) => (r.confidence || 0) >= 0.5
  );
  if (learnedRules.length) {
    const ruleLines = learnedRules.map(
      (r) => `- ${r.rule || r.text || r.description} (confidence: ${r.confidence})`
    );
    parts.push(
      "LEARNED RULES (from human feedback — follow these):\n" +
        ruleLines.join("\n")
    );
  }

  // 6. Feedback history (last 5 generations, older ones summarized)
  const generations = evolutionMemory.generations || [];
  if (generations.length) {
    const historyLines = [];

    if (generations.length > 5) {
      // Summarize older generations to one sentence each
      const olderGens = generations.slice(0, generations.length - 5);
      for (const gen of olderGens) {
        historyLines.push(summarizeGeneration(gen));
      }
    }

    const recentGens = generations.slice(-5);
    for (const gen of recentGens) {
      historyLines.push(summarizeGeneration(gen));
    }

    parts.push("FEEDBACK HISTORY:\n" + historyLines.join("\n"));
  }

  // 7. Best maps (last 3)
  const bestMaps = (evolutionMemory.bestMaps || []).slice(-3);
  if (bestMaps.length) {
    const mapBlocks = bestMaps.map((entry) => {
      const blueprint = entry.blueprint || entry;
      // Include zones array only, no rationale
      const compact = { zones: blueprint.zones || [] };
      return JSON.stringify(compact);
    });
    parts.push("BEST MAPS (recent winners):\n" + mapBlocks.join("\n\n"));
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

function buildOutputSchemaBlock(mapParams) {
  return [
    "OUTPUT FORMAT: Return ONLY a JSON object matching this schema:",
    "{",
    `  "mapSize": { "width": ${mapParams.width}, "height": ${mapParams.height} },`,
    '  "seed": <random integer 1-99999>,',
    '  "zones": [',
    '    // Array of zone objects. Each zone has a "type" field.',
    '    // Types: "forest", "building-zone", "path", "water", "tree-cluster",',
    '    //        "decoration", "garden", "village-square"',
    "    //",
    '    // forest: { type, bounds: {x,y,w,h}, density: "dense"|"medium"|"sparse", treeTypes: [...] }',
    '    // building-zone: { type, template: "small_house"|"medium_house"|..., position: {x,y}, material: "wood"|"stone", fenced: bool, fenceType: "white"|"brown" }',
    "    // path: { type, waypoints: [{x,y},...], width: 2 }",
    "    // water: { type, bounds: {x,y,w,h} }",
    "    // tree-cluster: { type, position: {x,y}, count: 2-5, treeTypes: [...] }",
    '    // decoration: { type, subtype: "well"|"lantern"|"barrel"|"chest", position: {x,y} }',
    "    // garden: { type, center: {x,y}, radius: 2-4 }",
    "    // village-square: { type, bounds: {x,y,w,h} }",
    "  ],",
    '  "groundMix": { "plain": 0.6, "variant": 0.3, "flower": 0.1 },',
    '  "rationale": "Brief explanation of your design choices and what you changed from previous generation"',
    "}",
    "Do NOT include any text before or after the JSON. Return ONLY the JSON object.",
  ].join("\n");
}

function buildMapParamsLine(mapParams) {
  const extras = [];
  if (mapParams.theme) extras.push(`theme: ${mapParams.theme}`);
  if (mapParams.treeDensity)
    extras.push(`tree density: ${mapParams.treeDensity}`);
  // Include any other custom params
  for (const [k, v] of Object.entries(mapParams)) {
    if (!["width", "height", "buildingCount", "theme", "treeDensity"].includes(k)) {
      extras.push(`${k}: ${v}`);
    }
  }
  const base = `Map parameters: ${mapParams.width}x${mapParams.height}, ${mapParams.buildingCount} buildings`;
  return extras.length ? base + ", " + extras.join(", ") : base;
}

function buildUserPrompt(variation, generationNumber, evolutionMemory, mapParams) {
  const isFirstGen =
    !evolutionMemory.generations || evolutionMemory.generations.length === 0;
  const paramsLine = buildMapParamsLine(mapParams);
  const outputSchema = buildOutputSchemaBlock(mapParams);

  if (isFirstGen) {
    return buildFirstGenUserPrompt(variation, paramsLine, outputSchema);
  }

  const prevWinner = getPreviousWinner(evolutionMemory);
  const prevSummary = compactBlueprintSummary(prevWinner);

  switch (variation) {
    case "conservative":
      return buildConservativePrompt(
        generationNumber,
        prevSummary,
        evolutionMemory,
        paramsLine,
        outputSchema
      );
    case "exploratory":
      return buildExploratoryPrompt(
        generationNumber,
        prevSummary,
        paramsLine,
        outputSchema
      );
    case "creative":
      return buildCreativePrompt(
        generationNumber,
        prevSummary,
        paramsLine,
        outputSchema
      );
    default:
      throw new Error(`Unknown variation: ${variation}`);
  }
}

function buildFirstGenUserPrompt(variation, paramsLine, outputSchema) {
  const labels = {
    conservative: { letter: "A", style: "Conservative" },
    exploratory: { letter: "B", style: "Exploratory" },
    creative: { letter: "C", style: "Creative" },
  };
  const { letter, style } = labels[variation];

  const guidance = {
    conservative:
      "Create a balanced village following all documented rules.",
    exploratory:
      "Create a village with an interesting layout twist.",
    creative:
      "Create a whimsical, playful village layout.",
  };

  return [
    `Generate a map blueprint for Generation 1, Candidate ${letter} (${style}).`,
    `Your job: ${guidance[variation]}`,
    "",
    paramsLine,
    "",
    outputSchema,
  ].join("\n");
}

function buildConservativePrompt(
  generationNumber,
  prevSummary,
  evolutionMemory,
  paramsLine,
  outputSchema
) {
  const improvement = suggestImprovement(evolutionMemory);

  return [
    `Generate a map blueprint for Generation ${generationNumber}, Candidate A (Conservative).`,
    `Previous winner: ${prevSummary}`,
    "Your job: Follow ALL learned rules strictly. Make only ONE small improvement.",
    `Suggested improvement: ${improvement}`,
    "",
    paramsLine,
    "",
    outputSchema,
  ].join("\n");
}

function buildExploratoryPrompt(
  generationNumber,
  prevSummary,
  paramsLine,
  outputSchema
) {
  return [
    `Generate a map blueprint for Generation ${generationNumber}, Candidate B (Exploratory).`,
    `Previous winner: ${prevSummary}`,
    "Your job: Keep what worked. Try ONE significant structural change.",
    "Examples of structural changes you could try:",
    "- Different path topology (L-shape, radial, loop)",
    "- Different building arrangement (clustered, spread, along-path)",
    "- Different village center location",
    "- Add/move water feature",
    "",
    paramsLine,
    "",
    outputSchema,
  ].join("\n");
}

function buildCreativePrompt(
  generationNumber,
  prevSummary,
  paramsLine,
  outputSchema
) {
  return [
    `Generate a map blueprint for Generation ${generationNumber}, Candidate C (Creative).`,
    `Previous winner: ${prevSummary}`,
    'Your job: Be bold. You may break 1-2 soft rules to discover new patterns.',
    'Think about what would make a 4.5-year-old girl say "wow!"',
    "Consider: unexpected feature placement, extra detail in one area, playful paths.",
    "",
    paramsLine,
    "",
    outputSchema,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a complete { system, user } prompt pair for one map generation candidate.
 *
 * @param {object} options
 * @param {"conservative"|"exploratory"|"creative"} options.variation
 * @param {number} options.generationNumber
 * @param {object} options.evolutionMemory   Parsed evolution-memory.json
 * @param {object} options.tileSemantics     Parsed tile-semantics.json
 * @param {object} options.mapParams         { width, height, theme, buildingCount, treeDensity, ... }
 * @returns {{ system: string, user: string }}
 */
function buildPrompt(options) {
  const {
    variation,
    generationNumber,
    evolutionMemory,
    tileSemantics,
    mapParams,
  } = options;

  const system = buildSystemPrompt(tileSemantics, evolutionMemory);
  const user = buildUserPrompt(
    variation,
    generationNumber,
    evolutionMemory,
    mapParams
  );

  return { system, user };
}

module.exports = { buildPrompt };
