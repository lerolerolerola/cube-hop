// All game text lives in languages.csv: one row per key, one column per language (key,en,pt,…).
// Edit it in Excel / Google Sheets (save as CSV UTF-8); add a column to add a language. In a cell: {name} is
// filled in by the game, :icon: is a pixel icon, a line break is a line break. Empty cells fall back to English.
// The game uses the phone's language if the file has it, else English. Add ?lang=pt to the URL to force one.

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const head = text.split('\n')[0], sep = head.includes(';') && !head.includes(',') ? ';' : ','; // Excel in PT saves with ;
  const rows = [[]];
  let cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    }
    else if (c === '"') quoted = true;
    else if (c === sep) { rows.at(-1).push(cell); cell = ''; }
    else if (c === '\n') { rows.at(-1).push(cell); cell = ''; rows.push([]); }
    else if (c !== '\r') cell += c;
  }
  rows.at(-1).push(cell);
  return rows.filter(r => r.some(c => c.trim()));
}

// CSV text → { en: { key: text }, pt: { … } }
function readLangs(text) {
  const [head, ...rows] = parseCSV(text), langs = {};
  if (head?.[0].trim() !== 'key') throw new Error('the first column must be "key"');
  const codes = head.map(c => c.trim());
  codes.forEach((c, i) => { if (i && c) langs[c] = {}; });
  for (const r of rows) {
    const k = r[0].trim();
    if (k) codes.forEach((c, i) => { if (i && c && r[i]) langs[c][k] = r[i]; });
  }
  return langs;
}

// ponytail: synchronous load so every script after this can call tr() right away; fine for a ~15 KB file.
function fileText() {
  const x = new XMLHttpRequest();
  x.open('GET', 'languages.csv' + new URL(document.currentScript.src).search, false);
  x.send();
  return x.responseText;
}

let L = {};
if (globalThis.document) try { L = readLangs(fileText()); } catch (e) { console.warn('languages.csv:', e.message); }

const wanted = [new URLSearchParams(globalThis.location?.search).get('lang'), (globalThis.navigator?.language || '').slice(0, 2)];
const LANG = wanted.find(c => L[c]) || 'en';

// Plain text (attributes, textContent). Missing text falls back to English, then to the key itself.
const txt = (key, vars = {}) => (L[LANG]?.[key] || L.en?.[key] || key).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
// For innerHTML: the text can't add tags, line breaks become <br>; vars go in as-is (the game builds them).
const tr = (key, vars = {}) => txt(key).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
  .replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

function applyText() {
  document.documentElement.lang = LANG;
  for (const e of document.querySelectorAll('[data-t]')) e.innerHTML = icons(tr(e.dataset.t));
  for (const e of document.querySelectorAll('[data-t-label]')) e.setAttribute('aria-label', txt(e.dataset.tLabel));
  for (const e of document.querySelectorAll('[data-t-title]')) e.title = txt(e.dataset.tTitle);
}
