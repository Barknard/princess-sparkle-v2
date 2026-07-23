/**
 * reward-table.js — Persistent tile placement reward/penalty system
 *
 * Maintains per-context weights that bias tile selection during generation.
 * Learns from: hand-painted maps (positive), flagged tiles (negative),
 * sample maps (positive), tag validation (negative), self-comparison (both).
 *
 * Weights are multiplicative: 1.0 = neutral, <1.0 = penalized, >1.0 = rewarded.
 * Saves to JSON and accumulates across training runs.
 *
 * Based on: PCGRL reward shaping + Bayesian WFC priors
 */

"use strict";

const fs = require('fs');
const path = require('path');

const DIR_OFFSETS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

class RewardTable {
  constructor(opts = {}) {
    // Global tile weights: tileWeights[tileId] = weight
    this.tileWeights = {};
    // Contextual weights: contextWeights[contextKey][tileId] = weight
    // contextKey formats:
    //   "adj:TILE:DIR"     — tile N is adjacent in direction DIR
    //   "layer:LAYER"      — tile is on this layer
    //   "zone:ZONE"        — tile is in this zone (edge/interior/corner)
    //   "ontop:GROUND_TILE" — this tile sits on top of ground tile G
    this.contextWeights = {};
    // Stats
    this.totalRewards = 0;
    this.totalPenalties = 0;
    this.version = 0;
    // Config
    this.learningRate = opts.learningRate || 0.08;
    this.decayRate = opts.decayRate || 0.998;
    this.minWeight = 0.05;
    this.maxWeight = 5.0;
  }

  /** Get effective weight for a tile in given contexts. Multiplies all applicable weights. */
  getWeight(tileId, contexts) {
    const k = String(tileId);
    let w = this.tileWeights[k] ?? 1.0;
    for (const ctx of contexts) {
      const cw = this.contextWeights[ctx];
      if (cw && cw[k] !== undefined) {
        w *= cw[k];
      }
    }
    return Math.max(this.minWeight, Math.min(this.maxWeight, w));
  }

  /** Penalize a tile in contexts. Reduces weight. severity: 0-5 scale. */
  penalize(tileId, contexts, severity) {
    const k = String(tileId);
    const factor = Math.max(0.5, 1.0 - this.learningRate * severity);
    this.tileWeights[k] = Math.max(this.minWeight, (this.tileWeights[k] ?? 1.0) * factor);
    for (const ctx of contexts) {
      if (!this.contextWeights[ctx]) this.contextWeights[ctx] = {};
      this.contextWeights[ctx][k] = Math.max(this.minWeight,
        (this.contextWeights[ctx][k] ?? 1.0) * factor);
    }
    this.totalPenalties++;
  }

  /** Reward a tile in contexts. Increases weight. strength: 0-5 scale. */
  reward(tileId, contexts, strength) {
    const k = String(tileId);
    const factor = Math.min(2.0, 1.0 + this.learningRate * strength);
    this.tileWeights[k] = Math.min(this.maxWeight, (this.tileWeights[k] ?? 1.0) * factor);
    for (const ctx of contexts) {
      if (!this.contextWeights[ctx]) this.contextWeights[ctx] = {};
      this.contextWeights[ctx][k] = Math.min(this.maxWeight,
        (this.contextWeights[ctx][k] ?? 1.0) * factor);
    }
    this.totalRewards++;
  }

  /** Decay all weights toward 1.0 to prevent runaway values. Call once per generation. */
  decay() {
    for (const k of Object.keys(this.tileWeights)) {
      this.tileWeights[k] = 1.0 + (this.tileWeights[k] - 1.0) * this.decayRate;
    }
    for (const ctx of Object.keys(this.contextWeights)) {
      const cw = this.contextWeights[ctx];
      for (const k of Object.keys(cw)) {
        cw[k] = 1.0 + (cw[k] - 1.0) * this.decayRate;
      }
      // Prune near-neutral entries to save memory
      for (const k of Object.keys(cw)) {
        if (Math.abs(cw[k] - 1.0) < 0.005) delete cw[k];
      }
      if (Object.keys(cw).length === 0) delete this.contextWeights[ctx];
    }
  }

  /** Build context keys for a tile at position (x,y) in a map. */
  static buildContexts(x, y, mapData, tileTags) {
    const W = mapData.width, H = mapData.height;
    const contexts = [];

    // Zone context
    const edgeDepth = 3;
    const isEdge = x < edgeDepth || x >= W - edgeDepth || y < edgeDepth || y >= H - edgeDepth;
    contexts.push(isEdge ? 'zone:edge' : 'zone:interior');

    // Ground-under context (cross-layer)
    const gTile = mapData.ground ? mapData.ground[y * W + x] : -1;
    if (gTile >= 0) contexts.push('ontop:' + gTile);

    // Neighbor adjacency context
    for (const [dir, [dx, dy]] of Object.entries(DIR_OFFSETS)) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      // Check all layers for neighbors
      for (const layer of ['objects', 'foreground', 'ground']) {
        const arr = mapData[layer];
        if (!arr) continue;
        const nTile = arr[ny * W + nx];
        if (nTile >= 0) {
          contexts.push('adj:' + nTile + ':' + dir);
          // Tag-based context (more generalizable than tile ID)
          const tags = tileTags ? (tileTags[nTile] || tileTags[String(nTile)]) : null;
          if (tags && tags.length) {
            contexts.push('tagAdj:' + (Array.isArray(tags) ? tags[0] : tags) + ':' + dir);
          }
          break; // only first non-empty layer per direction
        }
      }
    }

    return contexts;
  }

  /** Get stats. */
  getStats() {
    let contextCount = 0;
    for (const ctx of Object.keys(this.contextWeights)) {
      contextCount += Object.keys(this.contextWeights[ctx]).length;
    }
    return {
      tileWeights: Object.keys(this.tileWeights).length,
      contextEntries: contextCount,
      totalRewards: this.totalRewards,
      totalPenalties: this.totalPenalties,
      version: this.version
    };
  }

  /** Save to JSON file. */
  saveToFile(filePath) {
    this.version++;
    const data = {
      version: this.version,
      stats: this.getStats(),
      tileWeights: this.tileWeights,
      contextWeights: this.contextWeights
    };
    fs.writeFileSync(filePath, JSON.stringify(data));
  }

  /** Load from JSON file. */
  loadFromFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.tileWeights = data.tileWeights || {};
      this.contextWeights = data.contextWeights || {};
      this.version = data.version || 0;
      this.totalRewards = data.stats?.totalRewards || 0;
      this.totalPenalties = data.stats?.totalPenalties || 0;
    } catch (e) {
      console.error('Failed to load reward table:', e.message);
    }
  }
}

module.exports = { RewardTable };
