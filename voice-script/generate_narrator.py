import os
import time
from pathlib import Path
from elevenlabs.client import ElevenLabs

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
API_KEY     = os.environ.get("ELEVENLABS_API_KEY", "sk_0ea4b9a0d2e47c44333e6099241e1a09fbc77e51249170e7")
VOICE_ID    = "pDWh86SmPFCHZgOMElCB"  # Narrator
MODEL_ID    = "eleven_v3"
OUT_FORMAT  = "mp3_44100_128"
OUTPUT_DIR  = Path(r"C:\Users\Eddie Thompson\moe\princess-sparkle-v2\voice-script\audio\voice")
DELAY_SEC   = 0.5  # pause between requests

# ─────────────────────────────────────────────
# NARRATOR LINES
# ─────────────────────────────────────────────
LINES = [

    # TITLE SCREEN
    ("narrator_title_01",          "[warm] [awe] Welcome to Princess Sparkle!"),
    ("narrator_title_02",          "[warm] A world full of kindness... is waiting for you."),
    ("narrator_title_03",          "[gentle] [encouraging] Tap the sparkle to begin your adventure."),
    ("narrator_title_return_01",   "[warm] [delighted] Welcome back, Princess!"),
    ("narrator_title_return_02",   "[soft] Your friends have been waiting for you."),
    ("narrator_title_return_03",   "[gentle] Tap the sparkle to keep playing."),

    # COMPANION SELECTION
    ("narrator_companion_intro_01",          "[warm] [storytelling tone] Every princess needs a special friend."),
    ("narrator_companion_intro_02",          "[gentle excitement] Five friends are here to meet you."),
    ("narrator_companion_intro_03",          "[encouraging] Tap on each one to say hello."),
    ("narrator_companion_intro_04",          "[warm] Then choose the friend you like best."),
    ("narrator_companion_confirm_shimmer",   "[delighted] [warm] You chose Shimmer! What a wonderful friend."),
    ("narrator_companion_confirm_ember",     "[delighted] [warm] You chose Ember! What a wonderful friend."),
    ("narrator_companion_confirm_petal",     "[delighted] [warm] You chose Petal! What a wonderful friend."),
    ("narrator_companion_confirm_breeze",    "[delighted] [warm] You chose Breeze! What a wonderful friend."),
    ("narrator_companion_confirm_pip",       "[delighted] [warm] You chose Pip! What a wonderful friend."),
    ("narrator_companion_confirm_02",        "[hopeful] [soft] Together, you will help so many people."),

    # ARRIVING IN SPARKLE VILLAGE
    ("narrator_village_arrive_01",   "[awe] [warm] This is Sparkle Village."),
    ("narrator_village_arrive_02",   "[cozy] A sweet little town where everyone helps each other."),
    ("narrator_village_arrive_03",   "[gentle sadness] But the Rainbow Bridge... is broken."),
    ("narrator_village_arrive_04",   "[hopeful] [whispers] When people are happy, the bridge gets a little brighter."),
    ("narrator_village_arrive_05",   "[encouraging] [warm] Can you help make everyone happy?"),
    ("narrator_village_tutorial_01", "[gentle] Tap anywhere to walk there."),
    ("narrator_village_tutorial_02", "[warm] [curious] See that little sparkle? Tap on it to say hello."),
    ("narrator_village_tutorial_03", "[soft] When someone needs help, you will see a little star."),

    # GRANDMA ROSE QUEST
    ("narrator_grandma_approach_01", "[gentle] [warm] Look! Grandma Rose needs some help."),
    ("narrator_quest_accept_01",     "[encouraging] Tap the cookies to pick them up!"),
    ("narrator_quest_accept_02",     "[warm] Now let us bring them to Lily's house."),
    ("narrator_lily_arrive_01",      "[excited] [gentle] Here is Lily's house. Tap on the door!"),
    ("narrator_return_grandma_01",   "[proud] [warm] Lily is so happy! Let us go tell Grandma Rose."),
    ("narrator_quest_complete_01",   "[proud] [delighted] You did it! You helped Grandma Rose share her cookies!"),
    ("narrator_quest_complete_02",   "[warm] [gentle excitement] You earned three hearts!"),
    ("narrator_quest_complete_03",   "[awe] Look! A piece of the Rainbow Bridge is glowing!"),

    # LITTLE FINN QUEST
    ("narrator_finn_approach_01",  "[gentle] [soft] This is Little Finn. He is sitting by the playground."),
    ("narrator_finn_try_01",       "[soft] [proud] Finn is walking to the swing."),
    ("narrator_finn_try_02",       "[gentle] He sits down. [warm] He is being very brave."),
    ("narrator_finn_complete_01",  "[proud] [warm] You helped Finn be brave! That was so kind."),
    ("narrator_finn_complete_02",  "[gentle] [wise] Sometimes being a good friend means saying... you can do it."),
    ("narrator_finn_complete_03",  "[warm] [gentle excitement] You earned three hearts!"),
    ("narrator_finn_complete_04",  "[awe] [hopeful] The Rainbow Bridge is getting brighter!"),

    # RAINBOW BRIDGE
    ("narrator_bridge_01",          "[awe] Look at the Rainbow Bridge!"),
    ("narrator_bridge_02",          "[warm] Every time you help someone, it gets a little brighter."),
    ("narrator_bridge_piece_01",    "[delighted] [awe] A red piece is glowing!"),
    ("narrator_bridge_piece_02",    "[delighted] [awe] An orange piece is glowing!"),
    ("narrator_bridge_piece_03",    "[delighted] [awe] A yellow piece is glowing!"),
    ("narrator_bridge_piece_04",    "[delighted] [awe] A green piece is glowing!"),
    ("narrator_bridge_piece_05",    "[excited] [awe] A blue piece is glowing!"),
    ("narrator_bridge_piece_06",    "[awe] [breathless] A purple piece is glowing!"),
    ("narrator_bridge_complete_01", "[joyful] [proud] The Rainbow Bridge is finished! You did it, Princess!"),
    ("narrator_bridge_complete_02", "[warm] [meaningful] All that kindness brought the colors back."),

    # SUNSET / WIND-DOWN
    ("narrator_winddown_01",         "[warm] [reflective] What a wonderful day you had, Princess."),
    ("narrator_winddown_02",         "[proud] [soft] You helped your friends and made them smile."),
    ("narrator_winddown_03",         "[cozy] [reassuring] Your friends will be right here when you come back."),
    ("narrator_winddown_04",         "[warm] [whispers] Goodnight, Princess. Sweet dreams."),
    ("narrator_winddown_hearts_01",  "[gentle] [warm] Today you found one heart!"),
    ("narrator_winddown_hearts_02",  "[gentle] [warm] Today you found two hearts!"),
    ("narrator_winddown_hearts_03",  "[warm] Today you found three hearts!"),
    ("narrator_winddown_hearts_04",  "[warm] Today you found four hearts!"),
    ("narrator_winddown_hearts_05",  "[warm] [proud] Today you found five hearts!"),
    ("narrator_winddown_hearts_06",  "[warm] [proud] Today you found six hearts!"),
    ("narrator_winddown_hearts_07",  "[proud] Today you found seven hearts!"),
    ("narrator_winddown_hearts_08",  "[proud] Today you found eight hearts!"),
    ("narrator_winddown_hearts_09",  "[proud] [delighted] Today you found nine hearts!"),
    ("narrator_winddown_hearts_10",  "[proud] [delighted] Today you found ten hearts!"),

    # WHISPER FOREST
    ("narrator_forest_arrive_01",  "[awe] [excited] You found a new place! This is the Whisper Forest."),
    ("narrator_forest_arrive_02",  "[hushed] [awe] The trees are very tall. And very gentle."),
    ("narrator_forest_arrive_03",  "[gentle sadness] But the forest... is losing its colors."),
    ("narrator_forest_arrive_04",  "[hopeful] [warm] It needs kindness to bring the colors back."),
    ("narrator_owl_approach_01",   "[hushed] [awe] Look... up in that tree. A wise old owl."),
    ("narrator_forest_accept_01",  "[encouraging] [warm] The forest needs your kindness. Let us explore!"),

    # KINDNESS ENCOUNTERS — SPARKLE VILLAGE
    ("narrator_kindness_butterfly_01", "[soft] [gentle concern] Oh look! A little butterfly is lost."),
    ("narrator_kindness_butterfly_02", "[sympathetic] She cannot find her way home."),
    ("narrator_kindness_butterfly_03", "[encouraging] Tap on her to help her."),
    ("narrator_kindness_butterfly_04", "[warm] [proud] You showed her the way! She is so happy now!"),
    ("narrator_kindness_flower_01",    "[soft] [gentle concern] Oh! A little flower looks sad."),
    ("narrator_kindness_flower_02",    "[gentle] She is thirsty and needs some water."),
    ("narrator_kindness_flower_03",    "[encouraging] Tap on the water to help the flower."),
    ("narrator_kindness_flower_04",    "[delighted] [warm] The flower is smiling! You helped her grow!"),
    ("narrator_kindness_apples_01",    "[gentle concern] Oh no! Someone dropped their apples."),
    ("narrator_kindness_apples_02",    "[soft] The apples rolled all over the ground."),
    ("narrator_kindness_apples_03",    "[encouraging] Tap on each apple to pick it up."),
    ("narrator_kindness_apples_04",    "[proud] [warm] You picked them all up! That was so helpful!"),
    ("narrator_kindness_heart_01",     "[warm] [gentle excitement] You earned a heart for being kind!"),

    # KINDNESS ENCOUNTERS — WHISPER FOREST
    ("narrator_kindness_squirrel_01", "[soft] [gentle] A little squirrel lost his acorn."),
    ("narrator_kindness_squirrel_02", "[encouraging] Can you help him find it?"),
    ("narrator_kindness_squirrel_03", "[delighted] [warm] You found it! The squirrel is so happy!"),
    ("narrator_kindness_firefly_01",  "[tender] [soft] A little firefly forgot how to glow."),
    ("narrator_kindness_firefly_02",  "[gentle] [encouraging] Tap on her and give her a kind word."),
    ("narrator_kindness_firefly_03",  "[awe] [warm] She is glowing again! Your kindness lit her up!"),
    ("narrator_kindness_vines_01",    "[gentle concern] Oh! A little bird is tangled in some vines."),
    ("narrator_kindness_vines_02",    "[soft] [careful] Tap gently to help her get free."),
    ("narrator_kindness_vines_03",    "[joyful] [warm] She is free! She is singing a thank-you song!"),

    # SYSTEM / UI
    ("narrator_save_01",          "[reassuring] [warm] Your adventure is saved!"),
    ("narrator_hearts_01",        "[warm] [delighted] You found a heart!"),
    ("narrator_hearts_plural_01", "[proud] [delighted] You found three hearts!"),
    ("narrator_level_up_01",      "[awe] [warm] Your friendship garden is growing!"),
    ("narrator_new_area_01",      "[excited] [awe] You found a new place! Let us see what is here."),
    ("narrator_journal_01",       "[proud] [warm] A new page in your Friendship Journal!"),
    ("narrator_level_up_shimmer", "[warm] [proud] You and Shimmer are getting stronger together!"),
    ("narrator_level_up_ember",   "[warm] [proud] You and Ember are getting stronger together!"),
    ("narrator_level_up_petal",   "[warm] [proud] You and Petal are getting stronger together!"),
    ("narrator_level_up_breeze",  "[warm] [proud] You and Breeze are getting stronger together!"),
    ("narrator_level_up_pip",     "[warm] [proud] You and Pip are getting stronger together!"),

    # COMPANION EVOLUTION
    ("narrator_evolve_01",  "[awe] [warm] Your friend is growing... because of all your kindness!"),
    ("narrator_evolve2_01", "[warm] [heartfelt] All your love and kindness... made your friend beautiful."),
]

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    if API_KEY == "YOUR_API_KEY":
        print("Set ELEVENLABS_API_KEY env variable before running.")
        raise SystemExit(1)

    client = ElevenLabs(api_key=API_KEY)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    total   = len(LINES)
    success = 0
    skipped = 0
    failed  = 0

    print(f"\n  Princess Sparkle -- Narrator Voice Generation")
    print(f"  Voice ID : {VOICE_ID}")
    print(f"  Model    : {MODEL_ID}")
    print(f"  Lines    : {total}")
    print(f"  Output   : {OUTPUT_DIR}\n")

    for i, (filename, text) in enumerate(LINES, start=1):
        out_path = OUTPUT_DIR / f"{filename}.mp3"
        label    = f"[{i:03}/{total}]"
        preview  = text[:55] + ("..." if len(text) > 55 else "")

        if out_path.exists():
            print(f"{label}  SKIP    {filename}.mp3")
            skipped += 1
            continue

        print(f"{label}  GEN     {filename}.mp3  \"{preview}\"", end="", flush=True)

        try:
            audio = client.text_to_speech.convert(
                text=text,
                voice_id=VOICE_ID,
                model_id=MODEL_ID,
                output_format=OUT_FORMAT,
            )

            # audio is a generator -- collect and write
            with open(out_path, "wb") as f:
                for chunk in audio:
                    f.write(chunk)

            print("  OK")
            success += 1

        except Exception as e:
            print(f"  FAILED")
            print(f"         {e}")
            failed += 1

        if i < total:
            time.sleep(DELAY_SEC)

    print(f"\n  Done.  Success: {success}  Skipped: {skipped}  Failed: {failed}")
    print(f"  Files saved to: {OUTPUT_DIR}\n")


if __name__ == "__main__":
    main()