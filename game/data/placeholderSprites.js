/**
 * placeholderSprites.js — Procedural placeholder sprite generator
 *
 * Generates small canvas elements with colored shapes for every game entity.
 * This lets the game run and be VISIBLE even without downloaded art assets.
 *
 * Each generator function returns a canvas element that can be drawn via
 * ctx.drawImage(canvas, x, y). Sprites are cached after first creation.
 *
 * Usage:
 *   import PlaceholderSprites from './data/placeholderSprites.js';
 *   const princessCanvas = PlaceholderSprites.get('princess', 0);
 *   ctx.drawImage(princessCanvas, x, y);
 */

const TILE = 16; // base tile size in pixels

// ── Color Palettes ──────────────────────────────────────────────────────────

const COLORS = {
  // Princess
  princessDress:  '#ff9ff3',
  princessSkin:   '#ffe0ec',
  princessHair:   '#ffd700',
  princessCrown:  '#ffd700',
  princessCrownGem: '#ff4466',
  princessShoes:  '#8b5e3c',

  // Companions
  shimmer:   '#ffffff',  // unicorn white
  shimmerHorn: '#ffd700',
  shimmerMane: '#ffb6ff',
  ember:     '#ff6b6b',  // dragon red
  emberBelly: '#ffaa44',
  petal:     '#ffffff',  // bunny white
  petalEars: '#ffb6ff',
  breeze:    '#66aaff',  // butterfly blue
  breezeWings: '#ff6b8a',
  pip:       '#ff8844',  // fox orange
  pipChest:  '#ffffff',

  // NPCs
  npcGrandma: '#9966cc',
  npcFinn:    '#4488ff',
  npcLily:    '#66dd88',
  npcBaker:   '#cc8844',
  npcMelody:  '#ff6699',

  // Animals
  cat:       '#888888',
  dog:       '#aa7744',
  bird:      '#44aaff',
  frog:      '#44cc44',
  duck:      '#ffdd44',
  squirrel:  '#aa6622',
  rabbit:    '#dddddd',
  hedgehog:  '#886644',
  firefly:   '#ffff66',

  // Tiles
  grass:     '#5daa3a',
  grassDark: '#4a8c2e',
  path:      '#c4a86a',
  pathEdge:  '#a88c52',
  water:     '#4488cc',
  waterLight:'#66aaee',
  sand:      '#e8d8a0',
  stone:     '#888888',
  stoneWall: '#666666',
  wood:      '#8b6b3c',
  roof:      '#cc4444',
  flower1:   '#ff69b4',
  flower2:   '#ffd700',
  flower3:   '#aa66ff',
  treeTrunk: '#6b4226',
  treeLeaves:'#2d8a2d',
  treeDark:  '#1a6b1a',
  bush:      '#3d9a3d',

  // UI
  heartRed:  '#ff4466',
  heartPink: '#ff88aa',
  starGold:  '#ffd700',
  starLight: '#ffee88',
  questBang: '#ffdd00',
  dialogBg:  '#2a1a3a',
  dialogBorder: '#8866aa',
  white:     '#ffffff',
  black:     '#000000',
};

