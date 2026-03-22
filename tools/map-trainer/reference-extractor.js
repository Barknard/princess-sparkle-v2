/**
 * reference-extractor.js
 *
 * Extracts the tile grid from a reference image by matching each 16x16 pixel
 * block against the tileset. This gives us ground-truth tile placement data
 * to learn adjacency rules from.
 *
 * The reference image (e.g., Kenney's sample.png) is rendered using the same
 * 16x16 tiles from sprites/town/tilemap_packed.png. We reverse-engineer which
 * tile was used at each position by comparing pixel data.
 */

const sharp = require('sharp');
const path = require('path');

const TILE_SIZE = 16;
const TILESET_COLS = 12;
const TILESET_ROWS = 11;
const TOTAL_TILES = TILESET_COLS * TILESET_ROWS; // 132
const MSE_THRESHOLD = 500;

/**
 * Compute mean squared error between two 16x16 RGBA pixel buffers on RGB channels.
 * MSE = sum((r1-r2)^2 + (g1-g2)^2 + (b1-b2)^2) / (16*16*3)
 */
function computeMSE(bufA, bufB) {
  let sum = 0;
  const pixelCount = TILE_SIZE * TILE_SIZE;
  for (let i = 0; i < pixelCount * 4; i += 4) {
    const dr = bufA[i] - bufB[i];
    const dg = bufA[i + 1] - bufB[i + 1];
    const db = bufA[i + 2] - bufB[i + 2];
    sum += dr * dr + dg * dg + db * db;
  }
  return sum / (pixelCount * 3);
}

/**
 * Extract all 132 individual 16x16 tiles from the tileset as RGBA buffers.
 */
async function extractTileBuffers(tilesetPath) {
  const tilesetRaw = await sharp(tilesetPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = tilesetRaw;
  const stride = info.width * 4; // bytes per row (RGBA)

  const tileBuffers = [];
  for (let id = 0; id < TOTAL_TILES; id++) {
    const col = id % TILESET_COLS;
    const row = Math.floor(id / TILESET_COLS);
    const tilePixels = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);

    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const srcIdx = (row * TILE_SIZE + y) * stride + (col * TILE_SIZE + x) * 4;
        const dstIdx = (y * TILE_SIZE + x) * 4;
        tilePixels[dstIdx] = data[srcIdx];
        tilePixels[dstIdx + 1] = data[srcIdx + 1];
        tilePixels[dstIdx + 2] = data[srcIdx + 2];
        tilePixels[dstIdx + 3] = data[srcIdx + 3];
      }
    }
    tileBuffers.push(tilePixels);
  }

  return tileBuffers;
}

/**
 * Detect the scale factor of the reference image relative to 16x16 tiles.
 * Tries 1x, 2x, 3x, 4x and picks the one that divides evenly (preferring
 * the factor that yields the best overall tile match quality).
 */
