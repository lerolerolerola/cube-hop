// Cube Hop: a tilt / shout / shake platformer. Plain canvas, no libraries.

// ---- calibration knobs: tune these on real phones ----
const TILT_DEADZONE = 4;   // degrees of tilt ignored around "neutral"
const TILT_FULL = 18;      // degrees of tilt for full walking speed
const MIC_LOUD = 0.2;      // mic volume (0..1) that counts as a shout
const SHAKE_MIN = 8;       // m/s² of motion before it counts as shaking

// ---- physics (pixels per frame at 60fps) ----
const T = 16, H = 176, GRAV = 0.3, JUMP = 5.6, SUPER = 8.5, SPEED = 1.6;
const LIGHT = 'rgba(255,255,255,.3)', DARK = 'rgba(0,0,0,.18)', INK = '#1b1f4b';

const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
let W = 320;
function resize() {
  W = Math.ceil(H * cv.clientWidth / cv.clientHeight) || 320;
  cv.width = W; cv.height = H;
}
addEventListener('resize', resize); resize();

// ---------- input: keyboard + touch ----------
const keys = {};
let jumpBuf = 0;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { jumpBuf = 8; e.preventDefault(); }
});
addEventListener('keyup', e => keys[e.code] = false);
cv.addEventListener('pointerdown', () => jumpBuf = 8);

// ---------- sensors: tilt, shake, microphone ----------
let tilt = 0, tiltZero = null, motion = 0, shake = 0, shakeNow = 0, vol = 0, analyser, wave;

addEventListener('deviceorientation', e => {
  // left/right tilt is a different axis depending on how the phone is rotated
  const a = screen.orientation ? screen.orientation.angle : (window.orientation || 0);
  const v = a === 90 ? e.beta : a === 270 || a === -90 ? -e.beta : a === 180 ? -e.gamma : e.gamma;
  if (v == null) return;
  if (tiltZero == null) tiltZero = v; // whatever angle you hold it at when you press PLAY = "standing still"
  tilt = v - tiltZero;
});

addEventListener('devicemotion', e => {
  const a = e.acceleration, g = e.accelerationIncludingGravity;
  motion = a && a.x != null ? Math.hypot(a.x, a.y, a.z)
    : g && g.x != null ? Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81) : 0;
});

function readMic() {
  if (!analyser) return;
  analyser.getFloatTimeDomainData(wave);
  let s = 0;
  for (const v of wave) s += v * v;
  vol = Math.max(Math.sqrt(s / wave.length), vol * 0.9);
}

$('start').onclick = () => {
  // iPhone only gives sensors/mic if asked inside the tap, so everything starts here
  window.DeviceOrientationEvent?.requestPermission?.().catch(() => {});
  window.DeviceMotionEvent?.requestPermission?.().catch(() => {});
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  navigator.mediaDevices?.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    .then(s => {
      analyser = ac.createAnalyser(); analyser.fftSize = 512; wave = new Float32Array(512);
      ac.createMediaStreamSource(s).connect(analyser); ac.resume();
    })
    .catch(() => {}); // no mic: Shift still super-jumps
  if (matchMedia('(pointer: coarse)').matches)
    document.documentElement.requestFullscreen?.().then(() => screen.orientation.lock?.('landscape')).catch(() => {});
  navigator.wakeLock?.request('screen').catch(() => {});
  tiltZero = null;
  $('title').classList.add('hidden');
  restart();
};
$('again').onclick = () => { $('win').classList.add('hidden'); restart(); };

// ---------- game state ----------
let lvl = 0, map, player, enemies, parts = [], total = 0, startTotal = 0, energy = 0, camX = 0, t = 0, dead = 0, state = 'title';

function restart() { total = 0; state = 'play'; load(0); }

