// Session rules that help a child stop playing ("designing for disengagement").
// Principles: autonomy (the child can stop any time and picks activities), gradual transition
// (warning, slow fade of color and music), satisfying endings (stop at a finished level),
// continuity (progress is saved), social context (grown-up settings), no rewards for staying.
// The sensors are tools here: camera = find a color, steps = walk, stillness = calm down,
// microphone = hum, angry shaking = scrambled controls.

// ---- calibration knobs: tune these on real phones ----
const SHAKE_ANGRY = 18;  // m/s² of shaking that counts as "frustrated"
const STILL = 0.8;       // m/s² of motion below this = phone held still
const HUM_LEVEL = 0.04;  // mic volume (0..1) that counts as humming
const CALM_SECONDS = 8, HUM_SECONDS = 3;

// everything a grown-up can change (numbers are minutes unless the label says otherwise)
const DEFAULTS = {
  session: 15, breakEvery: 5, warn: 2, week: 120,
  photo: true, walk: true, steps: 20, calm: true, hum: true,
  red: true, orange: true, yellow: true, green: true, blue: true, purple: true,
  fade: true, sound: true, block: true, negative: true, invert: true, betray: true, freeze: true, starve: true,
  shakeInvert: true, dev: false,
};
const FORM = [
  ['Time', { session: 'Play session (min)', breakEvery: 'Activity break every (min, 0 = never)', warn: 'Start winding down (min before end)', week: 'Play time per week (min)' }],
  ['Break activities', { photo: '📷 Find a color with the camera', walk: '🚶 Walk around', steps: 'Steps to walk', calm: '🧘 Hold still and breathe', hum: '🎤 Hum a song' }],
  ['Colors to find', { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple' }],
  ['Winding down', { fade: 'Colors slowly fade to gray', sound: 'Music slows down, then sounds wrong in overtime' }],
  ['If they keep playing after time is up', {
    block: 'Pop-ups that stop the game', negative: 'Colors turn negative (after 30 s)', invert: 'Left and right swap (after 1 min)',
    betray: 'Game ignores some jumps (after 1.5 min)', freeze: 'Screen freezes (after 2 min)', starve: 'Falling restarts the whole level',
  }],
  ['Frustration', { shakeInvert: 'Angry shaking swaps the controls until the child calms down' }],
  ['Testing', { dev: '🛠 Dev mode: a button to try each mechanic right away' }],
];
const COLORS = { red: [0, '#e63946'], orange: [28, '#f4a261'], yellow: [55, '#ffd84a'], green: [125, '#6fd17c'], blue: [215, '#4a90e2'], purple: [275, '#b28dff'] };

// ---------- saved data (this device only) ----------
const get = (k, d) => { try { return JSON.parse(localStorage.getItem('cubehop.' + k)) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem('cubehop.' + k, JSON.stringify(v)); } catch {} };
let S = { ...DEFAULTS, ...get('settings', {}) };
if (/[?&]dev\b/.test(location.search)) S.dev = true; // or open the page with ?dev

function weekId() { // the Monday of this week
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.toDateString();
}
let week = get('week', {});
const checkWeek = () => { if (week.id !== weekId()) week = { id: weekId(), used: 0 }; };
checkWeek();

// ---------- sensors ----------
let motion = 0, steps = 0, stepUp = false, lastStep = 0, analyser = null, stream = null;
addEventListener('devicemotion', e => {
  const a = e.acceleration, g = e.accelerationIncludingGravity;
  const gm = g && g.x != null ? Math.hypot(g.x, g.y, g.z) : 9.81;
  motion = a && a.x != null ? Math.hypot(a.x, a.y, a.z) : Math.abs(gm - 9.81);
  // a step = gravity spikes above ~1.2g, then drops back
  if (!stepUp && gm > 11.5 && e.timeStamp - lastStep > 300) { stepUp = true; steps++; lastStep = e.timeStamp; }
  else if (gm < 10.2) stepUp = false;
});

function readMic() {
  if (!analyser) return 0;
  const wave = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(wave);
  let s = 0;
  for (const v of wave) s += v * v;
  return Math.sqrt(s / wave.length);
}

// ---------- session timing and effects ----------
let used = 0, extra = 0, nextBreak = Infinity, warned = false, timeUp = false, hardStop = false;
let invertUntil = 0, angry = 0, activityTick = null, lastFilter = '';
const left = () => Math.min(S.session * 60 + extra - used, S.week * 60 - week.used); // seconds

function startSession(level, cubes) {
  checkWeek();
  if (S.week * 60 - week.used <= 0) return showTitle();
  used = extra = 0; warned = timeUp = hardStop = false; invertUntil = 0;
  nextBreak = S.breakEvery > 0 ? S.breakEvery * 60 : Infinity;
  $('notches').innerHTML = '';
  for (let m = S.breakEvery; S.breakEvery > 0 && m < S.session; m += S.breakEvery)
    $('notches').innerHTML += `<span style="left:${m / S.session * 100}%"></span>`;
  $('devBtn').classList.toggle('hidden', !S.dev);
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); $('pad').classList.remove('hidden');
  total = cubes; playing = true; closeModal();
  loadLevel(level);
}

function onTick() { // every 1/60 s while in a game, even when a card is open
  if (activityTick) activityTick();
  if (paused) return;
  used += 1 / 60; if (!S.dev) week.used += 1 / 60; // dev testing doesn't eat the weekly time
  if (t % 120 === 0) put('week', week);
  const l = left(), over = -l;

  if (used >= nextBreak && l > S.warn * 60) { nextBreak += S.breakEvery * 60; return breakTime(); }
  if (!warned && l <= S.warn * 60 && l > 0) { warned = true; toast(`Almost time to stop!\nTry to finish this level`); }
  if (!timeUp && l <= 0) { timeUp = true; if (S.block) return timesUp(); toast("Time's up! Finish this level"); }
  if (!hardStop && S.block && over >= 150) { hardStop = true; return stopCard(); }

  // gradual fade before the end, harsher effects in overtime
  const fade = S.fade && S.warn > 0 ? Math.min(1, Math.max(0, 1 - l / (S.warn * 60))) : 0;
  const gray = devFx.gray ? 1 : fade;
  const filter = `grayscale(${gray.toFixed(2)})` + (devFx.negative || (S.negative && over > 30) ? ' invert(1)' : '');
  if (filter !== lastFilter) cv.style.filter = lastFilter = filter;
  fx.musicRate = devFx.music ? 0.65 : S.sound ? 1 - 0.35 * fade : 1;
  fx.offKey = devFx.music || (S.sound && over > 0);
  fx.inverted = devFx.invert || (S.invert && over > 60) || t < invertUntil;
  fx.betray = devFx.betray || (S.betray && over > 90);
  fx.frozen = t < devFreeze || (S.freeze && over > 120 && over < 126);
  fx.starve = devFx.starve || (S.starve && over > 0);

  // frustration: hard shaking scrambles the controls; calming down fixes them
  angry = (keys.KeyE ? 25 : motion) > SHAKE_ANGRY ? angry + 1 : Math.max(0, angry - 1);
  if (S.shakeInvert && angry > 20 && t >= invertUntil) {
    angry = 0; invertUntil = t + 30 * 60; sfx(150, 0.5, 'sawtooth');
    toast('Shaking scrambled the controls!\nTap 🧘 to calm down');
  }
  $('calmBtn').classList.toggle('hidden', t >= invertUntil);

  $('cubes').textContent = '◆ ' + total;
  const s = Math.max(0, Math.ceil(l));
  $('clock').textContent = `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;
  $('timeFill').style.width = Math.min(100, used / (used + Math.max(0, l)) * 100) + '%';
}

// ---------- cards (pop-ups) ----------
let cardId = 0;
function modal(html, buttons = []) {
  stopMedia(); activityTick = null; paused = true;
  const m = $('modal');
  m.innerHTML = `<div class="card">${html}<div class="btns"></div></div>`;
  for (const [label, fn, cls] of buttons) {
    const b = document.createElement('button');
    b.textContent = label; b.className = cls || '';
    // act when the finger lifts (some phones drop the click on a no-scroll page);
    // click still works for keyboard/tests (detail 0), and a press must start on the button
    b.onpointerdown = () => b.armed = true;
    b.onpointerup = () => b.armed && (b.armed = false, fn());
    b.onclick = e => e.detail === 0 && fn();
    m.querySelector('.btns').append(b);
  }
  m.classList.remove('hidden');
  return cardId;
}
function closeModal() { stopMedia(); activityTick = null; paused = false; $('modal').classList.add('hidden'); }
function stopMedia() { cardId++; stream?.getTracks().forEach(k => k.stop()); stream = null; analyser = null; }
const progress = f => { const b = $('prog'); if (b) b.style.width = Math.min(100, f * 100) + '%'; };
const pick = a => a[Math.random() * a.length | 0];
const success = msg => modal(`<h2>${msg}</h2>`, [['▶ Back to the game', closeModal]]);

// an activity card: "Back" lets the child pick something else; "Skip" exists only on PC for testing
const card = (html, done, back) => modal(html, [['↩ Back', back, 'ghost'], ['Skip (PC test)', done, 'ghost pc']]);

const ACTS = [['photo', '📷 Find a color', photo], ['walk', '🚶 Take a walk', walk], ['calm', '🧘 Breathe', calm], ['hum', '🎤 Hum a song', hum]];

function breakTime() {
  const acts = ACTS.filter(([k]) => S[k]);
  if (!acts.length) return;
  const done = () => success('Nice job! 🎉');
  modal(`<h2>Break time! 🌟</h2><p>Pick something to do:</p>`, [
    ...acts.map(([, label, fn]) => [label, () => fn(done, breakTime)]),
    ["🏁 I'm done for today", () => endSession()],
  ]);
}

function timesUp() {
  modal(`<h2>⏰ Time's up!</h2><p>Finish this level to end on a win, or stop now.<br>Your progress is saved either way.</p>`, [
    ['▶ Finish this level', closeModal],
    ['🏁 Stop now', () => endSession()],
    ['+5 min (grown-up)', () => grownUp(addTime, timesUp), 'ghost'],
  ]);
}

