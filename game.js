// Cube Hop: a mobile platformer with a D-pad and A/B buttons. Plain canvas, no libraries.
// The phone's sensors are used by session.js (breaks and stopping play), not to steer.

// ---- physics (pixels per frame at 60fps) ----
const T = 16, H = 176, GRAV = 0.3, JUMP = 5.6, DOUBLE = 5, WALK = 1.6, DASH = 4.5;
const LIGHT = 'rgba(255,255,255,.3)', DARK = 'rgba(0,0,0,.18)', INK = '#1b1f4b';

const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
let W = 320;
function resize() {
  W = Math.ceil(H * cv.clientWidth / cv.clientHeight) || 320;
  cv.width = W; cv.height = H;
}
addEventListener('resize', resize); resize();

// effects that session.js switches on near/after the end of play time
const fx = { inverted: false, betray: false, frozen: false, starve: false, musicRate: 1, offKey: false };

// ---------- input: keyboard, D-pad, A/B ----------
const keys = {}, pad = { l: false, r: false };
let jumpBuf = 0, dashBuf = 0;
function pressJump() {
  if (fx.betray && Math.random() < 0.4) return; // "betrayal": the game ignores some presses
  jumpBuf = 8;
}
function pressDash() {
  if (fx.betray && Math.random() < 0.4) return;
  dashBuf = 6;
}
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'KeyW', 'KeyZ'].includes(e.code)) { if (!e.repeat) pressJump(); e.preventDefault(); }
  if (['ShiftLeft', 'ShiftRight', 'KeyX'].includes(e.code) && !e.repeat) pressDash();
});
addEventListener('keyup', e => keys[e.code] = false);

const dp = $('dpad');
function dpadAt(e) { // one touch area, so sliding a thumb from ◀ to ▶ works
  const b = dp.getBoundingClientRect(), x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2;
  const up = y < -b.height / 5;
  if (up && !pad.u) pressJump();
  pad.l = x < -b.width / 6; pad.r = x > b.width / 6; pad.u = up;
  for (const k of ['l', 'r', 'u']) dp.querySelector('.' + k).classList.toggle('on', pad[k]);
}
dp.addEventListener('pointerdown', e => { try { dp.setPointerCapture(e.pointerId); } catch {} dpadAt(e); });
dp.addEventListener('pointermove', e => dp.hasPointerCapture(e.pointerId) && dpadAt(e));
for (const ev of ['pointerup', 'pointercancel'])
  dp.addEventListener(ev, () => { pad.l = pad.r = pad.u = false; dp.querySelectorAll('b').forEach(b => b.classList.remove('on')); });
$('bA').addEventListener('pointerdown', e => { e.preventDefault(); pressJump(); });
$('bB').addEventListener('pointerdown', e => { e.preventDefault(); pressDash(); });

// ---------- sound: tiny synth, no audio files ----------
let ac, muted = false, note = 0, nextNote = 0;
const SONG = [262, 330, 392, 330, 349, 440, 523, 440, 392, 330, 262, 330, 294, 349, 392, 0];

function unlock() { // first tap: phones only allow sound/motion/fullscreen after a user gesture
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  ac.resume();
  window.DeviceMotionEvent?.requestPermission?.().catch(() => {});
  if (matchMedia('(pointer: coarse)').matches)
    document.documentElement.requestFullscreen?.().then(() => screen.orientation.lock?.('landscape')).catch(() => {});
  navigator.wakeLock?.request('screen').catch(() => {});
}

function sfx(f, d = 0.1, type = 'square', v = 0.06, detune = 0) {
  if (!ac || muted) return;
  const o = ac.createOscillator(), g = ac.createGain(), now = ac.currentTime;
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  g.gain.setValueAtTime(v, now); g.gain.exponentialRampToValueAtTime(0.0001, now + d);
  o.connect(g).connect(ac.destination); o.start(now); o.stop(now + d);
}

function music() { // slows and drops in pitch as play time winds down, goes off-key in overtime
  if (!ac || muted || !playing || paused || fx.frozen || ac.currentTime < nextNote) return;
  const f = SONG[note++ % SONG.length];
  if (f) sfx(f * fx.musicRate, 0.22, 'triangle', 0.05, fx.offKey ? (Math.random() - 0.5) * 300 : 0);
  nextNote = ac.currentTime + 0.22 / fx.musicRate;
}

$('mute').onclick = () => { muted = !muted; $('mute').textContent = muted ? '🔇' : '🔊'; };

// ---------- game state ----------
let lvl = 0, map, player, enemies, parts = [], total = 0, startTotal = 0, camX = 0, t = 0, dead = 0, spawn;
let playing = false, paused = false;

function loadLevel(i) {
  lvl = i;
  const rows = LEVELS[i].map, w = Math.max(...rows.map(r => r.length));
  map = rows.map(r => r.padEnd(w).split(''));
  enemies = []; parts = []; startTotal = total;
  map.forEach((row, y) => row.forEach((c, x) => {
    if (c === 'P') spawn = { x: x * T + 3, y: y * T + 2 };
    if (c === 'E') enemies.push({ x: x * T + 2, y: y * T + 4, w: 12, h: 12, vx: 0, vy: 0, dir: -1 });
    if (c === 'P' || c === 'E') row[x] = ' ';
  }));
  respawn();
  $('level').textContent = LEVELS[i].name;
  if (playing) toast(LEVELS[i].hint);
}