function load(i) {
  lvl = i;
  const rows = LEVELS[i].map, w = Math.max(...rows.map(r => r.length));
  map = rows.map(r => r.padEnd(w).split(''));
  enemies = []; parts = []; energy = 0; dead = 0; startTotal = total;
  map.forEach((row, y) => row.forEach((c, x) => {
    if (c === 'P') player = { x: x * T + 3, y: y * T + 2, w: 10, h: 14, vx: 0, vy: 0, face: 1, coyote: 0 };
    if (c === 'E') enemies.push({ x: x * T + 2, y: y * T + 4, w: 12, h: 12, vx: 0, vy: 0, dir: -1 });
    if (c === 'P' || c === 'E') row[x] = ' ';
  }));
  $('level').textContent = LEVELS[i].name;
  const h = $('hint');
  h.textContent = LEVELS[i].hint;
  h.classList.remove('show'); void h.offsetWidth; if (state === 'play') h.classList.add('show');
}

function tile(x, y) {
  if (x < 0 || x >= map[0].length) return '#'; // invisible walls at the level edges
  return map[y]?.[x] ?? ' ';
}
const solid = c => c === '#' || c === 'B' || (c === 'G' && energy > 0);
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function cells(o) {
  const r = [];
  for (let y = Math.floor(o.y / T); y <= Math.floor((o.y + o.h) / T); y++)
    for (let x = Math.floor(o.x / T); x <= Math.floor((o.x + o.w) / T); x++) r.push([x, y]);
  return r;
}
const hits = o => cells(o).some(([x, y]) => solid(tile(x, y)));

// move on x, push out of walls, then y, push out of floor/ceiling
function move(o) {
  o.x += o.vx; o.wall = hits(o);
  if (o.wall) { o.x = o.vx > 0 ? Math.floor((o.x + o.w) / T) * T - o.w - 0.01 : (Math.floor(o.x / T) + 1) * T; o.vx = 0; }
  o.y += o.vy; o.ground = false;
  if (hits(o)) {
    if (o.vy > 0) { o.y = Math.floor((o.y + o.h) / T) * T - o.h - 0.01; o.ground = true; }
    else o.y = (Math.floor(o.y / T) + 1) * T;
    o.vy = 0;
  }
}

function burst(x, y, c, n) {
  for (let i = 0; i < n; i++)
    parts.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 30 + Math.random() * 20, c });
}

function die() { dead = 45; burst(player.x + 5, player.y + 7, '#fff', 20); }

function next() {
  if (lvl + 1 < LEVELS.length) return load(lvl + 1);
  state = 'win';
  $('score').textContent = `◆ ${total} cubes collected`;
  $('win').classList.remove('hidden');
}

function update() {
  readMic();
  shake += (motion - shake) * 0.15;
  shakeNow = keys.KeyE ? 25 : shake;
  const shout = vol > MIC_LOUD || keys.ShiftLeft || keys.ShiftRight;
  energy = Math.min(1, Math.max(0, energy + Math.max(0, shakeNow - SHAKE_MIN) * 0.004 - 0.003));
  parts = parts.filter(q => (q.x += q.vx, q.y += q.vy, q.vy += 0.15, --q.life > 0));
  if (dead) { if (--dead === 0) { total = startTotal; load(lvl); } return; }

  const p = player;
  let dir = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  if (!dir && Math.abs(tilt) > TILT_DEADZONE)
    dir = Math.max(-1, Math.min(1, (tilt - Math.sign(tilt) * TILT_DEADZONE) / (TILT_FULL - TILT_DEADZONE)));
  if (dir) p.face = Math.sign(dir);
  p.vx += (dir * SPEED - p.vx) * (p.ground ? 0.25 : 0.12);
  p.vy = Math.min(p.vy + GRAV, 7);
  p.coyote = p.ground ? 6 : p.coyote - 1; // can still jump a few frames after walking off a ledge
  if (p.coyote > 0 && (jumpBuf > 0 || shout)) {
    p.vy = shout ? -SUPER : -JUMP; p.coyote = 0; jumpBuf = 0;
    burst(p.x + 5, p.y + 14, shout ? '#ffd84a' : '#fff', shout ? 14 : 5);
  }
  jumpBuf--;
  move(p);

  for (const [x, y] of cells(p)) {
    const c = tile(x, y);
    if (c === 'o') { map[y][x] = ' '; total++; burst(x * T + 8, y * T + 8, '#ffd84a', 10); }
    if (c === '^' && p.y + p.h > y * T + 9) return die();
    if (c === 'D') return next();
  }
  if (p.y > H + 16) return die();

  for (const e of enemies) {
    e.vx = e.dir * 0.5; e.vy = Math.min(e.vy + GRAV, 7); move(e);
    const ahead = tile(Math.floor((e.dir > 0 ? e.x + e.w + 1 : e.x - 1) / T), Math.floor((e.y + e.h + 2) / T));
    if (e.wall || (e.ground && !solid(ahead))) e.dir *= -1;
    if (e.y > H + 16) e.dead = true;
    if (!e.dead && hit(p, e)) {
      if (p.vy > 0 && p.y + p.h - e.y < 8) { e.dead = true; p.vy = -4.5; burst(e.x + 6, e.y + 6, '#b28dff', 12); }
      else return die();
    }
  }
  enemies = enemies.filter(e => !e.dead);
  camX = Math.max(0, Math.min(map[0].length * T - W, p.x - W / 2 + 5));
}

