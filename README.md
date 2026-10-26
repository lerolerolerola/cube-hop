# Cube Hop

A pixel-art platformer for phones that you control with your body:

| Phone | PC (for testing) | What it does |
|---|---|---|
| Tilt left/right | Arrow keys / A D | Walk |
| Tap the screen | Space / W / ↑ | Jump |
| Shout / clap | Shift | Super jump |
| Shake the phone | Hold E | Ghost blocks turn solid (faster shaking = fills faster) |

Three levels: **Village** (walk + jump), **Sunset Towers** (shout), **Night Ruins** (shake).

## Test on your computer

Sensors and the microphone only work from `localhost` or `https`, so don't just double-click `index.html`. Run a tiny server in this folder instead:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000

## Put it on GitHub (and play it on your phone)

1. Create a new repository on github.com (for example `cube-hop`), public.
2. Upload these files: `index.html`, `style.css`, `levels.js`, `game.js`, `README.md`
   (on the repo page: **Add file → Upload files**, drag them in, **Commit**).
3. Go to **Settings → Pages**, under "Branch" pick `main` and `/ (root)`, then **Save**.
4. After about a minute the game is live at `https://YOUR-USERNAME.github.io/cube-hop/`.
   Open that on the phone, turn it sideways, press PLAY and allow motion + microphone.

## Make your own levels

Edit `levels.js`. Each level is 11 rows of text:

```
#  ground     B  brick      G  ghost block (solid while shaking)
o  cube       ^  spikes     E  enemy
P  start      D  door (exit)
```

## Tuning for real phones

Top of `game.js`:

- `TILT_DEADZONE` / `TILT_FULL`: how much tilt before walking / for full speed
- `MIC_LOUD`: how loud a shout must be (watch the 🎤 bar: full = super jump)
- `SHAKE_MIN`: how hard you must shake before it counts
