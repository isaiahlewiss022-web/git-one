/*
 * Hanzi Flow — 05-srs.js
 * The learning engine. Each word has a record {s: stage 0-7, e: ease, i: interval in days,
 * d: due timestamp, r: reviews, l: lapses, n: last touched, k: learning step}.
 * grade() moves a word up or down the ladder and schedules the next review (SM-2 style).
 * distractors() picks wrong answers that are plausible but never ambiguous.
 */
'use strict';

// ======== SRS ========
function rec(w) {
  return state.items[w.s];
}
function newRec(now) {
  return { s: 0, e: 2.5, i: 0, d: now, r: 0, l: 0, n: now, k: 0 };
}
function grade(w, outcome, perfect) {
  const now = Date.now();
  const it = state.items[w.s] || (state.items[w.s] = newRec(now));
  it.n = now;
  it.r++;
  const early = it.sd != null && it.i > 0;
  const sd = it.sd;
  delete it.sd;
  if (outcome === 'again') {
    it.l++;
    it.e = Math.max(1.3, it.e - 0.2);
    it.i = 0;
    it.k = 1;
    it.s = Math.max(1, it.s - 1);
    it.d = now + 10 * MIN;
  } else if (outcome === 'almost') {
    it.i = it.i ? Math.max(1, it.i * 0.5) : 0;
    it.k = Math.max(it.k || 0, 1);
    it.d = now + 10 * MIN;
  } else if (early) {
    it.d = Math.max(sd || 0, now + 30 * MIN);
  } else {
    if (it.i === 0) {
      if ((it.k || 0) < 1) {
        it.k = 1;
        it.d = now + 10 * MIN;
      } else {
        it.i = 1;
        it.k = 0;
        it.d = now + fuzz(DAY);
      }
    } else {
      it.i = it.i < 1.5 ? 3 : Math.min(180, it.i * it.e);
      if (perfect) it.e = Math.min(3, it.e + 0.05);
      it.d = now + fuzz(it.i * DAY);
    }
    it.s = Math.min(7, it.s + 1);
  }
  cloud.dirty.add(shardOf(w));
  state.stats.reviews++;
  if (outcome === 'good') state.stats.correct++;
  const d = dayRec();
  d.r++;
  if (outcome === 'good') d.c++;
  touchStreak();
  return it;
}
function introduce(w, known) {
  const now = Date.now();
  state.items[w.s] = known
    ? { s: 4, e: 2.5, i: 3, d: now + fuzz(3 * DAY), r: 1, l: 0, n: now, k: 0 }
    : { s: 1, e: 2.5, i: 0, d: now, r: 0, l: 0, n: now, k: 0 };
  dayRec().n++;
  cloud.dirty.add(shardOf(w));
  touchStreak();
  addXP(5);
}
function markKnown(w) {
  const now = Date.now();
  const it = state.items[w.s] || (state.items[w.s] = newRec(now));
  it.s = 7;
  it.i = 30;
  it.d = now + fuzz(30 * DAY);
  it.n = now;
  it.k = 0;
  cloud.dirty.add(shardOf(w));
  save();
}
function resetWord(w) {
  delete state.items[w.s];
  (state.stats.tomb = state.stats.tomb || {})[w.s] = Date.now();
  cloud.dirty.add(shardOf(w));
  cloud.dirty.add('meta');
  save();
}
function dueWords(now = Date.now()) {
  return W.filter((w) => {
    const it = state.items[w.s];
    return it && it.s > 0 && it.d <= now;
  }).sort((a, b) => state.items[a.s].d - state.items[b.s].d);
}
function newAllowance() {
  return Math.max(0, state.settings.newPerDay - (dayRec().n || 0));
}
function freshWords(n, levels) {
  const out = [];
  for (const l of LEVELS) {
    if (!levels.includes(l)) continue;
    for (const w of BY_LEVEL[l]) {
      if (out.length >= n) break;
      if (!state.items[w.s]) out.push(w);
    }
    if (out.length >= n) break;
  }
  return out;
}
function canWrite(w) {
  return w.s.length <= 3 && [...w.s].every((c) => CH[c] && CH[c][5] >= 1);
}
const strokeLoads = {};
function ensureStrokes(chars) {
  const lv = new Set();
  for (const c of chars) {
    const info = CH[c];
    if (info && info[5] >= 1) lv.add(info[5]);
  }
  return Promise.all(
    [...lv].map((l) => {
      if (window.CF_STROKES_LOADED && window.CF_STROKES_LOADED[l]) return;
      if (!strokeLoads[l])
        strokeLoads[l] = new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'data/strokes-' + l + '.js';
          s.onload = res;
          s.onerror = () => {
            delete strokeLoads[l];
            rej(new Error('strokes ' + l));
          };
          document.head.appendChild(s);
        });
      return strokeLoads[l];
    }),
  );
}
function hasStrokes(ch) {
  return !!(window.CF_STROKES && window.CF_STROKES[ch]);
}
function cssVar(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
}
function makeWriter(el, ch, opts) {
  if (!window.HanziWriter || !hasStrokes(ch)) return null;
  const size = opts.size || 240;
  return HanziWriter.create(
    el,
    ch,
    Object.assign(
      {
        width: size,
        height: size,
        padding: Math.round(size * 0.08),
        showOutline: !!opts.outline,
        showCharacter: !!opts.showCharacter,
        strokeColor: cssVar('--ink'),
        outlineColor: cssVar('--line'),
        drawingColor: cssVar('--accent'),
        highlightColor: cssVar('--good'),
        drawingWidth: Math.max(8, Math.round(size / 18)),
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 220,
        showHintAfterMisses: opts.hintAfter == null ? 2 : opts.hintAfter,
        highlightOnComplete: true,
        charDataLoader: (c, onLoad, onError) => {
          const d = window.CF_STROKES && window.CF_STROKES[c];
          d ? onLoad(d) : onError(new Error('no stroke data'));
        },
      },
      opts.extra || {},
    ),
  );
}

