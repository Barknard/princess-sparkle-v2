// Pixel Art Sprite Generator
// Draws all companions and the princess as pixel art on canvas
// No external assets needed — pure procedural pixel art

const Sprites = {
  cache: {},

  // Get or create a cached sprite
  get(name, frame = 0) {
    const key = name + '_' + frame;
    if (this.cache[key]) return this.cache[key];

    const data = SPRITE_DATA[name];
    if (!data) return null;

    const frameData = data.frames[frame % data.frames.length];
    const canvas = document.createElement('canvas');
    canvas.width = data.w;
    canvas.height = data.h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    this._drawPixels(ctx, frameData, data.palette);
    this.cache[key] = canvas;
    return canvas;
  },

  _drawPixels(ctx, grid, palette) {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        if (c === '.' || c === ' ') continue; // transparent
        const color = palette[c];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  },

  // Draw a sprite at position with optional flip
  draw(ctx, name, x, y, frame = 0, flipX = false, scale = 1) {
    const sprite = this.get(name, frame);
    if (!sprite) return;

    ctx.save();
    if (flipX) {
      ctx.translate(x + sprite.width * scale, y);
      ctx.scale(-scale, scale);
    } else {
      ctx.translate(x, y);
      ctx.scale(scale, scale);
    }
    ctx.drawImage(sprite, 0, 0);
    ctx.restore();
  }
};

