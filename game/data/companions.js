/**
 * companions.js — Static definitions for all 5 companions
 *
 * Each companion has: name, creature type, trail effect description,
 * personality, voice type, sprite name, and particle config keys.
 */

const COMPANIONS = {
  shimmer: {
    id: 'shimmer',
    name: 'Shimmer',
    creature: 'Unicorn',
    spriteName: 'unicorn',
    personality: 'Gentle, wise, encouraging',
    voiceType: 'Warm, melodic, like a kind older sister',
    trailDescription: 'Rainbow sparkles',
    trailColors: ['#ff99ee', '#ffaaff', '#cc99ff'],
    trailShape: 'star',
    glowColor: '#ffaaee',
    sillyIdle: 'Horn accidentally shoots tiny rainbow that bonks a bird',
    sfx: 'trailShimmer',
    // Evolution descriptions
    evolutions: [
      { level: 1, form: 'Baby', description: 'Small unicorn with tiny horn' },
      { level: 4, form: 'Young', description: 'Taller unicorn, flowing mane begins' },
      { level: 7, form: 'Full', description: 'Majestic unicorn with rainbow mane and tail' }
    ],
    // Voice lines
    voiceLines: {
      greeting: 'companion_shimmer_greeting',
      intro: 'companion_shimmer_intro',
      questHint: 'companion_shimmer_hint',
      questComplete: 'companion_shimmer_complete',
      idle: 'companion_shimmer_idle',
      windDown: 'companion_shimmer_winddown',
      silly: 'companion_shimmer_silly'
    }
  },

  ember: {
    id: 'ember',
    name: 'Ember',
    creature: 'Baby Dragon',
    spriteName: 'dragon',
    personality: 'Playful, curious, brave',
    voiceType: 'Excited whisper, giggly',
    trailDescription: 'Warm golden sparks',
    trailColors: ['#ff6633', '#ffaa00', '#ff99cc'],
    trailShape: 'circle',
    glowColor: '#ffaa44',
    sillyIdle: 'Tries to breathe fire, only smoke ring comes out',
    sfx: 'trailShimmer',
    evolutions: [
      { level: 1, form: 'Baby', description: 'Tiny round dragon with stubby wings' },
      { level: 4, form: 'Young', description: 'Bigger dragon, wings can flap' },
      { level: 7, form: 'Full', description: 'Proud dragon with golden belly and small flame' }
    ],
    voiceLines: {
      greeting: 'companion_ember_greeting',
      intro: 'companion_ember_intro',
      questHint: 'companion_ember_hint',
      questComplete: 'companion_ember_complete',
      idle: 'companion_ember_idle',
      windDown: 'companion_ember_winddown',
      silly: 'companion_ember_silly'
    }
  },

  petal: {
    id: 'petal',
    name: 'Petal',
    creature: 'Bunny',
    spriteName: 'bunny',
    personality: 'Shy, sweet, caring',
    voiceType: 'Soft, quiet, tender',
    trailDescription: 'Flowers blooming',
    trailColors: ['#99ff99', '#ffccff', '#ff99cc'],
    trailShape: 'flower',
    glowColor: '#aaffaa',
    sillyIdle: 'Ears droop over eyes, bumps into princess gently',
    sfx: 'trailShimmer',
    evolutions: [
      { level: 1, form: 'Baby', description: 'Tiny bunny with big floppy ears' },
      { level: 4, form: 'Young', description: 'Bunny with flower behind ear' },
      { level: 7, form: 'Full', description: 'Elegant bunny with flower crown and leaf cape' }
    ],
    voiceLines: {
      greeting: 'companion_petal_greeting',
      intro: 'companion_petal_intro',
      questHint: 'companion_petal_hint',
      questComplete: 'companion_petal_complete',
      idle: 'companion_petal_idle',
      windDown: 'companion_petal_winddown',
      silly: 'companion_petal_silly'
    }
  },

  breeze: {
    id: 'breeze',
    name: 'Breeze',
    creature: 'Butterfly',
    spriteName: 'butterfly',
    personality: 'Dreamy, poetic, free-spirited',
    voiceType: 'Airy, whimsical, sing-song',
    trailDescription: 'Glowing wish-dust',
    trailColors: ['#aaddff', '#ffffff', '#ccaaff'],
    trailShape: 'circle',
    glowColor: '#aaddff',
    sillyIdle: 'Flies into spiderweb, shakes it off with glitter',
    sfx: 'trailShimmer',
    evolutions: [
      { level: 1, form: 'Baby', description: 'Small butterfly with simple wings' },
      { level: 4, form: 'Young', description: 'Butterfly with patterned wings' },
      { level: 7, form: 'Full', description: 'Magnificent butterfly with prismatic wings that shimmer' }
    ],
    voiceLines: {
      greeting: 'companion_breeze_greeting',
      intro: 'companion_breeze_intro',
      questHint: 'companion_breeze_hint',
      questComplete: 'companion_breeze_complete',
      idle: 'companion_breeze_idle',
      windDown: 'companion_breeze_winddown',
      silly: 'companion_breeze_silly'
    }
  },

  pip: {
    id: 'pip',
    name: 'Pip',
    creature: 'Fox Cub',
    spriteName: 'fox',
    personality: 'Cheerful, loyal, adventurous',
    voiceType: 'Bright, peppy, enthusiastic',
    trailDescription: 'Musical notes',
    trailColors: ['#ffdd44', '#ffaa22'],
    trailShape: 'note',
    glowColor: '#ffdd44',
    sillyIdle: 'Chases own tail, catches it, falls over',
    sfx: 'trailShimmer',
    evolutions: [
      { level: 1, form: 'Baby', description: 'Tiny fox cub with oversized ears' },
      { level: 4, form: 'Young', description: 'Fox with fluffy tail and bandana' },
      { level: 7, form: 'Full', description: 'Dashing fox with musical scarf and sparkling eyes' }
    ],
    voiceLines: {
      greeting: 'companion_pip_greeting',
      intro: 'companion_pip_intro',
      questHint: 'companion_pip_hint',
      questComplete: 'companion_pip_complete',
      idle: 'companion_pip_idle',
      windDown: 'companion_pip_winddown',
      silly: 'companion_pip_silly'
    }
  }
};

/**
 * Get companion definition by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getCompanion(id) {
  return COMPANIONS[id] || null;
}

/**
 * Get all companion IDs.
 * @returns {string[]}
 */
export function getCompanionIds() {
  return Object.keys(COMPANIONS);
}

/**
 * Get all companion definitions as an array.
 * @returns {object[]}
 */
export function getAllCompanions() {
  return Object.values(COMPANIONS);
}

export default COMPANIONS;
