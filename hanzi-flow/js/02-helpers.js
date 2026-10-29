/*
 * Hanzi Flow — 02-helpers.js
 * Small utilities: the h() DOM builder, shuffling, date keys, icons, and all pinyin logic
 * (tone marks, tone-number input parsing, answer checking, tone-variant distractors).
 */
'use strict';

// ======== helpers ========
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const todayKey = (d = new Date()) =>
  d.getFullYear() +
  '-' +
  String(d.getMonth() + 1).padStart(2, '0') +
  '-' +
  String(d.getDate()).padStart(2, '0');
const dayShift = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return todayKey(d);
};
const fuzz = (ms) => ms * (0.92 + Math.random() * 0.16);
const ICON = {
  speaker:
    '<svg class="i" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  close: '<svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg class="i" viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
  flame:
    '<svg class="i" viewBox="0 0 24 24"><path d="M12 22c4.4 0 7-2.8 7-7 0-3-2-5.5-3.5-7-.5 2-1.5 3-2.5 3.5 0-3-1.5-6-4-8 .5 3-1 4.5-2.5 6.5S5 13 5 15c0 4.2 2.6 7 7 7z"/></svg>',
  back: '<svg class="i" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  play: '<svg class="i" viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg>',
};
function fmtDue(ms) {
  const d = ms - Date.now();
  if (d <= 0) return 'now';
  if (d < MIN * 60) return Math.max(1, Math.round(d / MIN)) + ' min';
  if (d < DAY) return Math.round(d / 3600000) + ' h';
  return Math.round(d / DAY) + ' d';
}
function posText(w) {
  return w.pos
    .split(',')
    .filter(Boolean)
    .map((p) => POS[p] || p)
    .slice(0, 2)
    .join(', ');
}

// ======== pinyin ========
const MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
const TONED = {};
for (const [v, s] of Object.entries(MARKS)) [...s].forEach((c, i) => (TONED[c] = { v, t: i + 1 }));
function markIndex(b) {
  if (b.includes('a')) return b.indexOf('a');
  if (b.includes('e')) return b.indexOf('e');
  if (b.includes('ou')) return b.indexOf('o');
  for (let i = b.length - 1; i >= 0; i--) if ('aeiouü'.includes(b[i])) return i;
  return -1;
}
function mark(b, t) {
  if (!t || t === 5) return b;
  const i = markIndex(b);
  if (i < 0) return b;
  return b.slice(0, i) + MARKS[b[i]][t - 1] + b.slice(i + 1);
}
function pyEl(y, cls) {
  return h(
    'span',
    { class: 'py ' + (cls || '') },
    y.flatMap(([b, t], i) => [i ? ' ' : null, h('span', { class: 't' + t }, mark(b, t))]),
  );
}
function pyText(y) {
  return y.map(([b, t]) => mark(b, t)).join(' ');
}
function normPinyinInput(str) {
  let s = str
    .toLowerCase()
    .trim()
    .replace(/u:/g, 'ü')
    .replace(/v/g, 'ü')
    .replace(/[\s'’\-·.,，。]/g, '');
  let out = '';
  for (const ch of s) {
    const m = TONED[ch];
    out += m ? m.v + m.t : ch;
  }
  return out;
}
function pinyinUnits(y) {
  const u = [];
  for (const [b, t] of y) {
    if (b === 'r' && u.length) {
      u[u.length - 1] = [u[u.length - 1][0] + 'r', u[u.length - 1][1]];
      continue;
    }
    u.push([b, t]);
  }
  return u;
}
function numericText(y) {
  return pinyinUnits(y)
    .map(([b, t]) => b + (t === 5 ? '' : t))
    .join(' ');
}
function checkPinyin(input, y) {
  const s = normPinyinInput(input);
  const units = pinyinUnits(y);
  let p = 0;
  const tones = [];
  for (const [b, t] of units) {
    let tone = 0,
      got = 0;
    for (const ch of b) {
      if (s[p] >= '1' && s[p] <= '5') {
        if (!got) return 'wrong';
        tone = +s[p];
        p++;
      }
      if (s[p] !== ch) return 'wrong';
      p++;
      got++;
    }
    if (s[p] >= '1' && s[p] <= '5') {
      tone = +s[p];
      p++;
    }
    tones.push([tone, t]);
  }
  if (p !== s.length) return 'wrong';
  let missing = 0,
    bad = 0,
    need = 0;
  for (const [g, t] of tones) {
    if (t === 5) {
      if (g && g !== 5) bad++;
    } else {
      need++;
      if (!g) missing++;
      else if (g !== t) bad++;
    }
  }
  if (bad) return 'tones';
  if (missing && missing === need) return 'toneless';
  if (missing) return 'tones';
  return 'good';
}
function toneVariants(w, n) {
  const key = (s) => s.map((x) => x[1]).join('');
  const out = new Map();
  const orig = key(w.y);
  let g = 0;
  const tonal = w.y.map((x, i) => (x[1] !== 5 ? i : -1)).filter((i) => i >= 0);
  const idxPool = tonal.length ? tonal : w.y.map((_, i) => i);
  while (out.size < n && g++ < 300) {
    const y = w.y.map(([b, t]) => [b, t]);
    const k = Math.random() < 0.6 || idxPool.length < 2 ? 1 : 2;
    for (const i of shuffle(idxPool).slice(0, k)) {
      let t;
      do {
        t = 1 + Math.floor(Math.random() * 4);
      } while (t === y[i][1]);
      y[i][1] = t;
    }
    const kk = key(y);
    if (kk !== orig) out.set(kk, y);
  }
  return [...out.values()];
}
function toneSVG(t) {
  if (t === 5)
    return '<svg class="tone-svg" viewBox="0 0 40 32" aria-hidden="true"><circle cx="20" cy="17" r="3.5" fill="currentColor"/></svg>';
  const p = { 1: 'M5 7H35', 2: 'M6 24L34 7', 3: 'M5 11C11 31 21 31 35 8', 4: 'M6 6L34 26' }[t];
  return (
    '<svg class="tone-svg" viewBox="0 0 40 32" aria-hidden="true"><path d="' +
    p +
    '" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>'
  );
}
