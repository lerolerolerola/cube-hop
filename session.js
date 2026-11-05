const SHAKE_ANGRY = 18;
const STILL = 0.8;
const HUM_LEVEL = 0.04;
const CALM_SECONDS = 8, HUM_SECONDS = 3;
const SNOOZE = 60, FINISH = 120, STEP = 120; // s: break comes back after 'Not now'; time to finish the level; gap between friction steps
const FACE_DOWN = 150, FACE_UP = 120; // |beta| in degrees: flat face down is ±180, gap avoids flicker

const DEFAULTS = {
  session: 15, breakEvery: 5, warn: 2, week: 120,
  photo: true, walk: true, steps: 20, calm: true, hum: true, rest: true, restSecs: 60,
  red: true, orange: true, yellow: true, green: true, blue: true, purple: true,
  fade: true, sound: true, streak: 10, negative: true, invert: true, betray: true,
  shakeInvert: true, dev: false,
};
const FORM = [
  ['Time', { session: 'Play session (min)', breakEvery: 'Activity break every (min, 0 = never)', warn: 'Start winding down (min before end)', week: 'Play time per week (min)' }],
  ['Break activities', { photo: ':camera: Find a color with the camera', walk: ':walk: Walk around', steps: 'Steps to walk', calm: ':breathe: Hold still and breathe', hum: ':hum: Hum a song', rest: ':phone: Put the phone face down', restSecs: 'Seconds face down' }],
  ['Colors to find', { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple' }],
  ['Winding down', { fade: 'Colors slowly fade to gray', sound: 'Music slows down, then sounds wrong in overtime' }],
  ['Playing a long time without a break', {
    streak: 'Friction starts after (min without doing a break, 0 = never)', negative: 'Colors turn negative (+2 min)',
    invert: 'Left and right swap (+4 min)', betray: 'Game ignores some jumps (+6 min)',
  }],
  ['Frustration', { shakeInvert: 'Angry shaking swaps the controls until the child calms down' }],
  ['Testing', { dev: ':dev: Dev mode: a button to try each mechanic right away' }],
];
const COLORS = { red: [0, '#e63946'], orange: [28, '#f4a261'], yellow: [55, '#ffd84a'], green: [125, '#6fd17c'], blue: [215, '#4a90e2'], purple: [275, '#b28dff'] };

const get = (k, d) => { try { return JSON.parse(localStorage.getItem('cubehop.' + k)) ?? d; } catch { return d; } };
const put = (k, v) => { try { localStorage.setItem('cubehop.' + k, JSON.stringify(v)); } catch {} };
let S = { ...DEFAULTS, ...get('settings', {}) };
if (/[?&]dev\b/.test(location.search)) S.dev = true;

function weekId() {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.toDateString();
}
let week = get('week', {});
const checkWeek = () => { if (week.id !== weekId()) week = { id: weekId(), used: 0 }; };
checkWeek();
// Today's session clock survives Stop playing → Continue (it was reset on every start).
let day = get('day', {});
const checkDay = () => { if (day.id !== new Date().toDateString()) day = { id: new Date().toDateString(), used: 0, extra: 0 }; };
const saveDay = () => { day.used = used; day.extra = extra; put('day', day); };
const dayLeft = () => (checkDay(), S.session * 60 + day.extra - day.used);

let motion = 0, steps = 0, stepUp = false, lastStep = 0, analyser = null, stream = null;
addEventListener('devicemotion', e => {
  const a = e.acceleration, g = e.accelerationIncludingGravity;
  const gm = g && g.x != null ? Math.hypot(g.x, g.y, g.z) : 9.81;
  motion = a && a.x != null ? Math.hypot(a.x, a.y, a.z) : Math.abs(gm - 9.81);
  if (!stepUp && gm > 11.5 && e.timeStamp - lastStep > 300) { stepUp = true; steps++; lastStep = e.timeStamp; }
  else if (gm < 10.2) stepUp = false;
});

let beta = 0;
addEventListener('deviceorientation', e => { if (e.beta != null) beta = e.beta; });

function readMic() {
  if (!analyser) return 0;
  const wave = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(wave);
  let s = 0;
  for (const v of wave) s += v * v;
  return Math.sqrt(s / wave.length);
}

let used = 0, extra = 0, nextBreak = Infinity, warned = false, timeUp = false;
let sinceBreak = 0, snoozes = 0, streakWarned = false, finishBy = 0, lateEnd = false;
let invertUntil = 0, angry = 0, activityTick = null, lastFilter = '';
const left = () => Math.min(S.session * 60 + extra - used, S.week * 60 - week.used);

function startSession(level, cubes) {
  checkWeek();
  if (S.week * 60 - week.used <= 0 || dayLeft() <= 0) return showTitle();
  used = day.used; extra = day.extra;
  sinceBreak = snoozes = finishBy = 0; warned = timeUp = streakWarned = lateEnd = false; invertUntil = 0;
  nextBreak = S.breakEvery > 0 ? (Math.floor(used / (S.breakEvery * 60)) + 1) * S.breakEvery * 60 : Infinity;
  $('notches').innerHTML = '';
  for (let m = S.breakEvery; S.breakEvery > 0 && m < S.session; m += S.breakEvery)
    $('notches').innerHTML += `<span style="left:${m / S.session * 100}%"></span>`;
  $('devBtn').classList.toggle('hidden', !S.dev);
  $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); $('pad').classList.remove('hidden');
  total = cubes; playing = true; closeModal();
  loadLevel(level);
}

// Seconds past the no-break limit (negative = still fine).
const noBreak = () => S.streak > 0 && S.breakEvery > 0 ? sinceBreak - S.streak * 60 : -1;

function onTick() {
  if (activityTick) activityTick();
  if (paused) return;
  used += 1 / 60; sinceBreak += 1 / 60; if (!S.dev) week.used += 1 / 60;
  if (t % 120 === 0) { put('week', week); saveDay(); }
  const l = left();

  if (used >= nextBreak && l > S.warn * 60) { nextBreak = Infinity; return breakTime(); }
  if (!warned && l <= S.warn * 60 && l > 0) { warned = true; toast(`Almost time to stop!\nTry to finish this level`); }
  if (!timeUp && l <= 0) { timeUp = true; return timesUp(); }
  if (finishBy && used >= finishBy) { finishBy = 0; lateEnd = true; return endSession('Time to rest!'); }

  // Friction grows with play time since the last break that was done; doing a break clears it.
  const over = noBreak();
  if (over >= 0 && !streakWarned) { streakWarned = true; toast('You have played a long time without a break!\nDo a break to make the game normal again'); }
  const fade = S.fade && S.warn > 0 ? Math.min(1, Math.max(0, 1 - l / (S.warn * 60))) : 0;
  const gray = devFx.gray || over >= 0 ? 1 : fade;
  const filter = `grayscale(${gray.toFixed(2)})` + (devFx.negative || (S.negative && over >= STEP) ? ' invert(1)' : '');
  if (filter !== lastFilter) cv.style.filter = lastFilter = filter;
  fx.musicRate = devFx.music ? 0.65 : over >= 0 ? 0.75 : S.sound ? 1 - 0.35 * fade : 1;
  fx.offKey = devFx.music || (S.sound && over >= STEP);
  fx.inverted = devFx.invert || (S.invert && over >= 2 * STEP) || t < invertUntil;
  fx.betray = devFx.betray || (S.betray && over >= 3 * STEP);

  angry = (keys.KeyE ? 25 : motion) > SHAKE_ANGRY ? angry + 1 : Math.max(0, angry - 1);
  if (S.shakeInvert && angry > 20 && t >= invertUntil) {
    angry = 0; invertUntil = t + 30 * 60; sfx(150, 0.5, 'sawtooth');
    toast('Shaking scrambled the controls!\nTap :breathe: to calm down');
  }
  $('calmBtn').classList.toggle('hidden', t >= invertUntil);

  $('cubes').innerHTML = ic('gem') + ' ' + total;
  const s = Math.max(0, Math.ceil(l));
  $('clock').textContent = `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;
  $('timeFill').style.width = Math.min(100, used / (used + Math.max(0, l)) * 100) + '%';
}

let cardId = 0;
function modal(html, buttons = []) {
  stopMedia(); activityTick = null; paused = true;
  const m = $('modal');
  m.innerHTML = `<div class="card">${icons(html)}<div class="btns"></div></div>`;
  for (const [label, fn, cls] of buttons) {
    const b = document.createElement('button');
    b.innerHTML = icons(label); b.className = cls || '';
    onPress(b, () => fn());
    m.querySelector('.btns').append(b);
  }
  m.classList.remove('hidden');
  return cardId;
}
function closeModal() { stopMedia(); activityTick = null; paused = false; $('modal').classList.add('hidden'); }
function stopMedia() { cardId++; stream?.getTracks().forEach(k => k.stop()); stream = null; analyser = null; }
const progress = f => { const b = $('prog'); if (b) b.style.width = Math.min(100, f * 100) + '%'; };
const pick = a => a[Math.random() * a.length | 0];
const success = msg => modal(`<h2>${msg}</h2>`, [[':play: Back to the game', closeModal]]);

const card = (html, done, back) => modal(html, [[':back: Back', back, 'ghost'], ['Skip (PC test)', done, 'ghost pc']]);

const ACTS = [['photo', ':camera: Find a color', photo], ['walk', ':walk: Take a walk', walk], ['calm', ':breathe: Breathe', calm], ['hum', ':hum: Hum a song', hum], ['rest', ':phone: Phone nap', rest]];

function breakTime() {
  const acts = ACTS.filter(([k]) => S[k]);
  if (!acts.length) return;
  const done = () => {
    sinceBreak = snoozes = 0; streakWarned = false;
    nextBreak = used + S.breakEvery * 60;
    success('Nice job! :party:');
  };
  const notNow = () => { snoozes++; nextBreak = used + SNOOZE; closeModal(); };
  modal(`<h2>Break time! :star:</h2><p>Pick something to do:</p>`, [
    ...acts.map(([, label, fn]) => [label, () => fn(done, breakTime)]),
    [':skip: Not now', notNow, 'ghost'],
    [":flag: I'm done for today", () => endSession()],
  ]);
}

function timesUp() {
  modal(`<h2>:clock: Time's up!</h2><p>You have ${FINISH / 60} minutes to finish this level, or stop now.<br>Your progress is saved either way.</p>`, [
    [':play: Finish this level', () => { finishBy = used + FINISH; closeModal(); }],
    [':flag: Stop now', () => endSession()],
    ['+5 min (grown-up)', () => grownUp(addTime, timesUp), 'ghost'],
  ]);
}

