/**
 * vision-scorer.js
 *
 * Uses Claude's vision capabilities to compare a generated map image
 * against a reference image and produce a score + critique.
 */

const Anthropic = require("@anthropic-ai/sdk");

const SCORING_SYSTEM_PROMPT = `You are an expert RPG tile map inspector. You analyze how 16x16 pixel tiles are assembled in generated maps compared to a reference. You focus on TILE PLACEMENT RULES — how tiles connect to each other, what goes next to what, and the spatial patterns that make a village look correct.

The maps use Kenney Tiny Town tiles (16x16 pixels each). Key tile types:
- GREEN GRASS: solid green ground fill
- DIRT PATHS: tan/brown walkways, should be 2+ tiles wide with edge transitions
- BUILDINGS: colored roof tiles on top, wall tiles below (wood=brown planks, stone=dark gray)
- TREES: round canopy tops (green or orange) with trunk tiles below them
- FENCES: white picket or brown wood, horizontal rows below buildings
- WATER: blue tiles with grass-to-water edge transitions on all sides
- DECORATIONS: barrels, lanterns, wells, flowers placed near buildings and paths`;

const SCORING_USER_PROMPT = `Compare the generated map (Image 2) to the reference village (Image 1). Focus on TILE PLACEMENT RULES.

Score these aspects:

1. BUILDING ASSEMBLY (0-20): Do buildings have proper roof→wall→door structure? Are they complete or broken?
2. PATH CONNECTIVITY (0-20): Are paths 2+ tiles wide? Do they connect buildings? Are there proper edge tiles?
3. TREE STRUCTURE (0-20): Do trees have canopy above trunk? Are they clustered naturally, not scattered randomly?
4. DECORATION PLACEMENT (0-20): Are decorations (fences, flowers, barrels) placed logically near buildings/paths?
5. OVERALL COMPOSITION (0-20): Does the village have distinct areas (houses, plaza, garden)? Good spatial flow?

CRITICAL: In "tilePlacementRules", list SPECIFIC rules about how tiles should be placed relative to each other. Examples:
- "Roof tiles must be directly above wall tiles, never floating"
- "Fences should run below buildings with a gap for the door"
- "Trees need canopy tiles above trunk tiles, never reversed"
- "Paths should connect to building doors within 2 tiles"
- "Flowers cluster in groups of 2-4 near buildings, not scattered alone"

Respond in EXACTLY this JSON format:
{
  "score": <total 0-100>,
  "buildingAssembly": <0-20>,
  "pathConnectivity": <0-20>,
  "treeStructure": <0-20>,
  "decorationPlacement": <0-20>,
  "overallComposition": <0-20>,
  "critique": "<2-3 sentence assessment focusing on what tile patterns are wrong>",
  "strengths": ["<what tile patterns look correct>"],
  "weaknesses": ["<what tile patterns are broken or missing>"],
  "tilePlacementRules": ["<specific rule 1>", "<specific rule 2>", "<specific rule 3>", "<specific rule 4>", "<specific rule 5>"],
  "suggestions": ["<specific fix for the worst tile placement issue>", "<second fix>"]
}
Return ONLY the JSON, no other text.`;

// Use Haiku for vision scoring — 3x cheaper, 2x faster, good enough for structured rubric scoring
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const TEMPERATURE = 0.3;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = [429, 500, 529];

/**
 * Convert a Buffer or base64 string to a base64 string.
 * @param {Buffer|string} input
 * @returns {string} base64-encoded string
 */
function toBase64(input) {
  if (Buffer.isBuffer(input)) {
    return input.toString("base64");
  }
  // Already a base64 string
  return input;
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to parse a JSON score response from the model output.
 * Falls back to regex extraction if JSON.parse fails.
 * @param {string} text - Raw text from the model
 * @returns {Object} Parsed score object
 */
function parseScoreResponse(text) {
  // Try direct JSON parse first
  try {
    return JSON.parse(text.trim());
  } catch (_) {
    // ignore
  }

  // Try extracting JSON from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {
      // ignore
    }
  }

  // Try extracting JSON from first { to last }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch (_) {
      // ignore
    }
  }

  // Last resort: try to extract just the score with regex
  const scoreMatch = text.match(/"score"\s*:\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;

  return {
    score,
    tileCoherence: 0,
    villageLayout: 0,
    visualVariety: 0,
    readability: 0,
    charmPolish: 0,
    critique: "Could not fully parse vision response. Raw text: " + text.slice(0, 300),
    strengths: [],
    weaknesses: [],
    suggestions: [],
  };
}

