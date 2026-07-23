/**
 * feedback-learner.js — Learns rewards/penalties from all available data sources
 *
 * Sources:
 *   1. Hand-painted maps → strong positive rewards (human ground truth)
 *   2. Sample maps → moderate positive rewards (training data)
 *   3. Flagged tiles → strong negative penalties (user corrections)
 *   4. Tag validation → moderate penalties (semantic rule violations)
 *   5. Self-comparison → weak adjustments (generated vs reference diff)
 *
 * All learning is automatic — call learnFromAll() at startup and after
 * each training run. The reward table persists across sessions.
 */

"use strict";

const fs = require('fs');
const path = require('path');
const { RewardTable } = require('./reward-table');

const DIR_OFFSETS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

// Tag validation rules — semantic constraints from tile tags
// Each rule: if a tile has these tags, its neighbors MUST/MUST NOT have certain tags
const TAG_RULES = [
  // TREE RULES (the weak area)
  { match: ['canopy'], require: { south: ['trunk', 'dense', 'tree'] }, penalty: 3.0, name: 'canopy-needs-trunk' },
  { match: ['trunk'], require: { north: ['canopy', 'dense', 'tree'] }, penalty: 3.0, name: 'trunk-needs-canopy' },
  { match: ['dense', 'center'], prefer: { east: ['dense', 'edge'], west: ['dense', 'edge'], north: ['dense', 'edge', 'canopy'], south: ['dense', 'edge'] }, reward: 1.5, name: 'dense-cluster-cohesion' },
  { match: ['edge'], require: { any: ['dense', 'center'] }, penalty: 2.0, name: 'edge-needs-body' },

  // PATH RULES (weak area)
  { match: ['path'], prefer: { any: ['path', 'door', 'walkable'] }, reward: 1.0, name: 'path-connectivity' },
  { match: ['path'], forbid: { any: ['roof', 'wall'] }, penalty: 2.5, name: 'path-not-under-building' },
  { match: ['door'], require: { south: ['walkable', 'path', 'ground'] }, penalty: 2.5, name: 'door-accessible' },

  // BUILDING RULES
  { match: ['roof', 'top'], require: { south: ['roof', 'wall', 'overhang'] }, penalty: 2.0, name: 'roof-supported' },
  { match: ['wall'], require: { north: ['roof', 'wall'] }, penalty: 1.5, name: 'wall-has-roof' },
  { match: ['window'], require: { east: ['wall'], west: ['wall'] }, penalty: 1.0, name: 'window-in-wall' },

  // DECORATION RULES (weak area)
  { match: ['decoration'], forbid: { any: ['water', 'roof'] }, penalty: 1.5, name: 'decoration-placement' },
  { match: ['well'], forbid: { any: ['wall', 'fence', 'water'] }, penalty: 2.0, name: 'well-placement' },

  // FENCE RULES
  { match: ['fence'], prefer: { east: ['fence', 'fence-post', 'fence-rail'], west: ['fence', 'fence-post', 'fence-rail'] }, reward: 1.0, name: 'fence-continuity' },

  // WATER RULES
  { match: ['water', 'edge'], forbid: { any: ['wall', 'roof', 'fence'] }, penalty: 2.0, name: 'water-isolation' },
];

class FeedbackLearner {
  constructor(rewardTable, tileTags) {
    this.rt = rewardTable;
    this.tileTags = tileTags || {};
    this.stats = { paintedMaps: 0, sampleMaps: 0, flagSessions: 0, tagViolations: 0, selfCorrections: 0 };
  }

  /** Get tags for a tile ID. Returns array of strings. */
  _tags(tileId) {
    const t = this.tileTags[tileId] || this.tileTags[String(tileId)];
    return Array.isArray(t) ? t : [];
  }

  /** Check if tags include any of the required tags. */
  _hasAny(tags, required) {
    return required.some(r => tags.includes(r));
  }

  // ── Source 1: Hand-painted maps (strongest positive signal) ──────────