// ---------- drawing (Fez-ish pixel art, all rectangles) ----------
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const mod = (a, n) => ((a % n) + n) % n;
const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

function drawTile(L, c, x, y) {
  const X = x * T, Y = y * T, h = hash(x, y);
  if (c === '#') {
    rect(X, Y, T, T, L.ground);
    rect(X + h % 12 + 1, Y + (h >> 4) % 10 + 4, 3, 1, DARK);
    rect(X + (h >> 8) % 12 + 1, Y + (h >> 12) % 10 + 4, 2, 1, DARK);
    rect(X, Y + T - 1, T, 1, DARK); rect(X + T - 1, Y, 1, T, DARK); rect(X, Y, 1, T, LIGHT);
    if (!'#B'.includes(tile(x, y - 1))) { // grass on top, with drips like Fez vines
      rect(X, Y, T, 4, L.grass); rect(X, Y, T, 1, LIGHT);
      rect(X + h % 13, Y + 4, 2, 2 + (h >> 5) % 4, L.grass);
      rect(X + (h >> 9) % 14, Y + 4, 1, 2, L.grass);
    }
  } else if (c === 'B') {
    rect(X, Y, T, T, L.brick); rect(X, Y, T, 1, LIGHT);
    rect(X, Y + 7, T, 1, DARK); rect(X, Y + 15, T, 1, DARK);
    rect(X + 7, Y, 1, 7, DARK); rect(X + 3, Y + 8, 1, 7, DARK); rect(X + 11, Y + 8, 1, 7, DARK);
  } else if (c === 'G') {
    if (energy > 0 && (energy > 0.2 || t % 10 < 6)) { // flickers when energy is running out
      rect(X, Y, T, T, '#b28dff'); rect(X, Y, T, 2, LIGHT); rect(X + 4, Y + 5, 8, 6, LIGHT);
    } else {
      ctx.strokeStyle = '#b28dff'; ctx.setLineDash([2, 2]);
      ctx.strokeRect(X + 0.5, Y + 0.5, T - 1, T - 1); ctx.setLineDash([]);
    }
  } else if (c === '^') {
    for (let i = 0; i < 4; i++) {
      rect(X + i * 4 + 1, Y + 8, 2, 8, '#e8ecf5'); rect(X + i * 4, Y + 12, 4, 4, '#e8ecf5');
      rect(X + i * 4 + 2, Y + 9, 1, 7, DARK);
    }
  } else if (c === 'o') { // spinning golden cube
    const cy = Y + 4 + Math.round(Math.sin(t * 0.08 + x) * 2), lw = Math.round(4 + 3.5 * Math.sin(t * 0.06 + x));
    rect(X + 4, cy, 8, 3, '#fff3a6');
    rect(X + 4, cy + 3, lw, 5, '#ffd84a');
    rect(X + 4 + lw, cy + 3, 8 - lw, 5, '#d99a1e');
  } else if (c === 'D') { // stone doorway, 1.5 tiles tall
    rect(X - 2, Y - 8, T + 4, T + 8, '#ece3d0'); rect(X, Y - 10, T, 2, '#ece3d0');
    rect(X + 2, Y - 6, T - 4, T + 6, '#2a1f3d'); rect(X + 4, Y - 8, T - 8, 2, '#2a1f3d');
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 0.1);
    rect(X + 2, Y - 6, T - 4, T + 6, '#ffd84a');
    ctx.globalAlpha = 1;
  }
}

