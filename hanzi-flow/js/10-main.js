/*
 * Hanzi Flow — 10-main.js
 * Start-up: load saved progress, set up audio, render the first screen, start cloud sync,
 * and preload stroke data for the selected levels.
 */
'use strict';

// ======== boot ========
function boot() {
  loadLocal();
  audio.init();
  $('#btn-settings').addEventListener('click', () => go('me', { settings: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (saveT) flushLocal();
      cloud.flush();
    }
  });
  const unlock = () => {
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    document.removeEventListener('pointerdown', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  window.addEventListener('storage', (e) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    try {
      const o = JSON.parse(e.newValue);
      for (const [k, v] of Object.entries(o.items || {})) {
        if (!BY.has(k) || !v || typeof v !== 'object') continue;
        const cur = state.items[k];
        if (!cur || (v.n || 0) > (cur.n || 0)) state.items[k] = v;
      }
      if (o.stats && typeof o.stats === 'object')
        mergeStats({ stats: o.stats, settings: o.settings });
      normalizeSettings();
    } catch (err) {}
    softRender();
  });
  render();
  cloud.init();
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  idle(() => {
    const chars = new Set();
    for (const l of state.settings.levels)
      for (const w of BY_LEVEL[l]) for (const c of w.s) chars.add(c);
    ensureStrokes([...chars]).catch(() => {});
  });
  try {
    if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function')
      window.claude.hot.snapshot(() => ({ screen: state.ui.screen }));
  } catch (e) {}
}
if (!W.length) {
  screenEl.append(
    h(
      'div',
      { class: 'card' },
      h('h2', null, 'Word data did not load'),
      h(
        'p',
        { class: 'muted' },
        'Open index.html from the project folder so the data/ files sit next to it.',
      ),
    ),
  );
} else boot();
