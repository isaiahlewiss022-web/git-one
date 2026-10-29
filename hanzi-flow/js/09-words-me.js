/*
 * Hanzi Flow — 09-words-me.js
 * The Words browser with the word detail sheet and tracing practice, and the Me screen
 * (rank, streak, ladder progress per level, settings, backup import/export, reset).
 */
'use strict';

// ======== WORDS ========
let wordsUI = { filter: '1', q: '' };
SCREENS.words = function () {
  const root = h('div', { class: 'stack fade-in' });
  root.append(h('h1', null, 'Words'));
  const search = h('input', {
    class: 'search',
    type: 'search',
    placeholder: 'Search 汉字, pinyin or English',
    value: wordsUI.q,
    'aria-label': 'Search words',
    id: 'word-search',
  });
  const list = h('div', { class: 'card', style: 'padding:4px 6px' });
  const count = h('div', { class: 'small muted' });
  const filters = h('div', { class: 'filters' });
  const F = [
    ['due', 'Due'],
    ['learning', 'Learning'],
    ['trouble', 'Trouble'],
    ['1', 'HSK 1'],
    ['2', 'HSK 2'],
    ['3', 'HSK 3'],
    ['4', 'HSK 4'],
    ['5', 'HSK 5'],
    ['6', 'HSK 6'],
  ];
  for (const [v, l] of F)
    filters.append(
      h(
        'button',
        {
          class: 'fchip' + (wordsUI.filter === v ? ' active' : ''),
          onclick: () => {
            wordsUI.filter = v;
            render();
          },
        },
        l,
      ),
    );
  const draw = () => {
    list.innerHTML = '';
    const q = wordsUI.q.trim().toLowerCase();
    const qn = q.replace(/\s+/g, '');
    const qv = normPinyinInput(q);
    const qvb = qv.replace(/[0-5]/g, '');
    let rows;
    const now = Date.now();
    if (wordsUI.filter === 'due') rows = dueWords(now);
    else if (wordsUI.filter === 'learning')
      rows = W.filter((w) => {
        const it = rec(w);
        return it && it.s > 0 && it.s < 7;
      });
    else if (wordsUI.filter === 'trouble')
      rows = W.filter((w) => {
        const it = rec(w);
        return it && it.l >= 3;
      }).sort((a, b) => rec(b).l - rec(a).l);
    else rows = BY_LEVEL[+wordsUI.filter] || [];
    if (q)
      rows = (q ? W : rows).filter(
        (w) =>
          w.s.includes(q) ||
          (w.t && w.t.includes(q)) ||
          w.p.toLowerCase().replace(/\s+/g, '').includes(qn) ||
          w.y
            .map((x) => x[0] + (x[1] === 5 ? '' : x[1]))
            .join('')
            .includes(qn) ||
          w.y
            .map((x) => x[0])
            .join('')
            .includes(qn) ||
          (qv &&
            (w.y
              .map((x) => x[0] + (x[1] === 5 ? '' : x[1]))
              .join('')
              .includes(qv) ||
              w.y
                .map((x) => x[0])
                .join('')
                .includes(qvb))) ||
          w.m.some((m) => m.toLowerCase().includes(q)),
      );
    const learning = rows.filter((w) => {
        const it = rec(w);
        return it && it.s > 0 && it.s < 7;
      }).length,
      mastered = rows.filter((w) => {
        const it = rec(w);
        return it && it.s >= 7;
      }).length;
    count.textContent =
      rows.length + ' words · ' + learning + ' learning · ' + mastered + ' mastered';
    let shown = 0;
    const CHUNK = 120;
    const more = h('button', { class: 'btn block ghost', style: 'margin:6px 0' }, 'Show more');
    const addRows = () => {
      const slice = rows.slice(shown, shown + CHUNK);
      for (const w of slice)
        list.append(
          h(
            'button',
            { class: 'wrow', onclick: () => openSheet(w) },
            h('span', { class: 'hz' }, w.s),
            h(
              'span',
              { class: 'grow', style: 'min-width:0' },
              pyEl(w.y),
              h('div', { class: 'm' }, w.m[0]),
            ),
            stagePill(w),
          ),
        );
      shown += slice.length;
      if (shown < rows.length) {
        list.append(more);
      } else more.remove();
    };
    more.addEventListener('click', () => {
      more.remove();
      addRows();
    });
    if (!rows.length)
      list.append(
        h(
          'div',
          { class: 'muted', style: 'padding:14px' },
          wordsUI.filter === 'due' ? 'Nothing due. Nice.' : 'No words match.',
        ),
      );
    addRows();
  };
  let t;
  search.addEventListener('input', () => {
    wordsUI.q = search.value;
    clearTimeout(t);
    t = setTimeout(draw, 120);
  });
  root.append(search, filters, count, list);
  screenEl.append(root);
  draw();
};
function openSheet(w) {
  const bg = h('div', {
    class: 'sheet-bg',
    onclick: (e) => {
      if (e.target === bg) close();
    },
  });
  const sheet = h('div', { class: 'sheet fade-in', role: 'dialog', 'aria-label': w.s });
  bg.append(sheet);
  const close = () => {
    bg.remove();
    document.removeEventListener('keydown', esc);
  };
  const esc = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', esc);
  const big = h('div', { class: 'writers' });
  const it = rec(w);
  const info = h(
    'div',
    { class: 'grow' },
    h(
      'div',
      { class: 'row', style: 'gap:8px' },
      h('span', { class: 'stagepill' }, 'HSK ' + w.l),
      stagePill(w),
    ),
    pyEl(w.y),
    h(
      'div',
      { class: 'small muted' },
      posText(w) + (w.cl ? ' · measure word ' + w.cl : '') + (w.t ? ' · traditional ' + w.t : ''),
    ),
  );
  info.querySelector('.py').style.fontSize = '26px';
  sheet.append(
    h(
      'div',
      { class: 'head' },
      big,
      info,
      h('button', { class: 'iconbtn', 'aria-label': 'Close', html: ICON.close, onclick: close }),
    ),
  );
  sheet.append(
    h(
      'ol',
      { class: 'meanings', style: 'margin:14px 0 0;padding-left:20px' },
      w.m.map((m) => h('li', null, m)),
    ),
  );
  sheet.append(
    h(
      'div',
      { class: 'row', style: 'margin-top:14px' },
      h('button', {
        class: 'btn sm',
        html: ICON.speaker + ' Hear',
        onclick: () => {
          if (!audio.speak(w.s)) toast('No Chinese voice available on this device');
        },
      }),
      canWrite(w)
        ? h(
            'button',
            {
              class: 'btn sm',
              onclick: () => {
                close();
                practiceWrite(w);
              },
            },
            'Practice writing',
          )
        : null,
      it && it.s >= 7
        ? null
        : h(
            'button',
            {
              class: 'btn sm',
              onclick: () => {
                markKnown(w);
                close();
                toast('Marked as mastered');
                render();
              },
            },
            'I know this',
          ),
      it
        ? h(
            'button',
            {
              class: 'btn sm ghost',
              onclick: () => {
                resetWord(w);
                close();
                toast('Progress reset for ' + w.s);
                render();
              },
            },
            'Reset',
          )
        : null,
    ),
  );
  const bd = breakdownEl(w);
  if (bd.children.length)
    sheet.append(
      h('div', { class: 'label', style: 'margin:18px 0 8px' }, 'Inside the characters'),
      bd,
    );
  const sents = sentencesFor(w, 3);
  if (sents.length)
    sheet.append(
      h('div', { class: 'label', style: 'margin:18px 0 8px' }, 'In sentences'),
      h(
        'div',
        { class: 'stack', style: 'gap:8px' },
        sents.map((s) => sentEl(s, w.s)),
      ),
    );
  const related = W.filter(
    (x) => x !== w && x.s.length <= 3 && [...w.s].some((c) => x.s.includes(c)) && rec(x),
  ).slice(0, 8);
  if (related.length)
    sheet.append(
      h(
        'div',
        { class: 'label', style: 'margin:18px 0 8px' },
        'Words you know with these characters',
      ),
      h(
        'div',
        { class: 'row' },
        related.map((x) => wordLink(x)),
      ),
    );
  if (it)
    sheet.append(
      h(
        'div',
        { class: 'small faint', style: 'margin-top:16px' },
        'Seen ' +
          it.r +
          '× · ' +
          it.l +
          ' lapse' +
          (it.l === 1 ? '' : 's') +
          ' · next review ' +
          fmtDue(it.d) +
          ' · ease ' +
          it.e.toFixed(2),
      ),
    );
  document.body.append(bg);
  renderBigHanzi(big, w, true);
}
function practiceWrite(w) {
  clearScreen();
  state.ui.screen = 'play';
  renderTabs();
  screenEl.append(backBar('Practice writing', 'Trace it first, then try it blind'));
  const holder = h('div', { id: 'card' });
  screenEl.append(holder);
  ensureStrokes([...w.s])
    .then(() => {
      let traced = false;
      const run = () => {
        holder.innerHTML = '';
        const box = h('div', { class: 'task fade-in' });
        const chars = [...w.s];
        let idx = 0;
        const area = h('div', { class: 'writers' });
        const p = h(
          'div',
          { class: 'prompt' },
          h('div', { class: 'q' }, traced ? 'Now from memory' : 'Trace the strokes'),
          h(
            'div',
            { class: 'row', style: 'justify-content:center' },
            h('span', { class: 'hz', style: 'font-size:28px' }, traced ? '' : w.s),
            pyEl(w.y),
          ),
          h('div', { class: 'muted' }, w.m[0]),
        );
        const fb = h('div');
        box.append(p, area, fb);
        holder.append(box);
        const startChar = () => {
          area.innerHTML = '';
          const tz = h('div', { class: 'tzg quiz' });
          area.append(tz);
          const wr = makeWriter(tz, chars[idx], {
            size: Math.min(260, Math.round(window.innerWidth * 0.72)),
            outline: !traced,
            hintAfter: traced ? 2 : 1,
          });
          if (!wr) {
            idx++;
            if (idx < chars.length) startChar();
            else done();
            return;
          }
          wr.quiz({
            onComplete: () => {
              tz.classList.add('done');
              idx++;
              setTimeout(() => {
                if (idx < chars.length) startChar();
                else done();
              }, 600);
            },
          });
          onLeave(() => {
            try {
              wr.cancelQuiz();
            } catch (e) {}
          });
        };
        const done = () => {
          audio.sfx('good');
          if (!traced) {
            traced = true;
            fb.append(
              h(
                'div',
                { class: 'feedback good pop' },
                h(
                  'div',
                  { class: 'grow' },
                  h('div', { class: 'v' }, 'Traced'),
                  h('div', { class: 'd' }, 'Now the real test: no outline.'),
                ),
              ),
              h(
                'button',
                { class: 'btn primary block', style: 'margin-top:4px', onclick: run },
                'Write it blind',
              ),
            );
          } else {
            fb.append(
              h(
                'div',
                { class: 'feedback good pop' },
                h(
                  'div',
                  { class: 'grow' },
                  h('div', { class: 'v' }, 'Written from memory'),
                  h(
                    'div',
                    { class: 'd' },
                    'The Write rung of the ladder will test this again later.',
                  ),
                ),
              ),
              h(
                'div',
                { class: 'row', style: 'margin-top:4px' },
                h('button', { class: 'btn primary', onclick: run }, 'Once more'),
                h('button', { class: 'btn', onclick: () => go('words') }, 'Back to words'),
              ),
            );
          }
        };
        startChar();
      };
      run();
    })
    .catch(() => {
      toast('Stroke data unavailable');
      go('words');
    });
}