async function detectScale(referencePath, refWidth, refHeight, tileBuffers) {
  const scales = [1, 2, 3, 4];
  const validScales = [];

  // First pass: find scales that divide evenly (or nearly so)
  for (const s of scales) {
    const tilePixelSize = TILE_SIZE * s;
    const widthRem = refWidth % tilePixelSize;
    const heightRem = refHeight % tilePixelSize;
    if (widthRem === 0 && heightRem === 0) {
      validScales.push({ scale: s, exact: true });
    } else if (widthRem <= 2 && heightRem <= 2) {
      validScales.push({ scale: s, exact: false });
    }
  }

  if (validScales.length === 0) {
    // Fallback: pick the scale closest to producing integer grid dims
    let bestScale = 1;
    let bestError = Infinity;
    for (const s of scales) {
      const tps = TILE_SIZE * s;
      const err = (refWidth % tps) + (refHeight % tps);
      if (err < bestError) {
        bestError = err;
        bestScale = s;
      }
    }
    return bestScale;
  }

  // If only one valid scale, use it
  if (validScales.length === 1) {
    return validScales[0].scale;
  }

  // Multiple valid scales: sample a few blocks and pick the scale with best matches
  const refRaw = await sharp(referencePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bestScale = validScales[0].scale;
  let bestAvgMSE = Infinity;

  for (const { scale } of validScales) {
    const tilePixelSize = TILE_SIZE * scale;
    const gw = Math.floor(refWidth / tilePixelSize);
    const gh = Math.floor(refHeight / tilePixelSize);

    // Sample up to 20 blocks spread across the image
    const sampleCount = Math.min(20, gw * gh);
    const step = Math.max(1, Math.floor((gw * gh) / sampleCount));
    let totalMSE = 0;
    let samples = 0;

    for (let idx = 0; idx < gw * gh && samples < sampleCount; idx += step) {
      const gx = idx % gw;
      const gy = Math.floor(idx / gw);
      const blockX = gx * tilePixelSize;
      const blockY = gy * tilePixelSize;

      const blockPixels = downsampleBlock(
        refRaw.data, refWidth, blockX, blockY, tilePixelSize, scale
      );

      let bestMSE = Infinity;
      for (let id = 0; id < TOTAL_TILES; id++) {
        const mse = computeMSE(blockPixels, tileBuffers[id]);
        if (mse < bestMSE) bestMSE = mse;
      }
      totalMSE += bestMSE;
      samples++;
    }

    const avgMSE = samples > 0 ? totalMSE / samples : Infinity;
    if (avgMSE < bestAvgMSE) {
      bestAvgMSE = avgMSE;
      bestScale = scale;
    }
  }

  return bestScale;
}

/**
 * Extract a block from the reference image at (blockX, blockY) with size
 * tilePixelSize, and downsample to 16x16 RGBA by averaging each scale*scale
 * pixel group. For scale=1 this is a straight copy.
 */
function downsampleBlock(refData, refWidth, blockX, blockY, tilePixelSize, scale) {
  const blockPixels = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);
  const stride = refWidth * 4;

  if (scale === 1) {
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const srcIdx = (blockY + y) * stride + (blockX + x) * 4;
        const dstIdx = (y * TILE_SIZE + x) * 4;
        blockPixels[dstIdx] = refData[srcIdx];
        blockPixels[dstIdx + 1] = refData[srcIdx + 1];
        blockPixels[dstIdx + 2] = refData[srcIdx + 2];
        blockPixels[dstIdx + 3] = refData[srcIdx + 3];
      }
    }
  } else {
    // Average each scale*scale pixel group down to one pixel
    const scaleSquared = scale * scale;
    for (let ty = 0; ty < TILE_SIZE; ty++) {
      for (let tx = 0; tx < TILE_SIZE; tx++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const srcX = blockX + tx * scale + sx;
            const srcY = blockY + ty * scale + sy;
            const srcIdx = srcY * stride + srcX * 4;
            r += refData[srcIdx];
            g += refData[srcIdx + 1];
            b += refData[srcIdx + 2];
            a += refData[srcIdx + 3];
          }
        }
        const dstIdx = (ty * TILE_SIZE + tx) * 4;
        blockPixels[dstIdx] = Math.round(r / scaleSquared);
        blockPixels[dstIdx + 1] = Math.round(g / scaleSquared);
        blockPixels[dstIdx + 2] = Math.round(b / scaleSquared);
        blockPixels[dstIdx + 3] = Math.round(a / scaleSquared);
      }
    }
  }

  return blockPixels;
}

/**
 * Extract tile grid from a reference image.
 * @param {string} referencePath - path to reference image PNG
 * @param {string} tilesetPath - path to tilemap_packed.png (192x176, 12x11 grid of 16x16 tiles)
 * @returns {Promise<{
 *   width: number,         // grid width in tiles
 *   height: number,        // grid height in tiles
 *   tiles: number[],       // flat row-major array of tile IDs (or -1 for no match)
 *   scale: number,         // detected scale factor
 *   matchQuality: number,  // average match quality (0-1, higher = better)
 *   unmatchedCount: number, // number of -1 tiles
 *   tileFrequency: Object  // { tileId: count }
 * }>}
 */
async function extractTilesFromReference(referencePath, tilesetPath) {
  // 1. Load both images metadata
  const refMeta = await sharp(referencePath).metadata();

  // 2. Extract all 132 tiles from the tileset
  const tileBuffers = await extractTileBuffers(tilesetPath);

  // 3. Detect scale factor
  const bestScale = await detectScale(
    referencePath, refMeta.width, refMeta.height, tileBuffers
  );

  const tilePixelSize = TILE_SIZE * bestScale;
  const gridW = Math.floor(refMeta.width / tilePixelSize);
  const gridH = Math.floor(refMeta.height / tilePixelSize);

  // 4. Load reference as raw RGBA
  const refRaw = await sharp(referencePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const refData = refRaw.data;
  const refWidth = refRaw.info.width;

  // 5. For each grid cell, extract the block, downscale to 16x16, compare to all tiles
  const tiles = new Array(gridW * gridH).fill(-1);
  const matchQualities = [];
  const tileFreq = {};
  let unmatchedCount = 0;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const blockX = gx * tilePixelSize;
      const blockY = gy * tilePixelSize;

      // Extract and downsample block to 16x16
      const blockPixels = downsampleBlock(
        refData, refWidth, blockX, blockY, tilePixelSize, bestScale
      );

      // Compare block to all tiles, find best match
      let bestId = -1;
      let bestMSE = Infinity;

      for (let id = 0; id < TOTAL_TILES; id++) {
        const mse = computeMSE(blockPixels, tileBuffers[id]);
        if (mse < bestMSE) {
          bestMSE = mse;
          bestId = id;
        }
      }

      // Threshold check
      if (bestMSE < MSE_THRESHOLD) {
        tiles[gy * gridW + gx] = bestId;
        matchQualities.push(1 - bestMSE / MSE_THRESHOLD);
        tileFreq[bestId] = (tileFreq[bestId] || 0) + 1;
      } else {
        tiles[gy * gridW + gx] = -1;
        unmatchedCount++;
        matchQualities.push(0);
      }
    }
  }

  const avgQuality = matchQualities.length > 0
    ? matchQualities.reduce((a, b) => a + b, 0) / matchQualities.length
    : 0;

  return {
    width: gridW,
    height: gridH,
    tiles,
    scale: bestScale,
    matchQuality: avgQuality,
    unmatchedCount,
    tileFrequency: tileFreq
  };
}

