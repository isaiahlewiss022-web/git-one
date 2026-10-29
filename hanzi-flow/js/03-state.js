/*
 * Hanzi Flow — 03-state.js
 * App state and persistence. Progress lives in localStorage (hanziflow.v1) and, when the
 * page runs inside claude.ai, is also mirrored to a private per-user cloud store.
 * mergeStats() reconciles two copies of the stats; resets and per-word resets leave
 * tombstones so another device cannot resurrect them.
 */
'use strict';

// ======== state ========
const DEFAULTS = {
  newPerDay: 6,
  sessionSize: 20,
  levels: [1],
  audio: true,
  autoplay: true,
  sfx: true,
  rate: 0.85,
  voice: '',
  strictTones: false,
  trad: false,
  matchPairs: 6,
  matchSide: 'pinyin',
  matchTimer: true,
  suddenDeath: false,
  matchLevels: [1],
  matchSource: 'studied',
  matchBoards: 5,
  matchHear: true,
  tutorialSeen: false,
};
const state = {
  items: {},
  stats: {
    xp: 0,
    streak: 0,
    lastDay: '',
    best: {},
    days: {},
    reviews: 0,
    correct: 0,
    settingsAt: 0,
  },
  settings: Object.assign({}, DEFAULTS),
  ui: { screen: 'home' },
};
const LS_KEY = 'hanziflow.v1',
  LS_SESS = 'hanziflow.session';
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      Object.assign(state.items, o.items || {});
      Object.assign(state.stats, o.stats || {});
      Object.assign(state.settings, o.settings || {});
    }
  } catch (e) {}
  normalizeSettings();
}
function normalizeSettings() {
  const S = state.settings;
  const ok = (a) => Array.isArray(a) && a.length && a.every((l) => LEVELS.includes(l));
  if (!ok(S.levels)) S.levels = [1];
  if (!ok(S.matchLevels)) S.matchLevels = S.levels.slice();
  for (const k of Object.keys(DEFAULTS)) if (typeof S[k] !== typeof DEFAULTS[k]) S[k] = DEFAULTS[k];
}
let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(flushLocal, 200);
}
function flushLocal() {
  clearTimeout(saveT);
  saveT = null;
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ v: 1, items: state.items, stats: state.stats, settings: state.settings }),
    );
  } catch (e) {}
  cloud.scheduleWrite();
}
function setSetting(k, v) {
  state.settings[k] = v;
  state.stats.settingsAt = Date.now();
  cloud.dirty.add('meta');
  save();
}
function dayRec(k = todayKey()) {
  const d = state.stats.days;
  if (!d[k]) d[k] = { n: 0, r: 0, c: 0, x: 0 };
  return d[k];
}
function addXP(n) {
  state.stats.xp += n;
  dayRec().x += n;
  cloud.dirty.add('meta');
}
function touchStreak() {
  const t = todayKey();
  const s = state.stats;
  if (s.lastDay === t) return;
  s.streak = s.lastDay === dayShift(-1) ? s.streak + 1 : 1;
  s.lastDay = t;
  cloud.dirty.add('meta');
}
function rankFor(xp) {
  let r = RANKS[0],
    next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i][0]) {
      r = RANKS[i];
      next = RANKS[i + 1] || null;
    }
  }
  return { r, next };
}

