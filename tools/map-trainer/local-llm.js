"use strict";

/**
 * local-llm.js
 *
 * Local LLM interface for map blueprint generation using Ollama.
 * Drop-in replacement for Claude API calls.
 *
 * Ollama must be installed and running on localhost:11434.
 * Recommended model: llama3.2:3b
 *
 * Usage:
 *   const { generateBlueprintLocal, checkOllamaStatus, pullModel } = require('./local-llm');
 */

const http = require("http");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OLLAMA_HOST = "localhost";
const OLLAMA_PORT = 11434;
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds – local models can be slow

/** Models listed in priority order. First available wins. */
const RECOMMENDED_MODELS = [
  "llama3.2:3b",
  "mistral:7b",
  "gemma2:2b",
];

// ---------------------------------------------------------------------------
// Low-level HTTP helper (no fetch, no dependencies)
// ---------------------------------------------------------------------------

/**
 * Make an HTTP request to the Ollama API.
 * @param {string} path  - e.g. "/api/tags"
 * @param {Object|null} body - JSON body for POST, or null/undefined for GET
 * @param {number} [timeout] - request timeout in ms
 * @returns {Promise<Object>}
 */
function ollamaRequest(path, body, timeout) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: path,
      method: data ? "POST" : "GET",
      headers: data
        ? {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
          }
        : {},
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve(JSON.parse(raw));
        } catch (_e) {
          resolve({ error: raw });
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(timeout || REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error("Ollama request timeout"));
    });

    if (data) req.write(data);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if Ollama is running and what models are available.
 * @returns {Promise<{ running: boolean, models: string[], recommended: string|null }>}
 */
async function checkOllamaStatus() {
  try {
    const res = await ollamaRequest("/api/tags", null, 5000);

    if (res.error) {
      return { running: false, models: [], recommended: null };
    }

    const models = (res.models || []).map((m) => m.name);

    // Pick the first recommended model that is already pulled.
    let recommended = null;
    for (const candidate of RECOMMENDED_MODELS) {
      if (models.some((m) => m === candidate || m.startsWith(candidate.split(":")[0]))) {
        recommended = candidate;
        break;
      }
    }
    // Fallback: first model available
    if (!recommended && models.length > 0) {
      recommended = models[0];
    }

    return { running: true, models, recommended };
  } catch (_err) {
    return { running: false, models: [], recommended: null };
  }
}

/**
 * Pull / download a model if not already available.
 * @param {string} modelName - e.g. "llama3.2:3b" or "mistral:7b"
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function pullModel(modelName) {
  try {
    const status = await checkOllamaStatus();
    if (!status.running) {
      return {
        success: false,
        message:
          "Ollama is not running. Please start it first:\n" +
          "  1. Download from https://ollama.com/download\n" +
          "  2. Run: ollama serve",
      };
    }

    console.log(`Pulling model "${modelName}" – this may take a while...`);
    const res = await ollamaRequest(
      "/api/pull",
      { name: modelName, stream: false },
      600000, // 10 minute timeout for large downloads
    );

    if (res.error) {
      return { success: false, message: `Pull failed: ${res.error}` };
    }

    return { success: true, message: `Model "${modelName}" is ready.` };
  } catch (err) {
    return { success: false, message: `Pull error: ${err.message}` };
  }
}

/**
 * Generate a map blueprint using a local LLM via Ollama.
 *
 * @param {Object} options
 * @param {string}  [options.model="llama3.2:3b"] - Ollama model name
 * @param {string}  options.systemPrompt          - System prompt (from prompt-builder)
 * @param {string}  options.userPrompt            - User prompt (from prompt-builder)
 * @param {number}  [options.temperature=0.7]     - Sampling temperature
 * @returns {Promise<Object>} Parsed blueprint JSON
 */
async function generateBlueprintLocal(options) {
  const {
    model = "llama3.2:3b",
    systemPrompt,
    userPrompt,
    temperature = 0.7,
  } = options || {};

  if (!systemPrompt || !userPrompt) {
    throw new Error("systemPrompt and userPrompt are required");
  }

  // -- Attempt generation (with one retry) --------------------------------
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await ollamaRequest("/api/generate", {
        model: model,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: temperature,
        stream: false,
        format: "json",
      });

      // Ollama error (e.g. model not found)
      if (res.error) {
        const errMsg = typeof res.error === "string" ? res.error : JSON.stringify(res.error);
        if (errMsg.includes("not found")) {
          throw new Error(
            `Model "${model}" not found. Pull it first:\n  ollama pull ${model}`,
          );
        }
        throw new Error(`Ollama error: ${errMsg}`);
      }

      const raw = res.response;
      if (!raw) {
        throw new Error("Empty response from Ollama");
      }

      // -- Parse JSON -------------------------------------------------------
      let blueprint = tryParseJSON(raw);
      if (!blueprint) {
        throw new Error("Could not parse blueprint JSON from model response");
      }

      // -- Validate required fields -----------------------------------------
      if (validateBlueprint(blueprint)) {
        return blueprint;
      }

      // Invalid structure – fall through to retry
      lastError = new Error("Blueprint missing required fields (mapSize, zones, or groundMix)");
    } catch (err) {
      lastError = err;

      // Don't retry model-not-found errors
      if (err.message && err.message.includes("not found")) {
        throw err;
      }

      // Connection refused → Ollama not running
      if (err.code === "ECONNREFUSED") {
        throw new Error(
          "Ollama is not running. Install and start it:\n" +
          "  1. Download from https://ollama.com/download\n" +
          "  2. Run: ollama serve\n" +
          "  3. Pull a model: ollama pull llama3.2:3b",
        );
      }
    }
  }

  // -- Both attempts failed – return fallback blueprint ---------------------
  console.warn(
    "Local LLM generation failed after 2 attempts:",
    lastError ? lastError.message : "unknown error",
  );
  console.warn("Returning fallback blueprint.");
  return fallbackBlueprint();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Try to parse JSON from a string. If straight parsing fails, attempt to
 * extract the first JSON object from the text.
 * @param {string} text
 * @returns {Object|null}
 */
