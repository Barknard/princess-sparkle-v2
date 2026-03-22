/**
 * evolution-logger.js — Comprehensive logging for self-assessment
 *
 * Writes detailed logs that the model/developer can review to understand:
 * - What parameters are being tried
 * - What's working vs what's not
 * - How fitness correlates with specific DNA genes
 * - Where the system is stuck or improving
 * - Recommendations for next version improvements
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');

class EvolutionLogger {
  constructor(sessionId) {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.logPath = path.join(LOG_DIR, `${this.sessionId}.jsonl`);
    this.summaryPath = path.join(LOG_DIR, `${this.sessionId}_summary.md`);
    this.startTime = Date.now();
    this.events = [];
    this.generationHistory = [];
    this.geneCorrelations = {};  // track which genes correlate with high fitness
    this.bestEver = { fitness: 0, gen: 0, dna: null };
    this.stuckCount = 0;
    this.lastBestFitness = 0;

    this._log('session_start', { sessionId: this.sessionId, timestamp: new Date().toISOString() });
  }

  // ── Core logging ────────────────────────────────────────────────────

  _log(type, data) {
    const event = {
      t: Date.now() - this.startTime,
      type,
      ...data
    };
    this.events.push(event);
    // Append to JSONL file
    try {
      fs.appendFileSync(this.logPath, JSON.stringify(event) + '\n');
    } catch (e) { /* ignore write errors */ }
  }

  // ── Generation logging ──────────────────────────────────────────────

  logGeneration(gen, stats, population, visionScore) {
    const bestDna = population[0]?.dna || {};
    const genData = {
      gen,
      best: Math.round(stats.best),
      avg: Math.round(stats.avg),
      worst: Math.round(stats.worst),
      diversity: parseFloat(stats.diversity.toFixed(2)),
      visionScore: visionScore || null,
      bestDna: this._summarizeDNA(bestDna),
      populationSize: population.length,
      elapsedMs: Date.now() - this.startTime
    };

    this.generationHistory.push(genData);
    this._log('generation', genData);

    // Track best ever
    if (stats.best > this.bestEver.fitness) {
      this.bestEver = { fitness: stats.best, gen, dna: bestDna };
      this.stuckCount = 0;
      this._log('new_best', { gen, fitness: stats.best, dna: this._summarizeDNA(bestDna) });
    } else {
      this.stuckCount++;
    }

    // Track gene correlations — which gene values appear in top performers
    this._updateGeneCorrelations(population);

    // Log warnings
    if (this.stuckCount >= 10) {
      this._log('warning', { message: `No improvement for ${this.stuckCount} generations`, bestFitness: this.bestEver.fitness });
    }
    if (stats.diversity < 1) {
      this._log('warning', { message: `Very low diversity (${stats.diversity.toFixed(2)}) — population converging`, gen });
    }
    if (stats.best - stats.avg > 30) {
      this._log('warning', { message: `Large fitness gap (best=${stats.best.toFixed(0)}, avg=${stats.avg.toFixed(0)}) — one dominant organism`, gen });
    }

    this.lastBestFitness = stats.best;
  }

  logVisionResult(gen, visionResult) {
    this._log('vision_score', {
      gen,
      score: visionResult.score,
      buildingAssembly: visionResult.buildingAssembly,
      pathConnectivity: visionResult.pathConnectivity,
      treeStructure: visionResult.treeStructure,
      decorationPlacement: visionResult.decorationPlacement,
      overallComposition: visionResult.overallComposition,
      critique: visionResult.critique,
      tilePlacementRules: visionResult.tilePlacementRules,
      strengths: visionResult.strengths,
      weaknesses: visionResult.weaknesses
    });
  }

  logMutation(gen, parentFitness, childDna, changedGenes) {
    this._log('mutation', { gen, parentFitness, changedGenes, childSummary: this._summarizeDNA(childDna) });
  }

  logCrossover(gen, parent1Fitness, parent2Fitness, childDna) {
    this._log('crossover', { gen, parent1Fitness, parent2Fitness, childSummary: this._summarizeDNA(childDna) });
  }

  logKnowledgeUpdate(stats) {
    this._log('knowledge_update', stats);
  }

  logDiminishingReturns(gen, reason) {
    this._log('diminishing_returns', { gen, reason, bestEver: this.bestEver.fitness, stuckCount: this.stuckCount });
  }

  logError(gen, error) {
    this._log('error', { gen, error: error.message || error, stack: error.stack?.split('\n').slice(0, 3) });
  }

  // ── Gene correlation tracking ───────────────────────────────────────

  _updateGeneCorrelations(population) {
    // Sort by fitness, look at top 25% vs bottom 25%
    const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
    const topN = Math.max(1, Math.floor(sorted.length * 0.25));
    const top = sorted.slice(0, topN);
    const bottom = sorted.slice(-topN);

    const genes = Object.keys(top[0]?.dna || {});
    for (const gene of genes) {
      if (!this.geneCorrelations[gene]) {
        this.geneCorrelations[gene] = { topValues: [], bottomValues: [], importance: 0 };
      }
      const gc = this.geneCorrelations[gene];
      for (const org of top) {
        const val = org.dna[gene];
        if (typeof val === 'number') gc.topValues.push(val);
      }
      for (const org of bottom) {
        const val = org.dna[gene];
        if (typeof val === 'number') gc.bottomValues.push(val);
      }
      // Keep arrays manageable
      if (gc.topValues.length > 100) gc.topValues = gc.topValues.slice(-100);
      if (gc.bottomValues.length > 100) gc.bottomValues = gc.bottomValues.slice(-100);

      // Calculate importance: how different are top vs bottom values?
      if (gc.topValues.length >= 5 && gc.bottomValues.length >= 5) {
        const topAvg = gc.topValues.reduce((a, b) => a + b, 0) / gc.topValues.length;
        const botAvg = gc.bottomValues.reduce((a, b) => a + b, 0) / gc.bottomValues.length;
        const topStd = Math.sqrt(gc.topValues.reduce((s, v) => s + (v - topAvg) ** 2, 0) / gc.topValues.length) || 1;
        gc.importance = Math.abs(topAvg - botAvg) / topStd;
      }
    }
  }

  // ── DNA summarizer ──────────────────────────────────────────────────

  _summarizeDNA(dna) {
    if (!dna) return {};
    return {
      buildings: dna.buildingCount,
      buildSpacing: dna.buildingMinSpacing,
      pathStyle: dna.pathStyle,
      pathWidth: dna.pathWidth,
      fence: dna.fenceEnabled,
      grassMix: `${Math.round((dna.grassPlainPct || 0.6) * 100)}/${Math.round((dna.grassVariantPct || 0.3) * 100)}/${Math.round((dna.grassFlowerPct || 0.1) * 100)}`,
      treeBorder: dna.treeBorderDepth,
      treeClusters: dna.treeInteriorClusters,
      decoPerBldg: dna.decoPerBuilding,
      water: dna.waterEnabled,
      square: dna.squareEnabled
    };
  }

  // ── Session summary (written at end) ────────────────────────────────

  writeSummary() {
    const elapsed = Date.now() - this.startTime;
    const elapsedMin = (elapsed / 60000).toFixed(1);
    const totalGens = this.generationHistory.length;

    // Gene importance ranking
    const geneRanking = Object.entries(this.geneCorrelations)
      .filter(([, v]) => v.importance > 0)
      .sort(([, a], [, b]) => b.importance - a.importance)
      .slice(0, 15);

    // Fitness trajectory
    const trajectory = this.generationHistory.map(g => g.best);
    const earlyAvg = trajectory.slice(0, Math.min(5, trajectory.length)).reduce((a, b) => a + b, 0) / Math.min(5, trajectory.length);
    const lateAvg = trajectory.slice(-Math.min(5, trajectory.length)).reduce((a, b) => a + b, 0) / Math.min(5, trajectory.length);
    const improvement = lateAvg - earlyAvg;

    // Vision score trajectory
    const visionScores = this.generationHistory.filter(g => g.visionScore != null).map(g => ({ gen: g.gen, score: g.visionScore }));

    // Warnings
    const warnings = this.events.filter(e => e.type === 'warning');
    const errors = this.events.filter(e => e.type === 'error');

    const md = `# Evolution Session Summary

**Session**: ${this.sessionId}
**Date**: ${new Date().toISOString()}
**Duration**: ${elapsedMin} minutes
**Generations**: ${totalGens}
**Best Fitness**: ${this.bestEver.fitness.toFixed(1)} (gen ${this.bestEver.gen})
**Improvement**: ${earlyAvg.toFixed(0)} → ${lateAvg.toFixed(0)} (+${improvement.toFixed(0)})

## Best DNA Parameters
${JSON.stringify(this._summarizeDNA(this.bestEver.dna), null, 2)}

## Fitness Trajectory
| Gen | Best | Avg | Diversity | Vision |
|-----|------|-----|-----------|--------|
${this.generationHistory.filter((g, i) => i < 5 || i >= totalGens - 5 || i % Math.max(1, Math.floor(totalGens / 20)) === 0)
  .map(g => `| ${g.gen} | ${g.best} | ${g.avg} | ${g.diversity} | ${g.visionScore || '-'} |`).join('\n')}

## Most Important Genes (correlation with high fitness)
${geneRanking.map(([gene, data], i) => {
  const topAvg = data.topValues.length > 0 ? (data.topValues.reduce((a, b) => a + b, 0) / data.topValues.length).toFixed(2) : '?';
  const botAvg = data.bottomValues.length > 0 ? (data.bottomValues.reduce((a, b) => a + b, 0) / data.bottomValues.length).toFixed(2) : '?';
  return `${i + 1}. **${gene}** (importance: ${data.importance.toFixed(2)}) — top performers avg: ${topAvg}, bottom: ${botAvg}`;
}).join('\n')}

## Vision Score History
${visionScores.length > 0 ? visionScores.map(v => `- Gen ${v.gen}: ${v.score}`).join('\n') : 'No vision scoring performed.'}

## Warnings & Issues
${warnings.length > 0 ? warnings.slice(-10).map(w => `- ${w.message}`).join('\n') : 'No warnings.'}
${errors.length > 0 ? '\n### Errors\n' + errors.slice(-5).map(e => `- Gen ${e.gen}: ${e.error}`).join('\n') : ''}

## Recommendations for Next Version
${this._generateRecommendations(geneRanking, visionScores, warnings)}

## Raw Logs
See: \`${this.logPath}\`
`;

    fs.writeFileSync(this.summaryPath, md);
    return this.summaryPath;
  }

  _generateRecommendations(geneRanking, visionScores, warnings) {
    const recs = [];

    // Based on gene correlations
    if (geneRanking.length > 0) {
      const topGene = geneRanking[0];
      const topData = topGene[1];
      const topAvg = topData.topValues.length > 0 ? topData.topValues.reduce((a, b) => a + b, 0) / topData.topValues.length : 0;
      recs.push(`1. **Focus on "${topGene[0]}"** — most influential gene. High-fitness organisms converge on value ~${topAvg.toFixed(2)}. Consider narrowing its mutation range around this value.`);
    }

    // Based on diversity warnings
    const diversityWarnings = warnings.filter(w => w.message && w.message.includes('diversity'));
    if (diversityWarnings.length > 3) {
      recs.push(`2. **Increase mutation rate** — population converges too fast (${diversityWarnings.length} low-diversity warnings). Try mutationRate=0.25 or add periodic "random immigrant" organisms.`);
    }

    // Based on stuck count
    if (this.stuckCount > 20) {
      recs.push(`3. **Consider larger structural mutations** — stuck for ${this.stuckCount} gens. The current mutation approach may be trapped in a local optimum. Try occasionally randomizing 30%+ of genes.`);
    }

    // Based on vision scores
    if (visionScores.length >= 2) {
      const first = visionScores[0].score;
      const last = visionScores[visionScores.length - 1].score;
      if (last - first < 5) {
        recs.push(`4. **Vision score not improving** (${first} → ${last}). The genetic algorithm improves audit scores but not visual quality. Consider adding vision sub-scores (buildings, paths) directly to the fitness function.`);
      }
      if (last < 40) {
        recs.push(`5. **Low vision scores** (${last}). Maps don't visually match reference. The tile placement rules may need manual correction or the building/path generation logic needs structural fixes.`);
      }
    }

    // Based on fitness trajectory
    const trajectory = this.generationHistory.map(g => g.best);
    if (trajectory.length > 20) {
      const mid = trajectory[Math.floor(trajectory.length / 2)];
      const end = trajectory[trajectory.length - 1];
      if (end - mid < 2) {
        recs.push(`6. **Fitness plateaued early** — scores stopped improving around gen ${Math.floor(trajectory.length / 2)}. The audit scoring may have a ceiling that doesn't differentiate great maps from good ones. Consider adding more nuanced design quality checks.`);
      }
    }

    if (recs.length === 0) {
      recs.push('1. Evolution progressed well. Next step: review the top-scoring maps visually and provide manual feedback to refine the tile relationship knowledge.');
    }

    return recs.join('\n');
  }

  // ── Accessors ───────────────────────────────────────────────────────

  getGeneCorrelations() { return this.geneCorrelations; }
  getBestEver() { return this.bestEver; }
  getGenerationCount() { return this.generationHistory.length; }
  getLogPath() { return this.logPath; }
  getSummaryPath() { return this.summaryPath; }
}

module.exports = { EvolutionLogger };