function addTime() {
  extra += 300; week.used = Math.max(0, week.used - 300);
  warned = timeUp = false; finishBy = 0;
  closeModal();
}

function onLevelDone() {
  const next = (lvl + 1) % LEVELS.length, last = next === 0;
  put('save', { lvl: next, total });
  if (timeUp) return endSession('You finished just in time!', true);
  modal(`<h2>${last ? ':trophy: You finished every level!' : ':star: Level complete!'}</h2><p>:gem: ${total} cubes · progress saved</p>`, [
    [last ? ':play: Play again' : ':play: Next level', () => { loadLevel(next); closeModal(); }],
    [':flag: Stop here', () => endSession('Great playing!', true)],
  ]);
}

function endSession(msg = 'Great playing!', saved = false) {
  if (!saved) { total = startTotal; put('save', { lvl, total }); }
  put('week', week); saveDay();
  const mins = Math.max(1, Math.round(used / 60));
  modal(`<h2>${msg} :star:</h2><p>You played ${mins} min today and have :gem: ${total} cubes.<br>Your progress is saved, see you next time!</p><p>:chat: Tell a grown-up what you did today</p>`,
    [[':home: Home', showTitle]]);
  playing = false;
}

function grownUp(then, back, note = '') {
  const a = 6 + pick([0, 1, 2, 3, 4, 5, 6]), b = 3 + pick([0, 1, 2, 3, 4, 5, 6]);
  modal(`<h2>For grown-ups</h2>${note}<p>What is ${a} × ${b}?</p><input id="gate" type="number" inputmode="numeric">`, [
    ['OK', () => (+$('gate').value === a * b ? then() : grownUp(then, back, '<p>Not quite, try again!</p>'))],
    ['Cancel', back, 'ghost'],
  ]);
  $('gate').focus();
}