function stopCard() {
  modal(`<h2>🌙 Play time is over</h2><p>Let's stop here. Your progress is saved.</p>`, [
    ['🏁 Save & stop', () => endSession()],
    ['+5 min (grown-up)', () => grownUp(addTime, stopCard), 'ghost'],
  ]);
}

function addTime() {
  extra += 300; week.used = Math.max(0, week.used - 300);
  warned = timeUp = hardStop = false;
  if (S.breakEvery > 0) nextBreak = used + S.breakEvery * 60; // no break popping up right away
  closeModal();
}

function onLevelDone() { // called by game.js when the player reaches a door
  const next = (lvl + 1) % LEVELS.length, last = next === 0;
  put('save', { lvl: next, total });
  if (timeUp) return endSession('You finished just in time!', true);
  modal(`<h2>${last ? '🏆 You finished every level!' : '⭐ Level complete!'}</h2><p>◆ ${total} cubes · progress saved</p>`, [
    [last ? '▶ Play again' : '▶ Next level', () => { loadLevel(next); closeModal(); }],
    ['🏁 Stop here', () => endSession('Great playing!', true)],
  ]);
}

function endSession(msg = 'Great playing!', saved = false) {
  if (!saved) { total = startTotal; put('save', { lvl, total }); } // resume at the start of this level
  put('week', week);
  const mins = Math.max(1, Math.round(used / 60));
  modal(`<h2>${msg} 🌟</h2><p>You played ${mins} min and have ◆ ${total} cubes.<br>Your progress is saved, see you next time!</p><p>💬 Tell a grown-up what you did today</p>`,
    [['🏠 Home', showTitle]]);
  playing = false;
}

