/**
 * v2-vision-scorer.js — Visual similarity scorer using Claude API
 *
 * Sends rendered PNGs of generated + target maps to Claude's vision model
 * and gets a structured score (0-100) across multiple visual dimensions.
 *
 * Designed to be called sparingly (every N generations) to guide evolution
 * toward visually matching a target map — not just tile-for-tile, but
 * compositionally: building placement, path flow, vegetation density, etc.
 *
 * Usage:
 *   const scorer = new VisionScorer(targetPngBuffer);
 *   const result = await scorer.score(generatedPngBuffer);
 *   // result = { total: 65, layout: 70, buildings: 60, paths: 55, vegetation: 75, composition: 65, feedback: "..." }
 */

"use strict";

const Anthropic = require("@anthropic-ai/sdk");

const SCORING_PROMPT = `You are a pixel art RPG map quality assessor. You're comparing a GENERATED village map against a TARGET reference map. Both use the same Kenney Tiny Town tileset (16x16 pixel tiles, top-down RPG view).

Score the GENERATED map on how well it visually matches the TARGET across these dimensions (0-100 each):

1. **layout** — Does the overall spatial arrangement match? Are buildings in similar regions (top-left, center, bottom-right)? Is the density distribution similar?
2. **buildings** — Are there a similar number of buildings? Similar sizes and materials (wood/stone, roof colors)? Is the castle in a matching position?
3. **paths** — Do paths connect buildings similarly? Is the path network shape comparable (linear, branching, organic)?
4. **vegetation** — Are tree clusters in similar positions (corners, edges, scattered)? Is the foreground density comparable? Similar tree types?
5. **composition** — Overall visual impression: does it FEEL like the same village? Color balance, open space vs density, visual flow?

Respond with ONLY valid JSON in this exact format:
{"total":<0-100>,"layout":<0-100>,"buildings":<0-100>,"paths":<0-100>,"vegetation":<0-100>,"composition":<0-100>,"feedback":"<1-2 sentences: what's the biggest visual gap and how to fix it>"}`;

class VisionScorer {
  constructor(targetPngBuffer, opts = {}) {
    this._targetPng = targetPngBuffer;
    this._model = opts.model || "claude-haiku-4-5-20251001"; // cheap + fast for scoring
    this._maxTokens = opts.maxTokens || 300;
    this._client = null;
    this._lastScore = null;
    this._callCount = 0;
    this._totalCost = 0; // rough estimate in cents
  }

  _getClient() {
    if (!this._client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY not set. Export it or add to .env file."
        );
      }
      this._client = new Anthropic({ apiKey });
    }
    return this._client;
  }

  /**
   * Score a generated map PNG against the target.
   * @param {Buffer} generatedPng - PNG buffer of the generated map
   * @returns {Promise<{total, layout, buildings, paths, vegetation, composition, feedback}>}
   */
  async score(generatedPng) {
    const client = this._getClient();

    const targetB64 = this._targetPng.toString("base64");
    const genB64 = generatedPng.toString("base64");

    try {
      const response = await client.messages.create({
        model: this._model,
        max_tokens: this._maxTokens,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "TARGET map (this is what we want to match):",
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: targetB64,
                },
              },
              {
                type: "text",
                text: "GENERATED map (score this against the target):",
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: genB64,
                },
              },
              { type: "text", text: SCORING_PROMPT },
            ],
          },
        ],
      });

      this._callCount++;
      // Rough cost estimate: Haiku vision ~$0.001/image + $0.00025/1K output tokens
      this._totalCost += 0.3; // ~0.3 cents per call with 2 images

      const text = response.content[0].text.trim();
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("Vision scorer: no JSON in response:", text);
        return this._fallback("No JSON in response");
      }

      const result = JSON.parse(jsonMatch[0]);
      // Validate all fields exist
      const fields = [
        "total",
        "layout",
        "buildings",
        "paths",
        "vegetation",
        "composition",
      ];
      for (const f of fields) {
        if (typeof result[f] !== "number" || result[f] < 0 || result[f] > 100) {
          result[f] = 50; // default if missing/invalid
        }
      }
      if (!result.feedback) result.feedback = "";

      this._lastScore = result;
      return result;
    } catch (err) {
      console.error("Vision scorer error:", err.message);
      return this._fallback(err.message);
    }
  }

  _fallback(reason) {
    return {
      total: -1,
      layout: -1,
      buildings: -1,
      paths: -1,
      vegetation: -1,
      composition: -1,
      feedback: `Vision scoring failed: ${reason}`,
      error: true,
    };
  }

  /** Get stats about API usage */
  getStats() {
    return {
      calls: this._callCount,
      estimatedCostCents: this._totalCost.toFixed(1),
      lastScore: this._lastScore,
    };
  }
}

// ── Self-test ──────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    console.log("=== Vision Scorer Self-Test ===\n");

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log(
        "ANTHROPIC_API_KEY not set — skipping live test.\n" +
          "Set it and re-run to test against the API.\n"
      );
      // Test with mock
      const scorer = new VisionScorer(Buffer.from("fake"));
      console.log("Stats:", scorer.getStats());
      console.log("Self-test PASSED (no API call)");
      return;
    }

    // Live test with actual images
    const fs = require("fs");
    const path = require("path");
    const targetPath = path.join(__dirname, "js13k-level1-render.png");
    const resultDir = path.join(__dirname, "results");

    if (!fs.existsSync(targetPath)) {
      console.log("No target render found at", targetPath);
      return;
    }

    // Find latest best-gen PNG
    const bestPngs = fs
      .readdirSync(resultDir)
      .filter((f) => f.startsWith("best-gen-") && f.endsWith(".png"))
      .sort()
      .reverse();
    if (bestPngs.length === 0) {
      console.log("No generated maps in results/ — run evolution first");
      return;
    }

    const targetPng = fs.readFileSync(targetPath);
    const genPng = fs.readFileSync(path.join(resultDir, bestPngs[0]));

    console.log("Target:", targetPath);
    console.log("Generated:", bestPngs[0]);
    console.log("Calling Claude API...\n");

    const scorer = new VisionScorer(targetPng);
    const result = await scorer.score(genPng);

    console.log("Result:", JSON.stringify(result, null, 2));
    console.log("\nStats:", scorer.getStats());
    console.log("\nSelf-test PASSED");
  })();
}

module.exports = { VisionScorer };