// ── Canvas Factory ──────────────────────────────────────────────────────────

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function circle(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function triangle(ctx, x1, y1, x2, y2, x3, y3, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

// ── Sprite Generators ───────────────────────────────────────────────────────

const generators = {

  // === PRINCESS (16x16) ===
  princess(frame) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const sway = frame === 1 ? 1 : 0;

    // Crown (gold triangle)
    triangle(ctx, 8, 0, 5, 3, 11, 3, COLORS.princessCrown);
    px(ctx, 8, 1, COLORS.princessCrownGem);

    // Hair
    rect(ctx, 5, 3, 6, 3, COLORS.princessHair);

    // Face
    rect(ctx, 6, 4, 4, 3, COLORS.princessSkin);
    // Eyes
    px(ctx, 7, 5, COLORS.black);
    px(ctx, 9, 5, COLORS.black);
    // Mouth
    px(ctx, 8, 6, '#ff6b8a');

    // Dress (pink rectangle)
    rect(ctx, 5, 7, 6, 5, COLORS.princessDress);
    // Dress shadow
    rect(ctx, 5, 9, 1, 2, '#e066cc');
    rect(ctx, 10, 9, 1, 2, '#e066cc');

    // Legs
    rect(ctx, 6 - sway, 12, 2, 2, COLORS.princessSkin);
    rect(ctx, 9 + sway, 12, 2, 2, COLORS.princessSkin);

    // Shoes
    rect(ctx, 6 - sway, 14, 2, 1, COLORS.princessShoes);
    rect(ctx, 9 + sway, 14, 2, 1, COLORS.princessShoes);

    return canvas;
  },

  // === SHIMMER THE UNICORN (16x16) ===
  unicorn(frame) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const step = frame === 1 ? 1 : 0;

    // Horn
    triangle(ctx, 7, 1, 6, 4, 8, 4, COLORS.shimmerHorn);

    // Mane
    rect(ctx, 4, 3, 2, 4, COLORS.shimmerMane);

    // Head
    rect(ctx, 5, 3, 5, 4, COLORS.shimmer);
    // Eye
    px(ctx, 7, 4, '#6a3d9a');
    // Nose
    px(ctx, 9, 5, '#ffcccc');

    // Body
    rect(ctx, 4, 7, 8, 4, COLORS.shimmer);
    rect(ctx, 4, 8, 8, 2, '#e8e0f0'); // shadow

    // Tail
    rect(ctx, 12, 7, 2, 3, COLORS.shimmerMane);

    // Legs
    rect(ctx, 5 - step, 11, 2, 3, COLORS.shimmer);
    rect(ctx, 9 + step, 11, 2, 3, COLORS.shimmer);
    // Hooves
    rect(ctx, 5 - step, 13, 2, 1, '#ffe0ec');
    rect(ctx, 9 + step, 13, 2, 1, '#ffe0ec');

    return canvas;
  },

  // === EMBER THE BABY DRAGON (16x16) ===
  dragon(frame) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const step = frame === 1 ? 1 : 0;

    // Horns
    rect(ctx, 5, 1, 1, 2, '#ff8844');
    rect(ctx, 8, 1, 1, 2, '#ff8844');

    // Head
    rect(ctx, 4, 3, 6, 4, COLORS.ember);
    // Eyes
    px(ctx, 5, 4, '#ffdd00');
    px(ctx, 8, 4, '#ffdd00');

    // Wings
    triangle(ctx, 2, 5, 2, 9, 4, 7, '#ff4444');
    triangle(ctx, 11, 5, 11, 9, 9, 7, '#ff4444');

    // Body
    rect(ctx, 4, 7, 6, 4, COLORS.ember);
    // Belly
    rect(ctx, 5, 8, 4, 2, COLORS.emberBelly);

    // Tail
    rect(ctx, 10, 9, 3, 2, COLORS.ember);
    px(ctx, 13, 10, '#cc3333');

    // Legs
    rect(ctx, 5 - step, 11, 2, 3, COLORS.ember);
    rect(ctx, 8 + step, 11, 2, 3, COLORS.ember);

    return canvas;
  },

  // === PETAL THE BUNNY (16x16) ===
  bunny(frame) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const hop = frame === 1 ? -1 : 0;

    // Ears
    rect(ctx, 5, 0 + hop, 2, 4, COLORS.petal);
    rect(ctx, 9, 0 + hop, 2, 4, COLORS.petal);
    // Inner ears
    px(ctx, 6, 1 + hop, COLORS.petalEars);
    px(ctx, 10, 1 + hop, COLORS.petalEars);

    // Head
    rect(ctx, 5, 4, 6, 4, COLORS.petal);
    // Eyes
    px(ctx, 6, 5, '#4a2040');
    px(ctx, 9, 5, '#4a2040');
    // Nose
    px(ctx, 8, 6, '#ffcccc');
    // Cheeks
    px(ctx, 6, 7, COLORS.petalEars);
    px(ctx, 10, 7, COLORS.petalEars);

    // Body
    rect(ctx, 5, 8, 6, 4, COLORS.petal);
    // Shadow
    rect(ctx, 5, 9, 6, 2, '#e8ddf0');

    // Tail puff
    circle(ctx, 12, 10, 1.5, COLORS.petal);

    // Legs
    const legOff = frame === 1 ? 1 : 0;
    rect(ctx, 6 - legOff, 12, 2, 2, COLORS.petal);
    rect(ctx, 9 + legOff, 12, 2, 2, COLORS.petal);

    return canvas;
  },

  // === BREEZE THE BUTTERFLY (16x16) ===
  butterfly(frame) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const wingsUp = frame === 0;

    // Antennae
    px(ctx, 6, 1, '#aaaaaa');
    px(ctx, 10, 1, '#aaaaaa');
    px(ctx, 7, 2, '#aaaaaa');
    px(ctx, 9, 2, '#aaaaaa');

    // Body
    rect(ctx, 7, 3, 2, 6, '#4a3060');
    // Eye
    px(ctx, 8, 4, COLORS.white);

    if (wingsUp) {
      // Wings up (touching body)
      // Left wing
      rect(ctx, 2, 3, 5, 4, COLORS.breezeWings);
      rect(ctx, 3, 4, 3, 2, '#ffaa44');
      px(ctx, 4, 5, COLORS.white);
      // Right wing
      rect(ctx, 9, 3, 5, 4, COLORS.breeze);
      rect(ctx, 10, 4, 3, 2, '#66ddaa');
      px(ctx, 11, 5, COLORS.white);
    } else {
      // Wings down (spread out)
      // Left wing
      rect(ctx, 1, 5, 5, 4, COLORS.breezeWings);
      rect(ctx, 2, 6, 3, 2, '#ffaa44');
      // Right wing
      rect(ctx, 10, 5, 5, 4, COLORS.breeze);
      rect(ctx, 11, 6, 3, 2, '#66ddaa');
    }

    return canvas;
  },

  // === PIP THE FOX CUB (16x16) ===
  fox(frame) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const step = frame === 1 ? 1 : 0;

    // Ears
    triangle(ctx, 4, 1, 4, 4, 6, 4, COLORS.pip);
    triangle(ctx, 11, 1, 9, 4, 11, 4, COLORS.pip);
    // Inner ears
    px(ctx, 5, 3, '#ffcc88');
    px(ctx, 10, 3, '#ffcc88');

    // Head
    rect(ctx, 5, 3, 6, 4, COLORS.pip);
    // Eyes
    px(ctx, 6, 4, COLORS.black);
    px(ctx, 9, 4, COLORS.black);
    // Nose
    px(ctx, 8, 5, COLORS.black);
    // White muzzle
    rect(ctx, 7, 5, 2, 2, COLORS.pipChest);

    // Body
    rect(ctx, 4, 7, 7, 4, COLORS.pip);
    // White chest
    rect(ctx, 6, 7, 3, 3, COLORS.pipChest);

    // Tail
    rect(ctx, 11, 8, 3, 2, COLORS.pip);
    px(ctx, 14, 8, COLORS.pipChest); // white tip
    px(ctx, 14, 9, COLORS.pipChest);

    // Legs
    rect(ctx, 5 - step, 11, 2, 3, COLORS.pip);
    rect(ctx, 8 + step, 11, 2, 3, COLORS.pip);

    return canvas;
  },

  // === NPCs (16x16) ===
  npc_grandma(frame) {
    return _drawNPC(COLORS.npcGrandma, '#ffe0ec', '#dddddd', frame);
  },
  npc_finn(frame) {
    return _drawNPC(COLORS.npcFinn, '#ffe0ec', '#6644aa', frame);
  },
  npc_lily(frame) {
    return _drawNPC(COLORS.npcLily, '#ffe0ec', '#44aa44', frame);
  },
  npc_baker(frame) {
    return _drawNPC(COLORS.npcBaker, '#ffe0ec', '#ffffff', frame);
  },
  npc_melody(frame) {
    return _drawNPC(COLORS.npcMelody, '#ffe0ec', '#ffaacc', frame);
  },

  // === Animals ===
  cat(frame) {
    return _drawAnimal(COLORS.cat, 16, 16, frame, (ctx) => {
      // Ears
      triangle(ctx, 3, 1, 3, 4, 5, 4, COLORS.cat);
      triangle(ctx, 10, 1, 8, 4, 10, 4, COLORS.cat);
      // Tail
      rect(ctx, 11, 6, 3, 1, COLORS.cat);
      rect(ctx, 13, 5, 1, 2, COLORS.cat);
    });
  },
  dog(frame) {
    return _drawAnimal(COLORS.dog, 16, 16, frame, (ctx) => {
      // Floppy ears
      rect(ctx, 3, 3, 2, 3, '#885522');
      rect(ctx, 9, 3, 2, 3, '#885522');
      // Tail up
      rect(ctx, 12, 5, 1, 3, COLORS.dog);
    });
  },
  bird(frame) {
    const { canvas, ctx } = makeCanvas(16, 8);
    const flap = frame === 1 ? -1 : 1;
    // Body
    circle(ctx, 8, 4, 3, COLORS.bird);
    // Wing
    rect(ctx, 5, 3 + flap, 3, 2, '#2288cc');
    // Beak
    triangle(ctx, 11, 3, 11, 5, 13, 4, '#ffaa00');
    // Eye
    px(ctx, 9, 3, COLORS.black);
    return canvas;
  },
  frog(frame) {
    const { canvas, ctx } = makeCanvas(16, 8);
    // Body
    rect(ctx, 4, 2, 8, 5, COLORS.frog);
    // Eyes (bulging)
    circle(ctx, 5, 2, 2, '#55dd55');
    circle(ctx, 11, 2, 2, '#55dd55');
    px(ctx, 5, 2, COLORS.black);
    px(ctx, 11, 2, COLORS.black);
    // Legs
    const hop = frame === 1 ? 1 : 0;
    rect(ctx, 3 - hop, 6, 2, 2, COLORS.frog);
    rect(ctx, 11 + hop, 6, 2, 2, COLORS.frog);
    return canvas;
  },
  duck(frame) {
    const { canvas, ctx } = makeCanvas(16, 12);
    // Body
    rect(ctx, 4, 4, 8, 6, COLORS.duck);
    // Head
    rect(ctx, 3, 1, 5, 4, COLORS.duck);
    // Eye
    px(ctx, 5, 2, COLORS.black);
    // Beak
    rect(ctx, 1, 3, 2, 2, '#ff8800');
    // Legs
    const step = frame === 1 ? 1 : 0;
    rect(ctx, 6 - step, 10, 1, 2, '#ff8800');
    rect(ctx, 9 + step, 10, 1, 2, '#ff8800');
    return canvas;
  },
  squirrel(frame) {
    const { canvas, ctx } = makeCanvas(16, 12);
    // Body
    rect(ctx, 4, 3, 6, 6, COLORS.squirrel);
    // Head
    rect(ctx, 3, 0, 5, 4, COLORS.squirrel);
    // Eye
    px(ctx, 5, 1, COLORS.black);
    // Ears
    px(ctx, 3, 0, '#cc8844');
    px(ctx, 7, 0, '#cc8844');
    // Big fluffy tail
    rect(ctx, 10, 1, 3, 6, '#cc8844');
    rect(ctx, 11, 0, 2, 2, '#cc8844');
    // Legs
    rect(ctx, 5, 9, 2, 2, COLORS.squirrel);
    rect(ctx, 8, 9, 2, 2, COLORS.squirrel);
    return canvas;
  },
  rabbit(frame) {
    const { canvas, ctx } = makeCanvas(16, 12);
    const hop = frame === 1 ? -1 : 0;
    // Ears
    rect(ctx, 5, 0 + hop, 2, 3, COLORS.rabbit);
    rect(ctx, 9, 0 + hop, 2, 3, COLORS.rabbit);
    // Head
    rect(ctx, 4, 2, 7, 4, COLORS.rabbit);
    px(ctx, 6, 3, '#4a2040');
    px(ctx, 9, 3, '#4a2040');
    // Body
    rect(ctx, 4, 6, 7, 4, COLORS.rabbit);
    // Tail
    circle(ctx, 12, 8, 1.5, COLORS.white);
    // Legs
    rect(ctx, 5, 10, 2, 2, COLORS.rabbit);
    rect(ctx, 8, 10, 2, 2, COLORS.rabbit);
    return canvas;
  },
  hedgehog(frame) {
    const { canvas, ctx } = makeCanvas(16, 10);
    // Spikes
    for (let i = 0; i < 5; i++) {
      triangle(ctx, 4 + i * 2, 0, 3 + i * 2, 3, 5 + i * 2, 3, '#665533');
    }
    // Body
    rect(ctx, 3, 3, 10, 5, COLORS.hedgehog);
    // Face
    rect(ctx, 2, 4, 3, 3, '#bbaa88');
    px(ctx, 2, 4, COLORS.black); // eye
    px(ctx, 1, 6, COLORS.black); // nose
    // Legs
    rect(ctx, 4, 8, 2, 2, '#664422');
    rect(ctx, 9, 8, 2, 2, '#664422');
    return canvas;
  },
  firefly(frame) {
    const { canvas, ctx } = makeCanvas(8, 4);
    const glow = frame === 0 ? COLORS.firefly : '#ffffaa';
    // Body
    rect(ctx, 2, 1, 4, 2, '#444422');
    // Glow
    circle(ctx, 5, 2, 2, glow);
    ctx.globalAlpha = 0.3;
    circle(ctx, 5, 2, 3, glow);
    ctx.globalAlpha = 1;
    return canvas;
  },

  // === World Objects ===
  flower_small(frame) {
    const { canvas, ctx } = makeCanvas(8, 8);
    // Stem
    rect(ctx, 3, 4, 1, 4, '#228b22');
    // Petals
    const c = frame === 0 ? COLORS.flower1 : COLORS.flower2;
    px(ctx, 3, 2, c);
    px(ctx, 2, 3, c);
    px(ctx, 4, 3, c);
    px(ctx, 3, 4, c);
    // Center
    px(ctx, 3, 3, COLORS.starGold);
    return canvas;
  },
  flower_big(frame) {
    const { canvas, ctx } = makeCanvas(8, 16);
    // Stem
    rect(ctx, 3, 8, 2, 8, '#228b22');
    // Leaf
    rect(ctx, 1, 11, 2, 1, '#90ee90');
    rect(ctx, 5, 13, 2, 1, '#90ee90');
    // Petals
    const c = frame === 0 ? '#ff69b4' : '#aa66ff';
    circle(ctx, 4, 5, 3, c);
    // Center
    circle(ctx, 4, 5, 1.5, COLORS.starGold);
    return canvas;
  },
  mushroom() {
    const { canvas, ctx } = makeCanvas(16, 16);
    // Cap
    rect(ctx, 3, 4, 10, 4, '#ff4444');
    // Spots
    px(ctx, 5, 5, COLORS.white);
    px(ctx, 8, 5, COLORS.white);
    px(ctx, 10, 6, COLORS.white);
    // Stem
    rect(ctx, 6, 8, 4, 5, '#eeeecc');
    // Base
    rect(ctx, 5, 13, 6, 1, '#eeeecc');
    return canvas;
  },

  // === Tile generators (16x16) ===
  tile_grass() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.grass);
    // Texture dots
    for (let i = 0; i < 6; i++) {
      const gx = (i * 7 + 3) % 14 + 1;
      const gy = (i * 5 + 2) % 14 + 1;
      px(ctx, gx, gy, COLORS.grassDark);
    }
    return canvas;
  },
  tile_path() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.path);
    // Edge texture
    for (let i = 0; i < 4; i++) {
      px(ctx, i * 4 + 2, 0, COLORS.pathEdge);
      px(ctx, i * 4 + 1, 15, COLORS.pathEdge);
    }
    return canvas;
  },
  tile_water() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.water);
    // Wave highlights
    for (let i = 0; i < 3; i++) {
      rect(ctx, 2 + i * 5, 4 + i * 4, 3, 1, COLORS.waterLight);
    }
    return canvas;
  },
  tile_sand() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.sand);
    // Texture dots
    for (let i = 0; i < 4; i++) {
      px(ctx, (i * 5 + 3) % 15, (i * 7 + 2) % 15, '#d8c890');
    }
    return canvas;
  },
  tile_stone() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.stone);
    // Mortar lines
    rect(ctx, 0, 7, 16, 1, '#777777');
    rect(ctx, 7, 0, 1, 7, '#777777');
    rect(ctx, 3, 8, 1, 8, '#777777');
    rect(ctx, 11, 8, 1, 8, '#777777');
    return canvas;
  },
  tile_wall() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.stoneWall);
    rect(ctx, 1, 1, 14, 14, '#777777');
    // Brick pattern
    rect(ctx, 0, 5, 16, 1, '#555555');
    rect(ctx, 0, 11, 16, 1, '#555555');
    rect(ctx, 8, 0, 1, 5, '#555555');
    rect(ctx, 4, 6, 1, 5, '#555555');
    rect(ctx, 12, 6, 1, 5, '#555555');
    return canvas;
  },
  tile_wood() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.wood);
    // Wood grain
    for (let i = 0; i < 4; i++) {
      rect(ctx, 0, i * 4 + 2, 16, 1, '#7a5a2c');
    }
    return canvas;
  },
  tile_roof() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.roof);
    // Shingle pattern
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const ox = r % 2 === 0 ? 0 : 2;
        rect(ctx, c * 4 + ox, r * 4, 4, 1, '#aa3333');
      }
    }
    return canvas;
  },
  tile_tree() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.grass);
    // Trunk
    rect(ctx, 6, 10, 4, 6, COLORS.treeTrunk);
    // Foliage layers
    circle(ctx, 8, 6, 5, COLORS.treeLeaves);
    circle(ctx, 6, 5, 3, COLORS.treeDark);
    circle(ctx, 10, 7, 3, COLORS.treeDark);
    return canvas;
  },
  tile_bush() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.grass);
    circle(ctx, 8, 10, 5, COLORS.bush);
    circle(ctx, 6, 9, 3, COLORS.treeLeaves);
    circle(ctx, 10, 11, 3, '#2a7a2a');
    return canvas;
  },
  tile_flowers() {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, COLORS.grass);
    // Scatter flowers
    const flowers = [
      [3, 4, COLORS.flower1], [8, 2, COLORS.flower2], [12, 6, COLORS.flower3],
      [5, 10, COLORS.flower2], [10, 12, COLORS.flower1], [2, 13, COLORS.flower3],
    ];
    for (const [fx, fy, fc] of flowers) {
      px(ctx, fx, fy, fc);
      px(ctx, fx - 1, fy + 1, fc);
      px(ctx, fx + 1, fy + 1, fc);
      px(ctx, fx, fy + 1, COLORS.starGold);
      px(ctx, fx, fy + 2, '#228b22');
    }
    return canvas;
  },

  // === UI Elements ===
  heart() {
    const { canvas, ctx } = makeCanvas(8, 8);
    // Heart shape
    circle(ctx, 2, 2, 2, COLORS.heartRed);
    circle(ctx, 5, 2, 2, COLORS.heartRed);
    triangle(ctx, 0, 3, 7, 3, 3.5, 7, COLORS.heartRed);
    // Highlight
    px(ctx, 2, 1, COLORS.heartPink);
    return canvas;
  },
  star() {
    const { canvas, ctx } = makeCanvas(8, 8);
    // 5-pointed star approximation
    ctx.fillStyle = COLORS.starGold;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * Math.PI / 180;
      const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
      const ox = 4 + Math.cos(angle) * 3.5;
      const oy = 4 + Math.sin(angle) * 3.5;
      const ix = 4 + Math.cos(innerAngle) * 1.5;
      const iy = 4 + Math.sin(innerAngle) * 1.5;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
      ctx.lineTo(ix, iy);
    }
    ctx.closePath();
    ctx.fill();
    // Center highlight
    px(ctx, 4, 3, COLORS.starLight);
    return canvas;
  },
  quest_indicator(frame) {
    const { canvas, ctx } = makeCanvas(8, 16);
    const bounce = frame === 1 ? -1 : 0;
    // Exclamation mark
    rect(ctx, 3, 2 + bounce, 2, 8, COLORS.questBang);
    rect(ctx, 3, 12 + bounce, 2, 2, COLORS.questBang);
    // Glow
    ctx.globalAlpha = 0.3;
    circle(ctx, 4, 8 + bounce, 5, COLORS.questBang);
    ctx.globalAlpha = 1;
    return canvas;
  },

  // === Dialogue Box Border (a 9-slice piece) ===
  dialogue_border() {
    const { canvas, ctx } = makeCanvas(16, 16);
    // Outer border
    rect(ctx, 0, 0, 16, 16, COLORS.dialogBorder);
    // Inner fill
    rect(ctx, 2, 2, 12, 12, COLORS.dialogBg);
    // Corner highlights
    px(ctx, 1, 1, '#aa88cc');
    px(ctx, 14, 1, '#aa88cc');
    px(ctx, 1, 14, '#aa88cc');
    px(ctx, 14, 14, '#aa88cc');
    return canvas;
  },

  // === Rainbow Particle (4x4) ===
  rainbow_particle(frame) {
    const { canvas, ctx } = makeCanvas(4, 4);
    const colors = ['#ff0000', '#ff8800', '#ffdd00', '#00cc44', '#4488ff', '#8844ff'];
    const c = colors[frame % colors.length];
    circle(ctx, 2, 2, 1.5, COLORS.white);
    rect(ctx, 1, 1, 2, 2, c);
    return canvas;
  },
};