function grownUp(then, back, note = '') { // simple parent gate
  const a = 6 + pick([0, 1, 2, 3, 4, 5, 6]), b = 3 + pick([0, 1, 2, 3, 4, 5, 6]);
  modal(`<h2>For grown-ups</h2>${note}<p>What is ${a} × ${b}?</p><input id="gate" type="number" inputmode="numeric">`, [
    ['OK', () => (+$('gate').value === a * b ? then() : grownUp(then, back, '<p>Not quite, try again!</p>'))],
    ['Cancel', back, 'ghost'],
  ]);
  $('gate').focus();
}

function settingsCard() {
  let html = `<h2>⚙ Grown-up settings</h2><p>Played this week: ${Math.round(week.used / 60)} of ${S.week} min</p>`;
  for (const [head, fields] of FORM) {
    html += `<h3>${head}</h3>`;
    for (const [k, label] of Object.entries(fields))
      html += typeof DEFAULTS[k] === 'number'
        ? `<label class="row">${label}<input type="number" min="0" step="any" id="s_${k}" value="${S[k]}"></label>`
        : `<label class="row"><input type="checkbox" id="s_${k}" ${S[k] ? 'checked' : ''}>${label}</label>`;
  }
  modal(html, [
    ['Save', () => {
      for (const k in DEFAULTS) S[k] = typeof DEFAULTS[k] === 'number' ? Math.max(0, +$('s_' + k).value || 0) : $('s_' + k).checked;
      put('settings', S); showTitle();
    }],
    ["Reset this week's time", () => { week.used = 0; put('week', week); settingsCard(); }, 'ghost'],
    ['Cancel', showTitle, 'ghost'],
  ]);
}

