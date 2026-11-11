/*
 * Hanzi Flow — 08b-sentences.js
 * The Sentences drill. Words only become language once they are put in order, so this drill
 * has the learner build real sentences from word tiles: from the English meaning, by ear,
 * or by reading a Chinese sentence and picking what it means.
 * Sentences come from data/sentences.js; the drill prefers ones made of words already studied.
 */
'use strict';

// ======== SENTENCES ========
const SENT_RECENT_KEY = 'hanziflow.sentRecent'; // indexes of recently practiced sentences
const SENT_PUNCT = /[\s\p{P}\p{S}]/u;

// Cut a sentence into tiles. Tagged vocabulary words become one tile each (longest match
// first); characters no tag covers are gathered into small tiles of their own (names etc.).
// Returns null when the sentence contains digits or Latin letters, which make poor tiles.
function sentenceTiles(s) {
  const zh = s[0];
  const words = [...new Set(s[4])].sort((a, b) => b.length - a.length);
  const tiles = [];
  let loose = '';
  const flush = () => {
    if (loose) tiles.push(loose);
    loose = '';
  };
  for (let i = 0; i < zh.length; ) {
    const ch = zh[i];
    if (SENT_PUNCT.test(ch)) {
      flush();
      i++;
      continue;
    }
    if (!HAN_RE.test(ch)) return null;
    const hit = words.find((wd) => wd && zh.startsWith(wd, i));
    if (hit) {
      flush();
      tiles.push(hit);
      i += hit.length;
    } else {
      loose += ch;
      i++;
      if (loose.length >= 3) flush();
    }
  }
  flush();
  return tiles;
}
function isStudiedTile(t) {
  const w = BY.get(t);
  const it = w && rec(w);
  return !!(it && it.s > 0);
}
function recentSentences() {
  try {
    const a = JSON.parse(localStorage.getItem(SENT_RECENT_KEY) || '[]');
    return Array.isArray(a) ? a.filter((x) => Number.isInteger(x)) : [];
  } catch (e) {
    return [];
  }
}
function rememberSentences(idxs) {
  try {
    const a = recentSentences().concat(idxs).slice(-80);
    localStorage.setItem(SENT_RECENT_KEY, JSON.stringify(a));
  } catch (e) {}
}

// Choose n sentences for a round: first those built entirely from studied words, then those
// that are mostly studied, then easy ones from the selected levels. Shortest first.
function pickSentences(n) {
  const maxLevel = Math.max(1, ...state.settings.levels);
  const skip = new Set(recentSentences());
  const all = [],
    most = [],
    easy = [];
  SENT.forEach((s, idx) => {
    if (skip.has(idx) || s[0].length > 16) return;
    const tiles = sentenceTiles(s);
    if (!tiles || tiles.length < 3 || tiles.length > 8) return;
    const known = tiles.filter(isStudiedTile).length;
    const item = { idx, s, tiles };
    if (known === tiles.length) all.push(item);
    else if (s[3] <= maxLevel && known / tiles.length >= 0.6) most.push(item);
    else if (s[3] <= maxLevel) easy.push(item);
  });
  // Easy pool: lowest level first, hand-written sentences before crowd-sourced ones.
  const easySorted = shuffle(easy).sort(
    (a, b) => a.s[3] - b.s[3] || (a.s[5] === 'n' ? 0 : 1) - (b.s[5] === 'n' ? 0 : 1),
  );
  const out = [...shuffle(all), ...shuffle(most), ...easySorted].slice(0, n);
  return out.sort((a, b) => a.tiles.length - b.tiles.length);
}

// A few extra tiles that do not belong in the sentence.
function sentenceDecoys(item, n) {
  const text = item.tiles.join('');
  const out = [];
  const ok = (w) => w.s.length <= 2 && !text.includes(w.s) && !out.includes(w.s);
  for (const w of shuffle(studiedWords())) {
    if (out.length >= n) break;
    if (ok(w)) out.push(w.s);
  }
  for (const w of shuffle(BY_LEVEL[1])) {
    if (out.length >= n) break;
    if (ok(w)) out.push(w.s);
  }
  return out;
}

