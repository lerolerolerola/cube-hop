// node lang.test.js — checks the CSV reader/writer and that every text key the game uses is in languages.csv.
const fs = require('fs'), assert = require('assert');
const { readLangs } = new Function(fs.readFileSync(__dirname + '/lang.js', 'utf8') + ';return { readLangs };')();

// Quotes, commas, semicolons, line breaks and empty cells work; Excel-PT ';' files work.
assert.deepStrictEqual(readLangs('key,en,fr\r\na,"Hi, ""you""; ok",\r\nb,"Two\nlines","Deux\nlignes"\r\n'),
  { en: { a: 'Hi, "you"; ok', b: 'Two\nlines' }, fr: { b: 'Deux\nlignes' } });
assert.deepStrictEqual(readLangs('﻿key;en;pt\r\nx;Yes;Sim\r\n'), { en: { x: 'Yes' }, pt: { x: 'Sim' } });
assert.throws(() => readLangs('id,en\nx,y'));

const L = readLangs(fs.readFileSync(__dirname + '/languages.csv', 'utf8'));
const code = ['index.html', 'game.js', 'session.js', 'mascot.js'].map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n');
const used = new Set([...code.matchAll(/(?:tr|txt|endSession)\('([\w.]*\w)'|data-t(?:-label|-title)?="([\w.]+)"|'((?:act|form|end)\.\w+)'/g)].map(m => m[1] || m[2] || m[3]));
// Keys the game builds from names: settings labels, Pip's activity texts, colors, levels.
const names = s => [...s.matchAll(/'(\w+)'/g)].map(m => m[1]);
for (const f of names(code.match(/const FORM = \[([\s\S]*?)\n\];/)[1]).filter(n => !n.startsWith('form'))) used.add((/^(red|orange|yellow|green|blue|purple)$/.test(f) ? 'color.' : 'set.') + f);
for (const a of ['photo', 'walk', 'calm', 'hum', 'rest']) used.add('pip.' + a).add('pip.act.' + a);
for (const i of [1, 2, 3, 4]) used.add(`level${i}.name`).add(`level${i}.hint`);
used.add('set.mascot');
const missing = [...used].filter(k => !L.en[k] || !L.pt[k]);
assert.deepStrictEqual(missing, [], 'missing in languages.csv');
for (const k in L.en) assert.ok(L.pt[k], 'no pt text for ' + k);
console.log(`ok (${used.size} keys used, ${Object.keys(L.en).length} in languages.csv)`);