function settingsCard() {
  let html = `<h2>:gear: Grown-up settings</h2><p>Played this week: ${Math.round(week.used / 60)} of ${S.week} min</p>`;
  for (const [head, fields] of FORM) {
    html += `<h3>${head}</h3>`;
    for (const [k, label] of Object.entries(fields))
      html += typeof DEFAULTS[k] === 'number'
        ? `<label class="row">${icons(label)}<input type="number" min="0" step="any" id="s_${k}" value="${S[k]}"></label>`
        : `<label class="row"><input type="checkbox" id="s_${k}" ${S[k] ? 'checked' : ''}>${icons(label)}</label>`;
  }
  modal(html, [
    ['Save', () => {
      for (const k in DEFAULTS) S[k] = typeof DEFAULTS[k] === 'number' ? Math.max(0, +$('s_' + k).value || 0) : $('s_' + k).checked;
      put('settings', S); showTitle();
    }],
    ["Reset this week's time", () => { week.used = 0; put('week', week); day = {}; put('day', day); settingsCard(); }, 'ghost'],
    ['Cancel', showTitle, 'ghost'],
  ]);
}

function showTitle() {
  closeModal(); playing = false; checkWeek();
  Object.assign(fx, { inverted: false, betray: false, musicRate: 1, offKey: false });
  cv.style.filter = lastFilter = '';
  $('hud').classList.add('hidden'); $('pad').classList.add('hidden'); $('title').classList.remove('hidden');
  const wl = Math.max(0, Math.min(S.week * 60 - week.used, dayLeft())), save = get('save', null);
  $('weekInfo').innerHTML = icons( wl > 0 ? `Play time left today: ${Math.ceil(wl / 60)} min`
    : dayLeft() <= 0 ? "Today's play time is used up. See you tomorrow! :moon:" : "This week's play time is used up. It comes back on Monday! :moon:");
  $('continue').classList.toggle('hidden', !save || wl <= 0);
  $('newGame').classList.toggle('hidden', wl <= 0);
  $('resetWeek').classList.toggle('hidden', wl > 0);
}