// ======== cloud sync (optional, claude.ai viewer only) ========
const cloud = {
  db: null,
  uid: null,
  ready: false,
  dirty: new Set(),
  writing: false,
  timer: null,
  async init() {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      this.db = db;
      this.uid = uid;
      await this.pull();
      this.ready = true;
      if (this.dirty.size) this.scheduleWrite();
    } catch (e) {
      console.warn('sync unavailable', e);
    }
  },
  doc(name) {
    return this.db.doc('data/users/' + this.uid + '/' + name);
  },
  async pull() {
    const names = ['meta', ...SHARDS];
    const snaps = await Promise.all(names.map((n) => this.doc(n).get()));
    let changed = false;
    const meta = snaps[0].exists ? snaps[0].data() : null;
    if (meta) {
      changed = mergeStats(meta) || changed;
    } else this.dirty.add('meta');
    const resetAt = state.stats.resetAt || 0,
      tomb = state.stats.tomb || {};
    SHARDS.forEach((name, i) => {
      const snap = snaps[i + 1];
      const remote = snap.exists ? snap.data().items || {} : {};
      const local = {};
      for (const [k, v] of Object.entries(state.items)) {
        const w = BY.get(k);
        if (w && shardOf(w) === name) local[k] = v;
      }
      let localNewer = false;
      for (const [k, v] of Object.entries(remote)) {
        if (!BY.has(k) || !v || typeof v !== 'object') continue;
        if ((v.n || 0) < resetAt || (tomb[k] || 0) >= (v.n || 0)) {
          localNewer = true;
          continue;
        }
        const cur = state.items[k];
        if (!cur || (v.n || 0) > (cur.n || 0)) {
          state.items[k] = v;
          changed = true;
        } else if ((cur.n || 0) > (v.n || 0)) localNewer = true;
      }
      for (const k of Object.keys(local)) if (!remote[k]) localNewer = true;
      if (localNewer) this.dirty.add(name);
    });
    if (changed) {
      save();
      softRender();
    }
  },
  payload(name) {
    if (name === 'meta') return { stats: state.stats, settings: state.settings, v: 1 };
    const items = {};
    for (const [k, v] of Object.entries(state.items)) {
      const w = BY.get(k);
      if (w && shardOf(w) === name) items[k] = slim(v);
    }
    return { items, v: 1 };
  },
  scheduleWrite() {
    if (!this.ready) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 1500);
  },
  async flush() {
    if (this.writing || !this.ready) return;
    this.writing = true;
    try {
      while (this.dirty.size) {
        const name = this.dirty.values().next().value;
        this.dirty.delete(name);
        await this.doc(name).set(this.payload(name));
      }
    } catch (e) {
      console.warn('sync write failed', e);
    } finally {
      this.writing = false;
      if (this.dirty.size) this.scheduleWrite();
    }
  },
};
function prevDay(k) {
  const [y, m, d] = k.split('-').map(Number);
  return todayKey(new Date(y, m - 1, d - 1));
}
function mergeStats(meta) {
  let changed = false;
  const r = meta.stats || {};
  const s = state.stats;
  if ((r.resetAt || 0) > (s.resetAt || 0)) {
    s.resetAt = r.resetAt;
    for (const k of Object.keys(state.items))
      if ((state.items[k].n || 0) < s.resetAt) delete state.items[k];
    changed = true;
  }
  if (r.tomb && typeof r.tomb === 'object') {
    s.tomb = s.tomb || {};
    for (const [k, tm] of Object.entries(r.tomb)) {
      if ((tm || 0) > (s.tomb[k] || 0)) {
        s.tomb[k] = tm;
        changed = true;
      }
      const cur = state.items[k];
      if (cur && (cur.n || 0) <= (tm || 0)) {
        delete state.items[k];
        changed = true;
      }
    }
  }
  if ((r.xp || 0) > s.xp) {
    s.xp = r.xp;
    changed = true;
  }
  if ((r.reviews || 0) > s.reviews) {
    s.reviews = r.reviews;
    changed = true;
  }
  if ((r.correct || 0) > s.correct) {
    s.correct = r.correct;
    changed = true;
  }
  const rl = r.lastDay || '',
    sl = s.lastDay || '',
    rs = r.streak || 0;
  if (rl && sl && rl === prevDay(sl)) {
    if (rs + 1 > s.streak) {
      s.streak = rs + 1;
      changed = true;
    }
  } else if (rl && sl && sl === prevDay(rl)) {
    s.streak = Math.max(rs, s.streak + 1);
    s.lastDay = rl;
    changed = true;
  } else if (rl > sl || (rl === sl && rs > s.streak)) {
    s.streak = rs;
    s.lastDay = rl;
    changed = true;
  }
  for (const [k, v] of Object.entries(r.best || {}))
    if ((v || 0) > (s.best[k] || 0)) {
      s.best[k] = v;
      changed = true;
    }
  for (const [k, v] of Object.entries(r.days || {})) {
    if (!v || typeof v !== 'object') continue;
    const d = s.days[k] || (s.days[k] = { n: 0, r: 0, c: 0, x: 0 });
    for (const f of ['n', 'r', 'c', 'x'])
      if ((v[f] || 0) > d[f]) {
        d[f] = v[f];
        changed = true;
      }
  }
  if (
    meta.settings &&
    typeof meta.settings === 'object' &&
    (r.settingsAt || 0) > (s.settingsAt || 0)
  ) {
    Object.assign(state.settings, meta.settings);
    s.settingsAt = r.settingsAt;
    normalizeSettings();
    changed = true;
  }
  return changed;
}
function softRender() {
  if (session || !['home', 'words', 'me'].includes(state.ui.screen)) renderChips();
  else render();
}
