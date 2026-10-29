/*
 * Hanzi Flow — 06-ui.js
 * Screen switching, tab bar, header chips, toasts, and shared widgets (level chips,
 * switches, speak buttons, stage pills, sentence cards).
 */
'use strict';

// ======== UI plumbing ========
const screenEl = $('#screen');
let cleanups = [],
  cardCleanups = [];
function onLeave(fn) {
  cleanups.push(fn);
}
function onCardLeave(fn) {
  cardCleanups.push(fn);
}
function runCardCleanups() {
  for (const f of cardCleanups) {
    try {
      f();
    } catch (e) {}
  }
  cardCleanups = [];
}
function clearScreen() {
  runCardCleanups();
  for (const f of cleanups) {
    try {
      f();
    } catch (e) {}
  }
  cleanups = [];
  screenEl.innerHTML = '';
  window.scrollTo(0, 0);
}
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
const TABS = [
  ['home', '今', 'Today'],
  ['play', '玩', 'Play'],
  ['words', '词', 'Words'],
  ['me', '我', 'Me'],
];
function renderTabs() {
  const el = $('#tabs');
  el.innerHTML = '';
  for (const [id, zi, label] of TABS)
    el.append(
      h(
        'button',
        {
          class:
            'tab' +
            (state.ui.screen === id || (state.ui.screen === 'flow' && id === 'home')
              ? ' active'
              : ''),
          onclick: () => go(id),
        },
        h('span', { class: 'zi' }, zi),
        label,
      ),
    );
}
function renderChips() {
  const el = $('#chips');
  el.innerHTML = '';
  const { r } = rankFor(state.stats.xp);
  el.append(
    h(
      'span',
      { class: 'chip', title: r[3] },
      h('span', { class: 'zi' }, r[1]),
      h('b', { class: 'tnum' }, state.stats.xp),
      ' xp',
    ),
  );
  if (
    state.stats.streak > 0 &&
    (state.stats.lastDay === todayKey() || state.stats.lastDay === dayShift(-1))
  )
    el.append(
      h('span', {
        class: 'chip',
        title: 'Day streak',
        html: ICON.flame + '<b>' + state.stats.streak + '</b>',
      }),
    );
}
const SCREENS = {};
function go(name, params) {
  state.ui.screen = name;
  state.ui.params = params || null;
  render();
}
function render() {
  clearScreen();
  renderTabs();
  renderChips();
  const fn = SCREENS[state.ui.screen] || SCREENS.home;
  fn(state.ui.params || {});
}
function levelChips(selected, onChange, { multi = true } = {}) {
  const wrap = h('div', { class: 'filters' });
  for (const l of LEVELS) {
    const b = h(
      'button',
      {
        class: 'fchip' + (selected.includes(l) ? ' active' : ''),
        onclick: () => {
          let next;
          if (multi) {
            next = selected.includes(l)
              ? selected.filter((x) => x !== l)
              : selected.concat(l).sort();
            if (!next.length) next = [l];
          } else next = [l];
          onChange(next);
        },
      },
      'HSK ' + l,
    );
    wrap.append(b);
  }
  return wrap;
}
function switchEl(on, onToggle) {
  const b = h('button', {
    class: 'switch' + (on ? ' on' : ''),
    role: 'switch',
    'aria-checked': on ? 'true' : 'false',
  });
  b.addEventListener('click', () => {
    on = !on;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    onToggle(on);
  });
  return b;
}
function speakBtn(text, cls) {
  return h('button', {
    class: 'iconbtn ' + (cls || ''),
    'aria-label': 'Hear it',
    title: 'Hear it',
    html: ICON.speaker,
    onclick: (e) => {
      e.stopPropagation();
      if (!audio.speak(text)) toast('No Chinese voice available on this device');
    },
  });
}
function stagePill(w) {
  const it = rec(w);
  const s = it ? it.s : 0;
  const col =
    s === 0
      ? 'var(--line)'
      : s <= 3
        ? 'var(--stage-1)'
        : s <= 6
          ? 'var(--stage-2)'
          : 'var(--stage-3)';
  return h('span', { class: 'stagepill' }, h('i', { style: 'background:' + col }), STAGES[s]);
}
function sentencesFor(w, n = 3) {
  const idx = SENT_BY.get(w.s) || [];
  return idx
    .slice()
    .sort((a, b) => SENT[a][3] - SENT[b][3] || SENT[a][0].length - SENT[b][0].length)
    .slice(0, n)
    .map((i) => SENT[i]);
}
function sentEl(s, hl) {
  const zh = h('div', { class: 'zh' });
  if (hl && s[0].includes(hl)) {
    const parts = s[0].split(hl);
    parts.forEach((p, i) => {
      if (i) zh.append(h('mark', null, hl));
      zh.append(p);
    });
  } else zh.textContent = s[0];
  return h(
    'div',
    {
      class: 'sent',
      title: 'Tap to hear',
      onclick: () => {
        if (!audio.speak(s[0], 0.9)) toast('No Chinese voice available on this device');
      },
    },
    zh,
    h('div', { class: 'pyl' }, s[1]),
    h('div', { class: 'en' }, s[2]),
  );
}
function wordLink(w) {
  return h(
    'button',
    { class: 'btn sm ghost', onclick: () => openSheet(w) },
    h('span', { class: 'hz' }, w.s),
    ' ',
    pyEl(w.y),
  );
}
