/**
 * subtitles.js — English subtitle text keyed by voice line ID
 *
 * Used by SubtitleBar to display parent read-along text
 * while voice lines play.
 */

export const SUBTITLES = {
  // ---- Title scene ----------------------------------------------------------
  narrator_title_01: 'A magical adventure awaits...',
  narrator_title_02: 'Tap the sparkle to begin!',
  narrator_title_return_01: 'Welcome back, Princess!',
  narrator_title_return_02: 'Your friends missed you!',

  // ---- Companion select -----------------------------------------------------
  narrator_companion_intro_01: 'Every princess needs a special friend!',
  narrator_companion_intro_02: 'Tap the one you like best!',
  companion_shimmer_intro_01: "Hi! I'm Shimmer the Unicorn!",
  companion_shimmer_intro_02: 'I leave rainbow sparkles wherever I go!',
  companion_ember_intro_01: "Hey! I'm Ember the Baby Dragon!",
  companion_ember_intro_02: "I make warm golden sparks when I'm happy!",
  companion_petal_intro_01: "Hello... I'm Petal the Bunny...",
  companion_petal_intro_02: 'Flowers bloom wherever I hop!',
  companion_breeze_intro_01: "I'm Breeze the Butterfly!",
  companion_breeze_intro_02: 'I spread glowing wish-dust in the air!',
  companion_pip_intro_01: "Hi there! I'm Pip the Fox Cub!",
  companion_pip_intro_02: 'Musical notes follow me everywhere!',
  narrator_companion_confirm_shimmer: 'Shimmer will be your companion!',
  narrator_companion_confirm_ember: 'Ember will be your companion!',
  narrator_companion_confirm_petal: 'Petal will be your companion!',
  narrator_companion_confirm_breeze: 'Breeze will be your companion!',
  narrator_companion_confirm_pip: 'Pip will be your companion!',
  narrator_companion_confirm_02: 'What a wonderful choice!',

  // ---- Village arrival / Tutorial -------------------------------------------
  narrator_village_arrive_01: 'Welcome to Sparkle Village!',
  narrator_village_arrive_02: 'Lots of friendly people live here.',
  narrator_village_arrive_03: "Let's look around!",
  narrator_village_arrive_04: 'Walk around by tapping where you want to go.',
  narrator_village_arrive_05: 'Tap on people to talk to them!',
  narrator_tutorial_tap_01: 'Tap anywhere to walk!',
  narrator_tutorial_celebrate_01: 'You did it! Great job!',
  narrator_tutorial_quest_intro_01: 'Someone needs your help!',
  narrator_tutorial_follow_sparkles_01: 'Follow the sparkles!',
  narrator_village_tutorial_01: 'See the golden path? Follow it!',
  narrator_village_tutorial_02: 'That glowing star means someone needs your help!',
  narrator_village_tutorial_03: 'Tap on Grandma Rose to say hello!',
  companion_village_shimmer_01: "Ooh, what a pretty village! Let's explore!",
  companion_village_ember_01: "Wow, look at everything! Let's go!",
  companion_village_petal_01: "It's so peaceful here... I like it.",
  companion_village_breeze_01: 'I can feel the happiness in the breeze!',
  companion_village_pip_01: "This place looks fun! Come on, let's go!",
  companion_tutorial_shimmer_01: 'I think Grandma Rose needs our help!',
  companion_tutorial_ember_01: 'Look, Grandma is waving at us!',
  companion_tutorial_petal_01: 'Oh, someone looks like they need a friend...',
  companion_tutorial_breeze_01: 'The wind is carrying a wish from that way...',
  companion_tutorial_pip_01: 'My nose says we should go help someone!',

  // ---- Quest — Grandma ("Sharing is Caring") --------------------------------

  // — Beat 1: Approach Grandma Rose (proximity auto-trigger) —
  narrator_grandma_approach_01: "That's Grandma Rose!",

  // — Beat 2: Grandma greets and gives quest (auto-trigger after 1s) —
  npc_grandma_greeting_01: 'Hello, little princess!',
  npc_grandma_quest_01: 'I baked yummy cookies!',
  npc_grandma_quest_02: 'Can you bring them to Lily?',
  npc_grandma_quest_03: 'She lives across the village.',

  // — Beat 3: Quest accepted (auto, no confirm dialog) —
  narrator_quest_accept_01: 'Follow the sparkle hearts!',

  // — Beat 5: Walking to Lily — companion cheers —
  companion_walk_shimmer_01: "We're helping someone! I love this!",
  companion_walk_shimmer_02: "My horn is glowing extra bright!",
  companion_walk_shimmer_03: "Shimmer sparkles fly everywhere!",
  companion_walk_ember_01: "Cookies! Yay! Let's go fast!",
  companion_walk_ember_02: "My wings are flapping with joy!",
  companion_walk_ember_03: "I can keep the cookies warm!",
  companion_walk_petal_01: 'I hope Lily likes cookies...',
  companion_walk_petal_02: "Flowers are blooming on our path!",
  companion_walk_petal_03: "This is going to make Lily smile.",
  companion_walk_breeze_01: 'The wind will show us the way!',
  companion_walk_breeze_02: "My wish-dust is leading us there!",
  companion_walk_breeze_03: "Almost there! I can feel it!",
  companion_walk_pip_01: 'I can smell the cookies! Follow me!',
  companion_walk_pip_02: "My tail is wagging so much!",
  companion_walk_pip_03: "We are the best delivery team ever!",

  // — Beat 6: Arriving at Lily (proximity auto-trigger) —
  npc_lily_greeting_01: "Hi! I'm Lily!",
  npc_lily_receive_01: 'Cookies from Grandma? Yay!',
  npc_lily_thanks_01: 'Thank you so much!',
  npc_lily_thanks_02: "You're so kind!",

  // — Beat 8b: Companion reacts to Lily's happiness —
  companion_lily_shimmer_01: "Look at her smile! So sparkly!",
  companion_lily_ember_01: "Yay! She's happy! I knew it!",
  companion_lily_petal_01: "Her smile is like a warm hug...",
  companion_lily_breeze_01: "I can feel happy wishes in the air!",
  companion_lily_pip_01: "She loves them! We did great!",

  // — Beat 9: Walking back to Grandma —
  narrator_return_grandma_01: "Let's tell Grandma the good news!",

  // — Beat 9b: Companion reacts on the walk back —
  companion_return_shimmer_01: "That felt amazing! More helping!",
  companion_return_ember_01: "Grandma will be so proud of us!",
  companion_return_petal_01: "We made a new friend today...",
  companion_return_breeze_01: "The breeze is carrying our good deed!",
  companion_return_pip_01: "Let's run back and tell Grandma!",

  // — Beat 10: Grandma thanks (proximity auto-trigger) —
  npc_grandma_thanks_01: 'You did it! Thank you!',
  npc_grandma_thanks_02: 'Sharing makes everyone happy!',
  npc_grandma_thanks_03: 'You earned a golden heart!',

  // — Beat 11: Quest complete — celebration —
  narrator_quest_complete_01: 'The Starlight Path glows brighter!',

  // — Quest 1 companion celebration lines —
  companion_complete_shimmer_01: "We did it! Sparkles for everyone!",
  companion_complete_ember_01: "Hooray! Golden sparks of joy!",
  companion_complete_petal_01: "That was so lovely... I'm so happy.",
  companion_complete_breeze_01: "The wind is cheering for us!",
  companion_complete_pip_01: "Best adventure yet! Let's do more!",

  // ---- Quest — Finn ---------------------------------------------------------
  narrator_finn_approach_01: 'That\'s Little Finn. He looks worried.',
  npc_finn_greeting_01: "H-hi... I'm Finn.",
  npc_finn_scared_01: 'I want to try the swing, but...',
  npc_finn_scared_02: "I'm a little bit scared.",
  narrator_finn_try_01: "Let's encourage Finn! He can do it!",
  narrator_finn_try_02: 'Sometimes being brave means trying something new.',
  npc_finn_success_01: "I... I did it! I'm swinging!",
  npc_finn_success_02: 'Thank you for believing in me!',
  narrator_finn_complete_01: 'Finn was so brave!',
  narrator_finn_complete_02: 'You helped him feel courageous.',
  narrator_finn_complete_03: 'Kindness makes everyone braver.',
  narrator_finn_complete_04: 'The Starlight Path shines even brighter!',

  // ---- Starlight Path -------------------------------------------------------
  narrator_bridge_01: 'Look! The Starlight Path is forming!',
  narrator_bridge_02: 'Every kind thing you do adds a color!',
  narrator_bridge_piece_01: 'A red piece appears \u2014 for sharing!',
  narrator_bridge_piece_02: 'A orange piece appears \u2014 for kindness!',
  narrator_bridge_piece_03: 'A yellow piece appears \u2014 for helping!',
  narrator_bridge_piece_04: 'A green piece appears \u2014 for friendship!',
  narrator_bridge_piece_05: 'A blue piece appears \u2014 for courage!',
  narrator_bridge_piece_06: 'A purple piece appears \u2014 for love!',

  // ---- Wind Down ------------------------------------------------------------
  narrator_sunset_01: 'The sun is setting on Sparkle Village...',
  narrator_winddown_recap: 'You did so many wonderful things today!',
  narrator_winddown_hearts: 'Look at all the hearts you collected!',
  narrator_winddown_goodbye: 'Time to rest now. Sweet dreams, Princess!',
  companion_sunset_shimmer_01: 'What a beautiful sunset, friend.',
  companion_sunset_ember_01: 'Today was the best day ever!',
  companion_sunset_petal_01: "I'm so happy we played together.",
  companion_sunset_breeze_01: 'The evening breeze says goodnight...',
  companion_sunset_pip_01: 'We had so much fun today!',
  companion_goodnight_shimmer_01: "Goodnight! I'll be right here when you come back.",
  companion_goodnight_ember_01: "Sweet dreams! Can't wait for tomorrow!",
  companion_goodnight_petal_01: "Sleep tight... I'll miss you...",
  companion_goodnight_breeze_01: 'May the dreamwind carry you softly...',
  companion_goodnight_pip_01: 'See you next time! Bye bye!',

  // ---- Tutorial / extra lines -----------------------------------------------
  narrator_village_quest_hint_01: 'See that sparkle? That means someone needs help!',
  narrator_tutorial_walk_01: 'Tap where you want to walk!',
  narrator_tutorial_help_01: "Let's go help someone!",
  voice_grandma_sharing_01: 'Would you like to help me deliver cookies?',
  voice_grandma_sharing_02: 'Lily lives just down the path!',
  voice_companion_sharing_01: "Let's bring the cookies to Lily!",
  narrator_companion_story_01: 'Every princess needs a special friend...',
  narrator_companion_bonding_shimmer: 'You and Shimmer are going to have an amazing adventure!',
  narrator_companion_bonding_ember: 'You and Ember are going to have an amazing adventure!',
  narrator_companion_bonding_petal: 'You and Petal are going to have an amazing adventure!',
  narrator_companion_bonding_breeze: 'You and Breeze are going to have an amazing adventure!',
  narrator_companion_bonding_pip: 'You and Pip are going to have an amazing adventure!',

  // ---- Whisper Forest -------------------------------------------------------
  narrator_forest_arrive_01: 'Welcome to the Whisper Forest...',
  narrator_forest_arrive_02: 'The trees are whispering to each other.',
  narrator_forest_arrive_03: 'Something magical is happening here!',
  npc_owl_intro_01: 'Whooo goes there?',
  npc_owl_intro_02: 'A princess! How wonderful!',
  npc_owl_intro_03: 'The forest needs your kindness, dear one.',
};
