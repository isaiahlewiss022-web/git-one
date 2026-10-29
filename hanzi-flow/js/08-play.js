/*
 * Hanzi Flow — 08-play.js
 * The Play tab: the Match board component (also used inside Flow), the timed Match arcade,
 * and the Tone, Listen and Write drills.
 */
'use strict';

// ======== MATCH BOARD (shared) ========
// One board: hanzi tiles on the left, their pinyin / meaning / audio on the right.
// Tap one tile on each side; a correct pair fades out, a wrong pair shakes.
// Used by the Match arcade and by the short "Flow break" boards inside a session.
function makeBoard(container, words, { side = 'pinyin', onPair, onDone, hear = true }) {
  container.innerHTML = '';
  const pairs = words.map((w) => {
    let s =
      side === 'mixed'
        ? rnd(audio.available ? ['pinyin', 'meaning', 'audio'] : ['pinyin', 'meaning'])
        : side;
    if (s === 'audio' && !audio.available) s = 'pinyin';
    return { w, s };
  });
  // The strip above the board shows the last pair you matched, so every match teaches
  // the full word (characters, pinyin, meaning) and not just the half you paired.
  const strip = h(
    'div',
    { class: 'lastmatch' },
    h('span', { class: 'faint' }, 'Match a pair to see it here'),
  );
  const left = h('div', { class: 'col' }),
    right = h('div', { class: 'col' });
  const board = h('div', { class: 'board' }, left, right);
  container.append(strip, board);
  let selL = null,
    selR = null,
    remaining = pairs.length,
    lock = false;
  const tileFor = (p, isLeft) => {
    const t = h('button', { class: 'tile' + (isLeft ? ' hz' : ''), 'data-k': p.w.s });
    if (isLeft) t.textContent = state.settings.trad && p.w.t ? p.w.t : p.w.s;
    else if (p.s === 'pinyin') t.append(pyEl(p.w.y));
    else if (p.s === 'meaning') t.textContent = p.w.m[0];
    else {
      t.innerHTML = ICON.speaker;
      t.classList.add('audio');
      t.setAttribute('aria-label', 'Play audio');
    }
    t.addEventListener('click', () => {
      if (lock || t.classList.contains('done')) return;
      if (!isLeft && p.s === 'audio') audio.speak(p.w.s);
      if (isLeft) {
        if (selL === t) {
          t.classList.remove('sel');
          selL = null;
          return;
        }
        if (selL) selL.classList.remove('sel');
        selL = t;
        t.classList.add('sel');
      } else {
        if (selR === t) {
          t.classList.remove('sel');
          selR = null;
          return;
        }
        if (selR) selR.classList.remove('sel');
        selR = t;
        t.classList.add('sel');
      }
      if (selL && selR) check();
    });
    return t;
  };
  const showMatch = (w) => {
    strip.innerHTML = '';
    strip.append(
      h('span', { class: 'hz' }, w.s),
      pyEl(w.y),
      h('span', null, w.m[0]),
      speakBtn(w.s, 'sm'),
    );
    strip.classList.remove('pop');
    void strip.offsetWidth;
    strip.classList.add('pop');
  };
  const check = () => {
    const a = selL,
      b = selR;
    const ok = a.dataset.k === b.dataset.k;
    const w = BY.get(a.dataset.k);
    lock = true;
    a.classList.remove('sel');
    b.classList.remove('sel');
    if (ok) {
      a.classList.add('ok', 'done');
      b.classList.add('ok', 'done');
      remaining--;
      selL = selR = null;
      lock = false;
      showMatch(w);
      // Hear the word you just matched (unless the tile itself was the audio).
      const pair = pairs.find((p) => p.w === w);
      if (hear && pair && pair.s !== 'audio') audio.speak(w.s);
      onPair && onPair(w, true);
      if (remaining === 0) setTimeout(() => onDone && onDone(), 420);
    } else {
      a.classList.add('shake');
      b.classList.add('shake');
      onPair && onPair(w, false);
      setTimeout(() => {
        a.classList.remove('shake');
        b.classList.remove('shake');
        selL = selR = null;
        lock = false;
      }, 380);
    }
  };
  pairs.forEach((p) => left.append(tileFor(p, true)));
  shuffle(pairs).forEach((p) => right.append(tileFor(p, false)));
  return {
    destroy() {
      container.innerHTML = '';
    },
  };
}

