/**
 * familyValues.js — Value taxonomy for Princess Sparkle V2
 *
 * Six core family values: sharing, kindness, helping, empathy, patience, cooperation.
 * Each value has a description, color, icon concept, and example quest themes.
 * Used by QuestSystem to tag quests and by the Friendship Journal.
 */

/** Family value definitions */
const FAMILY_VALUES = {
  sharing: {
    id: 'sharing',
    name: 'Sharing',
    description: 'Giving what we have to make others happy',
    color: '#ff99cc',         // Warm pink
    iconShape: 'heart_open',  // Open heart with something inside
    questExamples: [
      'Bring flowers to a neighbor',
      'Share cookies with a friend',
      'Give berries to a hungry bird',
      'Deliver a gift from one NPC to another'
    ],
    companionLines: {
      shimmer: 'Sharing makes the world more beautiful.',
      ember: 'Ooh ooh, sharing is like giving a warm hug!',
      petal: 'When we share, everyone feels a little happier...',
      breeze: 'Sharing is like sending wishes on the wind.',
      pip: 'Sharing is the best! Let us share everything!'
    },
    // Rainbow bridge color this value contributes to
    bridgeColor: '#ff4444'  // Red band
  },

  kindness: {
    id: 'kindness',
    name: 'Kindness',
    description: 'Being gentle and caring to everyone we meet',
    color: '#ffaa66',         // Warm orange
    iconShape: 'star_soft',   // Soft glowing star
    questExamples: [
      'Cheer up someone who is sad',
      'Help someone who fell down',
      'Say something nice to someone lonely',
      'Comfort a scared animal'
    ],
    companionLines: {
      shimmer: 'Kindness is the most powerful magic there is.',
      ember: 'Being kind makes my heart feel all warm and sparkly!',
      petal: 'Even a tiny kindness can make a big difference...',
      breeze: 'Kindness floats through the air like a gentle song.',
      pip: 'Hey, being kind is what heroes do!'
    },
    bridgeColor: '#ffaa00'  // Orange band
  },

  helping: {
    id: 'helping',
    name: 'Helping',
    description: 'Using our hands and hearts to make things easier for others',
    color: '#ffdd66',         // Warm yellow
    iconShape: 'hands',       // Two small hands together
    questExamples: [
      'Carry something for someone',
      'Water the community garden',
      'Help fix something broken',
      'Guide a lost animal home'
    ],
    companionLines: {
      shimmer: 'Helping others is what makes a true princess.',
      ember: 'I want to help too! Let me help! Please!',
      petal: 'We can help, even if we are small...',
      breeze: 'Every helping hand paints a new color in the sky.',
      pip: 'Team work! We can do anything together!'
    },
    bridgeColor: '#ffdd00'  // Yellow band
  },

  empathy: {
    id: 'empathy',
    name: 'Empathy',
    description: 'Understanding how others feel and caring about their feelings',
    color: '#88ccff',         // Gentle blue
    iconShape: 'two_hearts',  // Two hearts connected
    questExamples: [
      'Notice someone who looks sad and ask what is wrong',
      'Understand why someone is upset',
      'Help someone feel less alone',
      'Listen to someone who needs to talk'
    ],
    companionLines: {
      shimmer: 'When we understand how others feel, we can help them better.',
      ember: 'Oh... that person looks sad. Should we go see if they are okay?',
      petal: 'I know what it feels like to be shy... let us help them.',
      breeze: 'Feelings are like clouds — sometimes they need the sun to come out.',
      pip: 'Everyone feels things! And that is okay!'
    },
    bridgeColor: '#44cc44'  // Green band
  },

  patience: {
    id: 'patience',
    name: 'Patience',
    description: 'Waiting calmly and knowing good things take time',
    color: '#aaddff',         // Soft sky blue
    iconShape: 'flower_bud',  // Flower bud not yet open
    questExamples: [
      'Wait for a flower to grow',
      'Let a friend go first',
      'Wait quietly for a shy animal to come closer',
      'Help someone practice something difficult'
    ],
    companionLines: {
      shimmer: 'Good things are worth waiting for, Princess.',
      ember: 'Waiting is hard but... I can do it! Maybe. Probably!',
      petal: 'Flowers do not bloom in a day... and that is okay.',
      breeze: 'Patience is like the wind — it arrives in its own time.',
      pip: 'Hmm, waiting... waiting... oh look a butterfly! Oh right, waiting!'
    },
    bridgeColor: '#4488ff'  // Blue band
  },

  cooperation: {
    id: 'cooperation',
    name: 'Cooperation',
    description: 'Working together with friends to do something wonderful',
    color: '#cc99ff',         // Gentle purple
    iconShape: 'puzzle',      // Two puzzle pieces fitting together
    questExamples: [
      'Work with companion to solve a puzzle',
      'Help two NPCs work together',
      'Coordinate with animal friends',
      'Build something with a friend'
    ],
    companionLines: {
      shimmer: 'Together, we can do anything.',
      ember: 'You and me, we are the best team ever!',
      petal: 'I am glad we are doing this together...',
      breeze: 'Two wings are better than one, they say.',
      pip: 'Team Sparkle, go go go!'
    },
    bridgeColor: '#8844ff'  // Purple band
  }
};

/**
 * Get a family value definition by ID.
 * @param {string} id
 * @returns {object|null}
 */
export function getValue(id) {
  return FAMILY_VALUES[id] || null;
}

/**
 * Get all value IDs.
 * @returns {string[]}
 */
export function getValueIds() {
  return Object.keys(FAMILY_VALUES);
}

/**
 * Get all value definitions.
 * @returns {object[]}
 */
export function getAllValues() {
  return Object.values(FAMILY_VALUES);
}

/**
 * Get the rainbow bridge colors in order.
 * @returns {Array<{value: string, color: string}>}
 */
export function getBridgeColors() {
  return [
    { value: 'sharing', color: FAMILY_VALUES.sharing.bridgeColor },
    { value: 'kindness', color: FAMILY_VALUES.kindness.bridgeColor },
    { value: 'helping', color: FAMILY_VALUES.helping.bridgeColor },
    { value: 'empathy', color: FAMILY_VALUES.empathy.bridgeColor },
    { value: 'patience', color: FAMILY_VALUES.patience.bridgeColor },
    { value: 'cooperation', color: FAMILY_VALUES.cooperation.bridgeColor }
  ];
}

export default FAMILY_VALUES;
