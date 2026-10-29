# Hanzi Flow 流

A fast, game-like trainer for Chinese characters, inspired by the click-and-match
game at chineseinflow.com and rebuilt around a learning ladder that actually makes
words stick.

**Play it:** open `index.html` in any modern browser (Chrome, Edge, Safari, Firefox).
No build step, no server, no account. Progress is saved in the browser.

## What it does

The original site is a pure recognition game: match 汉字 with pinyin, English or
audio against a timer, HSK 1 to 5. That is fun, but recognition alone fades fast.
Hanzi Flow keeps the game and adds the parts that make learning durable.

### The ladder
Every word climbs seven rungs. Each rung is a harder kind of test:

| Rung | Test | Skill |
|---|---|---|
| 1 Meaning | see the word, pick the meaning | recognition |
| 2 Sound | see the word, pick the pinyin (tone traps included) | recognition |
| 3 Listening | hear the word, pick the characters among sound-alikes | listening |
| 4 Recall | see the word, type the pinyin with tone numbers | active recall |
| 5 Produce | see the English, type the pinyin | production |
| 6 Writing | see pinyin and meaning, draw each character stroke by stroke | handwriting |
| 7 Mastered | mixed tests at long intervals | maintenance |

A correct answer moves the word up a rung and schedules it further out (a simple
SM-2 spaced-repetition schedule with learning steps). A miss drops it a rung and
brings it back within minutes. New words arrive in frequency order and get a quick
intro card: stroke-order animation, tone-coloured pinyin, the parts inside each
character with an etymology hint, and an example sentence you can tap to hear.

### Modes
- **Flow** (Today tab): the daily session. Due reviews plus a few new words,
  interleaved, with a short Match board every six cards as a breather.
- **Match**: the classic arcade, rebuilt around a deck of the words you are actually
  learning (due words first). Pair characters with pinyin, meaning, audio or a mix;
  every match is spoken and shown in full. No word repeats inside a run, a run is a
  fixed number of boards, and words you slip on come back for one last board. Timer,
  combo multiplier, best scores per setup, optional sudden death.
- **Tone Sniper**: hear and see a word, pick the exact tone pattern. Wrong options
  differ only in tone, which is exactly the thing most learners skip.
- **Listen**: audio only, pick the characters among similar-sounding words.
- **Write**: draw characters from memory in a 田字格 grid with stroke-level
  grading and hints after two misses.
- **Words**: browse or search HSK 1–6, open any word for strokes, meanings,
  character breakdown, sentences, and related words you already know. Mark words
  you know, or reset them.
- **Me**: rank (the imperial exam degrees, 童生 to 状元), streak, 14-day activity,
  ladder progress per level, trouble words, settings, and a copy-paste backup of
  your progress.

Pronunciation uses the browser's built-in speech voices (Web Speech API). Most
phones and desktop Chrome/Edge include a Mandarin voice; if none is found, the
listening parts fall back to pinyin prompts.

## Running locally
Just open `index.html`. The data files are plain scripts, so it also works from a
`file://` URL. To serve it instead:

```
python3 -m http.server 8000
```

then visit http://localhost:8000/.

## Putting it online with GitHub Pages
The repository ships a workflow (`.github/workflows/pages.yml`) that publishes this
folder as a website. One-time setup on GitHub: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. From then on every push to `main` redeploys
the site at `https://<your-user>.github.io/<repo>/`. Everything is static and uses
relative paths, so it works from a sub-path.

## Files
```
index.html            page markup; loads the data, Hanzi Writer and the app scripts
styles.css            all styling (design tokens at the top, light and dark themes)
js/01-data.js         word, character and sentence tables built from data/
js/02-helpers.js      DOM helper, pinyin tone marks, answer checking
js/03-state.js        settings, progress storage, optional cloud sync
js/04-audio.js        speech and sound effects
js/05-srs.js          the ladder and spaced-repetition scheduling
js/06-ui.js           screens, tabs, shared widgets
js/07-home-flow.js    Today screen and the Flow session
js/08-play.js         Match board and arcade, Tone, Listen and Write drills
js/09-words-me.js     Words browser, word sheet, Me screen and settings
js/10-main.js         start-up
data/vocab.js         7,419 words, one per line: HSK 2.0 levels 1–6 plus HSK 3.0 band 1–6 words missing from the old lists
data/chars.js         definitions, decomposition, etymology hints for every character used
data/sentences.js     7,051 graded example sentences
data/strokes-N.js     stroke outlines and medians for the characters first met at level N (loaded on demand)
vendor/hanzi-writer.min.js  stroke animation and quiz engine
tools/build_data.py   regenerates data/ from the upstream sources
tools/build_artifact.py  bundles everything into one HTML file
```

## Data sources and licences
- Vocabulary: [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT),
  definitions from CC-CEDICT (CC BY-SA 4.0).
- Character hints and stroke data: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi)
  (dictionary.txt LGPL-3.0, graphics.txt Arphic Public License).
- Sentences: [iam-nazmul/chinese](https://github.com/iam-nazmul/chinese) (MIT, hand-written HSK 1–4)
  and [Tatoeba](https://tatoeba.org) via [hsk-annotated-corpus](https://github.com/Roxaleen/hsk-annotated-corpus) (CC BY 2.0 FR).
- Stroke quizzes: [Hanzi Writer](https://github.com/chanind/hanzi-writer) (MIT).
- Fonts: Bricolage Grotesque, IBM Plex Sans and Noto Serif SC from Google Fonts; falls back to system fonts offline.
