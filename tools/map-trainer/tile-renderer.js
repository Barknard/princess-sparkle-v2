/**
 * tile-renderer.js
 *
 * Renders tile map data into PNG images using Sharp.
 * Composites tiles from tilemap_packed.png (192x176, 12x11 grid of 16x16 tiles)
 * onto a canvas sized to the map dimensions.
 */

const sharp = require('sharp');
const fs = require('fs');

const TILE_SIZE = 16;
const TILESET_COLS = 12;
const TILESET_ROWS = 11;
const MAX_TILE_ID = TILESET_COLS * TILESET_ROWS - 1; // 131

/**
 * Extract a single 16x16 tile from the tileset as a PNG buffer.
 * @param {Buffer} tilesetBuffer - Raw pixel data of the tileset loaded via Sharp
 * @param {number} tileId - Tile index (0-131)
 * @param {Object} tilesetMeta - { width, height } of the tileset
 * @returns {Promise<Buffer>} 16x16 PNG buffer
 */
async function extractTile(tilesetBuffer, tileId, tilesetMeta) {
  const srcX = (tileId % TILESET_COLS) * TILE_SIZE;
  const srcY = Math.floor(tileId / TILESET_COLS) * TILE_SIZE;

  return sharp(tilesetBuffer, {
    raw: {
      width: tilesetMeta.width,
      height: tilesetMeta.height,
      channels: 4
    }
  })
    .extract({ left: srcX, top: srcY, width: TILE_SIZE, height: TILE_SIZE })
    .png()
    .toBuffer();
}

/**
 * Render tile layers into a PNG buffer.
 * @param {Object} tileData - { width, height, ground: Array, objects: Array, foreground: Array }
 * @param {string} tilesetPath - Path to tilemap_packed.png
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function renderMapToPng(tileData, tilesetPath) {
  // Validate tileset exists
  if (!fs.existsSync(tilesetPath)) {
    throw new Error(`Tileset not found at: ${tilesetPath}`);
  }

  const { width, height, ground, objects, foreground } = tileData;
  const canvasWidth = width * TILE_SIZE;
  const canvasHeight = height * TILE_SIZE;

  // Load the tileset into raw RGBA pixels
  const tilesetImage = sharp(tilesetPath).ensureAlpha();
  const tilesetMeta = await tilesetImage.metadata();
  const tilesetBuffer = await tilesetImage.raw().toBuffer();
  const tilesetInfo = { width: tilesetMeta.width, height: tilesetMeta.height };

  // Collect all unique tile IDs across all layers
  const uniqueTileIds = new Set();
  const layers = [ground, objects, foreground];

  for (const layer of layers) {
    if (!layer) continue;
    for (const id of layer) {
      if (id >= 0 && id <= MAX_TILE_ID) {
        uniqueTileIds.add(id);
      }
    }
  }

  // Pre-extract all unique tiles as PNG buffers (cache)
  const tileCache = new Map();
  const extractionPromises = [];

  for (const id of uniqueTileIds) {
    extractionPromises.push(
      extractTile(tilesetBuffer, id, tilesetInfo).then(buf => {
        tileCache.set(id, buf);
      })
    );
  }
  await Promise.all(extractionPromises);

  // Build composite operations for all three layers in order
  const composites = [];

  for (const layer of layers) {
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const tileId = layer[i];
      if (tileId < 0 || tileId > MAX_TILE_ID) continue;

      const tileBuf = tileCache.get(tileId);
      if (!tileBuf) continue;

      const x = (i % width) * TILE_SIZE;
      const y = Math.floor(i / width) * TILE_SIZE;

      composites.push({
        input: tileBuf,
        left: x,
        top: y
      });
    }
  }

  // Create canvas and composite all tiles
  const result = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 255 }
    }
  })
    .composite(composites)
    .png()
    .toBuffer();

  return result;
}

/**
 * Render tile layers into a base64-encoded PNG string.
 * @param {Object} tileData - { width, height, ground: Array, objects: Array, foreground: Array }
 * @param {string} tilesetPath - Path to tilemap_packed.png
 * @returns {Promise<string>} Base64-encoded PNG string
 */
async function renderMapToBase64(tileData, tilesetPath) {
  const buffer = await renderMapToPng(tileData, tilesetPath);
  return buffer.toString('base64');
}

module.exports = { renderMapToPng, renderMapToBase64 };

// Self-test when run directly
if (require.main === module) {
  // Quick test with a tiny 4x3 map
  const path = require('path');
  const tilesetPath = path.join(__dirname, '..', '..', 'sprites', 'town', 'tilemap_packed.png');
  const testData = {
    width: 4, height: 3,
    ground: [1,1,2,1, 1,2,1,43, 1,1,1,2],
    objects: [-1,-1,-1,-1, -1,92,-1,-1, -1,104,-1,-1],
    foreground: [-1,-1,-1,-1, -1,-1,-1,-1, -1,-1,-1,-1]
  };
  renderMapToPng(testData, tilesetPath).then(buf => {
    require('fs').writeFileSync('/tmp/test-render.png', buf);
    console.log('Test render saved to /tmp/test-render.png (' + buf.length + ' bytes)');
  }).catch(err => console.error('Error:', err));
}
