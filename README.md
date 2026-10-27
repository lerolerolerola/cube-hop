# Cube Hop

A pixel-art platformer for phones, built to explore **designing for disengagement**: helping children stop playing in a healthy way.

The game plays like a normal mobile game (D-pad + A/B buttons). The phone's sensors are not controls. They are tools for taking breaks and ending a session.

## Controls

| Phone | PC (testing) | |
|---|---|---|
| D-pad ◀ ▶ | Arrow keys / A D | Walk |
| A (or D-pad ▲) | Space / W / ↑ | Jump |
| B | Shift / X | Dash (one per jump, knocks out enemies) |
| Shake hard | Hold E | Simulates an "angry shake" |

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

Everything is saved on the device only (localStorage). Nothing is sent anywhere.

## Test on your computer

The camera, microphone and motion sensors only work from `localhost` or `https`. Run this in the game folder:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. On PC, activity cards have a **Skip (PC test)** button. Tip: in ⚙ Grown-ups, set the session to 1 minute and breaks to 0.5 to see everything quickly.

## Publish changes to GitHub Pages

```bash
git add -A
git commit -m "update"
git push
```

Live at https://lerolerolerola.github.io/cube-hop/ about a minute later.

## Files

- `game.js`: the platformer (controls, physics, drawing, sound)
- `session.js`: time limits, breaks, activities, end-of-play effects, grown-up settings
- `levels.js`: the levels as text, easy to edit:
  ```
  #  ground     B  brick       o  cube        ^  spikes
  E  enemy      F  checkpoint  P  start       D  door (exit)
  ```

## Tuning for real phones

Top of `session.js`: `SHAKE_ANGRY` (how hard a frustrated shake is), `STILL` (how still counts as calm), `HUM_LEVEL` (how loud humming must be), `CALM_SECONDS`, `HUM_SECONDS`.
