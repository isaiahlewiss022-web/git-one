/*
 * Hanzi Flow — 07-home-flow.js
 * The Today screen and the Flow session: building the queue of due reviews and new words,
 * dealing cards (intro, multiple choice, typing, writing, match-board breaks), grading them,
 * and the end-of-session summary.
 */
'use strict';

// ======== HOME ========
SCREENS.home = function () {
  const S = state.settings;
  const due = dueWords();
  const allow = newAllowance();
  const learning = W.filter((w) => {
    const it = rec(w);
    return it && it.s > 0 && it.s < 7;
  }).length;
  const mastered = W.filter((w) => {
    const it = rec(w);
    return it && it.s >= 7;
  }).length;
  const { r, next } = rankFor(state.stats.xp);
  const pct = next ? Math.round((100 * (state.stats.xp - r[0])) / (next[0] - r[0])) : 100;
  const root = h('div', { class: 'stack fade-in' });
  root.append(
    h(
      'div',
      { class: 'card hero' },
      h(
        'div',
        { class: 'rank' },
        h('div', { class: 'zi' }, r[1]),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'label' }, 'Your rank'),
          h('h2', null, r[2], ' · ', r[3]),
          h(
            'div',
            { class: 'small muted' },
            next
              ? next[0] - state.stats.xp + ' xp to ' + next[1] + ' ' + next[2]
              : 'Highest rank reached',
          ),
        ),
      ),
      h('div', { class: 'bar' }, h('i', { style: 'width:' + pct + '%' })),
      h(
        'div',
        { class: 'row', style: 'gap:22px' },
        h('div', { class: 'stat' }, h('b', null, due.length), h('span', null, 'due now')),
        h('div', { class: 'stat' }, h('b', null, learning), h('span', null, 'learning')),
        h('div', { class: 'stat' }, h('b', null, mastered), h('span', null, 'mastered')),
        h(
          'div',
          { class: 'stat' },
          h('b', null, state.stats.streak),
          h('span', null, 'day streak'),
        ),
      ),
    ),
  );
  const resume = loadSession();
  if (resume) {
    root.append(
      h(
        'button',
        {
          class: 'bigcta',
          onclick: () => {
            session = resume;
            go('flow');
          },
        },
        h(
          'div',
          null,
          h('div', { class: 't' }, 'Resume session'),
          h('div', { class: 's' }, resume.queue.length + ' cards left'),
        ),
        h('span', { class: 'zi' }, '续'),
      ),
    );
  }
  const newN = freshWords(
    Math.min(
      allow,
      due.length > S.sessionSize
        ? 2
        : Math.max(0, S.sessionSize - Math.min(due.length, S.sessionSize)),
    ),
    S.levels,
  ).length;
  const canLearnMore = freshWords(1, S.levels).length > 0;
  if (due.length || newN) {
    root.append(
      h(
        'button',
        { class: 'bigcta', onclick: () => startSession({}) },
        h(
          'div',
          null,
          h('div', { class: 't' }, 'Start Flow session'),
          h(
            'div',
            { class: 's' },
            [
              due.length ? due.length + ' review' + (due.length === 1 ? '' : 's') : null,
              newN ? newN + ' new word' + (newN === 1 ? '' : 's') : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Quick review',
          ),
        ),
        h('span', { class: 'zi' }, '流'),
      ),
    );
  } else {
    root.append(
      h(
        'div',
        { class: 'card soft' },
        h('h3', null, 'All caught up'),
        h(
          'p',
          { class: 'muted', style: 'margin:6px 0 12px' },
          'Nothing is due right now. The next review lands in ',
          nextDueText(),
          '. Learn a few extra words, or play to keep the characters warm.',
        ),
        h(
          'div',
          { class: 'row' },
          canLearnMore
            ? h(
                'button',
                { class: 'btn primary', onclick: () => startSession({ extraNew: 5 }) },
                'Learn 5 more words',
              )
            : h(
                'span',
                { class: 'small muted' },
                'Every word in your selected levels is started. Add a level in Me to keep going.',
              ),
          h('button', { class: 'btn', onclick: () => go('play', { mode: 'match' }) }, 'Play Match'),
        ),
      ),
    );
  }
  root.append(
    h(
      'div',
      null,
      h('div', { class: 'label', style: 'margin-bottom:8px' }, 'Quick drills'),
      h(
        'div',
        { class: 'grid4' },
        tileBtn('配', 'Match', 'Pair 汉字 with pinyin or meaning against the clock', () =>
          go('play', { mode: 'match' }),
        ),
        tileBtn('声', 'Tones', 'Hear a word, pick its tone pattern', () =>
          go('play', { mode: 'tones' }),
        ),
        tileBtn('听', 'Listen', 'Hear a word, pick the characters', () =>
          go('play', { mode: 'listen' }),
        ),
        tileBtn('写', 'Write', 'Draw characters from memory', () => go('play', { mode: 'write' })),
      ),
    ),
  );
  if (!S.tutorialSeen) {
    root.append(
      h(
        'div',
        { class: 'card' },
        h(
          'div',
          { class: 'row', style: 'justify-content:space-between' },
          h('h3', null, 'How Hanzi Flow teaches'),
          h(
            'button',
            {
              class: 'btn sm ghost',
              onclick: () => {
                setSetting('tutorialSeen', true);
                render();
              },
            },
            'Got it',
          ),
        ),
        h(
          'p',
          { class: 'muted', style: 'margin:8px 0 12px;max-width:62ch' },
          'Every word climbs a 7-rung ladder. Each rung is a harder test, from recognizing to recalling to writing. Get it right and the word moves up and comes back later. Miss it and it drops a rung and comes back soon. Short daily Flow sessions do the scheduling. Match and the drills are for extra reps and fun.',
        ),
        h(
          'div',
          { class: 'ladder' },
          STAGES.slice(1).map((s, i) =>
            h(
              'div',
              null,
              h('i', null, i + 1),
              h(
                'span',
                null,
                h('b', null, s),
                ' · ',
                h('span', { class: 'muted' }, STAGE_HELP[i + 1]),
              ),
            ),
          ),
        ),
        h(
          'p',
          { class: 'small faint', style: 'margin:12px 0 0' },
          'Tip: tones are part of the answer. When typing pinyin, add tone numbers (ni3 hao3) and write ü as v.',
        ),
      ),
    );
  }
  const learnedToday = dayRec().n,
    revToday = dayRec().r;
  if (learnedToday || revToday)
    root.append(
      h(
        'div',
        { class: 'small muted' },
        'Today: ' + revToday + ' answers · ' + learnedToday + ' new words · ' + dayRec().x + ' xp',
      ),
    );
  screenEl.append(root);
};
function tileBtn(zi, title, desc, onclick) {
  return h(
    'button',
    { class: 'tilebtn', onclick },
    h('span', { class: 'zi' }, zi),
    h('b', null, title),
    h('span', null, desc),
  );
}
function nextDueText() {
  const its = Object.values(state.items).filter((i) => (i.s > 0 && i.s < 7) || i.s === 7);
  if (!its.length) return 'a while';
  const m = Math.min(...its.map((i) => i.d));
  return fmtDue(m);
}