// ======== distractors ========
function distractors(w, n, kind, usedP) {
  const pool = BY_LEVEL[w.l].filter((x) => x !== w);
  let cands = [];
  if (kind === 'hanzi') {
    const bases = new Set(w.y.map((s) => s[0]));
    const tones = w.y.map((s) => s[1]).join('');
    const sim = pool.filter(
      (x) =>
        x.s.length === w.s.length &&
        (x.y.some((s) => bases.has(s[0])) || x.y.map((s) => s[1]).join('') === tones),
    );
    const shared = pool.filter((x) => [...x.s].some((c) => w.s.includes(c)));
    cands = shuffle(sim).concat(
      shuffle(shared),
      shuffle(pool.filter((x) => x.s.length === w.s.length)),
      shuffle(pool),
    );
  } else if (kind === 'meaning') {
    const pos = w.pos.split(',')[0];
    cands = shuffle(pool.filter((x) => pos && x.pos.split(',')[0] === pos)).concat(shuffle(pool));
  } else {
    cands = shuffle(pool.filter((x) => x.y.length === w.y.length)).concat(shuffle(pool));
  }
  const pk = (x) => x.y.map((s) => s[0] + s[1]).join(' ');
  const out = [],
    seen = new Set([w.s]),
    seenM = new Set([w.m[0]]),
    seenP = new Set([pk(w), ...(usedP || [])]);
  const take = (x) => {
    if (seen.has(x.s) || seenM.has(x.m[0]) || (kind !== 'meaning' && seenP.has(pk(x)))) return;
    seen.add(x.s);
    seenM.add(x.m[0]);
    seenP.add(pk(x));
    out.push(x);
  };
  for (const x of cands) {
    if (out.length >= n) break;
    take(x);
  }
  if (out.length < n)
    for (const x of shuffle(W)) {
      if (out.length >= n) break;
      take(x);
    }
  return out;
}