  learnFromPaintedMap(mapData, weight) {
    const W = mapData.width, H = mapData.height;
    const strength = weight || 1.5;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        for (const layer of ['ground', 'objects', 'foreground']) {
          const arr = mapData[layer];
          if (!arr) continue;
          const tileId = arr[y * W + x];
          if (tileId < 0) continue;
          const contexts = RewardTable.buildContexts(x, y, mapData, this.tileTags);
          contexts.push('layer:' + layer);
          this.rt.reward(tileId, contexts, strength);
        }
      }
    }
    this.stats.paintedMaps++;
  }

  // ── Source 2: Sample maps (moderate positive signal) ──────────────────

  learnFromSampleMap(mapData, weight) {
    this.learnFromPaintedMap(mapData, weight || 0.8);
    this.stats.sampleMaps++;
    this.stats.paintedMaps--; // correct the count
  }

  // ── Source 3: Flagged tiles (strong negative signal) ──────────────────

  learnFromFlaggedTiles(flaggedSessions, mapData) {
    if (!Array.isArray(flaggedSessions)) return;

    for (const session of flaggedSessions) {
      for (const flag of (session.flags || [])) {
        const x = flag.x, y = flag.y;
        if (x === undefined || y === undefined) continue;

        // Use the map data to build context (if available)
        const contexts = mapData
          ? RewardTable.buildContexts(x, y, mapData, this.tileTags)
          : ['zone:unknown'];

        // Penalize each non-empty layer tile at this position
        for (const layer of ['ground', 'objects', 'foreground']) {
          const tileId = flag[layer];
          if (tileId !== undefined && tileId >= 0) {
            contexts.push('layer:' + layer);
            this.rt.penalize(tileId, contexts, 2.5); // strong penalty

            // Also penalize the tag combination
            const tags = this._tags(tileId);
            if (tags.length) {
              this.rt.penalize(tileId, ['tagCombo:' + tags.sort().join('+')], 1.5);
            }
          }
        }
      }
      this.stats.flagSessions++;
    }
  }

  // ── Source 4: Tag validation (automatic semantic checks) ─────────────

  validateAndLearn(mapData) {
    const W = mapData.width, H = mapData.height;
    let violations = 0;
    let rewards = 0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        for (const layer of ['ground', 'objects', 'foreground']) {
          const arr = mapData[layer];
          if (!arr) continue;
          const tileId = arr[y * W + x];
          if (tileId < 0) continue;
          const tags = this._tags(tileId);
          if (tags.length === 0) continue;

          for (const rule of TAG_RULES) {
            // Check if this tile matches the rule
            if (!rule.match.every(m => tags.includes(m))) continue;

            const contexts = RewardTable.buildContexts(x, y, mapData, this.tileTags);

            // Check required neighbors
            if (rule.require) {
              for (const [dir, reqTags] of Object.entries(rule.require)) {
                const dirs = dir === 'any'
                  ? Object.keys(DIR_OFFSETS)
                  : [dir];
                let satisfied = false;
                for (const d of dirs) {
                  const [dx, dy] = DIR_OFFSETS[d];
                  const nx = x + dx, ny = y + dy;
                  if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                  // Check all layers
                  for (const l of ['objects', 'foreground', 'ground']) {
                    const nArr = mapData[l];
                    if (!nArr) continue;
                    const nTile = nArr[ny * W + nx];
                    if (nTile < 0) continue;
                    const nTags = this._tags(nTile);
                    if (this._hasAny(nTags, reqTags)) { satisfied = true; break; }
                  }
                  if (satisfied) break;
                }
                if (!satisfied) {
                  this.rt.penalize(tileId, contexts, rule.penalty);
                  violations++;
                }
              }
            }

            // Check preferred neighbors (soft reward)
            if (rule.prefer) {
              for (const [dir, prefTags] of Object.entries(rule.prefer)) {
                const dirs = dir === 'any' ? Object.keys(DIR_OFFSETS) : [dir];
                for (const d of dirs) {
                  const [dx, dy] = DIR_OFFSETS[d];
                  const nx = x + dx, ny = y + dy;
                  if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                  for (const l of ['objects', 'foreground', 'ground']) {
                    const nArr = mapData[l];
                    if (!nArr) continue;
                    const nTile = nArr[ny * W + nx];
                    if (nTile < 0) continue;
                    const nTags = this._tags(nTile);
                    if (this._hasAny(nTags, prefTags)) {
                      this.rt.reward(tileId, contexts, rule.reward || 0.5);
                      rewards++;
                    }
                  }
                }
              }
            }

            // Check forbidden neighbors
            if (rule.forbid) {
              for (const [dir, forbTags] of Object.entries(rule.forbid)) {
                const dirs = dir === 'any' ? Object.keys(DIR_OFFSETS) : [dir];
                for (const d of dirs) {
                  const [dx, dy] = DIR_OFFSETS[d];
                  const nx = x + dx, ny = y + dy;
                  if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                  for (const l of ['objects', 'foreground', 'ground']) {
                    const nArr = mapData[l];
                    if (!nArr) continue;
                    const nTile = nArr[ny * W + nx];
                    if (nTile < 0) continue;
                    const nTags = this._tags(nTile);
                    if (this._hasAny(nTags, forbTags)) {
                      this.rt.penalize(tileId, contexts, rule.penalty);
                      violations++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    this.stats.tagViolations += violations;
    return { violations, rewards };
  }

  // ── Source 5: Self-comparison (generated vs reference) ────────────────

  selfCompare(generated, reference) {
    const W = Math.min(generated.width, reference.width);
    const H = Math.min(generated.height, reference.height);
    let corrections = 0;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        for (const layer of ['ground', 'objects', 'foreground']) {
          const gArr = generated[layer], rArr = reference[layer];
          if (!gArr || !rArr) continue;
          const genTile = gArr[y * generated.width + x];
          const refTile = rArr[y * reference.width + x];

          if (genTile === refTile) continue;
          if (refTile < 0 && genTile < 0) continue;

          const contexts = RewardTable.buildContexts(x, y, reference, this.tileTags);

          // Penalize what we generated (wrong choice)
          if (genTile >= 0) {
            this.rt.penalize(genTile, contexts, 0.3);
          }
          // Reward what the reference has (correct choice)
          if (refTile >= 0) {
            this.rt.reward(refTile, contexts, 0.5);
          }
          corrections++;
        }
      }
    }
    this.stats.selfCorrections += corrections;
    return corrections;
  }

  // ── Learn from ALL sources at once ───────────────────────────────────

  learnFromAll(v2Dir) {
    // 1. Painted maps (strongest signal)
    const paintedPath = path.join(v2Dir, 'painted-map.json');
    if (fs.existsSync(paintedPath)) {
      const pm = JSON.parse(fs.readFileSync(paintedPath, 'utf8'));
      this.learnFromPaintedMap(pm, 1.5);
    }

    // 2. Sample maps
    for (let i = 1; i <= 8; i++) {
      const p = path.join(v2Dir, `js13k-level${i}.json`);
      if (fs.existsSync(p)) {
        const m = JSON.parse(fs.readFileSync(p, 'utf8'));
        this.learnFromSampleMap(m, 0.8);
      }
    }

    // 3. Flagged tiles
    const flagPath = path.join(v2Dir, 'flagged-tiles.json');
    if (fs.existsSync(flagPath)) {
      const flags = JSON.parse(fs.readFileSync(flagPath, 'utf8'));
      // Load the painted map as context for flagged tiles
      let pm = null;
      if (fs.existsSync(paintedPath)) pm = JSON.parse(fs.readFileSync(paintedPath, 'utf8'));
      this.learnFromFlaggedTiles(flags, pm);
    }

    return this.stats;
  }

  getStats() { return this.stats; }
}

module.exports = { FeedbackLearner, TAG_RULES };