function respawn() {
  player = { x: spawn.x, y: spawn.y, w: 10, h: 14, vx: 0, vy: 0, face: 1, coyote: 0 };
  dead = 0;
}

addEventListener('error', e => toast('⚠ ' + e.message)); // show errors on the phone screen while testing

function toast(text) {
  const h = $('hint');
  h.textContent = text;
  h.classList.remove('show'); void h.offsetWidth; h.classList.add('show');
}

function tile(x, y) {
  if (x < 0 || x >= map[0].length) return '#'; // invisible walls at the level edges
  return map[y]?.[x] ?? ' ';
}
const solid = c => c === '#' || c === 'B';
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

function die() { dead = 45; burst(player.x + 5, player.y + 7, '#fff', 20); sfx(196, 0.4, 'sawtooth'); }

function update() {
  parts = parts.filter(q => (q.x += q.vx, q.y += q.vy, q.vy += 0.15, --q.life > 0));
  if (dead) {
    if (--dead === 0) {
      if (fx.starve) { total = startTotal; loadLevel(lvl); toast('Back to the start of the level!'); } // checkpoint starvation
      else respawn();
    }
    return;
  }

  const p = player;
  let dir = (keys.ArrowRight || keys.KeyD || pad.r ? 1 : 0) - (keys.ArrowLeft || keys.KeyA || pad.l ? 1 : 0);
  if (fx.inverted) dir = -dir;
  if (dir) p.face = dir;
  if (p.ground) p.canDash = true; // one dash, then touch the ground to recharge it
  if (dashBuf > 0 && p.canDash && !p.dash) { p.dash = 12; p.canDash = false; dashBuf = 0; sfx(260, 0.15, 'sawtooth'); }
  dashBuf--;
  if (p.dash) { // dash: a straight burst in the facing direction, no gravity
    p.dash--; p.vx = p.face * DASH; p.vy = 0;
    if (t % 2) parts.push({ x: p.x + 5, y: p.y + 4 + Math.random() * 8, vx: 0, vy: 0, life: 12, c: '#ffffffaa' });
  } else {
    p.vx += (dir * WALK - p.vx) * (p.ground ? 0.25 : 0.12);
    p.vy = Math.min(p.vy + GRAV, 7);
  }
  p.coyote = p.ground ? 6 : p.coyote - 1; // can still jump a few frames after walking off a ledge
  if (p.ground) p.jumps = 0;
  if (jumpBuf > 0 && (p.coyote > 0 || p.jumps < 2)) { // A jumps, A again in the air = double jump
    const air = p.coyote <= 0;
    p.vy = air ? -DOUBLE : -JUMP; p.jumps = air ? 2 : 1; p.dash = 0;
    p.coyote = 0; jumpBuf = 0;
    burst(p.x + 5, p.y + 14, air ? '#7fe0c2' : '#fff', air ? 10 : 5); sfx(air ? 780 : 520, 0.12);
  }
  jumpBuf--;
  move(p);

  for (const [x, y] of cells(p)) {
    const c = tile(x, y);
    if (c === 'o') { map[y][x] = ' '; total++; burst(x * T + 8, y * T + 8, '#ffd84a', 10); sfx(988, 0.08); sfx(1319, 0.15); }
    if (c === 'F') { map[y][x] = 'f'; spawn = { x: x * T + 3, y: y * T + 2 }; sfx(660, 0.1); sfx(880, 0.2); toast('Checkpoint!'); }
    if (c === '^' && p.y + p.h > y * T + 9) return die();
    if (c === 'D') { sfx(523, 0.1); sfx(784, 0.3); return onLevelDone(); }
  }
  if (p.y > H + 16) return die();

  for (const e of enemies) {
    e.vx = e.dir * (LEVELS[lvl].enemySpeed || 0.5); // later levels have faster enemies
    e.vy = Math.min(e.vy + GRAV, 7); move(e);
    const ahead = tile(Math.floor((e.dir > 0 ? e.x + e.w + 1 : e.x - 1) / T), Math.floor((e.y + e.h + 2) / T));
    if (e.wall || (e.ground && !solid(ahead))) e.dir *= -1;
    if (e.y > H + 16) e.dead = true;
    if (!e.dead && hit(p, e)) {
      if (p.dash || (p.vy > 0 && p.y + p.h - e.y < 8)) { // dash into it, or stomp it
        e.dead = true; if (!p.dash) p.vy = -4.5; burst(e.x + 6, e.y + 6, '#b28dff', 12); sfx(330, 0.1);
      }
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
  } else if (c === '^') {
    for (let i = 0; i < 4; i++) {
      rect(X + i * 4 + 1, Y + 8, 2, 8, '#e8ecf5'); rect(X + i * 4, Y + 12, 4, 4, '#e8ecf5');
      rect(X + i * 4 + 2, Y + 9, 1, 7, DARK);
    }
  } else if (c === 'F' || c === 'f') { // checkpoint flag, lights up once touched
    rect(X + 7, Y + 1, 2, 15, '#ece3d0');
    rect(X + 9, Y + 2, 6, 5, c === 'f' ? '#ffd84a' : '#8a8fb0');
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

// fixed 60 updates/sec so 120Hz phones don't run double speed
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(now - last, 100); last = now;
  for (; acc >= 1000 / 60; acc -= 1000 / 60) {
    t++;
    if (playing) { onTick(); if (!paused && !fx.frozen) update(); }
  }
  draw(); music();
  requestAnimationFrame(frame);
}
loadLevel(0);
requestAnimationFrame(frame);