// ── Helper: Generic NPC ─────────────────────────────────────────────────────

function _drawNPC(shirtColor, skinColor, hairColor, frame) {
  const { canvas, ctx } = makeCanvas(16, 16);
  const sway = frame === 1 ? 1 : 0;

  // Hair
  rect(ctx, 5, 2, 6, 3, hairColor);

  // Face
  rect(ctx, 6, 3, 4, 4, skinColor);
  // Eyes
  px(ctx, 7, 4, COLORS.black);
  px(ctx, 9, 4, COLORS.black);
  // Mouth
  px(ctx, 8, 6, '#cc6688');

  // Shirt
  rect(ctx, 5, 7, 6, 4, shirtColor);

  // Pants / skirt
  rect(ctx, 5, 11, 6, 2, '#555577');

  // Legs
  rect(ctx, 6 - sway, 13, 2, 2, skinColor);
  rect(ctx, 9 + sway, 13, 2, 2, skinColor);

  return canvas;
}

// ── Helper: Generic Animal ──────────────────────────────────────────────────

function _drawAnimal(bodyColor, w, h, frame, extraDraw) {
  const { canvas, ctx } = makeCanvas(w, h);
  const step = frame === 1 ? 1 : 0;

  // Head
  rect(ctx, 3, 2, 5, 4, bodyColor);
  // Eye
  px(ctx, 5, 3, COLORS.black);
  // Nose
  px(ctx, 2, 4, '#222222');

  // Body
  rect(ctx, 4, 6, 7, 4, bodyColor);

  // Legs
  rect(ctx, 5 - step, 10, 2, 3, bodyColor);
  rect(ctx, 8 + step, 10, 2, 3, bodyColor);

  // Custom additions (ears, tail, etc.)
  if (extraDraw) extraDraw(ctx);

  return canvas;
}

