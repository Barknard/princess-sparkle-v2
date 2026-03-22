/**
 * TiledLoader.js — Loads Tiled JSON (.tmj) maps for Princess Sparkle V2
 *
 * Converts from Tiled's GID-based format to the game's internal format:
 *   - GID 0 = empty → -1 (for objects/foreground) or kept as-is for collision
 *   - GID > 0 = local tile ID = GID - firstgid
 *   - Layers matched by name: "ground", "objects", "foreground", "collision"
 *
 * Returns an object compatible with TileMap.loadLevel(levelData, tileset).
 */

/**
 * Load a Tiled JSON map and convert to game format.
 *
 * @param {string} tmjPath - Fetch URL for the .tmj file
 * @returns {Promise<{width: number, height: number, ground: Int16Array, objects: Int16Array, collision: Uint8Array, foreground: Int16Array}>}
 */
export async function loadTiledMap(tmjPath) {
  const resp = await fetch(tmjPath);
  if (!resp.ok) {
    throw new Error(`Failed to fetch Tiled map: ${tmjPath} (${resp.status})`);
  }
  const map = await resp.json();

  const width = map.width;
  const height = map.height;
  const totalTiles = width * height;

  // Get firstgid from the first tileset (Tiled uses 1-based GIDs)
  const firstgid = (map.tilesets && map.tilesets.length > 0)
    ? (map.tilesets[0].firstgid || 1)
    : 1;

  // Find layers by name
  const layerMap = {};
  for (const layer of map.layers) {
    if (layer.type === 'tilelayer' && layer.data) {
      layerMap[layer.name.toLowerCase()] = layer.data;
    }
  }

  /**
   * Convert a Tiled GID array to local tile IDs.
   * GID 0 = empty → emptyValue (typically -1)
   * GID > 0 → GID - firstgid
   */
  function convertLayer(gidData, emptyValue) {
    const out = new (emptyValue === -1 ? Int16Array : Uint8Array)(totalTiles);
    for (let i = 0; i < totalTiles; i++) {
      const gid = gidData ? gidData[i] : 0;
      if (gid === 0) {
        out[i] = emptyValue;
      } else {
        out[i] = gid - firstgid;
      }
    }
    return out;
  }

  // Ground layer — required, -1 for empty
  const ground = convertLayer(layerMap['ground'], -1);

  // Objects layer — optional, -1 for empty
  const objects = convertLayer(layerMap['objects'], -1);

  // Foreground layer — optional, -1 for empty
  const foreground = convertLayer(layerMap['foreground'], -1);

  // Collision layer — 0 = walkable, 1 = blocked
  // In Tiled, we use GID 0 = walkable, GID 1 (firstgid) = blocked
  // So: GID 0 → 0, GID >= firstgid → GID - firstgid (which gives 0 for tile 0 = walkable, 1 for tile 1 = blocked)
  // Actually for collision, the convention is simpler:
  //   GID 0 = empty = walkable = 0
  //   GID > 0 = blocked = 1 (any non-empty tile means blocked)
  const collisionGids = layerMap['collision'];
  const collision = new Uint8Array(totalTiles);
  if (collisionGids) {
    for (let i = 0; i < totalTiles; i++) {
      collision[i] = collisionGids[i] > 0 ? 1 : 0;
    }
  }

  return { width, height, ground, objects, collision, foreground };
}