function showTitle() {
  closeModal(); playing = false; checkWeek();
  Object.assign(fx, { inverted: false, betray: false, frozen: false, starve: false, musicRate: 1, offKey: false });
  cv.style.filter = lastFilter = '';
  $('hud').classList.add('hidden'); $('pad').classList.add('hidden'); $('title').classList.remove('hidden');
  const wl = Math.max(0, S.week * 60 - week.used), save = get('save', null);
  $('weekInfo').textContent = wl > 0 ? `Play time left this week: ${Math.ceil(wl / 60)} min` : "This week's play time is used up. It comes back on Monday! 🌙";
  $('continue').classList.toggle('hidden', !save || wl <= 0);
  $('newGame').classList.toggle('hidden', wl <= 0);
  $('resetWeek').classList.toggle('hidden', wl > 0);
}

// ---------- activities ----------
function calm(done, back) { // hold the phone still while a circle breathes
  card(`<h2>🧘 Hold the phone still<br>and breathe slowly</h2><div class="breathe"></div><p id="breath"></p><i class="bar"><b id="prog"></b></i>`, done, back);
  let still = 0;
  activityTick = () => {
    still = motion < STILL ? still + 1 : Math.max(0, still - 2);
    $('breath').textContent = t % 480 < 240 ? 'Breathe in…' : 'Breathe out…';
    progress(still / (CALM_SECONDS * 60));
    if (still >= CALM_SECONDS * 60) { activityTick = null; done(); }
  };
}

function walk(done, back) {
  const start = steps;
  card(`<h2>🚶 Walk ${S.steps} steps</h2><p class="big" id="count">0</p><p>Hold the phone and walk around the room</p><i class="bar"><b id="prog"></b></i>`, done, back);
  activityTick = () => {
    const n = steps - start;
    $('count').textContent = `${n} / ${S.steps}`;
    progress(n / S.steps);
    if (n >= S.steps) { activityTick = null; done(); }
  };
}

function hum(done, back) {
  const id = card(`<h2>🎤 Hum your favorite song</h2><p id="msg">Keep humming until the bar is full</p><i class="bar"><b id="prog"></b></i>`, done, back);
  navigator.mediaDevices?.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    .then(s => {
      if (id !== cardId) return s.getTracks().forEach(k => k.stop()); // card already closed
      stream = s; analyser = ac.createAnalyser(); analyser.fftSize = 512;
      ac.createMediaStreamSource(s).connect(analyser);
    })
    .catch(() => $('msg') && ($('msg').textContent = 'Microphone not available, try another activity'));
  let n = 0;
  activityTick = () => {
    if (readMic() > HUM_LEVEL) n++;
    progress(n / (HUM_SECONDS * 60));
    if (n >= HUM_SECONDS * 60) { activityTick = null; done(); }
  };
}

