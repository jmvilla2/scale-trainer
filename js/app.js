import { KEYS, buildKey, prettyName } from './theory.js';
import { renderKeySignature } from './keysig.js';
import { createKeyboard } from './keyboard.js';
import { initMIDI } from './midi.js';
import { playNote, playSuccess, unlockAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const mod = (n, m) => ((n % m) + m) % m;

// ---------- persisted settings ----------
const store = {
  get(k, d) {
    try { const v = localStorage.getItem('scaletrainer.' + k); return v === null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) { try { localStorage.setItem('scaletrainer.' + k, JSON.stringify(v)); } catch {} },
};

const settings = {
  mode: store.get('mode', 'major'),
  hand: store.get('hand', 'right'),
  order: store.get('order', 'fifths'),
  strict: store.get('strict', false),
  keyboard: store.get('keyboard', false),
  octaves: store.get('octaves', 2),
};
const save = (k, v) => { settings[k] = v; store.set(k, v); };

// ---------- state ----------
let deck = [];
let deckPos = 0;
let key = null;
let run = null;
let advancing = false;
let completed = store.get('completed', 0);
let midiConnected = false;

// ---------- deck ----------
function buildDeck(keepTonic) {
  const list = KEYS[settings.mode].slice();
  if (settings.order === 'random') {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  } else if (settings.order === 'chromatic') {
    list.sort((a, b) => buildKey(a, settings.mode, 1).tonicPc - buildKey(b, settings.mode, 1).tonicPc);
  }
  deck = list;
  deckPos = Math.max(0, keepTonic ? deck.findIndex((d) => d.tonic === keepTonic) : 0);
}

function go(delta) {
  deckPos += delta;
  if (deckPos >= deck.length) {
    if (settings.order === 'random') buildDeck(); else deckPos = 0;
  }
  if (deckPos < 0) deckPos = deck.length - 1;
  loadKey();
}

function loadKey() {
  key = buildKey(deck[deckPos], settings.mode, settings.octaves);
  advancing = false;
  $('card').classList.remove('success');
  $('keyName').textContent = key.title;
  $('sig').hidden = true;
  $('sig').innerHTML = renderKeySignature(key.signature);
  $('sigBtn').hidden = false;
  $('fingerings').hidden = true;
  $('fingerBtn').textContent = 'Show fingerings';
  renderFingerings();
  resetRun();
}

// ---------- run / checking ----------
function resetRun(message) {
  run = { step: 0, base: null, baseL: null, baseR: null, pending: new Set(), mistakes: 0 };
  renderProgress();
  setMsg(message || startMessage());
}

function startMessage() {
  const start = prettyName(key.tonic);
  const span = settings.octaves === 2 ? 'two octaves' : 'one octave';
  if (settings.hand === 'both') return `Start on ${start} with both hands (an octave or more apart), up ${span} and back down.`;
  return `Start on any ${start}, play up ${span} and back down.`;
}

function handleNote(note, fromScreen) {
  unlockAudio();
  if (fromScreen) playNote(note);
  if (advancing || !key) return;
  if (settings.hand === 'both') handleBoth(note); else handleSingle(note);
}

function handleSingle(n) {
  if (run.step === 0) {
    if (mod(n, 12) !== key.tonicPc) return hint(n);
    run.base = n;
    return completeStep(n);
  }
  if (n === run.base + key.offsets[run.step]) completeStep(n);
  else wrong(n);
}

function handleBoth(n) {
  if (run.step === 0) {
    if (mod(n, 12) !== key.tonicPc) {
      if (run.pending.size === 0) return hint(n);
      return wrong(n);
    }
    run.pending.add(n);
    kb?.flash(n, 'ok');
    const tonics = [...run.pending].sort((a, b) => a - b);
    if (tonics.length >= 2) {
      run.baseL = tonics[0];
      run.baseR = tonics[tonics.length - 1];
      completeStep(null);
    } else {
      renderProgress(true);
    }
    return;
  }
  const off = key.offsets[run.step];
  const expL = run.baseL + off;
  const expR = run.baseR + off;
  if (n !== expL && n !== expR) return wrong(n);
  run.pending.add(n);
  kb?.flash(n, 'ok');
  if (run.pending.has(expL) && run.pending.has(expR)) completeStep(null);
  else renderProgress(true);
}

function completeStep(n) {
  if (n !== null) kb?.flash(n, 'ok');
  run.step++;
  run.pending.clear();
  renderProgress();
  if (run.step >= key.offsets.length) return success();
  setMsg(run.step === key.upCount ? 'Top of the scale — now back down.' : '');
}

function hint(n) {
  kb?.flash(n, 'bad');
  setMsg(`Start on ${prettyName(key.tonic)}.`, 'warn');
}

function wrong(n) {
  kb?.flash(n, 'bad');
  run.mistakes++;
  const dot = $('progress').querySelectorAll('.pdot')[Math.min(run.step, key.offsets.length - 1)];
  if (dot) { dot.classList.remove('err'); void dot.offsetWidth; dot.classList.add('err'); }
  if (settings.strict) {
    resetRun(`Wrong note — start again from ${prettyName(key.tonic)}.`);
    setMsgClass('warn');
  } else {
    setMsg(`Not quite — expected ${key.sequence[run.step]}.`, 'warn');
  }
  renderStats();
}

function success() {
  advancing = true;
  completed++;
  store.set('completed', completed);
  $('card').classList.add('success');
  setMsg(run.mistakes === 0 ? '✓ Perfect! Next key…' : `✓ Done with ${run.mistakes} mistake${run.mistakes > 1 ? 's' : ''}. Next key…`, 'good');
  playSuccess();
  renderStats();
  setTimeout(() => go(1), 1400);
}

// ---------- rendering ----------
function renderProgress(partial = false) {
  const el = $('progress');
  el.innerHTML = '<div class="prow"><span class="arrow">↑</span><div class="pdots"></div></div>'
    + '<div class="prow"><span class="arrow">↓</span><div class="pdots"></div></div>';
  const rows = el.querySelectorAll('.pdots');
  key.sequence.forEach((name, i) => {
    const d = document.createElement('div');
    d.className = 'pdot';
    if (i < run.step) { d.classList.add('done'); d.textContent = name; }
    else if (i === run.step) {
      d.classList.add('current');
      if (partial) d.classList.add('half');
    }
    rows[i < key.upCount ? 0 : 1].appendChild(d);
  });
  renderStats();
}

function renderFingerings() {
  const showRH = settings.hand !== 'left';
  const showLH = settings.hand !== 'right';
  const cells = (arr) => arr.map((x) => `<td>${x}</td>`).join('');
  // One table per octave so it fits on a phone; octave 2 continues from octave 1.
  let html = '';
  for (let o = 0; o < key.octaves; o++) {
    const from = o === 0 ? 0 : 7 * o + 1;
    const to = 7 * (o + 1) + 1;
    const sl = (arr) => arr.slice(from, to);
    if (key.octaves > 1) html += `<div class="oct-label">Octave ${o + 1}</div>`;
    html += `<table><tbody><tr class="notes"><th></th>${cells(sl(key.upNotes))}</tr>`;
    if (showRH) html += `<tr><th>RH</th>${cells(sl(key.fingering.rh))}</tr>`;
    if (showLH) html += `<tr><th>LH</th>${cells(sl(key.fingering.lh))}</tr>`;
    html += '</tbody></table>';
  }
  html += `<p class="note">Ascending shown; use the same fingers in reverse on the way down. 1 = thumb.</p>`;
  $('fingerings').innerHTML = html;
}

function setMsg(text, cls = '') {
  $('msg').textContent = text;
  setMsgClass(cls);
}
function setMsgClass(cls) { $('msg').className = 'msg ' + cls; }

function renderStats() {
  $('stats').textContent = `Mistakes this run: ${run ? run.mistakes : 0} · Scales completed: ${completed}`;
}

function renderSettings() {
  for (const [segId, k] of [['modeSeg', 'mode'], ['handSeg', 'hand'], ['octSeg', 'octaves']]) {
    for (const b of $(segId).querySelectorAll('button')) {
      const on = b.dataset.val === String(settings[k]);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
      b.setAttribute('role', 'radio');
    }
  }
  $('orderSel').value = settings.order;
  $('strictChk').checked = settings.strict;
}

// ---------- keyboard ----------
let kb = null;
let kbRange = '';
// Both hands over two octaves needs C2–C6; everything else fits in C3–C6.
function buildKeyboard() {
  const low = settings.hand === 'both' && settings.octaves === 2 ? 36 : 48;
  const range = `${low}-84`;
  if (kb && range === kbRange) return;
  kbRange = range;
  kb = createKeyboard($('keyboard'), { low, high: 84, onPress: (n) => handleNote(n, true) });
}
function setKeyboardVisible(show) {
  save('keyboard', show);
  $('kbWrap').hidden = !show;
  $('kbBtn').textContent = show ? 'Hide keyboard' : 'Show keyboard';
  if (show) buildKeyboard();
  if (show) {
    // Center on middle C.
    const w = $('kbWrap');
    requestAnimationFrame(() => { w.scrollLeft = (w.scrollWidth - w.clientWidth) / 2; });
  }
}

// ---------- MIDI ----------
function onMidiStatus({ supported, denied, devices }) {
  const el = $('midiStatus');
  midiConnected = devices.length > 0;
  el.classList.toggle('connected', midiConnected);
  let text;
  if (!supported) text = 'This browser can’t use MIDI (Safari / iPhone). Use the on-screen keyboard.';
  else if (denied) text = 'MIDI access was blocked. Allow it in site settings, or use the on-screen keyboard.';
  else if (midiConnected) text = `MIDI: ${devices.join(', ')}`;
  else text = 'No MIDI device detected. Plug one in, or use the on-screen keyboard.';
  $('midiText').textContent = text;
}

// ---------- wire up ----------
function bind() {
  $('modeSeg').addEventListener('click', (e) => {
    const v = e.target.dataset?.val;
    if (!v || v === settings.mode) return;
    save('mode', v);
    renderSettings();
    buildDeck();
    loadKey();
  });
  $('handSeg').addEventListener('click', (e) => {
    const v = e.target.dataset?.val;
    if (!v || v === settings.hand) return;
    save('hand', v);
    renderSettings();
    renderFingerings();
    resetRun();
    if (!$('kbWrap').hidden) setKeyboardVisible(true);
  });
  $('octSeg').addEventListener('click', (e) => {
    const v = Number(e.target.dataset?.val);
    if (!v || v === settings.octaves) return;
    save('octaves', v);
    renderSettings();
    loadKey();
    if (!$('kbWrap').hidden) setKeyboardVisible(true);
  });
  $('orderSel').addEventListener('change', (e) => {
    save('order', e.target.value);
    buildDeck(settings.order === 'random' ? null : key.tonic);
    loadKey();
  });
  $('strictChk').addEventListener('change', (e) => save('strict', e.target.checked));

  $('prevBtn').addEventListener('click', () => go(-1));
  $('nextBtn').addEventListener('click', () => go(1));
  $('restartBtn').addEventListener('click', () => resetRun());

  $('sigBtn').addEventListener('click', () => { $('sig').hidden = false; $('sigBtn').hidden = true; });
  $('sig').addEventListener('click', () => { $('sig').hidden = true; $('sigBtn').hidden = false; });
  $('fingerBtn').addEventListener('click', () => {
    const f = $('fingerings');
    f.hidden = !f.hidden;
    $('fingerBtn').textContent = f.hidden ? 'Show fingerings' : 'Hide fingerings';
  });
  $('kbBtn').addEventListener('click', () => { unlockAudio(); setKeyboardVisible($('kbWrap').hidden); });

  // Computer-keyboard shortcuts: ← → to change keys.
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });
}

bind();
renderSettings();
buildDeck();
loadKey();
setKeyboardVisible(settings.keyboard);
initMIDI({ onNote: (n) => handleNote(n, false), onStatus: onMidiStatus });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
