/*
 * Hanzi Flow — 07b-typing.js
 * Typing cards (the Recall and Produce rungs of the ladder).
 * An answer can be typed as Chinese characters, with any Chinese keyboard (pinyin input,
 * handwriting or voice), or as pinyin with tone numbers. The learner picks once; the choice
 * is the typeMode setting ('ask' until chosen, then 'hanzi' or 'pinyin').
 */
'use strict';

// ======== typing ========
const HAN_RE = /\p{Script=Han}/u;
// Words by their traditional spelling, for answers typed on a traditional keyboard.
const BY_T = new Map(W.filter((w) => w.t).map((w) => [w.t, w]));

// Only the Chinese characters of what was typed (drops spaces, punctuation, stray letters).
function hanOnly(str) {
  return [...String(str)].filter((c) => HAN_RE.test(c)).join('');
}
// "nǐ hǎo" as one comparable string: same key means same sounds and same tones.
function soundKey(w) {
  return w.y.map((s) => s[0] + s[1]).join(' ');
}
// 哪儿, 一点儿: the final 儿 is a sound change on the syllable before it, not its own syllable.
function isErhuaWord(w) {
  return w.s.length > 1 && w.s.endsWith('儿') && w.y.length < w.s.length;
}
// Is `typed` this word? Simplified or traditional, and a final 儿 may be left off or added
// as long as that spelling is not a different word in the list (哪 is not 哪儿).
function sameWord(typed, w) {
  for (const f of w.t ? [w.s, w.t] : [w.s]) {
    if (typed === f) return true;
    if (isErhuaWord(w) && typed === f.slice(0, -1) && !BY.has(typed)) return true;
    if (!f.endsWith('儿') && typed === f + '儿' && !BY.has(typed)) return true;
  }
  return false;
}
// The short English glosses of a word, normalized, for spotting synonyms:
// 但是 "but; however" and 可是 "but; however" share the keys "but" and "however".
// With `shown`, only the meanings a card displays (the first two).
function glossKeys(w, shown) {
  const slot = shown ? '_gs' : '_gk';
  if (w[slot]) return w[slot];
  const out = new Set();
  for (const m of shown ? w.m.slice(0, 2) : w.m) {
    // Notes in brackets go first, innermost first: they can hold commas and slashes of their own.
    let s = m.toLowerCase(),
      prev;
    do {
      prev = s;
      s = s.replace(/\([^()]*\)/g, ' ');
    } while (s !== prev);
    for (const part of s.split(/[;,/]/)) {
      const k = part
        .replace(/[^a-z0-9' ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^to /, '');
      if (k.length >= 2) out.add(k);
    }
  }
  return (w[slot] = out);
}
// Does `other` (the word that was typed) also mean what the card for `w` shows?
function sharesMeaning(other, w) {
  const shown = glossKeys(w, true);
  for (const k of glossKeys(other)) if (shown.has(k)) return true;
  return false;
}

// Decide what a typed answer is worth.
//   accept.han / accept.pinyin : which kinds of answer this card takes
//   accept.synonyms            : the card shows a meaning, so another word for it is a near miss
// Verdicts: good, toneless, tones, wrong (as checkPinyin), plus
//   homophone (right sound, another word), synonym (right meaning, another word),
//   need-han / need-pinyin (the wrong kind of answer for this card; nothing is graded).
function judgeTyped(val, w, accept) {
  if (HAN_RE.test(val)) {
    if (!accept.han) return { verdict: 'need-pinyin' };
    const typed = hanOnly(val);
    if (sameWord(typed, w)) return { verdict: 'good', via: 'han', typed };
    const x = BY.get(typed) || BY_T.get(typed);
    if (x && x !== w) {
      if (accept.synonyms && sharesMeaning(x, w))
        return { verdict: 'synonym', other: x, via: 'han', typed };
      if (soundKey(x) === soundKey(w)) return { verdict: 'homophone', other: x, via: 'han', typed };
    }
    return { verdict: 'wrong', via: 'han', typed };
  }
  if (!accept.pinyin) return { verdict: 'need-han' };
  const r = checkPinyin(val, w.y);
  if (r === 'wrong' && accept.synonyms) {
    for (const x of W) {
      if (x === w || !sharesMeaning(x, w)) continue;
      const rx = checkPinyin(val, x.y);
      if (rx === 'good' || rx === 'toneless')
        return { verdict: 'synonym', other: x, via: 'pinyin' };
    }
  }
  return { verdict: r, via: 'pinyin' };
}

// Empty squares, one per character of the answer.
function blanksEl(w) {
  const n = w.s.length;
  return h(
    'div',
    { class: 'blanks', role: 'img', 'aria-label': n + (n === 1 ? ' character' : ' characters') },
    [...w.s].map(() => h('i')),
  );
}

// Shown once, on the first typing card: which keyboard does the learner have?
function renderTypeChoice(w, opts) {
  const c = cardEl();
  const pick = (v) => {
    setSetting('typeMode', v);
    renderType(w, opts);
  };
  c.append(
    h(
      'div',
      { class: 'card stack fade-in' },
      h(
        'div',
        null,
        h('div', { class: 'label' }, 'Before this card'),
        h('h2', null, 'How will you type your answers?'),
        h(
          'p',
          { class: 'muted', style: 'margin:6px 0 0' },
          'Some cards ask you to type the word. Pick what your keyboard does. You can change it later in Me.',
        ),
      ),
      h(
        'div',
        { class: 'grid2' },
        tileBtn(
          '字',
          'Chinese characters',
          'My keyboard types 汉字 (pinyin input, handwriting or voice). I will type 你好.',
          () => pick('hanzi'),
        ),
        tileBtn('ā', 'Pinyin with tone numbers', 'I type on an English keyboard: ni3 hao3.', () =>
          pick('pinyin'),
        ),
      ),
    ),
  );
}

function renderType(w, opts) {
  const mode = state.settings.typeMode;
  if (mode !== 'hanzi' && mode !== 'pinyin') return renderTypeChoice(w, opts);
  const hanzi = mode === 'hanzi';
  const fromEnglish = !!opts.fromEnglish;
  const canHear = audio.available;
  const c = cardEl();
  const task = h('div', { class: 'task fade-in' });

  // What the card shows decides what counts as an answer and what would only be a copy.
  //   Produce (both modes)   shows the meaning          -> characters or pinyin
  //   Recall, pinyin mode    shows the characters       -> pinyin only
  //   Recall, hanzi mode     plays the word + meaning   -> characters (pinyin too if only heard)
  let prompt, accept;
  if (fromEnglish) {
    prompt = promptEl(
      w,
      'meaning',
      hanzi ? 'Type this word in Chinese' : 'Type the pinyin for this word',
    );
    prompt.append(blanksEl(w));
    accept = { han: true, pinyin: true, synonyms: true };
  } else if (!hanzi) {
    prompt = promptEl(w, 'hanzi', 'Type the pinyin, tones included');
    accept = { han: false, pinyin: true, synonyms: false };
  } else {
    prompt = h(
      'div',
      { class: 'prompt' },
      h(
        'div',
        { class: 'q' },
        canHear ? 'Listen, then type the word' : 'Type this word in characters',
      ),
      canHear
        ? h('button', {
            class: 'btn',
            type: 'button',
            style: 'font-size:18px;padding:14px 22px',
            html: ICON.speaker + ' Play again',
            onclick: () => audio.speak(w.s),
          })
        : pyEl(w.y),
      h('div', { class: 'muted' }, w.m[0]),
      blanksEl(w),
    );
    if (canHear) setTimeout(() => audio.speak(w.s), 200);
    accept = { han: true, pinyin: canHear, synonyms: true };
  }

  const input = h(
    'input',
    hanzi
      ? {
          id: 'type-answer',
          type: 'text',
          class: 'hzin',
          lang: 'zh-CN',
          placeholder: '输入汉字',
          autocomplete: 'off',
          enterkeyhint: 'done',
          'aria-label': 'Answer in Chinese characters',
        }
      : {
          id: 'type-answer',
          type: 'text',
          placeholder: 'e.g. ni3 hao3',
          autocomplete: 'off',
          autocapitalize: 'off',
          autocorrect: 'off',
          spellcheck: 'false',
          enterkeyhint: 'done',
          'aria-label': 'Pinyin answer',
        },
  );
  const btn = h('button', { class: 'btn primary', type: 'button' }, 'Check');
  const box = h('form', { class: 'typebox', novalidate: true }, input, btn);
  const note = h('div', { class: 'typenote', role: 'status', hidden: true });
  const fb = h('div', { class: 'fbwrap' });
  const say = (...kids) => {
    note.innerHTML = '';
    note.append(...kids);
    note.hidden = false;
    showFeedback(note); // the keyboard is still open: bring the note above it
  };
  const hz = (t) => h('span', { class: 'hz' }, t);

  let done = false,
    retried = false,
    lastAt = -1000;
  const submit = () => {
    if (done) return;
    const now = performance.now();
    if (now - lastAt < 250) return; // one key press can arrive as both a key event and a form submit
    const val = input.value.trim();
    if (!val) return;
    lastAt = now;
    const j = judgeTyped(val, w, accept);

    // The wrong kind of answer for this card: explain, grade nothing.
    if (j.verdict === 'need-pinyin') {
      say(
        'This card shows the characters and asks for their pinyin, like ',
        h('b', null, 'ni3 hao3'),
        '. If your keyboard only types Chinese, tap “Type characters instead” below.',
      );
      return;
    }
    if (j.verdict === 'need-han') {
      say('The pinyin is already on the card. Type this one in Chinese characters.');
      return;
    }
    // Another word with the same meaning: not wrong, so one free second try with a hint.
    if (j.verdict === 'synonym' && !retried) {
      retried = true;
      const n = w.s.length;
      const lead =
        j.via === 'han'
          ? [hz(j.other.s), ' also means that.']
          : [pyText(j.other.y), ' (', hz(j.other.s), ') also means that.'];
      const clue =
        j.via === 'pinyin'
          ? ['starting with the sound “', w.y[0][0][0], '…”']
          : n === 1
            ? ['pronounced ', pyText(w.y)]
            : ['starting with ', hz(w.s[0])];
      say(
        ...lead,
        ' This card wants another word: ',
        n + (n === 1 ? ' character, ' : ' characters, '),
        ...clue,
        '. Try again.',
      );
      input.value = '';
      input.focus({ preventScroll: true });
      audio.sfx('almost');
      return;
    }

    done = true;
    input.disabled = true;
    btn.disabled = true;
    note.hidden = true;
    hint.remove();
    let outcome, title, detail;
    if (j.verdict === 'good') {
      outcome = 'good';
      title = 'Correct';
    } else if (j.verdict === 'toneless') {
      outcome = state.settings.strictTones ? 'again' : 'almost';
      title = 'Right sounds, no tones';
      detail = 'Add the tone numbers next time: ' + numericText(w.y);
    } else if (j.verdict === 'tones') {
      outcome = 'again';
      title = 'Right sounds, wrong tones';
      detail = 'It is ' + pyText(w.y) + ' (' + numericText(w.y) + ')';
    } else if (j.verdict === 'homophone') {
      outcome = 'almost';
      title = 'Right sound, different word';
      detail = h('span', null, hz(j.other.s), ' means “' + j.other.m[0] + '”.');
    } else if (j.verdict === 'synonym') {
      outcome = 'almost';
      title = 'Close: another word for it';
      detail = h('span', null, hz(j.other.s), ' also means that, but this card is ', hz(w.s), '.');
    } else {
      outcome = 'again';
      title = 'Not quite';
      detail =
        j.via === 'han'
          ? h('span', null, 'You typed ', hz(j.typed), '.')
          : 'Answer: ' + numericText(w.y);
    }
    if (state.settings.autoplay) audio.speak(w.s);
    afterAnswer(w, outcome, outcome === 'good' && !retried);
    audio.sfx(outcome === 'good' ? 'good' : outcome === 'almost' ? 'almost' : 'bad');
    fb.append(feedbackEl(w, outcome, title, detail), continueBtn());
    showFeedback(fb);
  };

  // Chinese keyboards compose text: Enter while composing picks a candidate, it is not an answer.
  // Safari sends the candidate-picking Enter just after compositionend, so the flag lingers
  // there for a moment. Elsewhere an Enter after compositionend is a real answer.
  let composing = false;
  const webkitIme =
    /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent);
  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    if (webkitIme)
      setTimeout(() => {
        composing = false;
      }, 30);
    else composing = false;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.isComposing || e.keyCode === 229 || composing) return;
    e.preventDefault();
    e.stopPropagation();
    submit();
  });
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!composing) submit();
  });
  btn.addEventListener('click', submit);

  const hint = h(
    'div',
    { class: 'hint' },
    hanzi
      ? 'Any Chinese keyboard works: pinyin input, handwriting or voice. '
      : 'Tones as numbers (ma1 ma2 ma3 ma4), neutral tone needs none · ü = v. ',
    h(
      'button',
      {
        class: 'linkbtn',
        type: 'button',
        onclick: () => {
          if (done) return;
          setSetting('typeMode', hanzi ? 'pinyin' : 'hanzi');
          renderType(w, opts);
        },
      },
      hanzi ? 'Type pinyin instead' : 'Type characters instead',
    ),
  );
  task.append(prompt, box, note, fb, hint);
  c.append(task);
  setTimeout(() => input.focus({ preventScroll: true }), 80);
}