// ── Sprite Cache & Public API ───────────────────────────────────────────────

const _cache = new Map();

const PlaceholderSprites = {
  /**
   * Get a placeholder sprite canvas by name and frame.
   * @param {string} name - Sprite name (matches keys in spriteIndex.js)
   * @param {number} [frame=0] - Animation frame index
   * @returns {HTMLCanvasElement|null}
   */
  get(name, frame = 0) {
    const key = `${name}_${frame}`;
    if (_cache.has(key)) return _cache.get(key);

    const gen = generators[name];
    if (!gen) return null;

    const canvas = gen(frame);
    _cache.set(key, canvas);
    return canvas;
  },

  /**
   * Check if a placeholder generator exists for the given name.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return name in generators;
  },

  /**
   * Get all available sprite names.
   * @returns {string[]}
   */
  getNames() {
    return Object.keys(generators);
  },

  /**
   * Draw a placeholder sprite at position.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} name
   * @param {number} x
   * @param {number} y
   * @param {number} [frame=0]
   * @param {boolean} [flipX=false]
   * @param {number} [scale=1]
   */
  draw(ctx, name, x, y, frame = 0, flipX = false, scale = 1) {
    const sprite = this.get(name, frame);
    if (!sprite) return;

    ctx.save();
    if (flipX) {
      ctx.translate(x + sprite.width * scale, y);
      ctx.scale(-scale, scale);
    } else {
      ctx.translate(x, y);
      if (scale !== 1) ctx.scale(scale, scale);
    }
    ctx.drawImage(sprite, 0, 0);
    ctx.restore();
  },

  /**
   * Generate a complete tileset image (spritesheet) from tile generators.
   * Returns a canvas containing all tile types in a grid.
   * Compatible with TileSet.js (16x16 tiles in a grid).
   * @param {number} [cols=8] - Number of columns in the tileset
   * @returns {HTMLCanvasElement}
   */
  generateTileset(cols = 8) {
    const tileNames = [
      'tile_grass', 'tile_path', 'tile_water', 'tile_sand',
      'tile_stone', 'tile_wall', 'tile_wood', 'tile_roof',
      'tile_tree', 'tile_bush', 'tile_flowers',
    ];
    const rows = Math.ceil(tileNames.length / cols);
    const { canvas, ctx } = makeCanvas(cols * TILE, rows * TILE);

    tileNames.forEach((name, i) => {
      const tileCanvas = this.get(name);
      if (tileCanvas) {
        const tx = (i % cols) * TILE;
        const ty = Math.floor(i / cols) * TILE;
        ctx.drawImage(tileCanvas, tx, ty);
      }
    });

    return canvas;
  },

  /**
   * Generate a character spritesheet containing all entity sprites.
   * Each row is one entity, each column is a frame.
   * @returns {{ canvas: HTMLCanvasElement, index: Object }}
   */
  generateCharacterSheet() {
    const entities = [
      'princess', 'unicorn', 'dragon', 'bunny', 'butterfly', 'fox',
      'npc_grandma', 'npc_finn', 'npc_lily', 'npc_baker', 'npc_melody',
    ];
    const maxFrames = 2;
    const { canvas, ctx } = makeCanvas(TILE * maxFrames, TILE * entities.length);
    const index = {};

    entities.forEach((name, row) => {
      for (let f = 0; f < maxFrames; f++) {
        const sprite = this.get(name, f);
        if (sprite) {
          ctx.drawImage(sprite, f * TILE, row * TILE);
        }
      }
      index[name] = {
        x: 0,
        y: row * TILE,
        w: TILE * maxFrames,
        h: TILE,
        frames: maxFrames,
        frameW: TILE,
        frameH: TILE,
      };
    });

    return { canvas, index };
  },

  /**
   * Clear the sprite cache (useful if regenerating).
   */
  clearCache() {
    _cache.clear();
  },

  /** Expose COLORS for external use (e.g., UI drawing) */
  COLORS,

  /** Tile size constant */
  TILE_SIZE: TILE,
};

export default PlaceholderSprites;