function tryParseJSON(text) {
  // Direct parse
  try {
    return JSON.parse(text);
  } catch (_e) {
    // ignore
  }

  // Try to locate a top-level JSON object in the response
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (_e) {
      // ignore
    }
  }

  return null;
}

/**
 * Validate that a blueprint has the minimum required structure.
 * @param {Object} bp
 * @returns {boolean}
 */
function validateBlueprint(bp) {
  if (!bp || typeof bp !== "object") return false;
  if (!bp.mapSize) return false;
  if (!Array.isArray(bp.zones) || bp.zones.length === 0) return false;
  if (!bp.groundMix) return false;
  return true;
}

/**
 * Return a safe fallback blueprint when generation fails.
 * @returns {Object}
 */
function fallbackBlueprint() {
  return {
    rationale: "Fallback blueprint – local LLM generation failed. This provides a simple village layout.",
    mapSize: { width: 30, height: 20 },
    groundMix: {
      primary: "grass",
      secondary: "dirt",
      ratio: 0.7,
    },
    zones: [
      {
        id: "village-center",
        type: "building-cluster",
        bounds: { x: 10, y: 6, w: 10, h: 8 },
        description: "Small village center with two buildings",
        buildings: [
          { x: 11, y: 7, w: 4, h: 4, type: "house" },
          { x: 16, y: 8, w: 3, h: 3, type: "shop" },
        ],
      },
      {
        id: "tree-grove",
        type: "nature",
        bounds: { x: 0, y: 0, w: 8, h: 8 },
        description: "Grove of trees in the northwest",
        density: "medium",
        tileType: "tree",
      },
      {
        id: "main-path",
        type: "path",
        bounds: { x: 0, y: 10, w: 30, h: 2 },
        description: "Horizontal dirt path across the map",
        tileType: "dirt",
      },
    ],
    landmarks: [],
    _fallback: true,
  };
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    console.log("Checking Ollama status...");
    const status = await checkOllamaStatus();
    console.log("Ollama running:", status.running);
    if (status.running) {
      console.log("Available models:", status.models);
      console.log("Recommended:", status.recommended);

      if (status.recommended) {
        console.log(
          "\nGenerating test blueprint with " + status.recommended + "...",
        );
        const { buildPrompt } = require("./prompt-builder");
        const semantics = JSON.parse(
          require("fs").readFileSync(
            require("path").join(__dirname, "tile-semantics.json"),
            "utf8",
          ),
        );
        const memory = {
          currentGeneration: 0,
          learnedRules: [],
          generations: [],
          bestMaps: [],
        };
        const { system, user } = buildPrompt({
          variation: "exploratory",
          generationNumber: 1,
          evolutionMemory: memory,
          tileSemantics: semantics,
          mapParams: {
            width: 30,
            height: 20,
            theme: "village",
            buildingCount: 2,
            treeDensity: "medium",
          },
        });

        console.time("Local generation");
        try {
          const blueprint = await generateBlueprintLocal({
            model: status.recommended,
            systemPrompt: system,
            userPrompt: user,
            temperature: 0.7,
          });
          console.timeEnd("Local generation");
          console.log("Blueprint zones:", blueprint.zones ? blueprint.zones.length : 0);
          console.log(
            "Rationale:",
            blueprint.rationale ? blueprint.rationale.slice(0, 100) : "(none)",
          );
          if (blueprint._fallback) {
            console.log("(This is a fallback blueprint)");
          }
        } catch (e) {
          console.timeEnd("Local generation");
          console.error("Generation failed:", e.message);
        }
      }
    } else {
      console.log("\nOllama is not running. Install it:");
      console.log("  1. Download from https://ollama.com/download");
      console.log("  2. Run: ollama serve");
      console.log("  3. Pull a model: ollama pull llama3.2:3b");
    }
  })();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { generateBlueprintLocal, checkOllamaStatus, pullModel };
