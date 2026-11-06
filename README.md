# Cube Hop

A pixel-art platformer for phones about **designing for disengagement**: helping children stop playing in a healthy way.

The game plays like a normal mobile game (D-pad + A/B buttons). The phone's sensors are not controls. They are tools for taking breaks and ending a session.

## Controls

| Phone | PC (testing) | |
|---|---|---|
| D-pad ◀ ▶ | Arrow keys / A D | Walk |
| A (or D-pad ▲) | Space / W / ↑ | Jump; press again in the air = double jump |
| B | Shift / X | Dash (one per jump, knocks out enemies) |
| Shake hard | Hold E | Simulates an "angry shake" |
| Put phone face down | Hold F | Simulates the phone lying face down |

Levels get harder and each one teaches a move: **1** jump · **2** double jump (tall walls) · **3** dash (wide gaps) · **4** everything combined, with faster enemies.

## Dev mode (testing the friction mechanics)

Open the game with `?dev` at the end of the address (e.g. https://lerolerolerola.github.io/cube-hop/?dev), or switch it on in ⚙ Grown-ups → Testing. A 🛠 button appears in the game:

- **Jump the clock:** Break, Wind down, Time's up, and each step of no-break friction. The real sequence plays, following the grown-up settings.
- **One effect by itself:** gray, negative, music, swapped controls, ignored jumps, no checkpoints, freeze, angry shake, use up the week.

Dev mode doesn't use up the weekly play time.

## How a session works

| Principle | In the game |
|---|---|
| **Autonomy** | ⏸ → "Stop playing" at any time; the child picks the break activity; "I'm done for today" on every break; "Stop here" after every level |
| **Gradual transition** | A warning before the end; colors fade to gray and the music slows down |
| **Satisfying ending** | When time runs out the child can finish the current level, then gets an ending card |
| **Continuity** | Progress is saved (resumes at the start of the level). So is today's play time: Stop playing → Continue does not reset the clock |
| **Social context** | A grown-up panel (behind a math question) sets the times, activities and effects; the ending card says "tell a grown-up what you did" |
| **No manipulation** | No rewards for staying, no streaks, no timers that pull the child back |

**Autonomy bar** (top): points earned by stopping on your own (break right away +3, after Not now +2, stop before time is up +5, on time +4, calm down +1, forced end 0). Only goes up, kept across days, split into levels. The clock shows the time left.

**Activity breaks** (every N minutes): the sensors as tools
- 📷 **Camera:** "find something RED" (point the camera, fill the square, press SNAP)
- 🚶 **Steps:** walk N steps holding the phone
- 🧘 **Motion sensor:** hold the phone still and breathe
- 🎤 **Microphone:** hum a song for 3 seconds
- 📵 **Phone nap:** put the phone face down for N seconds (default 60); picking it up restarts the time

**Frustration:** shaking the phone angrily swaps left and right. A 🧘 button appears, and calming down (holding the phone still) fixes the controls.

**Playing a long time without a break:** breaks can be put off ("Not now", back in 1 min). After N minutes without doing a break (default 10): gray + slow music → negative colors and off-key (+2 min) → controls swap (+4 min) → ignored jumps (+6 min). Doing any break clears it all.

**When time is up** (session or week): no overtime. The child gets 2 minutes to finish the level, or stops; then the ending card.

**Weekly time:** play time is counted per week. When it's used up, the game is locked until Monday (a grown-up can reset it).

Everything is saved on the device only. Nothing is sent anywhere.

**Mascot version (test):** pick 🐻 WITH PIP or NO MASCOT on the title screen (or open with `?mascot`). Activities become things you do with Pip (take Pip for a walk, put Pip to bed…). Pip gets hungry while you play; break activities and stopping on time feed it, playing a long time without a break makes it hungry. It never gets hungry while the game is closed. Code in `mascot.js`, the base game is unchanged when it's off.

Full documentation in Portuguese (for interviews and third parties): [DOCUMENTACAO.md](DOCUMENTACAO.md)

Play: https://lerolerolerola.github.io/cube-hop/ · with mascot: https://lerolerolerola.github.io/cube-hop/?mascot
