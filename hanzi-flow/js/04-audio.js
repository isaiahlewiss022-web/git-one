/*
 * Hanzi Flow — 04-audio.js
 * Speech (Web Speech API, the browser's own Mandarin voice) and tiny synthesized sound effects.
 */
'use strict';

// ======== audio ========
const audio = {
  voices: [],
  voice: null,
  ctx: null,
  init() {
    if (!('speechSynthesis' in window)) return;
    const load = () => {
      try {
        this.voices = speechSynthesis
          .getVoices()
          .filter((v) => /^zh|^cmn|chinese|mandarin/i.test(v.lang + ' ' + v.name));
      } catch (e) {
        this.voices = [];
      }
      this.pick();
    };
    load();
    try {
      speechSynthesis.addEventListener('voiceschanged', load);
    } catch (e) {}
  },
  pick() {
    const want = state.settings.voice;
    this.voice =
      this.voices.find((v) => v.voiceURI === want) ||
      this.voices.find((v) => /zh[-_]CN|cmn[-_]Hans|cmn[-_]CN/i.test(v.lang)) ||
      this.voices.find((v) => /zh[-_]TW|cmn[-_]Hant/i.test(v.lang)) ||
      this.voices.find((v) => !/HK|yue/i.test(v.lang)) ||
      this.voices[0] ||
      null;
  },
  // Inside the Android app the WebView has no Web Speech voices; MainActivity exposes the
  // phone's own text-to-speech engine as window.AndroidTTS instead.
  get native() {
    return typeof window.AndroidTTS !== 'undefined' && window.AndroidTTS !== null;
  },
  get available() {
    if (!state.settings.audio) return false;
    if (this.native) {
      try {
        return !!window.AndroidTTS.isReady();
      } catch (e) {
        return false;
      }
    }
    return !!this.voice;
  },
  speak(text, rate) {
    if (!this.available) return false;
    if (this.native) {
      try {
        const r = rate || state.settings.rate;
        // 'app': Hanzi Flow plays the word itself, so the app's own volume slider applies.
        // 'phone' (default): the phone's voice speaks directly at media volume.
        if (state.settings.speechOut === 'app' && typeof window.AndroidTTS.speakVia === 'function')
          window.AndroidTTS.speakVia(String(text), r, true);
        else window.AndroidTTS.speak(String(text), r);
        return true;
      } catch (e) {
        return false;
      }
    }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = this.voice;
      u.lang = this.voice.lang || 'zh-CN';
      u.rate = rate || state.settings.rate;
      u.pitch = 1;
      speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  },
  sfx(kind) {
    if (!state.settings.sfx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = this.ctx || new AC();
      const c = this.ctx;
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      const seq = {
        good: [523.25, 783.99],
        perfect: [523.25, 659.25, 783.99, 1046.5],
        almost: [440, 440],
        bad: [220, 165],
        tick: [880],
        start: [392, 523.25, 659.25],
      }[kind] || [440];
      seq.forEach((f, i) => {
        const o = c.createOscillator(),
          g = c.createGain();
        o.type = kind === 'bad' ? 'triangle' : 'sine';
        o.frequency.value = f;
        const s = t + i * 0.075;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.09, s + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.19);
        o.connect(g).connect(c.destination);
        o.start(s);
        o.stop(s + 0.2);
      });
    } catch (e) {}
  },
};