// ======== FLOW SESSION ========
let session = null;
function buildQueue({ extraNew = 0 }) {
  const S = state.settings;
  const due = dueWords();
  const reviews = due.slice(0, S.sessionSize);
  let allowance;
  if (extraNew) allowance = extraNew;
  else {
    allowance = newAllowance();
    if (due.length > S.sessionSize) allowance = Math.min(allowance, 2);
    else allowance = Math.min(allowance, Math.max(0, S.sessionSize - reviews.length));
  }
  const fresh = freshWords(allowance, S.levels);
  const q = [];
  let fi = 0;
  reviews.forEach((w, i) => {
    q.push({ k: w.s, kind: 'task' });
    if (i % 2 === 1 && fi < fresh.length) q.push({ k: fresh[fi++].s, kind: 'intro' });
  });
  while (fi < fresh.length) q.push({ k: fresh[fi++].s, kind: 'intro' });
  return q;
}
function startSession(opts) {
  const q = buildQueue(opts);
  if (!q.length) {
    toast('Nothing to study right now. Add a level or raise new words per day in Me.');
    return;
  }
  session = {
    queue: q,
    total: q.length,
    done: 0,
    xp: 0,
    correct: 0,
    answered: 0,
    newWords: [],
    missed: [],
    recent: [],
    sinceBoard: 0,
    startedAt: Date.now(),
    xpStart: state.stats.xp,
  };
  saveSession();
  audio.sfx('start');
  go('flow');
}
function saveSession() {
  try {
    if (session)
      localStorage.setItem(
        LS_SESS,
        JSON.stringify(Object.assign({}, session, { savedAt: Date.now() })),
      );
    else localStorage.removeItem(LS_SESS);
  } catch (e) {}
}
function loadSession() {
  try {
    const raw = localStorage.getItem(LS_SESS);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() - s.savedAt > 3 * 3600000 || !s.queue || !s.queue.length) {
      localStorage.removeItem(LS_SESS);
      return null;
    }
    return s;
  } catch (e) {
    return null;
  }
}
function endSession() {
  session = null;
  saveSession();
}
SCREENS.flow = function () {
  if (!session) {
    go('home');
    return;
  }
  flowTop();
  nextCard();
};
function flowTop() {
  const top = h(
    'div',
    { class: 'sess-top' },
    h('button', {
      class: 'iconbtn',
      'aria-label': 'Quit session',
      html: ICON.close,
      onclick: () => {
        if (confirmQuit.hidden) confirmQuit.hidden = false;
      },
    }),
    h(
      'div',
      { class: 'bar' },
      h('i', {
        id: 'sess-bar',
        style: 'width:' + Math.round((100 * session.done) / Math.max(1, session.total)) + '%',
      }),
    ),
    h(
      'span',
      { class: 'chip tnum', id: 'sess-xp' },
      '+' + (state.stats.xp - session.xpStart) + ' xp',
    ),
  );
  const confirmQuit = h(
    'div',
    {
      class: 'card soft row',
      hidden: true,
      style: 'margin-bottom:14px;justify-content:space-between',
    },
    h('span', null, 'Leave now? Your answers so far are saved.'),
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            confirmQuit.hidden = true;
          },
        },
        'Keep going',
      ),
      h(
        'button',
        {
          class: 'btn sm danger',
          onclick: () => {
            endSession();
            go('home');
          },
        },
        'Leave',
      ),
    ),
  );
  screenEl.append(top, confirmQuit, h('div', { id: 'card' }));
}
function updateTop() {
  const b = $('#sess-bar');
  if (b) b.style.width = Math.round((100 * session.done) / Math.max(1, session.total)) + '%';
  const x = $('#sess-xp');
  if (x) x.textContent = '+' + (state.stats.xp - session.xpStart) + ' xp';
  renderChips();
}
function cardEl() {
  runCardCleanups();
  const c = $('#card');
  c.innerHTML = '';
  return c;
}
function uniqueLast(arr, n) {
  const out = [];
  for (let i = arr.length - 1; i >= 0 && out.length < n; i--) {
    if (!out.includes(arr[i])) out.push(arr[i]);
  }
  return out;
}
function nextCard() {
  if (!session) return;
  saveSession();
  updateTop();
  if (session.sinceBoard >= 6) {
    const up = new Set(),
      um = new Set();
    const words = uniqueLast(session.recent, 8)
      .map((k) => BY.get(k))
      .filter((w) => w && !up.has(w.p) && !um.has(w.m[0]) && (up.add(w.p), um.add(w.m[0]), true))
      .slice(0, 5);
    if (words.length >= 4) {
      session.sinceBoard = 0;
      renderBoardCard(words);
      return;
    }
  }
  if (!session.queue.length) {
    finishSession();
    return;
  }
  let idx = session.queue.findIndex((e) => !e.due || e.due <= Date.now());
  if (idx < 0) idx = 0;
  const e = session.queue.splice(idx, 1)[0];
  const w = BY.get(e.k);
  if (!w) {
    nextCard();
    return;
  }
  session.current = e;
  if (e.kind === 'intro') renderIntro(w);
  else renderTask(w);
}
function requeue(w, outcome) {
  const it = rec(w);
  if (!it || it.d - Date.now() >= 20 * MIN || session.queue.some((e) => e.k === w.s)) return;
  const pos = Math.min(session.queue.length, outcome === 'good' ? 4 : 3);
  session.queue.splice(pos, 0, { k: w.s, kind: 'task', due: it.d });
  session.total++;
}
function afterAnswer(w, outcome, perfect) {
  grade(w, outcome, perfect);
  session.answered++;
  if (outcome === 'good') session.correct++;
  else if (!session.missed.includes(w.s)) session.missed.push(w.s);
  session.recent.push(w.s);
  session.sinceBoard++;
  session.done++;
  addXP(outcome === 'good' ? (perfect ? 12 : 10) : outcome === 'almost' ? 4 : 1);
  requeue(w, outcome);
  saveSession();
  save();
  updateTop();
}
function finishSession() {
  const c = cardEl();
  const acc = session.answered ? Math.round((100 * session.correct) / session.answered) : 100;
  const xp = state.stats.xp - session.xpStart;
  const sealZi = acc >= 90 ? '优' : acc >= 70 ? '良' : '中';
  const seal = h('div', { class: 'seal' }, sealZi);
  const mins = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));
  const root = h(
    'div',
    { class: 'stack fade-in' },
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'row', style: 'justify-content:space-between;align-items:flex-start' },
        h(
          'div',
          null,
          h('div', { class: 'label' }, 'Session complete'),
          h('h1', null, acc >= 90 ? 'Excellent flow' : acc >= 70 ? 'Good work' : 'Keep at it'),
        ),
        seal,
      ),
      h(
        'div',
        { class: 'row', style: 'gap:22px;margin-top:14px' },
        h('div', { class: 'stat' }, h('b', null, session.answered), h('span', null, 'answers')),
        h('div', { class: 'stat' }, h('b', null, acc + '%'), h('span', null, 'accuracy')),
        h('div', { class: 'stat' }, h('b', null, '+' + xp), h('span', null, 'xp')),
        h('div', { class: 'stat' }, h('b', null, mins), h('span', null, 'min')),
      ),
    ),
  );
  if (session.newWords.length)
    root.append(
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'New today'),
        h(
          'div',
          { class: 'row', style: 'margin-top:8px' },
          session.newWords.map((k) => wordLink(BY.get(k))),
        ),
      ),
    );
  if (session.missed.length)
    root.append(
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'Worth another look'),
        h(
          'p',
          { class: 'small muted', style: 'margin:4px 0 8px' },
          'These come back within minutes or tomorrow.',
        ),
        h(
          'div',
          { class: 'row' },
          session.missed.map((k) => wordLink(BY.get(k))),
        ),
      ),
    );
  const more = dueWords().length;
  const canMore = freshWords(1, state.settings.levels).length > 0;
  root.append(
    h(
      'div',
      { class: 'row' },
      more
        ? h(
            'button',
            {
              class: 'btn primary',
              onclick: () => {
                endSession();
                startSession({});
              },
            },
            'Another round (' + more + ' due)',
          )
        : canMore
          ? h(
              'button',
              {
                class: 'btn primary',
                onclick: () => {
                  endSession();
                  startSession({ extraNew: 5 });
                },
              },
              'Learn 5 more',
            )
          : null,
      h(
        'button',
        {
          class: 'btn',
          onclick: () => {
            endSession();
            go('home');
          },
        },
        'Done',
      ),
    ),
  );
  c.append(root);
  audio.sfx(acc >= 90 ? 'perfect' : 'good');
  endSession();
}