// One word tile. Words not studied yet carry their pinyin, so a new word never blocks a sentence.
function sentenceTileEl(t, onclick) {
  const w = BY.get(t);
  let py = '';
  if (!isStudiedTile(t))
    py = w
      ? pyText(w.y)
      : [...t]
          .map((c) => (CH[c] && CH[c][1] ? CH[c][1].split(' / ')[0] : ''))
          .join(' ')
          .trim();
  return h(
    'button',
    { class: 'stile', type: 'button', onclick },
    t,
    py ? h('small', null, py) : null,
  );
}

// The sentence with its pinyin, meaning and words, shown after every answer.
function sentenceAnswerEl(item, outcome, title, detail) {
  const s = item.s;
  const words = [...new Set(item.tiles)].map((t) => BY.get(t)).filter(Boolean);
  return h(
    'div',
    { class: 'feedback ' + outcome + ' pop' },
    h(
      'div',
      { class: 'grow', style: 'min-width:0' },
      h('div', { class: 'v' }, title),
      detail ? h('div', { class: 'd', style: 'margin-top:2px' }, detail) : null,
      h('div', { class: 'hz', style: 'font-size:22px;margin-top:6px' }, s[0]),
      h('div', { class: 'small muted' }, s[1]),
      h('div', { style: 'margin-top:2px' }, s[2]),
      words.length
        ? h(
            'div',
            { class: 'row', style: 'margin-top:8px;gap:6px' },
            words.map((w) => wordLink(w)),
          )
        : null,
    ),
    speakBtn(s[0]),
  );
}