function calm(done, back) {
  card(`<h2>:breathe: Hold the phone still<br>and breathe slowly</h2><div class="breathe"></div><p id="breath"></p><i class="bar"><b id="prog"></b></i>`, done, back);
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
  card(`<h2>:walk: Walk ${S.steps} steps</h2><p class="big" id="count">0</p><p>Hold the phone and walk around the room</p><i class="bar"><b id="prog"></b></i>`, done, back);
  activityTick = () => {
    const n = steps - start;
    $('count').textContent = `${n} / ${S.steps}`;
    progress(n / S.steps);
    if (n >= S.steps) { activityTick = null; done(); }
  };
}

function rest(done, back) {
  card(`<h2>:phone: Put the phone face down</h2><p id="msg">Leave it there for ${S.restSecs} seconds and do something else.<br>If you pick it up, the time starts again!</p><i class="bar"><b id="prog"></b></i>`, done, back);
  let n = 0, down = false;
  activityTick = () => {
    const now = keys.KeyF || Math.abs(beta) > (down ? FACE_UP : FACE_DOWN);
    if (now && !down) sfx(523, 0.15);
    if (!now && down && n) { n = 0; sfx(196, 0.3, 'sawtooth'); $('msg').textContent = 'You picked it up! Put it back face down, the time starts again'; }
    down = now;
    if (down) n++;
    progress(n / (S.restSecs * 60));
    if (n >= S.restSecs * 60) { activityTick = null; sfx(784, 0.1); sfx(1047, 0.3); done(); }
  };
}