// Words you have started in Flow (any stage above 0).
function studiedWords() {
  return W.filter((w) => {
    const it = rec(w);
    return it && it.s > 0;
  });
}

// The deck for one Match run. Every word appears once; the run ends when the deck is used up.
//   'studied': the words you are learning, most urgent first (due, then still climbing, then mastered)
//   'levels' : any word of the chosen HSK levels, your studied words first
function matchDeck(source, levels) {
  const now = Date.now();
  const due = [],
    learning = [],
    mastered = [];
  for (const w of studiedWords()) {
    const it = rec(w);
    if (it.d <= now) due.push(w);
    else if (it.s < 7) learning.push(w);
    else mastered.push(w);
  }
  let deck = [...shuffle(due), ...shuffle(learning), ...shuffle(mastered)];
  if (source === 'levels') {
    const lv = new Set(levels);
    deck = deck.filter((w) => lv.has(w.l));
    deck = deck.concat(shuffle(W.filter((w) => lv.has(w.l) && !rec(w))));
  }
  return deck;
}

// Take the next n words off the front of the deck for one board, skipping any word whose
// pinyin or meaning is identical to one already on the board (those stay in the deck).
function drawBoard(deck, n) {
  const out = [];
  const usedP = new Set(),
    usedM = new Set();
  const key = (w) => w.y.map((s) => s[0] + s[1]).join(' ');
  let i = 0;
  while (i < deck.length && out.length < n) {
    const w = deck[i];
    if (usedP.has(key(w)) || usedM.has(w.m[0])) {
      i++;
      continue;
    }
    usedP.add(key(w));
    usedM.add(w.m[0]);
    out.push(w);
    deck.splice(i, 1);
  }
  return out;
}