function photo(done, back) { // point the camera at something of a given color and snap
  const names = Object.keys(COLORS).filter(c => S[c]), name = pick(names.length ? names : Object.keys(COLORS));
  const [hue, hex] = COLORS[name];
  const id = modal(`<h2>📷 Find something <b style="color:${hex}">${name.toUpperCase()}</b></h2><div class="cam"><video playsinline muted autoplay></video></div><p id="msg">Fill the square with it and press SNAP</p>`, [
    ['📸 SNAP', snap], ['↩ Back', back, 'ghost'], ['Skip (PC test)', done, 'ghost pc'],
  ]);
  const video = $('modal').querySelector('video');
  navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
    .then(s => { if (id !== cardId) return s.getTracks().forEach(k => k.stop()); stream = s; video.srcObject = s; })
    .catch(() => $('msg') && ($('msg').textContent = 'Camera not available, try another activity'));

  function snap() {
    if (!video.videoWidth) return;
    const c = document.createElement('canvas'), x = c.getContext('2d'), side = Math.min(video.videoWidth, video.videoHeight) / 2;
    c.width = c.height = 24;
    x.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data;
    let match = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [h, s, l] = hsl(d[i], d[i + 1], d[i + 2]), dh = Math.abs(h - hue);
      if (s > 0.3 && l > 0.15 && l < 0.85 && Math.min(dh, 360 - dh) < 22) match++;
    }
    if (match > 24 * 24 * 0.3) { sfx(784, 0.1); sfx(1047, 0.2); done(); }
    else $('msg').textContent = `Hmm, I don't see ${name} yet. Get closer and try again!`;
  }
}

function hsl(r, g, b) { // → [hue 0-360, saturation 0-1, lightness 0-1]
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
}

// ---------- dev mode: try each friction mechanic on demand ----------
const devFx = {};
let devFreeze = 0;
function devCard() {
  const end = S.session * 60 + extra, clock = s => () => { used = s; closeModal(); }; // move the clock, the real rules react
  const toggle = (k, label) => [(devFx[k] ? '✓ ' : '') + label, () => { devFx[k] = !devFx[k]; devCard(); }, devFx[k] ? '' : 'ghost'];
  const angryShake = () => { closeModal(); invertUntil = t + 30 * 60; toast('Shaking scrambled the controls!\nTap 🧘 to calm down'); };
  const lockWeek = () => { week.used = S.week * 60; put('week', week); endSession('This week is used up'); };
  modal(`<h2>🛠 Dev mode</h2><p>Jump the clock: the real sequence plays<br>(it follows the grown-up settings)</p>`, [
    ['☕ Break', () => { closeModal(); breakTime(); }],
    ['⏩ Wind down', clock(end - S.warn * 60 + 1)],
    ["⏰ Time's up", () => { timeUp = false; clock(end)(); }],
    ...[30, 60, 90, 120, 150].map(s => [`+${s}s over`, () => { timeUp = true; hardStop = false; clock(end + s + 0.5)(); }]),
    ['↺ Reset clock', () => { used = 0; warned = timeUp = hardStop = false; devFreeze = invertUntil = 0; for (const k in devFx) devFx[k] = false; closeModal(); }],
  ]);
  $('modal').querySelector('.btns').insertAdjacentHTML('afterend', '<p>Or switch one effect on by itself:</p><div class="btns" id="devToggles"></div>');
  for (const [label, fn, cls] of [
    toggle('gray', '🌫 Gray'), toggle('negative', '🔄 Negative'), toggle('music', '🎵 Music slow/off-key'),
    toggle('invert', '🔀 Swap controls'), toggle('betray', '🙈 Ignore jumps'), toggle('starve', '⛔ No checkpoints'),
    ['❄ Freeze 5 s', () => { devFreeze = t + 300; closeModal(); }, 'ghost'], ['😠 Angry shake', angryShake, 'ghost'],
    ['🔒 Use up the week', lockWeek, 'ghost'], ['✕ Close', closeModal],
  ]) {
    const b = document.createElement('button');
    b.textContent = label; b.className = cls || ''; b.onclick = fn;
    $('devToggles').append(b);
  }
}

// ---------- buttons ----------
$('continue').onclick = () => { unlock(); const s = get('save', { lvl: 0, total: 0 }); startSession(s.lvl, s.total); };
$('newGame').onclick = () => { unlock(); startSession(0, 0); };
$('parents').onclick = () => grownUp(settingsCard, showTitle);
$('resetWeek').onclick = () => { // for testing; behind the grown-up question unless dev mode is on
  const reset = () => { week.used = 0; put('week', week); showTitle(); };
  S.dev ? reset() : grownUp(reset, showTitle);
};
$('pause').onclick = () => modal('<h2>⏸ Paused</h2>', [['▶ Resume', closeModal], ['🏁 Stop playing', () => endSession()]]);
$('devBtn').onclick = devCard;
$('calmBtn').onclick = () => calm(() => { invertUntil = 0; success('Controls are back to normal 😌'); }, closeModal);
showTitle();