function renderSentenceDrill() {
  const KINDS = ['meaning', 'build', 'build', 'listen', 'build', 'meaning', 'build', 'listen'];
  const items = pickSentences(KINDS.length);
  if (items.length < 3) {
    screenEl.append(
      backBar('Sentences', 'Put words in order'),
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'No sentences ready yet'),
        h(
          'p',
          { class: 'muted' },
          'Learn a few more words in Today, or add a level in Me, and sentences will appear here.',
        ),
        h('button', { class: 'btn primary', onclick: () => go('home') }, 'Go to Today'),
      ),
    );
    return;
  }
  const plan = items.map((it, i) => {
    let kind = KINDS[i % KINDS.length];
    if (kind === 'listen' && !audio.available) kind = 'build';
    return Object.assign({ kind }, it);
  });
  const sh = drillShell('Sentences', 'Put the words you know in order', plan.length);
  let i = 0,
    correct = 0,
    xp = 0;
  const nextBtn = () =>
    h(
      'button',
      {
        class: 'btn primary block cta',
        style: 'margin-top:4px',
        onclick: () => {
          i++;
          round();
        },
      },
      i + 1 >= plan.length ? 'Finish' : 'Next',
    );

  // English or audio in, word tiles out.
  const buildCard = (it, practiceOnly) => {
    const s = it.s;
    const target = it.tiles.join('');
    const bankWords = shuffle([...it.tiles, ...sentenceDecoys(it, it.tiles.length <= 4 ? 2 : 3)]);
    const chosen = []; // positions in bankWords, in the order tapped
    const listen = it.kind === 'listen';
    const prompt = h(
      'div',
      { class: 'prompt' },
      h(
        'div',
        { class: 'q' },
        listen ? 'Listen and build the sentence' : 'Build this sentence in Chinese',
      ),
      listen
        ? h('button', {
            class: 'btn',
            type: 'button',
            style: 'font-size:18px;padding:14px 22px',
            html: ICON.speaker + ' Play again',
            onclick: () => audio.speak(s[0], 0.85),
          })
        : h('div', { class: 'en' }, s[2]),
    );
    const line = h('div', { class: 'sline', 'aria-label': 'Your sentence' });
    const bank = h('div', { class: 'sbank' });
    const check = h(
      'button',
      { class: 'btn primary block', type: 'button', disabled: true },
      'Check',
    );
    const fb = h('div', { class: 'fbwrap' });
    let locked = false;
    const redraw = () => {
      line.innerHTML = '';
      chosen.forEach((bi, pos) =>
        line.append(
          sentenceTileEl(bankWords[bi], () => {
            if (locked) return;
            chosen.splice(pos, 1);
            redraw();
          }),
        ),
      );
      [...bank.children].forEach((b, bi) => {
        const used = chosen.includes(bi);
        b.classList.toggle('used', used);
        b.disabled = used || locked;
      });
      check.disabled = locked || !chosen.length;
    };
    bankWords.forEach((t, bi) =>
      bank.append(
        sentenceTileEl(t, () => {
          if (locked || chosen.includes(bi)) return;
          chosen.push(bi);
          redraw();
        }),
      ),
    );
    check.addEventListener('click', () => {
      if (locked || !chosen.length) return;
      locked = true;
      redraw();
      check.hidden = true;
      const picked = chosen.map((bi) => bankWords[bi]);
      const ok = picked.join('') === target;
      const sameWords =
        !ok && picked.slice().sort().join('|') === it.tiles.slice().sort().join('|');
      line.classList.add(ok ? 'ok' : 'bad');
      if (ok && !practiceOnly) {
        correct++;
        xp += listen ? 8 : 6;
      }
      audio.sfx(ok ? 'good' : 'bad');
      if (state.settings.autoplay) audio.speak(s[0], 0.9);
      fb.append(
        sentenceAnswerEl(
          it,
          ok ? 'good' : 'again',
          ok ? 'Correct' : sameWords ? 'Right words, different order' : 'Not quite',
          ok ? null : 'The sentence goes like this:',
        ),
        ok
          ? nextBtn()
          : h(
              'div',
              { class: 'row', style: 'margin-top:4px' },
              h(
                'button',
                { class: 'btn', type: 'button', onclick: () => show(it, true) },
                'Try it again',
              ),
              h('div', { class: 'grow' }, nextBtn()),
            ),
      );
      showFeedback(fb);
    });
    sh.body.append(h('div', { class: 'task fade-in' }, prompt, line, bank, check, fb));
    if (listen) setTimeout(() => audio.speak(s[0], 0.85), 250);
  };

  // Chinese in, English out.
  const meaningCard = (it) => {
    const s = it.s;
    const wrong = [];
    for (let tries = 0; tries < 400 && wrong.length < 2; tries++) {
      const o = SENT[Math.floor(Math.random() * SENT.length)];
      if (o[3] > s[3] + 1 || o[2] === s[2] || wrong.includes(o[2]) || o[2].length > 70) continue;
      wrong.push(o[2]);
    }
    const opts = shuffle([s[2], ...wrong]);
    const prompt = h(
      'div',
      { class: 'prompt' },
      h('div', { class: 'q' }, 'What does this sentence mean?'),
      h('div', { class: 'szh' }, s[0]),
      speakBtn(s[0]),
    );
    const list = h('div', { class: 'opts' });
    const fb = h('div', { class: 'fbwrap' });
    let done = false;
    opts.forEach((en, k) =>
      list.append(
        h(
          'button',
          {
            class: 'opt',
            type: 'button',
            onclick: (e) => {
              if (done) return;
              done = true;
              const ok = en === s[2];
              [...list.children].forEach((b, j) => {
                b.disabled = true;
                if (opts[j] === s[2]) b.classList.add('correct');
                else if (b === e.currentTarget) b.classList.add('wrong');
                else b.classList.add('dim');
              });
              if (ok) {
                correct++;
                xp += 3;
              }
              audio.sfx(ok ? 'good' : 'bad');
              fb.append(
                sentenceAnswerEl(it, ok ? 'good' : 'again', ok ? 'Correct' : 'Not quite'),
                nextBtn(),
              );
              showFeedback(fb);
            },
          },
          h('span', { class: 'key' }, k + 1),
          h('span', null, en),
        ),
      ),
    );
    sh.body.append(h('div', { class: 'task fade-in' }, prompt, list, fb));
    if (state.settings.autoplay) setTimeout(() => audio.speak(s[0], 0.9), 250);
  };

  const show = (it, practiceOnly) => {
    sh.body.innerHTML = '';
    window.scrollTo(0, 0);
    if (it.kind === 'meaning' && !practiceOnly) meaningCard(it);
    else buildCard(it, practiceOnly);
  };
  const round = () => {
    if (!sh.body.isConnected) return;
    if (i >= plan.length) {
      rememberSentences(plan.map((p) => p.idx));
      const bonus = correct === plan.length ? 10 : 0;
      drillSummary(
        sh.body,
        'Sentences',
        correct,
        plan.length,
        xp + bonus,
        h(
          'div',
          { style: 'margin-top:14px' },
          h('div', { class: 'label', style: 'margin-bottom:8px' }, 'Sentences in this round'),
          h(
            'div',
            { class: 'stack', style: 'gap:8px' },
            plan.map((p) => sentEl(p.s)),
          ),
        ),
      );
      return;
    }
    sh.set(i, correct);
    show(plan[i], false);
  };
  round();
}