function hum(done, back) {
  const id = card(`<h2>:hum: Hum your favorite song</h2><p id="msg">Keep humming until the bar is full</p><i class="bar"><b id="prog"></b></i>`, done, back);
  navigator.mediaDevices?.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    .then(s => {
      if (id !== cardId) return s.getTracks().forEach(k => k.stop());
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

function photo(done, back) {
  const names = Object.keys(COLORS).filter(c => S[c]), name = pick(names.length ? names : Object.keys(COLORS));
  const [hue, hex] = COLORS[name];
  const id = modal(`<h2>:camera: Find something <b style="color:${hex}">${name.toUpperCase()}</b></h2><div class="cam"><video playsinline muted autoplay></video></div><p id="msg">Fill the square with it and press SNAP</p>`, [
    [':camera: SNAP', snap], [':back: Back', back, 'ghost'], ['Skip (PC test)', done, 'ghost pc'],
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

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, d / (1 - Math.abs(2 * l - 1)), l];
}

const devFx = {};
function devCard() {
  const end = S.session * 60 + extra, clock = s => () => { used = s; closeModal(); };
  const toggle = (k, label) => [(devFx[k] ? ':check: ' : '') + label, () => { devFx[k] = !devFx[k]; devCard(); }, devFx[k] ? '' : 'ghost'];
  const angryShake = () => { closeModal(); invertUntil = t + 30 * 60; toast('Shaking scrambled the controls!\nTap :breathe: to calm down'); };
  const lockWeek = () => { week.used = S.week * 60; put('week', week); endSession('This week is used up'); };
  modal(`<h2>:dev: Dev mode</h2><p>Jump the clock: the real sequence plays<br>(it follows the grown-up settings)</p>`, [
    [':coffee: Break', () => { closeModal(); breakTime(); }],
    [':hourglass: Wind down', clock(end - S.warn * 60 + 1)],
    [":clock: Time's up", () => { timeUp = false; clock(end)(); }],
    ...[0, 2, 4, 6].map(m => [`${S.streak + m} min no break`, () => { sinceBreak = (S.streak + m) * 60 + 0.5; closeModal(); }]),
    [':reset: Reset clock', () => { used = extra = sinceBreak = snoozes = finishBy = invertUntil = 0; warned = timeUp = streakWarned = false; for (const k in devFx) devFx[k] = false; closeModal(); }],
  ]);
  $('modal').querySelector('.btns').insertAdjacentHTML('afterend', '<p>Or switch one effect on by itself:</p><div class="btns" id="devToggles"></div>');
  for (const [label, fn, cls] of [
    toggle('gray', ':gray: Gray'), toggle('negative', ':negative: Negative'), toggle('music', ':slow: Music slow/off-key'),
    toggle('invert', ':swap: Swap controls'), toggle('betray', ':blind: Ignore jumps'),
    [':angry: Angry shake', angryShake, 'ghost'],
    [':lock: Use up the week', lockWeek, 'ghost'], [':close: Close', closeModal],
  ]) {
    const b = document.createElement('button');
    b.innerHTML = icons(label); b.className = cls || ''; onPress(b, fn);
    $('devToggles').append(b);
  }
}

onPress($('continue'), () => { unlock(); const s = get('save', { lvl: 0, total: 0 }); startSession(s.lvl, s.total); });
onPress($('newGame'), () => { unlock(); startSession(0, 0); });
onPress($('parents'), () => grownUp(settingsCard, showTitle));
onPress($('resetWeek'), () => {
  const reset = () => { week.used = 0; put('week', week); day = {}; put('day', day); showTitle(); };
  S.dev ? reset() : grownUp(reset, showTitle);
});
onPress($('pause'), () => modal('<h2>:pause: Paused</h2>', [[':play: Resume', closeModal], [':flag: Stop playing', () => endSession()]]));
onPress($('devBtn'), devCard);
onPress($('calmBtn'), () => calm(() => { invertUntil = 0; success('Controls are back to normal :smile:'); }, closeModal));
showTitle();