function drawPlayer(p) {
  const x = Math.round(p.x), fy = Math.round(p.y), f = p.face,
    step = p.ground && Math.abs(p.vx) > 0.3 ? (t >> 3) % 2 : 0, y = fy + step;
  rect(x + 1, y + 3, 8, 1, '#fff'); rect(x, y + 4, 10, 9, '#fff');      // body
  rect(f > 0 ? x : x + 9, y + 4, 1, 9, '#d7dcef');                      // shade on the back
  rect(x + (f > 0 ? 5 : 1), y + 6, 1, 2, INK); rect(x + (f > 0 ? 8 : 4), y + 6, 1, 2, INK); // eyes
  rect(x + 2, y - 1, 6, 4, '#e63946'); rect(x + 2, y - 1, 6, 1, LIGHT); // fez hat
  rect(f > 0 ? x + 1 : x + 8, y, 1, 3, INK);                            // tassel
  rect(x + 1 + step, fy + 13, 3, 1, INK); rect(x + 6 - step, fy + 13, 3, 1, INK); // feet
}

function drawEnemy(e) {
  const x = Math.round(e.x), sq = (t >> 3) % 2, y = Math.round(e.y) + sq, d = e.dir > 0 ? 1 : 0;
  rect(x + 1, y, 10, 12 - sq, '#6b4fa0'); rect(x, y + 2, 12, 10 - sq, '#6b4fa0'); rect(x + 1, y, 10, 1, LIGHT);
  rect(x + 2, y + 3, 3, 3, '#fff'); rect(x + 7, y + 3, 3, 3, '#fff');
  rect(x + 3 + d, y + 4, 1, 2, INK); rect(x + 8 + d, y + 4, 1, 2, INK);
}

function draw() {
  const L = LEVELS[lvl], cx = Math.round(camX);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, L.sky[0]); g.addColorStop(1, L.sky[1]);
  rect(0, 0, W, H, g);

  if (L.stars) for (let i = 0; i < 50; i++)
    if ((i + (t >> 4)) % 9) rect(Math.round(mod(i * 67 - cx * 0.05, W)), (i * 41) % 100, 1, 1, '#fff');

  for (let i = 0; i < 6; i++) { // clouds
    const x = Math.round(mod(i * 97 - cx * 0.15 - t * 0.08, W + 60) - 40), y = 12 + (i * 29) % 50;
    rect(x, y + 4, 36, 6, L.cloud); rect(x + 6, y, 18, 4, L.cloud);
  }

  for (let i = Math.floor(cx * 0.4 / 40) - 1, n = i + W / 40 + 3; i < n; i++) { // far towers
    const x = Math.round(i * 40 - cx * 0.4), h = 50 + hash(i, 7) % 70, w = 20 + hash(i, 3) % 16;
    rect(x, H - h, w, h, L.far); rect(x - 2, H - h, w + 4, 3, LIGHT);
    for (let wy = H - h + 10; wy < H - 10; wy += 14) rect(x + (w >> 1) - 1, wy, 3, 5, DARK);
  }

  ctx.save(); ctx.translate(-cx, 0);
  const x0 = Math.floor(cx / T), x1 = x0 + Math.ceil(W / T) + 1;
  for (let y = 0; y < map.length; y++) for (let x = x0; x <= x1; x++) drawTile(L, map[y][x], x, y);
  for (const e of enemies) drawEnemy(e);
  if (!dead) drawPlayer(player);
  for (const q of parts) rect(q.x | 0, q.y | 0, 2, 2, q.c);
  ctx.restore();
}

function hud() {
  $('cubes').textContent = '◆ ' + total;
  $('mMic').style.width = Math.min(100, vol / MIC_LOUD * 100) + '%';
  $('mShake').style.width = Math.min(100, shakeNow / 30 * 100) + '%';
  $('mEnergy').style.width = energy * 100 + '%';
}

// fixed 60 updates/sec so 120Hz phones don't run double speed
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(now - last, 100); last = now;
  for (; acc >= 1000 / 60; acc -= 1000 / 60) { t++; if (state === 'play') update(); }
  draw(); hud();
  requestAnimationFrame(frame);
}
load(0);
requestAnimationFrame(frame);