// ======== ME: progress + settings ========
SCREENS.me = function (params) {
  const S = state.settings;
  const root = h('div', { class: 'stack fade-in' });
  const { r, next } = rankFor(state.stats.xp);
  root.append(
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'rank' },
        h('div', { class: 'zi' }, r[1]),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'label' }, 'Rank'),
          h('h2', null, r[2], ' · ', r[3]),
          h(
            'div',
            { class: 'small muted' },
            next
              ? state.stats.xp + ' xp · ' + (next[0] - state.stats.xp) + ' to ' + next[1]
              : state.stats.xp + ' xp · top of the ladder',
          ),
        ),
      ),
      h(
        'div',
        { class: 'small faint', style: 'margin-top:10px' },
        'Ranks follow the old imperial exam degrees: ' + RANKS.map((x) => x[1]).join(' → '),
      ),
    ),
  );
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const k = dayShift(-i);
    const d = state.stats.days[k];
    const n = d ? d.r + d.n : 0;
    days.push(
      h('i', {
        class: n === 0 ? '' : n < 10 ? 'd1' : n < 30 ? 'd2' : 'd3',
        title: k + ': ' + n + ' answers',
      }),
    );
  }
  const acc = state.stats.reviews
    ? Math.round((100 * state.stats.correct) / state.stats.reviews)
    : 0;
  root.append(
    h(
      'div',
      { class: 'card stack' },
      h(
        'div',
        { class: 'row', style: 'gap:22px' },
        h(
          'div',
          { class: 'stat' },
          h('b', null, state.stats.streak),
          h('span', null, 'day streak'),
        ),
        h('div', { class: 'stat' }, h('b', null, state.stats.reviews), h('span', null, 'answers')),
        h('div', { class: 'stat' }, h('b', null, acc + '%'), h('span', null, 'accuracy')),
        h(
          'div',
          { class: 'stat' },
          h('b', null, Object.keys(state.items).length),
          h('span', null, 'words started'),
        ),
      ),
      h(
        'div',
        null,
        h('div', { class: 'label', style: 'margin-bottom:6px' }, 'Last 14 days'),
        h('div', { class: 'days' }, days),
      ),
    ),
  );
  const bars = h('div', { class: 'stack', style: 'gap:10px' });
  for (const l of LEVELS) {
    const ws = BY_LEVEL[l];
    let a = 0,
      b = 0,
      c = 0;
    for (const w of ws) {
      const it = rec(w);
      if (!it || it.s === 0) continue;
      if (it.s <= 3) a++;
      else if (it.s <= 6) b++;
      else c++;
    }
    const tot = ws.length;
    const seg = h(
      'div',
      { class: 'seg' },
      c
        ? h('i', {
            style: 'width:' + (100 * c) / tot + '%;background:var(--stage-3)',
            title: c + ' mastered',
          })
        : null,
      b
        ? h('i', {
            style: 'width:' + (100 * b) / tot + '%;background:var(--stage-2)',
            title: b + ' reviewing',
          })
        : null,
      a
        ? h('i', {
            style: 'width:' + (100 * a) / tot + '%;background:var(--stage-1)',
            title: a + ' learning',
          })
        : null,
    );
    bars.append(
      h(
        'div',
        { class: 'lvbar' },
        h('span', { class: 'muted' }, 'HSK ' + l),
        seg,
        h('span', { class: 'tnum small', style: 'text-align:right' }, a + b + c + '/' + tot),
      ),
    );
  }
  root.append(
    h(
      'div',
      { class: 'card stack' },
      h('h3', null, 'Ladder progress by level'),
      bars,
      h(
        'div',
        { class: 'legend' },
        h('span', null, h('i', { style: 'background:var(--stage-1)' }), 'Learning (rungs 1–3)'),
        h('span', null, h('i', { style: 'background:var(--stage-2)' }), 'Reviewing (4–6)'),
        h('span', null, h('i', { style: 'background:var(--stage-3)' }), 'Mastered'),
      ),
    ),
  );
  const leeches = W.filter((w) => {
    const it = rec(w);
    return it && it.l >= 3;
  })
    .sort((a, b) => rec(b).l - rec(a).l)
    .slice(0, 10);
  if (leeches.length)
    root.append(
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'Trouble words'),
        h(
          'p',
          { class: 'small muted', style: 'margin:4px 0 8px' },
          'Lapsed three or more times. Open one and read the character hints; a story beats brute force.',
        ),
        h(
          'div',
          { class: 'row' },
          leeches.map((w) => wordLink(w)),
        ),
      ),
    );
  const set = h('div', { class: 'card', id: 'settings' });
  set.append(h('h3', { style: 'margin-bottom:6px' }, 'Learning'));
  set.append(
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', { for: 's-new' }, 'New words per day'),
        h('div', { class: 'sub' }, 'Six is steady. Ten if you are keen.'),
      ),
      h('input', {
        id: 's-new',
        type: 'number',
        min: 0,
        max: 30,
        value: S.newPerDay,
        onchange: (e) => setSetting('newPerDay', clamp(+e.target.value || 0, 0, 30)),
      }),
    ),
  );
  set.append(
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', { for: 's-size' }, 'Cards per session'),
        h('div', { class: 'sub' }, 'Reviews per Flow session, before re-asks'),
      ),
      h('input', {
        id: 's-size',
        type: 'number',
        min: 5,
        max: 60,
        value: S.sessionSize,
        onchange: (e) => setSetting('sessionSize', clamp(+e.target.value || 20, 5, 60)),
      }),
    ),
  );
  set.append(
    h(
      'div',
      { class: 'setrow', style: 'display:block' },
      h('label', null, 'Levels for new words'),
      h(
        'div',
        { class: 'sub', style: 'margin-bottom:8px' },
        'Lower levels are introduced first, most common words first.',
      ),
      levelChips(S.levels, (v) => {
        setSetting('levels', v);
        render();
      }),
    ),
  );
  set.append(
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', null, 'Strict tones'),
        h('div', { class: 'sub' }, 'Typed answers without tones count as wrong'),
      ),
      switchEl(S.strictTones, (v) => setSetting('strictTones', v)),
    ),
  );
  set.append(
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', null, 'Show traditional forms'),
        h('div', { class: 'sub' }, 'Prompts use 繁體 where it differs'),
      ),
      switchEl(S.trad, (v) => setSetting('trad', v)),
    ),
  );
  set.append(h('h3', { style: 'margin:18px 0 6px' }, 'Audio'));
  set.append(
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', null, 'Speech'),
        h(
          'div',
          { class: 'sub' },
          audio.voices.length
            ? audio.voices.length +
                ' Mandarin voice' +
                (audio.voices.length === 1 ? '' : 's') +
                ' found'
            : 'No Mandarin voice found in this browser',
        ),
      ),
      switchEl(S.audio, (v) => {
        setSetting('audio', v);
        audio.pick();
        render();
      }),
    ),
  );
  if (audio.voices.length > 1) {
    const sel = h(
      'select',
      {
        id: 's-voice',
        onchange: (e) => {
          setSetting('voice', e.target.value);
          audio.pick();
          audio.speak('你好');
        },
      },
      audio.voices.map((v) =>
        h(
          'option',
          { value: v.voiceURI, selected: audio.voice && v.voiceURI === audio.voice.voiceURI },
          v.name + ' (' + v.lang + ')',
        ),
      ),
    );
    set.append(h('div', { class: 'setrow' }, h('label', { for: 's-voice' }, 'Voice'), sel));
  }
  set.append(
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', { for: 's-rate' }, 'Speed'),
        h('div', { class: 'sub' }, 'Slower is clearer for tones'),
      ),
      h(
        'select',
        {
          id: 's-rate',
          onchange: (e) => {
            setSetting('rate', +e.target.value);
            audio.speak('谢谢');
          },
        },
        [
          [0.7, 'Slow'],
          [0.85, 'Relaxed'],
          [1, 'Natural'],
        ].map(([v, l]) => h('option', { value: v, selected: Math.abs(S.rate - v) < 0.01 }, l)),
      ),
    ),
  );
  set.append(
    h(
      'div',
      { class: 'setrow' },
      h(
        'div',
        null,
        h('label', null, 'Auto-play words'),
        h('div', { class: 'sub' }, 'Hear each word when it appears'),
      ),
      switchEl(S.autoplay, (v) => setSetting('autoplay', v)),
    ),
  );
  set.append(
    h(
      'div',
      { class: 'setrow' },
      h('div', null, h('label', null, 'Sound effects')),
      switchEl(S.sfx, (v) => setSetting('sfx', v)),
    ),
  );
  set.append(h('h3', { style: 'margin:18px 0 6px' }, 'Your data'));
  const ta = h('textarea', {
    class: 'data',
    placeholder: 'Paste a backup here to import it',
    'aria-label': 'Progress backup',
  });
  const status = h(
    'div',
    { class: 'small muted' },
    cloud.ready
      ? 'Progress is saved in this browser and synced to your claude.ai account.'
      : 'Progress is saved in this browser. Export a backup to move it to another device.',
  );
  set.append(
    status,
    h(
      'div',
      { class: 'row', style: 'margin:10px 0' },
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            ta.value = JSON.stringify({
              v: 1,
              items: state.items,
              stats: state.stats,
              settings: state.settings,
            });
            ta.focus();
            ta.select();
            try {
              navigator.clipboard.writeText(ta.value).then(
                () => toast('Backup copied to clipboard'),
                () => toast('Backup shown below. Copy it from the box.'),
              );
            } catch (e) {
              toast('Backup shown below. Copy it from the box.');
            }
          },
        },
        'Export backup',
      ),
      h(
        'button',
        {
          class: 'btn sm',
          onclick: () => {
            let n = 0,
              ok = false;
            try {
              const o = JSON.parse(ta.value);
              if (!o || typeof o !== 'object' || !o.items || typeof o.items !== 'object') throw 0;
              for (const [k, v] of Object.entries(o.items)) {
                const w = BY.get(k);
                if (
                  !w ||
                  !v ||
                  typeof v !== 'object' ||
                  typeof v.s !== 'number' ||
                  typeof v.d !== 'number'
                )
                  continue;
                const cur = state.items[k];
                if (!cur || (v.n || 0) >= (cur.n || 0)) {
                  state.items[k] = v;
                  n++;
                  cloud.dirty.add(shardOf(w));
                }
              }
              if (o.stats && typeof o.stats === 'object')
                mergeStats({
                  stats: o.stats,
                  settings: o.settings && typeof o.settings === 'object' ? o.settings : undefined,
                });
              normalizeSettings();
              ok = true;
            } catch (e) {}
            if (!ok) {
              toast('That does not look like a Hanzi Flow backup');
              return;
            }
            save();
            toast('Imported ' + n + ' words');
            render();
          },
        },
        'Import',
      ),
      h(
        'button',
        {
          class: 'btn sm danger',
          onclick: () => {
            resetBox.hidden = !resetBox.hidden;
          },
        },
        'Reset everything',
      ),
    ),
    ta,
  );
  const resetBox = h(
    'div',
    {
      class: 'card soft row',
      hidden: true,
      style: 'justify-content:space-between;margin-top:10px',
    },
    h('span', null, 'Delete all progress on this device? This cannot be undone.'),
    h(
      'button',
      {
        class: 'btn sm danger',
        onclick: () => {
          state.items = {};
          state.stats = {
            xp: 0,
            streak: 0,
            lastDay: '',
            best: {},
            days: {},
            reviews: 0,
            correct: 0,
            settingsAt: Date.now(),
            resetAt: Date.now(),
            tomb: {},
          };
          for (const s of SHARDS) cloud.dirty.add(s);
          cloud.dirty.add('meta');
          endSession();
          flushLocal();
          toast('Progress reset');
          go('home');
        },
      },
      'Yes, delete',
    ),
  );
  set.append(resetBox);
  root.append(
    set,
    h(
      'div',
      { class: 'small faint', style: 'line-height:1.6' },
      'Vocabulary: HSK 2.0 lists from complete-hsk-vocabulary (MIT) with CC-CEDICT definitions. Character hints and stroke data: Make Me a Hanzi (LGPL / Arphic Public License). Sentences: iam-nazmul/chinese (MIT) and Tatoeba (CC BY). Stroke quizzes: Hanzi Writer (MIT). Pronunciation uses your browser’s speech voices.',
    ),
  );
  screenEl.append(root);
  if (params && params.settings) setTimeout(() => set.scrollIntoView({ behavior: 'smooth' }), 50);
};