// ======== PLAY ========
SCREENS.play = function (params) {
  const mode = params.mode || 'menu';
  if (mode === 'match') return renderMatchSetup();
  if (mode === 'tones') return renderToneDrill();
  if (mode === 'listen') return renderListenDrill();
  if (mode === 'write') return renderWriteDrill();
  const root = h(
    'div',
    { class: 'stack fade-in' },
    h(
      'div',
      null,
      h('h1', null, 'Play'),
      h(
        'p',
        { class: 'muted', style: 'margin:6px 0 0;max-width:60ch' },
        'Fast drills for extra reps. They never move a word up the ladder, but a slip sends it back for review sooner.',
      ),
    ),
    h(
      'div',
      { class: 'grid2' },
      tileBtn(
        '配',
        'Match',
        'Pair the words you are learning with their pinyin, meaning or sound. Short runs with a clear finish; sudden death for the brave.',
        () => go('play', { mode: 'match' }),
      ),
      tileBtn(
        '声',
        'Tone Sniper',
        'Hear a word and pick the exact tone pattern. The part most learners skip.',
        () => go('play', { mode: 'tones' }),
      ),
      tileBtn('听', 'Listen', 'Audio only. Pick the right characters among sound-alikes.', () =>
        go('play', { mode: 'listen' }),
      ),
      tileBtn('写', 'Write', 'Draw characters stroke by stroke from pinyin and meaning.', () =>
        go('play', { mode: 'write' }),
      ),
    ),
  );
  screenEl.append(root);
};
function backBar(title, sub) {
  return h(
    'div',
    { class: 'row', style: 'margin-bottom:14px' },
    h('button', {
      class: 'iconbtn',
      'aria-label': 'Back',
      html: ICON.back,
      onclick: () => go('play'),
    }),
    h('div', null, h('h2', null, title), sub ? h('div', { class: 'small muted' }, sub) : null),
  );
}
function bestKey() {
  const S = state.settings;
  return [
    S.matchSource === 'levels' ? 'L' + S.matchLevels.join('') : 'S',
    S.matchSide,
    S.matchPairs,
    S.matchBoards,
    S.matchTimer ? 't' : 'r',
    S.suddenDeath ? 'sd' : '',
  ].join('|');
}
function renderMatchSetup() {
  const S = state.settings;
  const studied = studiedWords().length;
  // With fewer than two studied words there is nothing to pair yet: fall back to level words.
  const source = studied >= 2 ? S.matchSource : 'levels';
  const deckSize = matchDeck(source, S.matchLevels).length;
  const pairs = Math.max(2, Math.min(S.matchPairs, deckSize));
  const boards = Math.min(S.matchBoards, Math.ceil(deckSize / pairs));
  const root = h('div', { class: 'stack fade-in' });
  root.append(backBar('Match', 'Pair the words you are learning. Every run has an end.'));
  const card = h('div', { class: 'card stack' });

  // Source
  const srcRow = h('div', { class: 'filters' });
  srcRow.append(
    h(
      'button',
      {
        class: 'fchip' + (source === 'studied' ? ' active' : ''),
        disabled: studied < 2,
        title: studied < 2 ? 'Learn a few words in Today first' : null,
        onclick: () => {
          setSetting('matchSource', 'studied');
          render();
        },
      },
      'Words I am learning (' + studied + ')',
    ),
    h(
      'button',
      {
        class: 'fchip' + (source === 'levels' ? ' active' : ''),
        onclick: () => {
          setSetting('matchSource', 'levels');
          render();
        },
      },
      'Any HSK level words',
    ),
  );
  card.append(
    h(
      'div',
      null,
      h('div', { class: 'label', style: 'margin-bottom:8px' }, 'Which words'),
      srcRow,
      studied < 2
        ? h(
            'div',
            { class: 'small muted', style: 'margin-top:8px' },
            'You have not started any words yet. Start a Flow session in Today and Match will draw from what you studied.',
          )
        : null,
    ),
  );
  if (source === 'levels')
    card.append(
      h(
        'div',
        null,
        h('div', { class: 'label', style: 'margin-bottom:8px' }, 'Levels'),
        levelChips(S.matchLevels, (v) => {
          setSetting('matchLevels', v);
          render();
        }),
      ),
    );

  // Answer side
  const sideRow = h('div', { class: 'filters' });
  for (const [v, l] of [
    ['pinyin', 'Pinyin'],
    ['meaning', 'Meaning'],
    ['audio', 'Audio'],
    ['mixed', 'Mixed'],
  ])
    sideRow.append(
      h(
        'button',
        {
          class: 'fchip' + (S.matchSide === v ? ' active' : ''),
          onclick: () => {
            if (v === 'audio' && !audio.available) {
              toast('No Chinese voice available on this device');
              return;
            }
            setSetting('matchSide', v);
            render();
          },
        },
        l,
      ),
    );
  card.append(
    h(
      'div',
      null,
      h('div', { class: 'label', style: 'margin-bottom:8px' }, 'Match 汉字 with'),
      sideRow,
    ),
  );

  // Board size and run length
  const pr = h('div', { class: 'filters' });
  for (const n of [4, 6, 8])
    pr.append(
      h(
        'button',
        {
          class: 'fchip' + (S.matchPairs === n ? ' active' : ''),
          onclick: () => {
            setSetting('matchPairs', n);
            render();
          },
        },
        n + ' pairs',
      ),
    );
  const br = h('div', { class: 'filters' });
  for (const n of [3, 5, 10])
    br.append(
      h(
        'button',
        {
          class: 'fchip' + (S.matchBoards === n ? ' active' : ''),
          onclick: () => {
            setSetting('matchBoards', n);
            render();
          },
        },
        n + ' boards',
      ),
    );
  card.append(
    h('div', null, h('div', { class: 'label', style: 'margin-bottom:8px' }, 'Board size'), pr),
    h(
      'div',
      null,
      h('div', { class: 'label', style: 'margin-bottom:8px' }, 'Run length'),
      br,
      h(
        'div',
        { class: 'small muted', style: 'margin-top:8px' },
        'Deck: ' +
          deckSize +
          ' word' +
          (deckSize === 1 ? '' : 's') +
          ' → this run is ' +
          boards +
          ' board' +
          (boards === 1 ? '' : 's') +
          ' of ' +
          pairs +
          ' pairs. No word repeats until the deck is used up; words you slip on come back once at the end.',
      ),
    ),
  );

  // Switches
  card.append(
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', null, 'Hear each match'),
        h('div', { class: 'sub' }, 'Speak the word when you pair it'),
      ),
      switchEl(S.matchHear, (v) => setSetting('matchHear', v)),
    ),
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', null, 'Timer'),
        h('div', { class: 'sub' }, '60 seconds, +3 s per pair, −3 s per slip'),
      ),
      switchEl(S.matchTimer, (v) => setSetting('matchTimer', v)),
    ),
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', null, 'Sudden death'),
        h('div', { class: 'sub' }, 'One slip ends the run'),
      ),
      switchEl(S.suddenDeath, (v) => setSetting('suddenDeath', v)),
    ),
  );
  const best = state.stats.best[bestKey()] || 0;
  card.append(
    h(
      'div',
      { class: 'row', style: 'justify-content:space-between' },
      h(
        'div',
        { class: 'small muted' },
        best ? 'Best for this setup: ' + best : 'No score yet for this setup',
      ),
      h(
        'button',
        {
          class: 'btn primary',
          disabled: deckSize < 2,
          onclick: () => renderMatchGame(source),
        },
        'Start',
      ),
    ),
  );
  root.append(card);
  screenEl.append(root);
}

