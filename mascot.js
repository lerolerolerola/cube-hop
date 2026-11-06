// Mascot version (parallel to the base game): open with ?mascot or :gear: Grown-ups → Mascot.
// Pip is a guide: it gets hungry while you play, break activities feed it, stopping on time feeds it,
// playing into overtime makes it hungry. It never gets hungry while the game is closed (no pull-back).
// Wraps session.js functions instead of editing them, so the base game is unchanged when the mascot is off.
const PET = 'Pip', FULL = 5;
DEFAULTS.mascot = false;
FORM.splice(FORM.length - 1, 0, ['form.mascot', ['mascot']]);
if (/[?&]mascot\b/.test(location.search)) S.mascot = true;

let pet = { food: 3, ...get('pet', {}) }, step = -1;
const mood = () => t < invertUntil ? 'scared' : pet.food >= 4 ? 'happy' : pet.food >= 2 ? 'ok' : 'sad';

// Pip in pixels: k outline, y head, g body, l leaf. Faces are drawn on top per mood.
const PIP = [
  '.kkk......kkk.',
  'kyyyk....kyyyk',
  'kyyykkkkkkyyyk',
  '.kyyyyyyyyyyk.',
  'kyyyyyyyyyyyyk',
  'kyyyyyyyyyyyyk',
  'kyyyyyyyyyyyyk',
  'kyyyyyyyyyyyyk',
  'kyyyyyyyyyyyyk',
  '.kyyyyyyyyyyk.',
  '..kkkkkkkkkk..',
  '..kggggggggk..',
  '.kgggggglgggk.',
  '.kggggglllggk.',
  '..kkkkkkkkkk..',
];
const FACES = { // [x, y, color]
  happy: [[4, 5], [4, 6], [9, 5], [9, 6], [5, 7], [6, 8], [7, 8], [8, 7], [2, 7, 'p'], [11, 7, 'p']],
  ok: [[4, 5], [4, 6], [9, 5], [9, 6], [6, 8], [7, 8]],
  sad: [[4, 6], [9, 6], [3, 4], [10, 4], [5, 8], [6, 7], [7, 7], [8, 8]],
  sleep: [[3, 6], [4, 6], [9, 6], [10, 6], [6, 8], [7, 8]],
  scared: [[3, 5, 'w'], [4, 5, 'w'], [3, 6, 'w'], [4, 6], [9, 5, 'w'], [10, 5, 'w'], [9, 6], [10, 6, 'w'], [6, 7], [7, 7], [6, 8], [7, 8]],
};
function petSVG(m = mood(), size = 64) {
  const col = { k: '#1f3b2d', y: m === 'sad' ? '#e3d39c' : '#f5c451', g: '#1f6b4a', l: '#e8f5ec', p: '#f4978e', w: '#fff' };
  let px = '';
  PIP.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') px += `<rect x="${x}" y="${y}" width="1" height="1" fill="${col[c]}"/>`; }));
  for (const [x, y, c = 'k'] of FACES[m]) px += `<rect x="${x}" y="${y}" width="1" height="1" fill="${col[c]}"/>`;
  return `<svg class="petsvg" width="${size}" height="${size * 15 / 14}" viewBox="0 0 14 15" shape-rendering="crispEdges" aria-hidden="true">${px}</svg>`;
}

function petHud() {
  const on = !!S.mascot;
  $('pet').classList.toggle('hidden', !on || !playing);
  $('petTitle').classList.toggle('hidden', !on);
  if (!on) return;
  const food = '<span class="food">' + ic('full').repeat(pet.food) + '<i>' + ic('heart').repeat(FULL - pet.food) + '</i></span>';
  $('pet').innerHTML = petSVG(mood(), 34) + food;
  $('petTitle').innerHTML = petSVG(pet.food >= 2 ? 'happy' : 'sad', 80) + `<p>${PET} ${food}</p>`;
}

function feed(n) { pet.food = Math.max(0, Math.min(FULL, pet.food + n)); put('pet', pet); petHud(); }

// Puts Pip with a speech bubble at the top of the open card.
function say(line, m = mood()) {
  $('modal').querySelector('.card')?.insertAdjacentHTML('afterbegin', `<div class="pet-say">${petSVG(m)}<p class="bubble">${icons(line)}</p></div>`);
}

const wrap = (name, fn) => { const orig = window[name]; window[name] = (...a) => S.mascot ? fn(orig, ...a) : orig(...a); };

// Activities: done = feed, back = no food (but no scolding either).
const showBreak = line => { _breakTime(); say(line); };
const _breakTime = breakTime;
// Activities are framed as things you do with Pip: button 'pip.act.<name>', card title 'pip.<name>'.
ACTS.forEach(a => {
  const [k, label, f] = a;
  Object.defineProperty(a, 1, { get: () => S.mascot ? 'pip.act.' + k : label });
  a[2] = (done, back) => {
    if (!S.mascot) return f(done, back);
    f(() => {
      done(); feed(2);
      say(tr(pet.food >= FULL ? 'pip.full' : 'pip.thanks'), 'happy');
    }, () => showBreak(tr('pip.stillHungry')));
    const h2 = $('modal').querySelector('h2');
    h2.innerHTML = icons(tr('pip.' + k, { color: h2.querySelector('b')?.outerHTML, steps: S.steps }));
  };
});

wrap('breakTime', () => {
  if (!ACTS.some(([k]) => S[k])) return;
  if (!snoozes) feed(-1); // only when the break is due, not each time it comes back after 'Not now'
  showBreak(tr(snoozes ? 'pip.waiting' : 'pip.hungry'));
});

wrap('calm', (orig, done, back) => orig(() => { done(); feed(1); say(tr('pip.calmToo'), 'happy'); }, back));

wrap('timesUp', orig => { orig(); say(tr('pip.sleepy'), 'sleep'); });

wrap('endSession', (orig, msg, saved) => {
  const late = lateEnd;
  orig(msg, saved);
  if (!late) feed(1);
  say(tr(late ? 'pip.lateSleep' : 'pip.onTime'), 'sleep');
});

wrap('onTick', orig => {
  orig();
  // Each friction step (no break for too long) makes Pip a bit hungrier.
  const over = noBreak(), now = over < 0 ? -1 : Math.min(3, Math.floor(over / STEP));
  if (now > step) feed(-1);
  step = now;
  if (t % 30 === 0) petHud();
});

wrap('startSession', (orig, ...a) => { step = -1; orig(...a); petHud(); });
// Choice on the title screen; remembered with the other settings.
const choose = on => { S.mascot = on; put('settings', S); showTitle(); };
onPress($('withPip'), () => choose(true));
onPress($('noPip'), () => choose(false));

const _showTitle = showTitle;
window.showTitle = () => {
  _showTitle(); petHud();
  $('withPip').className = S.mascot ? '' : 'ghost';
  $('withPip').innerHTML = petSVG('happy', 18) + ' ' + tr('title.withPip');
  $('noPip').className = S.mascot ? 'ghost' : '';
};
showTitle();