function renderIntro(w) {
  const c = cardEl();
  const card = h('div', { class: 'card intro fade-in' });
  const big = h('div', { class: 'writers' });
  const head = h(
    'div',
    { class: 'head' },
    big,
    h(
      'div',
      null,
      h('div', { class: 'label' }, 'New word · HSK ' + w.l),
      pyEl(w.y, 'py-big'),
      h('div', { class: 'small muted' }, posText(w)),
    ),
  );
  head.querySelector('.py').style.fontSize = '28px';
  const meanings = h(
    'ol',
    { class: 'meanings' },
    w.m.map((m) => h('li', null, m)),
  );
  const bd = breakdownEl(w);
  const sents = sentencesFor(w, 1).map((s) => sentEl(s, w.s));
  card.append(
    head,
    meanings,
    ...(w.t
      ? [h('div', { class: 'small muted' }, 'Traditional: ', h('span', { class: 'hz' }, w.t))]
      : []),
    bd,
    ...sents,
    h(
      'div',
      { class: 'row', style: 'margin-top:4px' },
      h(
        'button',
        {
          class: 'btn primary grow',
          onclick: () => {
            introduce(w, false);
            session.newWords.push(w.s);
            session.done++;
            session.queue.splice(Math.min(session.queue.length, 2), 0, {
              k: w.s,
              kind: 'task',
              due: rec(w).d,
            });
            session.total++;
            save();
            nextCard();
          },
        },
        'Got it, quiz me',
      ),
      speakBtn(w.s),
      h(
        'button',
        {
          class: 'btn ghost',
          onclick: () => {
            introduce(w, true);
            session.done++;
            save();
            toast('Marked as known. It will still show up for review.');
            nextCard();
          },
        },
        'Already know it',
      ),
    ),
  );
  c.append(card);
  renderBigHanzi(big, w, true);
  if (state.settings.autoplay) setTimeout(() => audio.speak(w.s), 250);
}
function renderBigHanzi(container, w, animate) {
  container.innerHTML = '';
  const chars = [...w.s];
  const size = chars.length >= 3 ? 88 : chars.length === 2 ? 116 : 150;
  const writers = [];
  const draw = () => {
    for (const ch of chars) {
      const box = h('div', { class: 'tzg', style: 'width:' + size + 'px;border-width:1px' });
      container.append(box);
      const wr = makeWriter(box, ch, { size, showCharacter: true, hintAfter: 99 });
      if (wr) writers.push(wr);
      else {
        box.classList.remove('tzg');
        box.className = 'hz-big';
        box.style.width = '';
        box.textContent = ch;
      }
    }
    if (animate && writers.length) {
      let i = 0;
      const step = () => {
        if (i >= writers.length || !container.isConnected) return;
        writers[i].animateCharacter({
          onComplete: () => {
            i++;
            setTimeout(step, 250);
          },
        });
      };
      setTimeout(step, 500);
    }
    container.onclick = () => {
      let i = 0;
      const step = () => {
        if (i >= writers.length) return;
        writers[i].hideCharacter();
        writers[i].animateCharacter({
          onComplete: () => {
            i++;
            setTimeout(step, 200);
          },
        });
      };
      step();
    };
    container.title = 'Tap to replay stroke order';
  };
  if (chars.every(hasStrokes)) draw();
  else {
    container.append(h('div', { class: 'hz-big' }, w.s));
    ensureStrokes(chars)
      .then(() => {
        if (container.isConnected && chars.every(hasStrokes)) draw();
      })
      .catch(() => {});
  }
}
function breakdownEl(w) {
  const chars = [...new Set([...w.s])].filter((c) => CH[c]);
  if (!chars.length || (chars.length === 1 && !CH[chars[0]][3] && w.s.length === 1))
    return h('div');
  return h(
    'div',
    { class: 'breakdown' },
    chars.map((c) => {
      const info = CH[c];
      const comp = info[2]
        ? [...info[2]].filter((x) => CH[x] && x !== c && CH[x][0]).slice(0, 3)
        : [];
      return h(
        'div',
        { class: 'ch' },
        h('div', { class: 'zi' }, c),
        h(
          'div',
          null,
          h(
            'div',
            { class: 'def' },
            info[1] ? h('span', { class: 'py muted small' }, info[1] + ' · ') : null,
            info[0] || '—',
          ),
          info[3] ? h('div', { class: 'hint' }, info[3]) : null,
          comp.length
            ? h(
                'div',
                { class: 'hint' },
                'Parts: ',
                comp.map((x, i) => [
                  i ? ' · ' : null,
                  h('span', { class: 'hz' }, x),
                  ' ',
                  CH[x][0].split(/[;,]/)[0],
                ]),
              )
            : null,
        ),
      );
    }),
  );
}