/**
 * Score a generated map by comparing it to a reference image.
 *
 * @param {Object} options
 * @param {string} options.apiKey - Anthropic API key
 * @param {Buffer|string} options.generatedMapPng - PNG buffer or base64 string of the generated map
 * @param {Buffer|string} options.referenceImagePng - PNG buffer or base64 string of the reference image
 * @param {number} options.generationNumber - Current generation number
 * @param {string} options.candidateId - e.g. "gen5_b"
 * @param {string} options.variation - "conservative" | "exploratory" | "creative"
 * @param {string} options.rationale - The LLM's rationale for this map
 * @param {Array} options.learnedRules - Current learned rules
 * @returns {Promise<{ score: number, critique: string, strengths: string[], weaknesses: string[], suggestions: string[] }>}
 */
async function scoreMapWithVision(options) {
  const {
    apiKey,
    generatedMapPng,
    referenceImagePng,
    generationNumber,
    candidateId,
    variation,
    rationale,
    learnedRules,
  } = options;

  const referenceB64 = toBase64(referenceImagePng);
  const generatedB64 = toBase64(generatedMapPng);

  // Reuse client instance for connection pooling
  if (!scoreMapWithVision._client || scoreMapWithVision._clientKey !== apiKey) {
    scoreMapWithVision._client = new Anthropic({ apiKey });
    scoreMapWithVision._clientKey = apiKey;
  }
  const client = scoreMapWithVision._client;

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Reference image (Image 1) - a well-designed RPG village map:`,
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: referenceB64,
          },
        },
        {
          type: "text",
          text: `Generated map (Image 2) - candidate "${candidateId}" (generation ${generationNumber}, variation: ${variation}):`,
        },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: generatedB64,
          },
        },
        {
          type: "text",
          text: SCORING_USER_PROMPT,
        },
      ],
    },
  ];

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SCORING_SYSTEM_PROMPT,
        messages,
      });

      const rawText = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      const parsed = parseScoreResponse(rawText);

      return {
        score: typeof parsed.score === "number" ? parsed.score : 50,
        tileCoherence: parsed.tileCoherence || 0,
        villageLayout: parsed.villageLayout || 0,
        visualVariety: parsed.visualVariety || 0,
        readability: parsed.readability || 0,
        charmPolish: parsed.charmPolish || 0,
        critique: parsed.critique || "",
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (err) {
      lastError = err;
      const status = err.status || (err.error && err.error.status);

      if (RETRYABLE_STATUS_CODES.includes(status) && attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s
        await sleep(1000 * (attempt + 1));
        continue;
      }

      // Non-retryable or exhausted retries
      break;
    }
  }

  // Return a default score on total failure
  const errorMsg = lastError ? lastError.message || String(lastError) : "Unknown error";
  return {
    score: 50,
    tileCoherence: 10,
    villageLayout: 10,
    visualVariety: 10,
    readability: 10,
    charmPolish: 10,
    critique: `Vision scoring failed after ${MAX_RETRIES + 1} attempts: ${errorMsg}`,
    strengths: [],
    weaknesses: ["Vision scoring unavailable - using default score"],
    suggestions: ["Retry vision scoring when API is available"],
  };
}

/**
 * Extract actionable rules from a vision critique.
 *
 * @param {string} critique - The vision model's critique text
 * @param {number} genId - Generation number
 * @returns {Array<{ rule: string, source: string, confidence: number }>}
 */
function extractRulesFromCritique(critique, genId) {
  const rules = [];
  const source = `vision-gen-${genId}`;
  const seen = new Set();

  // Handle both string critique and full vision result object
  let critiqueText = '';
  let tilePlacementRules = [];
  if (typeof critique === 'object' && critique !== null) {
    critiqueText = [critique.critique, ...(critique.suggestions || []), ...(critique.weaknesses || [])].filter(Boolean).join('. ');
    tilePlacementRules = critique.tilePlacementRules || [];
  } else if (typeof critique === 'string') {
    critiqueText = critique;
  }
  if (!critiqueText && tilePlacementRules.length === 0) return [];

  // HIGH CONFIDENCE: tile placement rules directly from vision model
  // These are specific, actionable rules about how tiles relate to each other
  const tileRuleConfidence = 0.8; // higher than generic critique rules
  for (const rule of tilePlacementRules) {
    if (typeof rule === 'string' && rule.length > 10 && rule.length < 200) {
      const normalized = rule.trim();
      if (!seen.has(normalized.toLowerCase())) {
        seen.add(normalized.toLowerCase());
        rules.push({ rule: normalized, source, confidence: tileRuleConfidence });
      }
    }
  }

  const confidence = 0.6; // lower confidence for pattern-extracted rules

  /**
   * Add a rule if it hasn't been seen yet.
   * @param {string} ruleText
   */
  function addRule(ruleText) {
    const normalized = ruleText.trim();
    if (normalized && !seen.has(normalized.toLowerCase())) {
      seen.add(normalized.toLowerCase());
      rules.push({ rule: normalized, source, confidence });
    }
  }

  // Split critique into sentences for pattern matching
  const sentences = critique
    .replace(/\n/g, ". ")
    .split(/[.!]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Pattern matchers: [regex, transform function]
  const patterns = [
    // "too many X" -> "Reduce X"
    {
      regex: /too\s+many\s+(.+)/i,
      transform: (match) => `Reduce ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "too much X" -> "Reduce X"
    {
      regex: /too\s+much\s+(.+)/i,
      transform: (match) => `Reduce ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "not enough X" -> "Increase X"
    {
      regex: /not\s+enough\s+(.+)/i,
      transform: (match) => `Increase ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "lacks X" / "lacking X" -> "Add more X"
    {
      regex: /lack(?:s|ing)\s+(.+)/i,
      transform: (match) => `Add more ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "X should be Y"
    {
      regex: /(\w[\w\s]+?)\s+should\s+be\s+(.+)/i,
      transform: (match) =>
        `Make ${match[1].trim()} ${match[2].replace(/[,;].*$/, "").trim()}`,
    },
    // "add more X"
    {
      regex: /add\s+more\s+(.+)/i,
      transform: (match) => `Add more ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "needs more X"
    {
      regex: /needs?\s+more\s+(.+)/i,
      transform: (match) => `Add more ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "avoid X" / "avoiding X"
    {
      regex: /avoid(?:ing)?\s+(.+)/i,
      transform: (match) => `Avoid ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "reduce X"
    {
      regex: /reduce\s+(.+)/i,
      transform: (match) => `Reduce ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "increase X"
    {
      regex: /increase\s+(.+)/i,
      transform: (match) => `Increase ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "could use more X"
    {
      regex: /could\s+use\s+more\s+(.+)/i,
      transform: (match) => `Add more ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "would benefit from X"
    {
      regex: /would\s+benefit\s+from\s+(.+)/i,
      transform: (match) => `Add ${match[1].replace(/[,;].*$/, "").trim()}`,
    },
    // "consider X"
    {
      regex: /consider\s+(adding|using|placing|including)\s+(.+)/i,
      transform: (match) =>
        `${capitalize(match[1])} ${match[2].replace(/[,;].*$/, "").trim()}`,
    },
    // "replace X with Y"
    {
      regex: /replace\s+(.+?)\s+with\s+(.+)/i,
      transform: (match) =>
        `Replace ${match[1].trim()} with ${match[2].replace(/[,;].*$/, "").trim()}`,
    },
  ];

  for (const sentence of sentences) {
    for (const { regex, transform } of patterns) {
      const match = sentence.match(regex);
      if (match) {
        const ruleText = transform(match);
        // Only add rules that are reasonably short and actionable
        if (ruleText.length > 5 && ruleText.length < 200) {
          addRule(ruleText);
        }
        break; // One rule per sentence
      }
    }
  }

  return rules;
}

/**
 * Capitalize the first letter of a string.
 * @param {string} s
 * @returns {string}
 */
function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { scoreMapWithVision, extractRulesFromCritique };