/**
 * Analyze a reference and feed results into the tile relationship learner.
 * @param {string} referencePath
 * @param {string} tilesetPath
 * @param {Object} learner - TileRelationshipLearner instance
 * @returns {Promise<{ grid: Object, rulesLearned: number, stats: Object }>}
 */
async function analyzeReference(referencePath, tilesetPath, learner) {
  const grid = await extractTilesFromReference(referencePath, tilesetPath);

  // Convert to mapData format that the learner expects.
  // The reference is a single layer — treat all tiles as ground/objects.
  const mapData = {
    width: grid.width,
    height: grid.height,
    ground: grid.tiles.slice(),
    objects: new Array(grid.width * grid.height).fill(-1),
    foreground: new Array(grid.width * grid.height).fill(-1)
  };

  // Learn from this with 3x weight (it's ground truth from an official reference)
  learner.learnFromReference(mapData, 3);

  const rulesLearned = learner.getStats().totalRelationships;

  return { grid, rulesLearned, stats: learner.getStats() };
}

module.exports = { extractTilesFromReference, analyzeReference };

// Self-test when run directly
if (require.main === module) {
  const TRAINER_DIR = __dirname;
  const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

  const refPath = path.join(TRAINER_DIR, 'reference-images', 'kenney-tiny-town-sample.png');
  const tilesetPath = path.join(PROJECT_ROOT, 'sprites', 'town', 'tilemap_packed.png');

  (async () => {
    try {
      console.log('Extracting tiles from reference image...');
      console.log(`  Reference: ${refPath}`);
      console.log(`  Tileset:   ${tilesetPath}`);
      console.time('extraction');
      const grid = await extractTilesFromReference(refPath, tilesetPath);
      console.timeEnd('extraction');

      console.log(`Grid: ${grid.width} x ${grid.height} tiles`);
      console.log(`Scale: ${grid.scale}x`);
      console.log(`Match quality: ${(grid.matchQuality * 100).toFixed(1)}%`);
      console.log(`Unmatched: ${grid.unmatchedCount} of ${grid.width * grid.height} tiles`);
      console.log(
        'Top tiles:',
        Object.entries(grid.tileFrequency)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([id, count]) => `${id}(${count})`)
          .join(', ')
      );

      // Print a small section of the grid
      console.log('\nTop-left 10x5 of grid:');
      for (let y = 0; y < Math.min(5, grid.height); y++) {
        const row = [];
        for (let x = 0; x < Math.min(10, grid.width); x++) {
          const t = grid.tiles[y * grid.width + x];
          row.push(t >= 0 ? String(t).padStart(3) : '  -');
        }
        console.log('  ' + row.join(' '));
      }

      // Feed into tile relationship learner
      const { TileRelationshipLearner } = require('./tile-relationship-learner');
      const learner = new TileRelationshipLearner();

      console.log('\nLearning tile relationships from reference...');
      const result = await analyzeReference(refPath, tilesetPath, learner);
      console.log(`Rules learned: ${result.rulesLearned}`);
      console.log('Stats:', result.stats);

      // Save the learned knowledge
      const knowledgePath = path.join(TRAINER_DIR, 'learned-tile-knowledge.json');
      learner.saveToFile(knowledgePath);
      console.log(`Knowledge saved to ${knowledgePath}`);

      // Show some learned adjacency rules
      console.log('\nTop learned adjacency rules:');
      const knowledge = learner.exportKnowledge();
      const topPairs = [];
      for (const [tileA, dirs] of Object.entries(knowledge.adjacency || {})) {
        for (const [dir, neighbors] of Object.entries(dirs)) {
          for (const [tileB, count] of Object.entries(neighbors)) {
            if (count >= 2 && parseInt(tileB) >= 0) {
              topPairs.push({
                a: parseInt(tileA),
                dir,
                b: parseInt(tileB),
                count
              });
            }
          }
        }
      }
      topPairs.sort((a, b) => b.count - a.count);
      topPairs.slice(0, 15).forEach(p => {
        console.log(`  Tile ${p.a} -> ${p.dir} -> Tile ${p.b} (${p.count}x)`);
      });
    } catch (err) {
      console.error('Error:', err.message);
      console.error(err.stack);
      process.exit(1);
    }
  })();
}