function taskKind(w) {
  const it = rec(w);
  let s = it ? it.s : 1;
  if (s >= 7) s = rnd([3, 4, 5, 6]);
  if (s <= 0) s = 1;
  if (s === 6 && !canWrite(w)) s = 5;
  return s;
}
function renderTask(w) {
  const kind = taskKind(w);
  if (kind === 6) {
    const c = cardEl();
    c.append(h('div', { class: 'card faint' }, 'Loading stroke data…'));
    ensureStrokes([...w.s])
      .then(() => {
        if (session && session.current && session.current.k === w.s)
          renderWrite(w, { inFlow: true });
      })
      .catch(() => renderType(w, { fromEnglish: true }));
    return;
  }
  if (kind === 1) renderMC(w, { prompt: 'hanzi', answer: 'meaning', q: 'What does it mean?' });
  else if (kind === 2)
    renderMC(w, { prompt: 'hanzi', answer: 'pinyin', q: 'How is it pronounced?' });
  else if (kind === 3)
    renderMC(w, {
      prompt: audio.available ? 'audio' : 'pinyin',
      answer: 'hanzi',
      q: audio.available ? 'Which word did you hear?' : 'Which word is this?',
    });
  else if (kind === 4) renderType(w, { fromEnglish: false });
  else renderType(w, { fromEnglish: true });
}
function promptEl(w, mode, q) {
  const p = h('div', { class: 'prompt' });
  p.append(h('div', { class: 'q' }, q));
  if (mode === 'hanzi')
    p.append(h('div', { class: 'hz-big' }, state.settings.trad && w.t ? w.t : w.s));
  else if (mode === 'pinyin') p.append(pyEl(w.y));
  else if (mode === 'meaning')
    p.append(
      h('div', { class: 'en' }, w.m[0]),
      w.m[1] ? h('div', { class: 'small muted' }, w.m[1]) : null,
      h('div', { class: 'small faint' }, posText(w)),
    );
  else if (mode === 'audio') {
    const b = h('button', {
      class: 'btn',
      style: 'font-size:18px;padding:14px 22px',
      html: ICON.speaker + ' Play again',
      onclick: () => audio.speak(w.s),
    });
    p.append(b);
    setTimeout(() => audio.speak(w.s), 200);
  }
  return p;
}
function optionLabel(x, kind) {
  if (kind === 'meaning') return h('span', null, x.m[0]);
  if (kind === 'pinyin') return pyEl(x.y);
  return h('span', { class: 'hz' }, x.s);
}
function renderMC(w, { prompt, answer, q }) {
  const c = cardEl();
  const n = 3;
  let opts;
  if (answer === 'pinyin') {
    const tv = toneVariants(w, 2).map((y) => ({
      y,
      s: '\u0000' + pyText(y),
      m: [''],
      p: pyText(y),
      fake: true,
    }));
    const others = distractors(
      w,
      n - tv.length,
      'pinyin',
      tv.map((v) => v.y.map((s) => s[0] + s[1]).join(' ')),
    );
    opts = shuffle([w, ...tv, ...others]);
  } else opts = shuffle([w, ...distractors(w, n, answer === 'meaning' ? 'meaning' : 'hanzi')]);
  const task = h('div', { class: 'task fade-in' });
  task.append(promptEl(w, prompt, q));
  const list = h('div', { class: 'opts' });
  let answered = false;
  const fb = h('div');
  const choose = (x, btn) => {
    if (answered) return;
    answered = true;
    const ok = x === w;
    [...list.children].forEach((b, i) => {
      b.disabled = true;
      if (opts[i] === w) b.classList.add('correct');
      else if (b === btn) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    if (prompt !== 'audio' && state.settings.autoplay) audio.speak(w.s);
    afterAnswer(w, ok ? 'good' : 'again', ok);
    audio.sfx(ok ? 'good' : 'bad');
    fb.append(feedbackEl(w, ok ? 'good' : 'again', ok ? 'Correct' : 'Not quite'), continueBtn());
  };
  opts.forEach((x, i) => {
    const b = h(
      'button',
      { class: 'opt', onclick: (e) => choose(x, e.currentTarget) },
      h('span', { class: 'key' }, i + 1),
      optionLabel(x, answer),
    );
    list.append(b);
  });
  task.append(list, fb, h('div', { class: 'kbd' }, 'Keys 1–4 to answer, Enter to continue'));
  c.append(task);
  const key = (e) => {
    if (!list.isConnected) {
      document.removeEventListener('keydown', key);
      return;
    }
    if (e.key >= '1' && e.key <= '4' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const b = list.children[+e.key - 1];
      if (b && !answered) b.click();
    }
  };
  document.addEventListener('keydown', key);
  onCardLeave(() => document.removeEventListener('keydown', key));
}
function feedbackEl(w, outcome, title, detail) {
  const it = rec(w);
  return h(
    'div',
    { class: 'feedback ' + outcome + ' pop' },
    h(
      'div',
      { class: 'grow' },
      h('div', { class: 'v' }, title),
      h(
        'div',
        { class: 'row', style: 'margin-top:4px' },
        h('span', { class: 'hz', style: 'font-size:22px' }, w.s),
        pyEl(w.y),
        h('span', { class: 'muted' }, w.m[0]),
      ),
      detail ? h('div', { class: 'd', style: 'margin-top:4px' }, detail) : null,
      it
        ? h(
            'div',
            { class: 'd', style: 'margin-top:6px' },
            stagePill(w),
            ' · next in ' + fmtDue(it.d),
          )
        : null,
    ),
    h('button', { class: 'btn sm ghost', onclick: () => openSheet(w) }, 'Details'),
  );
}
function continueBtn(label) {
  let used = false;
  const b = h(
    'button',
    {
      class: 'btn primary block',
      style: 'margin-top:4px',
      onclick: () => {
        if (used || !b.isConnected) return;
        used = true;
        nextCard();
      },
    },
    label || 'Continue',
  );
  const born = performance.now();
  const key = (e) => {
    if (!b.isConnected) {
      document.removeEventListener('keydown', key);
      return;
    }
    if (e.key === 'Enter' && e.timeStamp > born) {
      e.preventDefault();
      b.click();
    }
  };
  document.addEventListener('keydown', key);
  onCardLeave(() => document.removeEventListener('keydown', key));
  setTimeout(() => b.focus({ preventScroll: true }), 50);
  return b;
}
function renderType(w, { fromEnglish }) {
  const c = cardEl();
  const task = h('div', { class: 'task fade-in' });
  task.append(
    promptEl(
      w,
      fromEnglish ? 'meaning' : 'hanzi',
      fromEnglish ? 'Type the pinyin for this word' : 'Type the pinyin, tones included',
    ),
  );
  const input = h('input', {
    type: 'text',
    placeholder: 'e.g. ni3 hao3',
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-label': 'Pinyin answer',
  });
  const btn = h('button', { class: 'btn primary' }, 'Check');
  const box = h('div', { class: 'typebox' }, input, btn);
  const fb = h('div');
  let done = false;
  const submit = () => {
    if (done) return;
    const val = input.value.trim();
    if (!val) return;
    done = true;
    input.disabled = true;
    btn.disabled = true;
    const r = checkPinyin(val, w.y);
    let outcome, title, detail;
    if (r === 'good') {
      outcome = 'good';
      title = 'Correct';
    } else if (r === 'toneless') {
      outcome = state.settings.strictTones ? 'again' : 'almost';
      title = 'Right sounds, no tones';
      detail = 'Add the tone numbers next time: ' + numericText(w.y);
    } else if (r === 'tones') {
      outcome = 'again';
      title = 'Right sounds, wrong tones';
      detail = 'It is ' + pyText(w.y) + ' (' + numericText(w.y) + ')';
    } else {
      outcome = 'again';
      title = 'Not quite';
      detail = 'Answer: ' + numericText(w.y);
    }
    if (state.settings.autoplay) audio.speak(w.s);
    afterAnswer(w, outcome, outcome === 'good');
    audio.sfx(outcome === 'good' ? 'good' : outcome === 'almost' ? 'almost' : 'bad');
    fb.append(feedbackEl(w, outcome, title, detail), continueBtn());
  };
  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      submit();
    }
  });
  task.append(
    box,
    fb,
    h(
      'div',
      { class: 'kbd' },
      'Tones as numbers (ma1 ma2 ma3 ma4), neutral tone needs none · ü = v',
    ),
  );
  c.append(task);
  setTimeout(() => input.focus({ preventScroll: true }), 80);
}
function renderWrite(w, { inFlow, onDone }) {
  const c = cardEl();
  const task = h('div', { class: 'task fade-in' });
  const chars = [...w.s];
  let idx = 0,
    mistakes = 0;
  const dots = h(
    'div',
    { class: 'dots' },
    chars.map(() => h('i')),
  );
  const p = h(
    'div',
    { class: 'prompt' },
    h('div', { class: 'q' }, 'Draw the character' + (chars.length > 1 ? 's' : '') + ' from memory'),
    pyEl(w.y),
    h('div', { class: 'en' }, w.m[0]),
    chars.length > 1 ? dots : null,
  );
  const area = h('div', { class: 'writers' });
  const fb = h('div');
  const tools = h('div', { class: 'row', style: 'justify-content:center' });
  task.append(p, area, tools, fb);
  c.append(task);
  if (state.settings.autoplay) setTimeout(() => audio.speak(w.s), 200);
  let writer = null;
  const finishWord = () => {
    const perChar = mistakes / chars.length;
    const outcome = perChar <= 1 ? 'good' : perChar <= 3 ? 'almost' : 'again';
    const title =
      mistakes === 0
        ? 'Perfect strokes'
        : outcome === 'good'
          ? 'Written'
          : outcome === 'almost'
            ? 'Written, with hints'
            : 'Needs more practice';
    const detail = mistakes + ' stroke mistake' + (mistakes === 1 ? '' : 's');
    if (inFlow) {
      afterAnswer(w, outcome, mistakes === 0);
      fb.append(feedbackEl(w, outcome, title, detail), continueBtn());
    } else {
      fb.append(feedbackEl(w, outcome, title, detail));
      onDone && onDone(outcome, mistakes);
    }
    audio.sfx(
      outcome === 'good'
        ? mistakes
          ? 'good'
          : 'perfect'
        : outcome === 'almost'
          ? 'almost'
          : 'bad',
    );
    tools.innerHTML = '';
  };
  const startChar = () => {
    area.innerHTML = '';
    tools.innerHTML = '';
    const ch = chars[idx];
    [...dots.children].forEach((d, i) => {
      d.className = i < idx ? 'ok' : i === idx ? 'on' : '';
    });
    const box = h('div', { class: 'tzg quiz' });
    area.append(box);
    const size = Math.min(260, Math.round(window.innerWidth * 0.72));
    const wr = makeWriter(box, ch, { size, hintAfter: 2 });
    writer = wr;
    if (!wr) {
      idx++;
      if (idx < chars.length) startChar();
      else finishWord();
      return;
    }
    let charDone = false,
      showing = false;
    const onComplete = () => {
      if (charDone) return;
      charDone = true;
      tools.innerHTML = '';
      box.classList.add('done');
      idx++;
      setTimeout(() => {
        if (idx < chars.length) startChar();
        else finishWord();
      }, 650);
    };
    const onMistake = () => {
      if (!charDone && !showing) mistakes++;
    };
    wr.quiz({ onMistake, onComplete });
    tools.append(
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            if (charDone || showing) return;
            showing = true;
            mistakes += 3;
            try {
              wr.cancelQuiz();
            } catch (e) {}
            wr.showCharacter();
            wr.animateCharacter({
              onComplete: () => {
                setTimeout(() => {
                  if (charDone || !box.isConnected) return;
                  showing = false;
                  wr.hideCharacter();
                  wr.quiz({ onMistake, onComplete });
                }, 400);
              },
            });
          },
        },
        'Show me (costs 3)',
      ),
      speakBtn(w.s),
    );
    onCardLeave(() => {
      try {
        wr.cancelQuiz();
      } catch (e) {}
    });
  };
  startChar();
}
function renderBoardCard(words) {
  const c = cardEl();
  const wrap = h('div', { class: 'task fade-in' });
  wrap.append(
    h(
      'div',
      { class: 'row', style: 'justify-content:space-between' },
      h(
        'div',
        null,
        h('div', { class: 'label' }, 'Flow break'),
        h('h2', null, 'Match what you just practiced'),
      ),
      h('span', { class: 'combo', id: 'board-combo', hidden: true }),
    ),
  );
  const side = audio.available && Math.random() < 0.3 ? 'audio' : rnd(['pinyin', 'meaning']);
  const boardEl = h('div');
  wrap.append(boardEl);
  c.append(wrap);
  const seen = new Set();
  let pairs = 0,
    mist = 0;
  makeBoard(boardEl, words, {
    side,
    hear: state.settings.matchHear,
    onPair: (w, ok) => {
      if (ok) {
        pairs++;
        addXP(2);
        audio.sfx('good');
      } else {
        mist++;
        audio.sfx('bad');
        if (!seen.has(w.s)) {
          seen.add(w.s);
          if (rec(w)) {
            slip(w);
            requeue(w, 'almost');
            saveSession();
          }
        }
      }
      save();
      updateTop();
    },
    onDone: () => {
      const fb = h(
        'div',
        { class: 'feedback ' + (mist ? 'almost' : 'good') + ' pop' },
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'v' }, mist ? 'Board cleared' : 'Clean board!'),
          h(
            'div',
            { class: 'd' },
            mist
              ? mist + ' slip' + (mist === 1 ? '' : 's') + '. Slipped words come back shortly.'
              : 'No mistakes. +' + pairs * 2 + ' xp',
          ),
        ),
      );
      if (!mist) {
        addXP(5);
        audio.sfx('perfect');
      }
      wrap.append(fb, continueBtn());
      save();
      updateTop();
    },
  });
}
