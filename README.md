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

Levels get harder and each one teaches a move: **1** jump · **2** double jump (tall walls) · **3** dash (wide gaps) · **4** everything combined, with faster enemies.

## Dev mode (testing the friction mechanics)

Open the game with `?dev` at the end of the address (e.g. https://lerolerolerola.github.io/cube-hop/?dev), or switch it on in ⚙ Grown-ups → Testing. A 🛠 button appears in the game:

- **Jump the clock:** Break, Wind down, Time's up, +30/60/90/120/150 s of overtime. The real sequence plays, following the grown-up settings.
- **One effect by itself:** gray, negative, music, swapped controls, ignored jumps, no checkpoints, freeze, angry shake, use up the week.

Dev mode doesn't use up the weekly play time.

## How a session works

| Principle | In the game |
|---|---|
| **Autonomy** | ⏸ → "Stop playing" at any time; the child picks the break activity; "I'm done for today" on every break; "Stop here" after every level |
| **Gradual transition** | A warning before the end; colors fade to gray and the music slows down |
| **Satisfying ending** | When time runs out the child can finish the current level, then gets an ending card |
| **Continuity** | Progress is saved (resumes at the start of the level) |
| **Social context** | A grown-up panel (behind a math question) sets the times, activities and effects; the ending card says "tell a grown-up what you did" |
| **No manipulation** | No rewards for staying, no streaks, no timers that pull the child back |

**Activity breaks** (every N minutes, shown as marks on the time bar): the sensors as tools
- 📷 **Camera:** "find something RED" (point the camera, fill the square, press SNAP)
- 🚶 **Steps:** walk N steps holding the phone
- 🧘 **Motion sensor:** hold the phone still and breathe
- 🎤 **Microphone:** hum a song for 3 seconds

**Frustration:** shaking the phone angrily swaps left and right. A 🧘 button appears, and calming down (holding the phone still) fixes the controls.

**If the child keeps playing after time is up** (each one can be turned off by a grown-up):
time's-up pop-up → negative colors (30 s) → controls swap (1 min) → game ignores some jumps (1.5 min) → screen freezes (2 min) → final stop pop-up (2.5 min). Music goes off-key, and falling restarts the whole level (no checkpoints).

**Weekly time:** play time is counted per week. When it's used up, the game is locked until Monday (a grown-up can reset it).

Everything is saved on the device only. Nothing is sent anywhere.

Play: https://lerolerolerola.github.io/cube-hop/