// Sprite pixel data — each character maps to a palette color
// '.' = transparent
const SPRITE_DATA = {
  // === PRINCESS (16x16) ===
  princess: {
    w: 16, h: 16,
    palette: {
      'H': '#ffd700', // hair gold
      'h': '#e6b800', // hair shadow
      'S': '#ffe0ec', // skin
      's': '#ffccd5', // skin shadow
      'E': '#4a2040', // eyes
      'M': '#ff6b8a', // mouth/cheeks
      'D': '#ff9ff3', // dress pink
      'd': '#e066cc', // dress shadow
      'C': '#ffd700', // crown gold
      'c': '#ffaa00', // crown accent
      'W': '#ffffff', // white
      'B': '#8b5e3c', // shoes
    },
    frames: [
      [ // standing
        '......CcC.....',
        '.....CcccC....',
        '.....HHHH.....',
        '....HHHHHH....',
        '....HSSEEH....',
        '....hSMSMh....',
        '.....SSSS.....',
        '.....DDDD.....',
        '....DDDDDD....',
        '....DdDDdD....',
        '....DDDDDD....',
        '....DdDDdD....',
        '.....DDDD.....',
        '.....S..S.....',
        '.....B..B.....',
        '................',
      ],
      [ // walk frame 1
        '......CcC.....',
        '.....CcccC....',
        '.....HHHH.....',
        '....HHHHHH....',
        '....HSSEEH....',
        '....hSMSMh....',
        '.....SSSS.....',
        '.....DDDD.....',
        '....DDDDDD....',
        '....DdDDdD....',
        '....DDDDDD....',
        '....DdDDdD....',
        '.....DDDD.....',
        '....S....S....',
        '....B....B....',
        '................',
      ]
    ]
  },

  // === SHIMMER THE UNICORN (16x16) ===
  unicorn: {
    w: 16, h: 16,
    palette: {
      'W': '#ffffff', // body white
      'w': '#e8e0f0', // body shadow
      'H': '#ffd700', // horn gold
      'h': '#ffaa00', // horn accent
      'E': '#6a3d9a', // eye purple
      'M': '#ffb6ff', // mane pink
      'm': '#ff80ea', // mane accent
      'T': '#ff9ff3', // tail pink
      't': '#ff6bdb', // tail accent
      'P': '#ffe0ec', // hooves
      'R': '#ff0000', // red rainbow
      'O': '#ff8800', // orange rainbow
      'Y': '#ffd700', // yellow rainbow
      'G': '#00cc44', // green rainbow
      'B': '#4488ff', // blue rainbow
      'V': '#8844ff', // violet rainbow
      'N': '#ffcccc', // nose pink
    },
    frames: [
      [ // standing
        '......Hh........',
        '.....HW.........',
        '....MWWW........',
        '...mMWWWW.......',
        '...MWEWWW.......',
        '....WNWWW.......',
        '....WWWWWW......',
        '....WwWWwW......',
        '....WWWWWWT.....',
        '....WwWWwWT.....',
        '....WWWWWWT.....',
        '.....WWWW.t.....',
        '.....W..W.......',
        '.....P..P.......',
        '................',
        '................',
      ],
      [ // walk frame
        '......Hh........',
        '.....HW.........',
        '....MWWW........',
        '...mMWWWW.......',
        '...MWEWWW.......',
        '....WNWWW.......',
        '....WWWWWW......',
        '....WwWWwW......',
        '....WWWWWWT.....',
        '....WwWWwWT.....',
        '....WWWWWWT.....',
        '.....WWWW.t.....',
        '....W....W......',
        '....P....P......',
        '................',
        '................',
      ]
    ]
  },

  // === EMBER THE BABY DRAGON (16x16) ===
  dragon: {
    w: 16, h: 16,
    palette: {
      'R': '#ff6b6b', // body red
      'r': '#cc4444', // body shadow
      'O': '#ffaa44', // belly orange
      'o': '#ff8800', // belly accent
      'E': '#ffdd00', // eyes yellow
      'W': '#ff4444', // wings
      'w': '#cc2222', // wing shadow
      'F': '#ffdd00', // fire/spark
      'f': '#ff8800', // fire accent
      'H': '#ff8844', // horns
      'T': '#ff5555', // tail
      't': '#cc3333', // tail tip
    },
    frames: [
      [ // standing
        '....HH..........',
        '...RRRR.........',
        '..WRRRRR........',
        '..wREERR........',
        '...RRRR.........',
        '...ROORR........',
        '..WRROORW.......',
        '..wRROORw.......',
        '...RRRRRR.......',
        '...RrRRrR.......',
        '...RRRRRRT......',
        '....RRRR.Tt.....',
        '....R..R........',
        '....R..R........',
        '................',
        '................',
      ],
      [ // walk frame
        '....HH..........',
        '...RRRR.........',
        '..WRRRRR........',
        '..wREERR........',
        '...RRRR.........',
        '...ROORR........',
        '..WRROORW.......',
        '..wRROORw.......',
        '...RRRRRR.......',
        '...RrRRrR.......',
        '...RRRRRRT......',
        '....RRRR.Tt.....',
        '...R....R.......',
        '...R....R.......',
        '................',
        '................',
      ]
    ]
  },

  // === PETAL THE BUNNY (16x16) ===
  bunny: {
    w: 16, h: 16,
    palette: {
      'W': '#ffffff', // body white
      'w': '#e8ddf0', // body shadow
      'P': '#ffb6ff', // inner ear/cheek pink
      'E': '#4a2040', // eyes
      'N': '#ffcccc', // nose
      'T': '#ffffff', // tail puff
      'F': '#90ee90', // flower green
      'f': '#ff69b4', // flower pink
    },
    frames: [
      [ // standing
        '...WW..WW.......',
        '...WP..PW.......',
        '...WW..WW.......',
        '....WWWW........',
        '....WEWEW.......',
        '....WWNWW.......',
        '....WPWPW.......',
        '.....WWW........',
        '....WWWWW.......',
        '....WwWwW.......',
        '....WWWWWT......',
        '....WwWwW.......',
        '.....WWW........',
        '.....W.W........',
        '.....W.W........',
        '................',
      ],
      [ // hop frame
        '...WW..WW.......',
        '...WP..PW.......',
        '...WW..WW.......',
        '....WWWW........',
        '....WEWEW.......',
        '....WWNWW.......',
        '....WPWPW.......',
        '.....WWW........',
        '....WWWWW.......',
        '....WwWwW.......',
        '....WWWWWT......',
        '....WwWwW.......',
        '.....WWW........',
        '....W...W.......',
        '....W...W.......',
        '................',
      ]
    ]
  },

  // === BREEZE THE BUTTERFLY (16x16) ===
  butterfly: {
    w: 16, h: 16,
    palette: {
      'R': '#ff6b8a', // wing red-pink
      'O': '#ffaa44', // wing orange
      'Y': '#ffd700', // wing yellow
      'G': '#66ddaa', // wing green
      'B': '#66aaff', // wing blue
      'V': '#aa66ff', // wing violet
      'b': '#4a3060', // body dark
      'E': '#ffffff', // eye
      'A': '#aaaaaa', // antenna
      'W': '#ffffff', // wing dots
    },
    frames: [
      [ // wings up
        '..A......A......',
        '...A....A.......',
        '.RRbbbBB........',
        'ROObbbBBG.......',
        'RYObbbBGG.......',
        'ROObEbBBG.......',
        '.RRbbbBB........',
        '....b...........',
        '....b...........',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
      ],
      [ // wings down
        '..A......A......',
        '...A....A.......',
        '....bbb.........',
        '.RR.bbb.BB......',
        'ROO.bbb.BBG.....',
        'RYO.bEb.BGG.....',
        'ROO.bbb.BBG.....',
        '.RR.b...BB......',
        '....b...........',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
      ]
    ]
  },

  // === PIP THE FOX CUB (16x16) ===
  fox: {
    w: 16, h: 16,
    palette: {
      'O': '#ff8844', // body orange
      'o': '#dd6622', // body shadow
      'W': '#ffffff', // white chest/tail tip
      'w': '#eeeeee', // white shadow
      'E': '#2a1a30', // eyes
      'N': '#222222', // nose
      'I': '#ffcc88', // inner ear
      'T': '#ff8844', // tail
      't': '#ffffff', // tail tip
    },
    frames: [
      [ // standing
        '....OO.OO.......',
        '....OI.IO.......',
        '....OOOOO.......',
        '....OEWEO.......',
        '.....ONO........',
        '.....OWO........',
        '....OOWOO.......',
        '....OWWWO.......',
        '....OOOOO.......',
        '....OoOoO.......',
        '....OOOOOTT.....',
        '.....OOO..t.....',
        '.....O.O........',
        '.....O.O........',
        '................',
        '................',
      ],
      [ // walk frame
        '....OO.OO.......',
        '....OI.IO.......',
        '....OOOOO.......',
        '....OEWEO.......',
        '.....ONO........',
        '.....OWO........',
        '....OOWOO.......',
        '....OWWWO.......',
        '....OOOOO.......',
        '....OoOoO.......',
        '....OOOOOTT.....',
        '.....OOO..t.....',
        '....O...O.......',
        '....O...O.......',
        '................',
        '................',
      ]
    ]
  },

  // === RAINBOW PARTICLE (4x4) ===
  rainbow_particle: {
    w: 4, h: 4,
    palette: {
      'W': '#ffffff',
      'C': '#ffd700', // changes per use
    },
    frames: [
      [
        '.WW.',
        'WCCW',
        'WCCW',
        '.WW.',
      ]
    ]
  },

  // === FLOWER (8x8) ===
  flower: {
    w: 8, h: 8,
    palette: {
      'P': '#ff69b4', // petals
      'p': '#ff99cc', // petal light
      'Y': '#ffd700', // center
      'G': '#228b22', // stem
      'g': '#90ee90', // leaf
    },
    frames: [
      [
        '..pPp...',
        '.PpYpP..',
        '.PYYYp..',
        '..pPp...',
        '...G....',
        '..gG....',
        '...Gg...',
        '...G....',
      ]
    ]
  },

  // === HEART (8x8) ===
  heart: {
    w: 8, h: 8,
    palette: {
      'R': '#ff6b8a',
      'r': '#ff4466',
      'P': '#ffaacc',
    },
    frames: [
      [
        '.PR.RP..',
        'PRRRRR..',
        'RrRRrR..',
        'RRRRRR..',
        '.RRRR...',
        '..RR....',
        '...R....',
        '........',
      ]
    ]
  }
};