function renderMatchGame(source) {
  clearScreen();
  const S = state.settings;
  const deck = matchDeck(source, S.matchLevels);
  if (deck.length < 2) {
    go('play', { mode: 'match' });
    return;
  }
  const pairsPerBoard = Math.max(2, Math.min(S.matchPairs, deck.length));
  const g = {
    score: 0,
    combo: 0,
    pairs: 0,
    boards: 0,
    boardsTotal: Math.min(S.matchBoards, Math.ceil(deck.length / pairsPerBoard)),
    mist: 0,
    missed: [],
    cleared: [],
    deck,
    redemption: false,
    endAt: Date.now() + 60000,
    running: true,
  };
  const root = h('div', { class: 'stack fade-in' });
  const scoreEl = h('span', { class: 'big tnum' }, '0');
  const comboEl = h('span', { class: 'combo', hidden: true });
  const progressEl = h('span', { class: 'chip tnum' });
  const timerBar = h('i', { style: 'width:100%' });
  const timer = h('div', { class: 'timer' }, timerBar);
  root.append(
    h(
      'div',
      { class: 'row', style: 'justify-content:space-between' },
      h(
        'div',
        { class: 'scoreline' },
        h('span', { class: 'faint small' }, 'Score'),
        scoreEl,
        comboEl,
      ),
      h(
        'div',
        { class: 'row' },
        progressEl,
        h('button', { class: 'btn sm ghost', onclick: () => gameOver('quit') }, 'End'),
      ),
    ),
  );
  if (S.matchTimer) root.append(timer);
  else root.append(h('div', { class: 'small faint' }, 'Relaxed mode · no timer'));
  const boardWrap = h('div');
  root.append(boardWrap);
  screenEl.append(root);
  const mult = () => 1 + Math.min(3, Math.floor(g.combo / 3));
  const setProgress = (label) => {
    progressEl.textContent = label;
  };
  const newBoard = () => {
    let words;
    if (g.boards < g.boardsTotal) {
      words = drawBoard(g.deck, pairsPerBoard);
      setProgress('Board ' + (g.boards + 1) + ' of ' + g.boardsTotal);
    } else if (!g.redemption && g.missed.length >= 2) {
      // One last board made only of the words you slipped on.
      g.redemption = true;
      words = drawBoard(
        g.missed.map((k) => BY.get(k)),
        pairsPerBoard,
      );
      setProgress('Last board: your slips');
    } else {
      gameOver('done');
      return;
    }
    if (words.length < 2) {
      gameOver('done');
      return;
    }
    boardWrap.classList.remove('fade-in');
    void boardWrap.offsetWidth;
    boardWrap.classList.add('fade-in');
    makeBoard(boardWrap, words, {
      side: S.matchSide,
      hear: S.matchHear,
      onPair: (w, ok) => {
        if (!g.running) return;
        if (ok) {
          g.pairs++;
          g.combo++;
          g.score += 10 * mult();
          if (!g.cleared.includes(w.s)) g.cleared.push(w.s);
          if (S.matchTimer) g.endAt += 3000;
          audio.sfx(g.combo % 5 === 0 ? 'perfect' : 'good');
        } else {
          g.mist++;
          g.combo = 0;
          if (!g.missed.includes(w.s)) g.missed.push(w.s);
          slip(w);
          audio.sfx('bad');
          if (S.suddenDeath) {
            gameOver('death');
            return;
          }
          if (S.matchTimer) g.endAt -= 3000;
        }
        scoreEl.textContent = g.score;
        comboEl.hidden = g.combo < 3;
        comboEl.textContent = 'combo ×' + mult();
      },
      onDone: () => {
        if (!g.running) return;
        g.boards++;
        g.score += 15;
        if (S.matchTimer) g.endAt += 4000;
        scoreEl.textContent = g.score;
        newBoard();
      },
    });
  };
  let raf = null;
  const tick = () => {
    if (!g.running) return;
    if (S.matchTimer) {
      const left = g.endAt - Date.now();
      const pct = clamp((100 * left) / 60000, 0, 100);
      timerBar.style.width = pct + '%';
      timer.classList.toggle('low', left < 12000);
      if (left <= 0) {
        gameOver('time');
        return;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  const gameOver = (why) => {
    if (!g.running) return;
    g.running = false;
    cancelAnimationFrame(raf);
    const key = bestKey();
    const prev = state.stats.best[key] || 0;
    const isBest = g.score > prev;
    if (isBest) state.stats.best[key] = g.score;
    const xp = Math.floor(g.score / 15) + g.boards * 3;
    addXP(xp);
    touchStreak();
    cloud.dirty.add('meta');
    save();
    renderChips();
    clearScreen();
    const acc = g.pairs + g.mist ? Math.round((100 * g.pairs) / (g.pairs + g.mist)) : 0;
    const label =
      why === 'done'
        ? 'Deck finished'
        : why === 'death'
          ? 'Sudden death'
          : why === 'time'
            ? 'Time is up'
            : 'Run ended';
    const out = h(
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
            h('div', { class: 'label' }, label),
            h(
              'h1',
              null,
              isBest && g.score > 0
                ? 'New best!'
                : why === 'done' && !g.mist
                  ? 'Clean sweep'
                  : g.score >= 300
                    ? 'Strong run'
                    : 'Nice warm-up',
            ),
          ),
          isBest && g.score > 0
            ? h('div', { class: 'seal two' }, '最佳')
            : why === 'done' && !g.mist && g.pairs >= 4
              ? h('div', { class: 'seal' }, '优')
              : null,
        ),
        h(
          'div',
          { class: 'row', style: 'gap:22px;margin-top:14px' },
          h('div', { class: 'stat' }, h('b', null, g.score), h('span', null, 'score')),
          h(
            'div',
            { class: 'stat' },
            h('b', null, Math.max(prev, g.score)),
            h('span', null, 'best'),
          ),
          h(
            'div',
            { class: 'stat' },
            h('b', null, g.boards + '/' + g.boardsTotal),
            h('span', null, 'boards'),
          ),
          h('div', { class: 'stat' }, h('b', null, acc + '%'), h('span', null, 'accuracy')),
          h('div', { class: 'stat' }, h('b', null, '+' + xp), h('span', null, 'xp')),
        ),
      ),
    );
    if (g.missed.length)
      out.append(
        h(
          'div',
          { class: 'card' },
          h('h3', null, 'Slipped on'),
          h(
            'p',
            { class: 'small muted', style: 'margin:4px 0 8px' },
            'These are pulled forward in your next Flow session. Tap one to study it.',
          ),
          h(
            'div',
            { class: 'row' },
            g.missed.map((k) => wordLink(BY.get(k))),
          ),
        ),
      );
    if (g.cleared.length)
      out.append(
        h(
          'div',
          { class: 'card soft' },
          h('h3', null, 'Matched this run'),
          h(
            'div',
            { class: 'row', style: 'margin-top:8px' },
            g.cleared.map((k) => wordLink(BY.get(k))),
          ),
        ),
      );
    out.append(
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn primary', onclick: () => renderMatchGame(source) }, 'Play again'),
        h('button', { class: 'btn', onclick: () => go('play', { mode: 'match' }) }, 'Change setup'),
        h('button', { class: 'btn ghost', onclick: () => go('home') }, 'Home'),
      ),
    );
    screenEl.append(out);
    audio.sfx(isBest ? 'perfect' : why === 'done' ? 'good' : 'almost');
  };
  onLeave(() => {
    g.running = false;
    cancelAnimationFrame(raf);
  });
  audio.sfx('start');
  newBoard();
  tick();
}

// ======== DRILLS ========
// Word pools for the drills: words of the given levels, split into the ones you are still
// climbing, the ones you have seen at all, and everything.
function poolFor(levels) {
  const inLv = W.filter((w) => levels.includes(w.l));
  const learning = inLv.filter((w) => {
    const it = rec(w);
    return it && it.s > 0 && it.s < 7;
  });
  const seen = inLv.filter((w) => rec(w));
  return { all: inLv, learning, seen };
}
function drillWords(n, filter) {
  const S = state.settings;
  const { all, learning, seen } = poolFor(S.levels);
  const f = filter || (() => true);
  const out = [];
  const push = (w) => {
    if (out.length < n && !out.includes(w) && f(w)) out.push(w);
  };
  shuffle(learning).forEach(push);
  shuffle(seen).forEach(push);
  shuffle(all).forEach(push);
  if (out.length < n) shuffle(W).forEach(push);
  return out;
}
function drillShell(title, sub, total) {
  const root = h('div', { class: 'stack fade-in' });
  const prog = h('div', { class: 'bar' }, h('i', { style: 'width:0%' }));
  const score = h('span', { class: 'chip tnum' }, '0 / ' + total);
  root.append(
    backBar(title, sub),
    h('div', { class: 'row' }, h('div', { class: 'grow' }, prog), score),
  );
  const body = h('div');
  root.append(body);
  screenEl.append(root);
  return {
    body,
    set(i, s) {
      prog.firstChild.style.width = Math.round((100 * i) / total) + '%';
      score.textContent = s + ' / ' + total;
    },
  };
}
function drillSummary(body, title, correct, total, xp, extra) {
  body.innerHTML = '';
  const acc = Math.round((100 * correct) / Math.max(1, total));
  body.append(
    h(
      'div',
      { class: 'card fade-in' },
      h(
        'div',
        { class: 'row', style: 'justify-content:space-between;align-items:flex-start' },
        h(
          'div',
          null,
          h('div', { class: 'label' }, title),
          h('h1', null, acc >= 90 ? 'Sharp' : acc >= 70 ? 'Solid' : 'Getting there'),
        ),
        acc >= 90 ? h('div', { class: 'seal' }, '优') : null,
      ),
      h(
        'div',
        { class: 'row', style: 'gap:22px;margin-top:14px' },
        h(
          'div',
          { class: 'stat' },
          h('b', null, correct + '/' + total),
          h('span', null, 'correct'),
        ),
        h('div', { class: 'stat' }, h('b', null, acc + '%'), h('span', null, 'accuracy')),
        h('div', { class: 'stat' }, h('b', null, '+' + xp), h('span', null, 'xp')),
      ),
      extra || null,
      h(
        'div',
        { class: 'row', style: 'margin-top:14px' },
        h('button', { class: 'btn primary', onclick: () => render() }, 'Again'),
        h('button', { class: 'btn', onclick: () => go('play') }, 'Other drills'),
      ),
    ),
  );
  addXP(xp);
  touchStreak();
  save();
  renderChips();
  audio.sfx(acc >= 90 ? 'perfect' : 'good');
}
function slip(w) {
  const it = rec(w);
  if (!it || it.s <= 0) return;
  const now = Date.now();
  if (it.d > now + 10 * MIN) {
    if (it.sd == null) it.sd = it.d;
    it.d = now + 10 * MIN;
  }
  it.n = now;
  cloud.dirty.add(shardOf(w));
  save();
}
function renderToneDrill() {
  const TOTAL = 10;
  const words = drillWords(TOTAL, (w) => w.y.length <= 3 && w.y.some((s) => s[1] !== 5));
  const sh = drillShell('Tone Sniper', 'Hear it, see it, nail the tones', TOTAL);
  let i = 0,
    correct = 0,
    streak = 0;
  const missed = [];
  const round = () => {
    if (i >= words.length) {
      drillSummary(
        sh.body,
        'Tone Sniper',
        correct,
        words.length,
        correct * 5 + (correct === words.length ? 20 : 0),
        missed.length
          ? h(
              'div',
              { style: 'margin-top:12px' },
              h('div', { class: 'label' }, 'Missed'),
              h(
                'div',
                { class: 'row', style: 'margin-top:6px' },
                missed.map((w) => wordLink(w)),
              ),
            )
          : null,
      );
      return;
    }
    const w = words[i];
    sh.set(i, correct);
    sh.body.innerHTML = '';
    const canHear = audio.available;
    const p = h(
      'div',
      { class: 'prompt' },
      h('div', { class: 'q' }, canHear ? 'Listen, then pick the tones' : 'Pick the tones'),
      h('div', { class: 'hz-big' }, w.s),
      h('div', { class: 'muted' }, w.m[0]),
      canHear
        ? h('button', {
            class: 'btn sm',
            html: ICON.speaker + ' Replay',
            onclick: () => audio.speak(w.s),
          })
        : null,
    );
    const variants = toneVariants(w, 3);
    const opts = shuffle([w.y, ...variants]);
    const list = h('div', { class: 'opts' });
    let done = false;
    const fb = h('div');
    opts.forEach((y, k) => {
      const isRight = y === w.y;
      const b = h(
        'button',
        {
          class: 'opt',
          onclick: () => {
            if (done) return;
            done = true;
            [...list.children].forEach((bb, j) => {
              bb.disabled = true;
              if (opts[j] === w.y) bb.classList.add('correct');
              else if (bb === b) bb.classList.add('wrong');
              else bb.classList.add('dim');
            });
            if (isRight) {
              correct++;
              streak++;
              audio.sfx(streak >= 3 ? 'perfect' : 'good');
            } else {
              streak = 0;
              missed.push(w);
              slip(w);
              audio.sfx('bad');
            }
            if (!canHear || !isRight) audio.speak(w.s);
            fb.append(
              h(
                'div',
                { class: 'feedback ' + (isRight ? 'good' : 'again') + ' pop' },
                h(
                  'div',
                  { class: 'grow' },
                  h('div', { class: 'v' }, isRight ? 'Right tones' : 'Listen again'),
                  h(
                    'div',
                    { class: 'row', style: 'margin-top:6px' },
                    pyEl(w.y),
                    h(
                      'span',
                      { class: 'row', style: 'gap:4px' },
                      w.y.map(([b, t]) => h('span', { class: 't' + t, html: toneSVG(t) })),
                    ),
                    h('span', { class: 'small muted' }, w.y.map((x) => toneName(x[1])).join(' + ')),
                  ),
                ),
              ),
              h(
                'button',
                {
                  class: 'btn primary block',
                  style: 'margin-top:4px',
                  onclick: () => {
                    i++;
                    round();
                  },
                },
                'Next',
              ),
            );
          },
        },
        h('span', { class: 'key' }, k + 1),
        pyEl(y),
        h(
          'span',
          { class: 'row faint', style: 'margin-left:auto;gap:2px' },
          y.map(([b, t]) => h('span', { html: toneSVG(t) })),
        ),
      );
      list.append(b);
    });
    sh.body.append(p, list, fb);
    if (canHear) setTimeout(() => audio.speak(w.s), 250);
  };
  round();
}
function toneName(t) {
  return ['', '1st high', '2nd rising', '3rd dipping', '4th falling', 'neutral'][t];
}
function renderListenDrill() {
  const TOTAL = 10;
  if (!audio.available) {
    screenEl.append(
      backBar('Listen', 'Audio only'),
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'No Chinese voice found'),
        h(
          'p',
          { class: 'muted' },
          'This drill needs your browser’s speech voices. On most phones and in Chrome or Edge on a computer, a Mandarin voice is built in. Check that Audio is on in Me, or try the Tone drill, which also works from the characters.',
        ),
        h(
          'button',
          { class: 'btn primary', onclick: () => go('play', { mode: 'tones' }) },
          'Go to Tones',
        ),
      ),
    );
    return;
  }
  const words = drillWords(TOTAL, (w) => w.s.length <= 4);
  const sh = drillShell('Listen', 'Pick what you hear', TOTAL);
  let i = 0,
    correct = 0;
  const missed = [];
  const round = () => {
    if (i >= words.length) {
      drillSummary(
        sh.body,
        'Listen',
        correct,
        words.length,
        correct * 5 + (correct === words.length ? 20 : 0),
        missed.length
          ? h(
              'div',
              { style: 'margin-top:12px' },
              h('div', { class: 'label' }, 'Missed'),
              h(
                'div',
                { class: 'row', style: 'margin-top:6px' },
                missed.map((w) => wordLink(w)),
              ),
            )
          : null,
      );
      return;
    }
    const w = words[i];
    sh.set(i, correct);
    sh.body.innerHTML = '';
    const p = h(
      'div',
      { class: 'prompt' },
      h('div', { class: 'q' }, 'Which word did you hear?'),
      h('button', {
        class: 'btn',
        style: 'font-size:18px;padding:14px 22px',
        html: ICON.speaker + ' Play again',
        onclick: () => audio.speak(w.s),
      }),
    );
    const opts = shuffle([w, ...distractors(w, 3, 'hanzi')]);
    const list = h('div', { class: 'opts' });
    let done = false;
    const fb = h('div');
    opts.forEach((x, k) => {
      const b = h(
        'button',
        {
          class: 'opt',
          onclick: () => {
            if (done) return;
            done = true;
            const ok = x === w;
            [...list.children].forEach((bb, j) => {
              bb.disabled = true;
              if (opts[j] === w) bb.classList.add('correct');
              else if (bb === b) bb.classList.add('wrong');
              else bb.classList.add('dim');
            });
            if (ok) {
              correct++;
              audio.sfx('good');
            } else {
              missed.push(w);
              slip(w);
              audio.sfx('bad');
            }
            fb.append(
              h(
                'div',
                { class: 'feedback ' + (ok ? 'good' : 'again') + ' pop' },
                h(
                  'div',
                  { class: 'grow' },
                  h('div', { class: 'v' }, ok ? 'Correct' : 'That was ' + w.s),
                  h(
                    'div',
                    { class: 'row', style: 'margin-top:4px' },
                    h('span', { class: 'hz', style: 'font-size:22px' }, w.s),
                    pyEl(w.y),
                    h('span', { class: 'muted' }, w.m[0]),
                  ),
                  ok
                    ? null
                    : h(
                        'div',
                        { class: 'd', style: 'margin-top:4px' },
                        'You picked ',
                        h('span', { class: 'hz' }, x.s),
                        ' ',
                        pyText(x.y),
                        ' · ',
                        x.m[0],
                      ),
                ),
              ),
              h(
                'button',
                {
                  class: 'btn primary block',
                  style: 'margin-top:4px',
                  onclick: () => {
                    i++;
                    round();
                  },
                },
                'Next',
              ),
            );
          },
        },
        h('span', { class: 'key' }, k + 1),
        h('span', { class: 'hz', style: 'font-size:24px' }, x.s),
      );
      list.append(b);
    });
    sh.body.append(p, list, fb);
    setTimeout(() => audio.speak(w.s), 250);
  };
  round();
}
function renderWriteDrill() {
  const TOTAL = 6;
  const words = drillWords(TOTAL, canWrite);
  const sh = drillShell('Write', 'Stroke by stroke, from memory', TOTAL);
  let i = 0,
    correct = 0,
    xp = 0;
  const round = () => {
    if (i >= words.length) {
      drillSummary(sh.body, 'Write', correct, words.length, xp);
      return;
    }
    const w = words[i];
    sh.set(i, correct);
    sh.body.innerHTML = '';
    sh.body.append(h('div', { class: 'card faint' }, 'Loading stroke data…'));
    ensureStrokes([...w.s])
      .then(() => {
        if (!sh.body.isConnected) return;
        const holder = h('div', { id: 'card' });
        sh.body.innerHTML = '';
        sh.body.append(holder);
        renderWrite(w, {
          inFlow: false,
          onDone: (outcome, mist) => {
            if (outcome === 'good') {
              correct++;
              xp += 12 * w.s.length;
            } else if (outcome === 'almost') xp += 4 * w.s.length;
            else slip(w);
            holder.append(
              h(
                'button',
                {
                  class: 'btn primary block',
                  style: 'margin-top:10px',
                  onclick: () => {
                    i++;
                    round();
                  },
                },
                'Next',
              ),
            );
          },
        });
      })
      .catch(() => {
        i++;
        round();
      });
  };
  round();
}
